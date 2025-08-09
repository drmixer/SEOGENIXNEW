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
        const { action, siteUrl, username, applicationPassword, content } = await req.json();

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('Authorization header required');
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabase.auth.getUser(token);
        if (!user) throw new Error('Invalid authentication');

        switch(action) {
            case 'connect':
                if (!siteUrl || !username || !applicationPassword) throw new Error('Site URL, username, and application password required');
                const testResponse = await fetch(`${siteUrl}/wp-json/wp/v2/users/me`, { headers: { 'Authorization': `Basic ${btoa(`${username}:${applicationPassword}`)}` } });
                if (!testResponse.ok) throw new Error('Failed to connect to WordPress');
                const userInfo = await testResponse.json();

                const { data: integration, error } = await supabase.from('cms_integrations').upsert({ user_id: user.id, cms_type: 'wordpress', cms_name: `WordPress - ${new URL(siteUrl).hostname}`, site_url: siteUrl, status: 'connected', credentials: { username, application_password: applicationPassword } }).select().single();
                if (error) throw error;

                return new Response(JSON.stringify({ success: true, integration }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

            case 'publish':
                if (!content) throw new Error('Content is required');
                const { data: wpIntegration } = await supabase.from('cms_integrations').select('*').eq('user_id', user.id).eq('cms_type', 'wordpress').single();
                if (!wpIntegration) throw new Error('WordPress integration not found');

                const pubResponse = await fetch(`${wpIntegration.site_url}/wp-json/wp/v2/posts`, {
                    method: 'POST',
                    headers: { 'Authorization': `Basic ${btoa(`${wpIntegration.credentials.username}:${wpIntegration.credentials.application_password}`)}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: content.title, content: content.content, status: content.status || 'draft' })
                });
                if (!pubResponse.ok) throw new Error(await pubResponse.text());
                const publishedPost = await pubResponse.json();

                return new Response(JSON.stringify({ success: true, post: publishedPost }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

            case 'disconnect':
                await supabase.from('cms_integrations').delete().eq('user_id', user.id).eq('cms_type', 'wordpress');
                return new Response(JSON.stringify({ success: true, message: 'WordPress integration disconnected' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

            default:
                throw new Error('Invalid action');
        }

    } catch (err) {
        console.error('WordPress integration error:', err.message);
        return new Response(JSON.stringify({ error: 'WordPress integration failed', details: err.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
