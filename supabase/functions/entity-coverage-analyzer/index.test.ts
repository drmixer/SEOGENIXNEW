import { assertEquals } from "https://deno.land/std@0.140.0/testing/asserts.ts";
import { app } from "./index.ts";

// Mock the fetch function
const mockFetch = (async (
  url: string | URL,
  _options?: RequestInit,
): Promise<Response> => {
  const urlString = url.toString();

  if (urlString.includes("generativelanguage.googleapis.com")) {
    const mockGeminiResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: `MENTIONED ENTITIES:
- Deno | Software | 95 | high | A secure runtime for JavaScript and TypeScript.
MISSING ENTITIES:
- Node.js | Software | 80 | high | A competing JavaScript runtime.`
              },
            ],
          },
        },
      ],
    };
    return new Response(JSON.stringify(mockGeminiResponse));
  }

  if (urlString.includes("localhost:54321/rest/v1/tool_runs")) {
    // This is a call from logToolRun or updateToolRun
    if (_options?.method === 'POST') { // logToolRun (insert)
        return new Response(JSON.stringify({ id: "mock-run-id-12345" }), {
            headers: { "Content-Type": "application/json" },
            status: 201
        });
    } else { // updateToolRun (update)
        return new Response(null, { status: 204 });
    }
  }

  // Fallback for any other unhandled requests
  return new Response(JSON.stringify({ error: "Unhandled mock fetch call" }), { status: 501 });
}) as typeof fetch;

Deno.test("entity-coverage-analyzer function with mock fetch", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;
  Deno.env.set("GEMINI_API_KEY", "test-key");
  Deno.env.set("SUPABASE_URL", "http://localhost:54321");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-key");

  try {
    const req = new Request("http://localhost/", {
      method: "POST",
      body: JSON.stringify({
        projectId: "test-project-id",
        url: "https://example.com",
        content: "This is a test content about Deno.",
      }),
    });

    const response = await app(req);
    const data = await response.json();

    assertEquals(response.status, 200);

    // The actual response is now wrapped in an 'output' property
    const output = data.output;

    assertEquals(output.mentionedEntities.length, 1);
    assertEquals(output.mentionedEntities[0].name, "Deno");
    assertEquals(output.missingEntities.length, 1);
    assertEquals(output.missingEntities[0].name, "Node.js");
    assertEquals(output.coverageScore, 50);

  } finally {
    globalThis.fetch = originalFetch;
  }
});
