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
const getSummaryPrompt = (url, summaryType, pageContent)=>{
  const summaryPrompts = {
    overview: `Create a comprehensive overview summary of this website.`,
    technical: `Generate a technical summary focusing on the website's functionality, frameworks, and structure.`,
    business: `Create a business-focused summary highlighting services, products, and target market.`,
    audience: `Generate an audience-focused summary describing the ideal user or customer for this website.`
  };
  const jsonSchema = `{
    "summary": "string (The detailed, well-written summary based on the requested type)",
    "keyEntities": ["string (A list of key people, products, or company names mentioned)"],
    "mainTopics": ["string (A list of the main topics or themes covered)"],
    "suggestedNextStep": "string (Based on the summary, suggest a single, actionable next step for the user, such as 'Run a schema-generator' or 'Analyze competitors')"
  }`;
  return `You are a Website Analysis Expert. Your task is to generate a specific type of summary for the given URL and content.

**Context:**
- **URL:** ${url}
- **Summary Type Requested:** ${summaryType}
- **Content Snippet (first 12,000 characters):**
---
${pageContent.substring(0, 12000)}
---

**Instructions:**
1. Read the content and generate the requested summary type: ${summaryPrompts[summaryType] || summaryPrompts['overview']}
2. Extract the key entities and main topics from the content.
3. Based on your summary, provide a single, actionable 'suggestedNextStep'.
4. Ensure the summary is concise, accurate, and directly addresses the prompt.

**CRITICAL: You MUST provide your response in a single, valid JSON object enclosed in a \`\`\`json markdown block.**
The JSON object must follow this exact schema:
\`\`\`json
${jsonSchema}
\`\`\`

Generate the site summary now.`;
};
// --- Content Fetcher with Better Error Handling ---
async function fetchPageContent(url) {
  try {
    console.log(`Fetching content from URL: ${url}`);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SEOGENIX-Bot/1.0; Site Summary Generator)',
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
// --- Fallback Summary Generator ---
function generateFallbackSummary(url, summaryType, message) {
  return {
    summary: `Could not generate a ${summaryType} summary for ${url}: ${message}. This appears to be a website that may contain valuable information, but detailed analysis was not possible.`,
    keyEntities: [],
    mainTopics: [],
    suggestedNextStep: "Run a full AI Visibility Audit to diagnose potential issues and get detailed insights.",
    url,
    summaryType,
    generatedAt: new Date().toISOString(),
    note: `Summary generation failed: ${message}`
  };
}
// --- Main Service Handler ---
const llmSiteSummariesService = async (req, supabase)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  let runId = null;
  try {
    const requestBody = await req.json();
    const { projectId, url, content, summaryType } = requestBody;
    if (!projectId || !url || !summaryType) {
      throw new Error('`projectId`, `url`, and `summaryType` are required.');
    }
    // Validate summaryType
    const validTypes = [
      'overview',
      'technical',
      'business',
      'audience'
    ];
    if (!validTypes.includes(summaryType)) {
      throw new Error(`Invalid summaryType. Must be one of: ${validTypes.join(', ')}`);
    }
    // Log tool run
    runId = await logToolRun(supabase, projectId, 'llm-site-summaries', {
      url,
      summaryType,
      hasContent: !!content,
      contentLength: content?.length
    });
    let pageContent = content;
    // Fetch content if not provided
    if (!pageContent) {
      try {
        pageContent = await fetchPageContent(url);
      } catch (fetchError) {
        console.warn('Failed to fetch URL content, proceeding with fallback summary:', fetchError);
      // Continue with fallback summary instead of failing completely
      }
    }
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      console.warn('Gemini API key not configured, using fallback summary');
      const fallbackSummary = generateFallbackSummary(url, summaryType, 'API key not configured');
      if (runId) {
        await updateToolRun(supabase, runId, 'completed', fallbackSummary, null);
      }
      return new Response(JSON.stringify({
        success: true,
        data: fallbackSummary,
        runId,
        note: 'Fallback summary used due to missing API configuration'
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    if (!pageContent || pageContent.length < 100) {
      console.warn('Insufficient content for detailed summary, using fallback');
      const fallbackSummary = generateFallbackSummary(url, summaryType, 'Insufficient content available');
      if (runId) {
        await updateToolRun(supabase, runId, 'completed', fallbackSummary, null);
      }
      return new Response(JSON.stringify({
        success: true,
        data: fallbackSummary,
        runId,
        note: 'Fallback summary used due to insufficient content'
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Generate AI summary
    const prompt = getSummaryPrompt(url, summaryType, pageContent);
    console.log('Sending site summary request to Gemini...');
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
          temperature: 0.3,
          maxOutputTokens: 4096,
          topP: 0.8,
          topK: 40
        }
      })
    });
    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', geminiResponse.status, errorText);
      // Use fallback summary on API failure
      const fallbackSummary = generateFallbackSummary(url, summaryType, 'API error');
      if (runId) {
        await updateToolRun(supabase, runId, 'completed', fallbackSummary, null);
      }
      return new Response(JSON.stringify({
        success: true,
        data: fallbackSummary,
        runId,
        note: 'Fallback summary used due to API error'
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
      const fallbackSummary = generateFallbackSummary(url, summaryType, 'No AI response candidates');
      if (runId) {
        await updateToolRun(supabase, runId, 'completed', fallbackSummary, null);
      }
      return new Response(JSON.stringify({
        success: true,
        data: fallbackSummary,
        runId,
        note: 'Fallback summary used - no AI response candidates'
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
      const fallbackSummary = generateFallbackSummary(url, summaryType, 'Failed to parse AI response');
      if (runId) {
        await updateToolRun(supabase, runId, 'completed', fallbackSummary, null);
      }
      return new Response(JSON.stringify({
        success: true,
        data: fallbackSummary,
        runId,
        note: 'Fallback summary used - failed to parse AI response'
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    let summaryResult;
    try {
      summaryResult = JSON.parse(jsonMatch[1]);
    } catch (parseError) {
      console.error('Failed to parse summary JSON:', parseError);
      const fallbackSummary = generateFallbackSummary(url, summaryType, 'JSON parse error');
      if (runId) {
        await updateToolRun(supabase, runId, 'completed', fallbackSummary, null);
      }
      return new Response(JSON.stringify({
        success: true,
        data: fallbackSummary,
        runId,
        note: 'Fallback summary used - JSON parse error'
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Validate summary result structure
    if (!summaryResult.summary) {
      console.error('Invalid summary result structure');
      const fallbackSummary = generateFallbackSummary(url, summaryType, 'Invalid summary structure');
      if (runId) {
        await updateToolRun(supabase, runId, 'completed', fallbackSummary, null);
      }
      return new Response(JSON.stringify({
        success: true,
        data: fallbackSummary,
        runId,
        note: 'Fallback summary used - invalid summary structure'
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Ensure arrays exist
    summaryResult.keyEntities = summaryResult.keyEntities || [];
    summaryResult.mainTopics = summaryResult.mainTopics || [];
    // Ensure suggested next step exists
    summaryResult.suggestedNextStep = summaryResult.suggestedNextStep || "Run a comprehensive AI Visibility Audit to get detailed insights and recommendations.";
    // Add metadata
    summaryResult.url = url;
    summaryResult.summaryType = summaryType;
    summaryResult.generatedAt = new Date().toISOString();
    summaryResult.contentLength = pageContent.length;
    console.log('Site summary completed successfully');
    if (runId) {
      await updateToolRun(supabase, runId, 'completed', summaryResult, null);
    }
    return new Response(JSON.stringify({
      success: true,
      data: summaryResult,
      runId
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
    console.error('LLM Site Summaries error:', errorMessage);
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
  return await llmSiteSummariesService(req, supabase);
});
