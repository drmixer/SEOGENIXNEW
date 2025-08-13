import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- SHARED: CORS Headers ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- SHARED: Response Helpers ---
function createErrorResponse(message: string, status = 500, details?: any) {
  return new Response(JSON.stringify({
    success: false,
    error: {
      message,
      details: details || undefined,
    }
  }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function createSuccessResponse(data: object, status = 200) {
  return new Response(JSON.stringify({
    success: true,
    data,
  }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// --- SHARED: Service Handler ---
async function serviceHandler(req: Request, toolLogic: Function) {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    const supabaseAdminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return createErrorResponse('Missing Authorization header', 401);

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return createErrorResponse('Invalid or expired token', 401);

    return await toolLogic(req, { user, supabaseClient, supabaseAdminClient });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unknown server error occurred.';
    console.error(`[ServiceHandler Error]`, err);
    return createErrorResponse(errorMessage, 500, err instanceof Error ? err.stack : undefined);
  }
}

// --- SHARED: Database Logging Helpers ---
async function logToolRun(supabase: SupabaseClient, projectId: string, toolName: string, inputPayload: object) {
  if (!projectId) throw new Error("logToolRun error: projectId is required.");
  const { data, error } = await supabase.from("tool_runs").insert({ project_id: projectId, tool_name: toolName, input_payload: inputPayload, status: "running" }).select("id").single();
  if (error) throw new Error(`Failed to log tool run. Supabase error: ${error.message}`);
  if (!data?.id) throw new Error("Failed to log tool run: No data returned after insert.");
  return data.id;
}

async function updateToolRun(supabase: SupabaseClient, runId: string, status: string, outputPayload: object | null, errorMessage: string | null) {
  if (!runId) return;
  const update = { status, completed_at: new Date().toISOString(), output_payload: errorMessage ? { error: errorMessage } : outputPayload || null, error_message: errorMessage || null };
  const { error } = await supabase.from("tool_runs").update(update).eq("id", runId);
  if (error) console.error(`Error updating tool run ID ${runId}:`, error);
}

// --- SHARED: Robust AI Call Function ---
async function callGeminiWithRetry(prompt: string, apiKey: string) {
  // Omitting for brevity - this is the same shared function
  let attempts = 0;
  const maxAttempts = 4;
  let delay = 1000;
  while (attempts < maxAttempts) {
    try {
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
          }),
        }
      );
      if (!geminiResponse.ok) {
        if (geminiResponse.status === 429 || geminiResponse.status === 503) {
            throw new Error(`Retryable Gemini API error: ${geminiResponse.status}`);
        }
        throw new Error(`Gemini API failed with status ${geminiResponse.status}`);
      }
      const geminiData = await geminiResponse.json();
      const candidate = geminiData.candidates?.[0];
      const responseText = candidate?.content?.parts?.[0]?.text;
      if (!responseText) throw new Error('Invalid response structure from Gemini API');
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
      if (!jsonMatch?.[1]) throw new Error('Failed to extract JSON from AI response.');
      return JSON.parse(jsonMatch[1]);
    } catch (error) {
       if (error.message.includes("Retryable")) {
            attempts++;
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2;
       } else {
           throw error;
       }
    }
  }
  throw new Error("The AI model is currently overloaded after multiple retries.");
}

// --- TOOL-SPECIFIC: Type Definitions ---
interface AnalysisRequest {
    projectId: string;
    primaryUrl: string;
    competitorUrls: string[];
    industry?: string;
}

// --- TOOL-SPECIFIC: AI Prompt & Analysis Logic ---
const getAnalysisPrompt = (url: string, content: string, industry?: string) => {
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
    - **URL:** ${url}
    - **Industry Context:** ${industry || 'Not provided'}
    - **Content Snippet:** ${content.substring(0, 8000)}

    **Instructions:**
    1.  Score the site from 0-100 on the four sub-metrics.
    2.  Calculate an overall score.
    3.  Provide brief, bulleted lists for strengths, weaknesses, and opportunities.

    **CRITICAL: You MUST provide your response in a single, valid JSON object enclosed in a \`\`\`json markdown block.**
    The JSON object must follow this exact schema:
    \`\`\`json
    ${jsonSchema}
    \`\`\`
    Analyze the site now.`;
};

const analyzeUrl = async (url: string, industry: string | undefined, apiKey: string) => {
    console.log(`Analyzing URL: ${url}`);
    let content = '';
    try {
        const response = await fetch(url, { headers: { 'User-Agent': 'SEOGENIX Analysis Bot 1.0' } });
        if (!response.ok) throw new Error(`Fetch failed with status ${response.status}`);
        content = await response.text();
    } catch (fetchError) {
        console.error(`Failed to fetch content for ${url}:`, fetchError.message);
        // Proceed with empty content, AI can still analyze the URL itself
    }

    const prompt = getAnalysisPrompt(url, content, industry);
    const analysisResult = await callGeminiWithRetry(prompt, apiKey);

    return {
        url,
        name: new URL(url).hostname,
        ...analysisResult
    };
};

// --- TOOL-SPECIFIC: Main Logic ---
const competitiveAnalysisToolLogic = async (req: Request, { user, supabaseClient, supabaseAdminClient }: { user: any, supabaseClient: SupabaseClient, supabaseAdminClient: SupabaseClient }) => {
  let runId: string | null = null;
  try {
    const { projectId, primaryUrl, competitorUrls, industry }: AnalysisRequest = await req.json();

    if (!projectId || !primaryUrl || !competitorUrls?.length) {
      throw new Error('`projectId`, `primaryUrl`, and `competitorUrls` are required.');
    }
    console.log(`Competitive analysis for project ${projectId}`);

    const { data: project, error: projectError } = await supabaseClient.from('projects').select('id').eq('id', projectId).single();
    if (projectError || !project) throw new Error(`Access denied or project not found for id: ${projectId}`);

    runId = await logToolRun(supabaseAdminClient, projectId, 'competitive-analysis', { primaryUrl, competitorUrls, industry });
    console.log(`Tool run logged with ID: ${runId}`);

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) throw new Error('Gemini API key not configured');

    const allUrls = [primaryUrl, ...competitorUrls];
    const analysisPromises = allUrls.map(url => analyzeUrl(url, industry, geminiApiKey));

    // Using Promise.allSettled to handle individual fetch/analysis failures gracefully
    const results = await Promise.allSettled(analysisPromises);

    const successfulAnalyses = results
        .filter(r => r.status === 'fulfilled')
        .map(r => (r as PromiseFulfilledResult<any>).value);

    if (successfulAnalyses.length === 0) {
        throw new Error('All URL analyses failed. Please check the URLs and try again.');
    }

    const primarySiteAnalysis = successfulAnalyses.find(a => a.url === primaryUrl);
    const competitorAnalyses = successfulAnalyses.filter(a => a.url !== primaryUrl);

    const avgCompetitorScore = competitorAnalyses.length > 0
        ? Math.round(competitorAnalyses.reduce((sum, c) => sum + c.overallScore, 0) / competitorAnalyses.length)
        : 0;

    const summary = {
        primarySiteScore: primarySiteAnalysis?.overallScore || 0,
        averageCompetitorScore: avgCompetitorScore,
        totalSitesAnalyzed: successfulAnalyses.length,
        failedSites: allUrls.length - successfulAnalyses.length,
    };

    const output = { primarySiteAnalysis, competitorAnalyses, summary };

    await updateToolRun(supabaseAdminClient, runId, 'completed', output, null);
    console.log('Competitive analysis complete.');
    return createSuccessResponse({ runId, ...output });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
    console.error('Competitive analysis error:', err);
    if (runId) {
      await updateToolRun(supabaseAdminClient, runId, 'error', null, errorMessage);
    }
    return createErrorResponse(errorMessage, 500, err instanceof Error ? err.stack : undefined);
  }
};

// --- Server ---
Deno.serve((req) => serviceHandler(req, competitiveAnalysisToolLogic));
