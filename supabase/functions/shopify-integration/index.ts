import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// --- CORS Headers ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE'
};
// --- Inline Logging Functions (to avoid import issues) ---
async function logToolRun(supabase, projectId, toolName, inputPayload) {
  if (!projectId) {
    throw new Error("logToolRun error: projectId is required.");
  }
  console.log(`Logging tool run: ${toolName} for project: ${projectId}`);
  const { data, error } = await supabase.from("tool_runs").insert({
    project_id: projectId,
    tool_name: toolName,
    input_payload: inputPayload,
    status: "running",
    created_at: new Date().toISOString()
  }).select("id").single();
  if (error) {
    console.error("Error logging tool run:", error);
    throw new Error(`Failed to log tool run. Supabase error: ${error.message}`);
  }
  if (!data || !data.id) {
    console.error("No data or data.id returned from tool_runs insert.");
    throw new Error("Failed to log tool run: No data returned after insert.");
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
// Helper to parse Link header for pagination
const parseLinkHeader = (header)=>{
  if (!header) return {};
  const links = {};
  header.split(',').forEach((part)=>{
    const match = part.match(/<([^>]+)>;\s*rel="([^"]+)"/);
    if (match) {
      links[match[2]] = match[1];
    }
  });
  const getPageInfo = (url)=>new URL(url).searchParams.get('page_info');
  return {
    next: links.next ? getPageInfo(links.next) || undefined : undefined,
    prev: links.previous ? getPageInfo(links.previous) || undefined : undefined
  };
};
// --- Main Service Handler ---
export const shopifyService = async (req, supabase)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  let runId = null;
  try {
    const { action, projectId, shopDomain, accessToken, product, productId, content, limit, page_info, search, autoGenerateSchema, pageUrl, useInsertedSchema, publicUrl, embeddedContent } = await req.json();
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Authorization header required');
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) throw new Error('Invalid authentication');
    // Log tool run if projectId is provided
    if (projectId) {
      runId = await logToolRun(supabase, projectId, 'shopify-integration', {
        action,
        shopDomain: action === 'connect' ? shopDomain : undefined,
        productId,
        hasContent: !!content,
        autoGenerateSchema
      });
    }
    let integration;
    let shopifyApiUrl = `https://${shopDomain}/admin/api/2023-10`;
    let shopifyHeaders = {
      'X-Shopify-Access-Token': accessToken || '',
      'Content-Type': 'application/json'
    };
    if (action !== 'connect') {
      console.log('Fetching existing Shopify integration...');
      const { data, error } = await supabase.from('cms_integrations').select('*').eq('user_id', user.id).eq('cms_type', 'shopify').single();
      if (error || !data) throw new Error('Shopify integration not found.');
      integration = data;
      shopifyApiUrl = `https://${integration.credentials.shop_domain}/admin/api/2023-10`;
      shopifyHeaders['X-Shopify-Access-Token'] = integration.credentials.access_token;
    }
    // Helper: prefer user-inserted schema draft, fallback to null
    async function getAppliedSchemaImplementation(projectId?: string, userId?: string, pageUrlHint?: string, cmsItemId?: string | number): Promise<string | null> {
      try {
        if (!projectId || !userId) return null;
        let query = supabase
          .from('user_activity')
          .select('activity_data, website_url, created_at')
          .eq('user_id', userId)
          .eq('activity_type', 'schema_draft')
          .eq('tool_id', projectId)
          .order('created_at', { ascending: false })
          .limit(10);
        if (pageUrlHint) query = query.eq('website_url', pageUrlHint);
        const { data, error } = await query;
        if (error) {
          console.warn('Failed to fetch schema draft:', error.message);
          return null;
        }
        const rows = data || [];
        const picked = (cmsItemId != null)
          ? rows.find(r => r?.activity_data?.applied && r?.activity_data?.schema && r?.activity_data?.cms_item_id == cmsItemId)
          : rows.find(r => r?.activity_data?.applied && r?.activity_data?.schema);
        if (!picked) return null;
        const schemaObj = picked.activity_data.schema;
        const json = typeof schemaObj === 'string' ? schemaObj : JSON.stringify(schemaObj, null, 2);
        return `<script type=\"application/ld+json\">${json}</script>`;
      } catch (e) {
        console.warn('getAppliedSchemaImplementation error:', e?.message || e);
        return null;
      }
    }

    let output;
    switch(action){
      case 'connect':
        if (!shopDomain || !accessToken) throw new Error('Shop domain and access token required');
        console.log(`Testing Shopify connection to: ${shopDomain}`);
        const testResponse = await fetch(`${shopifyApiUrl}/shop.json`, {
          headers: shopifyHeaders
        });
        if (!testResponse.ok) throw new Error('Failed to connect to Shopify. Check credentials and domain.');
        const shopInfo = await testResponse.json();
        console.log('Saving Shopify integration...');
        const { data: upserted, error } = await supabase.from('cms_integrations').upsert({
          user_id: user.id,
          cms_type: 'shopify',
          cms_name: `Shopify - ${shopInfo.shop.name}`,
          site_url: `https://${shopDomain}`,
          status: 'connected',
          credentials: {
            shop_domain: shopDomain,
            access_token: accessToken
          }
        }).select().single();
        if (error) throw error;
        output = {
          success: true,
          integration: upserted,
          shopInfo: shopInfo.shop
        };
        break;
      case 'publish':
        if (!product) throw new Error('Product data is required');
        let finalProduct = {
          ...product
        };
        if (finalProduct.body_html) {
          // Prefer inserted schema draft when present
          const impl = (useInsertedSchema !== false) ? await getAppliedSchemaImplementation(projectId, user.id, pageUrl) : null;
          if (impl) {
            finalProduct.body_html += `\n\n${impl}`;
          } else if (autoGenerateSchema) {
            console.log('Auto-generating schema for product...');
            try {
              const { data: schemaData, error: schemaError } = await supabase.functions.invoke('schema-generator', {
                body: {
                  url: pageUrl || `${integration.site_url}`,
                  contentType: 'Product',
                  content: finalProduct.body_html
                }
              });
              if (schemaError) throw schemaError;
              if (schemaData.output.implementation) {
                finalProduct.body_html += `\n\n${schemaData.output.implementation}`;
                console.log('Schema markup added to product');
              }
            } catch (e) {
              console.error("Schema generation failed, publishing without schema:", e.message);
            }
          }
        }
        console.log('Publishing product to Shopify...');
        const pubResponse = await fetch(`${shopifyApiUrl}/products.json`, {
          method: 'POST',
          headers: shopifyHeaders,
          body: JSON.stringify({
            product: finalProduct
          })
        });
        if (!pubResponse.ok) throw new Error(await pubResponse.text());
        const createdProduct = await pubResponse.json();
        output = {
          success: true,
          product: createdProduct.product,
          permalink: createdProduct?.product?.handle ? `${integration.site_url.replace(/\/$/, '')}/products/${createdProduct.product.handle}` : null
        };
        break;
      case 'get_products':
        console.log('Fetching products from Shopify...');
        const productsUrl = new URL(`${shopifyApiUrl}/products.json`);
        productsUrl.searchParams.set('fields', 'id,title,handle,updated_at');
        productsUrl.searchParams.set('limit', (limit || 15).toString());
        if (page_info) productsUrl.searchParams.set('page_info', page_info);
        if (search) productsUrl.searchParams.set('title', search);
        const productsResponse = await fetch(productsUrl.toString(), {
          headers: shopifyHeaders
        });
        if (!productsResponse.ok) throw new Error(await productsResponse.text());
        const linkHeader = productsResponse.headers.get('Link');
        const pagination = parseLinkHeader(linkHeader);
        const products = await productsResponse.json();
        const items = products.products.map((p)=>({
            id: p.id,
            title: p.title,
            type: 'product',
            date: p.updated_at
          }));
        output = {
          success: true,
          items,
          nextPageInfo: pagination.next
        };
        break;
      case 'get_content':
        if (!productId) throw new Error('productId is required');
        console.log(`Fetching product content: ${productId}`);
        const productResponse = await fetch(`${shopifyApiUrl}/products/${productId}.json?fields=title,body_html`, {
          headers: shopifyHeaders
        });
        if (!productResponse.ok) throw new Error(await productResponse.text());
        const productData = await productResponse.json();
        output = {
          success: true,
          title: productData.product.title,
          content: productData.product.body_html
        };
        break;
      case 'update_content':
        if (!productId || !content) throw new Error('productId and content are required');
        // Normalize incoming content
        let incomingBody = content?.product?.body_html ?? content?.body_html ?? '';
        if (typeof incomingBody !== 'string') incomingBody = '';
        // Prefer inserted schema, else generate when allowed
        const appliedImpl = (useInsertedSchema !== false) ? await getAppliedSchemaImplementation(projectId, user.id, pageUrl, productId) : null;
        if (appliedImpl) {
          incomingBody += `\n\n${appliedImpl}`;
        } else if (autoGenerateSchema && incomingBody) {
          try {
            const { data: schemaData, error: schemaError } = await supabase.functions.invoke('schema-generator', {
              body: {
                url: pageUrl || `${integration.site_url}`,
                contentType: 'Product',
                content: incomingBody
              }
            });
            if (schemaError) throw schemaError;
            if (schemaData?.output?.implementation) {
              incomingBody += `\n\n${schemaData.output.implementation}`;
            }
          } catch (e) {
            console.error('Schema generation failed on update:', e?.message || e);
          }
        }
        const updatePayload = {
          product: {
            id: productId,
            body_html: incomingBody
          }
        };
        console.log(`Updating product content: ${productId}`);
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
        output = {
          success: true,
          product: updatedProduct.product,
          permalink: updatedProduct?.product?.handle ? `${integration.site_url.replace(/\/$/, '')}/products/${updatedProduct.product.handle}` : null
        };
        break;
      case 'publish_ai_sitemap':
        if (!publicUrl) throw new Error('publicUrl is required');
        // Create or update a Shopify page linking to the AI sitemap JSON
        {
          // Try to find an existing page with handle 'ai-sitemap'
          const listResp = await fetch(`${shopifyApiUrl}/pages.json?limit=50&fields=id,title,handle,body_html`, { headers: shopifyHeaders });
          if (!listResp.ok) throw new Error(await listResp.text());
          const listData = await listResp.json();
          const pages = Array.isArray(listData?.pages) ? listData.pages : [];
          const existing = pages.find((p: any) => p.handle === 'ai-sitemap' || p.title === 'AI Sitemap');
          const body_html = embeddedContent
            ? `This shop exposes an AI sitemap at <a href="${publicUrl}">${publicUrl}</a>.<br/><br/><strong>Excerpt:</strong><pre>${embeddedContent.replace(/</g,'&lt;')}</pre>`
            : `This shop exposes an AI sitemap at <a href="${publicUrl}">${publicUrl}</a>.`;
          let page;
          if (existing) {
            const upd = await fetch(`${shopifyApiUrl}/pages/${existing.id}.json`, {
              method: 'PUT',
              headers: shopifyHeaders,
              body: JSON.stringify({ page: { id: existing.id, title: 'AI Sitemap', body_html } })
            });
            if (!upd.ok) throw new Error(await upd.text());
            page = (await upd.json()).page;
          } else {
            const create = await fetch(`${shopifyApiUrl}/pages.json`, {
              method: 'POST',
              headers: shopifyHeaders,
              body: JSON.stringify({ page: { title: 'AI Sitemap', body_html, published: true } })
            });
            if (!create.ok) throw new Error(await create.text());
            page = (await create.json()).page;
          }
          const permalink = page?.handle ? `${integration.site_url.replace(/\/$/, '')}/pages/${page.handle}` : null;
          output = { success: true, page, permalink };
        }
        break;
      case 'disconnect':
        console.log('Disconnecting Shopify integration...');
        await supabase.from('cms_integrations').delete().eq('user_id', user.id).eq('cms_type', 'shopify');
        output = {
          success: true,
          message: 'Shopify integration disconnected'
        };
        break;
      default:
        throw new Error('Invalid action');
    }
    if (runId) {
      await updateToolRun(supabase, runId, 'completed', output, null);
    }
    console.log(`Shopify ${action} operation completed successfully`);
    return new Response(JSON.stringify({
      success: true,
      data: output,
      runId
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
    const errorCode = err instanceof Error ? err.name : 'UNKNOWN_ERROR';
    console.error('Shopify integration error:', errorMessage);
    if (runId) {
      await updateToolRun(supabase, runId, 'error', null, errorMessage);
    }
    return new Response(JSON.stringify({
      success: false,
      error: {
        message: errorMessage,
        code: errorCode
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
// --- Server ---
Deno.serve(async (req)=>{
  const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  return await shopifyService(req, supabase);
});
