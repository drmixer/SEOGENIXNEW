import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- CORS Headers ---
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// --- Type Definitions ---
interface WPRequest {
    action: 'connect' | 'publish' | 'disconnect' | 'get_content' | 'update_content' | 'get_posts';
    siteUrl?: string;
    username?: string;
    applicationPassword?: string;
    // For publish action
    title?: string;
    content?: string;
    status?: 'draft' | 'publish';
    autoGenerateSchema?: boolean;
    // For get_content/update_content
    postId?: number;
    // For get_posts
    page?: number;
    search?: string;
}

// --- Main Service Handler ---
export const wordpressService = async (req: Request, supabase: SupabaseClient): Promise<Response> => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const {
            action, siteUrl, username, applicationPassword,
            content, postId, page, search, title, status, autoGenerateSchema
        }: WPRequest = await req.json();

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('Authorization header required');
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabase.auth.getUser(token);
        if (!user) throw new Error('Invalid authentication');

        let integration;
        if (action !== 'connect') {
            const { data, error } = await supabase.from('cms_integrations').select('*').eq('user_id', user.id).eq('cms_type', 'wordpress').single();
            if (error || !data) throw new Error('WordPress integration not found or user has multiple WP integrations.');
            integration = data;
        }

        const getAuthHeader = (creds: any) => `Basic ${btoa(`${creds.username}:${creds.application_password}`)}`;

        switch(action) {
            case 'connect':
                // ... (connect logic unchanged)
                if (!siteUrl || !username || !applicationPassword) throw new Error('Site URL, username, and application password required');
                const testResponse = await fetch(`${siteUrl}/wp-json/wp/v2/users/me`, { headers: { 'Authorization': getAuthHeader({ username, application_password: applicationPassword }) } });
                if (!testResponse.ok) throw new Error('Failed to connect to WordPress. Check credentials and URL.');

                const { data: upserted, error } = await supabase.from('cms_integrations').upsert({ user_id: user.id, cms_type: 'wordpress', cms_name: `WordPress - ${new URL(siteUrl).hostname}`, site_url: siteUrl, status: 'connected', credentials: { username, application_password: applicationPassword } }).select().single();
                if (error) throw error;
                return new Response(JSON.stringify({ success: true, data: upserted }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

            case 'publish':
                if (!content || !title) throw new Error('Title and content are required for publishing.');

                let finalContent = content;

                if (autoGenerateSchema) {
                    try {
                        const { data: schemaData, error: schemaError } = await supabase.functions.invoke('schema-generator', {
                            body: {
                                url: integration.site_url, // Pass a relevant URL
                                contentType: 'Article', // Or determine from frontend
                                content: content,
                            }
                        });
                        if (schemaError) throw schemaError;

                        // The schema-generator now returns a more complex object.
                        // Let's assume it returns { implementation: '<script>...</script>' }
                        if (schemaData.output.implementation) {
                            finalContent += `\n\n${schemaData.output.implementation}`;
                        }
                    } catch (e) {
                        console.error("Schema generation failed, publishing without schema.", e.message);
                    }
                }

                const pubResponse = await fetch(`${integration.site_url}/wp-json/wp/v2/posts`, {
                    method: 'POST',
                    headers: { 'Authorization': getAuthHeader(integration.credentials), 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: title, content: finalContent, status: status || 'draft' })
                });

                if (!pubResponse.ok) throw new Error(await pubResponse.text());
                const publishedPost = await pubResponse.json();
                return new Response(JSON.stringify({ success: true, data: publishedPost }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

            case 'get_posts':
                 // ... (get_posts logic unchanged)
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
                    fetch(postsUrl.toString(), { headers: { 'Authorization': getAuthHeader(integration.credentials) } }),
                    fetch(pagesUrl.toString(), { headers: { 'Authorization': getAuthHeader(integration.credentials) } })
                ]);

                if (!postsResponse.ok) console.error(`Failed to fetch posts: ${await postsResponse.text()}`);
                if (!pagesResponse.ok) console.error(`Failed to fetch pages: ${await pagesResponse.text()}`);

                const posts = postsResponse.ok ? await postsResponse.json() : [];
                const pages = pagesResponse.ok ? await pagesResponse.json() : [];

                const items = [
                    ...posts.map(p => ({ id: p.id, title: p.title.rendered, type: 'post', date: p.date_gmt })),
                    ...pages.map(p => ({ id: p.id, title: p.title.rendered, type: 'page', date: p.date_gmt }))
                ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                return new Response(JSON.stringify({ success: true, data: { items } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });


            case 'get_content':
                 // ... (get_content logic unchanged)
                if (!postId) throw new Error('postId is required');
                let response = await fetch(`${integration.site_url}/wp-json/wp/v2/posts/${postId}?context=edit`, {
                    headers: { 'Authorization': getAuthHeader(integration.credentials) }
                });

                if (!response.ok) {
                    response = await fetch(`${integration.site_url}/wp-json/wp/v2/pages/${postId}?context=edit`, {
                        headers: { 'Authorization': getAuthHeader(integration.credentials) }
                    });
                }

                if (!response.ok) throw new Error(`Could not find post or page with ID ${postId}. Details: ${await response.text()}`);

                const postData = await response.json();
                return new Response(JSON.stringify({ success: true, data: { title: postData.title.raw, content: postData.content.raw } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

            case 'update_content':
                 // ... (update_content logic unchanged)
                if (!postId || !content) throw new Error('postId and content are required');
                let updateResponse = await fetch(`${integration.site_url}/wp-json/wp/v2/posts/${postId}`, {
                    method: 'POST',
                    headers: { 'Authorization': getAuthHeader(integration.credentials), 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: title, content: content })
                });

                if (!updateResponse.ok) {
                    const errorText = await updateResponse.text();
                    if (errorText.includes('rest_post_invalid_id')) {
                         updateResponse = await fetch(`${integration.site_url}/wp-json/wp/v2/pages/${postId}`, {
                            method: 'POST',
                            headers: { 'Authorization': getAuthHeader(integration.credentials), 'Content-Type': 'application/json' },
                            body: JSON.stringify({ title: title, content: content })
                        });
                    } else {
                        throw new Error(errorText);
                    }
                }

                if (!updateResponse.ok) throw new Error(await updateResponse.text());
                const updatedPost = await updateResponse.json();
                return new Response(JSON.stringify({ success: true, data: updatedPost }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

            case 'disconnect':
                // ... (disconnect logic unchanged)
                await supabase.from('cms_integrations').delete().eq('user_id', user.id).eq('cms_type', 'wordpress');
                return new Response(JSON.stringify({ success: true, message: 'WordPress integration disconnected' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

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
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }
    const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    return await wordpressService(req, supabase);
});
