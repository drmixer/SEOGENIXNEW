import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// --- Type Definitions & Helpers ---
interface LogToolRunParams { /* ... */ }
interface UpdateToolRunParams { /* ... */ }

// Database logging helpers (logToolRun, updateToolRun) are assumed to be here and correct.
// For brevity, they are not redefined.

async function logToolRun({ projectId, toolName, inputPayload }) {
    const { data, error } = await supabase.from('tool_runs').insert({ project_id: projectId, tool_name: toolName, input_payload: inputPayload, status: 'running' }).select('id').single();
    if (error) { console.error('Error logging tool run:', error); return null; }
    return data.id;
}

async function updateToolRun({ runId, status, outputPayload, errorMessage }) {
    const update = { status, completed_at: new Date().toISOString(), output_payload: outputPayload || null, error_message: errorMessage || null };
    const { error } = await supabase.from('tool_runs').update(update).eq('id', runId);
    if (error) { console.error('Error updating tool run:', error); }
}

async function updateToolRunProgress(runId: string, progress: Record<string, unknown>) {
  const { error } = await supabase.from('tool_runs').update({ progress }).eq('id', runId);
  if (error) {
    console.error('Error updating tool run progress:', error);
  }
}

// --- Multi-Step Prompt Definitions ---

const getStep1Prompt = (content: string) => `
You are an expert AI Visibility Auditor, focusing on on-page content. Analyze the following content.
Content:
---
${content.substring(0, 8000)}
---
Evaluate the content's AI Understanding (how well an AI can understand the core topic).
Return ONLY a JSON object with this structure:
{
  "aiUnderstanding": "number (0-100)",
  "onPageRecommendations": [{"title": "string", "description": "string", "action_type": "string"}],
  "onPageIssues": [{"title": "string", "description": "string"}]
}`;

const getStep2Prompt = (content: string) => `
You are an expert AI Visibility Auditor, focusing on content structure. Analyze the following content.
Content:
---
${content.substring(0, 8000)}
---
Evaluate the Content Structure (quality of HTML structure, metadata, schema).
Return ONLY a JSON object with this structure:
{
  "contentStructure": "number (0-100)",
  "structureRecommendations": [{"title": "string", "description": "string", "action_type": "string"}],
  "structureIssues": [{"title": "string", "description": "string"}]
}`;

const getStep3Prompt = (content: string) => `
You are an expert AI Visibility Auditor, focusing on conversational readiness. Analyze the following content.
Content:
---
${content.substring(0, 8000)}
---
Evaluate the Citation Likelihood and Conversational Readiness.
Return ONLY a JSON object with this structure:
{
  "citationLikelihood": "number (0-100)",
  "conversationalReadiness": "number (0-100)",
  "readinessRecommendations": [{"title": "string", "description": "string", "action_type": "string"}],
  "readinessIssues": [{"title": "string", "description": "string"}]
}`;

async function callGemini(prompt: string, apiKey: string) {
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              response_mime_type: "application/json",
              temperature: 0.2, maxOutputTokens: 2048
            }
        })
    });
    if (!geminiResponse.ok) {
        const errorBody = await geminiResponse.text();
        console.error('Gemini API error:', errorBody);
        throw new Error(`The AI model failed to process the request. Status: ${geminiResponse.status}`);
    }
    const geminiData = await geminiResponse.json();
    return JSON.parse(geminiData.candidates[0].content.parts[0].text);
}


// --- Main Service ---
export const auditService = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let runId: string | null = null;
  try {
    const { projectId, url, content } = await req.json();

    runId = await logToolRun({
      projectId,
      toolName: 'ai-visibility-audit',
      inputPayload: { url, content: content ? 'Content provided' : 'No content provided' }
    });
    if (!runId) throw new Error("Failed to create a run log.");

    let pageContent = content;
    if (url && !content) {
        // Fetch content logic...
        const response = await fetch(url, { headers: { 'User-Agent': 'SEOGENIX Audit Bot 1.0' } });
        if (!response.ok) throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
        pageContent = await response.text();
    }
    if (!pageContent) throw new Error("Content is empty.");

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) throw new Error('Gemini API key not configured');

    // --- Execute Step 1 ---
    await updateToolRunProgress(runId, { step: 'Analyzing On-Page Content', progress: 10 });
    const step1Result = await callGemini(getStep1Prompt(pageContent), geminiApiKey);

    // --- Execute Step 2 ---
    await updateToolRunProgress(runId, { step: 'Analyzing Content Structure', progress: 40 });
    const step2Result = await callGemini(getStep2Prompt(pageContent), geminiApiKey);

    // --- Execute Step 3 ---
    await updateToolRunProgress(runId, { step: 'Assessing Conversational Readiness', progress: 70 });
    const step3Result = await callGemini(getStep3Prompt(pageContent), geminiApiKey);

    await updateToolRunProgress(runId, { step: 'Compiling Final Report', progress: 95 });

    // --- Combine Results ---
    const finalResult = {
        subscores: {
            aiUnderstanding: step1Result.aiUnderstanding || 0,
            contentStructure: step2Result.contentStructure || 0,
            citationLikelihood: step3Result.citationLikelihood || 0,
            conversationalReadiness: step3Result.conversationalReadiness || 0,
        },
        recommendations: [
            ...(step1Result.onPageRecommendations || []),
            ...(step2Result.structureRecommendations || []),
            ...(step3Result.readinessRecommendations || [])
        ],
        issues: [
            ...(step1Result.onPageIssues || []),
            ...(step2Result.structureIssues || []),
            ...(step3Result.readinessIssues || [])
        ],
        overallScore: 0
    };

    // Calculate overall score as an average of subscores
    const scores = Object.values(finalResult.subscores);
    finalResult.overallScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

    await updateToolRun({
        runId,
        status: 'completed',
        outputPayload: finalResult,
        errorMessage: null,
    });

    return new Response(JSON.stringify({ success: true, data: { runId, ...finalResult } }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
    if (runId) {
      await updateToolRun({ runId, status: 'error', outputPayload: null, errorMessage });
    }
    return new Response(JSON.stringify({ success: false, error: { message: errorMessage } }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

Deno.serve(auditService);
