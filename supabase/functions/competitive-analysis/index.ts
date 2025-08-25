import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// --- CORS Headers ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE'
};
// --- Inline Logging Functions ---
async function logToolRun(supabase, projectId, toolName, inputPayload) {
  if (!projectId) {
    throw new Error("logToolRun error: projectId is required.");
  }
  console.log(`Logging tool run: ${toolName} for project: ${projectId}`);
  const { data, error } = await supabase.from("tool_runs").insert({
    project_id: projectId,
    tool_name: toolName,
    input_payload: inputPayload,
    status: "running",
    created_at: new Date().toISOString()
  }).select("id").single();
  if (error) {
    console.error("Error logging tool run:", error);
    throw new Error(`Failed to log tool run. Supabase error: ${error.message}`);
  }
  if (!data || !data.id) {
    console.error("No data or data.id returned from tool_runs insert.");
    throw new Error("Failed to log tool run: No data returned after insert.");
  }
  console.log(`Tool run logged with ID: ${data.id}`);
  return data.id;
}
async function updateToolRun(supabase, runId, status, outputPayload, errorMessage) {
  if (!runId) {
    console.error("updateToolRun error: runId is required.");
    return;
  }
  console.log(`Updating tool run ${runId} with status: ${status}`);
  const update = {
    status,
    completed_at: new Date().toISOString(),
    output_payload: errorMessage ? {
      error: errorMessage
    } : outputPayload || null,
    error_message: errorMessage || null
  };
  const { error } = await supabase.from("tool_runs").update(update).eq("id", runId);
  if (error) {
    console.error(`Error updating tool run ID ${runId}:`, error);
  } else {
    console.log(`Tool run ${runId} updated successfully`);
  }
}
// --- Helper for URL analysis ---
const getAnalysisPrompt = (url, content, industry)=>{
  const jsonSchema = `{
        "overallScore": "number (0-100, overall AI visibility score)",
        "subscores": {
            "aiUnderstanding": "number (0-100)",
            "citationLikelihood": "number (0-100)",
            "conversationalReadiness": "number (0-100)",
            "contentStructure": "number (0-100)"
        },
        "strengths": ["string (2-3 key strengths)"],
        "weaknesses": ["string (2-3 key weaknesses)"],
        "opportunities": ["string (2-3 actionable opportunities)"]
    }`;
  return `You are a Competitive SEO Analyst. Analyze the following website content for its AI visibility and SEO performance.

**URL:** ${url}
**Industry Context:** ${industry || 'Not provided'}
**Content Snippet:** ${content.substring(0, 8000)}

**Instructions:**
1. Score the site from 0-100 on the four sub-metrics.
2. Calculate an overall score.
3. Provide brief, bulleted lists for strengths, weaknesses, and opportunities.

**CRITICAL: You MUST provide your response in a single, valid JSON object enclosed in a \`\`\`json markdown block.**
The JSON object must follow this exact schema:
\`\`\`json
${jsonSchema}
\`\`\`

Analyze the site now.`;
};
const analyzeUrl = async (url, industry, apiKey)=>{
  console.log(`Analyzing URL: ${url}`);
  let content = '';
  // Fetch page content
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'SEOGENIX Analysis Bot 1.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });
    if (response.ok) {
      content = await response.text();
    } else {
      console.warn(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    }
  } catch (fetchError) {
    console.error(`Failed to fetch content for ${url}:`, fetchError instanceof Error ? fetchError.message : 'Unknown error');
  }
  const prompt = getAnalysisPrompt(url, content, industry);
  const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2048,
        topP: 0.8,
        topK: 40
      }
    })
  });
  if (!geminiResponse.ok) {
    const errorBody = await geminiResponse.text();
    throw new Error(`Analysis failed for ${url}. Status: ${geminiResponse.status}. Body: ${errorBody}`);
  }
  const geminiData = await geminiResponse.json();
  if (!geminiData.candidates || geminiData.candidates.length === 0) {
    throw new Error(`No content generated for ${url}`);
  }
  const responseText = geminiData.candidates[0].content.parts[0].text;
  const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
  if (!jsonMatch || !jsonMatch[1]) {
    throw new Error(`Failed to extract JSON from AI response for ${url}.`);
  }
  const analysisResult = JSON.parse(jsonMatch[1]);
  return {
    url,
    name: new URL(url).hostname,
    analyzedAt: new Date().toISOString(),
    ...analysisResult
  };
};
// --- Main Service Handler ---
const competitiveAnalysisService = async (req, supabase)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  let runId = null;
  try {
    const { projectId, primaryUrl, competitorUrls, industry } = await req.json();
    if (!projectId || !primaryUrl || !competitorUrls?.length) {
      throw new Error('`projectId`, `primaryUrl`, and `competitorUrls` are required.');
    }
    runId = await logToolRun(supabase, projectId, 'competitive-analysis', {
      primaryUrl,
      competitorUrls,
      industry
    });
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('Gemini API key not configured');
    }
    const allUrls = [
      primaryUrl,
      ...competitorUrls
    ];
    const analysisPromises = allUrls.map((url)=>analyzeUrl(url, industry, geminiApiKey));
    const results = await Promise.allSettled(analysisPromises);
    const successfulAnalyses = [];
    const failedAnalyses = [];
    results.forEach((result, index)=>{
      if (result.status === 'fulfilled') {
        successfulAnalyses.push(result.value);
      } else {
        console.error(`Analysis failed for ${allUrls[index]}:`, result.reason);
        failedAnalyses.push(allUrls[index]);
      }
    });
    if (successfulAnalyses.length === 0) {
      throw new Error('All URL analyses failed. Please check the URLs and try again.');
    }
    const primarySiteAnalysis = successfulAnalyses.find((a)=>a.url === primaryUrl);
    const competitorAnalyses = successfulAnalyses.filter((a)=>a.url !== primaryUrl);
    const averageCompetitorScore = competitorAnalyses.length > 0 ? Math.round(competitorAnalyses.reduce((sum, c)=>sum + c.overallScore, 0) / competitorAnalyses.length) : 0;

    // Sort all sites by score to determine ranking
    const allRankedSites = successfulAnalyses.sort((a, b) => (b.overallScore || 0) - (a.overallScore || 0));
    const primarySiteRank = allRankedSites.findIndex(a => a.url === primaryUrl) + 1;

    const summary = {
      ranking: primarySiteRank > 0 ? primarySiteRank : 'N/A',
      primarySiteScore: primarySiteAnalysis?.overallScore || 0,
      averageCompetitorScore,
      totalSitesAnalyzed: successfulAnalyses.length,
      failedSites: failedAnalyses.length,
      failedUrls: failedAnalyses
    };
    const output = {
      primarySiteAnalysis,
      competitorAnalyses,
      summary,
      analyzedAt: new Date().toISOString()
    };
    await updateToolRun(supabase, runId, 'completed', output, null);
    return new Response(JSON.stringify({
      success: true,
      data: output,
      runId
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
    console.error('Competitive analysis error:', err);
    if (runId) {
      await updateToolRun(supabase, runId, 'error', null, errorMessage);
    }
    return new Response(JSON.stringify({
      success: false,
      error: {
        message: errorMessage
      },
      runId
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
};
// --- Server ---
Deno.serve(async (req)=>{
  const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  return await competitiveAnalysisService(req, supabase);
});

