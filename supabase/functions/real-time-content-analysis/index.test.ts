import { assertEquals, assert } from "https://deno.land/std@0.140.0/testing/asserts.ts";
import { analysisService } from "./index.ts";

// --- Test Configuration & Mocks ---

let shouldGeminiFail = false;

const mockAiResponse = {
    aiReadabilityScore: 85,
    keywordDensity: { "testing": 2.5 },
    suggestions: [
        {
            type: "seo",
            severity: "warning",
            message: "Consider adding the keyword to a subheading.",
            suggestion: "Add 'Testing Strategies' as an H2.",
            position: { start: 0, end: 100 }
        }
    ]
};

const mockFetch = (async (
  _url: string | URL,
  _options?: RequestInit,
): Promise<Response> => {
  if (shouldGeminiFail) {
    return new Response(JSON.stringify({ error: "Mock Gemini API Error" }), { status: 500 });
  }
  const mockGeminiResponse = {
    candidates: [{ content: { parts: [{ text: JSON.stringify(mockAiResponse) }] } }],
  };
  return new Response(JSON.stringify(mockGeminiResponse));
}) as typeof fetch;


// --- Test Suite ---

Deno.test("real-time-analysis success case", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;
  shouldGeminiFail = false;

  await t.step("it returns a successful analysis", async () => {
    try {
      const req = new Request("http://localhost/analysis", {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: "This is a long piece of content for testing purposes.",
          keywords: ["testing"],
        }),
      });

      const response = await analysisService(req);
      const data = await response.json();

      assertEquals(response.status, 200);
      assertEquals(data.success, true);
      assertEquals(data.data.aiReadabilityScore, mockAiResponse.aiReadabilityScore);
      assertEquals(data.data.suggestions.length, 1);

    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

Deno.test("real-time-analysis failure case", async (t) => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;
    shouldGeminiFail = true;

    await t.step("it returns a standard error response", async () => {
      try {
        const req = new Request("http://localhost/analysis", {
          method: "POST",
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: "This is a long piece of content for testing purposes.",
            keywords: ["testing"],
          }),
        });

        const response = await analysisService(req);
        const data = await response.json();

        assertEquals(response.status, 500);
        assertEquals(data.success, false);
        assert(data.error.message.includes("The AI model failed to process the request"));

      } finally {
        globalThis.fetch = originalFetch;
        shouldGeminiFail = false; // Reset flag
      }
    });
  });
