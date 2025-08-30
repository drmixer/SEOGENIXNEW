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
// --- Main Service Handler ---
export const wordpressService = async (req, supabase)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  let runId = null;
  try {
    const { action, projectId, siteUrl, username, applicationPassword, content, postId, page, search, title, status, autoGenerateSchema, pageUrl, useInsertedSchema } = await req.json();
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Authorization header required');
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) throw new Error('Invalid authentication');
    // Log tool run if projectId is provided
    if (projectId) {
      runId = await logToolRun(supabase, projectId, 'wordpress-integration', {
        action,
        siteUrl: action === 'connect' ? siteUrl : undefined,
        postId,
        hasContent: !!content,
        autoGenerateSchema
      });
    }
    let integration;

    // Helper: prefer user-inserted schema draft, fallback to null
    async function getAppliedSchemaImplementation(projectId?: string, pageUrlHint?: string, cmsItemId?: string | number): Promise<string | null> {
      try {
        if (!projectId) return null;
        let query = supabase
          .from('user_activity')
          .select('activity_data, website_url, created_at')
          .eq('user_id', user.id)
          .eq('activity_type', 'schema_draft')
          .eq('tool_id', projectId)
          .order('created_at', { ascending: false })
          .limit(10);
        if (pageUrlHint) {
          query = query.eq('website_url', pageUrlHint);
        }
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
        return `<script type="application/ld+json">${json}</script>`;
      } catch (e) {
        console.warn('getAppliedSchemaImplementation error:', e?.message || e);
        return null;
      }
    }
    if (action !== 'connect') {
      console.log('Fetching existing WordPress integration...');
      const { data, error } = await supabase.from('cms_integrations').select('*').eq('user_id', user.id).eq('cms_type', 'wordpress').single();
      if (error || !data) throw new Error('WordPress integration not found or user has multiple WP integrations.');
      integration = data;
    }
    const getAuthHeader = (creds)=>`Basic ${btoa(`${creds.username}:${creds.application_password}`)}`;
    let output;
    switch(action){
      case 'connect':
        if (!siteUrl || !username || !applicationPassword) throw new Error('Site URL, username, and application password required');
        console.log(`Testing WordPress connection to: ${siteUrl}`);
        const testResponse = await fetch(`${siteUrl}/wp-json/wp/v2/users/me`, {
          headers: {
            'Authorization': getAuthHeader({
              username,
              application_password: applicationPassword
            })
          }
        });
        if (!testResponse.ok) throw new Error('Failed to connect to WordPress. Check credentials and URL.');
        console.log('Saving WordPress integration...');
        const { data: upserted, error } = await supabase.from('cms_integrations').upsert({
          user_id: user.id,
          cms_type: 'wordpress',
          cms_name: `WordPress - ${new URL(siteUrl).hostname}`,
          site_url: siteUrl,
          status: 'connected',
          credentials: {
            username,
            application_password: applicationPassword
          }
        }).select().single();
        if (error) throw error;
        output = {
          success: true,
          integration: upserted
        };
        break;
      case 'publish':
        if (!content || !title) throw new Error('Title and content are required for publishing.');
        let finalContent = content;
        // Prefer inserted schema draft if available
        if (useInsertedSchema !== false) {
          const impl = await getAppliedSchemaImplementation(projectId, pageUrl);
          if (impl) {
            finalContent += `\n\n${impl}`;
          } else if (autoGenerateSchema) {
            console.log('Auto-generating schema for WordPress post...');
            try {
              const { data: schemaData, error: schemaError } = await supabase.functions.invoke('schema-generator', {
                body: {
                  url: pageUrl || integration.site_url,
                  contentType: 'Article',
                  content: content
                }
              });
              if (schemaError) throw schemaError;
              if (schemaData.output.implementation) {
                finalContent += `\n\n${schemaData.output.implementation}`;
                console.log('Schema markup added to post');
              }
            } catch (e) {
              console.error("Schema generation failed, publishing without schema:", e.message);
            }
          }
        } else if (autoGenerateSchema) {
          console.log('Auto-generating schema for WordPress post...');
          try {
            const { data: schemaData, error: schemaError } = await supabase.functions.invoke('schema-generator', {
              body: {
                url: pageUrl || integration.site_url,
                contentType: 'Article',
                content: content
              }
            });
            if (schemaError) throw schemaError;
            if (schemaData.output.implementation) {
              finalContent += `\n\n${schemaData.output.implementation}`;
              console.log('Schema markup added to post');
            }
          } catch (e) {
            console.error("Schema generation failed, publishing without schema:", e.message);
          }
        }
        console.log('Publishing post to WordPress...');
        const pubResponse = await fetch(`${integration.site_url}/wp-json/wp/v2/posts`, {
          method: 'POST',
          headers: {
            'Authorization': getAuthHeader(integration.credentials),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            title: title,
            content: finalContent,
            status: status || 'draft'
          })
        });
        if (!pubResponse.ok) throw new Error(await pubResponse.text());
        const publishedPost = await pubResponse.json();
        output = {
          success: true,
          post: publishedPost,
          permalink: publishedPost?.link || publishedPost?.guid?.rendered || null
        };
        break;
      case 'get_posts':
        console.log('Fetching posts and pages from WordPress...');
        const per_page = 15;
        const postsUrl = new URL(`${integration.site_url}/wp-json/wp/v2/posts`);
        postsUrl.searchParams.set('context', 'embed');
        postsUrl.searchParams.set('per_page', per_page.toString());
        if (page) postsUrl.searchParams.set('page', page.toString());
        if (search) postsUrl.searchParams.set('search', search);
        const pagesUrl = new URL(`${integration.site_url}/wp-json/wp/v2/pages`);
        pagesUrl.searchParams.set('context', 'embed');
        pagesUrl.searchParams.set('per_page', per_page.toString());
        if (page) pagesUrl.searchParams.set('page', page.toString());
        if (search) pagesUrl.searchParams.set('search', search);
        const [postsResponse, pagesResponse] = await Promise.all([
          fetch(postsUrl.toString(), {
            headers: {
              'Authorization': getAuthHeader(integration.credentials)
            }
          }),
          fetch(pagesUrl.toString(), {
            headers: {
              'Authorization': getAuthHeader(integration.credentials)
            }
          })
        ]);
        if (!postsResponse.ok) console.error(`Failed to fetch posts: ${await postsResponse.text()}`);
        if (!pagesResponse.ok) console.error(`Failed to fetch pages: ${await pagesResponse.text()}`);
        const posts = postsResponse.ok ? await postsResponse.json() : [];
        const pages = pagesResponse.ok ? await pagesResponse.json() : [];
        const items = [
          ...posts.map((p)=>({
              id: p.id,
              title: p.title.rendered,
              type: 'post',
              date: p.date_gmt
            })),
          ...pages.map((p)=>({
              id: p.id,
              title: p.title.rendered,
              type: 'page',
              date: p.date_gmt
            }))
        ].sort((a, b)=>new Date(b.date).getTime() - new Date(a.date).getTime());
        output = {
          success: true,
          items
        };
        break;
      case 'get_content':
        if (!postId) throw new Error('postId is required');
        console.log(`Fetching content for post/page: ${postId}`);
        let response = await fetch(`${integration.site_url}/wp-json/wp/v2/posts/${postId}?context=edit`, {
          headers: {
            'Authorization': getAuthHeader(integration.credentials)
          }
        });
        if (!response.ok) {
          response = await fetch(`${integration.site_url}/wp-json/wp/v2/pages/${postId}?context=edit`, {
            headers: {
              'Authorization': getAuthHeader(integration.credentials)
            }
          });
        }
        if (!response.ok) throw new Error(`Could not find post or page with ID ${postId}. Details: ${await response.text()}`);
        const postData = await response.json();
        output = {
          success: true,
          title: postData.title.raw,
          content: postData.content.raw
        };
        break;
      case 'update_content':
        if (!postId || !content) throw new Error('postId and content are required');
        console.log(`Updating content for post/page: ${postId}`);
        // Normalize inputs: content may arrive as string or { title, content }
        const incomingTitle = (typeof content === 'object' && content?.title) ? content.title : (title || undefined);
        let finalUpdateContent = (typeof content === 'object' && typeof content?.content === 'string') ? content.content : (typeof content === 'string' ? content : '');
        // Prefer inserted schema draft if available; else generate when allowed
        const appliedImpl = (useInsertedSchema !== false) ? await getAppliedSchemaImplementation(projectId, pageUrl, postId) : null;
        if (appliedImpl) {
          finalUpdateContent += `\n\n${appliedImpl}`;
        } else if (autoGenerateSchema && typeof finalUpdateContent === 'string') {
          try {
            console.log('Auto-generating schema for WordPress update...');
            const { data: schemaData, error: schemaError } = await supabase.functions.invoke('schema-generator', {
              body: {
                url: pageUrl || integration.site_url,
                contentType: 'Article',
                content: finalUpdateContent
              }
            });
            if (schemaError) throw schemaError;
            if (schemaData?.output?.implementation) {
              finalUpdateContent += `\n\n${schemaData.output.implementation}`;
              console.log('Schema markup appended for update');
            }
          } catch (e) {
            console.error('Schema generation failed on update:', e?.message || e);
          }
        }
        let updateResponse = await fetch(`${integration.site_url}/wp-json/wp/v2/posts/${postId}`, {
          method: 'POST',
          headers: {
            'Authorization': getAuthHeader(integration.credentials),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            title: incomingTitle,
            content: finalUpdateContent
          })
        });
        if (!updateResponse.ok) {
          const errorText = await updateResponse.text();
          if (errorText.includes('rest_post_invalid_id')) {
            updateResponse = await fetch(`${integration.site_url}/wp-json/wp/v2/pages/${postId}`, {
              method: 'POST',
              headers: {
                'Authorization': getAuthHeader(integration.credentials),
                'Content-Type': 'application/json'
              },
          body: JSON.stringify({
            title: incomingTitle,
            content: finalUpdateContent
          })
        });
          } else {
            throw new Error(errorText);
          }
        }
        if (!updateResponse.ok) throw new Error(await updateResponse.text());
        const updatedPost = await updateResponse.json();
        output = {
          success: true,
          post: updatedPost,
          permalink: updatedPost?.link || updatedPost?.guid?.rendered || null
        };
        break;
      case 'disconnect':
        console.log('Disconnecting WordPress integration...');
        await supabase.from('cms_integrations').delete().eq('user_id', user.id).eq('cms_type', 'wordpress');
        output = {
          success: true,
          message: 'WordPress integration disconnected'
        };
        break;
      default:
        throw new Error('Invalid action');
    }
    if (runId) {
      await updateToolRun(supabase, runId, 'completed', output, null);
    }
    console.log(`WordPress ${action} operation completed successfully`);
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
    console.error('WordPress integration error:', errorMessage);
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
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  return await wordpressService(req, supabase);
});
