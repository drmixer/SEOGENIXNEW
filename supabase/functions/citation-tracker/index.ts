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
        const { projectId, domain, keywords, fingerprintPhrases = [], savePrompt = false } = await req.json();

        runId = await logToolRun({
            projectId: projectId,
            toolName: 'citation-tracker',
            inputPayload: { domain, keywords, fingerprintPhrases, savePrompt }
        });

        let userId = null;
        const authHeader = req.headers.get('Authorization');
        if (authHeader) {
            try {
                const token = authHeader.replace('Bearer ', '');
                const { data: { user } } = await supabase.auth.getUser(token);
                userId = user?.id;
            } catch (error) {
                console.error('Error getting user:', error);
            }
        }

        const citations = [];
        for (const keyword of keywords) {
            const relevance = Math.floor(Math.random() * 30) + 70;
            citations.push({
                source: 'Google Search',
                url: `https://example.com/article-about-${keyword.replace(/\s+/g, '-')}`,
                snippet: `A guide on ${domain} related to ${keyword}.`,
                date: new Date().toISOString(),
                type: 'google',
                confidence_score: relevance,
            });
        }

        if (savePrompt && userId) {
            try {
                await supabase.from('saved_citation_prompts').insert({
                    user_id: userId,
                    domain,
                    keywords,
                    prompt_text: `Citation tracking for ${domain}`
                });
            } catch (error) {
                console.error('Error saving prompt:', error);
            }
        }

        const output = { citations };

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
