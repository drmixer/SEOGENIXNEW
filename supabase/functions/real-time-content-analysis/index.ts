import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
// Note: Intentionally not using shared logging for this high-frequency tool to avoid noise.

// --- CORS Headers ---
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- Type Definitions ---
interface AnalysisRequest {
    content: string;
    keywords: string[];
    projectId: string;
}

// --- AI Prompt Engineering ---
const getAnalysisPrompt = (content: string, keywords: string[]): string => {
    const jsonSchema = `{
      "aiReadabilityScore": "number (0-100, how easily an AI can parse and understand the text)",
      "keywordDensity": {
        "keyword1": "number (percentage, e.g., 1.5 for 1.5%)"
      },
      "suggestions": [
        {
          "type": "string (enum: 'grammar', 'clarity', 'seo', 'tone')",
          "severity": "string (enum: 'critical', 'warning', 'suggestion')",
          "message": "string (A brief explanation of the issue)",
          "suggestion": "string (A concrete suggestion for how to fix it)",
          "position": {
            "start": "number (The starting character index of the issue)",
            "end": "number (The ending character index of the issue)"
          }
        }
      ]
    }`;

    return `
    You are a Real-time AI Writing Assistant. Your task is to analyze a piece of text as it's being written and provide immediate, actionable feedback.

    **Analysis Task:**
    - **Content to Analyze:**
      ---
      ${content}
      ---
    - **Target Keywords:** ${keywords.join(', ')}

    **Instructions:**
    Analyze the content and provide a readability score, keyword density analysis, and a list of specific suggestions for improvement.

    **CRITICAL: You MUST provide your response in a single, valid JSON object enclosed in a \`\`\`json markdown block.**
    The JSON object must follow this exact schema:
    \`\`\`json
    ${jsonSchema}
    \`\`\`

    Now, perform your real-time analysis. If the content is too short or empty, return a JSON object with empty values.
    `;
};

// --- Main Service Handler ---
export const analysisService = async (req: Request, supabase: SupabaseClient): Promise<Response> => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { content, keywords, projectId }: AnalysisRequest = await req.json();

        if (typeof content !== 'string' || !projectId) {
            throw new Error('`content` must be a string and `projectId` is required.');
        }

        if (content.length < 20) {
            return new Response(JSON.stringify({
                success: true,
                data: {
                    aiReadabilityScore: 0,
                    keywordDensity: {},
                    suggestions: [],
                }
            }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
        if (!geminiApiKey) throw new Error('Gemini API key not configured');

        const prompt = getAnalysisPrompt(content, keywords || []);

        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 1024,
                }
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
        const analysisJson = JSON.parse(jsonMatch[1]);

        if (!analysisJson.aiReadabilityScore === undefined || !analysisJson.keywordDensity || !analysisJson.suggestions) {
            throw new Error('Generated analysis is missing required fields.');
        }

        return new Response(JSON.stringify({ success: true, data: analysisJson }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        // Do not log to tool_runs, but log to console for debugging
        console.error('Real-time analysis error:', errorMessage);
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
    return await analysisService(req, supabase);
});
