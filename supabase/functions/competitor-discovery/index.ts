import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "node:crypto";
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
// --- AI Prompt ---
const getRelevancePrompt = (competitors, payload)=>{
  const jsonSchema = `{
      "competitors": [
        {
          "url": "string (The competitor's URL from the list)",
          "relevanceScore": "number (0-100, how relevant this competitor is)",
          "explanation": "string (A brief 1-sentence explanation of why)"
        }
      ]
    }`;
  return `You are an expert Market Analyst. Analyze the list of potential competitors and determine their relevance to the user.

**User's Industry:** ${payload.industry}
**User's Topic:** ${payload.topic || 'Not specified'}
**User's Description:** ${payload.userDescription || 'Not specified'}
**Potential Competitors (from Google Search):** ${JSON.stringify(competitors.map((c)=>({
      title: c.title,
      link: c.link,
      snippet: c.snippet
    })), null, 2)}

**Instructions:**
1. Review the user's details and the list of potential competitors.
2. For each competitor, assign a 'relevanceScore' from 0 to 100.
3. Provide a brief 'explanation' for your score.

**CRITICAL: You MUST provide your response in a single, valid JSON object enclosed in a \`\`\`json markdown block.**
The JSON object must follow this exact schema:
\`\`\`json
${jsonSchema}
\`\`\`

If a competitor is not relevant, give it a low score. Analyze the list now.`;
};
// --- Main Service Handler ---
export const competitorDiscoveryService = async (req, supabase)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  let runId = null;
  try {
    const payload = await req.json();
    const { industry, topic, existingCompetitors = [], projectId } = payload;
    if (!projectId) {
      throw new Error('`projectId` is required.');
    }
    if (!industry && !topic) {
      throw new Error('Either `industry` or `topic` is required.');
    }
    runId = await logToolRun(supabase, projectId, 'competitor-discovery', payload);
    const googleApiKey = Deno.env.get('GOOGLE_SEARCH_API_KEY');
    const googleCx = Deno.env.get('GOOGLE_SEARCH_ENGINE_ID');
    const mozAccessId = Deno.env.get('MOZ_ACCESS_ID');
    const mozSecretKey = Deno.env.get('MOZ_SECRET_KEY');
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!googleApiKey || !googleCx || !mozAccessId || !mozSecretKey || !geminiApiKey) {
      throw new Error('Required API keys are not configured as secrets.');
    }
    // Search for potential competitors
    const searchQuery = `top ${industry || ''} ${topic || ''} companies`;
    const googleUrl = `https://www.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${googleCx}&q=${encodeURIComponent(searchQuery)}`;
    const googleResponse = await fetch(googleUrl);
    if (!googleResponse.ok) {
      const errorText = await googleResponse.text();
      throw new Error(`Google Search API failed: ${googleResponse.status} ${errorText}`);
    }
    const searchResults = await googleResponse.json();
    const potentialCompetitors = searchResults.items?.filter((item)=>item.link && !existingCompetitors.some((existing)=>item.link.includes(existing))).slice(0, 15) || [];
    if (potentialCompetitors.length === 0) {
      const emptyResult = {
        competitorSuggestions: []
      };
      await updateToolRun(supabase, runId, 'completed', emptyResult, null);
      return new Response(JSON.stringify({
        success: true,
        data: emptyResult,
        runId
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Analyze relevance with AI
    const relevancePrompt = getRelevancePrompt(potentialCompetitors, payload);
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: relevancePrompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 4096,
          topP: 0.8,
          topK: 40
        }
      })
    });
    if (!geminiResponse.ok) {
      const errorBody = await geminiResponse.text();
      throw new Error(`The AI model failed to process the request. Status: ${geminiResponse.status}. Body: ${errorBody}`);
    }
    const geminiData = await geminiResponse.json();
    if (!geminiData.candidates || geminiData.candidates.length === 0) {
      throw new Error('No content generated by Gemini API');
    }
    const responseText = geminiData.candidates[0].content.parts[0].text;
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
    if (!jsonMatch || !jsonMatch[1]) {
      throw new Error('Failed to extract JSON from AI response.');
    }
    const relevanceAnalysis = JSON.parse(jsonMatch[1]);
    const relevanceMap = new Map(relevanceAnalysis.competitors.map((c)=>[
        c.url,
        c
      ]));
    // Get SEO metrics for relevant competitors
    const competitors = [];
    for (const competitor of potentialCompetitors){
      try {
        const url = competitor.link;
        const relevanceInfo = relevanceMap.get(url);
        if (!relevanceInfo || relevanceInfo.relevanceScore < 30) continue;
        const domain = new URL(url).hostname;
        // Get Moz domain authority
        const expires = Math.floor(Date.now() / 1000) + 300;
        const sig = createHmac('sha1', mozSecretKey).update(`${mozAccessId}\n${expires}`).digest('base64');
        const mozUrl = `https://lsapi.seomoz.com/v2/url_metrics?cols=4&url=${encodeURIComponent(domain)}&AccessID=${mozAccessId}&Expires=${expires}&Signature=${encodeURIComponent(sig)}`;
        let domainAuthority = null;
        try {
          const mozResponse = await fetch(mozUrl);
          if (mozResponse.ok) {
            const mozData = await mozResponse.json();
            domainAuthority = mozData?.domain_authority || null;
          }
        } catch (mozError) {
          console.warn(`Failed to get Moz data for ${domain}:`, mozError);
        }
        competitors.push({
          name: competitor.title || domain,
          url: url,
          domainAuthority: domainAuthority,
          relevanceScore: relevanceInfo.relevanceScore,
          explanation: relevanceInfo.explanation,
          analyzedAt: new Date().toISOString()
        });
      } catch (e) {
        console.error(`Failed to process competitor URL ${competitor.link}:`, e);
      }
    }
    // Sort by relevance score and limit results
    competitors.sort((a, b)=>b.relevanceScore - a.relevanceScore);
    const output = {
      competitorSuggestions: competitors.slice(0, 10)
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
    console.error('Competitor discovery error:', err);
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
  return await competitorDiscoveryService(req, supabase);
});
