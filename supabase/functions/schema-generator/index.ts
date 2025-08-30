// --- CORS Headers ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE'
};

function toPlain(text: string): string {
  try {
    // Very light HTML strip
    const withoutTags = text.replace(/<[^>]*>/g, ' ');
    return withoutTags.replace(/\s+/g, ' ').trim();
  } catch {
    return (text || '').toString();
  }
}

function pickHeadline(content?: string): string | undefined {
  if (!content) return undefined;
  // try to find <h1>
  const h1 = content.match(/<h1[^>]*>(.*?)<\/h1>/i);
  if (h1 && h1[1]) return toPlain(h1[1]).slice(0, 110);
  // fallback to first non-empty line
  const firstLine = toPlain(content).split(/\n|\.\s/).map(s => s.trim()).find(Boolean);
  return firstLine ? firstLine.slice(0, 110) : undefined;
}

function buildArticle(url?: string, content?: string, acceptedEntities?: string[]) {
  const articleBody = toPlain(content || '');
  const headline = pickHeadline(content) || 'Article';
  const about = Array.isArray(acceptedEntities) && acceptedEntities.length
    ? acceptedEntities.map(name => ({ '@type': 'Thing', name })).slice(0, 20)
    : undefined;
  const schema: any = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline,
    datePublished: new Date().toISOString(),
    mainEntityOfPage: url ? { '@type': 'WebPage', '@id': url } : undefined,
    articleBody
  };
  if (about) schema.about = about;
  return schema;
}

function buildFAQ(url?: string, content?: string) {
  // Very lightweight Q&A detection: lines starting with Q: / A:
  const lines = toPlain(content || '').split(/\n+/);
  const pairs: Array<{ q: string; a: string }> = [];
  let q: string | null = null;
  for (const line of lines) {
    if (/^q[:\-]/i.test(line)) {
      q = line.replace(/^q[:\-]\s*/i, '');
    } else if (/^a[:\-]/i.test(line)) {
      const a = line.replace(/^a[:\-]\s*/i, '');
      if (q) {
        pairs.push({ q, a });
        q = null;
      }
    }
  }
  const mainEntity = pairs.map(p => ({
    '@type': 'Question',
    name: p.q,
    acceptedAnswer: { '@type': 'Answer', text: p.a }
  }));
  const schema: any = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity
  };
  if (url) schema.mainEntityOfPage = { '@type': 'WebPage', '@id': url };
  return schema;
}

function buildProduct(url?: string, content?: string, acceptedEntities?: string[]) {
  const description = toPlain(content || '');
  const name = pickHeadline(content) || 'Product';
  const schema: any = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description
  };
  if (Array.isArray(acceptedEntities) && acceptedEntities.length) {
    schema.brand = { '@type': 'Brand', name: acceptedEntities[0] };
  }
  if (url) schema.mainEntityOfPage = { '@type': 'WebPage', '@id': url };
  return schema;
}

function stringifyImplementation(obj: unknown): string {
  const json = JSON.stringify(obj, null, 2);
  return `<script type="application/ld+json">\n${json}\n</script>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const {
      url,
      contentType = 'Article',
      content = '',
      acceptedEntities
    } = body || {};

    let schema: any;
    const typeNorm = String(contentType || 'Article').toLowerCase();
    if (typeNorm.includes('faq')) {
      schema = buildFAQ(url, content);
    } else if (typeNorm.includes('product')) {
      schema = buildProduct(url, content, acceptedEntities);
    } else {
      schema = buildArticle(url, content, acceptedEntities);
    }

    const implementation = stringifyImplementation(schema);
    const response = {
      success: true,
      output: {
        schema,
        implementation,
        schemaType: schema['@type'] || contentType,
        instructions: 'Place JSON-LD in your HTML head or body once per page.'
      }
    };
    return new Response(JSON.stringify(response), {
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

