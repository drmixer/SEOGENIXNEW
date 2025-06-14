import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

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
    } else if (format === 'pdf') {
      console.log('Generating PDF report (HTML format for demo)');
      contentType = 'text/html'; // In a real implementation, this would be application/pdf
      fileExtension = 'html'; // In a real implementation, this would be pdf
      reportContent = generatePDFReport(reportType, reportData, reportName);
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
  }
  
  return csv;
}

function generatePDFReport(reportType: string, data: any, reportName: string): string {
  console.log(`Generating HTML content for ${reportType} report`);
  
  // In a real implementation, you would use a PDF generation library
  // For now, return styled HTML that could be converted to PDF
  
  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${reportName}</title>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        /* Modern, clean styling for reports */
        :root {
          --primary-color: #8B5CF6;
          --primary-light: #EDE9FE;
          --secondary-color: #14B8A6;
          --secondary-light: #CCFBF1;
          --accent-color: #F59E0B;
          --accent-light: #FEF3C7;
          --text-dark: #1F2937;
          --text-medium: #4B5563;
          --text-light: #9CA3AF;
          --background: #FFFFFF;
          --background-alt: #F9FAFB;
          --border-color: #E5E7EB;
          --success: #10B981;
          --warning: #F59E0B;
          --error: #EF4444;
        }
        
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          line-height: 1.6;
          color: var(--text-dark);
          background-color: var(--background);
          padding: 40px;
          font-size: 14px;
        }
        
        .report-container {
          max-width: 1200px;
          margin: 0 auto;
          background: var(--background);
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
          overflow: hidden;
        }
        
        .report-header {
          background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
          color: white;
          padding: 30px 40px;
          position: relative;
          overflow: hidden;
        }
        
        .report-header::after {
          content: '';
          position: absolute;
          top: 0;
          right: 0;
          bottom: 0;
          left: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0));
          pointer-events: none;
        }
        
        .report-title {
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 8px;
        }
        
        .report-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 14px;
          opacity: 0.9;
        }
        
        .report-body {
          padding: 40px;
        }
        
        .report-section {
          margin-bottom: 40px;
        }
        
        .section-title {
          font-size: 20px;
          font-weight: 600;
          margin-bottom: 20px;
          color: var(--primary-color);
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .section-title::after {
          content: '';
          flex-grow: 1;
          height: 1px;
          background: var(--border-color);
          margin-left: 10px;
        }
        
        .score-card {
          background: linear-gradient(135deg, var(--primary-light), var(--secondary-light));
          border-radius: 12px;
          padding: 30px;
          text-align: center;
          margin-bottom: 30px;
        }
        
        .score-value {
          font-size: 64px;
          font-weight: 700;
          color: var(--primary-color);
          line-height: 1;
          margin-bottom: 10px;
        }
        
        .score-label {
          font-size: 16px;
          color: var(--text-medium);
        }
        
        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 20px;
          margin-bottom: 30px;
        }
        
        .metric-card {
          background: var(--background-alt);
          border-radius: 10px;
          padding: 20px;
          border-left: 4px solid var(--primary-color);
        }
        
        .metric-value {
          font-size: 24px;
          font-weight: 600;
          margin-bottom: 5px;
        }
        
        .metric-label {
          font-size: 14px;
          color: var(--text-medium);
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
          font-size: 14px;
        }
        
        th {
          background: var(--primary-light);
          color: var(--primary-color);
          font-weight: 600;
          text-align: left;
          padding: 12px 15px;
        }
        
        td {
          padding: 10px 15px;
          border-bottom: 1px solid var(--border-color);
        }
        
        tr:nth-child(even) {
          background: var(--background-alt);
        }
        
        .recommendations {
          background: var(--secondary-light);
          border-radius: 10px;
          padding: 25px;
          margin-top: 30px;
        }
        
        .recommendations-title {
          color: var(--secondary-color);
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 15px;
        }
        
        .recommendation-item {
          background: white;
          border-radius: 8px;
          padding: 15px;
          margin-bottom: 10px;
          border-left: 3px solid var(--secondary-color);
        }
        
        .chart-container {
          background: var(--background-alt);
          border-radius: 10px;
          padding: 20px;
          height: 300px;
          margin: 20px 0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-medium);
        }
        
        .report-footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid var(--border-color);
          display: flex;
          justify-content: space-between;
          color: var(--text-light);
          font-size: 12px;
        }
        
        .badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
        }
        
        .badge-success {
          background: var(--success);
          color: white;
        }
        
        .badge-warning {
          background: var(--warning);
          color: white;
        }
        
        .badge-error {
          background: var(--error);
          color: white;
        }
        
        .snippet-container {
          background: var(--background-alt);
          border-radius: 8px;
          padding: 15px;
          margin-bottom: 15px;
          border: 1px solid var(--border-color);
        }
        
        .snippet-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
        }
        
        .snippet-source {
          font-weight: 600;
        }
        
        .snippet-content {
          font-size: 14px;
          color: var(--text-medium);
          line-height: 1.5;
        }
        
        .snippet-meta {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          color: var(--text-light);
          margin-top: 10px;
        }
        
        .link {
          color: var(--primary-color);
          text-decoration: none;
        }
        
        .link:hover {
          text-decoration: underline;
        }
      </style>
    </head>
    <body>
      <div class="report-container">
        <div class="report-header">
          <h1 class="report-title">${reportName}</h1>
          <div class="report-meta">
            <div>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</div>
            <div>Report Type: ${reportType.charAt(0).toUpperCase() + reportType.slice(1)}</div>
          </div>
        </div>
        
        <div class="report-body">
  `;

  if (reportType === 'audit' && data.auditHistory) {
    const latest = data.auditHistory[0];
    const average = data.auditHistory.reduce((sum: number, a: any) => sum + a.overall_score, 0) / data.auditHistory.length;
    
    html += `
      <div class="report-section">
        <h2 class="section-title">AI Visibility Overview</h2>
        
        <div class="score-card">
          <div class="score-value">${latest?.overall_score || 0}</div>
          <div class="score-label">Current AI Visibility Score</div>
        </div>
        
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-value">${latest?.ai_understanding || 0}</div>
            <div class="metric-label">AI Understanding</div>
          </div>
          
          <div class="metric-card">
            <div class="metric-value">${latest?.citation_likelihood || 0}</div>
            <div class="metric-label">Citation Likelihood</div>
          </div>
          
          <div class="metric-card">
            <div class="metric-value">${latest?.conversational_readiness || 0}</div>
            <div class="metric-label">Conversational</div>
          </div>
          
          <div class="metric-card">
            <div class="metric-value">${latest?.content_structure || 0}</div>
            <div class="metric-label">Content Structure</div>
          </div>
          
          <div class="metric-card">
            <div class="metric-value">${Math.round(average)}</div>
            <div class="metric-label">Average Score</div>
          </div>
          
          <div class="metric-card">
            <div class="metric-value">${data.auditHistory.length}</div>
            <div class="metric-label">Total Audits</div>
          </div>
        </div>
      </div>
      
      <div class="report-section">
        <h2 class="section-title">Audit History</h2>
        
        <div class="chart-container">
          <div>Chart visualization would appear here in the actual PDF</div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Website</th>
              <th>Overall Score</th>
              <th>AI Understanding</th>
              <th>Citation Likelihood</th>
              <th>Conversational</th>
              <th>Structure</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    data.auditHistory.slice(0, 10).forEach((audit: any) => {
      const date = new Date(audit.created_at).toLocaleDateString();
      
      html += `
        <tr>
          <td>${date}</td>
          <td>${audit.website_url}</td>
          <td><strong>${audit.overall_score}</strong></td>
          <td>${audit.ai_understanding}</td>
          <td>${audit.citation_likelihood}</td>
          <td>${audit.conversational_readiness}</td>
          <td>${audit.content_structure}</td>
        </tr>
      `;
    });
    
    html += `
          </tbody>
        </table>
      </div>
    `;
    
    if (latest?.recommendations?.length > 0) {
      html += `
        <div class="report-section">
          <h2 class="section-title">Key Recommendations</h2>
          
          <div class="recommendations">
            <h3 class="recommendations-title">Actionable Improvements</h3>
      `;
      
      latest.recommendations.forEach((rec: string, index: number) => {
        html += `
          <div class="recommendation-item">
            <strong>Priority ${index + 1}:</strong> ${rec}
          </div>
        `;
      });
      
      html += `
          </div>
        </div>
      `;
    }
  } else if (reportType === 'competitive' && data.competitorAnalyses) {
    html += `
      <div class="report-section">
        <h2 class="section-title">Competitive Analysis</h2>
        
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-value">#${data.summary?.ranking || 'N/A'}</div>
            <div class="metric-label">Your Ranking</div>
          </div>
          
          <div class="metric-card">
            <div class="metric-value">${data.summary?.primarySiteScore || 0}</div>
            <div class="metric-label">Your Score</div>
          </div>
          
          <div class="metric-card">
            <div class="metric-value">${data.summary?.averageCompetitorScore || 0}</div>
            <div class="metric-label">Competitor Average</div>
          </div>
          
          <div class="metric-card">
            <div class="metric-value">${data.competitorAnalyses.length}</div>
            <div class="metric-label">Competitors Analyzed</div>
          </div>
        </div>
        
        <div class="chart-container">
          <div>Competitive comparison chart would appear here in the actual PDF</div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Competitor</th>
              <th>Overall Score</th>
              <th>AI Understanding</th>
              <th>Citation Likelihood</th>
              <th>Conversational</th>
              <th>Structure</th>
              <th>Position</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    // Add primary site first with highlighting
    if (data.primarySiteAnalysis) {
      html += `
        <tr style="background-color: var(--primary-light);">
          <td><strong>${data.primarySiteAnalysis.name} (You)</strong></td>
          <td><strong>${data.primarySiteAnalysis.overallScore}</strong></td>
          <td>${data.primarySiteAnalysis.subscores.aiUnderstanding}</td>
          <td>${data.primarySiteAnalysis.subscores.citationLikelihood}</td>
          <td>${data.primarySiteAnalysis.subscores.conversationalReadiness}</td>
          <td>${data.primarySiteAnalysis.subscores.contentStructure}</td>
          <td><span class="badge badge-success">#${data.summary?.ranking || 'N/A'}</span></td>
        </tr>
      `;
    }
    
    // Add competitors
    data.competitorAnalyses.forEach((comp: any, index: number) => {
      html += `
        <tr>
          <td>${comp.name}</td>
          <td><strong>${comp.overallScore}</strong></td>
          <td>${comp.subscores.aiUnderstanding}</td>
          <td>${comp.subscores.citationLikelihood}</td>
          <td>${comp.subscores.conversationalReadiness}</td>
          <td>${comp.subscores.contentStructure}</td>
          <td>#${index + 1}</td>
        </tr>
      `;
    });
    
    html += `
          </tbody>
        </table>
      </div>
    `;
    
    // Strengths and weaknesses section
    if (data.primarySiteAnalysis?.strengths && data.primarySiteAnalysis?.weaknesses) {
      html += `
        <div class="report-section">
          <h2 class="section-title">SWOT Analysis</h2>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div style="background: var(--success); background: linear-gradient(135deg, var(--success), #34D399); color: white; border-radius: 10px; padding: 20px;">
              <h3 style="margin-bottom: 15px; font-size: 18px;">Your Strengths</h3>
              <ul style="list-style-position: inside; margin-left: 10px;">
      `;
      
      data.primarySiteAnalysis.strengths.forEach((strength: string) => {
        html += `<li>${strength}</li>`;
      });
      
      html += `
              </ul>
            </div>
            
            <div style="background: var(--warning); background: linear-gradient(135deg, var(--warning), #FBBF24); color: white; border-radius: 10px; padding: 20px;">
              <h3 style="margin-bottom: 15px; font-size: 18px;">Areas for Improvement</h3>
              <ul style="list-style-position: inside; margin-left: 10px;">
      `;
      
      data.primarySiteAnalysis.weaknesses.forEach((weakness: string) => {
        html += `<li>${weakness}</li>`;
      });
      
      html += `
              </ul>
            </div>
          </div>
        </div>
      `;
    }
    
    // Recommendations
    if (data.recommendations?.length > 0) {
      html += `
        <div class="report-section">
          <h2 class="section-title">Strategic Recommendations</h2>
          
          <div class="recommendations">
            <h3 class="recommendations-title">Competitive Advantage Opportunities</h3>
      `;
      
      data.recommendations.forEach((rec: string, index: number) => {
        html += `
          <div class="recommendation-item">
            <strong>Strategy ${index + 1}:</strong> ${rec}
          </div>
        `;
      });
      
      html += `
          </div>
        </div>
      `;
    }
  } else if (reportType === 'citation' && data.citations) {
    html += `
      <div class="report-section">
        <h2 class="section-title">Citation Analysis</h2>
        
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-value">${data.total || data.citations.length}</div>
            <div class="metric-label">Total Citations</div>
          </div>
          
          <div class="metric-card">
            <div class="metric-value">${data.domain || 'N/A'}</div>
            <div class="metric-label">Domain Analyzed</div>
          </div>
          
          <div class="metric-card">
            <div class="metric-value">${data.confidenceBreakdown?.high || 0}</div>
            <div class="metric-label">High Confidence</div>
          </div>
          
          <div class="metric-card">
            <div class="metric-value">${data.sources?.llm || 0}</div>
            <div class="metric-label">LLM Mentions</div>
          </div>
        </div>
        
        <div class="chart-container">
          <div>Citation source distribution chart would appear here in the actual PDF</div>
        </div>
      </div>
      
      <div class="report-section">
        <h2 class="section-title">Citation Details</h2>
        
        <div style="margin-bottom: 20px;">
          <strong>Keywords:</strong> ${data.searchTerms?.join(', ') || 'N/A'}
        </div>
    `;
    
    // Group citations by type
    const citationTypes = ['llm', 'google', 'reddit', 'news'];
    
    citationTypes.forEach((type) => {
      const typeCitations = data.citations.filter((c: any) => c.type === type);
      
      if (typeCitations.length > 0) {
        html += `
          <div style="margin-bottom: 30px;">
            <h3 style="font-size: 18px; margin-bottom: 15px; color: var(--text-dark);">
              ${type.toUpperCase()} Citations (${typeCitations.length})
            </h3>
        `;
        
        typeCitations.forEach((citation: any) => {
          const date = new Date(citation.date).toLocaleDateString();
          const confidenceClass = citation.confidence_score >= 80 ? 'badge-success' : 
                                citation.confidence_score >= 60 ? 'badge-warning' : 'badge-error';
          
          html += `
            <div class="snippet-container">
              <div class="snippet-header">
                <div class="snippet-source">${citation.source}</div>
                <div>
                  <span class="badge ${confidenceClass}">${citation.confidence_score || 'N/A'}% confidence</span>
                </div>
              </div>
              
              <div class="snippet-content">
                "${citation.snippet}"
              </div>
              
              <div class="snippet-meta">
                <div>Date: ${date}</div>
                <div>Match: ${citation.match_type || 'N/A'}</div>
                <div><a href="${citation.url}" class="link" target="_blank">View Source</a></div>
              </div>
            </div>
          `;
        });
        
        html += `</div>`;
      }
    });
    
    html += `</div>`;
  } else if (reportType === 'comprehensive') {
    html += `
      <div class="report-section">
        <h2 class="section-title">Comprehensive Performance Overview</h2>
        
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-value">${data.auditHistory?.length || 0}</div>
            <div class="metric-label">Total Audits</div>
          </div>
          
          <div class="metric-card">
            <div class="metric-value">${data.profile?.websites?.length || 0}</div>
            <div class="metric-label">Websites</div>
          </div>
          
          <div class="metric-card">
            <div class="metric-value">${data.profile?.competitors?.length || 0}</div>
            <div class="metric-label">Competitors</div>
          </div>
          
          <div class="metric-card">
            <div class="metric-value">${data.profile?.industry || 'N/A'}</div>
            <div class="metric-label">Industry</div>
          </div>
        </div>
        
        <div class="chart-container">
          <div>Performance trend chart would appear here in the actual PDF</div>
        </div>
      </div>
    `;
    
    // Add latest audit data if available
    if (data.auditHistory && data.auditHistory.length > 0) {
      const latest = data.auditHistory[0];
      
      html += `
        <div class="report-section">
          <h2 class="section-title">Latest Audit Results</h2>
          
          <div class="score-card">
            <div class="score-value">${latest.overall_score}</div>
            <div class="score-label">Overall AI Visibility Score</div>
          </div>
          
          <div class="metrics-grid">
            <div class="metric-card">
              <div class="metric-value">${latest.ai_understanding}</div>
              <div class="metric-label">AI Understanding</div>
            </div>
            
            <div class="metric-card">
              <div class="metric-value">${latest.citation_likelihood}</div>
              <div class="metric-label">Citation Likelihood</div>
            </div>
            
            <div class="metric-card">
              <div class="metric-value">${latest.conversational_readiness}</div>
              <div class="metric-label">Conversational</div>
            </div>
            
            <div class="metric-card">
              <div class="metric-value">${latest.content_structure}</div>
              <div class="metric-label">Content Structure</div>
            </div>
          </div>
        </div>
      `;
      
      if (latest.recommendations && latest.recommendations.length > 0) {
        html += `
          <div class="report-section">
            <h2 class="section-title">Recommendations</h2>
            
            <div class="recommendations">
              <h3 class="recommendations-title">Priority Improvements</h3>
        `;
        
        latest.recommendations.forEach((rec: string, index: number) => {
          html += `
            <div class="recommendation-item">
              <strong>Priority ${index + 1}:</strong> ${rec}
            </div>
          `;
        });
        
        html += `
            </div>
          </div>
        `;
      }
    }
    
    // Add activity summary if available
    if (data.activity) {
      html += `
        <div class="report-section">
          <h2 class="section-title">Activity Summary</h2>
          
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Activity</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
      `;
      
      data.activity.slice(0, 10).forEach((activity: any) => {
        const date = new Date(activity.created_at).toLocaleDateString();
        const activityType = activity.activity_type.replace(/_/g, ' ');
        
        html += `
          <tr>
            <td>${date}</td>
            <td>${activityType}</td>
            <td>${activity.tool_id || activity.activity_data?.type || 'N/A'}</td>
          </tr>
        `;
      });
      
      html += `
            </tbody>
          </table>
        </div>
      `;
    }
  }

  html += `
        <div class="report-footer">
          <div>Generated by SEOGENIX - AI-Powered SEO Platform</div>
          <div>Report ID: ${crypto.randomUUID().substring(0, 8)}</div>
        </div>
      </div>
    </body>
    </html>
  `;

  return html;
}