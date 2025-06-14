import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

interface ReportRequest {
  reportType: 'audit' | 'competitive' | 'citation' | 'comprehensive' | 'roi_focused';
  reportData: any;
  reportName: string;
  format: 'html' | 'csv' | 'json';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { reportType, reportData, reportName, format }: ReportRequest = await req.json();
    
    console.log(`Processing report generation request for ${reportType} report: "${reportName}"`);
    console.log(`Format: ${format}`);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Authorization header missing');
      throw new Error('Authorization header required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase configuration missing');
      throw new Error('Supabase configuration missing');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.error('Invalid authentication:', userError);
      throw new Error('Invalid authentication');
    }
    
    console.log(`User authenticated: ${user.id}`);

    // Generate report content based on type and format
    let reportContent = '';
    let contentType = 'application/json';
    let fileExtension = 'json';

    if (format === 'csv') {
      console.log('Generating CSV report');
      contentType = 'text/csv';
      fileExtension = 'csv';
      reportContent = generateCSVReport(reportType, reportData);
    } else if (format === 'html') {
      console.log('Generating HTML report');
      contentType = 'text/html';
      fileExtension = 'html';
      reportContent = generateHTMLReport(reportType, reportData, reportName);
    } else {
      console.log('Generating JSON report');
      reportContent = JSON.stringify(reportData, null, 2);
    }

    // Generate a unique filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${reportName.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.${fileExtension}`;
    
    // Create a storage path for the user
    const storagePath = `reports/${user.id}/${fileName}`;
    
    console.log(`Uploading report to storage: ${storagePath}`);
    
    // Upload the file to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('reports')
      .upload(storagePath, reportContent, {
        contentType,
        upsert: true
      });
    
    if (uploadError) {
      console.error('Failed to upload report:', uploadError);
      throw new Error(`Failed to upload report: ${uploadError.message}`);
    }
    
    // Get a public URL for the file
    const { data: urlData } = await supabase.storage
      .from('reports')
      .getPublicUrl(storagePath);
    
    const downloadUrl = urlData.publicUrl;
    console.log(`Report uploaded successfully. Download URL: ${downloadUrl}`);

    // Save report metadata to the database
    console.log('Saving report metadata to database');
    const { data: reportRecord, error: dbError } = await supabase
      .from('reports')
      .insert({
        user_id: user.id,
        report_type: reportType,
        report_name: reportName,
        report_data: reportData,
        file_url: downloadUrl
      })
      .select()
      .single();
    
    if (dbError) {
      console.error('Error saving report metadata:', dbError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        fileName,
        downloadUrl,
        reportType,
        format,
        generatedAt: new Date().toISOString(),
        reportId: reportRecord?.id
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
  console.log(`Generating CSV content for ${reportType} report`);
  let csv = '';
  
  if (reportType === 'audit' && data.auditHistory) {
    csv = 'Date,Website,Overall Score,AI Understanding,Citation Likelihood,Conversational Readiness,Content Structure\n';
    
    data.auditHistory.forEach((audit: any) => {
      csv += `${audit.created_at},${audit.website_url},${audit.overall_score},${audit.ai_understanding},${audit.citation_likelihood},${audit.conversational_readiness},${audit.content_structure}\n`;
    });
  } else if (reportType === 'competitive' && data.competitorAnalyses) {
    csv = 'Competitor,URL,Overall Score,AI Understanding,Citation Likelihood,Conversational Readiness,Content Structure\n';
    
    data.competitorAnalyses.forEach((comp: any) => {
      csv += `${comp.name},${comp.url},${comp.overallScore},${comp.subscores.aiUnderstanding},${comp.subscores.citationLikelihood},${comp.subscores.conversationalReadiness},${comp.subscores.contentStructure}\n`;
    });
  } else if (reportType === 'citation' && data.citations) {
    csv = 'Source,URL,Snippet,Date,Type,Confidence Score,Match Type\n';
    
    data.citations.forEach((citation: any) => {
      // Escape quotes in CSV fields
      const escapedSnippet = citation.snippet.replace(/"/g, '""');
      csv += `"${citation.source}","${citation.url}","${escapedSnippet}","${citation.date}","${citation.type}",${citation.confidence_score || 0},"${citation.match_type || ''}"\n`;
    });
  } else if (reportType === 'comprehensive') {
    csv = 'Metric,Value\n';
    csv += `Total Audits,${data.auditHistory?.length || 0}\n`;
    csv += `Average Score,${data.auditHistory?.reduce((sum: number, a: any) => sum + a.overall_score, 0) / (data.auditHistory?.length || 1)}\n`;
    csv += `Industry,${data.profile?.industry || 'Not specified'}\n`;
    csv += `Websites,${data.profile?.websites?.length || 0}\n`;
    csv += `Competitors,${data.profile?.competitors?.length || 0}\n`;
  } else if (reportType === 'roi_focused' && data.roiMetrics) {
    csv = 'Metric,Value,Impact\n';
    csv += `Traffic Increase,${data.roiMetrics.estimatedTrafficIncrease}%,Monthly\n`;
    csv += `Revenue Impact,$${data.roiMetrics.estimatedRevenueImpact},Monthly\n`;
    csv += `Cost Savings,$${data.roiMetrics.costSavingsFromAI},Monthly\n`;
    csv += `Competitive Advantage,${data.roiMetrics.competitiveAdvantage} points,Above Industry Average\n`;
    csv += `Payback Period,${data.roiMetrics.paybackPeriod} months,Implementation\n`;
    csv += `Annual ROI,${data.roiMetrics.totalROI}%,Year 1\n`;
  }
  
  return csv;
}

function generateHTMLReport(reportType: string, data: any, reportName: string): string {
  console.log(`Generating HTML content for ${reportType} report`);
  
  // Get branding settings
  const companyName = 'SEOGENIX';
  const primaryColor = '#8B5CF6';
  const secondaryColor = '#14B8A6';
  
  // Enhanced HTML template with better styling and ROI focus
  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${reportName}</title>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
          margin: 0; 
          padding: 40px; 
          color: #1f2937;
          line-height: 1.6;
        }
        .header { 
          border-bottom: 3px solid ${primaryColor}; 
          padding-bottom: 30px; 
          margin-bottom: 40px; 
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .logo-section {
          display: flex;
          align-items: center;
          gap: 15px;
        }
        .company-name {
          font-size: 24px;
          font-weight: bold;
          color: ${primaryColor};
        }
        .report-meta {
          text-align: right;
          color: #6b7280;
        }
        .score { 
          font-size: 48px; 
          font-weight: bold; 
          color: ${primaryColor};
          margin: 0;
        }
        .metric-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin: 30px 0;
        }
        .metric-card { 
          padding: 20px; 
          background: #f8fafc; 
          border-radius: 12px; 
          border-left: 4px solid ${primaryColor};
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .metric-value {
          font-size: 28px;
          font-weight: bold;
          color: #1f2937;
          margin: 0;
        }
        .metric-label {
          color: #6b7280;
          font-size: 14px;
          margin-top: 5px;
        }
        .roi-section {
          background: #ecfdf5;
          border: 2px solid ${secondaryColor};
          border-radius: 16px;
          padding: 30px;
          margin: 30px 0;
        }
        .roi-title {
          color: #065f46;
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .roi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 15px;
        }
        .roi-metric {
          background: white;
          padding: 15px;
          border-radius: 8px;
          text-align: center;
          border: 1px solid #d1fae5;
        }
        .competitive-section {
          background: #fef3c7;
          border: 2px solid #f59e0b;
          border-radius: 16px;
          padding: 30px;
          margin: 30px 0;
        }
        table { 
          width: 100%; 
          border-collapse: collapse; 
          margin: 20px 0; 
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        th, td { 
          border: none; 
          padding: 12px 16px; 
          text-align: left; 
        }
        th { 
          background: ${primaryColor}; 
          color: white; 
          font-weight: 600;
        }
        tr:nth-child(even) { background-color: #f8fafc; }
        .recommendations {
          background: #eff6ff;
          border: 2px solid #3b82f6;
          border-radius: 16px;
          padding: 30px;
          margin: 30px 0;
        }
        .recommendation-item {
          background: white;
          padding: 15px;
          margin: 10px 0;
          border-radius: 8px;
          border-left: 4px solid #3b82f6;
        }
        .footer {
          margin-top: 60px;
          padding-top: 30px;
          border-top: 2px solid #e5e7eb;
          color: #6b7280;
          font-size: 14px;
          display: flex;
          justify-content: space-between;
        }
        .chart-placeholder {
          background: white;
          border-radius: 12px;
          padding: 20px;
          margin: 20px 0;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          height: 300px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #6b7280;
          border: 1px dashed #d1d5db;
        }
        h1, h2, h3, h4, h5, h6 {
          color: #1f2937;
          margin-top: 1.5em;
          margin-bottom: 0.5em;
        }
        p {
          margin-bottom: 1em;
        }
        ul, ol {
          margin-bottom: 1em;
          padding-left: 1.5em;
        }
        li {
          margin-bottom: 0.5em;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo-section">
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="80" height="80" rx="16" fill="${primaryColor}" />
            <path d="M24 40L36 52L56 32" stroke="white" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <div class="company-name">
            ${companyName}
          </div>
        </div>
        <div class="report-meta">
          <h1 style="margin: 0; font-size: 24px;">${reportName}</h1>
          <p>Generated on ${new Date().toLocaleDateString()}</p>
          <p>Report Type: ${reportType.charAt(0).toUpperCase() + reportType.slice(1)}</p>
        </div>
      </div>
  `;

  // Executive Summary Section
  html += `
    <section>
      <h2>Executive Summary</h2>
      <p>This report provides a comprehensive analysis of your AI visibility performance.</p>
      
      <div class="metric-grid">
        <div class="metric-card">
          <p class="metric-value">${data.auditHistory?.[0]?.overall_score || 'N/A'}</p>
          <p class="metric-label">Current AI Visibility Score</p>
        </div>
        
        ${data.auditHistory && data.auditHistory.length > 1 ? `
          <div class="metric-card">
            <p class="metric-value">${data.auditHistory[0].overall_score - data.auditHistory[1].overall_score > 0 ? '+' : ''}${data.auditHistory[0].overall_score - data.auditHistory[1].overall_score}</p>
            <p class="metric-label">Score Change</p>
          </div>
        ` : ''}
        
        <div class="metric-card">
          <p class="metric-value">${data.auditHistory?.length || 0}</p>
          <p class="metric-label">Audits Conducted</p>
        </div>
      </div>
    </section>
  `;

  // ROI Analysis Section (if enabled)
  if (data.roiMetrics) {
    html += `
      <section class="roi-section">
        <h2 class="roi-title">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20ZM14.59 8.59L16 10L12 14L8 10L9.41 8.59L12 11.17L14.59 8.59Z" fill="#065f46"/>
          </svg>
          ROI & Business Impact Analysis
        </h2>
        
        <div class="roi-grid">
          <div class="roi-metric">
            <h3 style="color: #065f46; margin: 0; font-size: 28px;">${data.roiMetrics.estimatedTrafficIncrease}%</h3>
            <p style="margin: 5px 0 0; color: #065f46;">Traffic Increase</p>
          </div>
          
          <div class="roi-metric">
            <h3 style="color: #065f46; margin: 0; font-size: 28px;">$${data.roiMetrics.estimatedRevenueImpact.toLocaleString()}</h3>
            <p style="margin: 5px 0 0; color: #065f46;">Revenue Impact</p>
          </div>
          
          <div class="roi-metric">
            <h3 style="color: #065f46; margin: 0; font-size: 28px;">$${data.roiMetrics.costSavingsFromAI.toLocaleString()}</h3>
            <p style="margin: 5px 0 0; color: #065f46;">Cost Savings</p>
          </div>
          
          <div class="roi-metric">
            <h3 style="color: #065f46; margin: 0; font-size: 28px;">${data.roiMetrics.totalROI}%</h3>
            <p style="margin: 5px 0 0; color: #065f46;">Annual ROI</p>
          </div>
        </div>
        
        <div style="margin-top: 20px; background: white; padding: 15px; border-radius: 8px;">
          <h4 style="margin: 0 0 10px; color: #065f46;">Business Impact Summary</h4>
          <p style="margin: 0; color: #065f46;">
            Based on your current AI visibility score and improvement trajectory, we estimate a ${data.roiMetrics.estimatedTrafficIncrease}% increase in organic traffic from AI sources.
            This translates to approximately $${data.roiMetrics.estimatedRevenueImpact.toLocaleString()} in additional monthly revenue and $${data.roiMetrics.costSavingsFromAI.toLocaleString()} in monthly cost savings from reduced paid search requirements.
            With a payback period of ${data.roiMetrics.paybackPeriod} months, your annual ROI for AI visibility optimization is projected at ${data.roiMetrics.totalROI}%.
          </p>
        </div>
      </section>
    `;
  }

  // Recommendations
  if (data.auditHistory?.[0]?.recommendations?.length > 0) {
    html += `
      <section class="recommendations">
        <h2 style="color: #1e40af; margin-bottom: 20px;">Strategic Recommendations</h2>
        
        <div class="recommendation-items">
          ${data.auditHistory[0].recommendations.map((rec: string, index: number) => `
            <div class="recommendation-item">
              <h4 style="margin: 0 0 5px; color: #1e40af;">Priority ${index + 1}</h4>
              <p style="margin: 0; color: #1e3a8a;">${rec}</p>
            </div>
          `).join('')}
        </div>
      </section>
    `;
  }

  // Historical Performance
  if (data.auditHistory && data.auditHistory.length > 1) {
    html += `
      <section>
        <h2>Historical Performance</h2>
        
        <div class="chart-placeholder">
          <p>Performance Trend Visualization</p>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Overall Score</th>
              <th>AI Understanding</th>
              <th>Citation Likelihood</th>
              <th>Conversational</th>
              <th>Structure</th>
            </tr>
          </thead>
          <tbody>
            ${data.auditHistory.slice(0, 5).map((audit: any) => `
              <tr>
                <td>${new Date(audit.created_at).toLocaleDateString()}</td>
                <td><strong>${audit.overall_score}</strong></td>
                <td>${audit.ai_understanding}</td>
                <td>${audit.citation_likelihood}</td>
                <td>${audit.conversational_readiness}</td>
                <td>${audit.content_structure}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </section>
    `;
  }

  // Footer
  html += `
      <div class="footer">
        <div>
          <p>Generated by SEOGENIX - AI-Powered SEO Platform</p>
        </div>
        <div>
          <p>Report ID: ${crypto.randomUUID().substring(0, 8)}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return html;
}