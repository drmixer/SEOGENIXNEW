import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "node:crypto";
// Self-contained CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE'
};
// --- Database Logging Helpers ---
async function logToolRun(supabase, projectId, toolName, inputPayload) {
  // For webhooks, projectId might not always be available, so make it optional
  console.log(`Logging tool run: ${toolName}${projectId ? ` for project: ${projectId}` : ''}`);
  const insertData = {
    tool_name: toolName,
    input_payload: inputPayload,
    status: "running",
    created_at: new Date().toISOString()
  };
  // Only add project_id if it exists
  if (projectId) {
    insertData.project_id = projectId;
  }
  const { data, error } = await supabase.from("tool_runs").insert(insertData).select("id").single();
  if (error) {
    console.error("Error logging tool run:", error);
    // Don't throw for webhooks, just return null
    return null;
  }
  if (!data || !data.id) {
    console.error("No data or data.id returned from tool_runs insert.");
    return null;
  }
  console.log(`Tool run logged with ID: ${data.id}`);
  return data.id;
}
async function updateToolRun(supabase, runId, status, outputPayload, errorMessage) {
  if (!runId) {
    console.error("updateToolRun error: runId is required.");
    return;
  }
  console.log(`Updating tool run ${runId} with status: ${status}`);
  // CRITICAL FIX: Use the correct field name 'output_payload' not 'output'
  const update = {
    status,
    completed_at: new Date().toISOString(),
    output_payload: errorMessage ? {
      error: errorMessage
    } : outputPayload || null,
    error_message: errorMessage || null
  };
  const { error } = await supabase.from("tool_runs").update(update).eq("id", runId);
  if (error) {
    console.error(`Error updating tool run ID ${runId}:`, error);
  } else {
    console.log(`Tool run ${runId} updated successfully`);
  }
}
const lemonsqueezyWebhookService = async (req, supabase)=>{
  let runId = null;
  try {
    const signature = req.headers.get('x-signature');
    if (!signature) throw new Error('Missing signature header');
    const webhookSecret = Deno.env.get('LEMONSQUEEZY_WEBHOOK_SECRET');
    if (!webhookSecret) throw new Error('Webhook secret not configured');
    const body = await req.text();
    // Log webhook processing (no projectId for webhooks)
    runId = await logToolRun(supabase, null, 'lemonsqueezy-webhook', {
      hasSignature: !!signature,
      bodyLength: body.length
    });
    console.log('Verifying webhook signature...');
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
    console.log(`Processing webhook event: ${eventName}`);
    let processedData = {
      eventName,
      processed: false
    };
    switch(eventName){
      case 'subscription_created':
      case 'subscription_updated':
        {
          const customerId = eventData.attributes?.customer_id;
          const subscriptionId = eventData.id;
          const status = eventData.attributes?.status;
          const planId = eventData.attributes?.custom_data?.plan || 'free';
          if (!customerId || !subscriptionId) {
            throw new Error('Missing customer or subscription ID');
          }
          console.log(`Processing subscription ${eventName} for customer: ${customerId}`);
          const { data: profiles } = await supabase.from('user_profiles').select('user_id').eq('lemonsqueezy_customer_id', customerId);
          if (profiles && profiles.length > 0) {
            await supabase.from('user_profiles').update({
              plan: planId,
              lemonsqueezy_subscription_id: subscriptionId,
              subscription_status: status
            }).eq('user_id', profiles[0].user_id);
            await supabase.auth.admin.updateUserById(profiles[0].user_id, {
              user_metadata: {
                plan: planId
              }
            });
            processedData = {
              eventName,
              processed: true,
              userId: profiles[0].user_id,
              customerId,
              subscriptionId,
              plan: planId,
              status
            };
            console.log(`Updated subscription for user: ${profiles[0].user_id}`);
          } else {
            console.warn(`No user profile found for customer: ${customerId}`);
            processedData = {
              eventName,
              processed: false,
              reason: 'No matching user profile'
            };
          }
          break;
        }
      case 'subscription_cancelled':
        {
          const cancelledSubId = eventData.id;
          if (cancelledSubId) {
            console.log(`Processing subscription cancellation: ${cancelledSubId}`);
            const { data: updated } = await supabase.from('user_profiles').update({
              subscription_status: 'cancelled'
            }).eq('lemonsqueezy_subscription_id', cancelledSubId).select('user_id');
            processedData = {
              eventName,
              processed: true,
              subscriptionId: cancelledSubId,
              affectedUsers: updated?.length || 0
            };
            console.log(`Cancelled subscription for ${updated?.length || 0} users`);
          }
          break;
        }
      case 'subscription_expired':
        {
          const expiredSubId = eventData.id;
          if (expiredSubId) {
            console.log(`Processing subscription expiration: ${expiredSubId}`);
            const { data: profiles } = await supabase.from('user_profiles').select('user_id').eq('lemonsqueezy_subscription_id', expiredSubId);
            if (profiles) {
              for (const profile of profiles){
                await supabase.from('user_profiles').update({
                  plan: 'free',
                  subscription_status: 'expired'
                }).eq('user_id', profile.user_id);
                await supabase.auth.admin.updateUserById(profile.user_id, {
                  user_metadata: {
                    plan: 'free'
                  }
                });
              }
              processedData = {
                eventName,
                processed: true,
                subscriptionId: expiredSubId,
                affectedUsers: profiles.length
              };
              console.log(`Expired subscription for ${profiles.length} users`);
            }
          }
          break;
        }
      case 'order_created':
        {
          const orderCustomerId = eventData.attributes?.customer_id;
          const orderUserEmail = eventData.attributes?.user_email;
          if (orderCustomerId && orderUserEmail) {
            console.log(`Processing order creation for customer: ${orderCustomerId}`);
            const { data: { users } } = await supabase.auth.admin.listUsers();
            const matchingUser = users.find((u)=>u.email === orderUserEmail);
            if (matchingUser) {
              await supabase.from('user_profiles').update({
                lemonsqueezy_customer_id: orderCustomerId
              }).eq('user_id', matchingUser.id);
              processedData = {
                eventName,
                processed: true,
                userId: matchingUser.id,
                customerId: orderCustomerId,
                email: orderUserEmail
              };
              console.log(`Linked customer ID to user: ${matchingUser.id}`);
            } else {
              console.warn(`No user found with email: ${orderUserEmail}`);
              processedData = {
                eventName,
                processed: false,
                reason: 'No matching user email'
              };
            }
          }
          break;
        }
      default:
        console.log(`Unhandled webhook event: ${eventName}`);
        processedData = {
          eventName,
          processed: false,
          reason: 'Unhandled event type'
        };
    }
    const output = {
      success: true,
      webhook: processedData
    };
    if (runId) {
      await updateToolRun(supabase, runId, 'completed', output, null);
    }
    console.log('Webhook processing completed successfully');
    return new Response(JSON.stringify({
      success: true,
      data: output,
      runId
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
    console.error('Webhook error:', errorMessage);
    if (runId) {
      await updateToolRun(supabase, runId, 'error', null, errorMessage);
    }
    return new Response(JSON.stringify({
      success: false,
      error: {
        message: errorMessage
      },
      runId
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
};
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  return await lemonsqueezyWebhookService(req, supabase);
});
