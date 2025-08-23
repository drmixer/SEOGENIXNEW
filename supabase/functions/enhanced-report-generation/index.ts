import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logToolRun, updateToolRun } from '../_shared/logging.ts';

// --- CORS Headers ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// --- Type Definitions ---
interface ReportRequest {
    projectId: string;
    userId: string; // Added for logging and storage path
    reportType: string;
    reportData: Record<string, any>;
    reportName: string;
    format: 'json' | 'csv' | 'html';
}

interface AIAnalysis {
    reportTitle: string;
    executiveSummary: string;
    keyInsights: string[];
    // Added for richer HTML reports
    bodyHtml?: string;
}

// --- AI Prompt Engineering ---
const getReportAnalysisPrompt = (reportType: string, reportName: string, reportData: Record<string, any>, format: string): string => {
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
      ${JSON.stringify(reportData, null, 2)}
      ---

    **Your Instructions:**
    1.  Analyze the raw data to identify the most critical trends and data points.
    2.  Generate a compelling 'reportTitle'.
    3.  Write a concise 'executiveSummary' for a busy stakeholder.
    4.  List the top 3-5 'keyInsights' as bullet points.
    5.  ${includeHtmlBody ? "Since the desired format is HTML, also generate a detailed 'bodyHtml' string. This should be a semantic HTML section containing paragraphs, lists, and potentially tables to explain the findings in more detail." : "Do not generate a 'bodyHtml' field."}

    **CRITICAL: You MUST provide a response in a single, valid JSON object enclosed in a \`\`\`json markdown block.**
    The JSON object must strictly adhere to this schema:
    \`\`\`json
    ${jsonSchema}
    \`\`\`
    Now, perform your expert analysis.`;
}

// --- Report Generation Helpers ---
function generateCsvReport(reportData: Record<string, any>, analysis: AIAnalysis): string {
    let csv = `"Report Title","${analysis.reportTitle}"\n`;
    csv += `"Executive Summary","${analysis.executiveSummary.replace(/"/g, '""')}"\n\n`;
    csv += `"Key Insights"\n`;
    analysis.keyInsights.forEach(insight => {
        csv += `"${insight.replace(/"/g, '""')}"\n`;
    });
    csv += `\n"Raw Data"\n`;
    for (const key in reportData) {
        const value = typeof reportData[key] === 'object' ? JSON.stringify(reportData[key]) : reportData[key];
        csv += `"${key}","${String(value).replace(/"/g, '""')}"\n`;
    }
    return csv;
}

function generateHtmlReport(reportData: Record<string, any>, analysis: AIAnalysis): string {
    const insightsHtml = analysis.keyInsights.map(insight => `<li>${insight}</li>`).join('');
    const bodyContent = analysis.bodyHtml || `<p>A detailed analysis was not generated. Please refer to the raw data below.</p>`;
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${analysis.reportTitle}</title>
      <style>
        body{font-family:sans-serif;line-height:1.6;color:#333;max-width:800px;margin:20px auto;padding:20px;border:1px solid #ddd;}
        h1{color:#1a1a1a;}h2{border-bottom:1px solid #eee;padding-bottom:10px;}
        .summary{font-style:italic;background-color:#f9f9f9;padding:15px;border-left:4px solid #ccc;}
        pre{background-color:#eee;padding:15px;white-space:pre-wrap;word-wrap:break-word;}
      </style></head><body>
      <h1>${analysis.reportTitle}</h1><h2>Executive Summary</h2><p class="summary">${analysis.executiveSummary}</p>
      <h2>Key Insights</h2><ul>${insightsHtml}</ul>
      <h2>Detailed Analysis</h2><div>${bodyContent}</div>
      <h2>Raw Data</h2><pre>${JSON.stringify(reportData, null, 2)}</pre>
      </body></html>`;
}

// --- Main Service Handler ---
const reportGenerationService = async (req: Request, supabase: SupabaseClient): Promise<Response> => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    let runId: string | null = null;
    let requestBody: ReportRequest;
    try {
        requestBody = await req.json();
        const { projectId, userId, reportType, reportData, reportName, format } = requestBody;

        if (!projectId || !userId || !reportData || !reportName || !format) {
            throw new Error('`projectId`, `userId`, `reportData`, `reportName`, and `format` are required.');
        }

        runId = await logToolRun(supabase, projectId, 'enhanced-report-generation', requestBody);

        let analysis: AIAnalysis;
        try {
            const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
            if (!geminiApiKey) throw new Error('GEMINI_API_KEY is not configured.');
            const prompt = getReportAnalysisPrompt(reportType, reportName, reportData, format);
            const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${geminiApiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.4, maxOutputTokens: 8192 }
                })
            });
            if (!geminiResponse.ok) throw new Error(`Gemini API failed: ${await geminiResponse.text()}`);
            const geminiData = await geminiResponse.json();
            const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!responseText) throw new Error("No response text from Gemini.");
            analysis = JSON.parse(responseText.match(/```json\s*([\s\S]*?)\s*```/)?.[1] || responseText);
        } catch (aiError) {
            console.error("AI analysis failed, using fallback.", aiError.message);
            analysis = {
                reportTitle: `${reportName} (Unanalyzed)`,
                executiveSummary: "AI analysis failed. This report contains only raw data.",
                keyInsights: [`Error: ${aiError.message}`],
            };
        }

        let reportContent: string;
        let contentType: string;
        if (format === 'csv') {
            contentType = 'text/csv';
            reportContent = generateCsvReport(reportData, analysis);
        } else if (format === 'html') {
            contentType = 'text/html';
            reportContent = generateHtmlReport(reportData, analysis);
        } else {
            contentType = 'application/json';
            reportContent = JSON.stringify({ analysis, rawData: reportData }, null, 2);
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `${reportName.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.${format}`;
        const storagePath = `reports/${userId}/${fileName}`;

        const { error: uploadError } = await supabase.storage.from('reports').upload(storagePath, reportContent, { contentType, upsert: true });
        if (uploadError) throw new Error(`Failed to upload report: ${uploadError.message}`);

        const { data: urlData } = supabase.storage.from('reports').getPublicUrl(storagePath);
        const downloadUrl = urlData.publicUrl;

        const { data: dbRecord, error: dbError } = await supabase.from('reports').insert({ user_id: userId, project_id: projectId, report_type: reportType, report_name: reportName, file_url: downloadUrl, storage_path: storagePath }).select('id').single();
        if (dbError) console.error('Error saving report metadata:', dbError.message);

        const output = { downloadUrl, reportId: dbRecord?.id };
        await updateToolRun(supabase, runId, 'completed', output, null);

        return new Response(JSON.stringify({ success: true, data: output, runId }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        console.error("Report Generation Error:", errorMessage);
        if (runId) {
            await updateToolRun(supabase, runId, 'error', { note: errorMessage }, errorMessage);
        }
        return new Response(JSON.stringify({ success: false, error: { message: errorMessage }, runId }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
};

// --- Server ---
Deno.serve(async (req) => {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    return await reportGenerationService(req, supabase);
});
