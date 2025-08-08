import { serve } from "https://deno.land/std@0.200.0/http/server.ts";
import { logToolRun } from '../_shared/logToolRun.ts';
import { updateToolRun } from '../_shared/updateToolRun.ts';
import { contentOptimizerHandler } from './contentOptimizerHandler.ts';

serve(async (req: Request) => {
  const { projectId, input } = await req.json();
  const runId = await logToolRun({ projectId, toolName: 'content-optimizer', inputPayload: input });
  try {
    const output = await contentOptimizerHandler(input);
    await updateToolRun({ runId, status: 'completed', outputPayload: output });
    return new Response(JSON.stringify({ runId, output }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    await updateToolRun({ runId, status: 'error', errorMessage: (err as any).message });
    return new Response(JSON.stringify({ runId, error: (err as any).message }), { status: 500 });
  }
});
