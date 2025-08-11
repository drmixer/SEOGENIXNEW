import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- CORS Headers ---
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// --- Type Definitions ---
interface ShopifyRequest {
    action: 'connect' | 'publish' | 'disconnect' | 'get_content' | 'update_content' | 'get_products';
    shopDomain?: string;
    accessToken?: string;
    // For publish
    product?: Record<string, any>;
    autoGenerateSchema?: boolean;
    // For get_content/update_content
    productId?: number;
    content?: { body_html: string; };
    // For get_products
    limit?: number;
    page_info?: string;
    search?: string;
}

// Helper to parse Link header for pagination
const parseLinkHeader = (header: string | null): { next?: string, prev?: string } => {
    if (!header) return {};
    const links: { [key: string]: string } = {};
    header.split(',').forEach(part => {
        const match = part.match(/<([^>]+)>;\s*rel="([^"]+)"/);
        if (match) {
            links[match[2]] = match[1];
        }
    });
    const getPageInfo = (url: string) => new URL(url).searchParams.get('page_info');
    return {
        next: links.next ? getPageInfo(links.next) || undefined : undefined,
        prev: links.previous ? getPageInfo(links.previous) || undefined : undefined,
    };
};


// --- Main Service Handler ---
export const shopifyService = async (req: Request, supabase: SupabaseClient): Promise<Response> => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const {
            action, shopDomain, accessToken, product, productId,
            content, limit, page_info, search, autoGenerateSchema
        }: ShopifyRequest = await req.json();

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('Authorization header required');
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabase.auth.getUser(token);
        if (!user) throw new Error('Invalid authentication');

        let integration;
        let shopifyApiUrl = `https://${shopDomain}/admin/api/2023-10`;
        let shopifyHeaders = { 'X-Shopify-Access-Token': accessToken || '', 'Content-Type': 'application/json' };

        if (action !== 'connect') {
            const { data, error } = await supabase.from('cms_integrations').select('*').eq('user_id', user.id).eq('cms_type', 'shopify').single();
            if (error || !data) throw new Error('Shopify integration not found.');
            integration = data;
            shopifyApiUrl = `https://${integration.credentials.shop_domain}/admin/api/2023-10`;
            shopifyHeaders['X-Shopify-Access-Token'] = integration.credentials.access_token;
        }

        switch(action) {
            case 'connect':
                // ... (connect logic unchanged)
                if (!shopDomain || !accessToken) throw new Error('Shop domain and access token required');
                const testResponse = await fetch(`${shopifyApiUrl}/shop.json`, { headers: shopifyHeaders });
                if (!testResponse.ok) throw new Error('Failed to connect to Shopify. Check credentials and domain.');
                const shopInfo = await testResponse.json();

                const { data: upserted, error } = await supabase.from('cms_integrations').upsert({ user_id: user.id, cms_type: 'shopify', cms_name: `Shopify - ${shopInfo.shop.name}`, site_url: `https://${shopDomain}`, status: 'connected', credentials: { shop_domain: shopDomain, access_token: accessToken } }).select().single();
                if (error) throw error;
                return new Response(JSON.stringify({ success: true, data: upserted }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

            case 'publish':
                if (!product) throw new Error('Product data is required');

                let finalProduct = { ...product };

                if (autoGenerateSchema && finalProduct.body_html) {
                    try {
                        const { data: schemaData, error: schemaError } = await supabase.functions.invoke('schema-generator', {
                            body: {
                                url: `${integration.site_url}/products/${product.handle || ''}`,
                                contentType: 'Product',
                                content: finalProduct.body_html,
                            }
                        });
                        if (schemaError) throw schemaError;

                        if (schemaData.output.implementation) {
                            finalProduct.body_html += `\n\n${schemaData.output.implementation}`;
                        }
                    } catch (e) {
                        console.error("Schema generation failed, publishing without schema.", e.message);
                    }
                }

                const pubResponse = await fetch(`${shopifyApiUrl}/products.json`, {
                    method: 'POST',
                    headers: shopifyHeaders,
                    body: JSON.stringify({ product: finalProduct })
                });
                if (!pubResponse.ok) throw new Error(await pubResponse.text());
                const createdProduct = await pubResponse.json();
                return new Response(JSON.stringify({ success: true, data: createdProduct.product }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

            case 'get_products':
                // ... (get_products logic unchanged)
                const productsUrl = new URL(`${shopifyApiUrl}/products.json`);
                productsUrl.searchParams.set('fields', 'id,title,handle,updated_at');
                productsUrl.searchParams.set('limit', (limit || 15).toString());
                if (page_info) productsUrl.searchParams.set('page_info', page_info);
                if (search) productsUrl.searchParams.set('title', search);

                const productsResponse = await fetch(productsUrl.toString(), { headers: shopifyHeaders });
                if (!productsResponse.ok) throw new Error(await productsResponse.text());

                const linkHeader = productsResponse.headers.get('Link');
                const pagination = parseLinkHeader(linkHeader);

                const products = await productsResponse.json();

                const items = products.products.map(p => ({
                    id: p.id,
                    title: p.title,
                    type: 'product',
                    date: p.updated_at
                }));

                return new Response(JSON.stringify({ success: true, data: { items, nextPageInfo: pagination.next } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

            case 'get_content':
                // ... (get_content logic unchanged)
                if (!productId) throw new Error('productId is required');
                const productResponse = await fetch(`${shopifyApiUrl}/products/${productId}.json?fields=title,body_html`, { headers: shopifyHeaders });
                if (!productResponse.ok) throw new Error(await productResponse.text());
                const productData = await productResponse.json();
                return new Response(JSON.stringify({ success: true, data: { title: productData.product.title, content: productData.product.body_html } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

            case 'update_content':
                // ... (update_content logic unchanged)
                 if (!productId || !content) throw new Error('productId and content are required');
                const updatePayload = {
                    product: {
                        id: productId,
                        body_html: content.body_html,
                    },
                };
                const updateResponse = await fetch(`${shopifyApiUrl}/products/${productId}.json`, {
                    method: 'PUT',
                    headers: shopifyHeaders,
                    body: JSON.stringify(updatePayload)
                });
                if (!updateResponse.ok) {
                    const errorBody = await updateResponse.text();
                    console.error("Shopify update failed:", errorBody);
                    throw new Error(errorBody);
                }
                const updatedProduct = await updateResponse.json();
                return new Response(JSON.stringify({ success: true, data: updatedProduct.product }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

            case 'disconnect':
                // ... (disconnect logic unchanged)
                await supabase.from('cms_integrations').delete().eq('user_id', user.id).eq('cms_type', 'shopify');
                return new Response(JSON.stringify({ success: true, message: 'Shopify integration disconnected' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

            default:
                throw new Error('Invalid action');
        }

    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        const errorCode = err instanceof Error ? err.name : 'UNKNOWN_ERROR';
        return new Response(JSON.stringify({ success: false, error: { message: errorMessage, code: errorCode } }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
};

// --- Server ---
Deno.serve(async (req) => {
    const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    return await shopifyService(req, supabase);
});
