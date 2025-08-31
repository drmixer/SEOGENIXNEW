// --- CORS Headers ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE'
};

type SearchResult = { title: string; url: string; snippet?: string };

async function searchDuckDuckGo(query: string): Promise<SearchResult[]> {
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=us-en`; // simple HTML results
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`DDG search failed: ${res.status}`);
  const html = await res.text();
  // Very lightweight parse: look for result links
  const results: SearchResult[] = [];
  const regex = /<a rel="nofollow" class="result__a" href="(.*?)"[^>]*>(.*?)<\/a>/g;
  let match: RegExpExecArray | null;
  let count = 0;
  while ((match = regex.exec(html)) && count < 5) {
    const url = match[1];
    const title = match[2]?.replace(/<[^>]*>/g, '').trim();
    if (url && title) {
      results.push({ title, url });
      count++;
    }
  }
  return results;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    const { query } = await req.json();
    if (!query || String(query).trim().length < 2) {
      return new Response(JSON.stringify({ success: true, data: { results: [] } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const results = await searchDuckDuckGo(String(query));
    return new Response(JSON.stringify({ success: true, data: { results } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('search-sources error', e);
    return new Response(JSON.stringify({ success: false, error: { message: e?.message || 'Search failed' } }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
// Lightweight source search via DuckDuckGo HTML (no API key)
// verify_jwt = false in supabase/config.toml so this can be called from the browser

// --- CORS Headers ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE'
};

function extractResults(html: string): Array<{ title: string; url: string; snippet?: string }> {
  const results: Array<{ title: string; url: string; snippet?: string }> = [];
  try {
    // Basic parsing using regex; DuckDuckGo HTML uses result__a anchor links
    const containerRegex = /<a[^>]*class="[^">]*result__a[^">]*"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>[\s\S]*?<a[^>]*class="[^" >]*result__snippet[^" >]*"[^>]*>(.*?)<\/a>/gi;
    let m: RegExpExecArray | null;
    while ((m = containerRegex.exec(html)) && results.length < 5) {
      const url = m[1];
      const title = m[2].replace(/<[^>]*>/g, '').trim();
      const snippet = m[3].replace(/<[^>]*>/g, '').trim();
      if (url && title) results.push({ title, url, snippet });
    }
    // Fallback: try a simpler anchor selector if none found
    if (results.length === 0) {
      const simpleRegex = /<a[^>]*class="[^" >]*result__a[^" >]*"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi;
      let s: RegExpExecArray | null;
      while ((s = simpleRegex.exec(html)) && results.length < 5) {
        const url = s[1];
        const title = s[2].replace(/<[^>]*>/g, '').trim();
        if (url && title) results.push({ title, url });
      }
    }
  } catch (_) {}
  return results;
}

async function searchDuckDuckGo(query: string) {
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
    }
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Search failed: ${res.status} ${res.statusText} ${body.slice(0, 200)}`);
  }
  const html = await res.text();
  return extractResults(html);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    const { query } = await req.json();
    if (!query || String(query).trim().length < 2) {
      return new Response(JSON.stringify({ success: true, data: { results: [] } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const results = await searchDuckDuckGo(String(query));
    return new Response(JSON.stringify({ success: true, data: { results } }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: { message: msg } }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

