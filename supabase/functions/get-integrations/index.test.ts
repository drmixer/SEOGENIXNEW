import { assertEquals, assert } from "https://deno.land/std@0.140.0/testing/asserts.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handler } from "./index.ts"; // Assuming the handler is exported

// Mock Supabase client
const mockSupabaseClient = {
  auth: {
    getUser: async (token: string) => {
      if (token === "valid-token") {
        return { data: { user: { id: "user-123" } }, error: null };
      }
      return { data: { user: null }, error: new Error("Invalid token") };
    },
  },
  from: (table: string) => {
    if (table === "cms_integrations") {
      return {
        select: () => ({
          eq: (column: string, value: string) => {
            if (column === "user_id" && value === "user-123") {
              return Promise.resolve({
                data: [
                  { id: "int-1", cms_type: "wordpress", cms_name: "My Blog", site_url: "https://blog.example.com" },
                  { id: "int-2", cms_type: "shopify", cms_name: "My Store", site_url: "https://store.example.com" },
                ],
                error: null,
              });
            }
            return Promise.resolve({ data: [], error: null });
          },
        }),
      };
    }
    return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) };
  },
};

Deno.test("get-integrations handler", async (t) => {
  await t.step("should return a list of integrations for a valid user", async () => {
    const req = new Request("http://localhost/get-integrations", {
      method: "GET",
      headers: { "Authorization": "Bearer valid-token" },
    });

    const response = await handler(req, mockSupabaseClient as any);
    const data = await response.json();

    assertEquals(response.status, 200);
    assertEquals(data.success, true);
    assertEquals(data.data.length, 2);
    assertEquals(data.data[0].cms_type, "wordpress");
    assertEquals(data.data[1].cms_name, "My Store");
  });

  await t.step("should return an error for an invalid token", async () => {
    const req = new Request("http://localhost/get-integrations", {
      method: "GET",
      headers: { "Authorization": "Bearer invalid-token" },
    });

    const response = await handler(req, mockSupabaseClient as any);
    const data = await response.json();

    assertEquals(response.status, 500);
    assertEquals(data.success, false);
    assert(data.error.message.includes("Invalid authentication"));
  });

  await t.step("should handle OPTIONS request", async () => {
    const req = new Request("http://localhost/get-integrations", { method: "OPTIONS" });
    const response = await handler(req, mockSupabaseClient as any);
    assertEquals(response.status, 200);
    const text = await response.text();
    assertEquals(text, 'ok');
  });
});
