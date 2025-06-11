import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

interface WordPressRequest {
  action: 'connect' | 'publish' | 'sync' | 'disconnect';
  siteUrl?: string;
  username?: string;
  applicationPassword?: string;
  content?: {
    title: string;
    content: string;
    excerpt?: string;
    status?: 'draft' | 'publish';
    categories?: string[];
    tags?: string[];
  };
  postId?: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { action, siteUrl, username, applicationPassword, content, postId }: WordPressRequest = await req.json();
    
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

    switch (action) {
      case 'connect':
        if (!siteUrl || !username || !applicationPassword) {
          throw new Error('Site URL, username, and application password required');
        }

        // Test WordPress connection
        const testResponse = await fetch(`${siteUrl}/wp-json/wp/v2/users/me`, {
          headers: {
            'Authorization': `Basic ${btoa(`${username}:${applicationPassword}`)}`,
            'Content-Type': 'application/json'
          }
        });

        if (!testResponse.ok) {
          throw new Error('Failed to connect to WordPress. Please check your credentials.');
        }

        const userInfo = await testResponse.json();

        // Store integration in database
        const { data: integration, error } = await supabase
          .from('cms_integrations')
          .upsert({
            user_id: user.id,
            cms_type: 'wordpress',
            cms_name: `WordPress - ${new URL(siteUrl).hostname}`,
            site_url: siteUrl,
            status: 'connected',
            credentials: {
              username,
              application_password: applicationPassword // In production, encrypt this
            },
            settings: {
              user_info: userInfo,
              capabilities: userInfo.capabilities || {}
            },
            last_sync_at: new Date().toISOString()
          })
          .select()
          .single();

        if (error) throw error;

        return new Response(
          JSON.stringify({
            success: true,
            message: 'WordPress integration connected successfully',
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
        if (!content) {
          throw new Error('Content is required for publishing');
        }

        // Get WordPress integration
        const { data: wpIntegration } = await supabase
          .from('cms_integrations')
          .select('*')
          .eq('user_id', user.id)
          .eq('cms_type', 'wordpress')
          .single();

        if (!wpIntegration) {
          throw new Error('WordPress integration not found');
        }

        const credentials = wpIntegration.credentials as any;
        
        // Publish to WordPress
        const publishResponse = await fetch(`${wpIntegration.site_url}/wp-json/wp/v2/posts`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(`${credentials.username}:${credentials.application_password}`)}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            title: content.title,
            content: content.content,
            excerpt: content.excerpt || '',
            status: content.status || 'draft',
            categories: content.categories || [],
            tags: content.tags || []
          })
        });

        if (!publishResponse.ok) {
          const errorText = await publishResponse.text();
          throw new Error(`Failed to publish to WordPress: ${errorText}`);
        }

        const publishedPost = await publishResponse.json();

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Content published to WordPress successfully',
            post: {
              id: publishedPost.id,
              title: publishedPost.title.rendered,
              url: publishedPost.link,
              status: publishedPost.status
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      case 'sync':
        // Sync recent posts from WordPress
        const { data: syncIntegration } = await supabase
          .from('cms_integrations')
          .select('*')
          .eq('user_id', user.id)
          .eq('cms_type', 'wordpress')
          .single();

        if (!syncIntegration) {
          throw new Error('WordPress integration not found');
        }

        const syncCredentials = syncIntegration.credentials as any;
        
        const postsResponse = await fetch(`${syncIntegration.site_url}/wp-json/wp/v2/posts?per_page=10`, {
          headers: {
            'Authorization': `Basic ${btoa(`${syncCredentials.username}:${syncCredentials.application_password}`)}`,
            'Content-Type': 'application/json'
          }
        });

        if (!postsResponse.ok) {
          throw new Error('Failed to sync posts from WordPress');
        }

        const posts = await postsResponse.json();

        // Update last sync time
        await supabase
          .from('cms_integrations')
          .update({ last_sync_at: new Date().toISOString() })
          .eq('id', syncIntegration.id);

        return new Response(
          JSON.stringify({
            success: true,
            message: 'WordPress sync completed',
            posts: posts.map((post: any) => ({
              id: post.id,
              title: post.title.rendered,
              url: post.link,
              status: post.status,
              date: post.date
            }))
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      case 'disconnect':
        // Remove WordPress integration
        const { error: deleteError } = await supabase
          .from('cms_integrations')
          .delete()
          .eq('user_id', user.id)
          .eq('cms_type', 'wordpress');

        if (deleteError) throw deleteError;

        return new Response(
          JSON.stringify({
            success: true,
            message: 'WordPress integration disconnected successfully'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      default:
        throw new Error('Invalid action');
    }

  } catch (error) {
    console.error('WordPress integration error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'WordPress integration failed',
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});