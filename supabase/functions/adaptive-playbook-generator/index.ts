import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logToolRun, updateToolRun } from "shared/logging.ts";

// --- CORS Headers ---
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// --- Type Definitions ---
interface PlaybookRequest {
    projectId: string;
    userId: string;
    goal: 'increase-traffic' | 'improve-rankings' | 'boost-engagement' | 'enhance-ai-visibility';
    focusArea: 'on-page-seo' | 'content-strategy' | 'technical-seo' | 'local-seo' | 'all';
    // Optional: Provide more context for better personalization
    recentAuditId?: string;
    competitorUrls?: string[];
}

// --- Database Helpers ---
async function getUserData(supabase: SupabaseClient, request: PlaybookRequest) {
    const { userId, recentAuditId } = request;

    const { data: profile } = await supabase.from('user_profiles').select('business_description, website_url, target_audience').eq('user_id', userId).single();

    let recentAudit = null;
    if (recentAuditId) {
        const { data } = await supabase.from('tool_runs').select('output_payload').eq('id', recentAuditId).single();
        recentAudit = data?.output_payload;
    }

    // Combine all available data into a context object
    return {
        profile,
        recentAudit,
        competitors: request.competitorUrls,
    };
}

// --- AI Prompt Engineering ---
const getPlaybookPrompt = (request: PlaybookRequest, userData: any): string => {
    const { goal, focusArea } = request;
    const jsonSchema = `{
        "playbookTitle": "string (A compelling title for this custom playbook)",
        "executiveSummary": "string (A 2-3 sentence summary of the strategy)",
        "steps": [{
            "stepNumber": "number",
            "title": "string (A short, action-oriented title for the step, e.g., 'Optimize Your Homepage Content')",
            "description": "string (Detailed description of what the user needs to do)",
            "rationale": "string (Why this step is important for their specific goal)",
            "action": {
                "tool": "string (The suggested tool from the list: 'content-optimizer', 'competitor-discovery', 'ai-visibility-audit', 'schema-generator')",
                "defaultInput": "string (A sensible default input for the tool, e.g., a URL or keyword)"
            }
        }]
    }`;

    return `
    You are an Expert SEO Strategist and AI Coach. Your task is to generate a personalized, actionable SEO playbook based on a user's goal and their available data.

    **User Profile & Goal:**
    - **Primary Goal:** ${goal}
    - **Area of Focus:** ${focusArea}
    - **User Data Snapshot:**
    ${JSON.stringify(userData, null, 2)}

    **Instructions:**
    1.  **Deeply Analyze Data:** Synthesize insights from the user's profile, recent audit data, and competitor list to inform your strategy.
    2.  **Create 5-7 Actionable Steps:** Generate a sequence of clear, manageable steps.
    3.  **Provide Strong Rationale:** For each step, explain *why* it's important and how it contributes to the user's main goal.
    4.  **Suggest a Tool for Each Step:** This is critical. For each step, recommend a specific tool from the allowed list ('content-optimizer', 'competitor-discovery', 'ai-visibility-audit', 'schema-generator') that helps the user complete the step.
    5.  **Provide a Default Input:** For the suggested tool, provide a smart, context-aware default input. For example, if the step is to optimize the homepage, the default input for 'content-optimizer' should be the user's homepage URL.

    **CRITICAL: You MUST provide your response in a single, valid JSON object enclosed in a \`\`\`json markdown block.**
    The JSON object must follow this exact schema:
    \`\`\`json
    ${jsonSchema}
    \`\`\`
    Now, create the personalized, tool-integrated playbook.
    `;
};

// --- Fallback Generator ---
function generateFallbackPlaybook(request: PlaybookRequest): any {
    console.warn("Generating fallback playbook due to an AI failure.");
    return {
        playbookTitle: `Generic Playbook for: ${request.goal}`,
        executiveSummary: "This is a generic playbook. For a personalized strategy, please try again later.",
        steps: [
            { stepNumber: 1, title: "Run a Visibility Audit", description: "Start with a full AI Visibility Audit to get a baseline score and identify key issues.", rationale: "A baseline is essential for measuring progress.", action: { tool: "ai-visibility-audit", defaultInput: "Your homepage URL" } },
            { stepNumber: 2, title: "Analyze Top Competitors", description: "Use the Competitor Discovery tool to understand what your successful competitors are doing.", rationale: "Understanding the competitive landscape helps you find opportunities.", action: { tool: "competitor-discovery", defaultInput: "Your main industry or topic" } }
        ],
        note: "AI analysis failed, providing a generic playbook as a fallback."
    };
}

// --- Main Service Handler ---
const playbookGeneratorService = async (req: Request, supabase: SupabaseClient): Promise<Response> => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    let runId: string | null = null;
    let requestBody: PlaybookRequest;
    try {
        requestBody = await req.json();
        const { projectId, userId, goal, focusArea } = requestBody;

        if (!projectId || !userId || !goal || !focusArea) {
            throw new Error("`projectId`, `userId`, `goal`, and `focusArea` are required.");
        }

        runId = await logToolRun(supabase, projectId, 'adaptive-playbook-generator', requestBody);

        const userData = await getUserData(supabase, requestBody);
        if (!userData.profile) {
            // Still possible to generate a generic playbook without a profile
            console.warn(`User profile not found for userId: ${userId}. Playbook will be less personalized.`);
        }

        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
        if (!geminiApiKey) throw new Error('GEMINI_API_KEY is not configured.');

        const prompt = getPlaybookPrompt(requestBody, userData);
        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.5, maxOutputTokens: 8192 }
            })
        });

        if (!geminiResponse.ok) {
            const errorBody = await geminiResponse.text();
            throw new Error(`The AI model failed to process the request. Status: ${geminiResponse.status}. Body: ${errorBody}`);
        }

        const geminiData = await geminiResponse.json();
        const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!responseText) {
            throw new Error("No response text from Gemini.");
        }

        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
        if (!jsonMatch || !jsonMatch[1]) {
            throw new Error('Failed to extract JSON from AI response.');
        }
        const playbookJson = JSON.parse(jsonMatch[1]);

        await updateToolRun(supabase, runId, 'completed', playbookJson, null);

        return new Response(JSON.stringify({ success: true, data: playbookJson, runId }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        console.error("Playbook Generator Error:", errorMessage);

        if (runId) {
            const fallbackOutput = generateFallbackPlaybook(requestBody);
            await updateToolRun(supabase, runId, 'error', fallbackOutput, errorMessage);
            return new Response(JSON.stringify({ success: true, data: fallbackOutput, runId }), {
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
    return await playbookGeneratorService(req, supabase);
});
