import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

interface ReportRequest {
  reportType: 'audit' | 'competitive' | 'citation' | 'comprehensive';
  reportData: any;
  reportName: string;
  format: 'pdf' | 'csv' | 'json';
  brandingOptions?: {
    includeLogo?: boolean;
    companyName?: string;
    customColors?: {
      primary?: string;
      secondary?: string;
    };
    footerText?: string;
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { reportType, reportData, reportName, format, brandingOptions }: ReportRequest = await req.json();
    
    console.log(`Processing report generation request for ${reportType} report: "${reportName}"`);
    console.log(`Format: ${format}, White Label: ${brandingOptions?.includeLogo ? 'Yes' : 'No'}`);

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

    // Get white label settings if user has them
    let whiteLabel = null;
    if (brandingOptions?.includeLogo) {
      try {
        const { data: whiteLabelData } = await supabase
          .from('white_label_settings')
          .select('*')
          .eq('user_id', user.id)
          .single();
          
        if (whiteLabelData) {
          whiteLabel = whiteLabelData;
          console.log('Found white label settings for user');
        }
      } catch (error) {
        console.error('Error fetching white label settings:', error);
      }
    }

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
      console.log('Generating HTML report (for PDF viewing)');
      // Use text/html content type so browser can render it properly
      contentType = 'text/html';
      fileExtension = 'html';
      reportContent = generatePDFReport(reportType, reportData, reportName, whiteLabel, brandingOptions);
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
        report_data: {
          ...reportData,
          brandingOptions,
          generatedAt: new Date().toISOString()
        },
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
        reportId: reportRecord?.id,
        whiteLabeled: !!whiteLabel
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

function generatePDFReport(
  reportType: string, 
  data: any, 
  reportName: string, 
  whiteLabel: any = null,
  brandingOptions: any = null
): string {
  console.log(`Generating HTML content for ${reportType} report`);
  
  // Get branding settings
  const companyName = whiteLabel?.company_name || brandingOptions?.companyName || 'SEOGENIX';
  const primaryColor = whiteLabel?.primary_color_hex || brandingOptions?.customColors?.primary || '#8B5CF6';
  const secondaryColor = whiteLabel?.secondary_color_hex || brandingOptions?.customColors?.secondary || '#14B8A6';
  const logoUrl = whiteLabel?.custom_logo_url || null;
  const footerText = whiteLabel?.footer_text || brandingOptions?.footerText || 'Generated by SEOGENIX - AI-Powered SEO Platform';
  
  // In a real implementation, you would use a PDF generation library
  // For now, return HTML that could be converted to PDF
  
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
          margin: 40px; 
          color: #1f2937;
          line-height: 1.6;
        }
        .header { 
          border-bottom: 3px solid ${primaryColor}; 
          padding-bottom: 20px; 
          margin-bottom: 30px; 
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
        table { 
          width: 100%; 
          border-collapse: collapse; 
          margin: 20px 0; 
        }
        th, td { 
          border: 1px solid #ddd; 
          padding: 8px; 
          text-align: left; 
        }
        th { 
          background: ${primaryColor}; 
          color: white; 
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
          margin-top: 50px;
          padding-top: 20px;
          border-top: 2px solid #e5e7eb;
          color: #6b7280;
          font-size: 14px;
          display: flex;
          justify-content: space-between;
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
        .chart-placeholder {
          background-color: #f9fafb;
          border: 1px dashed #d1d5db;
          border-radius: 8px;
          padding: 20px;
          text-align: center;
          margin: 20px 0;
          height: 200px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #6b7280;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo-section">
          ${logoUrl 
            ? `<img src="${logoUrl}" alt="${companyName} Logo" style="height: 80px; width: auto;" />`
            : `<svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="80" height="80" rx="16" fill="${primaryColor}" />
                <path d="M24 40L36 52L56 32" stroke="white" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
              </svg>`
          }
          <div class="company-name">${companyName}</div>
        </div>
        <div class="report-meta">
          <h1 style="margin: 0; font-size: 24px;">${reportName}</h1>
          <p>Generated on ${new Date().toLocaleDateString()}</p>
          <p>Report Type: ${reportType.charAt(0).toUpperCase() + reportType.slice(1)}</p>
        </div>
      </div>
  `;

  if (reportType === 'audit' && data.auditHistory) {
    const latest = data.auditHistory[0];
    const average = data.auditHistory.reduce((sum: number, a: any) => sum + a.overall_score, 0) / data.auditHistory.length;
    
    html += `
      <h2>Executive Summary</h2>
      <p>This report provides a comprehensive analysis of your AI visibility performance and recommendations for improvement.</p>
      
      <div class="metric-grid">
        <div class="metric-card">
          <p class="metric-value">${latest?.overall_score || 0}/100</p>
          <p class="metric-label">Current AI Visibility Score</p>
        </div>
        
        <div class="metric-card">
          <p class="metric-value">${Math.round(average)}/100</p>
          <p class="metric-label">Average Score</p>
        </div>
        
        <div class="metric-card">
          <p class="metric-value">${data.auditHistory.length}</p>
          <p class="metric-label">Total Audits</p>
        </div>
        
        <div class="metric-card">
          <p class="metric-value">${latest?.ai_understanding || 0}/100</p>
          <p class="metric-label">AI Understanding</p>
        </div>
      </div>
      
      <h3>Detailed Scores</h3>
      <table>
        <tr>
          <th>Component</th>
          <th>Score</th>
          <th>Description</th>
        </tr>
        <tr>
          <td>AI Understanding</td>
          <td>${latest?.ai_understanding || 0}</td>
          <td>How well AI systems can comprehend your content</td>
        </tr>
        <tr>
          <td>Citation Likelihood</td>
          <td>${latest?.citation_likelihood || 0}</td>
          <td>Probability of AI systems citing your content</td>
        </tr>
        <tr>
          <td>Conversational Readiness</td>
          <td>${latest?.conversational_readiness || 0}</td>
          <td>How well your content works with voice search</td>
        </tr>
        <tr>
          <td>Content Structure</td>
          <td>${latest?.content_structure || 0}</td>
          <td>Quality of organization and technical implementation</td>
        </tr>
      </table>
      
      <div class="chart-placeholder">
        <p>Score Trend Visualization</p>
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
    
    if (latest?.recommendations?.length > 0) {
      html += `
        <div class="recommendations">
          <h3>Key Recommendations</h3>
          <ul>
      `;
      
      latest.recommendations.forEach((rec: string) => {
        html += `<li class="recommendation-item">${rec}</li>`;
      });
      
      html += `
          </ul>
        </div>
      `;
    }
  } else if (reportType === 'competitive' && data.competitorAnalyses) {
    html += `
      <h2>Competitive Analysis</h2>
      <p>This report compares your AI visibility performance against your competitors and provides strategic recommendations.</p>
      
      <div class="metric-grid">
        <div class="metric-card">
          <p class="metric-value">#${data.summary?.ranking || 'N/A'}</p>
          <p class="metric-label">Your Ranking</p>
        </div>
        
        <div class="metric-card">
          <p class="metric-value">${data.summary?.primarySiteScore || 0}/100</p>
          <p class="metric-label">Your Score</p>
        </div>
        
        <div class="metric-card">
          <p class="metric-value">${data.summary?.averageCompetitorScore || 0}/100</p>
          <p class="metric-label">Competitor Average</p>
        </div>
        
        <div class="metric-card">
          <p class="metric-value">${data.competitorAnalyses.length}</p>
          <p class="metric-label">Competitors Analyzed</p>
        </div>
      </div>
      
      <p>Your AI visibility score is ${data.summary?.primarySiteScore > data.summary?.averageCompetitorScore ? 'above' : 'below'} the industry average by ${Math.abs((data.summary?.primarySiteScore || 0) - (data.summary?.averageCompetitorScore || 0))} points.</p>
      
      <div class="chart-placeholder">
        <p>Competitive Score Comparison Chart</p>
      </div>
      
      <h3>Competitor Comparison</h3>
      <table>
        <tr>
          <th>Competitor</th>
          <th>Overall Score</th>
          <th>AI Understanding</th>
          <th>Citation Likelihood</th>
          <th>Conversational</th>
          <th>Structure</th>
        </tr>
    `;
    
    // Add primary site first
    if (data.primarySiteAnalysis) {
      html += `
        <tr style="background-color: #e0e7ff;">
          <td><strong>${data.primarySiteAnalysis.name} (You)</strong></td>
          <td><strong>${data.primarySiteAnalysis.overallScore}</strong></td>
          <td>${data.primarySiteAnalysis.subscores.aiUnderstanding}</td>
          <td>${data.primarySiteAnalysis.subscores.citationLikelihood}</td>
          <td>${data.primarySiteAnalysis.subscores.conversationalReadiness}</td>
          <td>${data.primarySiteAnalysis.subscores.contentStructure}</td>
        </tr>
      `;
    }
    
    // Add competitors
    data.competitorAnalyses.forEach((comp: any) => {
      html += `
        <tr>
          <td>${comp.name}</td>
          <td>${comp.overallScore}</td>
          <td>${comp.subscores.aiUnderstanding}</td>
          <td>${comp.subscores.citationLikelihood}</td>
          <td>${comp.subscores.conversationalReadiness}</td>
          <td>${comp.subscores.contentStructure}</td>
        </tr>
      `;
    });
    
    html += '</table>';
    
    if (data.recommendations?.length > 0) {
      html += `
        <div class="recommendations">
          <h3>Strategic Recommendations</h3>
          <ul>
      `;
      
      data.recommendations.forEach((rec: string) => {
        html += `<li class="recommendation-item">${rec}</li>`;
      });
      
      html += `
          </ul>
        </div>
      `;
    }
    
    // Add competitive gaps
    if (data.competitiveGaps?.length > 0) {
      html += `
        <h3>Competitive Gaps & Opportunities</h3>
        <table>
          <tr>
            <th>Competitor</th>
            <th>Score Difference</th>
            <th>Their Strengths</th>
            <th>Opportunity</th>
          </tr>
      `;
      
      data.competitiveGaps.forEach((gap: any) => {
        html += `
          <tr>
            <td>${gap.competitor}</td>
            <td>${gap.scoreDifference > 0 ? '+' : ''}${gap.scoreDifference}</td>
            <td>${gap.strongerAreas.join(', ')}</td>
            <td>${gap.opportunities[0] || 'N/A'}</td>
          </tr>
        `;
      });
      
      html += '</table>';
    }
  } else if (reportType === 'citation' && data.citations) {
    html += `
      <h2>Citation Analysis Report</h2>
      <p>This report analyzes how your content is being cited and referenced across AI systems and other platforms.</p>
      
      <div class="metric-grid">
        <div class="metric-card">
          <p class="metric-value">${data.total || 0}</p>
          <p class="metric-label">Total Citations</p>
        </div>
        
        <div class="metric-card">
          <p class="metric-value">${data.confidenceBreakdown?.high || 0}</p>
          <p class="metric-label">High Confidence</p>
        </div>
        
        <div class="metric-card">
          <p class="metric-value">${data.sources?.llm || 0}</p>
          <p class="metric-label">LLM Mentions</p>
        </div>
        
        <div class="metric-card">
          <p class="metric-value">${data.sources?.google || 0}</p>
          <p class="metric-label">Google Mentions</p>
        </div>
      </div>
      
      <h3>Citation Analysis</h3>
      <p>Domain: <strong>${data.domain}</strong></p>
      <p>Keywords: ${data.searchTerms?.join(', ') || 'None'}</p>
      
      <div class="chart-placeholder">
        <p>Citation Source Distribution Chart</p>
      </div>
      
      <h3>Citation Details</h3>
      <table>
        <tr>
          <th>Source</th>
          <th>Type</th>
          <th>Confidence</th>
          <th>Date</th>
        </tr>
    `;
    
    data.citations.forEach((citation: any) => {
      html += `
        <tr>
          <td>${citation.source}</td>
          <td>${citation.type}</td>
          <td>${citation.confidence_score || 'N/A'}</td>
          <td>${new Date(citation.date).toLocaleDateString()}</td>
        </tr>
      `;
    });
    
    html += '</table>';
    
    html += `
      <h3>Citation Snippets</h3>
      <div style="margin-top: 20px;">
    `;
    
    data.citations.slice(0, 5).forEach((citation: any, index: number) => {
      html += `
        <div style="margin-bottom: 15px; padding: 10px; background: #f8f9fa; border-radius: 5px; border-left: 4px solid ${primaryColor};">
          <p><strong>Source:</strong> ${citation.source}</p>
          <p><strong>Snippet:</strong> ${citation.snippet}</p>
          <p><a href="${citation.url}" style="color: ${primaryColor};">View Source</a></p>
        </div>
      `;
    });
    
    html += '</div>';
  } else if (reportType === 'comprehensive') {
    // Executive summary
    html += `
      <h2>Executive Summary</h2>
      <p>This comprehensive report provides an overview of your AI visibility performance across multiple dimensions.</p>
      
      <div class="metric-grid">
        <div class="metric-card">
          <p class="metric-value">${data.auditHistory?.[0]?.overall_score || 'N/A'}</p>
          <p class="metric-label">Current Score</p>
        </div>
        
        <div class="metric-card">
          <p class="metric-value">${data.auditHistory?.length || 0}</p>
          <p class="metric-label">Audits Conducted</p>
        </div>
        
        <div class="metric-card">
          <p class="metric-value">${data.profile?.websites?.length || 0}</p>
          <p class="metric-label">Websites</p>
        </div>
        
        <div class="metric-card">
          <p class="metric-value">${data.profile?.competitors?.length || 0}</p>
          <p class="metric-label">Competitors</p>
        </div>
      </div>
      
      <div class="chart-placeholder">
        <p>Performance Trend Visualization</p>
      </div>
    `;
    
    // Add audit history if available
    if (data.auditHistory && data.auditHistory.length > 0) {
      html += `
        <h3>Audit History</h3>
        <table>
          <tr>
            <th>Date</th>
            <th>Website</th>
            <th>Score</th>
            <th>AI Understanding</th>
            <th>Citation Likelihood</th>
          </tr>
      `;
      
      data.auditHistory.slice(0, 5).forEach((audit: any) => {
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
    
    // Add recommendations if available
    if (data.auditHistory?.[0]?.recommendations) {
      html += `
        <div class="recommendations">
          <h3>Key Recommendations</h3>
          <ul>
      `;
      
      data.auditHistory[0].recommendations.forEach((rec: string) => {
        html += `<li class="recommendation-item">${rec}</li>`;
      });
      
      html += `
          </ul>
        </div>
      `;
    }
  }

  html += `
      <div class="footer">
        <div>
          <p>${footerText}</p>
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