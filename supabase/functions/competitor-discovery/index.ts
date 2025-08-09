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
        const { projectId, url, industry, businessDescription, existingCompetitors = [], analysisDepth = 'basic' } = await req.json();

        runId = await logToolRun({
            projectId: projectId,
            toolName: 'competitor-discovery',
            inputPayload: { url, industry, businessDescription, existingCompetitors, analysisDepth }
        });

        let competitorSuggestions = [];
        if (industry?.includes('Technology')) {
            competitorSuggestions = [
                { name: 'Salesforce', url: 'https://salesforce.com', type: 'industry_leader', relevanceScore: 88 },
                { name: 'HubSpot', url: 'https://hubspot.com', type: 'direct', relevanceScore: 92 },
            ];
        } else if (industry?.includes('E-commerce')) {
            competitorSuggestions = [
                { name: 'Shopify', url: 'https://shopify.com', type: 'industry_leader', relevanceScore: 94 },
                { name: 'BigCommerce', url: 'https://bigcommerce.com', type: 'direct', relevanceScore: 88 },
            ];
        } else {
            competitorSuggestions = [
                { name: 'Moz', url: 'https://moz.com', type: 'industry_leader', relevanceScore: 88 },
                { name: 'Ahrefs', url: 'https://ahrefs.com', type: 'direct', relevanceScore: 91 },
            ];
        }

        competitorSuggestions = competitorSuggestions.filter(comp => !existingCompetitors.some(existing => existing.toLowerCase().includes(comp.name.toLowerCase())));
        const limit = analysisDepth === 'comprehensive' ? 10 : 6;
        competitorSuggestions = competitorSuggestions.slice(0, limit);

        const output = { competitorSuggestions };

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
