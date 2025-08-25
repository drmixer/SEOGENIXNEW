import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// Self-contained CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE'
};
// Helper functions for logging
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
function generateCSVReport(reportType, data) {
  let csv = '';
  if (reportType === 'audit' && data.auditHistory) {
    csv = 'Date,Website,Overall Score\n';
    data.auditHistory.forEach((audit)=>{
      csv += `${audit.created_at},${audit.website_url},${audit.overall_score}\n`;
    });
  }
  return csv;
}
function generateHTMLReport(reportType, data, reportName) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${reportName}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #333; }
        .report-meta { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .audit-item { border: 1px solid #ddd; margin: 10px 0; padding: 15px; border-radius: 5px; }
        .score { font-weight: bold; color: #2563eb; }
    </style>
</head>
<body>
    <h1>${reportName}</h1>
    <div class="report-meta">
        <p><strong>Generated:</strong> ${new Date().toISOString()}</p>
        <p><strong>Report Type:</strong> ${reportType}</p>
    </div>
    ${reportType === 'audit' && data.auditHistory ? data.auditHistory.map((audit)=>`
            <div class="audit-item">
                <h3>${audit.website_url}</h3>
                <p class="score">Overall Score: ${audit.overall_score}/100</p>
                <p><strong>Date:</strong> ${audit.created_at}</p>
            </div>
        `).join('') : '<p>No audit data available</p>'}
</body>
</html>`;
}
const generateReportService = async (req, supabase)=>{
  let runId = null;
  try {
    const { projectId, reportType, reportData, reportName, format } = await req.json();
    if (!projectId) {
      throw new Error('projectId is required.');
    }
    runId = await logToolRun(supabase, projectId, 'generate-report', {
      reportType,
      reportName,
      format
    });
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Authorization header required');
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) throw new Error('Invalid authentication');
    let reportContent = '';
    let contentType = 'application/json';
    let fileExtension = 'json';
    console.log(`Generating ${format} report for type: ${reportType}`);
    if (format === 'csv') {
      contentType = 'text/csv';
      fileExtension = 'csv';
      reportContent = generateCSVReport(reportType, reportData);
    } else if (format === 'html') {
      contentType = 'text/html';
      fileExtension = 'html';
      reportContent = generateHTMLReport(reportType, reportData, reportName);
    } else {
      reportContent = JSON.stringify(reportData, null, 2);
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${reportName.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.${fileExtension}`;
    const storagePath = `reports/${user.id}/${fileName}`;
    console.log(`Uploading report to storage: ${storagePath}`);
    const { error: uploadError } = await supabase.storage.from('reports').upload(storagePath, reportContent, {
      contentType,
      upsert: true
    });
    if (uploadError) throw new Error(`Failed to upload report: ${uploadError.message}`);
    const { data: urlData } = supabase.storage.from('reports').getPublicUrl(storagePath);
    const downloadUrl = urlData.publicUrl;
    console.log('Saving report metadata to database');
    const { data: reportRecord, error: dbError } = await supabase.from('reports').insert({
      user_id: user.id,
      report_type: reportType,
      report_name: reportName,
      report_data: reportData,
      file_url: downloadUrl,
      storage_path: storagePath
    }).select().single();
    if (dbError) {
      console.error('Error saving report metadata:', dbError);
    // Continue anyway, as the file was uploaded successfully
    }
    const output = {
      success: true,
      downloadUrl,
      reportId: reportRecord?.id,
      fileName,
      format,
      contentType
    };
    console.log('Report generation completed successfully');
    await updateToolRun(supabase, runId, 'completed', output, null);
    return new Response(JSON.stringify({
      success: true,
      data: output,
      runId
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
    console.error('Generate report error:', errorMessage);
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
  return await generateReportService(req, supabase);
});
