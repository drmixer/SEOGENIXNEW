import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function wordpressIntegrationHandler(
  supabase: SupabaseClient,
  req: Request,
  input: any
) {
  const { action, siteUrl, username, applicationPassword, content, postId } = input;

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw new Error('Authorization header required');
  const token = authHeader.replace('Bearer ', '');
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) throw new Error('Invalid authentication');

  const getWpApiUrl = async (userId: string) => {
      if (siteUrl) return `${siteUrl}/wp-json/wp/v2`;
      const { data: integration } = await supabase.from('cms_integrations').select('site_url').eq('user_id', userId).eq('cms_type', 'wordpress').single();
      if (!integration) throw new Error('WordPress integration not found');
      return `${integration.site_url}/wp-json/wp/v2`;
  };

  const getAuthHeader = async (userId: string) => {
      if (username && applicationPassword) return `Basic ${btoa(`${username}:${applicationPassword}`)}`;
      const { data: integration } = await supabase.from('cms_integrations').select('credentials').eq('user_id', userId).eq('cms_type', 'wordpress').single();
      if (!integration) throw new Error('WordPress integration not found');
      return `Basic ${btoa(`${integration.credentials.username}:${integration.credentials.application_password}`)}`;
  }

  switch (action) {
    case 'connect': {
      if (!siteUrl || !username || !applicationPassword) throw new Error('Site URL, username, and application password required');
      const testResponse = await fetch(`${siteUrl}/wp-json/wp/v2/users/me`, {
        headers: { 'Authorization': `Basic ${btoa(`${username}:${applicationPassword}`)}`, 'Content-Type': 'application/json' }
      });
      if (!testResponse.ok) throw new Error('Failed to connect to WordPress.');
      const userInfo = await testResponse.json();
      const { data: integration, error } = await supabase.from('cms_integrations').upsert({
        user_id: user.id,
        cms_type: 'wordpress',
        cms_name: `WordPress - ${new URL(siteUrl).hostname}`,
        site_url: siteUrl,
        status: 'connected',
        credentials: { username, application_password: applicationPassword },
      }).select().single();
      if (error) throw error;
      return { success: true, message: 'WordPress connected.', integration };
    }
    case 'publish': {
      if (!content) throw new Error('Content is required for publishing');
      const apiUrl = await getWpApiUrl(user.id);
      const auth = await getAuthHeader(user.id);
      const publishResponse = await fetch(`${apiUrl}/posts`, {
        method: 'POST',
        headers: { 'Authorization': auth, 'Content-Type': 'application/json' },
        body: JSON.stringify(content)
      });
      if (!publishResponse.ok) throw new Error(`Failed to publish to WordPress: ${await publishResponse.text()}`);
      const publishedPost = await publishResponse.json();
      return { success: true, message: 'Content published.', post: publishedPost };
    }
    case 'sync': {
        const apiUrl = await getWpApiUrl(user.id);
        const auth = await getAuthHeader(user.id);
        const postsResponse = await fetch(`${apiUrl}/posts?per_page=10`, {
            headers: { 'Authorization': auth, 'Content-Type': 'application/json' }
        });
        if (!postsResponse.ok) throw new Error('Failed to sync posts from WordPress');
        const posts = await postsResponse.json();
        await supabase.from('cms_integrations').update({ last_sync_at: new Date().toISOString() }).eq('user_id', user.id).eq('cms_type', 'wordpress');
        return { success: true, message: 'Sync completed.', posts };
    }
    case 'disconnect': {
      const { error } = await supabase.from('cms_integrations').delete().eq('user_id', user.id).eq('cms_type', 'wordpress');
      if (error) throw error;
      return { success: true, message: 'WordPress disconnected.' };
    }
    default:
      throw new Error('Invalid action');
  }
}
