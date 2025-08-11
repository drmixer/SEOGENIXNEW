import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- CORS Headers ---
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- Type Definitions ---
interface SuggestionRequest {
    topic: string;
    industry?: string;
    targetAudience?: string;
    contentType?: string;
    userIntent?: 'informational' | 'commercial' | 'transactional' | 'navigational';
    projectId: string; // Required for logging
}

interface PromptSuggestion {
    prompt: string;
    category: string;
    intent: string;
}

// --- Database Logging Helpers ---
async function logToolRun(supabase: SupabaseClient, projectId: string, toolName: string, inputPayload: object) {
  if (!projectId) {
    throw new Error("logToolRun error: projectId is required.");
  }
  const { data, error } = await supabase
    .from("tool_runs")
    .insert({
      project_id: projectId,
      tool_name: toolName,
      input_payload: inputPayload,
      status: "running",
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error logging tool run:", error);
    throw new Error(`Failed to log tool run. Supabase error: ${error.message}`);
  }
  if (!data || !data.id) {
    console.error("No data or data.id returned from tool_runs insert.");
    throw new Error("Failed to log tool run: No data returned after insert.");
  }
  return data.id;
}

async function updateToolRun(supabase: SupabaseClient, runId: string, status: string, outputPayload: object | null, errorMessage: string | null) {
  if (!runId) {
    console.error("updateToolRun error: runId is required.");
    return;
  }
  const update = {
    status,
    completed_at: new Date().toISOString(),
    output_payload: errorMessage ? { error: errorMessage } : outputPayload || null,
    error_message: errorMessage || null,
  };
  const { error } = await supabase.from("tool_runs").update(update).eq("id", runId);
  if (error) {
    console.error(`Error updating tool run ID ${runId}:`, error);
  }
}

// --- AI Prompt Engineering ---
const getSuggestionPrompt = (request: SuggestionRequest): string => {
    const { topic, industry, targetAudience, contentType, userIntent } = request;
    const jsonSchema = `{ "promptSuggestions": [{ "prompt": "string", "category": "string", "intent": "string" }] }`;
    return `
    You are an Expert SEO Strategist and Content Ideator...
    - **Core Topic:** ${topic}
    - **Industry:** ${industry || 'General'}
    - **Target Audience:** ${targetAudience || 'General'}
    - **Desired Content Type:** ${contentType || 'Any'}
    - **Primary User Intent:** ${userIntent || 'Any'}
    ...
    You MUST provide a response in a single, valid JSON object...
    \`\`\`json
    ${jsonSchema}
    \`\`\`
    Now, perform your expert brainstorming.
    `;
};

// --- Main Service Handler ---
export const suggestionService = async (req: Request, supabase: SupabaseClient): Promise<Response> => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    let runId: string | null = null;
    try {
        const requestBody: SuggestionRequest = await req.json();
        const { projectId, ...inputPayload } = requestBody;

        if (!projectId) throw new Error("projectId is required for logging.");
        if (!requestBody.topic || requestBody.topic.trim().length === 0) {
            throw new Error('`topic` is a required field.');
        }

        runId = await logToolRun(supabase, projectId, 'prompt-match-suggestions', inputPayload);

        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
        if (!geminiApiKey) throw new Error('Gemini API key not configured');

        const prompt = getSuggestionPrompt(requestBody);
        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { response_mime_type: "application/json", temperature: 0.8, maxOutputTokens: 2048 }
            })
        });

        if (!geminiResponse.ok) throw new Error(`The AI model failed to process the request. Status: ${geminiResponse.status}`);

        const geminiData = await geminiResponse.json();
        const suggestionsJson = JSON.parse(geminiData.candidates[0].content.parts[0].text);

        if (runId) {
            await updateToolRun(supabase, runId, 'completed', suggestionsJson, null);
        }

        return new Response(JSON.stringify({ success: true, data: suggestionsJson }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        if (runId) {
            await updateToolRun(supabase, runId, 'error', null, errorMessage);
        }
        return new Response(JSON.stringify({ success: false, error: { message: errorMessage } }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
};

// --- Server ---
Deno.serve(async (req) => {
    const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    return await suggestionService(req, supabase);
});
