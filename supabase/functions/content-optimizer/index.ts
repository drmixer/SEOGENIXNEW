import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- CORS Headers ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- Type Definitions ---
interface LogToolRunParams {
  supabase: SupabaseClient;
  projectId: string;
  toolName: string;
  inputPayload: Record<string, unknown>;
}

interface UpdateToolRunParams {
  supabase: SupabaseClient;
  runId: string;
  status: 'completed' | 'error';
  outputPayload: Record<string, unknown> | null;
  errorMessage: string | null;
}

interface OptimizerRequest {
    projectId: string;
    content: string;
    targetKeywords: string[];
    contentType: 'blog post' | 'landing page' | 'product description';
}

// --- Database Helpers ---
async function logToolRun({ supabase, projectId, toolName, inputPayload }: LogToolRunParams): Promise<string | null> {
  const { data, error } = await supabase
    .from('tool_runs')
    .insert({ project_id: projectId, tool_name: toolName, input_payload: inputPayload, status: 'running' })
    .select('id')
    .single();
  if (error) {
    console.error('Error logging tool run:', error);
    return null;
  }
  return data.id;
}

async function updateToolRun({ supabase, runId, status, outputPayload, errorMessage }: UpdateToolRunParams): Promise<void> {
  const update = {
    status,
    completed_at: new Date().toISOString(),
    output_payload: outputPayload,
    error_message: errorMessage,
  };
  const { error } = await supabase.from('tool_runs').update(update).eq('id', runId);
  if (error) {
    console.error('Error updating tool run:', error);
  }
}

// --- AI Prompt Engineering ---
const getOptimizerPrompt = (content: string, targetKeywords: string[], contentType: string): string => {
    // ... (prompt logic is correct, hiding for brevity)
    const jsonSchema = `{ "optimizedContent": "string", "optimizedScore": "number", "originalScore": "number", "improvements": ["string"] }`;
    const fewShotExample = `{ "optimizedContent": "...", "optimizedScore": 92, "originalScore": 65, "improvements": ["..."] }`;
    return `
    You are an expert SEO Content Strategist...
    ---
    ${content.substring(0, 12000)}
    ---
    ...
    \`\`\`json
    ${jsonSchema}
    \`\`\`
    ...
    \`\`\`json
    ${fewShotExample}
    \`\`\`
    ...
    `;
}

// --- Main Service Handler ---
export const optimizerService = async (req: Request, supabase: SupabaseClient): Promise<Response> => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    let runId: string | null = null;
    try {
        const { projectId, content, targetKeywords, contentType }: OptimizerRequest = await req.json();

        runId = await logToolRun({
            supabase,
            projectId,
            toolName: 'content-optimizer',
            inputPayload: { contentType, targetKeywords, contentLength: content.length }
        });

        if (!content || !targetKeywords || !contentType) {
            throw new Error('`content`, `targetKeywords`, and `contentType` are required.');
        }

        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
        if (!geminiApiKey) throw new Error('Gemini API key not configured');

        const prompt = getOptimizerPrompt(content, targetKeywords, contentType);

        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    response_mime_type: "application/json",
                    temperature: 0.5,
                    maxOutputTokens: 4096,
                }
            })
        });

        if (!geminiResponse.ok) {
            const errorBody = await geminiResponse.text();
            console.error('Gemini API error:', errorBody);
            throw new Error(`The AI model failed to process the request. Status: ${geminiResponse.status}`);
        }

        const geminiData = await geminiResponse.json();
        const analysisJson = JSON.parse(geminiData.candidates[0].content.parts[0].text);

        const output = { ...analysisJson, originalContent: content, targetKeywords };

        if (runId) {
            await updateToolRun({
                supabase,
                runId,
                status: 'completed',
                outputPayload: output,
                errorMessage: null,
            });
        }

        return new Response(JSON.stringify({ success: true, data: { runId, ...output } }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        if (runId) {
            await updateToolRun({
                supabase,
                runId,
                status: 'error',
                outputPayload: null,
                errorMessage: errorMessage,
            });
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
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    return await optimizerService(req, supabase);
});
