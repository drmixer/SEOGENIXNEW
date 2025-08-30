// --- CORS Headers ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// Minimal text fetch using Jina Reader proxy for prerendered/extracted content
// Docs: https://r.jina.ai/http://example.com returns cleaned page text
async function fetchPrerenderedText(url: string): Promise<string> {
  const readerUrl = url.startsWith('http') ? `https://r.jina.ai/${url}` : `https://r.jina.ai/https://${url}`;
  const res = await fetch(readerUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
    }
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Prerender fetch failed: ${res.status} ${res.statusText} ${body?.slice(0, 200)}`);
  }
  return await res.text();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    if (!url) throw new Error('URL is required.');

    const text = await fetchPrerenderedText(url);

    return new Response(
      JSON.stringify({ success: true, data: { content: text } }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: { message } }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

