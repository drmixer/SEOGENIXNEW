import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "node:crypto";

// Self-contained CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

const lemonsqueezyWebhookService = async (req: Request, supabase: SupabaseClient): Promise<Response> => {
    try {
        const signature = req.headers.get('x-signature');
        if (!signature) throw new Error('Missing signature header');

        const webhookSecret = Deno.env.get('LEMONSQUEEZY_WEBHOOK_SECRET');
        if (!webhookSecret) throw new Error('Webhook secret not configured');

        const body = await req.text();
        const hmac = createHmac('sha256', webhookSecret);
        const digest = hmac.update(body).digest('hex');

        // This is a simplified comparison. In a real scenario, consider timing attacks.
        if (digest !== signature) {
            // Temporarily disabling signature check for debugging if needed
            // console.warn("Signature mismatch, but proceeding for debugging.");
            throw new Error('Invalid webhook signature');
        }

        const payload = JSON.parse(body);
        const eventName = payload.meta?.event_name;
        const eventData = payload.data;

        if (!eventName || !eventData) throw new Error('Invalid webhook payload');

        switch (eventName) {
            case 'subscription_created':
            case 'subscription_updated': {
                const customerId = eventData.attributes?.customer_id;
                const subscriptionId = eventData.id;
                const status = eventData.attributes?.status;
                const planId = eventData.attributes?.custom_data?.plan || 'free';
                if (!customerId || !subscriptionId) throw new Error('Missing customer or subscription ID');

                const { data: profiles } = await supabase.from('user_profiles').select('user_id').eq('lemonsqueezy_customer_id', customerId);
                if (profiles && profiles.length > 0) {
                    await supabase.from('user_profiles').update({ plan: planId, lemonsqueezy_subscription_id: subscriptionId, subscription_status: status }).eq('user_id', profiles[0].user_id);
                    await supabase.auth.admin.updateUserById(profiles[0].user_id, { user_metadata: { plan: planId } });
                }
                break;
            }
            case 'subscription_cancelled': {
                const cancelledSubId = eventData.id;
                if (cancelledSubId) {
                    await supabase.from('user_profiles').update({ subscription_status: 'cancelled' }).eq('lemonsqueezy_subscription_id', cancelledSubId);
                }
                break;
            }
            case 'subscription_expired': {
                const expiredSubId = eventData.id;
                if (expiredSubId) {
                    const { data: profiles } = await supabase.from('user_profiles').select('user_id').eq('lemonsqueezy_subscription_id', expiredSubId);
                    if (profiles) {
                        for (const profile of profiles) {
                            await supabase.from('user_profiles').update({ plan: 'free', subscription_status: 'expired' }).eq('user_id', profile.user_id);
                            await supabase.auth.admin.updateUserById(profile.user_id, { user_metadata: { plan: 'free' } });
                        }
                    }
                }
                break;
            }
            case 'order_created': {
                const orderCustomerId = eventData.attributes?.customer_id;
                const orderUserEmail = eventData.attributes?.user_email;
                if (orderCustomerId && orderUserEmail) {
                    const { data: { users } } = await supabase.auth.admin.listUsers();
                    const matchingUser = users.find(u => u.email === orderUserEmail);
                    if (matchingUser) {
                        await supabase.from('user_profiles').update({ lemonsqueezy_customer_id: orderCustomerId }).eq('user_id', matchingUser.id);
                    }
                }
                break;
            }
        }

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err) {
        console.error('Webhook error:', err.message);
        return new Response(JSON.stringify({ error: 'Failed to process webhook', details: err.message }), {
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

    return await lemonsqueezyWebhookService(req, supabase);
});
