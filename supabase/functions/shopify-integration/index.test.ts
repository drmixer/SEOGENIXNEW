import { assertEquals, assert } from "https://deno.land/std@0.140.0/testing/asserts.ts";
import { shopifyService } from "./index.ts";

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
            id: "int-456",
            user_id: "user-123",
            cms_type: "shopify",
            credentials: { shop_domain: "mock.myshopify.com", access_token: "token" }
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
    let responseData: any = {};
    const headers = new Headers({ 'Content-Type': 'application/json' });

    if (urlString.includes("/products.json")) {
        // For get_products, the response is { products: [...] }
        responseData = { products: mockApiResponse.products || [{ id: 1, title: 'Test Product', updated_at: new Date().toISOString() }] };
        // Simulate Link header for pagination
        if (mockApiResponse.nextPageInfo) {
            headers.set('Link', `<https://mock.myshopify.com/admin/api/2023-10/products.json?page_info=${mockApiResponse.nextPageInfo}>; rel="next"`);
        }
    } else if (urlString.match(/\/products\/\d+\.json/)) {
        // For get_content and update_content
        responseData = { product: mockApiResponse.product || { id: 1, title: 'Single Product', body_html: 'Product description' } };
    } else if (urlString.includes("/shop.json")) {
        responseData = { shop: { id: 1, name: 'Test Store' } };
    } else {
        responseData = { success: true };
    }

    return new Response(JSON.stringify(responseData), { headers });
}) as typeof fetch;


// --- Test Suite ---

Deno.test("Shopify Integration Service", async (t) => {
  await t.step("get_products action should return products", async () => {
    mockApiResponse = {};
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Authorization": "Bearer valid-token" },
      body: JSON.stringify({ action: "get_products" }),
    });
    const res = await shopifyService(req, mockSupabaseClient as any);
    const data = await res.json();

    assertEquals(res.status, 200);
    assertEquals(data.success, true);
    assertEquals(data.data.items.length, 1);
    assertEquals(data.data.items[0].title, 'Test Product');
  });

  await t.step("get_products action should handle pagination", async () => {
    mockApiResponse = { nextPageInfo: 'next-page-token' };
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Authorization": "Bearer valid-token" },
      body: JSON.stringify({ action: "get_products" }),
    });
    const res = await shopifyService(req, mockSupabaseClient as any);
    const data = await res.json();
    assertEquals(data.data.nextPageInfo, 'next-page-token');
  });

  await t.step("get_content action should fetch a single product", async () => {
    mockApiResponse = { product: { id: 1, title: 'Single Product', body_html: 'Content' } };
     const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Authorization": "Bearer valid-token" },
      body: JSON.stringify({ action: "get_content", productId: 1 }),
    });
    const res = await shopifyService(req, mockSupabaseClient as any);
    const data = await res.json();
    assertEquals(res.status, 200);
    assertEquals(data.data.title, "Single Product");
  });

  await t.step("publish action should succeed", async () => {
    mockApiResponse = { product: { id: 20, title: 'New Product' } };
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Authorization": "Bearer valid-token" },
      body: JSON.stringify({ action: "publish", product: { title: "New Product", body_html: "Desc" } }),
    });
    const res = await shopifyService(req, mockSupabaseClient as any);
    const data = await res.json();
    assertEquals(res.status, 200);
    assertEquals(data.success, true);
    assertEquals(data.data.id, 20);
  });
});

// Restore original fetch after tests
globalThis.fetch = originalFetch;
