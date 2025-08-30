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
    const body = await req.json().catch(() => ({}));
    const raw = body?.schema ?? body?.json ?? body?.markup;
    let obj: any = null;
    if (typeof raw === 'string') {
      try { obj = JSON.parse(raw); } catch (e) {
        return new Response(JSON.stringify({ success: true, output: { valid: false, issues: [{ message: 'Invalid JSON string' }] } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    } else if (raw && typeof raw === 'object') {
      obj = raw;
    } else {
      return new Response(JSON.stringify({ success: true, output: { valid: false, issues: [{ message: 'Missing schema payload' }] } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const issues = validateSchemaObject(obj);
    const valid = issues.length === 0;
    return new Response(JSON.stringify({ success: true, output: { valid, issues } }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: { message: msg } }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

