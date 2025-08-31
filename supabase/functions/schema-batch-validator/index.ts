import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, fail } from "./response.ts";

// --- CORS Headers ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE'
};

type Issue = { path?: string; message: string };

function validateSchemaObject(obj: any): Issue[] {
  const issues: Issue[] = [];
  if (!obj || typeof obj !== 'object') {
    issues.push({ message: 'Schema must be an object' });
    return issues;
  }
  if (obj['@context'] !== 'https://schema.org') {
    issues.push({ path: '@context', message: 'Missing or invalid @context (should be https://schema.org)' });
  }
  if (!obj['@type']) {
    issues.push({ path: '@type', message: 'Missing @type' });
  }
  const type = String(obj['@type'] || '').toLowerCase();
  if (type === 'article' || type === 'blogposting') {
    if (!obj.headline) issues.push({ path: 'headline', message: 'Article requires headline' });
    if (!obj.articleBody) issues.push({ path: 'articleBody', message: 'Article should include articleBody' });
  } else if (type === 'product') {
    if (!obj.name) issues.push({ path: 'name', message: 'Product requires name' });
    if (!obj.description) issues.push({ path: 'description', message: 'Product should include description' });
  } else if (type === 'faqpage') {
    if (!Array.isArray(obj.mainEntity) || obj.mainEntity.length === 0) {
      issues.push({ path: 'mainEntity', message: 'FAQPage requires mainEntity with Question[]' });
    }
  }
  return issues;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { projectId, urls } = await req.json();
    if (!projectId) {
      return new Response(JSON.stringify(fail('`projectId` is required.', 'BAD_REQUEST')), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    // Resolve user (for persisting activity)
    let userId: string | null = null;
    try {
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabase.auth.getUser(token);
        userId = user?.id || null;
      }
    } catch {}
    // Fetch latest schema drafts per URL
    let query = supabase
      .from('user_activity')
      .select('website_url, activity_data, created_at')
      .eq('tool_id', projectId)
      .eq('activity_type', 'schema_draft')
      .order('created_at', { ascending: false });
    const { data, error } = await query;
    if (error) throw error;
    const byUrl = new Map<string, any>();
    (data || []).forEach((row: any) => {
      if (!row.website_url) return;
      if (urls && Array.isArray(urls) && urls.length && !urls.includes(row.website_url)) return;
      if (!byUrl.has(row.website_url)) byUrl.set(row.website_url, row.activity_data?.schema || null);
    });

    const results: Array<{ url: string; valid: boolean; issues: Issue[] }> = [];
    for (const [url, schema] of byUrl.entries()) {
      const obj = typeof schema === 'string' ? (() => { try { return JSON.parse(schema); } catch { return null; } })() : schema;
      const issues = validateSchemaObject(obj);
      results.push({ url, valid: issues.length === 0, issues });
    }
    // Persist a summary activity for auditing/alerts
    try {
      if (userId) {
        const summary = {
          total: results.length,
          valid: results.filter(r => r.valid).length,
          invalid: results.filter(r => !r.valid).length,
        };
        await supabase.from('user_activity').insert({
          user_id: userId,
          tool_id: projectId,
          activity_type: 'schema_validation_batch',
          activity_data: { summary, results, executedAt: new Date().toISOString() },
          created_at: new Date().toISOString()
        });
      }
    } catch {}

    return new Response(JSON.stringify(ok({ results })), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify(fail(msg, 'SERVER_ERROR')), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
