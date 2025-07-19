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
              text: "This is a test response.",
            },
          ],
        },
      },
    ],
  };
  return new Response(JSON.stringify(mockGeminiResponse), { status: 200 });
}) as typeof fetch;

Deno.test("genie-chatbot function with mock fetch", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;
  Deno.env.set("GEMINI_API_KEY", "test-key");
  Deno.env.set("SUPABASE_URL", "http://localhost:8000");
  Deno.env.set("SUPABASE_ANON_KEY", "test-key");

  try {
    const req = new Request("http://localhost/", {
      method: "POST",
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: "This is a test message.",
        userContext: {
          currentPage: "dashboard",
        },
      }),
    });

    const response = await handler(req);
    const data = await response.json();

    assertEquals(response.status, 200);
    assertEquals(data.primaryUrl, undefined);
  } finally {
    globalThis.fetch = originalFetch;
    Deno.env.delete("GEMINI_API_KEY");
  }
});
