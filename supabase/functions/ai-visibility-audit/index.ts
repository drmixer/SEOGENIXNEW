import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logToolRun, updateToolRun } from "../_shared/logging.ts";

// --- CORS Headers ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- AI Prompts ---
const getStep1Prompt = (content: string) => `
You are an AI Visibility Auditor. Analyze the provided webpage content to determine how well an AI model like Google's Gemini or OpenAI's GPT-4 could understand it.
**Content:**
${content.substring(0, 8000)}

**Instructions:**
1.  Assess the clarity, structure, and semantic richness of the text.
2.  Provide a score from 1-100 for "AI Understanding".
3.  List 2-3 specific, actionable recommendations to improve AI comprehension.
4.  List any issues found.

**CRITICAL: You MUST provide your response in a single, valid JSON object enclosed in a \`\`\`json markdown block.**
The JSON object must follow this exact schema:
\`\`\`json
{
  "aiUnderstanding": 0,
  "onPageRecommendations": [],
  "onPageIssues": []
}
\`\`\`
`;

const getStep2Prompt = (content: string) => `
You are a Technical SEO Analyst. Analyze the structural and technical elements of the provided webpage content.
**Content:**
${content.substring(0, 8000)}

**Instructions:**
1.  Evaluate the heading structure (H1, H2s, etc.), use of lists, and data formatting.
2.  Provide a score from 1-100 for "Content Structure".
3.  List 2-3 specific, actionable recommendations to improve content structure for crawlers.
4.  List any issues found.

**CRITICAL: You MUST provide your response in a single, valid JSON object enclosed in a \`\`\`json markdown block.**
The JSON object must follow this exact schema:
\`\`\`json
{
  "contentStructure": 0,
  "structureRecommendations": [],
  "structureIssues": []
}
\`\`\`
`;

const getStep3Prompt = (content: string) => `
You are a Conversational AI Expert. Assess the provided webpage content for its readiness to be used in conversational contexts.
**Content:**
${content.substring(0, 8000)}

**Instructions:**
1.  Evaluate its suitability for direct answers (like in a featured snippet).
2.  Provide a score from 1-100 for "Citation Likelihood" and "Conversational Readiness".
3.  List 2-3 specific recommendations to improve its readiness for conversational AI.
4.  List any issues found.

**CRITICAL: You MUST provide your response in a single, valid JSON object enclosed in a \`\`\`json markdown block.**
The JSON object must follow this exact schema:
\`\`\`json
{
  "citationLikelihood": 0,
  "conversationalReadiness": 0,
  "readinessRecommendations": [],
  "readinessIssues": []
}
\`\`\`
`;

async function callApiAndParse(prompt: string, apiKey: string) {
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 2048 }
        })
    });
    if (!geminiResponse.ok) {
        const errorBody = await geminiResponse.text();
        throw new Error(`The AI model failed to process the request. Status: ${geminiResponse.status}. Body: ${errorBody}`);
    }
    const geminiData = await geminiResponse.json();
    const responseText = geminiData.candidates[0].content.parts[0].text;
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
    if (!jsonMatch || !jsonMatch[1]) {
        throw new Error('Failed to extract JSON from AI response.');
    }
    return JSON.parse(jsonMatch[1]);
}

// --- Main Service Handler ---
const auditService = async (req: Request, supabase: SupabaseClient) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let runId = null;
  try {
    const { projectId, url, content } = await req.json();
    if (!projectId || !url) {
        throw new Error("projectId and url are required.");
    }

    runId = await logToolRun(supabase, projectId, 'ai-visibility-audit', { url, content: content ? 'Content provided' : 'No content provided' });

    let pageContent = content;
    if (url && !content) {
      console.log(`Fetching content from URL: ${url}`);
      const response = await fetch(url, { headers: { 'User-Agent': 'SEOGENIX Audit Bot 1.0' } });
      if (!response.ok) throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
      pageContent = await response.text();
    }
    if (!pageContent) throw new Error("Content is empty.");

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) throw new Error('Gemini API key not configured');

    const [step1Result, step2Result, step3Result] = await Promise.all([
        callApiAndParse(getStep1Prompt(pageContent), geminiApiKey),
        callApiAndParse(getStep2Prompt(pageContent), geminiApiKey),
        callApiAndParse(getStep3Prompt(pageContent), geminiApiKey)
    ]);

    const finalResult = {
      subscores: {
        aiUnderstanding: step1Result.aiUnderstanding || 0,
        contentStructure: step2Result.contentStructure || 0,
        citationLikelihood: step3Result.citationLikelihood || 0,
        conversationalReadiness: step3Result.conversationalReadiness || 0
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
    const scores = Object.values(finalResult.subscores);
    finalResult.overallScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

    await updateToolRun(supabase, runId, 'completed', finalResult, null);

    return new Response(JSON.stringify({ success: true, data: { runId, ...finalResult } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
    if (runId) {
      await updateToolRun(supabase, runId, 'error', null, errorMessage);
    }
    return new Response(JSON.stringify({ success: false, error: { message: errorMessage } }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

// --- Server ---
Deno.serve(async (req) => {
    const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    return await auditService(req, supabase);
});
