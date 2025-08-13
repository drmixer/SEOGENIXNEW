import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logToolRun, updateToolRun } from "../_shared/logging.ts";

// --- CORS Headers ---
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- Type Definitions ---
interface PlaybookRequest {
    userId: string;
    goal: 'increase-traffic' | 'improve-rankings' | 'boost-engagement';
    focusArea: 'on-page-seo' | 'content-quality' | 'technical-seo' | 'citations';
    projectId: string;
}

// --- Database Helpers ---
async function getUserData(supabase: SupabaseClient, userId: string) {
    const { data: profile } = await supabase.from('user_profiles').select('business_description, website_url, target_audience').eq('user_id', userId).single();
    const { data: auditHistory } = await supabase.from('audit_history').select('score, created_at, recommendations').eq('user_id', userId).order('created_at', { ascending: false }).limit(5);
    const { data: activity } = await supabase.from('user_activity').select('activity_type, activity_data, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(10);
    return { profile, auditHistory, activity };
}

// --- AI Prompt Engineering ---
const getPlaybookPrompt = (request: PlaybookRequest, userData: any): string => {
    const { goal, focusArea } = request;
    const jsonSchema = `{ "playbookTitle": "string", "executiveSummary": "string", "steps": [{ "stepNumber": "number", "title": "string", "description": "string", "rationale": "string", "action_type": "string" }] }`;
    return `
    You are an Expert SEO Strategist and AI Coach. Your task is to generate a personalized SEO playbook based on the user's goal and historical data.

    **User Goal:** ${goal}
    **User Focus Area:** ${focusArea}
    **User Data:**
    ${JSON.stringify(userData, null, 2)}

    **Instructions:**
    - Analyze the provided user data to create a highly relevant and personalized playbook.
    - The playbook should contain 5-7 actionable steps.
    - Each step must be clear, concise, and have a strong rationale.

    **CRITICAL: You MUST provide your response in a single, valid JSON object enclosed in a \`\`\`json markdown block.**
    The JSON object must follow this exact schema:
    \`\`\`json
    ${jsonSchema}
    \`\`\`
    Now, create the personalized playbook.
    `;
};

// --- Main Service Handler ---
export const playbookGeneratorService = async (req: Request, supabase: SupabaseClient): Promise<Response> => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    let runId: string | null = null;
    try {
        const requestBody: PlaybookRequest = await req.json();
        const { projectId, userId, goal, focusArea } = requestBody;

        runId = await logToolRun(supabase, projectId, 'adaptive-playbook-generator', { userId, goal, focusArea });

        const userData = await getUserData(supabase, userId);
        if (!userData.profile) throw new Error("User profile not found.");

        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
        if (!geminiApiKey) throw new Error('Gemini API key not configured');

        const prompt = getPlaybookPrompt(requestBody, userData);
        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.5, maxOutputTokens: 4096 }
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
        const playbookJson = JSON.parse(jsonMatch[1]);

        if (runId) {
            await updateToolRun(supabase, runId, 'completed', playbookJson, null);
        }

        return new Response(JSON.stringify({ success: true, data: playbookJson }), {
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
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    return await playbookGeneratorService(req, supabase);
});
