import { assertEquals, assert } from "https://deno.land/std@0.140.0/testing/asserts.ts";
import { wordpressService } from "./index.ts";

// --- Mocks ---

const mockSupabaseClient = {
  auth: {
    getUser: async (token: string) => {
      if (token === "valid-token") return { data: { user: { id: "user-123" } }, error: null };
      return { data: { user: null }, error: new Error("Invalid token") };
    },
  },
  from: () => ({
    select: () => ({
      eq: () => ({
        single: () => Promise.resolve({
          data: {
            id: "int-123",
            user_id: "user-123",
            cms_type: "wordpress",
            site_url: "https://mock.wordpress.com",
            credentials: { username: "user", application_password: "password" }
          },
          error: null
        })
      })
    })
  })
};

let mockApiResponse: any = {};
const originalFetch = globalThis.fetch;
globalThis.fetch = (async (url: string | URL, _options?: RequestInit): Promise<Response> => {
    const urlString = url.toString();
    let responseData = {};

    if (urlString.includes("/wp/v2/posts")) {
        responseData = mockApiResponse.posts || [{ id: 1, title: { rendered: 'Test Post' }, date_gmt: new Date().toISOString(), type: 'post' }];
    } else if (urlString.includes("/wp/v2/pages")) {
        responseData = mockApiResponse.pages || [{ id: 2, title: { rendered: 'Test Page' }, date_gmt: new Date().toISOString(), type: 'page' }];
    } else if (urlString.includes("/wp/v2/users/me")) {
        responseData = { id: 1, name: 'Test User' };
    } else {
        responseData = { success: true };
    }

    return new Response(JSON.stringify(responseData), {
        headers: { 'Content-Type': 'application/json' }
    });
}) as typeof fetch;


// --- Test Suite ---

Deno.test("WordPress Integration Service", async (t) => {
  await t.step("get_posts action should return combined posts and pages", async () => {
    mockApiResponse = {};
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Authorization": "Bearer valid-token" },
      body: JSON.stringify({ action: "get_posts" }),
    });
    const res = await wordpressService(req, mockSupabaseClient as any);
    const data = await res.json();

    assertEquals(res.status, 200);
    assertEquals(data.success, true);
    assertEquals(data.data.items.length, 2);
    assert(data.data.items.some((item: any) => item.type === 'post'));
    assert(data.data.items.some((item: any) => item.type === 'page'));
  });

  await t.step("get_posts action should handle search", async () => {
    // This mock is simple, a real test would check the URL for the search param
    mockApiResponse = { posts: [{id: 3, title: {rendered: "Search Result"}, type: 'post'}] };
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Authorization": "Bearer valid-token" },
      body: JSON.stringify({ action: "get_posts", search: "test" }),
    });
    const res = await wordpressService(req, mockSupabaseClient as any);
    const data = await res.json();
    assertEquals(data.data.items[0].title, "Search Result");
  });

  await t.step("get_content action should fetch a single item", async () => {
    mockApiResponse = { posts: { id: 1, title: { raw: 'Single Post' }, content: { raw: 'Content' } } };
     const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Authorization": "Bearer valid-token" },
      body: JSON.stringify({ action: "get_content", postId: 1 }),
    });
    const res = await wordpressService(req, mockSupabaseClient as any);
    const data = await res.json();
    assertEquals(res.status, 200);
    assertEquals(data.data.title, "Single Post");
  });

  await t.step("publish action should succeed", async () => {
    mockApiResponse = { posts: { id: 10, title: { rendered: 'New Post' } } };
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Authorization": "Bearer valid-token" },
      body: JSON.stringify({ action: "publish", title: "New Post", content: "My new content" }),
    });
    const res = await wordpressService(req, mockSupabaseClient as any);
    const data = await res.json();
    assertEquals(res.status, 200);
    assertEquals(data.success, true);
    assertEquals(data.data.id, 10);
  });

  await t.step("publish action with schema generation should succeed", async () => {
    // This requires mocking the supabase.functions.invoke call, which is complex.
    // For now, we'll just test that the call completes.
    mockApiResponse = { posts: { id: 11, title: { rendered: 'New Post with Schema' } } };
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Authorization": "Bearer valid-token" },
      body: JSON.stringify({
        action: "publish",
        title: "New Post with Schema",
        content: "My new content",
        autoGenerateSchema: true
      }),
    });
    // This mock needs to be improved to handle the invoke call
    // For now, we can't properly test this part without more complex mocking
    // But we can ensure the function doesn't crash
    const res = await wordpressService(req, mockSupabaseClient as any);
    assertEquals(res.status, 200);
  });
});

// Restore original fetch after tests
globalThis.fetch = originalFetch;
