import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// Self-contained CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// Helper functions for logging
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

const createCheckoutService = async (req: Request, supabase: SupabaseClient): Promise<Response> => {
    let runId;
    try {
        const { projectId, plan, userId, billingCycle = 'monthly', name, email, successUrl, cancelUrl } = await req.json();

        runId = await logToolRun({
            supabase,
            projectId: projectId,
            toolName: 'create-checkout',
            inputPayload: { plan, userId, billingCycle }
        });

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('Authorization header required');
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabase.auth.getUser(token);
        if (!user) throw new Error('Invalid authentication');

        const apiKey = Deno.env.get('LEMONSQUEEZY_API_KEY');
        if (!apiKey) throw new Error('LemonSqueezy API key not configured');
        const storeId = Deno.env.get('LEMONSQUEEZY_STORE_ID');
        if (!storeId) throw new Error('LemonSqueezy store ID not configured');

        const variantMap = {
            monthly: {
                core: Deno.env.get('LEMONSQUEEZY_CORE_MONTHLY_VARIANT_ID') || '',
                pro: Deno.env.get('LEMONSQUEEZY_PRO_MONTHLY_VARIANT_ID') || '',
                agency: Deno.env.get('LEMONSQUEEZY_AGENCY_MONTHLY_VARIANT_ID') || ''
            },
            annual: {
                core: Deno.env.get('LEMONSQUEEZY_CORE_ANNUAL_VARIANT_ID') || '',
                pro: Deno.env.get('LEMONSQUEEZY_PRO_ANNUAL_VARIANT_ID') || '',
                agency: Deno.env.get('LEMONSQUEEZY_AGENCY_ANNUAL_VARIANT_ID') || ''
            }
        };
        const variantId = variantMap[billingCycle][plan];
        if (!variantId) throw new Error(`No variant ID found for plan: ${plan} (${billingCycle})`);

        const payload = {
            data: {
                type: 'checkouts',
                attributes: {
                    checkout_data: {
                        name: name || user.user_metadata?.full_name,
                        email: email || user.email,
                        custom: { plan, user_id: userId }
                    }
                },
                relationships: {
                    store: { data: { type: 'stores', id: storeId } },
                    variant: { data: { type: 'variants', id: variantId } }
                }
            }
        };

        const response = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
            method: 'POST',
            headers: { 'Accept': 'application/vnd.api+json', 'Content-Type': 'application/vnd.api+json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify(payload)
        });

        const responseText = await response.text();
        if (!response.ok) throw new Error(`LemonSqueezy API error: ${responseText}`);

        const checkout = JSON.parse(responseText);
        let checkoutUrl = checkout.data.attributes.url;
        if (cancelUrl) checkoutUrl += `${checkoutUrl.includes('?') ? '&' : '?'}cancel_url=${encodeURIComponent(cancelUrl)}`;

        const output = { success: true, checkoutUrl, checkoutId: checkout.data.id };

        await updateToolRun({
            supabase,
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
            await updateToolRun({ supabase, runId, status: 'error', errorMessage: errorMessage });
        }
        return new Response(JSON.stringify({ error: errorMessage }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    return await createCheckoutService(req, supabase);
});
