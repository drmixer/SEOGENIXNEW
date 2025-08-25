import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// Self-contained CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE'
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
const reportViewerService = async (req, supabase)=>{
  let runId = null;
  try {
    let reportId, format = 'html', download = false, projectId;
    if (req.method === 'GET') {
      const url = new URL(req.url);
      reportId = url.searchParams.get('reportId') || '';
      format = url.searchParams.get('format') || 'html';
      download = url.searchParams.get('download') === 'true';
      projectId = url.searchParams.get('projectId');
    } else {
      const data = await req.json();
      reportId = data.reportId;
      format = data.format || 'html';
      download = data.download || false;
      projectId = data.projectId;
    }
    if (!reportId) throw new Error('Report ID is required');
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error(`Invalid authentication: ${authError?.message}`);
    // Log tool run if projectId is provided
    if (projectId) {
      runId = await logToolRun(supabase, projectId, 'report-viewer', {
        reportId,
        format,
        download,
        userId: user.id
      });
    }
    console.log(`Fetching report: ${reportId} for user: ${user.id}`);
    const { data: report, error: reportError } = await supabase.from('reports').select('*').eq('id', reportId).eq('user_id', user.id).single();
    if (reportError || !report) {
      throw new Error(`Report not found: ${reportError?.message || 'Report does not exist or access denied'}`);
    }
    if (!report.file_url) {
      throw new Error('Report file URL not found');
    }
    console.log(`Fetching report file from: ${report.file_url}`);
    const fileResponse = await fetch(report.file_url);
    if (!fileResponse.ok) {
      throw new Error(`Failed to fetch report file: ${fileResponse.statusText}`);
    }
    const fileContent = await fileResponse.text();
    const contentTypes = {
      html: 'text/html; charset=utf-8',
      csv: 'text/csv; charset=utf-8',
      json: 'application/json; charset=utf-8'
    };
    const contentType = contentTypes[format] || 'text/plain; charset=utf-8';
    const disposition = download ? 'attachment' : 'inline';
    const filename = `${report.report_name.replace(/\s+/g, '_')}.${format}`;
    const output = {
      success: true,
      reportId,
      format,
      download,
      filename,
      contentLength: fileContent.length,
      viewedAt: new Date().toISOString()
    };
    if (runId) {
      await updateToolRun(supabase, runId, 'completed', output, null);
    }
    console.log(`Successfully served report: ${reportId} (${fileContent.length} bytes)`);
    return new Response(fileContent, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `${disposition}; filename="${filename}"`,
        'Content-Length': fileContent.length.toString(),
        'Cache-Control': 'private, max-age=300',
        ...corsHeaders
      }
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
    console.error('Report viewer error:', errorMessage);
    if (runId) {
      await updateToolRun(supabase, runId, 'error', null, errorMessage);
    }
    return new Response(JSON.stringify({
      success: false,
      error: {
        message: errorMessage
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
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  return await reportViewerService(req, supabase);
});
