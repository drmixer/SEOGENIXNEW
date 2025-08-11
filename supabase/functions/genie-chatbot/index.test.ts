import { assertEquals, assert } from "https://deno.land/std@0.140.0/testing/asserts.ts";
import { Hono } from 'npm:hono'
import { app } from "./index.ts"; // Import the Hono app

// --- Mocks ---

const mockSupabaseClient = {
  auth: {
    getUser: async (_token: string) => ({ data: { user: { id: "user-123" } }, error: null }),
  },
  from: (_table: string) => ({
    select: () => ({
      eq: () => ({
        single: () => Promise.resolve({ data: { user_id: "user-123", plan: "pro" }, error: null }),
        order: () => ({
          limit: () => Promise.resolve({ data: [{ score: 85 }], error: null })
        })
      })
    })
  })
};

const mockAiResponse = {
  responseText: "This is a mock response.",
  suggestedFollowUps: ["What else can you do?"],
};

let shouldGeminiFail = false;
const originalFetch = globalThis.fetch;

// --- Test Suite Setup ---

// Apply middleware to the app for all tests in this suite
app.use('*', async (c, next) => {
    c.set('supabase', mockSupabaseClient as any)
    await next()
});

globalThis.fetch = (async (
    url: string | URL,
    _options?: RequestInit,
  ): Promise<Response> => {
    if (url.toString().includes("generativelanguage.googleapis.com")) {
        if (shouldGeminiFail) {
            return new Response(JSON.stringify({ error: "Mock Gemini API Error" }), { status: 500 });
        }
        const mockGeminiResponse = {
            candidates: [{ content: { parts: [{ text: JSON.stringify(mockAiResponse) }] } }],
        };
        return new Response(JSON.stringify(mockGeminiResponse));
    }
    return new Response(JSON.stringify({ error: "Unhandled mock fetch" }), { status: 501 });
}) as typeof fetch;


// --- Test Suite ---

Deno.test("genie-chatbot", async (t) => {

  await t.step("success case", async () => {
    shouldGeminiFail = false;
    const req = new Request("http://localhost/", {
      method: "POST",
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid-token'
      },
      body: JSON.stringify({
        message: "Hello",
        context: "dashboard"
      }),
    });

    const response = await app.fetch(req);
    const data = await response.json();

    assertEquals(response.status, 200);
    assertEquals(data.success, true);
    assertEquals(data.data.responseText, mockAiResponse.responseText);
  });

  await t.step("failure case", async () => {
    shouldGeminiFail = true;
    const req = new Request("http://localhost/", {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify({
          message: "Hello",
          context: "dashboard"
        }),
      });

      const response = await app.fetch(req);
      const data = await response.json();

      assertEquals(response.status, 500);
      assertEquals(data.success, false);
      assert(data.error.message.includes("The AI model failed to process the request"));
      shouldGeminiFail = false; // reset
  });
});

// Restore original fetch after all tests
globalThis.fetch = originalFetch;
