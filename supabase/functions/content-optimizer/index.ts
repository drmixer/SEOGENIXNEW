import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logToolRun, updateToolRun } from "shared/logging.ts";

// --- CORS Headers ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- Type Definitions ---
interface OptimizerRequest {
    projectId: string;
    content: string;
    targetKeywords: string[];
    contentType: 'blog post' | 'landing page' | 'product description';
}

// --- AI Prompt Engineering ---
const getOptimizerPrompt = (request: OptimizerRequest): string => {
    const { content, targetKeywords, contentType } = request;
    const jsonSchema = `{
        "optimizedContent": "string (The fully rewritten, optimized content)",
        "analysis": {
            "originalScore": "number (0-100, your estimated SEO score of the original text)",
            "optimizedScore": "number (0-100, your estimated SEO score of the new text)",
            "improvements": ["string (A list of the key improvements you made)"]
        }
    }`;

    return `You are an expert SEO Content Editor. Your task is to analyze and rewrite a piece of content to improve its SEO performance and AI visibility.

    **Context:**
    - **Content Type:** ${contentType}
    - **Target Keywords:** ${targetKeywords.join(', ')}
    - **Original Content:**
      ---
      ${content.substring(0, 12000)}
      ---

    **Instructions:**
    1.  Thoroughly analyze the original content.
    2.  Rewrite the content to be more engaging, clear, and optimized for the target keywords.
    3.  Naturally integrate the keywords. Do not "stuff" them.
    4.  Improve the structure, headings, and overall flow.
    5.  Provide an analysis comparing the original to the optimized version.

    **CRITICAL: You MUST provide your response in a single, valid JSON object enclosed in a \`\`\`json markdown block.**
    The JSON object must follow this exact schema:
    \`\`\`json
    ${jsonSchema}
    \`\`\`

    Rewrite and analyze the content now.`;
};

// --- Main Service Handler ---
export const optimizerService = async (req: Request, supabase: SupabaseClient): Promise<Response> => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    let runId: string | null = null;
    try {
        const requestBody: OptimizerRequest = await req.json();
        const { projectId, content, targetKeywords, contentType } = requestBody;

        if (!projectId || !content || !targetKeywords || !contentType) {
            throw new Error('`projectId`, `content`, `targetKeywords`, and `contentType` are required.');
        }

        runId = await logToolRun(supabase, projectId, 'content-optimizer', { contentType, targetKeywords, contentLength: content.length });

        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
        if (!geminiApiKey) throw new Error('Gemini API key not configured');

        const prompt = getOptimizerPrompt(requestBody);

        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.5,
                    maxOutputTokens: 4096,
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

        if (!analysisJson.optimizedContent || !analysisJson.analysis?.optimizedScore) {
            throw new Error('Generated content from AI is missing required fields.');
        }

        const output = { ...analysisJson, originalContent: content, targetKeywords };

        if (runId) {
            await updateToolRun(supabase, runId, 'completed', output, null);
        }

        return new Response(JSON.stringify({ success: true, data: { runId, ...output } }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err: unknown) {
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
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    return await optimizerService(req, supabase);
});
