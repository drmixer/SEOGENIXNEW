import { corsHeaders } from '../_shared/cors.ts';

interface ReportRequest {
  reportType: 'audit' | 'competitive' | 'citation' | 'comprehensive';
  reportData: any;
  reportName: string;
  format: 'pdf' | 'csv' | 'json';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { reportType, reportData, reportName, format }: ReportRequest = await req.json();

    // Generate report content based on type and format
    let reportContent = '';
    let contentType = 'application/json';
    let fileExtension = 'json';

    if (format === 'csv') {
      contentType = 'text/csv';
      fileExtension = 'csv';
      reportContent = generateCSVReport(reportType, reportData);
    } else if (format === 'pdf') {
      contentType = 'application/pdf';
      fileExtension = 'pdf';
      reportContent = generatePDFReport(reportType, reportData, reportName);
    } else {
      reportContent = JSON.stringify(reportData, null, 2);
    }

    // In a real implementation, you would:
    // 1. Generate the actual file content
    // 2. Upload to cloud storage (like Supabase Storage)
    // 3. Return the download URL

    // For now, we'll simulate this
    const fileName = `${reportName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.${fileExtension}`;
    const downloadUrl = `https://example.com/reports/${fileName}`;

    return new Response(
      JSON.stringify({
        success: true,
        fileName,
        downloadUrl,
        reportType,
        format,
        generatedAt: new Date().toISOString(),
        // In development, include the content for preview
        content: format === 'json' ? reportData : reportContent.substring(0, 1000) + '...'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Report generation error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate report',
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function generateCSVReport(reportType: string, data: any): string {
  let csv = '';
  
  if (reportType === 'audit' && data.auditHistory) {
    csv = 'Date,Website,Overall Score,AI Understanding,Citation Likelihood,Conversational Readiness,Content Structure\n';
    
    data.auditHistory.forEach((audit: any) => {
      csv += `${audit.created_at},${audit.website_url},${audit.overall_score},${audit.ai_understanding},${audit.citation_likelihood},${audit.conversational_readiness},${audit.content_structure}\n`;
    });
  } else if (reportType === 'comprehensive') {
    csv = 'Metric,Value\n';
    csv += `Total Audits,${data.auditHistory?.length || 0}\n`;
    csv += `Average Score,${data.auditHistory?.reduce((sum: number, a: any) => sum + a.overall_score, 0) / (data.auditHistory?.length || 1)}\n`;
    csv += `Industry,${data.profile?.industry || 'Not specified'}\n`;
    csv += `Websites,${data.profile?.websites?.length || 0}\n`;
  }
  
  return csv;
}

function generatePDFReport(reportType: string, data: any, reportName: string): string {
  // In a real implementation, you would use a PDF generation library
  // For now, return HTML that could be converted to PDF
  
  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${reportName}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { border-bottom: 2px solid #8B5CF6; padding-bottom: 20px; margin-bottom: 30px; }
        .score { font-size: 48px; font-weight: bold; color: #8B5CF6; }
        .metric { margin: 10px 0; padding: 10px; background: #f8f9fa; border-radius: 5px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #8B5CF6; color: white; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${reportName}</h1>
        <p>Generated on ${new Date().toLocaleDateString()}</p>
        <p>Report Type: ${reportType.charAt(0).toUpperCase() + reportType.slice(1)}</p>
      </div>
  `;

  if (reportType === 'audit' && data.auditHistory) {
    const latest = data.auditHistory[0];
    const average = data.auditHistory.reduce((sum: number, a: any) => sum + a.overall_score, 0) / data.auditHistory.length;
    
    html += `
      <div class="metric">
        <h2>Current AI Visibility Score</h2>
        <div class="score">${latest?.overall_score || 0}/100</div>
      </div>
      
      <div class="metric">
        <h3>Average Score: ${Math.round(average)}/100</h3>
        <p>Based on ${data.auditHistory.length} audits</p>
      </div>
      
      <h3>Recent Audit History</h3>
      <table>
        <tr>
          <th>Date</th>
          <th>Website</th>
          <th>Score</th>
          <th>AI Understanding</th>
          <th>Citation Likelihood</th>
        </tr>
    `;
    
    data.auditHistory.slice(0, 10).forEach((audit: any) => {
      html += `
        <tr>
          <td>${new Date(audit.created_at).toLocaleDateString()}</td>
          <td>${audit.website_url}</td>
          <td>${audit.overall_score}</td>
          <td>${audit.ai_understanding}</td>
          <td>${audit.citation_likelihood}</td>
        </tr>
      `;
    });
    
    html += '</table>';
  }

  html += `
      <div style="margin-top: 50px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
        <p>Generated by SEOGENIX - AI-Powered SEO Platform</p>
      </div>
    </body>
    </html>
  `;

  return html;
}