import { assertEquals, assert } from "https://deno.land/std@0.140.0/testing/asserts.ts";
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { app } from "./index.ts";

// --- Test Configuration & Mocks ---

let shouldGeminiFail = false;

const mockAiResponse = {
  responseText: "This is a mock AI response.",
  suggestedFollowUps: ["What is X?", "How does Y work?"],
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

const createMockSupabaseClient = () => {
    return {
        auth: {
            getUser: () => Promise.resolve({
                data: { user: { id: 'mock-user-id' } },
                error: null,
            }),
        },
        from: (_table: string) => ({
            select: () => ({
                eq: () => ({
                    single: () => Promise.resolve({ data: { id: 'mock-profile-id' }, error: null }),
                    order: () => ({
                        limit: () => Promise.resolve({ data: [{ score: 88 }], error: null }),
                    }),
                }),
            }),
        }),
    } as unknown as SupabaseClient;
};

// --- Hono Middleware Setup (runs once before all tests) ---
const mockSupabase = createMockSupabaseClient();
app.use('*', async (c, next) => {
  c.set('supabase', mockSupabase)
  await next()
});


// --- Test Suite ---

Deno.test("genie-chatbot success case", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;
  shouldGeminiFail = false;

  await t.step("it returns a successful structured response", async () => {
    try {
      const req = new Request("http://localhost/", {
        method: "POST",
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({
          projectId: "test-project-id",
          message: "This is a test message.",
          context: "dashboard",
        }),
      });

      const response = await app.request(req);
      const data = await response.json();

      assertEquals(response.status, 200);
      assertEquals(data.success, true);
      assertEquals(data.data.responseText, mockAiResponse.responseText);
      assertEquals(data.data.suggestedFollowUps.length, 2);

    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

Deno.test("genie-chatbot failure case", async (t) => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;
    shouldGeminiFail = true;

    await t.step("it returns a standard error response", async () => {
      try {
        const req = new Request("http://localhost/", {
          method: "POST",
          headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer test-token'
          },
          body: JSON.stringify({
            projectId: "test-project-id",
            message: "This is a test message.",
            context: "dashboard",
          }),
        });

        const response = await app.request(req);
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
