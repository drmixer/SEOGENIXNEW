import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.200.0/crypto/mod.ts";

async function verifySignature(req: Request, body: string): Promise<boolean> {
    const signature = req.headers.get('x-signature');
    if (!signature) return false;

    const webhookSecret = Deno.env.get('LEMONSQUEEZY_WEBHOOK_SECRET');
    if (!webhookSecret) {
        console.error('LEMONSQUEEZY_WEBHOOK_SECRET not configured');
        return false;
    }

    const hmac = createHmac("sha256", webhookSecret);
    hmac.update(body);
    const calculatedSignature = hmac.toString();

    return calculatedSignature === signature;
}


export async function lemonsqueezyWebhookHandler(
  supabase: SupabaseClient,
  req: Request
) {
    const body = await req.text();
    if (!await verifySignature(req, body)) {
        throw new Error("Invalid webhook signature");
    }

    const payload = JSON.parse(body);
    const eventName = payload.meta?.event_name;
    const eventData = payload.data;

    if (!eventName || !eventData) {
        throw new Error("Invalid webhook payload");
    }

    switch(eventName) {
        case 'subscription_created':
        case 'subscription_updated': {
            const customerId = eventData.attributes?.customer_id;
            const subscriptionId = eventData.id;
            const status = eventData.attributes?.status;
            const planId = eventData.attributes?.custom_data?.plan || 'free';
            if (!customerId || !subscriptionId) throw new Error('Missing customer or subscription ID');

            const { data: profile } = await supabase.from('user_profiles').select('user_id').eq('lemonsqueezy_customer_id', customerId).single();
            if (profile) {
                await supabase.from('user_profiles').update({
                    plan: planId,
                    lemonsqueezy_subscription_id: subscriptionId,
                    subscription_status: status,
                }).eq('user_id', profile.user_id);
                await supabase.auth.admin.updateUserById(profile.user_id, { user_metadata: { plan: planId } });
            }
            break;
        }
        case 'subscription_cancelled':
        case 'subscription_expired': {
            const subId = eventData.id;
            if (!subId) break;
            const newStatus = eventName === 'subscription_cancelled' ? 'cancelled' : 'expired';
            const newPlan = newStatus === 'expired' ? 'free' : undefined;

            const { data: profile } = await supabase.from('user_profiles').select('user_id').eq('lemonsqueezy_subscription_id', subId).single();
            if (profile) {
                await supabase.from('user_profiles').update({ subscription_status: newStatus, plan: newPlan }).eq('user_id', profile.user_id);
                if (newPlan) {
                    await supabase.auth.admin.updateUserById(profile.user_id, { user_metadata: { plan: newPlan } });
                }
            }
            break;
        }
    }

    return { success: true, message: `Processed ${eventName}` };
}
