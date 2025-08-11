import { assertEquals, assert } from "https://deno.land/std@0.140.0/testing/asserts.ts";
import { optimizerService } from "./index.ts";
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- Test Configuration ---

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

const mockSuccessPayload = {
  optimizedContent: "This is the newly optimized content.",
  optimizedScore: 95,
  originalScore: 70,
  improvements: ["Made it more awesome."],
};

// --- Mock Fetch Implementation ---

const mockFetch = (async (
  url: string | URL,
  options?: RequestInit,
): Promise<Response> => {
  const urlString = url.toString();

  if (urlString.includes("generativelanguage.googleapis.com")) {
    if (shouldGeminiFail) {
      return new Response(JSON.stringify({ error: "Mock Gemini API Error" }), { status: 500 });
    }
    const mockGeminiResponse = {
      candidates: [{ content: { parts: [{ text: JSON.stringify(mockSuccessPayload) }] } }],
    };
    return new Response(JSON.stringify(mockGeminiResponse));
  }

  return new Response(JSON.stringify({ error: "Unhandled mock fetch call" }), { status: 501 });
}) as typeof fetch;


// --- Test Suite ---

Deno.test("content-optimizer success case", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;
  shouldGeminiFail = false;

  await t.step("it returns a successful response with optimized data", async () => {
    try {
      const req = new Request("http://localhost/optimizer", {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: "test-project-id",
          content: "This is the original content.",
          targetKeywords: ["testing", "deno"],
          contentType: "blog post",
        }),
      });

      const response = await optimizerService(req, mockSupabaseClient);
      const data = await response.json();

      assertEquals(response.status, 200);
      assertEquals(data.success, true);
      assertEquals(data.data.optimizedScore, mockSuccessPayload.optimizedScore);
      assertEquals(data.data.runId, '123');

    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

Deno.test("content-optimizer error case (Gemini API failure)", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;
  shouldGeminiFail = true;

  await t.step("it returns a standard error response", async () => {
    try {
      const req = new Request("http://localhost/optimizer", {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            projectId: "test-project-id",
            content: "This is the original content.",
            targetKeywords: ["testing", "deno"],
            contentType: "blog post",
        }),
      });

      const response = await optimizerService(req, mockSupabaseClient);
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
