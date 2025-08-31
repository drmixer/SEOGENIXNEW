import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, fail } from "./response.ts";

// --- CORS Headers ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE'
};

type Provider = 'openai' | 'perplexity' | 'bing' | 'google';

async function callOpenAI(query: string, apiKey?: string) {
  if (!apiKey) return { provider: 'openai', skipped: true, reason: 'OPENAI_API_KEY missing' };
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are evaluating whether the brand/site is mentioned and whether a source is cited. Keep answers short.' },
          { role: 'user', content: query }
        ],
        temperature: 0.2,
        max_tokens: 256
      })
    });
    if (!res.ok) {
      const body = await res.text().catch(()=> '');
      return { provider: 'openai', error: `HTTP ${res.status} ${res.statusText} ${body.slice(0,200)}` };
    }
    const data = await res.json();
    const msg = data?.choices?.[0]?.message?.content || '';
    return { provider: 'openai', response: msg };
  } catch (e: any) {
    return { provider: 'openai', error: e?.message || 'request failed' };
  }
}

async function callPerplexity(query: string, apiKey?: string) {
  if (!apiKey) return { provider: 'perplexity', skipped: true, reason: 'PERPLEXITY_API_KEY missing' };
  try {
    const res = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'sonar',
        messages: [{ role: 'user', content: query }],
        temperature: 0.2,
        max_tokens: 256
      })
    });
    if (!res.ok) {
      const body = await res.text().catch(()=> '');
      return { provider: 'perplexity', error: `HTTP ${res.status} ${res.statusText} ${body.slice(0,200)}` };
    }
    const data = await res.json();
    const msg = data?.choices?.[0]?.message?.content || '';
    return { provider: 'perplexity', response: msg };
  } catch (e: any) {
    return { provider: 'perplexity', error: e?.message || 'request failed' };
  }
}

async function callBingWeb(query: string, key?: string) {
  if (!key) return { provider: 'bing', skipped: true, reason: 'BING_SUBSCRIPTION_KEY missing' };
  try {
    const res = await fetch(`https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}`, {
      headers: { 'Ocp-Apim-Subscription-Key': key }
    });
    if (!res.ok) {
      const body = await res.text().catch(()=> '');
      return { provider: 'bing', error: `HTTP ${res.status} ${res.statusText} ${body.slice(0,200)}` };
    }
    const data = await res.json();
    const snippet = data?.webPages?.value?.[0]?.snippet || '';
    const url = data?.webPages?.value?.[0]?.url || '';
    return { provider: 'bing', response: snippet, citationUrl: url };
  } catch (e: any) {
    return { provider: 'bing', error: e?.message || 'request failed' };
  }
}

async function callGoogleCSE(query: string, apiKey?: string, cx?: string) {
  if (!apiKey || !cx) return { provider: 'google', skipped: true, reason: 'GOOGLE_SEARCH_API_KEY/ENGINE_ID missing' };
  try {
    const res = await fetch(`https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&key=${apiKey}&cx=${cx}`);
    if (!res.ok) {
      const body = await res.text().catch(()=> '');
      return { provider: 'google', error: `HTTP ${res.status} ${res.statusText} ${body.slice(0,200)}` };
    }
    const data = await res.json();
    const snippet = data?.items?.[0]?.snippet || '';
    const link = data?.items?.[0]?.link || '';
    return { provider: 'google', response: snippet, citationUrl: link };
  } catch (e: any) {
    return { provider: 'google', error: e?.message || 'request failed' };
  }
}

export const assistantTestbenchService = async (req: Request, supabase: any) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    const body = await req.json();
    const projectId: string = body?.projectId;
    const query: string = body?.query || '';
    const providers: Provider[] = Array.isArray(body?.providers) ? body.providers : ['openai','google'];
    if (!projectId || !query) {
      return new Response(JSON.stringify(fail('`projectId` and `query` are required', 'BAD_REQUEST')), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // resolve plan for gating later if needed
    let runId: string | null = null;
    try {
      const { data, error } = await supabase.from('tool_runs').insert({
        project_id: projectId,
        tool_name: 'assistant-testbench',
        input_payload: { query, providers },
        status: 'running',
        created_at: new Date().toISOString()
      }).select('id').single();
      if (!error) runId = data?.id || null;
    } catch {}

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
    const BING_SUBSCRIPTION_KEY = Deno.env.get('BING_SUBSCRIPTION_KEY');
    const GOOGLE_SEARCH_API_KEY = Deno.env.get('GOOGLE_SEARCH_API_KEY');
    const GOOGLE_SEARCH_ENGINE_ID = Deno.env.get('GOOGLE_SEARCH_ENGINE_ID');

    const tasks: Promise<any>[] = [];
    for (const p of providers) {
      if (p === 'openai') tasks.push(callOpenAI(query, OPENAI_API_KEY));
      else if (p === 'perplexity') tasks.push(callPerplexity(query, PERPLEXITY_API_KEY));
      else if (p === 'bing') tasks.push(callBingWeb(query, BING_SUBSCRIPTION_KEY));
      else if (p === 'google') tasks.push(callGoogleCSE(query, GOOGLE_SEARCH_API_KEY, GOOGLE_SEARCH_ENGINE_ID));
    }
    const raw = await Promise.all(tasks);
    const results = raw.map((r) => ({
      assistant: r.provider || 'unknown',
      query,
      response: r.response || '',
      mentioned: !!(r.response || r.citationUrl),
      ranking: r.ranking || null,
      confidence: typeof r.confidence === 'number' ? r.confidence : (r.response ? 70 : 0),
      citationUrl: r.citationUrl,
      error: r.error,
      skipped: r.skipped,
      reason: r.reason
    }));

    if (runId) {
      try { await supabase.from('tool_runs').update({ status: 'completed', output_payload: { results } }).eq('id', runId); } catch {}
    }

    return new Response(JSON.stringify(ok({ results })), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify(fail(msg, 'SERVER_ERROR')), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
};

// --- Server ---
Deno.serve(async (req) => {
  const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
  return assistantTestbenchService(req, supabase);
});
