import { serve } from "https://deno.land/std@0.200.0/http/server.ts";
import { logToolRun } from 'shared/logToolRun.ts';
import { updateToolRun } from 'shared/updateToolRun.ts';
import { competitorDiscoveryHandler } from './competitorDiscoveryHandler.ts';

serve(async (req: Request) => {
  const { projectId, input } = await req.json();
  const runId = await logToolRun({ projectId, toolName: 'competitor-discovery', inputPayload: input });
  try {
    const output = await competitorDiscoveryHandler(input);
    await updateToolRun({ runId, status: 'completed', outputPayload: output });
    return new Response(JSON.stringify({ runId, output }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    await updateToolRun({ runId, status: 'error', errorMessage: (err as any).message });
    return new Response(JSON.stringify({ runId, error: (err as any).message }), { status: 500 });
  }
});
