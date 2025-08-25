import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// --- CORS Headers ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE'
};
// --- Inline Logging Functions ---
async function logToolRun(supabase, projectId, toolName, inputPayload) {
  if (!projectId) {
    throw new Error("logToolRun error: projectId is required.");
  }
  console.log(`Logging tool run: ${toolName} for project: ${projectId}`);
  const { data, error } = await supabase.from("tool_runs").insert({
    project_id: projectId,
    tool_name: toolName,
    input_payload: inputPayload,
    status: "running",
    created_at: new Date().toISOString()
  }).select("id").single();
  if (error) {
    console.error("Error logging tool run:", error);
    throw new Error(`Failed to log tool run. Supabase error: ${error.message}`);
  }
  if (!data || !data.id) {
    console.error("No data or data.id returned from tool_runs insert.");
    throw new Error("Failed to log tool run: No data returned after insert.");
  }
  console.log(`Tool run logged with ID: ${data.id}`);
  return data.id;
}
async function updateToolRun(supabase, runId, status, outputPayload, errorMessage) {
  if (!runId) {
    console.error("updateToolRun error: runId is required.");
    return;
  }
  console.log(`Updating tool run ${runId} with status: ${status}`);
  const update = {
    status,
    completed_at: new Date().toISOString(),
    output_payload: errorMessage ? {
      error: errorMessage
    } : outputPayload || null,
    error_message: errorMessage || null
  };
  const { error } = await supabase.from("tool_runs").update(update).eq("id", runId);
  if (error) {
    console.error(`Error updating tool run ID ${runId}:`, error);
  } else {
    console.log(`Tool run ${runId} updated successfully`);
  }
}
// --- AI Prompt Engineering ---
const getReportAnalysisPrompt = (reportType, reportName, reportData, format)=>{
  const includeHtmlBody = format === 'html';
  const jsonSchema = `{
    "reportTitle": "string (A compelling, SEO-friendly title for this report)",
    "executiveSummary": "string (A 2-3 sentence summary of the most important findings in the data, written for a busy executive)",
    "keyInsights": ["string (A specific, data-driven insight discovered from the report data)"],
    ${includeHtmlBody ? '"bodyHtml": "string (A full HTML body section with paragraphs, lists, and tables that explains the data in detail)",' : ''}
  }`;
  return `You are an Expert Data Analyst. Your task is to analyze a raw JSON data object and generate a high-level summary for a formal report.

**Report Details:**
- **Report Name:** ${reportName}
- **Report Type:** ${reportType}
- **Desired Format:** ${format}
- **Raw Data:**
---
${JSON.stringify(reportData, null, 2).substring(0, 6000)}
---

**Your Instructions:**
1. Analyze the raw data to identify the most critical trends and data points.
2. Generate a compelling 'reportTitle'.
3. Write a concise 'executiveSummary' for a busy stakeholder.
4. List the top 3-5 'keyInsights' as bullet points.
5. ${includeHtmlBody ? "Since the desired format is HTML, also generate a detailed 'bodyHtml' string. This should be semantic HTML content with paragraphs, lists, and potentially tables to explain the findings in detail." : "Do not generate a 'bodyHtml' field."}

**CRITICAL: You MUST provide your response in a single, valid JSON object enclosed in a \`\`\`json markdown block.**
The JSON object must follow this exact schema:
\`\`\`json
${jsonSchema}
\`\`\`

Perform your expert analysis now.`;
};
// --- Report Generation Helpers ---
function generateCsvReport(reportData, analysis) {
  let csv = `"Report Title","${analysis.reportTitle}"\n`;
  csv += `"Executive Summary","${analysis.executiveSummary.replace(/"/g, '""')}"\n\n`;
  csv += `"Key Insights"\n`;
  analysis.keyInsights.forEach((insight)=>{
    csv += `"${insight.replace(/"/g, '""')}"\n`;
  });
  csv += `\n"Raw Data"\n`;
  for(const key in reportData){
    const value = typeof reportData[key] === 'object' ? JSON.stringify(reportData[key]) : reportData[key];
    csv += `"${key}","${String(value).replace(/"/g, '""')}"\n`;
  }
  return csv;
}
function generateHtmlReport(reportData, analysis) {
  const insightsHtml = analysis.keyInsights.map((insight)=>`<li>${insight}</li>`).join('');
  const bodyContent = analysis.bodyHtml || `<p>A detailed analysis was not generated. Please refer to the raw data below.</p>`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${analysis.reportTitle}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 20px auto;
      padding: 20px;
      background: #fff;
    }
    h1 { color: #1a1a1a; border-bottom: 3px solid #007acc; padding-bottom: 10px; }
    h2 { border-bottom: 1px solid #eee; padding-bottom: 10px; margin-top: 30px; }
    .summary {
      font-style: italic;
      background-color: #f8f9fa;
      padding: 20px;
      border-left: 4px solid #007acc;
      margin: 20px 0;
    }
    ul { padding-left: 20px; }
    li { margin-bottom: 8px; }
    pre {
      background-color: #f4f4f4;
      padding: 15px;
      border-radius: 5px;
      white-space: pre-wrap;
      word-wrap: break-word;
      font-size: 12px;
      max-height: 400px;
      overflow-y: auto;
    }
    .analysis-content {
      margin: 20px 0;
    }
    .analysis-content p {
      margin-bottom: 15px;
    }
    .analysis-content table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }
    .analysis-content th,
    .analysis-content td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
    }
    .analysis-content th {
      background-color: #f2f2f2;
    }
  </style>
</head>
<body>
  <h1>${analysis.reportTitle}</h1>
  
  <h2>Executive Summary</h2>
  <div class="summary">${analysis.executiveSummary}</div>
  
  <h2>Key Insights</h2>
  <ul>${insightsHtml}</ul>
  
  <h2>Detailed Analysis</h2>
  <div class="analysis-content">${bodyContent}</div>
  
  <h2>Raw Data</h2>
  <pre>${JSON.stringify(reportData, null, 2)}</pre>
</body>
</html>`;
}
// --- Fallback Analysis Generator ---
function generateFallbackAnalysis(reportName, reportData, format, errorMessage) {
  const dataKeys = Object.keys(reportData || {});
  const hasData = dataKeys.length > 0;
  const analysis = {
    reportTitle: `${reportName} - Report Generated`,
    executiveSummary: hasData ? `This report contains ${dataKeys.length} data fields for analysis. Due to technical limitations, detailed AI analysis was not available.` : "This report was generated but contains limited data for analysis.",
    keyInsights: hasData ? [
      `Report contains ${dataKeys.length} data points`,
      `Primary data fields: ${dataKeys.slice(0, 3).join(', ')}${dataKeys.length > 3 ? '...' : ''}`,
      "Manual review recommended for detailed insights"
    ] : [
      "No significant data available for analysis",
      "Consider reviewing data collection methods"
    ]
  };
  if (format === 'html') {
    analysis.bodyHtml = `
      <p><strong>Report Generation Status:</strong> ${errorMessage || 'Limited analysis available'}</p>
      ${hasData ? `
        <p>This report contains the following data categories:</p>
        <ul>
          ${dataKeys.map((key)=>`<li><strong>${key}:</strong> ${typeof reportData[key]} data</li>`).join('')}
        </ul>
        <p>For detailed insights, please review the raw data section below or consider re-running the analysis.</p>
      ` : '<p>No data was available for analysis. Please check your data source and try again.</p>'}
    `;
  }
  return analysis;
}
// --- Main Service Handler ---
const reportGenerationService = async (req, supabase)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  let runId = null;
  try {
    const requestBody = await req.json();
    const { projectId, userId, reportType, reportData, reportName, format } = requestBody;
    if (!projectId || !userId || !reportData || !reportName || !format) {
      throw new Error('`projectId`, `userId`, `reportData`, `reportName`, and `format` are required.');
    }
    if (![
      'json',
      'csv',
      'html'
    ].includes(format)) {
      throw new Error('Format must be one of: json, csv, html');
    }
    runId = await logToolRun(supabase, projectId, 'enhanced-report-generation', {
      userId,
      reportType,
      reportName,
      format,
      dataSize: JSON.stringify(reportData).length
    });
    let analysis;
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      console.warn('Gemini API key not configured, using fallback analysis');
      analysis = generateFallbackAnalysis(reportName, reportData, format, 'Missing API configuration');
    } else {
      try {
        const prompt = getReportAnalysisPrompt(reportType, reportName, reportData, format);
        console.log('Sending report analysis request to Gemini...');
        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: prompt
                  }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 8192,
              topP: 0.8,
              topK: 40
            }
          })
        });
        if (!geminiResponse.ok) {
          const errorText = await geminiResponse.text();
          console.error('Gemini API error:', geminiResponse.status, errorText);
          throw new Error(`Gemini API failed: ${geminiResponse.status}`);
        }
        const geminiData = await geminiResponse.json();
        if (!geminiData.candidates || geminiData.candidates.length === 0) {
          throw new Error('No candidates in Gemini response');
        }
        const responseText = geminiData.candidates[0].content.parts[0].text;
        // Extract and parse JSON
        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
        if (!jsonMatch || !jsonMatch[1]) {
          throw new Error('Failed to extract JSON from AI response');
        }
        analysis = JSON.parse(jsonMatch[1]);
        // Validate required fields
        if (!analysis.reportTitle || !analysis.executiveSummary || !analysis.keyInsights) {
          throw new Error('Invalid analysis structure from AI');
        }
        console.log('AI analysis completed successfully');
      } catch (aiError) {
        console.warn("AI analysis failed, using fallback:", aiError.message);
        analysis = generateFallbackAnalysis(reportName, reportData, format, aiError.message);
      }
    }
    // Generate report content
    let reportContent;
    let contentType;
    let fileExtension = format;
    try {
      if (format === 'csv') {
        contentType = 'text/csv';
        reportContent = generateCsvReport(reportData, analysis);
      } else if (format === 'html') {
        contentType = 'text/html';
        reportContent = generateHtmlReport(reportData, analysis);
      } else {
        contentType = 'application/json';
        reportContent = JSON.stringify({
          analysis,
          rawData: reportData
        }, null, 2);
      }
    } catch (formatError) {
      console.error('Error generating report content:', formatError);
      // Fallback to JSON format
      contentType = 'application/json';
      fileExtension = 'json';
      reportContent = JSON.stringify({
        analysis,
        rawData: reportData,
        note: `Original format (${format}) failed, using JSON fallback`
      }, null, 2);
    }
    // Generate file name and storage path
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sanitizedReportName = reportName.replace(/[^a-zA-Z0-9\-_]/g, '_');
    const fileName = `${sanitizedReportName}_${timestamp}.${fileExtension}`;
    const storagePath = `reports/${userId}/${fileName}`;
    console.log(`Uploading report to: ${storagePath}`);
    // Upload to storage
    const { error: uploadError } = await supabase.storage.from('reports').upload(storagePath, reportContent, {
      contentType,
      upsert: true
    });
    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      throw new Error(`Failed to upload report: ${uploadError.message}`);
    }
    // Get public URL
    const { data: urlData } = supabase.storage.from('reports').getPublicUrl(storagePath);
    const downloadUrl = urlData.publicUrl;
    // Save metadata to database
    let reportId = null;
    try {
      const { data: dbRecord, error: dbError } = await supabase.from('reports').insert({
        user_id: userId,
        project_id: projectId,
        report_type: reportType || 'general',
        report_name: reportName,
        file_url: downloadUrl,
        storage_path: storagePath,
        format: fileExtension,
        created_at: new Date().toISOString()
      }).select('id').single();
      if (dbError) {
        console.error('Error saving report metadata:', dbError.message);
      // Continue anyway - the file was uploaded successfully
      } else {
        reportId = dbRecord.id;
        console.log(`Report metadata saved with ID: ${reportId}`);
      }
    } catch (dbSaveError) {
      console.error('Database save error:', dbSaveError);
    // Continue - file upload was successful
    }
    const output = {
      downloadUrl,
      reportId,
      fileName,
      format: fileExtension,
      contentType,
      analysis: {
        title: analysis.reportTitle,
        summary: analysis.executiveSummary,
        insightCount: analysis.keyInsights.length
      }
    };
    console.log('Report generation completed successfully');
    if (runId) {
      await updateToolRun(supabase, runId, 'completed', output, null);
    }
    return new Response(JSON.stringify({
      success: true,
      data: output,
      runId
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
    console.error('Report Generation Error:', errorMessage);
    if (runId) {
      await updateToolRun(supabase, runId, 'error', null, errorMessage);
    }
    return new Response(JSON.stringify({
      success: false,
      error: {
        message: errorMessage
      },
      runId
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
};
// --- Server ---
Deno.serve(async (req)=>{
  const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  return await reportGenerationService(req, supabase);
});
