import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logToolRun, updateToolRun } from 'shared/logging.ts';

// --- CORS Headers ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// --- Type Definitions ---
interface AnomalyRequest {
    projectId: string;
    userId: string;
    timeframeDays?: number;
}

// --- AI Prompt Engineering ---
const getAnomalyDetectionPrompt = (data: any): string => {
    const jsonSchema = `{
        "anomalies": [{
            "type": "string (e.g., 'sudden_score_drop', 'ranking_decay', 'stagnant_content')",
            "title": "string (A concise title for the anomaly)",
            "description": "string (A detailed, data-supported description of what was detected)",
            "severity": "string ('low' | 'medium' | 'high')",
            "hypothesis": "string (A likely reason for this anomaly based on the data)",
            "recommendedAction": {
                "step": "string (A clear, actionable next step for the user)",
                "tool": "string (The suggested tool to use: 'ai-visibility-audit', 'content-optimizer', etc.)",
                "defaultInput": "string (A sensible default input for the tool, e.g., a URL)"
            }
        }]
    }`;

    return `You are an expert Data Scientist specializing in SEO analytics. Your task is to analyze a time-series dataset of a user's website performance and identify any significant anomalies.

    **User Data Snapshot (Time-series data):**
    ${JSON.stringify(data, null, 2)}

    **Analysis Instructions:**
    1.  **Identify Anomalies:** Look for statistically significant deviations from trends, such as:
        -   Sudden drops in the overall 'ai_visibility_score'.
        -   Consistent decay in a specific sub-score (e.g., 'citation_likelihood').
        -   Stagnation or lack of improvement despite tool usage.
        -   Correlation between a content change and a performance drop.
    2.  **Formulate a Hypothesis:** For each anomaly, provide a plausible hypothesis explaining *why* it might have occurred, using the provided data.
    3.  **Recommend Action:** Suggest a single, clear, and actionable next step for the user. This must include a recommended tool and a default input for that tool.
    4.  **Assess Severity:** Assign a severity level (low, medium, high) to each anomaly.
    5.  If no significant anomalies are found, return an empty "anomalies" array.

    **CRITICAL: You MUST provide your response in a single, valid JSON object enclosed in a \`\`\`json markdown block.**
    The JSON object must follow this exact schema:
    \`\`\`json
    ${jsonSchema}
    \`\`\`
    Perform your analysis now.`;
};

// --- Fallback Generator ---
function generateFallbackOutput(message: string): any {
    return {
        anomalies: [],
        note: `Anomaly detection could not be run: ${message}`
    };
}

// --- Main Service Handler ---
const anomalyDetectionService = async (req: Request, supabase: SupabaseClient): Promise<Response> => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    let runId: string | null = null;
    let requestBody: AnomalyRequest;

    try {
        requestBody = await req.json();
        const { projectId, userId, timeframeDays = 30 } = requestBody;

        if (!projectId || !userId) {
            throw new Error('`projectId` and `userId` are required.');
        }

        runId = await logToolRun(supabase, projectId, 'anomaly-detection', { userId, timeframeDays });

        // Fetch historical data for the user
        const fromDate = new Date(Date.now() - timeframeDays * 24 * 60 * 60 * 1000).toISOString();
        const { data: toolRuns, error } = await supabase
            .from('tool_runs')
            .select('tool_name, created_at, status, output_payload, input_payload')
            .eq('project_id', projectId)
            .gte('created_at', fromDate)
            .order('created_at', { ascending: true });

        if (error) throw new Error(`Failed to fetch tool run history: ${error.message}`);
        if (!toolRuns || toolRuns.length < 5) {
            // Not enough data for meaningful analysis
            const output = { anomalies: [], note: "Not enough data for anomaly detection. Use the tools more to enable this feature." };
            await updateToolRun(supabase, runId, 'completed', output, null);
            return new Response(JSON.stringify({ success: true, data: output, runId }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // Basic data processing for the AI
        const processedData = toolRuns
            .filter(run => run.tool_name === 'ai-visibility-audit' && run.status === 'completed' && run.output_payload?.overallScore)
            .map(run => ({
                date: run.created_at,
                ai_visibility_score: run.output_payload.overallScore,
                subscores: run.output_payload.subscores,
                url_audited: run.input_payload.url,
            }));

        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
        if (!geminiApiKey) throw new Error('GEMINI_API_KEY is not configured.');

        const prompt = getAnomalyDetectionPrompt({ history: processedData });

        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.3, maxOutputTokens: 4096 }
            })
        });

        if (!geminiResponse.ok) {
            throw new Error(`Gemini API request failed with status ${geminiResponse.status}`);
        }

        const geminiData = await geminiResponse.json();
        const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!responseText) throw new Error("No response text from Gemini.");

        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
        if (!jsonMatch || !jsonMatch[1]) throw new Error("Could not extract JSON from AI response.");

        const output = JSON.parse(jsonMatch[1]);

        await updateToolRun(supabase, runId, 'completed', output, null);

        return new Response(JSON.stringify({ success: true, data: output, runId }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        console.error("Anomaly Detection Error:", errorMessage);

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

Deno.serve(async (req: Request) => {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    return await anomalyDetectionService(req, supabase);
});
