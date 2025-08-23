import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logToolRun, updateToolRun } from '../_shared/logging.ts';

// --- CORS Headers ---
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// --- Type Definitions ---
interface SuggestionRequest {
    projectId: string;
    topic: string;
    industry?: string;
    targetAudience?: string;
    userIntent?: 'informational' | 'commercial' | 'transactional' | 'navigational';
}

// --- AI Prompt Engineering ---
const getSuggestionPrompt = (request: SuggestionRequest): string => {
    const { topic, industry, targetAudience, userIntent } = request;
    const jsonSchema = `{
      "suggestions": [
        {
          "category": "string ('Top of Funnel' | 'Middle of Funnel' | 'Bottom of Funnel')",
          "prompt": "string (The suggested search prompt or content title)",
          "rationale": "string (A brief explanation of why this is a good suggestion for the specified user intent and audience)"
        }
      ]
    }`;

    return `You are an Expert SEO Strategist and Content Ideator. Your task is to brainstorm a list of 10-15 highly relevant content ideas or search prompts based on a user's topic and context.

    **Brainstorming Context:**
    - **Core Topic:** ${topic}
    - **Industry:** ${industry || 'General'}
    - **Target Audience:** ${targetAudience || 'General Audience'}
    - **Primary User Intent to Target:** ${userIntent || 'Informational'}

    **Instructions:**
    1.  Generate 10-15 diverse and creative prompt suggestions related to the core topic.
    2.  For each suggestion, determine which part of the marketing funnel it targets ('Top of Funnel', 'Middle of Funnel', 'Bottom of Funnel').
    3.  For each suggestion, provide a brief 'rationale' explaining why it's a valuable prompt for the user's context.

    **CRITICAL: You MUST provide your response in a single, valid JSON object enclosed in a \`\`\`json markdown block.**
    The JSON object must strictly adhere to the following schema:
    \`\`\`json
    ${jsonSchema}
    \`\`\`
    Now, perform your expert brainstorming.`;
};

// --- Fallback Generator ---
function generateFallbackOutput(message: string): any {
    return {
        suggestions: [],
        note: `Could not generate suggestions: ${message}`
    };
}

// --- Main Service Handler ---
const suggestionService = async (req: Request, supabase: SupabaseClient): Promise<Response> => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    let runId: string | null = null;
    let requestBody: SuggestionRequest;
    try {
        requestBody = await req.json();
        const { projectId, topic } = requestBody;

        if (!projectId || !topic?.trim()) {
            throw new Error('`projectId` and `topic` are required.');
        }

        runId = await logToolRun(supabase, projectId, 'prompt-match-suggestions', requestBody);

        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
        if (!geminiApiKey) throw new Error('GEMINI_API_KEY is not configured.');

        const prompt = getSuggestionPrompt(requestBody);
        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.8, maxOutputTokens: 4096 }
            })
        });

        if (!geminiResponse.ok) throw new Error(`Gemini API failed: ${await geminiResponse.text()}`);

        const geminiData = await geminiResponse.json();
        const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!responseText) throw new Error("No response text from Gemini.");

        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
        if (!jsonMatch || !jsonMatch[1]) throw new Error('Could not extract JSON from AI response.');

        const output = JSON.parse(jsonMatch[1]);
        if (!output.suggestions) {
            throw new Error('Generated suggestions missing required `suggestions` field.');
        }

        await updateToolRun(supabase, runId, 'completed', output, null);

        return new Response(JSON.stringify({ success: true, data: output, runId }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        console.error("Prompt Suggestion Error:", errorMessage);

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
};

// --- Server ---
Deno.serve(async (req) => {
    const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    return await suggestionService(req, supabase);
});
