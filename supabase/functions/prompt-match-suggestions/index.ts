import { serve } from 'std/server';
import { logToolRun } from '../_shared/logToolRun';
import { updateToolRun } from '../_shared/updateToolRun';
import { supabase } from '../../utils/supabaseClient';
import { promptMatchSuggestionsHandler } from './promptMatchSuggestionsHandler';

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }
  let runId;
  try {
    const { projectId, input } = await req.json();

    runId = await logToolRun({
      projectId,
      toolName: 'prompt-match-suggestions',
      inputPayload: input,
    });

    const output = await promptMatchSuggestionsHandler(input);

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