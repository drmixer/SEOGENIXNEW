import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// Define CORS headers locally
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
};
// --- Database Logging Helpers ---
async function logToolRun(supabase, projectId, toolName, inputPayload) {
  if (!projectId) {
    throw new Error("logToolRun error: projectId is required.");
  }
  console.log(`Logging tool run: ${toolName} for project: ${projectId}`);
  const { data, error } = await supabase.from("tool_runs").insert({
    project_id: projectId,
    tool_name: toolName,
    input_payload: inputPayload,
    status: "running",
    created_at: new Date().toISOString()
  }).select("id").single();
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
async function updateToolRun(supabase, runId, status, outputPayload, errorMessage) {
  if (!runId) {
    console.error("updateToolRun error: runId is required.");
    return;
  }
  console.log(`Updating tool run ${runId} with status: ${status}`);
  // CRITICAL FIX: Use the correct field name 'output_payload' not 'output'
  const update = {
    status,
    completed_at: new Date().toISOString(),
    output_payload: errorMessage ? {
      error: errorMessage
    } : outputPayload || null,
    error_message: errorMessage || null
  };
  const { error } = await supabase.from("tool_runs").update(update).eq("id", runId);
  if (error) {
    console.error(`Error updating tool run ID ${runId}:`, error);
  } else {
    console.log(`Tool run ${runId} updated successfully`);
  }
}
export const handler = async (req, supabase)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  let runId = null;
  try {
    // Extract projectId from query params for logging
    const url = new URL(req.url);
    const projectId = url.searchParams.get('projectId');
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Authorization header required');
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) throw new Error('Invalid authentication');
    // Log tool run if projectId is provided
    if (projectId) {
      runId = await logToolRun(supabase, projectId, 'get-integrations', {
        userId: user.id
      });
    }
    console.log(`Fetching integrations for user: ${user.id}`);
    const { data, error } = await supabase.from('cms_integrations').select('id, cms_type, cms_name, site_url, status, created_at').eq('user_id', user.id).order('created_at', {
      ascending: false
    });
    if (error) throw error;
    const output = {
      success: true,
      integrations: data || []
    };
    if (runId) {
      await updateToolRun(supabase, runId, 'completed', output, null);
    }
    console.log(`Retrieved ${data?.length || 0} integrations`);
    return new Response(JSON.stringify({
      success: true,
      data: output,
      runId
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
    const errorCode = err instanceof Error ? err.name : 'UNKNOWN_ERROR';
    console.error('Get integrations error:', errorMessage);
    if (runId) {
      await updateToolRun(supabase, runId, 'error', null, errorMessage);
    }
    return new Response(JSON.stringify({
      success: false,
      error: {
        message: errorMessage,
        code: errorCode
      },
      runId
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
};
Deno.serve(async (req)=>{
  const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  return await handler(req, supabase);
});
