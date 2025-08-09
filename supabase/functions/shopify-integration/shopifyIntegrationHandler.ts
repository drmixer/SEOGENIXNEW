import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function shopifyIntegrationHandler(
  supabase: SupabaseClient,
  req: Request,
  input: any
) {
  const { action, shopDomain, accessToken, product, productId } = input;

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw new Error('Authorization header required');
  const token = authHeader.replace('Bearer ', '');
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) throw new Error('Invalid authentication');

  const getShopifyApiUrl = async (userId: string) => {
      if (shopDomain) return `https://${shopDomain}/admin/api/2023-10`;
      const { data: integration } = await supabase.from('cms_integrations').select('credentials').eq('user_id', userId).eq('cms_type', 'shopify').single();
      if (!integration) throw new Error('Shopify integration not found');
      return `https://${integration.credentials.shop_domain}/admin/api/2023-10`;
  };

  const getAccessToken = async (userId: string) => {
      if (accessToken) return accessToken;
      const { data: integration } = await supabase.from('cms_integrations').select('credentials').eq('user_id', userId).eq('cms_type', 'shopify').single();
      if (!integration) throw new Error('Shopify integration not found');
      return integration.credentials.access_token;
  }

  switch (action) {
    case 'connect': {
      if (!shopDomain || !accessToken) throw new Error('Shop domain and access token required');
      const shopifyApiUrl = `https://${shopDomain}/admin/api/2023-10`;
      const testResponse = await fetch(`${shopifyApiUrl}/shop.json`, {
        headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' }
      });
      if (!testResponse.ok) throw new Error('Failed to connect to Shopify.');
      const shopInfo = await testResponse.json();
      const { data: integration, error } = await supabase.from('cms_integrations').upsert({
        user_id: user.id,
        cms_type: 'shopify',
        cms_name: `Shopify - ${shopInfo.shop.name}`,
        site_url: `https://${shopDomain}`,
        status: 'connected',
        credentials: { shop_domain: shopDomain, access_token: accessToken },
        last_sync_at: new Date().toISOString()
      }).select().single();
      if (error) throw error;
      return { success: true, message: 'Shopify connected.', integration };
    }
    case 'publish': {
      if (!product) throw new Error('Product data is required');
      const shopifyApiUrl = await getShopifyApiUrl(user.id);
      const token = await getAccessToken(user.id);
      const publishResponse = await fetch(`${shopifyApiUrl}/products.json`, {
        method: 'POST',
        headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ product })
      });
      if (!publishResponse.ok) throw new Error(`Failed to create product in Shopify: ${await publishResponse.text()}`);
      const createdProduct = await publishResponse.json();
      return { success: true, message: 'Product created.', product: createdProduct.product };
    }
    case 'sync': {
        const shopifyApiUrl = await getShopifyApiUrl(user.id);
        const token = await getAccessToken(user.id);
        const productsResponse = await fetch(`${shopifyApiUrl}/products.json?limit=10`, {
            headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' }
        });
        if (!productsResponse.ok) throw new Error('Failed to sync products from Shopify');
        const productsData = await productsResponse.json();
        await supabase.from('cms_integrations').update({ last_sync_at: new Date().toISOString() }).eq('user_id', user.id).eq('cms_type', 'shopify');
        return { success: true, message: 'Sync completed.', products: productsData.products };
    }
    case 'disconnect': {
      const { error } = await supabase.from('cms_integrations').delete().eq('user_id', user.id).eq('cms_type', 'shopify');
      if (error) throw error;
      return { success: true, message: 'Shopify disconnected.' };
    }
    default:
      throw new Error('Invalid action');
  }
}
