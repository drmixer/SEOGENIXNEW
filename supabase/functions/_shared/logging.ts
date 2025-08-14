import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function logToolRun(supabase: SupabaseClient, projectId: string, toolName: string, inputPayload: object): Promise<string> {
  if (!projectId) {
    throw new Error("logToolRun error: projectId is required.");
  }
  
  console.log(`Logging tool run: ${toolName} for project: ${projectId}`);
  
  const { data, error } = await supabase
    .from("tool_runs")
    .insert({
      project_id: projectId,
      tool_name: toolName,
      input_payload: inputPayload,
      status: "running",
      created_at: new Date().toISOString()
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error logging tool run:", error);
    throw new Error(`Failed to log tool run. Supabase error: ${error.message}`);
  }
  
  if (!data || !data.id) {
    console.error("No data or data.id returned from tool_runs insert.");
    throw new Error("Failed to log tool run: No data returned after insert.");
  }
  
  console.log(`Tool run logged with ID: ${data.id}`);
  return data.id;
}

export async function updateToolRun(supabase: SupabaseClient, runId: string, status: string, outputPayload: object | null, errorMessage: string | null): Promise<void> {
  if (!runId) {
    console.error("updateToolRun error: runId is required.");
    return;
  }

  console.log(`Updating tool run ${runId} with status: ${status}`);

  // CRITICAL FIX: Use the correct field name 'output_payload' not 'output'
  const update = {
    status,
    completed_at: new Date().toISOString(),
    output_payload: errorMessage ? { error: errorMessage } : outputPayload || null,
    error_message: errorMessage || null,
  };

  const { error } = await supabase.from("tool_runs").update(update).eq("id", runId);
  if (error) {
    console.error(`Error updating tool run ID ${runId}:`, error);
  } else {
    console.log(`Tool run ${runId} updated successfully`);
  }
}
