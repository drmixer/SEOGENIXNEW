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
      // Using Pro model for higher quality optimization
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.5, maxOutputTokens: 4096 },
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
interface OptimizerRequest {
    projectId: string;
    content: string;
    targetKeywords: string[];
    contentType: 'blog post' | 'landing page' | 'product description';
}

// --- TOOL-SPECIFIC: AI Prompt ---
const getOptimizerPrompt = (request: OptimizerRequest): string => {
    const { content, targetKeywords, contentType } = request;
    const jsonSchema = `{
        "optimizedContent": "string (The fully rewritten, optimized content)",
        "analysis": {
            "originalScore": "number (0-100, your estimated SEO score of the original text)",
            "optimizedScore": "number (0-100, your estimated SEO score of the new text)",
            "improvements": ["string (A list of the key improvements you made)"]
        }
    }`;

    return `You are an expert SEO Content Editor. Your task is to analyze and rewrite a piece of content to improve its SEO performance and AI visibility.

    **Context:**
    - **Content Type:** ${contentType}
    - **Target Keywords:** ${targetKeywords.join(', ')}
    - **Original Content:**
      ---
      ${content.substring(0, 12000)}
      ---

    **Instructions:**
    1.  Thoroughly analyze the original content.
    2.  Rewrite the content to be more engaging, clear, and optimized for the target keywords.
    3.  Naturally integrate the keywords. Do not "stuff" them.
    4.  Improve the structure, headings, and overall flow.
    5.  Provide an analysis comparing the original to the optimized version.

    **CRITICAL: You MUST provide your response in a single, valid JSON object enclosed in a \`\`\`json markdown block.**
    The JSON object must follow this exact schema:
    \`\`\`json
    ${jsonSchema}
    \`\`\`

    Rewrite and analyze the content now.`;
};


// --- TOOL-SPECIFIC: Main Logic ---
const contentOptimizerToolLogic = async (req: Request, { user, supabaseClient, supabaseAdminClient }: { user: any, supabaseClient: SupabaseClient, supabaseAdminClient: SupabaseClient }) => {
  let runId: string | null = null;
  try {
    const requestBody: OptimizerRequest = await req.json();
    const { projectId, content, targetKeywords, contentType } = requestBody;

    if (!projectId || !content || !targetKeywords?.length || !contentType) {
      throw new Error('`projectId`, `content`, `targetKeywords`, and `contentType` are required.');
    }
    console.log(`Content optimizer request for project ${projectId}`);

    const { data: project, error: projectError } = await supabaseClient.from('projects').select('id').eq('id', projectId).single();
    if (projectError || !project) throw new Error(`Access denied or project not found for id: ${projectId}`);

    runId = await logToolRun(supabaseAdminClient, projectId, 'content-optimizer', { contentType, targetKeywords, contentLength: content.length });
    console.log(`Tool run logged with ID: ${runId}`);

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) throw new Error('Gemini API key not configured');

    const prompt = getOptimizerPrompt(requestBody);
    const analysisJson = await callGeminiWithRetry(prompt, geminiApiKey);

    if (!analysisJson.optimizedContent || !analysisJson.analysis?.optimizedScore) {
        throw new Error('Generated content from AI is missing required fields.');
    }

    const output = {
        ...analysisJson,
        originalContent: content, // Include original for comparison in the UI
        targetKeywords
    };

    await updateToolRun(supabaseAdminClient, runId, 'completed', output, null);
    console.log('Content optimization complete.');
    return createSuccessResponse({ runId, ...output });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
    console.error('Content optimizer error:', err);
    if (runId) {
      await updateToolRun(supabaseAdminClient, runId, 'error', null, errorMessage);
    }
    return createErrorResponse(errorMessage, 500, err instanceof Error ? err.stack : undefined);
  }
};

// --- Server ---
Deno.serve((req) => serviceHandler(req, contentOptimizerToolLogic));
