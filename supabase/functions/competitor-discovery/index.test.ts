import { assertEquals, assert } from "https://deno.land/std@0.140.0/testing/asserts.ts";
import { competitorDiscoveryService } from "./index.ts";
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- Test Configuration & Mocks ---

Deno.env.set("GEMINI_API_KEY", "mock-key");
Deno.env.set("GOOGLE_SEARCH_API_KEY", "mock-key");
Deno.env.set("GOOGLE_SEARCH_ENGINE_ID", "mock-key");
Deno.env.set("MOZ_ACCESS_ID", "mock-key");
Deno.env.set("MOZ_SECRET_KEY", "mock-key");

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

let shouldGoogleFail = false;
let shouldMozFail = false;

const mockGoogleResponse = {
    items: [
        { title: "Competitor A", link: "https://competitor-a.com" },
        { title: "Competitor B", link: "https://competitor-b.com" },
    ]
};

const mockMozResponse = {
    domain_authority: 88,
};

const mockRelevanceAnalysis = {
    competitors: [
        { url: "https://competitor-a.com", relevanceScore: 90, explanation: "Direct competitor" },
        { url: "https://competitor-b.com", relevanceScore: 80, explanation: "Indirect competitor" }
    ]
};

const mockFetch = (async (
  url: string | URL,
  _options?: RequestInit,
): Promise<Response> => {
  const urlString = url.toString();

  if (urlString.includes("googleapis.com/customsearch")) {
    if (shouldGoogleFail) {
      return new Response(JSON.stringify({ error: "Mock Google API Error" }), { status: 500, statusText: "Internal Server Error" });
    }
    return new Response(JSON.stringify(mockGoogleResponse));
  }

  if (urlString.includes("seomoz.com")) {
    if (shouldMozFail) {
      return new Response(JSON.stringify({ error: "Mock Moz API Error" }), { status: 500 });
    }
    return new Response(JSON.stringify(mockMozResponse));
  }

  if (urlString.includes("generativelanguage.googleapis.com")) {
    const mockGeminiResponse = {
      candidates: [{ content: { parts: [{ text: JSON.stringify(mockRelevanceAnalysis) }] } }],
    };
    return new Response(JSON.stringify(mockGeminiResponse));
  }

  return new Response(JSON.stringify({ error: "Unhandled mock fetch call" }), { status: 501 });
}) as typeof fetch;


// --- Test Suite ---

Deno.test("competitor-discovery success case", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;
  shouldGoogleFail = false;
  shouldMozFail = false;

  await t.step("it returns a list of competitors with SEO metrics", async () => {
    try {
      const req = new Request("http://localhost/competitor-discovery", {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: "test-project-id",
          industry: "SaaS",
        }),
      });

      const response = await competitorDiscoveryService(req, mockSupabaseClient);
      const data = await response.json();

      assertEquals(response.status, 200);
      assertEquals(data.success, true);
      assertEquals(data.data.competitorSuggestions.length, 2);
      assertEquals(data.data.competitorSuggestions[0].name, "Competitor A");
      assertEquals(data.data.competitorSuggestions[0].domainAuthority, 88);

    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

Deno.test("competitor-discovery Google API failure", async (t) => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;
    shouldGoogleFail = true;
    shouldMozFail = false;

    await t.step("it returns a standard error response", async () => {
      try {
        const req = new Request("http://localhost/competitor-discovery", {
          method: "POST",
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: "test-project-id",
            industry: "SaaS",
          }),
        });

        const response = await competitorDiscoveryService(req, mockSupabaseClient);
        const data = await response.json();

        assertEquals(response.status, 500);
        assertEquals(data.success, false);
        assert(data.error.message.includes("Google Search API failed"));

      } finally {
        globalThis.fetch = originalFetch;
        shouldGoogleFail = false;
      }
    });
  });
