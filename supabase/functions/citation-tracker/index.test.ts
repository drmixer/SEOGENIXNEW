import { assertEquals, assert } from "https://deno.land/std@0.140.0/testing/asserts.ts";
import { citationTrackerService } from "./index.ts";

// --- Mocks ---

const mockSupabaseClient = {
  from: () => ({
    insert: () => ({
      select: () => ({
        single: () => Promise.resolve({ data: { id: "run-123" }, error: null })
      })
    }),
    update: () => ({
      eq: () => Promise.resolve({ error: null })
    })
  })
};

let shouldRedditAuthFail = false;
let shouldRedditSearchFail = false;
let shouldGeminiFail = false;

const mockRedditToken = { access_token: "mock-token" };
const mockRedditSearch = {
    data: {
        children: [
            { data: { title: "Check out example.com", permalink: "/r/test/comments/123" } }
        ]
    }
};
const mockAiResponse = {
    citations: [
        { source: "r/test", url: "https://www.reddit.com/r/test/comments/123", snippet: "Check out example.com", date: "2025-01-01T00:00:00.000Z", type: "reddit", confidence_score: 95 }
    ]
};

const mockFetch = (async (
  url: string | URL,
  _options?: RequestInit,
): Promise<Response> => {
  const urlString = url.toString();

  if (urlString.includes("reddit.com/api/v1/access_token")) {
    if (shouldRedditAuthFail) return new Response(JSON.stringify({ error: "Auth failed" }), { status: 401 });
    return new Response(JSON.stringify(mockRedditToken));
  }

  if (urlString.includes("oauth.reddit.com/search")) {
    if (shouldRedditSearchFail) return new Response(JSON.stringify({ error: "Search failed" }), { status: 500 });
    return new Response(JSON.stringify(mockRedditSearch));
  }

  if (urlString.includes("generativelanguage.googleapis.com")) {
    if (shouldGeminiFail) return new Response(JSON.stringify({ error: "Mock Gemini API Error" }), { status: 500 });
    const mockGeminiResponse = { candidates: [{ content: { parts: [{ text: JSON.stringify(mockAiResponse) }] } }] };
    return new Response(JSON.stringify(mockGeminiResponse));
  }

  return new Response(JSON.stringify({ error: "Unhandled mock fetch call" }), { status: 501 });
}) as typeof fetch;


// --- Test Suite ---

Deno.test("citation-tracker success case", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;
  shouldRedditAuthFail = false;
  shouldRedditSearchFail = false;
  shouldGeminiFail = false;

  await t.step("it returns a list of citations", async () => {
    try {
      const req = new Request("http://localhost/citation-tracker", {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: "example.com", keywords: ["example"] }),
      });

      const response = await citationTrackerService(req, mockSupabaseClient as any);
      const data = await response.json();

      assertEquals(response.status, 200);
      assertEquals(data.success, true);
      assertEquals(data.data.citations.length, 1);
      assertEquals(data.data.citations[0].source, "r/test");

    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

Deno.test("citation-tracker failure case (Reddit Auth)", async (t) => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;
    shouldRedditAuthFail = true;

    await t.step("it returns an error if Reddit auth fails", async () => {
      try {
        const req = new Request("http://localhost/citation-tracker", {
          method: "POST",
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domain: "example.com", keywords: ["example"] }),
        });

        const response = await citationTrackerService(req, mockSupabaseClient as any);
        const data = await response.json();

        assertEquals(response.status, 500);
        assertEquals(data.success, false);
        assert(data.error.message.includes("Failed to get Reddit access token"));

      } finally {
        globalThis.fetch = originalFetch;
        shouldRedditAuthFail = false;
      }
    });
  });
