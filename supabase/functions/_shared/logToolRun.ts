import { supabase } from '../../utils/supabaseClient.ts';

export async function logToolRun({
  projectId,
  toolName,
  inputPayload,
}: {
  projectId: string;
  toolName: string;
  inputPayload: any;
}): Promise<string> {
  const { data, error } = await supabase
    .from('tool_runs')
    .insert([{ project_id: projectId, tool_name: toolName, input_payload: inputPayload, status: 'pending' }])
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}
