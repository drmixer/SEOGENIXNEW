import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

interface CheckoutRequest {
  plan: 'core' | 'pro' | 'agency';
  userId: string;
  billingCycle?: 'monthly' | 'annual';
  name?: string;
  email?: string;
  successUrl?: string;
  cancelUrl?: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { 
      plan, 
      userId, 
      billingCycle = 'monthly', 
      name, 
      email,
      successUrl,
      cancelUrl
    }: CheckoutRequest = await req.json();

    // Validate auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    
    if (!user) {
      throw new Error('Invalid authentication');
    }

    // Get LemonSqueezy API key
    const apiKey = Deno.env.get('LEMONSQUEEZY_API_KEY');
    if (!apiKey) {
      throw new Error('LemonSqueezy API key not configured');
    }

    // Get store ID
    const storeId = Deno.env.get('LEMONSQUEEZY_STORE_ID');
    if (!storeId) {
      throw new Error('LemonSqueezy store ID not configured');
    }

    // Map plans to variant IDs based on billing cycle
    const variantMap: Record<string, Record<string, string>> = {
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
    if (!variantId) {
      throw new Error(`No variant ID found for plan: ${plan} (${billingCycle})`);
    }

    console.log(`Creating checkout for ${plan} plan (${billingCycle}):`);
    console.log(`- User: ${email || user.email}`);
    console.log(`- Variant ID: ${variantId}`);
    console.log(`- Store ID: ${storeId}`);

    // Create checkout data object
    const checkoutData = {
      name: name || user.user_metadata?.full_name,
      email: email || user.email,
      custom: {
        plan: plan
      },
      redirect_url: successUrl || `${req.headers.get('Origin')}/dashboard?checkout_success=true&plan=${plan}`,
      cancel_url: cancelUrl || `${req.headers.get('Origin')}/?checkout_cancelled=true`
    };

    // Create checkout using LemonSqueezy API
    const payload = {
      data: {
        type: 'checkouts',
        attributes: {
          custom_price: null,
          product_options: [], // Empty array as required by the API
          checkout_options: {
            embed: false,
            media: true,
            logo: true,
            desc: true,
            discount: true,
            dark: false,
            subscription_preview: true,
            button_color: '#8B5CF6'
          },
          // FIXED: checkout_data must be an array, not an object
          checkout_data: [checkoutData],
          expires_at: null
        },
        relationships: {
          store: {
            data: {
              type: 'stores',
              id: storeId
            }
          },
          variant: {
            data: {
              type: 'variants',
              id: variantId
            }
          }
        }
      }
    };

    // Log the exact payload being sent
    console.log('Sending payload to LemonSqueezy:', JSON.stringify(payload, null, 2));

    const response = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    // Log the raw response for debugging
    const responseText = await response.text();
    console.log(`LemonSqueezy API response status: ${response.status}`);
    console.log(`LemonSqueezy API response body: ${responseText}`);

    if (!response.ok) {
      throw new Error(`LemonSqueezy API error: ${responseText}`);
    }

    // Parse the response text back to JSON
    const checkout = JSON.parse(responseText);
    console.log('Checkout created successfully');

    return new Response(
      JSON.stringify({
        success: true,
        checkoutUrl: checkout.data.attributes.url,
        checkoutId: checkout.data.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Checkout creation error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to create checkout',
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});