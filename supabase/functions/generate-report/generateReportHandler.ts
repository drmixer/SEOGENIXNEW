import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

function generateCSVReport(reportType: string, data: any) {
    let csv = '';
    if (reportType === 'audit' && data.auditHistory) {
        csv = 'Date,Website,Overall Score\n';
        data.auditHistory.forEach((audit: any) => {
            csv += `${audit.created_at},${audit.website_url},${audit.overall_score}\n`;
        });
    }
    return csv;
}

function generateHTMLReport(reportType: string, data: any, reportName: string) {
    return `
      <!DOCTYPE html><html><head><title>${reportName}</title></head>
      <body><h1>${reportName}</h1><p>Report Type: ${reportType}</p>
      <pre>${JSON.stringify(data, null, 2)}</pre>
      </body></html>`;
}

export async function generateReportHandler(
  supabase: SupabaseClient,
  req: Request,
  input: any
) {
  const { reportType, reportData, reportName, format } = input;

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw new Error('Authorization header required');
  const token = authHeader.replace('Bearer ', '');
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) throw new Error('Invalid authentication');

  let reportContent = '';
  let contentType = 'application/json';
  let fileExtension = 'json';

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

  const { error: uploadError } = await supabase.storage.from('reports').upload(storagePath, reportContent, { contentType, upsert: true });
  if (uploadError) throw new Error(`Failed to upload report: ${uploadError.message}`);

  const { data: urlData } = supabase.storage.from('reports').getPublicUrl(storagePath);
  const downloadUrl = urlData.publicUrl;

  const { data: reportRecord, error: dbError } = await supabase.from('reports').insert({
    user_id: user.id,
    report_type: reportType,
    report_name: reportName,
    report_data: reportData,
    file_url: downloadUrl,
    storage_path: storagePath
  }).select().single();

  if (dbError) console.error('Error saving report metadata:', dbError?.message);

  return {
    success: true,
    fileName,
    downloadUrl,
    reportId: reportRecord?.id
  };
}
