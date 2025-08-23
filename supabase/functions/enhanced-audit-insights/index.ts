import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logToolRun, updateToolRun } from '../_shared/logging.ts';

// --- CORS Headers ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// --- Type Definitions ---
interface InsightsRequest {
    projectId: string;
    auditRunId: string; // The ID of the ai_visibility_audit run
}

// --- AI Prompt Engineering ---
const getInsightsPrompt = (auditResult: any): string => {
    const { url, overallScore, subscores, content } = auditResult;

    const jsonSchema = `{
      "deepDiveAnalysis": [
        {
          "subscoreName": "string (e.g., 'aiUnderstanding')",
          "score": "number (The score for this component)",
          "reasoning": "string (A detailed explanation for why this score was given, citing specific examples from the content)",
          "actionableAdvice": "string (A concrete next step the user can take to improve this specific score)"
        }
      ],
      "problematicSentences": [
        {
          "sentence": "string (The exact problematic sentence from the content)",
          "issue": "string (A clear description of the problem, e.g., 'ambiguous language', 'complex structure')",
          "suggestion": "string (A rewritten version of the sentence that fixes the issue)"
        }
      ]
    }`;

    return `You are a Senior AI SEO Analyst. Your task is to provide a deep-dive analysis of a previous AI Visibility Audit.

    **Original Audit Data:**
    - **URL:** ${url}
    - **Overall Score:** ${overallScore}
    - **Subscores:** ${JSON.stringify(subscores, null, 2)}
    - **Content Snippet:**
      ---
      ${content ? content.substring(0, 8000) : 'No content available.'}
      ---

    **Analysis Instructions:**
    1.  **Analyze Subscores:** For each subscore provided (aiUnderstanding, citationLikelihood, conversationalReadiness, contentStructure), provide a detailed 'reasoning' for the score. Your reasoning must be specific and reference the provided content. Then, provide a single, highly 'actionableAdvice' for improving that score.
    2.  **Identify Problematic Sentences:** Scan the content and identify 3-5 sentences that are most problematic for AI comprehension. These could be overly complex, ambiguous, or poorly structured.
    3.  **Provide Suggestions:** For each problematic sentence, explain the 'issue' and provide a 'suggestion' for how to rewrite it clearly.

    **CRITICAL: You MUST provide your response in a single, valid JSON object enclosed in a \`\`\`json markdown block.**
    The JSON object must follow this exact schema:
    \`\`\`json
    ${jsonSchema}
    \`\`\`
    Perform your deep-dive analysis now.`;
};

// --- Fallback Generator ---
function generateFallbackOutput(message: string): any {
    return {
        deepDiveAnalysis: [],
        problematicSentences: [],
        note: `Enhanced insights could not be generated: ${message}`
    };
}

// --- Main Service Handler ---
const enhancedAuditInsightsService = async (req: Request, supabase: SupabaseClient): Promise<Response> => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    let runId: string | null = null;
    let requestBody: InsightsRequest;
    try {
        requestBody = await req.json();
        const { projectId, auditRunId } = requestBody;

        if (!projectId || !auditRunId) {
            throw new Error('`projectId` and `auditRunId` are required.');
        }

        runId = await logToolRun(supabase, projectId, 'enhanced-audit-insights', { auditRunId });

        // Fetch the original audit data
        const { data: auditRun, error: auditError } = await supabase
            .from('tool_runs')
            .select('input_payload, output_payload')
            .eq('id', auditRunId)
            .single();

        if (auditError || !auditRun) {
            throw new Error(`Failed to fetch original audit run (ID: ${auditRunId}): ${auditError?.message || 'Not found'}`);
        }

        const auditResult = { ...auditRun.input_payload, ...auditRun.output_payload };
        if (!auditResult.overallScore || !auditResult.subscores) {
            throw new Error("The provided audit run does not contain the necessary score data.");
        }

        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
        if (!geminiApiKey) throw new Error('GEMINI_API_KEY is not configured.');

        const prompt = getInsightsPrompt(auditResult);
        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.3, maxOutputTokens: 4096 }
            })
        });

        if (!geminiResponse.ok) throw new Error(`Gemini API failed: ${await geminiResponse.text()}`);

        const geminiData = await geminiResponse.json();
        const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!responseText) throw new Error("No response text from Gemini.");

        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
        if (!jsonMatch || !jsonMatch[1]) throw new Error('Could not extract JSON from AI response.');

        const output = JSON.parse(jsonMatch[1]);

        await updateToolRun(supabase, runId, 'completed', output, null);

        return new Response(JSON.stringify({ success: true, data: output, runId }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        console.error("Enhanced Audit Insights Error:", errorMessage);

        if (runId) {
            const fallbackOutput = generateFallbackOutput(errorMessage);
            await updateToolRun(supabase, runId, 'error', fallbackOutput, errorMessage);
            return new Response(JSON.stringify({ success: true, data: { ...fallbackOutput, runId } }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        return new Response(JSON.stringify({ success: false, error: { message: errorMessage }, runId }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
}

// --- Server ---
Deno.serve(async (req: Request) => {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    return await enhancedAuditInsightsService(req, supabase);
});
