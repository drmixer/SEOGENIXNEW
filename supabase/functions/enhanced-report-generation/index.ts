import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

interface EnhancedReportRequest {
  reportType: 'audit' | 'competitive' | 'citation' | 'comprehensive' | 'roi_focused';
  reportData: any;
  reportName: string;
  format: 'html' | 'csv' | 'json' | 'pdf';
  template?: any;
  config?: any;
}

interface ROICalculations {
  estimatedTrafficIncrease: number;
  estimatedRevenueImpact: number;
  costSavingsFromAI: number;
  competitiveAdvantage: number;
  brandVisibilityScore: number;
  paybackPeriod: number;
  totalROI: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { reportType, reportData, reportName, format, template, config }: EnhancedReportRequest = await req.json();

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    
    if (!user) {
      throw new Error('Invalid authentication');
    }

    // Get white label settings if user has them
    let whiteLabel = null;
    if (config?.brandingOptions?.includeLogo) {
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

    // Enhanced ROI calculations
    const calculateAdvancedROI = (data: any): ROICalculations => {
      const latestScore = data.auditHistory?.[0]?.overall_score || 70;
      const previousScore = data.auditHistory?.[1]?.overall_score || latestScore;
      const improvement = latestScore - previousScore;
      
      // Advanced industry benchmarks
      const industryMultipliers = {
        ecommerce: { traffic: 0.25, revenue: 3.50, adSpend: 0.12 },
        saas: { traffic: 0.20, revenue: 5.00, adSpend: 0.15 },
        healthcare: { traffic: 0.15, revenue: 2.00, adSpend: 0.08 },
        finance: { traffic: 0.18, revenue: 4.00, adSpend: 0.10 },
        default: { traffic: 0.15, revenue: 2.50, adSpend: 0.08 }
      };

      const industry = data.profile?.industry?.toLowerCase() || 'default';
      const multipliers = industryMultipliers[industry as keyof typeof industryMultipliers] || industryMultipliers.default;

      const baseTraffic = 10000; // Assumed monthly traffic
      const monthlyAdSpend = 5000; // Assumed monthly ad spend

      const trafficIncrease = Math.round((improvement / 10) * multipliers.traffic * 100);
      const revenueImpact = Math.round((improvement / 10) * multipliers.traffic * baseTraffic * multipliers.revenue);
      const costSavings = Math.round((improvement / 10) * multipliers.adSpend * monthlyAdSpend);
      const competitiveAdvantage = Math.round(latestScore - 65); // Points above industry average
      const brandVisibility = Math.round(latestScore * 1.2);

      const monthlyBenefit = revenueImpact + costSavings;
      const implementationCost = 2000; // Estimated implementation cost
      const paybackPeriod = implementationCost / (monthlyBenefit || 1);
      const annualROI = ((monthlyBenefit * 12 - implementationCost) / implementationCost) * 100;

      return {
        estimatedTrafficIncrease: trafficIncrease,
        estimatedRevenueImpact: revenueImpact,
        costSavingsFromAI: costSavings,
        competitiveAdvantage: competitiveAdvantage,
        brandVisibilityScore: brandVisibility,
        paybackPeriod: Math.round(paybackPeriod * 10) / 10,
        totalROI: Math.round(annualROI)
      };
    };

    // Generate enhanced report content
    let reportContent = '';
    let contentType = 'application/json';
    let fileExtension = 'json';

    if (format === 'csv') {
      contentType = 'text/csv';
      fileExtension = 'csv';
      reportContent = generateEnhancedCSVReport(reportType, reportData, config);
    } else if (format === 'html') {
      // Use text/html content type so browser can render it properly
      contentType = 'text/html';
      fileExtension = 'html';
      reportContent = generateEnhancedPDFReport(reportType, reportData, reportName, template, config, whiteLabel);
    } else {
      reportContent = JSON.stringify({
        ...reportData,
        enhancedMetrics: config?.includeROI ? calculateAdvancedROI(reportData) : null,
        generatedAt: new Date().toISOString(),
        template: template?.name,
        reportType
      }, null, 2);
    }

    // Generate a unique filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const templateSuffix = template ? `_${template.id}` : '';
    const fileName = `${reportName.replace(/[^a-zA-Z0-9]/g, '_')}${templateSuffix}_${timestamp}.${fileExtension}`;
    
    // Create a storage path for the user
    const storagePath = `reports/${user.id}/${fileName}`;
    
    console.log(`Uploading report to storage path: ${storagePath}`);
    
    // Upload the file to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('reports')
      .upload(storagePath, reportContent, {
        contentType,
        upsert: true
      });
    
    if (uploadError) {
      throw new Error(`Failed to upload report: ${uploadError.message}`);
    }
    
    // Get a public URL for the file
    const { data: urlData } = await supabase.storage
      .from('reports')
      .getPublicUrl(storagePath);
    
    const downloadUrl = urlData.publicUrl;
    console.log(`Report uploaded successfully. Download URL: ${downloadUrl}`);

    // Save enhanced report metadata with storage path
    const { data: reportRecord, error: dbError } = await supabase
      .from('reports')
      .insert({
        user_id: user.id,
        report_type: reportType,
        report_name: reportName,
        report_data: {
          ...reportData,
          template: template?.name,
          config,
          enhancedFeatures: {
            roiAnalysis: config?.includeROI,
            competitiveBenchmarks: config?.includeCompetitorBenchmarks,
            customBranding: config?.brandingOptions?.includeLogo
          }
        },
        file_url: downloadUrl,
        storage_path: storagePath
      })
      .select()
      .single();
    
    if (dbError) {
      console.error('Error saving report metadata:', dbError);
    }

    // Generate the viewer URL for the report
    const viewerUrl = `${supabaseUrl}/functions/v1/report-viewer?reportId=${reportRecord?.id}&format=${format}`;

    return new Response(
      JSON.stringify({
        success: true,
        fileName,
        downloadUrl,
        viewerUrl,
        reportType,
        format,
        template: template?.name,
        enhancedFeatures: {
          roiAnalysis: config?.includeROI,
          competitiveBenchmarks: config?.includeCompetitorBenchmarks,
          customBranding: config?.brandingOptions?.includeLogo
        },
        generatedAt: new Date().toISOString(),
        reportId: reportRecord?.id,
        whiteLabeled: !!whiteLabel
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Enhanced report generation error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate enhanced report',
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function generateEnhancedCSVReport(reportType: string, data: any, config: any): string {
  let csv = '';
  
  if (reportType === 'audit' || reportType === 'comprehensive' || reportType === 'roi_focused') {
    csv = 'Date,Website,Overall Score,AI Understanding,Citation Likelihood,Conversational Readiness,Content Structure\n';
    
    data.auditHistory.forEach((audit: any) => {
      csv += `${audit.created_at},${audit.website_url},${audit.overall_score},${audit.ai_understanding},${audit.citation_likelihood},${audit.conversational_readiness},${audit.content_structure}\n`;
    });
  }

  if (reportType === 'comprehensive' || reportType === 'roi_focused') {
    csv += '\nActivity Summary\n';
    csv += 'Date,Activity Type,Tool,Website\n';
    
    if (data.activity) {
      data.activity.slice(0, 20).forEach((activity: any) => {
        csv += `${activity.created_at},${activity.activity_type},${activity.tool_id || ''},${activity.website_url || ''}\n`;
      });
    }
  }

  if (reportType === 'competitive') {
    csv = 'Competitor,URL,Overall Score,AI Understanding,Citation Likelihood,Conversational Readiness,Content Structure\n';
    
    // Add primary site first
    if (data.primarySiteAnalysis) {
      csv += `${data.primarySiteAnalysis.name} (You),${data.primaryUrl},${data.primarySiteAnalysis.overallScore},${data.primarySiteAnalysis.subscores.aiUnderstanding},${data.primarySiteAnalysis.subscores.citationLikelihood},${data.primarySiteAnalysis.subscores.conversationalReadiness},${data.primarySiteAnalysis.subscores.contentStructure}\n`;
    }
    
    // Add competitors
    data.competitorAnalyses.forEach((comp: any) => {
      csv += `${comp.name},${comp.url},${comp.overallScore},${comp.subscores.aiUnderstanding},${comp.subscores.citationLikelihood},${comp.subscores.conversationalReadiness},${comp.subscores.contentStructure}\n`;
    });
    
    // Add industry average
    csv += `Industry Average,,${data.benchmarks?.industryAverage || 0},,,\n`;
  }

  if (reportType === 'roi_focused' && data.roiMetrics) {
    csv += '\nROI Analysis\n';
    csv += 'Metric,Value,Impact\n';
    csv += `Traffic Increase,${data.roiMetrics.estimatedTrafficIncrease}%,Monthly\n`;
    csv += `Revenue Impact,$${data.roiMetrics.estimatedRevenueImpact},Monthly\n`;
    csv += `Cost Savings,$${data.roiMetrics.costSavingsFromAI},Monthly\n`;
    csv += `Competitive Advantage,${data.roiMetrics.competitiveAdvantage} points,Above Industry Average\n`;
    csv += `Brand Visibility Score,${data.roiMetrics.brandVisibilityScore},Brand Impact\n`;
    csv += `Payback Period,${data.roiMetrics.paybackPeriod} months,Implementation\n`;
    csv += `Annual ROI,${data.roiMetrics.totalROI}%,Year 1\n`;
  }

  if (reportType === 'citation') {
    csv = 'Source,URL,Snippet,Date,Type,Confidence Score,Match Type\n';
    
    data.citations.forEach((citation: any) => {
      // Escape quotes in CSV fields
      const escapedSnippet = citation.snippet.replace(/"/g, '""');
      csv += `"${citation.source}","${citation.url}","${escapedSnippet}","${citation.date}","${citation.type}",${citation.confidence_score || 0},"${citation.match_type || ''}"\n`;
    });
  }
  
  return csv;
}

function generateEnhancedPDFReport(
  reportType: string, 
  data: any, 
  reportName: string, 
  template: any, 
  config: any,
  whiteLabel: any = null
): string {
  // Get branding settings
  const companyName = whiteLabel?.company_name || config?.brandingOptions?.companyName || 'SEOGENIX';
  const primaryColor = whiteLabel?.primary_color_hex || config?.brandingOptions?.customColors?.primary || '#8B5CF6';
  const secondaryColor = whiteLabel?.secondary_color_hex || config?.brandingOptions?.customColors?.secondary || '#14B8A6';
  const logoUrl = whiteLabel?.custom_logo_url || null;
  const footerText = whiteLabel?.footer_text || config?.brandingOptions?.footerText || 'Generated by SEOGENIX - AI-Powered SEO Platform';
  
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
        
        /* Chart styles */
        .chart-container {
          background: white;
          border-radius: 12px;
          padding: 20px;
          margin: 20px 0;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          height: 300px;
          position: relative;
        }
        
        .chart-axis {
          position: absolute;
          background: #e5e7eb;
        }
        
        .chart-y-axis {
          width: 1px;
          height: 240px;
          bottom: 30px;
          left: 50px;
        }
        
        .chart-x-axis {
          height: 1px;
          width: calc(100% - 70px);
          bottom: 30px;
          left: 50px;
        }
        
        .chart-y-label {
          position: absolute;
          font-size: 12px;
          color: #6b7280;
        }
        
        .chart-x-label {
          position: absolute;
          font-size: 12px;
          color: #6b7280;
          bottom: 10px;
          text-align: center;
          transform: translateX(-50%);
        }
        
        .chart-line {
          position: absolute;
          height: 3px;
          background: linear-gradient(to right, ${primaryColor}, #a78bfa);
          bottom: 30px;
          left: 50px;
          border-radius: 3px;
        }
        
        .chart-point {
          position: absolute;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: ${primaryColor};
          transform: translate(-50%, 50%);
        }
        
        .chart-grid-line {
          position: absolute;
          left: 50px;
          right: 20px;
          height: 1px;
          background: #f3f4f6;
        }
        
        .chart-legend {
          position: absolute;
          right: 20px;
          top: 20px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .chart-legend-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: #6b7280;
        }
        
        .chart-legend-color {
          width: 12px;
          height: 3px;
          border-radius: 3px;
        }
        
        /* Print-specific styles */
        @media print {
          body {
            padding: 0;
            font-size: 12pt;
          }
          
          .header {
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          
          .chart-container {
            height: 200px;
            page-break-inside: avoid;
          }
          
          .roi-section, .competitive-section, .recommendations {
            page-break-inside: avoid;
          }
          
          table {
            page-break-inside: auto;
          }
          
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          
          thead {
            display: table-header-group;
          }
          
          tfoot {
            display: table-footer-group;
          }
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
          ${config?.brandingOptions?.includeLogo && logoUrl
            ? `<img src="${logoUrl}" alt="${companyName} Logo" style="height: 80px; width: auto;" />`
            : `<svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="80" height="80" rx="16" fill="${primaryColor}" />
                <path d="M24 40L36 52L56 32" stroke="white" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
              </svg>`
          }
          <div class="company-name">
            ${companyName}
          </div>
        </div>
        <div class="report-meta">
          <h1 style="margin: 0; font-size: 24px;">${reportName}</h1>
          <p>Generated on ${new Date().toLocaleDateString()}</p>
          <p>Report Type: ${template?.name || reportType.charAt(0).toUpperCase() + reportType.slice(1)}</p>
        </div>
      </div>
  `;

  // Executive Summary Section
  html += `
    <section>
      <h2>Executive Summary</h2>
      <p>This report provides a comprehensive analysis of your AI visibility performance${config?.dateRange ? ` over the last ${config.dateRange.replace('d', ' days')}` : ''}.</p>
      
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
        
        ${data.competitiveBenchmarks ? `
          <div class="metric-card">
            <p class="metric-value">#${data.competitiveBenchmarks.yourRanking}</p>
            <p class="metric-label">Competitive Ranking</p>
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
  if (config?.includeROI && data.roiMetrics) {
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

  // Competitive Benchmarks (if enabled)
  if (config?.includeCompetitorBenchmarks && data.competitiveBenchmarks) {
    html += `
      <section class="competitive-section">
        <h2 style="color: #92400e; margin-bottom: 20px;">Competitive Benchmarking</h2>
        
        <table>
          <thead>
            <tr>
              <th>Website</th>
              <th>AI Visibility Score</th>
              <th>Trend</th>
              <th>Position</th>
            </tr>
          </thead>
          <tbody>
            <tr style="background-color: #fef3c7;">
              <td><strong>Your Website</strong></td>
              <td><strong>${data.auditHistory?.[0]?.overall_score || 'N/A'}</strong></td>
              <td>Current</td>
              <td>#${data.competitiveBenchmarks.yourRanking}</td>
            </tr>
            ${data.competitiveBenchmarks.competitorScores.map((comp: any, index: number) => `
              <tr>
                <td>${comp.name}</td>
                <td>${comp.score}</td>
                <td>${comp.trend.charAt(0).toUpperCase() + comp.trend.slice(1)}</td>
                <td>${index + 1 === data.competitiveBenchmarks.yourRanking ? 'Your position' : `#${index + 1}`}</td>
              </tr>
            `).join('')}
            <tr>
              <td>Industry Average</td>
              <td>${data.competitiveBenchmarks.industryAverage}</td>
              <td>Benchmark</td>
              <td>-</td>
            </tr>
          </tbody>
        </table>
        
        <!-- Competitive Score Comparison Chart -->
        <div class="chart-container">
          <!-- Chart axes -->
          <div class="chart-y-axis"></div>
          <div class="chart-x-axis"></div>
          
          <!-- Y-axis labels -->
          <div class="chart-y-label" style="left: 20px; bottom: 30px;">0</div>
          <div class="chart-y-label" style="left: 20px; bottom: 90px;">25</div>
          <div class="chart-y-label" style="left: 20px; bottom: 150px;">50</div>
          <div class="chart-y-label" style="left: 20px; bottom: 210px;">75</div>
          <div class="chart-y-label" style="left: 20px; bottom: 270px;">100</div>
          
          <!-- Grid lines -->
          <div class="chart-grid-line" style="bottom: 90px;"></div>
          <div class="chart-grid-line" style="bottom: 150px;"></div>
          <div class="chart-grid-line" style="bottom: 210px;"></div>
          <div class="chart-grid-line" style="bottom: 270px;"></div>
          
          <!-- X-axis labels -->
          ${['Your Website', ...data.competitiveBenchmarks.competitorScores.map((c: any) => c.name)].map((name, index, arr) => {
            const position = 50 + (index * (100 - 50) / (arr.length - 1 || 1)) + '%';
            return `<div class="chart-x-label" style="left: ${position};">${name.length > 10 ? name.substring(0, 10) + '...' : name}</div>`;
          }).join('')}
          
          <!-- Chart points -->
          ${[data.auditHistory?.[0]?.overall_score || 0, ...data.competitiveBenchmarks.competitorScores.map((c: any) => c.score)].map((score, index, arr) => {
            const xPosition = 50 + (index * (100 - 50) / (arr.length - 1 || 1)) + '%';
            const yPosition = 30 + ((100 - score) / 100 * 240) + 'px';
            const color = index === 0 ? primaryColor : '#64748b';
            return `<div class="chart-point" style="left: ${xPosition}; bottom: ${yPosition}; background: ${color};"></div>`;
          }).join('')}
          
          <!-- Industry average line -->
          <div style="position: absolute; left: 50px; right: 20px; height: 1px; border-top: 2px dashed #f59e0b; bottom: ${30 + ((100 - data.competitiveBenchmarks.industryAverage) / 100 * 240)}px;"></div>
          
          <!-- Chart legend -->
          <div class="chart-legend">
            <div class="chart-legend-item">
              <div class="chart-legend-color" style="background: ${primaryColor};"></div>
              <span>Your Website</span>
            </div>
            <div class="chart-legend-item">
              <div class="chart-legend-color" style="background: #64748b;"></div>
              <span>Competitors</span>
            </div>
            <div class="chart-legend-item">
              <div class="chart-legend-color" style="background: #f59e0b; height: 2px; border-top: 2px dashed #f59e0b;"></div>
              <span>Industry Avg (${data.competitiveBenchmarks.industryAverage})</span>
            </div>
          </div>
        </div>
        
        <div style="margin-top: 20px; background: white; padding: 15px; border-radius: 8px;">
          <h4 style="margin: 0 0 10px; color: #92400e;">Competitive Analysis</h4>
          <p style="margin: 0; color: #92400e;">
            Your AI visibility score is ${data.auditHistory?.[0]?.overall_score > data.competitiveBenchmarks.industryAverage ? 'above' : 'below'} the industry average by ${Math.abs((data.auditHistory?.[0]?.overall_score || 0) - data.competitiveBenchmarks.industryAverage)} points.
            You currently rank #${data.competitiveBenchmarks.yourRanking} among your competitive set.
            ${data.competitiveBenchmarks.yourRanking === 1 ? 'You are leading your competitive set in AI visibility.' : `The top performer in your competitive set is ${data.competitiveBenchmarks.competitorScores[0].name} with a score of ${data.competitiveBenchmarks.competitorScores[0].score}.`}
          </p>
        </div>
      </section>
    `;
  }

  // Recommendations Section
  if (config?.includeRecommendations && data.auditHistory?.[0]?.recommendations) {
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

  // Historical Performance (if enabled)
  if (config?.includeHistory && data.auditHistory && data.auditHistory.length > 1) {
    // Generate chart data
    const auditData = [...data.auditHistory].reverse().slice(0, 10); // Get last 10 audits in chronological order
    
    html += `
      <section>
        <h2>Historical Performance</h2>
        
        <!-- Performance Trend Chart -->
        <div class="chart-container">
          <!-- Chart axes -->
          <div class="chart-y-axis"></div>
          <div class="chart-x-axis"></div>
          
          <!-- Y-axis labels -->
          <div class="chart-y-label" style="left: 20px; bottom: 30px;">0</div>
          <div class="chart-y-label" style="left: 20px; bottom: 90px;">25</div>
          <div class="chart-y-label" style="left: 20px; bottom: 150px;">50</div>
          <div class="chart-y-label" style="left: 20px; bottom: 210px;">75</div>
          <div class="chart-y-label" style="left: 20px; bottom: 270px;">100</div>
          
          <!-- Grid lines -->
          <div class="chart-grid-line" style="bottom: 90px;"></div>
          <div class="chart-grid-line" style="bottom: 150px;"></div>
          <div class="chart-grid-line" style="bottom: 210px;"></div>
          <div class="chart-grid-line" style="bottom: 270px;"></div>
          
          <!-- X-axis labels -->
          ${auditData.map((audit: any, index: number, arr) => {
            const position = 50 + (index * (100 - 50) / (arr.length - 1 || 1)) + '%';
            const date = new Date(audit.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            return `<div class="chart-x-label" style="left: ${position};">${date}</div>`;
          }).join('')}
          
          <!-- Chart line -->
          <div class="chart-line" style="width: calc(100% - 70px); transform: scaleX(${auditData.length > 1 ? 1 : 0.1});"></div>
          
          <!-- Chart points -->
          ${auditData.map((audit: any, index: number, arr) => {
            const xPosition = 50 + (index * (100 - 50) / (arr.length - 1 || 1)) + '%';
            const yPosition = 30 + ((100 - audit.overall_score) / 100 * 240) + 'px';
            return `<div class="chart-point" style="left: ${xPosition}; bottom: ${yPosition};"></div>`;
          }).join('')}
          
          <!-- Chart legend -->
          <div class="chart-legend">
            <div class="chart-legend-item">
              <div class="chart-legend-color" style="background: linear-gradient(to right, ${primaryColor}, #a78bfa);"></div>
              <span>Overall Score</span>
            </div>
          </div>
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
          <p>${whiteLabel?.footer_text || config?.brandingOptions?.footerText || 'Generated by SEOGENIX - AI-Powered SEO Platform'}</p>
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