import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

// --- Database Logging Helpers ---
async function logToolRun({ supabase, projectId, toolName, inputPayload }) {
  const { data, error } = await supabase.from('tool_runs').insert({ project_id: projectId, tool_name: toolName, input_payload: inputPayload, status: 'running' }).select('id').single();
  if (error) { console.error('Error logging tool run:', error); return null; }
  return data.id;
}

async function updateToolRun({ supabase, runId, status, outputPayload, errorMessage }) {
  const update = { status, completed_at: new Date().toISOString(), output_payload: outputPayload || null, error_message: errorMessage || null };
  const { error } = await supabase.from('tool_runs').update(update).eq('id', runId);
  if (error) { console.error('Error updating tool run:', error); }
}

const generatePortalUrlService = async (req: Request, supabase: SupabaseClient): Promise<Response> => {
    let runId;
    try {
        const url = new URL(req.url);
        const userId = url.searchParams.get('userId');
        const projectId = url.searchParams.get('projectId'); // For logging

        if (!userId) {
            return new Response(JSON.stringify({ error: 'Missing userId parameter' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
        if (!projectId) {
            return new Response(JSON.stringify({ error: 'Missing projectId parameter' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        runId = await logToolRun({ supabase, projectId, toolName: 'generate-portal-url', inputPayload: { userId } });

        const { data: profile, error: profileError } = await supabase.from('user_profiles').select('lemonsqueezy_customer_id').eq('user_id', userId).single();

        if (profileError || !profile || !profile.lemonsqueezy_customer_id) {
            throw new Error('Lemon Squeezy customer ID not found for this user.');
        }

        const customerId = profile.lemonsqueezy_customer_id;
        const apiKey = Deno.env.get('LEMONSQUEEZY_API_KEY');
        if (!apiKey) throw new Error('Lemon Squeezy API key not configured');

        const lsResponse = await fetch(`https://api.lemonsqueezy.com/v1/customers/${customerId}/portal`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            }
        });

        if (!lsResponse.ok) {
            const errorText = await lsResponse.text();
            throw new Error(`Lemon Squeezy API error: ${errorText}`);
        }

        const lsData = await lsResponse.json();
        const portalUrl = lsData.data.attributes.url;

        await updateToolRun({ supabase, runId, status: 'completed', outputPayload: { portalUrl }, errorMessage: null });

        return new Response(JSON.stringify({ portalUrl }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        if (runId) {
            await updateToolRun({ supabase, runId, status: 'error', outputPayload: null, errorMessage });
        }
        return new Response(JSON.stringify({ error: errorMessage }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    return await generatePortalUrlService(req, supabase);
});
