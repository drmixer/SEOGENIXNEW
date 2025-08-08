import { supabase } from '../../utils/supabaseClient';

/**
 * Inserts a new tool run row with status 'pending' and returns the generated id.
 * @param {object} params
 * @param {string} params.projectId - The project UUID
 * @param {string} params.toolName - Name of the tool
 * @param {any} params.inputPayload - The input payload (will be stored as JSON)
 * @returns {Promise&lt;string&gt;} The id of the inserted tool_run
 */
export async function logToolRun({
  projectId,
  toolName,
  inputPayload,
}: {
  projectId: string;
  toolName: string;
  inputPayload: any;
}): Promise&lt;string&gt; {
  const { data, error } = await supabase
    .from('tool_runs')
    .insert([
      {
        project_id: projectId,
        tool_name: toolName,
        input_payload: inputPayload,
        status: 'pending',
        // started_at will default to now() via table default
      },
    ])
    .select('id')
    .single();

  if (error) {
    console.error('Error inserting tool_run:', error);
    throw new Error('Failed to log tool run');
  }

  if (!data?.id) {
    throw new Error('No tool_run id returned from insert');
  }

  return data.id;
}