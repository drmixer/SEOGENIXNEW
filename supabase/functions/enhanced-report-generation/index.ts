import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- CORS Headers ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// --- Type Definitions ---
interface ReportRequest {
    projectId: string;
    reportType: string;
    reportData: Record<string, any>;
    reportName: string;
    format: 'json' | 'csv' | 'html';
}

interface AIAnalysis {
    reportTitle: string;
    executiveSummary: string;
    keyInsights: string[];
}

// --- AI Prompt Engineering ---
const getReportAnalysisPrompt = (reportType: string, reportName: string, reportData: Record<string, any>): string => {
    const jsonSchema = `
    {
      "reportTitle": "string (A compelling, SEO-friendly title for this report)",
      "executiveSummary": "string (A 2-3 sentence summary of the most important findings in the data, written for a busy executive)",
      "keyInsights": [
        "string (A specific, data-driven insight discovered from the report data)"
      ]
    }
    `;
    const fewShotExample = `
    {
      "reportTitle": "Q2-2025 AI Visibility Audit Summary for Acme Corp",
      "executiveSummary": "Acme Corp's AI visibility has improved by 15% since Q1, driven by strong gains in Content Structure. However, Citation Likelihood remains a key area for improvement to maximize presence in generative search.",
      "keyInsights": [
        "The overall visibility score increased from 65 to 75.",
        "Content Structure score saw the highest growth, moving from 60 to 80.",
        "Citation Likelihood is the lowest-scoring category at 58, indicating a need for more quotable, authoritative content."
      ]
    }
    `;
    return `
    You are an Expert Data Analyst specializing in SEO and digital marketing metrics. Your task is to analyze a raw JSON data object and generate a high-level summary for a formal report.

    **Report Details:**
    - **Report Name:** ${reportName}
    - **Report Type:** ${reportType}
    - **Raw Data:**
      ---
      ${JSON.stringify(reportData, null, 2)}
      ---

    **Your Instructions:**
    Analyze the raw data and generate a title, an executive summary, and a list of key, data-driven insights.

    **Output Format:**
    You MUST provide a response in a single, valid JSON object. Do not include any text, markdown, or formatting outside of the JSON object. The JSON object must strictly adhere to the following schema:
    \`\`\`json
    ${jsonSchema}
    \`\`\`

    **Example of Ideal Output:**
    \`\`\`json
    ${fewShotExample}
    \`\`\`

    Now, perform your expert analysis of the provided data.
    `;
}

// --- Report Generation Helpers ---
function generateEnhancedCsvReport(reportData: Record<string, any>, analysis: AIAnalysis): string {
    let csv = `"Report Title","${analysis.reportTitle}"\n`;
    csv += `"Executive Summary","${analysis.executiveSummary.replace(/"/g, '""')}"\n\n`;
    csv += `"Key Insights"\n`;
    analysis.keyInsights.forEach(insight => {
        csv += `"${insight.replace(/"/g, '""')}"\n`;
    });
    csv += `\n"Raw Data"\n`;
    // Simple key-value pair representation of raw data for CSV
    for (const key in reportData) {
        const value = typeof reportData[key] === 'object' ? JSON.stringify(reportData[key]) : reportData[key];
        csv += `"${key}","${String(value).replace(/"/g, '""')}"\n`;
    }
    return csv;
}

function generateEnhancedHtmlReport(reportData: Record<string, any>, analysis: AIAnalysis): string {
    const insightsHtml = analysis.keyInsights.map(insight => `<li>${insight}</li>`).join('');
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${analysis.reportTitle}</title>
        <style>
          body { font-family: sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; }
          h1 { color: #1a1a1a; }
          h2 { border-bottom: 1px solid #eee; padding-bottom: 10px; }
          p.summary { font-style: italic; background-color: #f9f9f9; padding: 15px; border-left: 4px solid #ccc; }
          ul { list-style-type: disc; padding-left: 20px; }
          pre { background-color: #eee; padding: 15px; white-space: pre-wrap; word-wrap: break-word; }
        </style>
      </head>
      <body>
        <h1>${analysis.reportTitle}</h1>
        <h2>Executive Summary</h2>
        <p class="summary">${analysis.executiveSummary}</p>
        <h2>Key Insights</h2>
        <ul>${insightsHtml}</ul>
        <h2>Raw Data</h2>
        <pre>${JSON.stringify(reportData, null, 2)}</pre>
      </body>
      </html>
    `;
}


// --- Main Service Handler ---
export const reportGenerationService = async (req: Request, supabase: SupabaseClient): Promise<Response> => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { projectId, reportType, reportData, reportName, format }: ReportRequest = await req.json();

        // Note: Logging is omitted here as it's not essential to the core logic of this complex function
        // and has proven problematic in the current test environment.

        if (!reportData || !reportName || !format) {
            throw new Error('`reportData`, `reportName`, and `format` are required.');
        }

        // 1. Get AI Analysis
        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
        if (!geminiApiKey) throw new Error('Gemini API key not configured');
        const prompt = getReportAnalysisPrompt(reportType, reportName, reportData);
        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { response_mime_type: "application/json", temperature: 0.4, maxOutputTokens: 2048 }
            })
        });

        if (!geminiResponse.ok) {
            throw new Error(`The AI model failed to process the request. Status: ${geminiResponse.status}`);
        }
        const geminiData = await geminiResponse.json();
        const analysisJson: AIAnalysis = JSON.parse(geminiData.candidates[0].content.parts[0].text);

        // 2. Generate Report Content
        let reportContent: string;
        let contentType: string;
        let fileExtension = format;

        if (format === 'csv') {
            contentType = 'text/csv';
            reportContent = generateEnhancedCsvReport(reportData, analysisJson);
        } else if (format === 'html') {
            contentType = 'text/html';
            reportContent = generateEnhancedHtmlReport(reportData, analysisJson);
        } else {
            contentType = 'application/json';
            // For JSON format, we'll combine the analysis and raw data
            reportContent = JSON.stringify({ analysis: analysisJson, rawData: reportData }, null, 2);
        }

        // 3. Authenticate user and upload report
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('Authorization header required');
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabase.auth.getUser(token);
        if (!user) throw new Error('Invalid authentication');

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `${reportName.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.${fileExtension}`;
        const storagePath = `reports/${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage.from('reports').upload(storagePath, reportContent, { contentType, upsert: true });
        if (uploadError) throw new Error(`Failed to upload report: ${uploadError.message}`);

        // 4. Get public URL and save metadata
        const { data: urlData } = supabase.storage.from('reports').getPublicUrl(storagePath);
        const downloadUrl = urlData.publicUrl;
        const { data: reportRecord, error: dbError } = await supabase.from('reports').insert({ user_id: user.id, report_type: reportType, report_name: reportName, report_data: reportData, file_url: downloadUrl, storage_path: storagePath }).select().single();
        if (dbError) console.error('Error saving report metadata:', dbError);

        return new Response(JSON.stringify({ success: true, data: { downloadUrl, reportId: reportRecord?.id } }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        const errorCode = err instanceof Error ? err.name : 'UNKNOWN_ERROR';
        return new Response(JSON.stringify({ success: false, error: { message: errorMessage, code: errorCode } }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
};

// --- Server ---
// We pass the Supabase client instance to the handler to make it testable
Deno.serve((req) => reportGenerationService(req, createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
)));
