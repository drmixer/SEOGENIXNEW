import { serve } from "https://deno.land/std@0.200.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logToolRun } from "shared/logToolRun.ts";
import { updateToolRun } from "shared/updateToolRun.ts";
import { corsHeaders } from "shared/cors.ts";
import { aiContentGeneratorHandler } from "./aiContentGeneratorHandler.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let runId;
  try {
    const { projectId, input } = await req.json();
    const effectiveProjectId = projectId || input.projectId || null;

    runId = await logToolRun({
      projectId: effectiveProjectId,
      toolName: 'ai-content-generator',
      inputPayload: input
    });

    const output = await aiContentGeneratorHandler(input);

    await updateToolRun({
      runId,
      status: 'completed',
      outputPayload: output
    });

    return new Response(JSON.stringify({ runId, output }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';

    if (runId) {
      await updateToolRun({
        runId,
        status: 'error',
        errorMessage: errorMessage,
      });
    }

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
