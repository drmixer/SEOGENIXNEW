import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- CORS Headers ---
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// --- Type Definitions ---
interface PlaybookRequest {
    userId: string;
    goal: string;
    focusArea: 'overall' | 'ai_understanding' | 'citation_likelihood' | 'conversational_readiness' | 'content_structure';
}

interface PlaybookStep {
    id: string;
    title: string;
    description: string;
    rationale: string; // The new AI-generated reason for this step
    toolId: string;
}

interface AIParsedPlaybook {
    playbookTitle: string;
    playbookDescription: string;
    steps: PlaybookStep[];
}

// --- AI Prompt Engineering ---
const getPlaybookPrompt = (request: PlaybookRequest, userData: any): string => {
    const { goal, focusArea } = request;
    const { profile, auditHistory, userActivity } = userData;

    const jsonSchema = `
    {
      "playbookTitle": "string (A compelling, personalized title for the playbook)",
      "playbookDescription": "string (A 1-2 sentence summary of what this playbook will help the user achieve)",
      "steps": [
        {
          "id": "string (A unique ID for the step, e.g., 'step_1_audit')",
          "title": "string (A short, action-oriented title for the step)",
          "description": "string (A brief description of what the user will do in this step)",
          "rationale": "string (A personalized explanation for WHY this step is important for this specific user, referencing their data)",
          "toolId": "string (The ID of the SEOGENIX tool to use for this step, e.g., 'audit', 'optimizer', 'entities')"
        }
      ]
    }
    `;

    return `
    You are an Expert SEO Strategist and AI Coach for the SEOGENIX platform. Your task is to create a personalized, step-by-step optimization playbook for a user based on their goals and performance data.

    **User & Performance Data:**
    - **User's Primary Goal:** ${goal}
    - **Chosen Focus Area:** ${focusArea}
    - **User Profile & Settings:** ${JSON.stringify(profile, null, 2)}
    - **Recent Audit History (last 5):** ${JSON.stringify(auditHistory, null, 2)}
    - **Recent User Activity (last 50 actions):** ${JSON.stringify(userActivity, null, 2)}

    **Your Instructions:**
    1.  Analyze all the provided data to understand the user's current situation, weaknesses, and goals.
    2.  Generate a concise, prioritized, and actionable playbook with 3-5 steps.
    3.  **For each step, you MUST provide a personalized 'rationale'.** This is the most important part. The rationale should explain to the user *why* this step is being recommended *for them*, referencing their specific data. For example: "Your 'Citation Likelihood' score is 58, which is why we're starting with content generation to create more citable assets." or "Since you haven't used the 'entities' tool yet, running it first will provide crucial data for content optimization."
    4.  The recommended toolId for each step must be one of the valid SEOGENIX tools.

    **Output Format:**
    You MUST provide a response in a single, valid JSON object. Do not include any text or formatting outside of the JSON object. The JSON object must strictly adhere to the following schema:
    \`\`\`json
    ${jsonSchema}
    \`\`\`

    Now, create the expert, data-driven playbook for this user.
    `;
};

// --- Main Service Handler ---
export const playbookGeneratorService = async (req: Request, supabase: SupabaseClient): Promise<Response> => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { userId, goal, focusArea }: PlaybookRequest = await req.json();

        if (!userId || !goal || !focusArea) {
            throw new Error('`userId`, `goal`, and `focusArea` are required.');
        }

        // 1. Fetch all necessary user data in parallel
        const [profileRes, auditHistoryRes, userActivityRes] = await Promise.all([
            supabase.from('user_profiles').select('*').eq('user_id', userId).single(),
            supabase.from('audit_history').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(5),
            supabase.from('user_activity').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50)
        ]);

        if (profileRes.error) throw new Error(`Failed to fetch user profile: ${profileRes.error.message}`);

        const userData = {
            profile: profileRes.data,
            auditHistory: auditHistoryRes.data || [],
            userActivity: userActivityRes.data || []
        };

        // 2. Get AI-generated playbook
        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
        if (!geminiApiKey) throw new Error('Gemini API key not configured');

        const prompt = getPlaybookPrompt({ userId, goal, focusArea }, userData);

        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    response_mime_type: "application/json",
                    temperature: 0.5,
                    maxOutputTokens: 4096,
                }
            })
        });

        if (!geminiResponse.ok) {
            throw new Error(`The AI model failed to process the request. Status: ${geminiResponse.status}`);
        }

        const geminiData = await geminiResponse.json();
        const playbookJson: AIParsedPlaybook = JSON.parse(geminiData.candidates[0].content.parts[0].text);

        return new Response(JSON.stringify({ success: true, data: playbookJson }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        const errorCode = err instanceof Error ? err.name : 'UNKNOWN_ERROR';
        return new Response(JSON.stringify({ success: false, error: { message: errorMessage, code: errorCode } }), {
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
