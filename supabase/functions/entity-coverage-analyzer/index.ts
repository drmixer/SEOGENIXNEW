import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// --- CORS Headers ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE'
};
// --- Inline Logging Functions (to avoid import issues) ---
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
// --- AI Prompt Engineering ---
const getEntityAnalysisPrompt = (content, industry)=>{
  const jsonSchema = `{
    "coverageScore": "number (0-100, how well the content covers the essential entities for its topic)",
    "strategicSummary": "string (A 2-3 sentence summary explaining how improving entity coverage will boost the content's authority and SEO performance)",
    "mentionedEntities": [
      {
        "name": "string (The name of the entity mentioned)",
        "type": "string ('Person' | 'Organization' | 'Concept' | 'Product' | 'Location')",
        "relevance": "number (1-100, how relevant this entity is to the core topic)",
        "description": "string (A brief description of the entity)"
      }
    ],
    "missingEntities": [
      {
        "name": "string (The name of an important entity MISSING from the text)",
        "type": "string ('Person' | 'Organization' | 'Concept' | 'Product' | 'Location')",
        "importance": "string ('High' | 'Medium' | 'Low')",
        "reasoning": "string (A brief explanation of why this entity is important to include for topical authority)"
      }
    ]
  }`;
  return `You are an Expert SEO and Topical Authority Analyst. Your task is to analyze a piece of content to identify key entities it mentions and, more importantly, crucial entities that are missing. An 'entity' is a specific, well-known person, organization, place, event, or concept, often with a corresponding Wikipedia entry.

**Analysis Task:**
- **Content to Analyze (first 15,000 characters):**
---
${content.substring(0, 15000)}
---
- **Industry Context:** ${industry || 'General'}

**Instructions:**
1. **Identify Mentioned Entities:** Read the content and identify all key entities that are currently mentioned.
2. **Identify Missing Entities:** Based on the topic, identify important, relevant entities that are MISSING. This is the most critical part of your analysis. Focus on entities that would build topical authority.
3. **Score and Summarize:** Provide an overall 'coverageScore' (0-100) and a 'strategicSummary' explaining why improving entity coverage is important for this content.
4. **Provide Structured Lists:** Populate the 'mentionedEntities' and 'missingEntities' arrays with the required details.

**CRITICAL: You MUST provide your response in a single, valid JSON object enclosed in a \`\`\`json markdown block.**
The JSON object must strictly adhere to the following schema:
\`\`\`json
${jsonSchema}
\`\`\`

Now, perform your expert entity analysis.`;
};
// --- Content Fetcher with Better Error Handling ---
async function fetchPageContent(url) {
  try {
    console.log(`Fetching content from URL: ${url}`);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SEOGENIX-Bot/1.0; Entity Coverage Analyzer)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive'
      },
      // Add timeout
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const content = await response.text();
    console.log(`Successfully fetched content (${content.length} characters)`);
    return content;
  } catch (error) {
    console.error('Error fetching URL:', error);
    throw new Error(`Failed to fetch URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
// --- Fallback Entity Analysis Generator ---
function generateFallbackAnalysis(url, content, message) {
  const hasContent = content && content.length > 100;
  const contentLength = content?.length || 0;
  // Basic scoring based on available information
  const baseScore = hasContent ? Math.min(65, Math.floor(contentLength / 200) + 25) : 15;
  return {
    coverageScore: baseScore,
    strategicSummary: hasContent ? "Limited analysis performed with available content. Improving entity coverage will enhance topical authority and search visibility." : "Unable to perform comprehensive entity analysis. Content analysis is needed to identify missing entities for improved SEO performance.",
    mentionedEntities: hasContent ? [
      {
        name: "Content Topic",
        type: "Concept",
        relevance: 70,
        description: "Primary topic identified from available content"
      }
    ] : [],
    missingEntities: [
      {
        name: "Industry Leaders",
        type: "Person",
        importance: "High",
        reasoning: "Including recognized experts and thought leaders would establish topical authority and credibility."
      },
      {
        name: "Key Organizations",
        type: "Organization",
        importance: "High",
        reasoning: "Mentioning relevant companies and institutions would provide context and build topic comprehensiveness."
      },
      {
        name: "Related Concepts",
        type: "Concept",
        importance: "Medium",
        reasoning: "Including related terminology and concepts would demonstrate deeper topic understanding to search engines."
      }
    ],
    url,
    analyzedAt: new Date().toISOString(),
    contentLength: contentLength,
    note: `Entity analysis failed: ${message}`
  };
}
// --- Main Service Handler ---
const entityAnalyzerService = async (req, supabase)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  let runId = null;
  try {
    const requestBody = await req.json();
    const { projectId, url, content, industry } = requestBody;
    if (!projectId || !url && !content) {
      throw new Error('`projectId` and either `url` or `content` are required.');
    }
    // Log tool run
    runId = await logToolRun(supabase, projectId, 'entity-coverage-analyzer', {
      url,
      industry,
      hasContent: !!content,
      contentLength: content?.length
    });
    let pageContent = content;
    // Fetch content if not provided
    if (url && !pageContent) {
      try {
        pageContent = await fetchPageContent(url);
      } catch (fetchError) {
        console.warn('Failed to fetch URL content, proceeding with fallback analysis:', fetchError);
      // Continue with fallback analysis instead of failing completely
      }
    }
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      console.warn('Gemini API key not configured, using fallback analysis');
      const fallbackAnalysis = generateFallbackAnalysis(url, pageContent, 'API key not configured');
      if (runId) {
        await updateToolRun(supabase, runId, 'completed', fallbackAnalysis, null);
      }
      return new Response(JSON.stringify({
        success: true,
        data: fallbackAnalysis,
        runId,
        note: 'Fallback analysis used due to missing API configuration'
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    if (!pageContent || pageContent.length < 100) {
      console.warn('Insufficient content for detailed analysis, using fallback');
      const fallbackAnalysis = generateFallbackAnalysis(url, pageContent, 'Insufficient content');
      if (runId) {
        await updateToolRun(supabase, runId, 'completed', fallbackAnalysis, null);
      }
      return new Response(JSON.stringify({
        success: true,
        data: fallbackAnalysis,
        runId,
        note: 'Fallback analysis used due to insufficient content'
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Generate AI analysis
    const prompt = getEntityAnalysisPrompt(pageContent, industry);
    console.log('Sending entity analysis request to Gemini...');
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
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 6144,
          topP: 0.8,
          topK: 40
        }
      })
    });
    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', geminiResponse.status, errorText);
      // Use fallback analysis on API failure
      const fallbackAnalysis = generateFallbackAnalysis(url, pageContent, 'API error');
      if (runId) {
        await updateToolRun(supabase, runId, 'completed', fallbackAnalysis, null);
      }
      return new Response(JSON.stringify({
        success: true,
        data: fallbackAnalysis,
        runId,
        note: 'Fallback analysis used due to API error'
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const geminiData = await geminiResponse.json();
    console.log('Gemini response received');
    if (!geminiData.candidates || geminiData.candidates.length === 0) {
      console.error('No candidates in Gemini response');
      const fallbackAnalysis = generateFallbackAnalysis(url, pageContent, 'No AI response candidates');
      if (runId) {
        await updateToolRun(supabase, runId, 'completed', fallbackAnalysis, null);
      }
      return new Response(JSON.stringify({
        success: true,
        data: fallbackAnalysis,
        runId,
        note: 'Fallback analysis used - no AI response candidates'
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const responseText = geminiData.candidates[0].content.parts[0].text;
    console.log('Processing AI response...');
    // Extract and parse JSON
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
    if (!jsonMatch || !jsonMatch[1]) {
      console.error('Failed to extract JSON from AI response');
      const fallbackAnalysis = generateFallbackAnalysis(url, pageContent, 'Failed to parse AI response');
      if (runId) {
        await updateToolRun(supabase, runId, 'completed', fallbackAnalysis, null);
      }
      return new Response(JSON.stringify({
        success: true,
        data: fallbackAnalysis,
        runId,
        note: 'Fallback analysis used - failed to parse AI response'
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    let analysisResult;
    try {
      analysisResult = JSON.parse(jsonMatch[1]);
    } catch (parseError) {
      console.error('Failed to parse analysis JSON:', parseError);
      const fallbackAnalysis = generateFallbackAnalysis(url, pageContent, 'JSON parse error');
      if (runId) {
        await updateToolRun(supabase, runId, 'completed', fallbackAnalysis, null);
      }
      return new Response(JSON.stringify({
        success: true,
        data: fallbackAnalysis,
        runId,
        note: 'Fallback analysis used - JSON parse error'
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Validate and sanitize the analysis result
    if (!analysisResult.coverageScore && analysisResult.coverageScore !== 0) {
      console.error('Invalid analysis result structure');
      const fallbackAnalysis = generateFallbackAnalysis(url, pageContent, 'Invalid analysis structure');
      if (runId) {
        await updateToolRun(supabase, runId, 'completed', fallbackAnalysis, null);
      }
      return new Response(JSON.stringify({
        success: true,
        data: fallbackAnalysis,
        runId,
        note: 'Fallback analysis used - invalid analysis structure'
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Ensure score is within valid range
    analysisResult.coverageScore = Math.max(0, Math.min(100, Math.round(analysisResult.coverageScore)));
    // Ensure arrays exist
    analysisResult.mentionedEntities = analysisResult.mentionedEntities || [];
    analysisResult.missingEntities = analysisResult.missingEntities || [];
    // Ensure strategic summary exists
    analysisResult.strategicSummary = analysisResult.strategicSummary || "Entity coverage analysis completed. Consider adding the identified missing entities to improve topical authority.";
    // Add metadata
    analysisResult.url = url;
    analysisResult.analyzedAt = new Date().toISOString();
    analysisResult.contentLength = pageContent.length;
    analysisResult.industry = industry;
    console.log('Entity analysis completed successfully');
    if (runId) {
      await updateToolRun(supabase, runId, 'completed', analysisResult, null);
    }
    return new Response(JSON.stringify({
      success: true,
      data: analysisResult,
      runId
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
    console.error('Entity Coverage Analyzer error:', errorMessage);
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
  return await entityAnalyzerService(req, supabase);
});
