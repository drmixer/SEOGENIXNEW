import { assert, assertEquals } from "https://deno.land/std@0.140.0/testing/asserts.ts";
import { schemaGeneratorService } from "./index.ts";
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const mockSupabaseClient = {
  from: () => ({
    insert: () => ({ select: () => ({ single: () => ({ data: { id: '123' }, error: null }) }) }),
    update: () => ({ eq: () => ({ data: null, error: null }) })
  }),
  functions: { invoke: () => ({ data: { output: { valid: true, issues: [] } }, error: null }) }
} as unknown as SupabaseClient;

Deno.test("schema-generator preserves site name casing in FAQ output", async () => {
  const req = new Request("http://localhost/schema-generator", {
    method: "POST",
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId: 'test-project',
      contentType: 'faq',
      content: 'Q: What is mysite?\nA: mysite is great.',
      siteName: 'MySite',
      mode: 'lean'
    })
  });

  const res = await schemaGeneratorService(req, mockSupabaseClient);
  const json = await res.json();
  assertEquals(res.status, 200);
  const mainEntity = json.data.schema.mainEntity;
  assert(mainEntity[0].name.includes('MySite'));
  assert(mainEntity[0].acceptedAnswer.text.includes('MySite'));
});

Deno.test("buildArticle strips scripts/styles and extracts main content", async () => {
  const html = `<!doctype html><html><body><script>var bad=1;</script><style>p{}</style><article><h1>Title</h1><p>Hello world</p></article></body></html>`;
  const req = new Request("http://localhost/schema-generator", {
    method: "POST",
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId: 'p', contentType: 'article', content: html, mode: 'lean' })
  });
  const res = await schemaGeneratorService(req, mockSupabaseClient);
  const json = await res.json();
  assertEquals(res.status, 200);
  const body = json.data.schema.articleBody as string;
  assert(body.includes('Hello world'));
  assert(!body.includes('bad'));
});

Deno.test("buildHowTo extracts steps from ordered lists", async () => {
  const html = `<!doctype html><html><body><main><h1>How To</h1><ol><li>First step</li><li>Second step</li></ol></main></body></html>`;
  const req = new Request("http://localhost/schema-generator", {
    method: "POST",
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId: 'p', contentType: 'howto', content: html, mode: 'lean' })
  });
  const res = await schemaGeneratorService(req, mockSupabaseClient);
  const json = await res.json();
  assertEquals(res.status, 200);
  const steps = json.data.schema.step;
  assertEquals(steps.length, 2);
  assertEquals(steps[0].text, 'First step');
  assertEquals(steps[1].text, 'Second step');
});
