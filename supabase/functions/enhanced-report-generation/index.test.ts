import { assertEquals, assert } from "https://deno.land/std@0.140.0/testing/asserts.ts";
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { reportGenerationService } from "./index.ts";

// --- Test Configuration & Mocks ---

let shouldGeminiFail = false;

const mockAiAnalysis = {
  reportTitle: "Mock Report Title",
  executiveSummary: "This is a mock executive summary.",
  keyInsights: ["Mock insight 1", "Mock insight 2"],
};

const mockFetch = (async (
  _url: string | URL,
  _options?: RequestInit,
): Promise<Response> => {
  if (shouldGeminiFail) {
    return new Response(JSON.stringify({ error: "Mock Gemini API Error" }), { status: 500 });
  }
  const mockGeminiResponse = {
    candidates: [{ content: { parts: [{ text: JSON.stringify(mockAiAnalysis) }] } }],
  };
  return new Response(JSON.stringify(mockGeminiResponse));
}) as typeof fetch;

// Create a mock Supabase client
const createMockSupabaseClient = () => {
    return {
        auth: {
            getUser: () => Promise.resolve({
                data: { user: { id: 'mock-user-id' } },
                error: null,
            }),
        },
        storage: {
            from: (_bucket: string) => ({
                upload: () => Promise.resolve({ data: { path: 'mock/path.html' }, error: null }),
                getPublicUrl: (_path: string) => ({
                    data: { publicUrl: 'https://example.com/mock-report.html' },
                }),
            }),
        },
        from: (_table: string) => ({
            insert: (_data: any) => ({
                select: () => ({
                    single: () => Promise.resolve({
                        data: { id: 'mock-report-id-123' },
                        error: null,
                    }),
                }),
            }),
        }),
    } as unknown as SupabaseClient;
};


// --- Test Suite ---

Deno.test("report-generation success case", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;
  shouldGeminiFail = false;
  const mockSupabase = createMockSupabaseClient();

  await t.step("it generates and uploads a report successfully", async () => {
    try {
      const req = new Request("http://localhost/report", {
        method: "POST",
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-token',
        },
        body: JSON.stringify({
          projectId: "test-project-id",
          reportType: "AI Visibility Audit",
          reportData: { score: 88 },
          reportName: "Q3 Audit Report",
          format: "html",
        }),
      });

      const response = await reportGenerationService(req, mockSupabase);
      const data = await response.json();

      assertEquals(response.status, 200);
      assertEquals(data.success, true);
      assertEquals(data.data.reportId, 'mock-report-id-123');
      assert(data.data.downloadUrl.includes("mock-report.html"));

    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

Deno.test("report-generation failure case (AI)", async (t) => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;
    shouldGeminiFail = true;
    const mockSupabase = createMockSupabaseClient();

    await t.step("it returns a standard error if AI fails", async () => {
      try {
        const req = new Request("http://localhost/report", {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer mock-token',
            },
            body: JSON.stringify({
                projectId: "test-project-id",
                reportType: "AI Visibility Audit",
                reportData: { score: 88 },
                reportName: "Q3 Audit Report",
                format: "html",
            }),
          });

        const response = await reportGenerationService(req, mockSupabase);
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
