import { supabase } from 'utils/supabaseClient.ts';

export async function updateToolRun({ runId, status, outputPayload, errorMessage }: {
  runId: string;
  status: 'completed' | 'error';
  outputPayload?: any;
  errorMessage?: string;
}): Promise<void> {
  const update: Record<string, any> = { status, completed_at: new Date().toISOString() };
  if (status === 'completed') update.output_payload = outputPayload ?? null;
  if (status === 'error') update.error_message = errorMessage ?? 'Unknown error';
  const { error } = await supabase.from('tool_runs').update(update).eq('id', runId);
  if (error) throw error;
}
