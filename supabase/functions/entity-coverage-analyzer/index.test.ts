import { assertEquals, assert } from "https://deno.land/std@0.140.0/testing/asserts.ts";
import { entityAnalyzerService } from "./index.ts";

// --- Test Configuration & Mocks ---

let shouldGeminiFail = false;

const mockAiResponse = {
    coverageScore: 75,
    mentionedEntities: [{ name: "Playwright", type: "Technology", relevance: 95, importance: "high", description: "A testing framework." }],
    missingEntities: [{ name: "Testing", type: "Concept", relevance: 90, importance: "high", description: "A crucial software development practice." }]
};

const mockFetch = (async (
  url: string | URL,
  _options?: RequestInit,
): Promise<Response> => {
  const urlString = url.toString();
  if (urlString.includes("generativelanguage.googleapis.com")) {
    if (shouldGeminiFail) {
      return new Response(JSON.stringify({ error: "Mock Gemini API Error" }), { status: 500 });
    }
    const mockGeminiResponse = {
      candidates: [{ content: { parts: [{ text: JSON.stringify(mockAiResponse) }] } }],
    };
    return new Response(JSON.stringify(mockGeminiResponse));
  }
  // This mock doesn't need to handle content fetching, as we pass content directly in the test
  return new Response(JSON.stringify({ error: "Unhandled mock fetch call" }), { status: 501 });
}) as typeof fetch;


// --- Test Suite ---

Deno.test("entity-analyzer success case", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;
  shouldGeminiFail = false;

  await t.step("it returns a successful analysis", async () => {
    try {
      const req = new Request("http://localhost/entity-analyzer", {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: "This content talks about Playwright.",
        }),
      });

      const response = await entityAnalyzerService(req);
      const data = await response.json();

      assertEquals(response.status, 200);
      assertEquals(data.success, true);
      assertEquals(data.data.coverageScore, 75);
      assertEquals(data.data.missingEntities.length, 1);
      assertEquals(data.data.missingEntities[0].name, "Testing");

    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

Deno.test("entity-analyzer failure case", async (t) => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;
    shouldGeminiFail = true;

    await t.step("it returns a standard error response", async () => {
      try {
        const req = new Request("http://localhost/entity-analyzer", {
          method: "POST",
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: "This content talks about Playwright.",
          }),
        });

        const response = await entityAnalyzerService(req);
        const data = await response.json();

        assertEquals(response.status, 500);
        assertEquals(data.success, false);
        assert(data.error.message.includes("The AI model failed to process the request"));

      } finally {
        globalThis.fetch = originalFetch;
        shouldGeminiFail = false;
      }
    });
  });
