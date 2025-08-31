import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, fail } from "./response.ts";
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

function buildHowTo(url?: string, content?: string) {
  const lines = toPlain(content || '').split(/\n+/);
  const steps = lines
    .map(l => l.trim())
    .filter(l => /^\d+\./.test(l))
    .map(l => l.replace(/^\d+\.\s*/, ''))
    .map(text => ({ '@type': 'HowToStep', text }));
  const name = pickHeadline(content) || 'HowTo';
  const schema: any = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name,
    step: steps
  };
  if (url) schema.mainEntityOfPage = { '@type': 'WebPage', '@id': url };
  return schema;
}

function stringifyImplementation(obj: unknown): string {
  const json = JSON.stringify(obj, null, 2);
  return `<script type="application/ld+json">\n${json}\n</script>`;
}

// Simple structural validation and type-specific checks
function quickValidate(obj: any): { valid: boolean; issues: Array<{ path?: string; message: string }> } {
  const issues: Array<{ path?: string; message: string }> = [];
  if (!obj || typeof obj !== 'object') {
    return { valid: false, issues: [{ message: 'Schema must be an object' }] };
  }
  if (obj['@context'] !== 'https://schema.org') {
    issues.push({ path: '@context', message: 'Missing or invalid @context (https://schema.org)' });
  }
  if (!obj['@type']) {
    issues.push({ path: '@type', message: 'Missing @type' });
  }
  const type = String(obj['@type'] || '').toLowerCase();
  if (type === 'article') {
    if (!obj.headline) issues.push({ path: 'headline', message: 'Missing headline' });
    if (!obj.datePublished) issues.push({ path: 'datePublished', message: 'Missing datePublished' });
    if (!obj.articleBody || !String(obj.articleBody).trim()) {
      issues.push({ path: 'articleBody', message: 'Missing articleBody' });
    }
  } else if (type === 'faqpage') {
    if (!Array.isArray(obj.mainEntity) || obj.mainEntity.length === 0) {
      issues.push({ path: 'mainEntity', message: 'FAQ requires at least one Q/A' });
    }
  } else if (type === 'product') {
    if (!obj.name) issues.push({ path: 'name', message: 'Missing product name' });
    if (!obj.description) issues.push({ path: 'description', message: 'Missing product description' });
  } else if (type === 'howto') {
    if (!Array.isArray(obj.step) || obj.step.length === 0) {
      issues.push({ path: 'step', message: 'HowTo requires at least one step' });
    }
  }
  return { valid: issues.length === 0, issues };
}

async function validateWithFunction(supabase: any, schema: any) {
  try {
    const { data, error } = await supabase.functions.invoke('schema-validator', {
      body: { schema }
    });
    if (error) throw error;
    return data?.output || data || { valid: true, issues: [] };
  } catch {
    // If validator function is unavailable, fall back to quick validation
    return quickValidate(schema);
  }
}

async function runLLM(url: string, contentType: string, pageContent: string, geminiApiKey: string) {
  const schemas: Record<string, string> = {
    Article: `{
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": "string",
      "author": { "@type": "Person", "name": "string" },
      "datePublished": "string",
      "image": "string",
      "publisher": { "@type": "Organization", "name": "string", "logo": { "@type": "ImageObject", "url": "string" } }
    }`,
    FAQPage: `{
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [ { "@type": "Question", "name": "string", "acceptedAnswer": { "@type": "Answer", "text": "string" } } ]
    }`,
    HowTo: `{
      "@context": "https://schema.org",
      "@type": "HowTo",
      "name": "string",
      "totalTime": "string",
      "step": [ { "@type": "HowToStep", "text": "string", "name": "string" } ]
    }`,
    Product: `{
      "@context": "https://schema.org",
      "@type": "Product",
      "name": "string",
      "description": "string"
    }`
  };
  const prompt = `You are an expert in SEO and structured data. Generate valid Schema.org JSON-LD for the page.

URL: ${url}
Requested Type: ${contentType}
Content (first 8000 chars):\n---\n${(pageContent || '').slice(0, 8000)}\n---

Strictly return a single JSON object inside a \`\`\`json block matching this shape:\n\n\`\`\`json\n${schemas[contentType] || schemas['Article']}\n\`\`\``;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 4096, topP: 0.8, topK: 40 }
    })
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`LLM error ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const m = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (!m || !m[1]) throw new Error('No JSON block found in LLM response');
  const parsed = JSON.parse(m[1]);
  return parsed;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const {
      projectId,
      url,
      contentType = 'Article',
      content = '',
      acceptedEntities,
      mode = 'auto' // 'auto' | 'lean' | 'rich' | 'auto_no_llm'
    } = body || {};

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    let runId: string | null = null;
    const logRun = async (status: 'running' | 'completed' | 'error', payload?: any, errMsg?: string) => {
      try {
        if (!projectId) return;
        if (!runId && status === 'running') {
          const { data, error } = await supabase.from('tool_runs').insert({
            project_id: projectId,
            tool_name: 'schema-generator',
            input_payload: { url, contentType, mode, hasContent: !!content, contentLength: content?.length || 0 },
            status: 'running',
            created_at: new Date().toISOString()
          }).select('id').single();
          if (!error) runId = data?.id || null;
        } else if (runId && status !== 'running') {
          await supabase.from('tool_runs').update({
            status,
            completed_at: new Date().toISOString(),
            output_payload: errMsg ? { error: errMsg } : (payload || null),
            error_message: errMsg || null
          }).eq('id', runId);
        }
      } catch {}
    };

    await logRun('running');

    // If no explicit content provided, try fetching from the URL
    let pageContent = content;
    if (!pageContent && url) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          pageContent = await res.text();
        }
      } catch {}
    }

    let schema: any;
    const typeNorm = String(contentType || 'Article').replace(/\s+/g, '').toLowerCase();
    let built: any;
    if (typeNorm.includes('faq')) {
      built = buildFAQ(url, pageContent);
    } else if (typeNorm.includes('product')) {
      built = buildProduct(url, pageContent, acceptedEntities);
    } else if (typeNorm.includes('howto')) {
      built = buildHowTo(url, pageContent);
    } else {
      built = buildArticle(url, pageContent, acceptedEntities);
    }

    // Validate lean candidate
    let validatorResult = await validateWithFunction(supabase, built);
    const leanOk = !!validatorResult?.valid;

    const allowLLM = mode === 'rich' || mode === 'auto';
    const disallowLLM = mode === 'lean' || mode === 'auto_no_llm';
    let usedPath: 'lean' | 'rich' | 'lean_fallback' = 'lean';

    // Decide if we should try LLM fallback
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    const needsFallback = !leanOk || (typeNorm.includes('faq') && (!built.mainEntity || built.mainEntity.length === 0));
    schema = built;
    if (!disallowLLM && allowLLM && geminiKey && needsFallback) {
      try {
        const llmType = typeNorm.includes('faq')
          ? 'FAQPage'
          : typeNorm.includes('product')
            ? 'Product'
            : typeNorm.includes('howto')
              ? 'HowTo'
              : 'Article';
        const llmSchema = await runLLM(url || '', llmType, content || '', geminiKey);
        const llmValidation = await validateWithFunction(supabase, llmSchema);
        if (llmValidation?.valid) {
          schema = llmSchema;
          validatorResult = llmValidation;
          usedPath = 'rich';
        } else {
          usedPath = leanOk ? 'lean' : 'lean_fallback';
        }
      } catch {
        schema = built;
        usedPath = leanOk ? 'lean' : 'lean_fallback';
      }
    } else {
      schema = built;
      usedPath = leanOk ? 'lean' : 'lean_fallback';
    }

    const implementation = stringifyImplementation(schema);
    const response = {
      schema,
      implementation,
      schemaType: schema['@type'] || contentType,
      valid: !!validatorResult?.valid,
      issues: Array.isArray(validatorResult?.issues) ? validatorResult.issues : [],
      modeUsed: usedPath,
      instructions: [
        'Copy the <script type="application/ld+json"> block and paste it into the <head> or before the closing </body>.',
        'In WordPress or other CMSs, use a header or footer script area or theme template.',
        'Include only one schema block per page.'
      ]
    };
    await logRun('completed', response, null);
    return new Response(JSON.stringify(ok(response)), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    await logRun('error', null, msg);
    return new Response(JSON.stringify(fail(msg)), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
