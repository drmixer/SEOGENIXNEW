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

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { action, shopDomain, accessToken, product } = await req.json();

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('Authorization header required');
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabase.auth.getUser(token);
        if (!user) throw new Error('Invalid authentication');

        const shopifyApiUrl = `https://${shopDomain}/admin/api/2023-10`;

        switch(action) {
            case 'connect':
                if (!shopDomain || !accessToken) throw new Error('Shop domain and access token required');
                const testResponse = await fetch(`${shopifyApiUrl}/shop.json`, { headers: { 'X-Shopify-Access-Token': accessToken } });
                if (!testResponse.ok) throw new Error('Failed to connect to Shopify');
                const shopInfo = await testResponse.json();

                const { data: integration, error } = await supabase.from('cms_integrations').upsert({ user_id: user.id, cms_type: 'shopify', cms_name: `Shopify - ${shopInfo.shop.name}`, site_url: `https://${shopDomain}`, status: 'connected', credentials: { shop_domain: shopDomain, access_token: accessToken } }).select().single();
                if (error) throw error;

                return new Response(JSON.stringify({ success: true, integration }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

            case 'publish':
                if (!product) throw new Error('Product data is required');
                const { data: shopifyIntegration } = await supabase.from('cms_integrations').select('*').eq('user_id', user.id).eq('cms_type', 'shopify').single();
                if (!shopifyIntegration) throw new Error('Shopify integration not found');

                const pubResponse = await fetch(`${shopifyApiUrl}/products.json`, {
                    method: 'POST',
                    headers: { 'X-Shopify-Access-Token': shopifyIntegration.credentials.access_token, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ product })
                });
                if (!pubResponse.ok) throw new Error(await pubResponse.text());
                const createdProduct = await pubResponse.json();

                return new Response(JSON.stringify({ success: true, product: createdProduct.product }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

            case 'disconnect':
                await supabase.from('cms_integrations').delete().eq('user_id', user.id).eq('cms_type', 'shopify');
                return new Response(JSON.stringify({ success: true, message: 'Shopify integration disconnected' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

            default:
                throw new Error('Invalid action');
        }

    } catch (err) {
        console.error('Shopify integration error:', err.message);
        return new Response(JSON.stringify({ error: 'Shopify integration failed', details: err.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
