import { assertEquals, assert } from "https://deno.land/std@0.140.0/testing/asserts.ts";
import { auditService } from "./index.ts";

// --- Test Configuration & Mocks ---

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

let shouldGeminiFail = false;
const progressUpdates: any[] = [];

// Mock payloads for each step
const mockStep1Payload = {
  aiUnderstanding: 90,
  onPageRecommendations: [{ title: "Rec 1", description: "Desc 1", action_type: "general-advice" }],
  onPageIssues: [{ title: "Issue 1", description: "Desc 1" }],
};
const mockStep2Payload = {
  contentStructure: 80,
  structureRecommendations: [{ title: "Rec 2", description: "Desc 2", action_type: "general-advice" }],
  structureIssues: [{ title: "Issue 2", description: "Desc 2" }],
};
const mockStep3Payload = {
  citationLikelihood: 85,
  conversationalReadiness: 88,
  readinessRecommendations: [{ title: "Rec 3", description: "Desc 3", action_type: "general-advice" }],
  readinessIssues: [{ title: "Issue 3", description: "Desc 3" }],
};

const mockFetch = (async (
  url: string | URL,
  options?: RequestInit,
): Promise<Response> => {
  const urlString = url.toString();
  const body = options?.body ? JSON.parse(options.body.toString()) : {};
  const prompt = body.contents?.[0]?.parts?.[0]?.text || '';

  if (urlString.includes("example.com")) {
    return new Response("<html><body><h1>Test Content</h1></body></html>");
  }

  if (urlString.includes("generativelanguage.googleapis.com")) {
    if (shouldGeminiFail) return new Response(JSON.stringify({ error: "Mock Gemini API Error" }), { status: 500 });

    let responsePayload = {};
    if (prompt.includes("on-page content")) responsePayload = mockStep1Payload;
    else if (prompt.includes("content structure")) responsePayload = mockStep2Payload;
    else if (prompt.includes("conversational readiness")) responsePayload = mockStep3Payload;

    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(responsePayload) }] } }] }));
  }

  if (urlString.includes("/rest/v1/tool_runs")) {
    if (options?.method === 'PATCH' || options?.method === 'PUT') {
      progressUpdates.push(body); // Spy on progress updates
    }
    return new Response(JSON.stringify({ id: "mock-run-id" }), { status: 201 });
  }

  return new Response(JSON.stringify({ error: "Unhandled mock fetch" }), { status: 501 });
}) as typeof fetch;


// --- Test Suite ---

Deno.test("ai-visibility-audit multi-step success case", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;
  shouldGeminiFail = false;
  progressUpdates.length = 0; // Reset spy

  await t.step("it returns a combined successful response from all steps", async () => {
    try {
      const req = new Request("http://localhost/audit", {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: "test-project", url: "https://example.com" }),
      });

      const response = await auditService(req, mockSupabaseClient as any);
      const data = await response.json();

      assertEquals(response.status, 200);
      assertEquals(data.success, true);

      const expectedOverall = Math.round((90 + 80 + 85 + 88) / 4);
      assertEquals(data.data.overallScore, expectedOverall);

      assertEquals(data.data.recommendations.length, 3);
      assertEquals(data.data.issues.length, 3);

      assert(progressUpdates.length >= 3, "Progress should be updated multiple times");

    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

Deno.test("ai-visibility-audit multi-step failure case", async (t) => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;
    shouldGeminiFail = true;

    await t.step("it returns a standard error if a step fails", async () => {
        try {
            const req = new Request("http://localhost/audit", {
              method: "POST",
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ projectId: "test-project", url: "https://example.com" }),
            });

            const response = await auditService(req, mockSupabaseClient as any);
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
