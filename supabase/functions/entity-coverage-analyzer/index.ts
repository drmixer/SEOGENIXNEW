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
  let attempts = 0;
  const maxAttempts = 4;
  let delay = 1000;
  while (attempts < maxAttempts) {
    try {
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.4, maxOutputTokens: 4096 },
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
interface EntityRequest {
    projectId: string;
    url?: string;
    content?: string;
    industry?: string;
}

// --- TOOL-SPECIFIC: AI Prompt ---
const getEntityAnalysisPrompt = (content: string, industry?: string): string => {
    const jsonSchema = `{
      "coverageScore": "number (0-100)",
      "mentionedEntities": [{ "name": "string", "type": "string", "relevance": "number", "importance": "string ('high', 'medium', 'low')", "description": "string" }],
      "missingEntities": [{ "name": "string", "type": "string", "relevance": "number", "importance": "string ('high', 'medium', 'low')", "description": "string" }]
    }`;

    return `You are an Expert SEO and Topical Authority Analyst. Analyze the content to identify key entities it mentions and crucial entities that are missing.
    - **Content to Analyze:** ${content.substring(0, 15000)}
    - **Industry Context:** ${industry || 'General'}

    **Instructions:**
    1. Identify all key entities (people, organizations, products, concepts) mentioned in the content.
    2. Identify important, relevant entities that are MISSING from the content but should be included.
    3. Estimate an overall "Entity Coverage Score" from 0-100.
    4. Provide a structured list of both mentioned and missing entities.

    **CRITICAL: You MUST provide your response in a single, valid JSON object enclosed in a \`\`\`json markdown block.**
    The JSON object must follow this exact schema:
    \`\`\`json
    ${jsonSchema}
    \`\`\`
    Perform your expert entity analysis now.`;
};

// --- TOOL-SPECIFIC: Main Logic ---
const entityAnalyzerToolLogic = async (req: Request, { user, supabaseClient, supabaseAdminClient }: { user: any, supabaseClient: SupabaseClient, supabaseAdminClient: SupabaseClient }) => {
  let runId: string | null = null;
  try {
    const { projectId, url, content, industry }: EntityRequest = await req.json();

    if (!projectId || (!url && !content)) {
      throw new Error('`projectId` and either `url` or `content` are required.');
    }
    console.log(`Entity analysis for project ${projectId}`);

    const { data: project, error: projectError } = await supabaseClient.from('projects').select('id').eq('id', projectId).single();
    if (projectError || !project) throw new Error(`Access denied or project not found for id: ${projectId}`);

    runId = await logToolRun(supabaseAdminClient, projectId, 'entity-coverage-analyzer', { url, industry, hasContent: !!content });
    console.log(`Tool run logged with ID: ${runId}`);

    let pageContent = content;
    if (url && !pageContent) {
        console.log(`Fetching content from URL: ${url}`);
        const response = await fetch(url, { headers: { 'User-Agent': 'SEOGENIX Entity Bot 1.0' } });
        if (!response.ok) throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
        pageContent = await response.text();
    }
    if (!pageContent) throw new Error("Content is empty and could not be fetched.");

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) throw new Error('Gemini API key not configured');

    const prompt = getEntityAnalysisPrompt(pageContent, industry);
    const analysisJson = await callGeminiWithRetry(prompt, geminiApiKey);

    if (!analysisJson.coverageScore || !analysisJson.mentionedEntities || !analysisJson.missingEntities) {
        throw new Error('Generated entity analysis is missing required fields.');
    }

    await updateToolRun(supabaseAdminClient, runId, 'completed', analysisJson, null);
    console.log('Entity analysis complete.');
    return createSuccessResponse({ runId, ...analysisJson });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
    console.error('Entity analyzer error:', err);
    if (runId) {
      await updateToolRun(supabaseAdminClient, runId, 'error', null, errorMessage);
    }
    return createErrorResponse(errorMessage, 500, err instanceof Error ? err.stack : undefined);
  }
};

// --- Server ---
Deno.serve((req) => serviceHandler(req, entityAnalyzerToolLogic));
