import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

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

async function logToolRun({ supabase, projectId, toolName, inputPayload }: { supabase: SupabaseClient, projectId: string, toolName: string, inputPayload: any }) {
    const { data, error } = await supabase.from('tool_runs').insert({ project_id: projectId, tool_name: toolName, input_payload: inputPayload, status: 'running' }).select('id').single();
    if (error) { console.error('Error logging tool run:', error); return null; }
    return data.id;
}

async function updateToolRun({ supabase, runId, status, outputPayload, errorMessage }: { supabase: SupabaseClient, runId: string, status: string, outputPayload: any, errorMessage: string | null }) {
    const update = { status, completed_at: new Date().toISOString(), output_payload: outputPayload || null, error_message: errorMessage || null };
    const { error } = await supabase.from('tool_runs').update(update).eq('id', runId);
    if (error) { console.error('Error updating tool run:', error); }
}

// --- AI Prompt Engineering ---
const getPlaybookPrompt = (request: PlaybookRequest, userData: any): string => {
    const { goal, focusArea } = request;
    const jsonSchema = `{ "playbookTitle": "string", "executiveSummary": "string", "steps": [{ "stepNumber": "number", "title": "string", "description": "string", "rationale": "string", "action_type": "string" }] }`;
    return `
    You are an Expert SEO Strategist and AI Coach...
    **User Goal:** ${goal}
    **User Focus Area:** ${focusArea}
    **User Data:**
    ${JSON.stringify(userData, null, 2)}
    ...
    You MUST provide a response in a single, valid JSON object...
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

        runId = await logToolRun({ supabase, projectId, toolName: 'adaptive-playbook-generator', inputPayload: { userId, goal, focusArea } });

        const userData = await getUserData(supabase, userId);
        if (!userData.profile) throw new Error("User profile not found.");

        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
        if (!geminiApiKey) throw new Error('Gemini API key not configured');

        const prompt = getPlaybookPrompt(requestBody, userData);
        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { response_mime_type: "application/json", temperature: 0.5, maxOutputTokens: 4096 }
            })
        });

        if (!geminiResponse.ok) throw new Error(`The AI model failed to process the request. Status: ${geminiResponse.status}`);

        const geminiData = await geminiResponse.json();
        const playbookJson = JSON.parse(geminiData.candidates[0].content.parts[0].text);

        if (runId) {
            await updateToolRun({ supabase, runId, status: 'completed', outputPayload: playbookJson, errorMessage: null });
        }

        return new Response(JSON.stringify({ success: true, data: playbookJson }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        if (runId) {
            await updateToolRun({ supabase, runId, status: 'error', outputPayload: null, errorMessage });
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
