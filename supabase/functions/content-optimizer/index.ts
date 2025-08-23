import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logToolRun, updateToolRun } from 'shared/logging.ts';

// --- CORS Headers ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// --- Type Definitions ---
interface OptimizerRequest {
    projectId: string;
    content: string;
    targetKeywords: string[];
    contentType: 'blog post' | 'landing page' | 'product description';
    tone?: 'professional' | 'casual' | 'witty' | 'authoritative';
}

// --- AI Prompt Engineering ---
const getOptimizerPrompt = (request: OptimizerRequest): string => {
    const { content, targetKeywords, contentType, tone } = request;
    const jsonSchema = `{
        "optimizedContent": "string (The fully rewritten, optimized content, adhering to the requested tone)",
        "analysis": {
            "originalScore": "number (0-100, estimated AI-readiness score of the original text)",
            "optimizedScore": "number (0-100, estimated AI-readiness score of the new text)",
            "improvements": [
                {
                    "area": "string (e.g., 'Clarity', 'Keyword Integration', 'Structure', 'Engagement')",
                    "change": "string (Description of the specific improvement made)",
                    "before": "string (Example from original text)",
                    "after": "string (Example from new text)"
                }
            ]
        }
    }`;

    return `You are an expert SEO Content Editor and AI Optimization specialist. Your task is to rewrite a piece of content to maximize its SEO performance, readability, and AI visibility.

    **Optimization Context:**
    - **Content Type:** ${contentType}
    - **Primary Target Keywords:** ${targetKeywords.join(', ')}
    - **Desired Tone:** ${tone || 'neutral (match original)'}

    **Original Content (Analyze and Rewrite This):**
    ---
    ${content.substring(0, 12000)}
    ---

    **Instructions:**
    1.  **Full Rewrite:** Completely rewrite the original content. Do not just make minor edits.
    2.  **Keyword Optimization:** Seamlessly integrate the target keywords. Prioritize natural language over keyword density.
    3.  **Structural Improvement:** Enhance the structure with clear headings (H2, H3), lists, and short paragraphs for better scannability by both humans and AI.
    4.  **Tone Application:** Rewrite the text in the specified '${tone || 'neutral'}' tone.
    5.  **Actionable Analysis:** Provide a detailed analysis of the improvements you made, comparing the original to the optimized version with specific examples.

    **CRITICAL: You MUST provide your response in a single, valid JSON object enclosed in a \`\`\`json markdown block.**
    The JSON object must follow this exact schema:
    \`\`\`json
    ${jsonSchema}
    \`\`\`

    Perform the comprehensive content optimization now.`;
};

// --- Fallback Generator ---
function generateFallbackOutput(originalContent: string, message: string): any {
    console.warn(`Generating fallback for content optimizer: ${message}`);
    return {
        optimizedContent: originalContent,
        analysis: {
            originalScore: 0,
            optimizedScore: 0,
            improvements: []
        },
        note: `Optimization failed: ${message}. The original content is returned.`
    };
}

// --- Main Service Handler ---
const optimizerService = async (req: Request, supabase: SupabaseClient): Promise<Response> => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    let runId: string | null = null;
    let requestBody: OptimizerRequest;

    try {
        requestBody = await req.json();
        const { projectId, content, targetKeywords, contentType } = requestBody;

        if (!projectId || !content || !targetKeywords || !contentType) {
            throw new Error('`projectId`, `content`, `targetKeywords`, and `contentType` are required.');
        }

        runId = await logToolRun(supabase, projectId, 'content-optimizer', {
            contentType,
            targetKeywords,
            contentLength: content.length,
            tone: requestBody.tone
        });

        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
        if (!geminiApiKey) {
            throw new Error('GEMINI_API_KEY is not configured in environment secrets.');
        }

        const prompt = getOptimizerPrompt(requestBody);

        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.6,
                    maxOutputTokens: 8192,
                }
            })
        });

        if (!geminiResponse.ok) {
            const errorBody = await geminiResponse.text();
            console.error("Gemini API Error:", errorBody);
            throw new Error(`The AI model failed to process the request. Status: ${geminiResponse.status}`);
        }

        const geminiData = await geminiResponse.json();

        if (!geminiData.candidates || geminiData.candidates.length === 0) {
            throw new Error('No content received from the AI model.');
        }

        const responseText = geminiData.candidates[0].content.parts[0].text;

        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
        if (!jsonMatch || !jsonMatch[1]) {
            console.error("Failed to extract JSON from AI response:", responseText);
            throw new Error('Could not parse the structure of the AI response.');
        }

        let analysisJson;
        try {
            analysisJson = JSON.parse(jsonMatch[1]);
        } catch(e) {
            console.error("Invalid JSON from AI:", e.message);
            throw new Error("The AI returned invalid JSON and the result could not be parsed.");
        }

        if (!analysisJson.optimizedContent || !analysisJson.analysis?.optimizedScore) {
            throw new Error('The AI-generated content is missing required fields.');
        }

        const output = { ...analysisJson, originalContent: requestBody.content, targetKeywords: requestBody.targetKeywords };

        await updateToolRun(supabase, runId, 'completed', output, null);

        return new Response(JSON.stringify({ success: true, data: { runId, ...output } }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        console.error("Content Optimizer Error:", errorMessage);

        // Use a fallback if we have the content, otherwise just fail
        if (runId && requestBody?.content) {
            const fallbackOutput = generateFallbackOutput(requestBody.content, errorMessage);
            await updateToolRun(supabase, runId, 'error', fallbackOutput, errorMessage);
            return new Response(JSON.stringify({ success: true, data: fallbackOutput, runId }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        if (runId) {
             await updateToolRun(supabase, runId, 'error', null, errorMessage);
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
    return await optimizerService(req, supabase);
});
