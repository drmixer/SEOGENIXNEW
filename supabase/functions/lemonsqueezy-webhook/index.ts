import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { createHmac } from 'node:crypto';

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Verify webhook signature
    const signature = req.headers.get('x-signature');
    if (!signature) {
      return new Response(
        JSON.stringify({ error: 'Missing signature header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get webhook secret from environment
    const webhookSecret = Deno.env.get('LEMONSQUEEZY_WEBHOOK_SECRET');
    if (!webhookSecret) {
      console.error('LEMONSQUEEZY_WEBHOOK_SECRET not configured');
      return new Response(
        JSON.stringify({ error: 'Webhook secret not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get request body as text for signature verification
    const body = await req.text();
    
    // Verify signature
    const hmac = createHmac('sha256', webhookSecret);
    hmac.update(body);
    const calculatedSignature = hmac.digest('hex');
    
    if (calculatedSignature !== signature) {
      console.error('Invalid webhook signature');
      return new Response(
        JSON.stringify({ error: 'Invalid webhook signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Parse the webhook payload
    const payload = JSON.parse(body);
    const eventName = payload.meta?.event_name;
    const eventData = payload.data;
    
    if (!eventName || !eventData) {
      return new Response(
        JSON.stringify({ error: 'Invalid webhook payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing LemonSqueezy webhook: ${eventName}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Process different event types
    switch (eventName) {
      case 'subscription_created':
      case 'subscription_updated':
        // Get subscription details
        const customerId = eventData.attributes?.customer_id;
        const subscriptionId = eventData.id;
        const status = eventData.attributes?.status;
        const planId = eventData.attributes?.custom_data?.plan || 'free';
        
        if (!customerId || !subscriptionId) {
          throw new Error('Missing customer or subscription ID');
        }
        
        // Find user by customer ID
        const { data: profiles, error: profileError } = await supabase
          .from('user_profiles')
          .select('user_id')
          .eq('lemonsqueezy_customer_id', customerId);
        
        if (profileError) {
          throw profileError;
        }
        
        if (profiles && profiles.length > 0) {
          // Update user profile with subscription info
          const { error: updateError } = await supabase
            .from('user_profiles')
            .update({
              plan: planId,
              lemonsqueezy_subscription_id: subscriptionId,
              subscription_status: status,
              subscription_updated_at: new Date().toISOString()
            })
            .eq('user_id', profiles[0].user_id);
          
          if (updateError) {
            throw updateError;
          }
          
          // Also update user metadata
          await supabase.auth.admin.updateUserById(profiles[0].user_id, {
            user_metadata: {
              plan: planId
            }
          });
          
          console.log(`Updated subscription for user ${profiles[0].user_id} to plan ${planId}`);
        } else {
          console.log('No user found for customer ID:', customerId);
        }
        break;
        
      case 'subscription_cancelled':
        // Update subscription status
        const cancelledSubId = eventData.id;
        if (!cancelledSubId) break;
        
        const { data: cancelledProfiles, error: cancelledError } = await supabase
          .from('user_profiles')
          .select('user_id')
          .eq('lemonsqueezy_subscription_id', cancelledSubId);
        
        if (cancelledError) {
          throw cancelledError;
        }
        
        if (cancelledProfiles && cancelledProfiles.length > 0) {
          const { error: updateError } = await supabase
            .from('user_profiles')
            .update({
              subscription_status: 'cancelled',
              subscription_updated_at: new Date().toISOString()
            })
            .eq('lemonsqueezy_subscription_id', cancelledSubId);
          
          if (updateError) {
            throw updateError;
          }
          
          console.log(`Marked subscription ${cancelledSubId} as cancelled`);
        }
        break;
        
      case 'subscription_expired':
        // Downgrade to free plan
        const expiredSubId = eventData.id;
        if (!expiredSubId) break;
        
        const { data: expiredProfiles, error: expiredError } = await supabase
          .from('user_profiles')
          .select('user_id')
          .eq('lemonsqueezy_subscription_id', expiredSubId);
        
        if (expiredError) {
          throw expiredError;
        }
        
        if (expiredProfiles && expiredProfiles.length > 0) {
          for (const profile of expiredProfiles) {
            // Update profile
            const { error: updateError } = await supabase
              .from('user_profiles')
              .update({
                plan: 'free',
                subscription_status: 'expired',
                subscription_updated_at: new Date().toISOString()
              })
              .eq('user_id', profile.user_id);
            
            if (updateError) {
              throw updateError;
            }
            
            // Update user metadata
            await supabase.auth.admin.updateUserById(profile.user_id, {
              user_metadata: {
                plan: 'free'
              }
            });
            
            console.log(`Downgraded user ${profile.user_id} to free plan due to expired subscription`);
          }
        }
        break;
        
      case 'order_created':
        // Handle new order (first-time subscription)
        const orderCustomerId = eventData.attributes?.customer_id;
        const orderUserEmail = eventData.attributes?.user_email;
        
        if (!orderCustomerId || !orderUserEmail) break;
        
        // Find user by email
        const { data: { users }, error: userError } = await supabase.auth.admin.listUsers();
        
        if (userError) {
          throw userError;
        }
        
        const matchingUser = users.find(u => u.email === orderUserEmail);
        
        if (matchingUser) {
          // Update user profile with customer ID
          const { error: updateError } = await supabase
            .from('user_profiles')
            .update({
              lemonsqueezy_customer_id: orderCustomerId
            })
            .eq('user_id', matchingUser.id);
          
          if (updateError) {
            throw updateError;
          }
          
          console.log(`Associated customer ID ${orderCustomerId} with user ${matchingUser.id}`);
        }
        break;
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Webhook processing error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process webhook', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});