import { assertEquals, assert } from "https://deno.land/std@0.140.0/testing/asserts.ts";
import { suggestionService } from "./index.ts";
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- Test Configuration & Mocks ---

Deno.env.set("GEMINI_API_KEY", "mock-key");

const mockSupabaseClient = {
    from: () => ({
      insert: () => ({
        select: () => ({
          single: () => ({ data: { id: '123' }, error: null })
        })
      }),
      update: () => ({
        eq: () => ({ data: null, error: null })
      })
    })
} as unknown as SupabaseClient;

let shouldGeminiFail = false;

const mockAiResponse = {
    promptSuggestions: [
        { prompt: "What is Deno?", category: "Beginner Question", intent: "informational" },
        { prompt: "Deno vs Node.js", category: "Comparison", intent: "informational" },
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

Deno.test("prompt-suggestions success case", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;
  shouldGeminiFail = false;

  await t.step("it returns successful suggestions", async () => {
    try {
      const req = new Request("http://localhost/suggestions", {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: "test-project-id",
          topic: "Deno",
        }),
      });

      const response = await suggestionService(req, mockSupabaseClient);
      const data = await response.json();

      assertEquals(response.status, 200);
      assertEquals(data.success, true);
      assertEquals(data.data.promptSuggestions.length, 2);
      assertEquals(data.data.promptSuggestions[0].category, "Beginner Question");

    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

Deno.test("prompt-suggestions failure case", async (t) => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;
    shouldGeminiFail = true;

    await t.step("it returns a standard error response", async () => {
      try {
        const req = new Request("http://localhost/suggestions", {
          method: "POST",
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: "test-project-id",
            topic: "Deno",
          }),
        });

        const response = await suggestionService(req, mockSupabaseClient);
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
