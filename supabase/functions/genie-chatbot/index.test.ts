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
      candidates: [ { content: { parts: [ { text: "This is a test response." } ] } } ],
    };
    return new Response(JSON.stringify(mockGeminiResponse));
  }

  if (urlString.includes("localhost:54321/rest/v1/tool_runs")) {
    if (_options?.method === 'POST') {
        return new Response(JSON.stringify({ id: "mock-run-id-chatbot" }), {
            headers: { "Content-Type": "application/json" },
            status: 201
        });
    } else {
        return new Response(null, { status: 204 });
    }
  }

  if (urlString.includes("localhost:54321/auth/v1/user")) {
      // Mock the getUser call
      return new Response(JSON.stringify({ id: "user-id-123", email: "test@example.com" }), { headers: { "Content-Type": "application/json" } });
  }

  if (urlString.includes("localhost:54321/rest/v1/user_profiles")) {
      // Mock the user_profiles call
      return new Response(JSON.stringify({ id: "profile-id-123", user_id: "user-id-123" }), { headers: { "Content-Type": "application/json" } });
  }

  if (urlString.includes("localhost:54321/rest/v1/audit_history")) {
      // Mock the audit_history call
      return new Response(JSON.stringify([]), { headers: { "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ error: "Unhandled mock fetch call" }), { status: 501 });
}) as typeof fetch;

Deno.test("genie-chatbot function with mock fetch", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;
  Deno.env.set("GEMINI_API_KEY", "test-key");
  Deno.env.set("SUPABASE_URL", "http://localhost:54321");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-key");

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

    const response = await app(req);
    const data = await response.json();

    assertEquals(response.status, 200);
    assertEquals(data.output.response, "This is a test response.");

  } finally {
    globalThis.fetch = originalFetch;
  }
});
