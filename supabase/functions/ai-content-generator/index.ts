import { serve } from "https://deno.land/std@0.200.0/http/server.ts";
import { logToolRun } from '../_shared/logToolRun.ts';
import { updateToolRun } from '../_shared/updateToolRun.ts';
import { aiContentGeneratorHandler } from './aiContentGeneratorHandler.ts';

serve(async (req: Request) => {
  try {
    const { projectId, input } = await req.json();
    const runId = await logToolRun({ projectId, toolName: 'ai-content-generator', inputPayload: input });
    const output = await aiContentGeneratorHandler(input);
    await updateToolRun({ runId, status: 'completed', outputPayload: output });
    return new Response(JSON.stringify({ runId, output }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error(err);
    if (typeof err === 'object' && 'message' in err) {
      const runId = (err as any).runId;
      if (runId) {
        await updateToolRun({ runId, status: 'error', errorMessage: (err as any).message });
      }
    }
    return new Response(JSON.stringify({ error: (err as any).message || 'Unknown error' }), { status: 500 });
  }
});
