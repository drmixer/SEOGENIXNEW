import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- Standard CORS Headers ---
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// --- Standard Error Response ---
export function createErrorResponse(message: string, status: number = 500) {
  return new Response(JSON.stringify({ success: false, error: { message } }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// --- Standard Success Response ---
export function createSuccessResponse(data: object, status: number = 200) {
  return new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// --- Type for the actual tool logic ---
export type ToolLogic = (req: Request, supabase: SupabaseClient) => Promise<Response>;

// --- Standard Service Handler ---
export async function serviceHandler(req: Request, toolLogic: ToolLogic): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    return await toolLogic(req, supabase);

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'An unknown server error occurred.';
    console.error(`[ServiceHandler Error] ${errorMessage}`, err);
    return createErrorResponse(errorMessage);
  }
}
