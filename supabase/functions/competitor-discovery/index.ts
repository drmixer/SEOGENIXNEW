import { serve } from "https://deno.land/std@0.200.0/http/server.ts";
import { logToolRun } from '../_shared/logToolRun';
import { updateToolRun } from '../_shared/updateToolRun';
import { supabase } from '../../utils/supabaseClient';
import { competitorDiscoveryHandler } from './competitorDiscoveryHandler';

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }
  let runId;
  try {
    const { projectId, input } = await req.json();

    runId = await logToolRun({
      projectId,
      toolName: 'competitor-discovery',
      inputPayload: input,
    });

    const output = await competitorDiscoveryHandler(input);

    await updateToolRun({
      runId,
      status: 'completed',
      outputPayload: output,
    });

    return Response.json({ runId, output });
  } catch (err: any) {
    if (runId) {
      await updateToolRun({
        runId,
        status: 'error',
        errorMessage: err.message ?? String(err),
      });
    }
    return new Response('Internal Server Error', { status: 500 });
  }
});