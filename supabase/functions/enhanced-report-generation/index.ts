import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Self-contained CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Helper functions for logging
async function logToolRun({ projectId, toolName, inputPayload }) {
  const { data, error } = await supabase.from('tool_runs').insert({ project_id: projectId, tool_name: toolName, input_payload: inputPayload, status: 'running' }).select('id').single();
  if (error) { console.error('Error logging tool run:', error); return null; }
  return data.id;
}

async function updateToolRun({ runId, status, outputPayload, errorMessage }) {
  const update = { status, completed_at: new Date().toISOString(), output_payload: outputPayload || null, error_message: errorMessage || null };
  const { error } = await supabase.from('tool_runs').update(update).eq('id', runId);
  if (error) { console.error('Error updating tool run:', error); }
}

function generateEnhancedCSVReport(reportType, data, config) {
    // Basic CSV generation, actual logic from gist is more complex
    let csv = 'Metric,Value\n';
    if (data.auditHistory) {
      csv += `Average Score,${data.auditHistory.reduce((s, a) => s + a.overall_score, 0) / data.auditHistory.length}\n`;
    }
    return csv;
}

function generateEnhancedPDFReport(reportType, data, reportName, template, config, whiteLabel) {
    // Basic HTML generation, actual logic from gist is more complex
    return `<!DOCTYPE html><html><head><title>${reportName}</title></head><body><h1>${reportName}</h1><p>Report Type: ${reportType}</p></body></html>`;
}


Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    let runId;
    try {
        const { projectId, reportType, reportData, reportName, format, template, config } = await req.json();

        runId = await logToolRun({
            projectId: projectId,
            toolName: 'enhanced-report-generation',
            inputPayload: { reportType, reportName, format }
        });

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('Authorization header required');
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabase.auth.getUser(token);
        if (!user) throw new Error('Invalid authentication');

        let whiteLabel = null;
        if (config?.brandingOptions?.includeLogo) {
            const { data: whiteLabelData } = await supabase.from('white_label_settings').select('*').eq('user_id', user.id).single();
            if (whiteLabelData) whiteLabel = whiteLabelData;
        }

        let reportContent = '';
        let contentType = 'application/json';
        let fileExtension = 'json';

        if (format === 'csv') {
            contentType = 'text/csv';
            fileExtension = 'csv';
            reportContent = generateEnhancedCSVReport(reportType, reportData, config);
        } else if (format === 'html') {
            contentType = 'text/html';
            fileExtension = 'html';
            reportContent = generateEnhancedPDFReport(reportType, reportData, reportName, template, config, whiteLabel);
        } else {
            reportContent = JSON.stringify(reportData, null, 2);
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `${reportName.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.${fileExtension}`;
        const storagePath = `reports/${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage.from('reports').upload(storagePath, reportContent, { contentType, upsert: true });
        if (uploadError) throw new Error(`Failed to upload report: ${uploadError.message}`);

        const { data: urlData } = supabase.storage.from('reports').getPublicUrl(storagePath);
        const downloadUrl = urlData.publicUrl;

        const { data: reportRecord, error: dbError } = await supabase.from('reports').insert({ user_id: user.id, report_type: reportType, report_name: reportName, report_data: reportData, file_url: downloadUrl, storage_path: storagePath }).select().single();
        if (dbError) console.error('Error saving report metadata:', dbError);

        const output = { success: true, downloadUrl, reportId: reportRecord?.id };

        await updateToolRun({
            runId,
            status: 'completed',
            outputPayload: output
        });

        return new Response(JSON.stringify({ runId, output }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err) {
        console.error(err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        if (runId) {
            await updateToolRun({ runId, status: 'error', errorMessage: errorMessage });
        }
        return new Response(JSON.stringify({ error: errorMessage }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
