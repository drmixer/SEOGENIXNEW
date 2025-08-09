import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

function generateEnhancedCSVReport(reportType: string, data: any, config: any) {
  let csv = '';
  if (reportType === 'audit' && data.auditHistory) {
    csv = 'Date,Website,Overall Score\n';
    data.auditHistory.forEach((audit: any) => {
      csv += `${audit.created_at},${audit.website_url},${audit.overall_score}\n`;
    });
  }
  return csv;
}

function generateEnhancedPDFReport(reportType: string, data: any, reportName: string, template: any, config: any, whiteLabel: any) {
  const companyName = whiteLabel?.company_name || 'SEOGENIX';
  const primaryColor = whiteLabel?.primary_color_hex || '#8B5CF6';
  return `
    <!DOCTYPE html><html><head><title>${reportName}</title></head>
    <body style="font-family: sans-serif;">
      <h1 style="color: ${primaryColor};">${companyName}</h1>
      <h2>${reportName}</h2>
      <p>Report Type: ${reportType}</p>
      <pre>${JSON.stringify(data, null, 2)}</pre>
    </body></html>`;
}

export async function enhancedReportGenerationHandler(
  supabase: SupabaseClient,
  req: Request,
  input: any
) {
  const { reportType, reportData, reportName, format, template, config } = input;

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw new Error('Authorization header required');
  const token = authHeader.replace('Bearer ', '');
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) throw new Error('Invalid authentication');

  let whiteLabel = null;
  if (config?.brandingOptions?.includeLogo) {
    try {
      const { data: whiteLabelData } = await supabase.from('white_label_settings').select('*').eq('user_id', user.id).single();
      if (whiteLabelData) whiteLabel = whiteLabelData;
    } catch (error) {
      console.error('Error fetching white label settings:', error);
    }
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
    reportContent = JSON.stringify({ ...reportData, generatedAt: new Date().toISOString() }, null, 2);
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
  if (dbError) console.error('Error saving report metadata:', dbError);

  const viewerUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/report-viewer?reportId=${reportRecord?.id}`;

  return {
    success: true,
    fileName,
    downloadUrl,
    viewerUrl,
    reportId: reportRecord?.id
  };
}
