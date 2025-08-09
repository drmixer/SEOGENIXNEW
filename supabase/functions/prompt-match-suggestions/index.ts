import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Self-contained CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Helper functions for logging
async function logToolRun({ projectId, toolName, inputPayload }) {
  const { data, error } = await supabase.from('tool_runs').insert({ project_id: projectId, tool_name: toolName, input_payload: inputPayload, status: 'running' }).select('id').single();
  if (error) { console.error('Error logging tool run:', error); return null; }
  return data.id;
}

async function updateToolRun({ runId, status, outputPayload, errorMessage }) {
  const update = { status, completed_at: new Date().toISOString(), output_payload: outputPayload || null, error_message: errorMessage || null };
  const { error } = await supabase.from('tool_runs').update(update).eq('id', runId);
  if (error) { console.error('Error updating tool run:', error); }
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    let runId;
    try {
        const { projectId, topic, industry, targetAudience, contentType = 'article', userIntent = 'informational', websiteUrl } = await req.json();

        runId = await logToolRun({
            projectId: projectId,
            toolName: 'prompt-match-suggestions',
            inputPayload: { topic, industry, contentType, userIntent }
        });

        if (!topic || topic.trim().length === 0) throw new Error('Topic is required');

        const promptSuggestions = [
            { prompt: `What is ${topic}?`, category: 'DIRECT QUESTIONS', intent: 'informational', likelihood: 95 },
            { prompt: `How does ${topic} work?`, category: 'DIRECT QUESTIONS', intent: 'informational', likelihood: 90 },
            { prompt: `${topic} vs traditional approaches`, category: 'COMPARISON QUERIES', intent: 'informational', likelihood: 85 },
            { prompt: `How to implement ${topic}`, category: 'HOW-TO REQUESTS', intent: 'informational', likelihood: 87 },
        ];

        if (industry) {
            promptSuggestions.push({ prompt: `How does ${topic} apply to the ${industry} industry?`, category: 'INDUSTRY-SPECIFIC', intent: 'informational', likelihood: 82 });
        }

        if (websiteUrl) {
            try {
                const domain = new URL(websiteUrl).hostname.replace('www.', '');
                promptSuggestions.push({ prompt: `How does ${domain} use ${topic}?`, category: 'BRAND-SPECIFIC', intent: 'commercial', likelihood: 92 });
            } catch(e) { console.error("Invalid URL for brand-specific prompt"); }
        }

        const output = { promptSuggestions };

        await updateToolRun({
            runId,
            status: 'completed',
            outputPayload: output
        });

        return new Response(JSON.stringify({ runId, output }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err) {
        console.error(err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        if (runId) {
            await updateToolRun({ runId, status: 'error', errorMessage: errorMessage });
        }
        return new Response(JSON.stringify({ error: errorMessage }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
