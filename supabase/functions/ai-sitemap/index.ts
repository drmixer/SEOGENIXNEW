import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, fail } from "./response.ts";

// --- CORS Headers ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE'
};

type AISitemapItem = {
  url: string;
  lastUpdated?: string;
  summary?: string | null;
  entities?: string[];
  schema?: { applied?: boolean; valid?: boolean; types?: string[]; issuesCount?: number };
};

async function fetchPrerenderedText(url: string): Promise<string | null> {
  try {
    const u = url.startsWith('http') ? url : `https://${url}`;
    const res = await fetch(`https://r.jina.ai/${u}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (SEOGENIX/ai-sitemap)' }
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text.slice(0, 4000);
  } catch {
    return null;
  }
}

function summarize(text: string | null): string | null {
  if (!text) return null;
  const firstLine = text.split(/\n|\.\s/).map(s => s.trim()).find(Boolean);
  if (!firstLine) return null;
  return firstLine.slice(0, 220);
}

export default {};

export const aiSitemapService = async (req: Request, supabase: any) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    const body = await req.json();
    const projectId: string = body?.projectId;
    const urls: string[] | undefined = body?.urls;
    const fetchContent: boolean = !!body?.fetch;
    if (!projectId) {
      return new Response(JSON.stringify(fail('`projectId` is required', 'BAD_REQUEST')), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Get project root/site URL (if available)
    let siteUrl: string | undefined;
    try {
      const { data: project } = await supabase.from('projects').select('url,name').eq('id', projectId).single();
      siteUrl = project?.url;
    } catch {}

    // Build candidate URL list from inputs and recent activity
    let candidateUrls: string[] = Array.isArray(urls) ? urls.filter(Boolean) : [];
    if (candidateUrls.length === 0) {
      const { data: activities } = await supabase
        .from('user_activity')
        .select('website_url, activity_type, activity_data, created_at, tool_id')
        .eq('tool_id', projectId)
        .in('activity_type', ['post_publish_validation', 'schema_draft', 'entities_draft'])
        .order('created_at', { ascending: false })
        .limit(300);
      const urlsSet = new Set<string>();
      for (const a of activities || []) {
        if (a?.website_url) urlsSet.add(a.website_url);
        const maybePermalink = a?.activity_data?.permalink;
        if (maybePermalink) urlsSet.add(maybePermalink);
      }
      candidateUrls = Array.from(urlsSet).slice(0, 100);
    }

    // Load drafts/validation status maps for quick lookup
    const { data: draftsData } = await supabase
      .from('user_activity')
      .select('website_url, activity_data, created_at')
      .eq('tool_id', projectId)
      .eq('activity_type', 'schema_draft')
      .order('created_at', { ascending: false })
      .limit(1000);
    const draftMap = new Map<string, any>();
    for (const d of draftsData || []) {
      const key = String(d.website_url || '').trim();
      if (key && !draftMap.has(key)) draftMap.set(key, d);
    }

    const { data: entitiesData } = await supabase
      .from('user_activity')
      .select('website_url, activity_data, created_at')
      .eq('tool_id', projectId)
      .eq('activity_type', 'entities_draft')
      .order('created_at', { ascending: false })
      .limit(1000);
    const entitiesMap = new Map<string, any>();
    for (const e of entitiesData || []) {
      const key = String(e.website_url || '').trim();
      if (key && !entitiesMap.has(key)) entitiesMap.set(key, e);
    }

    const { data: postpubData } = await supabase
      .from('user_activity')
      .select('website_url, activity_data, created_at')
      .eq('tool_id', projectId)
      .eq('activity_type', 'post_publish_validation')
      .order('created_at', { ascending: false })
      .limit(1000);
    const postpubMap = new Map<string, any>();
    for (const p of postpubData || []) {
      const key = String(p.website_url || '').trim();
      if (key && !postpubMap.has(key)) postpubMap.set(key, p);
    }

    const items: AISitemapItem[] = [];
    for (const url of candidateUrls) {
      const key = String(url || '').trim();
      if (!key) continue;
      const draft = draftMap.get(key)?.activity_data;
      const ent = entitiesMap.get(key)?.activity_data;
      const post = postpubMap.get(key)?.activity_data;
      let summary: string | null = null;
      if (fetchContent) {
        const text = await fetchPrerenderedText(key);
        summary = summarize(text);
      }
      const lastUpdated = postpubMap.get(key)?.created_at || draftMap.get(key)?.created_at || entitiesMap.get(key)?.created_at;
      const schema: AISitemapItem['schema'] = {
        applied: !!draft?.applied,
        valid: typeof draft?.valid === 'boolean' ? draft.valid : (typeof post?.schemaValid === 'boolean' ? post.schemaValid : undefined),
        types: Array.isArray(draft?.schema?.['@type']) ? draft.schema['@type'] : (draft?.schema?.['@type'] ? [draft.schema['@type']] : undefined),
        issuesCount: Array.isArray(draft?.issues) ? draft.issues.length : (typeof post?.issueCount === 'number' ? post.issueCount : undefined)
      };
      const entities = Array.isArray(ent?.accepted) ? ent.accepted.filter(Boolean).slice(0, 50) : undefined;
      items.push({ url: key, lastUpdated, summary, entities, schema });
    }

    const out = {
      site: siteUrl || null,
      projectId,
      generatedAt: new Date().toISOString(),
      items
    };

    return new Response(JSON.stringify(ok(out)), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify(fail(msg, 'SERVER_ERROR')), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
};

// --- Server ---
Deno.serve(async (req) => {
  const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
  return aiSitemapService(req, supabase);
});
