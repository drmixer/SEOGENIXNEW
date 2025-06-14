import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

interface EnhancedReportRequest {
  reportType: 'audit' | 'competitive' | 'citation' | 'comprehensive' | 'roi_focused';
  reportData: any;
  reportName: string;
  format: 'pdf' | 'csv' | 'json';
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
    } else if (format === 'pdf') {
      // Use text/html content type so browser can render it properly
      contentType = 'text/html';
      fileExtension = 'html';
      reportContent = generateEnhancedPDFReport(reportType, reportData, reportName, template, config);
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

    // Save enhanced report metadata
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
        template: template?.name,
        enhancedFeatures: {
          roiAnalysis: config?.includeROI,
          competitiveBenchmarks: config?.includeCompetitorBenchmarks,
          customBranding: config?.brandingOptions?.includeLogo
        },
        generatedAt: new Date().toISOString(),
        reportId: reportRecord?.id
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
  
  if (reportType === 'roi_focused' && data.roiMetrics) {
    csv = 'Metric,Value,Impact\n';
    csv += `Traffic Increase,${data.roiMetrics.estimatedTrafficIncrease}%,Monthly\n`;
    csv += `Revenue Impact,$${data.roiMetrics.estimatedRevenueImpact},Monthly\n`;
    csv += `Cost Savings,$${data.roiMetrics.costSavingsFromAI},Monthly\n`;
    csv += `Competitive Advantage,${data.roiMetrics.competitiveAdvantage} points,Above Industry Average\n`;
    csv += `Payback Period,${data.roiMetrics.paybackPeriod} months,Implementation\n`;
    csv += `Annual ROI,${data.roiMetrics.totalROI}%,Year 1\n`;
  } else if (reportType === 'audit' && data.auditHistory) {
    csv = 'Date,Website,Overall Score,AI Understanding,Citation Likelihood,Conversational Readiness,Content Structure\n';
    
    data.auditHistory.forEach((audit: any) => {
      csv += `${audit.created_at},${audit.website_url},${audit.overall_score},${audit.ai_understanding},${audit.citation_likelihood},${audit.conversational_readiness},${audit.content_structure}\n`;
    });
  } else if (reportType === 'competitive' && data.competitiveBenchmarks) {
    csv = 'Competitor,Score,Trend,Market Position\n';
    
    data.competitiveBenchmarks.competitorScores.forEach((comp: any) => {
      csv += `${comp.name},${comp.score},${comp.trend},Competitor\n`;
    });
    
    csv += `Your Site,${data.auditHistory?.[0]?.overall_score || 'N/A'},Current,Position ${data.competitiveBenchmarks.yourRanking}\n`;
    csv += `Industry Average,${data.competitiveBenchmarks.industryAverage},Benchmark,Average\n`;
  }
  
  return csv;
}

function generateEnhancedPDFReport(reportType: string, data: any, reportName: string, template: any, config: any): string {
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
          border-bottom: 3px solid #8B5CF6; 
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
          color: #8B5CF6;
        }
        .report-meta {
          text-align: right;
          color: #6b7280;
        }
        .score { 
          font-size: 48px; 
          font-weight: bold; 
          color: #8B5CF6;
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
          border-left: 4px solid #8B5CF6;
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
          border: 2px solid #10b981;
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
          background: #8B5CF6; 
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
        .chart-container {
          background: white;
          border-radius: 12px;
          padding: 20px;
          margin: 20px 0;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          height: 300px;
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
          ${config?.brandingOptions?.includeLogo 
            ? `<img src="https://via.placeholder.com/80x80" alt="Logo" />`
            : `<svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="80" height="80" rx="16" fill="#8B5CF6" />
                <path d="M24 40L36 52L56 32" stroke="white" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
              </svg>`
          }
          <div class="company-name">
            ${config?.brandingOptions?.companyName || 'SEOGENIX'}
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
    html += `
      <section>
        <h2>Historical Performance</h2>
        
        <div class="chart-container">
          <p style="text-align: center; color: #6b7280;">
            [Chart visualization would appear here in the actual PDF]
          </p>
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
          <p>${config?.brandingOptions?.footerText || 'Generated by SEOGENIX - AI-Powered SEO Platform'}</p>
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