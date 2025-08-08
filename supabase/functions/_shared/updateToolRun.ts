import { supabase } from '../../utils/supabaseClient';

/**
 * Updates status, output_payload or error_message, and completed_at for a tool_run.
 * @param {object} params
 * @param {string} params.runId - tool_run UUID
 * @param {'completed'|'error'} params.status - Status to set
 * @param {any} [params.outputPayload] - Output payload (for completed runs)
 * @param {string} [params.errorMessage] - Error message (for failed runs)
 */
export async function updateToolRun({
  runId,
  status,
  outputPayload,
  errorMessage,
}: {
  runId: string;
  status: 'completed' | 'error';
  outputPayload?: any;
  errorMessage?: string;
}): Promise&lt;void&gt; {
  const update: Record&lt;string, any&gt; = {
    status,
    completed_at: new Date().toISOString(),
  };

  if (status === 'completed') {
    update.output_payload = outputPayload ?? null;
    update.error_message = null;
  }
  if (status === 'error') {
    update.output_payload = null;
    update.error_message = errorMessage || 'Unknown error';
  }

  const { error } = await supabase
    .from('tool_runs')
    .update(update)
    .eq('id', runId);

  if (error) {
    console.error('Error updating tool_run:', error);
    throw new Error('Failed to update tool run');
  }
}