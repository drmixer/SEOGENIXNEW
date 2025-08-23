import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { updateToolRun } from "../_shared/logging.ts"; // Only importing updateToolRun for error logging

// --- CORS Headers ---
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// --- Type Definitions ---
interface AnalysisRequest {
    projectId: string;
    content: string;
    keywords?: string[];
}

// --- AI Prompt Engineering ---
const getAnalysisPrompt = (content: string): string => {
    const jsonSchema = `{
      "aiReadabilityScore": "number (0-100, how easily an AI can parse and understand the text)",
      "suggestions": [
        {
          "type": "string ('clarity' | 'seo' | 'tone' | 'engagement')",
          "severity": "string ('critical' | 'warning' | 'suggestion')",
          "message": "string (A brief explanation of the issue)",
          "suggestion": "string (A concrete suggestion for how to fix it)"
        }
      ]
    }`;

    return `You are a Real-time AI Writing Assistant. Your task is to analyze a piece of text as it's being written and provide immediate, actionable feedback. Focus on high-level concepts like clarity, SEO alignment, and tone. Do not perform simple grammar or spell-checking.

    **Content to Analyze:**
    ---
    ${content}
    ---

    **Instructions:**
    1.  Provide an 'aiReadabilityScore' from 0 to 100.
    2.  Provide a list of specific, high-level 'suggestions' for improvement.

    **CRITICAL: You MUST provide your response in a single, valid JSON object enclosed in a \`\`\`json markdown block.**
    The JSON object must follow this exact schema:
    \`\`\`json
    ${jsonSchema}
    \`\`\`
    Now, perform your real-time analysis. If the content is too short or empty, return a JSON object with a score of 0 and empty suggestions.`;
};

// --- Helper Functions ---
function calculateKeywordDensity(content: string, keywords: string[]): Record<string, number> {
    if (!content || keywords.length === 0) return {};
    const words = content.toLowerCase().split(/\s+/);
    const wordCount = words.length;
    if (wordCount === 0) return {};

    const density: Record<string, number> = {};
    keywords.forEach(keyword => {
        const keywordLower = keyword.toLowerCase();
        const count = words.filter(word => word.includes(keywordLower)).length;
        density[keyword] = parseFloat(((count / wordCount) * 100).toFixed(2));
    });
    return density;
}

// --- Main Service Handler ---
const analysisService = async (req: Request, supabase: SupabaseClient): Promise<Response> => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    let requestBody: AnalysisRequest;
    try {
        requestBody = await req.json();
        const { content, keywords = [], projectId } = requestBody;

        if (typeof content !== 'string' || !projectId) {
            throw new Error('`content` must be a string and `projectId` is required.');
        }

        // Calculate keyword density locally instead of asking the AI
        const keywordDensity = calculateKeywordDensity(content, keywords);

        if (content.trim().length < 25) {
            return new Response(JSON.stringify({ success: true, data: { aiReadabilityScore: 0, keywordDensity, suggestions: [] } }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
        if (!geminiApiKey) throw new Error('GEMINI_API_KEY is not configured.');

        const prompt = getAnalysisPrompt(content);

        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.3, maxOutputTokens: 2048 }
            })
        });

        if (!geminiResponse.ok) throw new Error(`Gemini API failed: ${await geminiResponse.text()}`);

        const geminiData = await geminiResponse.json();
        const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!responseText) throw new Error("No response text from Gemini.");

        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
        if (!jsonMatch || !jsonMatch[1]) throw new Error('Could not extract JSON from AI response.');

        const analysisJson = JSON.parse(jsonMatch[1]);
        if (analysisJson.aiReadabilityScore === undefined || !analysisJson.suggestions) {
            throw new Error('Generated analysis is missing required fields.');
        }

        const output = { ...analysisJson, keywordDensity };
        // Successful runs are not logged to tool_runs to avoid noise. Only errors are.
        return new Response(JSON.stringify({ success: true, data: output }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        console.error('Real-time analysis error:', errorMessage);

        // Log only errors to tool_runs for this high-frequency tool
        if (requestBody?.projectId) {
            const runId = await logToolRun(supabase, requestBody.projectId, 'real-time-content-analysis-error', { error: errorMessage });
            if(runId) await updateToolRun(supabase, runId, 'error', null, errorMessage);
        }

        // Return a generic empty response on failure to avoid breaking the UI
        return new Response(JSON.stringify({ success: true, data: { aiReadabilityScore: 0, keywordDensity: {}, suggestions: [], error: errorMessage } }), {
            status: 200,
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
    return await analysisService(req, supabase);
});
