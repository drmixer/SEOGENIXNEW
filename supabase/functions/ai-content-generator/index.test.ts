import { assertEquals, assert } from "https://deno.land/std@0.140.0/testing/asserts.ts";
import { contentGeneratorService } from "./index.ts";

// --- Test Configuration & Mocks ---

let shouldGeminiFail = false;

const mockAiResponse = {
    generatedTitle: "Content about Deno and Testing",
    generatedContent: "This is a generated article about Deno and its testing features.",
    supportingDetails: {
        wordCount: 12,
        keywordsUsed: ["Deno", "Testing"]
    }
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

Deno.test("content-generator success case", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;
  shouldGeminiFail = false;

  await t.step("it generates content successfully", async () => {
    try {
      const req = new Request("http://localhost/content-generator", {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType: "article-section",
          topic: "Deno and Testing",
          targetKeywords: ["Deno", "Testing"],
          entitiesToInclude: ["Deno", "Testing"]
        }),
      });

      const response = await contentGeneratorService(req, {} as any); // Pass mock client
      const data = await response.json();

      assertEquals(response.status, 200);
      assertEquals(data.success, true);
      assertEquals(data.data.generatedTitle, mockAiResponse.generatedTitle);
      assert(data.data.generatedContent.includes("Deno"));

    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

Deno.test("content-generator failure case", async (t) => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;
    shouldGeminiFail = true;

    await t.step("it returns a standard error response", async () => {
      try {
        const req = new Request("http://localhost/content-generator", {
          method: "POST",
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contentType: "article-section",
            topic: "Deno and Testing",
            targetKeywords: ["Deno", "Testing"]
          }),
        });

        const response = await contentGeneratorService(req, {} as any); // Pass mock client
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
