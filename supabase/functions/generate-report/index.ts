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
    
    if (latest?.recommendations?.length > 0) {
      html += `
        <h3>Key Recommendations</h3>
        <ul>
      `;
      
      latest.recommendations.forEach((rec: string) => {
        html += `<li>${rec}</li>`;
      });
      
      html += '</ul>';
    }
  } else if (reportType === 'competitive' && data.competitorAnalyses) {
    html += `
      <div class="metric">
        <h2>Competitive Analysis</h2>
        <p>Your ranking: #${data.summary?.ranking || 'N/A'}</p>
        <p>Your score: ${data.summary?.primarySiteScore || 0}/100</p>
        <p>Average competitor score: ${data.summary?.averageCompetitorScore || 0}/100</p>
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
        <h3>Recommendations</h3>
        <ul>
      `;
      
      data.recommendations.forEach((rec: string) => {
        html += `<li>${rec}</li>`;
      });
      
      html += '</ul>';
    }
  } else if (reportType === 'citation' && data.citations) {
    html += `
      <div class="metric">
        <h2>Citation Analysis</h2>
        <p>Domain: ${data.domain}</p>
        <p>Total mentions: ${data.total}</p>
        <p>Keywords: ${data.searchTerms.join(', ')}</p>
      </div>
      
      <h3>Citation Breakdown</h3>
      <table>
        <tr>
          <th>Source</th>
          <th>Type</th>
          <th>Confidence</th>
          <th>Match Type</th>
          <th>Date</th>
        </tr>
    `;
    
    data.citations.forEach((citation: any) => {
      html += `
        <tr>
          <td>${citation.source}</td>
          <td>${citation.type}</td>
          <td>${citation.confidence_score || 'N/A'}</td>
          <td>${citation.match_type || 'N/A'}</td>
          <td>${new Date(citation.date).toLocaleDateString()}</td>
        </tr>
      `;
    });
    
    html += '</table>';
    
    html += `
      <h3>Citation Snippets</h3>
      <div style="margin-top: 20px;">
    `;
    
    data.citations.forEach((citation: any, index: number) => {
      html += `
        <div style="margin-bottom: 15px; padding: 10px; background: #f8f9fa; border-radius: 5px;">
          <p><strong>Source:</strong> ${citation.source}</p>
          <p><strong>Snippet:</strong> ${citation.snippet}</p>
          <p><a href="${citation.url}" style="color: #8B5CF6;">View Source</a></p>
        </div>
      `;
    });
    
    html += '</div>';
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