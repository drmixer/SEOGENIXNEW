import { assertEquals, assert } from "https://deno.land/std@0.140.0/testing/asserts.ts";
import { auditService } from "./index.ts";
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

// Global flag to control the behavior of the Gemini API mock
let shouldGeminiFail = false;

// Mock the successful Gemini API response payload
const mockSuccessPayload = {
    aiUnderstanding: 90,
    contentStructure: 82,
    citationLikelihood: 80,
    conversationalReadiness: 88,
    onPageRecommendations: [],
    structureRecommendations: [],
    readinessRecommendations: [],
    onPageIssues: [],
    structureIssues: [],
    readinessIssues: [],
    overallScore: 85
  };

// --- Mock Fetch Implementation ---

const mockFetch = (async (
  url: string | URL,
  _options?: RequestInit,
): Promise<Response> => {
  const urlString = url.toString();

  // Mock for fetching the content of the URL to be audited
  if (urlString.includes("example.com")) {
    return new Response("<html><head><title>Test Page</title></head><body><h1>Mock Content</h1></body></html>", {
        headers: { "Content-Type": "text/html" },
        status: 200
    });
  }

  // Mock for Gemini API
  if (urlString.includes("generativelanguage.googleapis.com")) {
    if (shouldGeminiFail) {
      return new Response(JSON.stringify({ error: "Mock Gemini API Error" }), { status: 500 });
    }
    const mockGeminiResponse = {
      candidates: [{ content: { parts: [{ text: JSON.stringify(mockSuccessPayload) }] } }],
    };
    return new Response(JSON.stringify(mockGeminiResponse));
  }

  // Fallback for any unhandled fetch calls
  return new Response(JSON.stringify({ error: "Unhandled mock fetch call" }), { status: 501 });
}) as typeof fetch;


// --- Test Suite ---

Deno.test("ai-visibility-audit success case", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;
  shouldGeminiFail = false; // Ensure success mode

  await t.step("it returns a successful response with valid data", async () => {
    try {
      const req = new Request("http://localhost/audit", {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: "test-project-id",
          url: "https://example.com",
        }),
      });

      const response = await auditService(req, mockSupabaseClient);
      const data = await response.json();

      assertEquals(response.status, 200);
      assertEquals(data.success, true);
      assertEquals(data.data.overallScore, mockSuccessPayload.overallScore);
      assertEquals(data.data.runId, '123');

    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});


Deno.test("ai-visibility-audit error case (Gemini API failure)", async (t) => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;
    shouldGeminiFail = true; // Ensure failure mode

    await t.step("it returns a standard error response", async () => {
        try {
            const req = new Request("http://localhost/audit", {
              method: "POST",
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                projectId: "test-project-id",
                url: "https://example.com",
              }),
            });

            const response = await auditService(req, mockSupabaseClient);
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
