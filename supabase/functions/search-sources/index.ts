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

