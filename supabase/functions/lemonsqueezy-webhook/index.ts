import { serve } from "https://deno.land/std@0.200.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { lemonsqueezyWebhookHandler } from "./lemonsqueezyWebhookHandler.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const output = await lemonsqueezyWebhookHandler(supabase, req);
    return new Response(JSON.stringify(output), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Lemonsqueezy webhook error:", err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    
    // For webhooks, it's crucial to return a non-500 status for handled errors
    // to prevent the sender from retrying indefinitely.
    const status = err.message === "Invalid webhook signature" ? 401 : 400;

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
