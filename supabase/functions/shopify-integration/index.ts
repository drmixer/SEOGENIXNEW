import { serve } from "https://deno.land/std@0.200.0/http/server.ts";
import { logToolRun } from 'shared/logToolRun.ts';
import { updateToolRun } from 'shared/updateToolRun.ts';

interface ShopifyRequest {
  action: 'connect' | 'publish' | 'sync' | 'disconnect';
  shopDomain?: string;
  accessToken?: string;
  product?: {
    title: string;
    body_html: string;
    vendor?: string;
    product_type?: string;
    tags?: string;
    variants?: Array<{
      price: string;
      inventory_quantity?: number;
    }>;
  };
  productId?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { action, shopDomain, accessToken, product, productId }: ShopifyRequest = await req.json();
    
    // Get user from auth header
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

    const shopifyApiUrl = `https://${shopDomain}/admin/api/2023-10`;

    switch (action) {
      case 'connect':
        if (!shopDomain || !accessToken) {
          throw new Error('Shop domain and access token required');
        }

        // Test Shopify connection
        const testResponse = await fetch(`${shopifyApiUrl}/shop.json`, {
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json'
          }
        });

        if (!testResponse.ok) {
          throw new Error('Failed to connect to Shopify. Please check your credentials.');
        }

        const shopInfo = await testResponse.json();

        // Store integration in database
        const { data: integration, error } = await supabase
          .from('cms_integrations')
          .upsert({
            user_id: user.id,
            cms_type: 'shopify',
            cms_name: `Shopify - ${shopInfo.shop.name}`,
            site_url: `https://${shopDomain}`,
            status: 'connected',
            credentials: {
              shop_domain: shopDomain,
              access_token: accessToken // In production, encrypt this
            },
            settings: {
              shop_info: shopInfo.shop,
              plan_name: shopInfo.shop.plan_name || 'Unknown'
            },
            last_sync_at: new Date().toISOString()
          })
          .select()
          .single();

        if (error) throw error;

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Shopify integration connected successfully',
            integration: {
              id: integration.id,
              cms_type: integration.cms_type,
              cms_name: integration.cms_name,
              site_url: integration.site_url,
              status: integration.status
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      case 'publish':
        if (!product) {
          throw new Error('Product data is required for publishing');
        }

        // Get Shopify integration
        const { data: shopifyIntegration } = await supabase
          .from('cms_integrations')
          .select('*')
          .eq('user_id', user.id)
          .eq('cms_type', 'shopify')
          .single();

        if (!shopifyIntegration) {
          throw new Error('Shopify integration not found');
        }

        const credentials = shopifyIntegration.credentials as any;
        const shopifyUrl = `https://${credentials.shop_domain}/admin/api/2023-10`;
        
        // Create product in Shopify
        const publishResponse = await fetch(`${shopifyUrl}/products.json`, {
          method: 'POST',
          headers: {
            'X-Shopify-Access-Token': credentials.access_token,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            product: {
              title: product.title,
              body_html: product.body_html,
              vendor: product.vendor || '',
              product_type: product.product_type || '',
              tags: product.tags || '',
              variants: product.variants || [{ price: '0.00' }]
            }
          })
        });

        if (!publishResponse.ok) {
          const errorText = await publishResponse.text();
          throw new Error(`Failed to create product in Shopify: ${errorText}`);
        }

        const createdProduct = await publishResponse.json();

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Product created in Shopify successfully',
            product: {
              id: createdProduct.product.id,
              title: createdProduct.product.title,
              handle: createdProduct.product.handle,
              status: createdProduct.product.status
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      case 'sync':
        // Sync recent products from Shopify
        const { data: syncIntegration } = await supabase
          .from('cms_integrations')
          .select('*')
          .eq('user_id', user.id)
          .eq('cms_type', 'shopify')
          .single();

        if (!syncIntegration) {
          throw new Error('Shopify integration not found');
        }

        const syncCredentials = syncIntegration.credentials as any;
        const syncShopifyUrl = `https://${syncCredentials.shop_domain}/admin/api/2023-10`;
        
        const productsResponse = await fetch(`${syncShopifyUrl}/products.json?limit=10`, {
          headers: {
            'X-Shopify-Access-Token': syncCredentials.access_token,
            'Content-Type': 'application/json'
          }
        });

        if (!productsResponse.ok) {
          throw new Error('Failed to sync products from Shopify');
        }

        const productsData = await productsResponse.json();

        // Update last sync time
        await supabase
          .from('cms_integrations')
          .update({ last_sync_at: new Date().toISOString() })
          .eq('id', syncIntegration.id);

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Shopify sync completed',
            products: productsData.products.map((product: any) => ({
              id: product.id,
              title: product.title,
              handle: product.handle,
              status: product.status,
              created_at: product.created_at
            }))
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      case 'disconnect':
        // Remove Shopify integration
        const { error: deleteError } = await supabase
          .from('cms_integrations')
          .delete()
          .eq('user_id', user.id)
          .eq('cms_type', 'shopify');

        if (deleteError) throw deleteError;

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Shopify integration disconnected successfully'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      default:
        throw new Error('Invalid action');
    }

  } catch (error) {
    console.error('Shopify integration error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Shopify integration failed',
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});