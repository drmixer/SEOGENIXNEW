import { logToolRun } from 'shared/logToolRun';
import { updateToolRun } from 'shared/updateToolRun';
import { visibilityAuditHandler } from './visibilityAuditHandler';

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: { projectId: string; input: any };
  try {
    body = await req.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { projectId, input } = body;

  let runId: string | undefined;

  try {
    runId = await logToolRun({
      projectId,
      toolName: 'ai-visibility-audit',
      inputPayload: input,
    });

    const output = await visibilityAuditHandler(input);

    await updateToolRun({
      runId,
      status: 'completed',
      outputPayload: output,
    });

    return new Response(JSON.stringify({ runId, output }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    const errorMessage = error?.message || 'Unknown error';
    if (runId) {
      try {
        await updateToolRun({
          runId,
          status: 'error',
          errorMessage,
        });
      } catch (updateError) {
        // Log but don't overwrite original error response
        console.error('Failed to update tool run status on error:', updateError);
      }
    }
    return new Response(JSON.stringify({ runId, error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}