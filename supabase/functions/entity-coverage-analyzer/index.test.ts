import { assertEquals } from "https://deno.land/std@0.140.0/testing/asserts.ts";
import { handler } from "./index.ts";

// Mock the fetch function
const mockFetch = (async (
  _url: string | URL,
  _options?: RequestInit,
): Promise<Response> => {
  const mockGeminiResponse = {
    candidates: [
      {
        content: {
          parts: [
            {
              text: JSON.stringify({
                entities: [{
                  name: "Deno",
                  type: "Software",
                  relevance: 0.9,
                }],
                coverage_score: 80,
                suggestions: ["suggestion 1", "suggestion 2"],
              }),
            },
          ],
        },
      },
    ],
  };
  return new Response(JSON.stringify(mockGeminiResponse));
}) as typeof fetch;

Deno.test("entity-coverage-analyzer function with mock fetch", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;
  Deno.env.set("GEMINI_API_KEY", "test-key");

  try {
    const req = new Request("http://localhost/", {
      method: "POST",
      body: JSON.stringify({
        content: "This is a test content about Deno.",
      }),
    });

    const response = await handler(req);
    const data = await response.json();

    assertEquals(response.status, 200);
    assertEquals(data.entities[0].name, "Deno");
    assertEquals(data.coverage_score, 80);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
