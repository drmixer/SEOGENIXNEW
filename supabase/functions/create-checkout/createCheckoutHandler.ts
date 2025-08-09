import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function createCheckoutHandler(
  supabase: SupabaseClient,
  req: Request,
  input: any
) {
  const { plan, userId, billingCycle = 'monthly', name, email, successUrl, cancelUrl } = input;

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
      agency: Deno.env.get('LEMONSQUEEzy_AGENCY_ANNUAL_VARIANT_ID') || ''
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
          custom: { plan: plan, user_id: userId }
        },
        product_options: {
          redirect_url: successUrl || `${req.headers.get('Origin')}/dashboard?checkout_success=true`
        },
      },
      relationships: {
        store: { data: { type: 'stores', id: storeId } },
        variant: { data: { type: 'variants', id: variantId } }
      }
    }
  };

  const response = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
    method: 'POST',
    headers: {
      'Accept': 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LemonSqueezy API error: ${errorText}`);
  }

  const checkout = await response.json();
  let checkoutUrl = checkout.data.attributes.url;
  if (cancelUrl) {
    checkoutUrl += `${checkoutUrl.includes('?') ? '&' : '?'}cancel_url=${encodeURIComponent(cancelUrl)}`;
  }

  return {
    success: true,
    checkoutUrl: checkoutUrl,
    checkoutId: checkout.data.id
  };
}
