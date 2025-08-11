import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- CORS Headers ---
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// --- Type Definitions ---
interface AnalysisRequest {
    content: string;
    keywords: string[];
    projectId: string;
}

interface Suggestion {
    type: 'grammar' | 'clarity' | 'seo' | 'tone';
    severity: 'critical' | 'warning' | 'suggestion';
    message: string;
    suggestion: string;
    position: {
        start: number;
        end: number;
    };
}

interface AnalysisResponse {
    aiReadabilityScore: number;
    keywordDensity: { [key: string]: number };
    suggestions: Suggestion[];
}

// --- Database Logging Helpers ---
async function logToolRun({ supabase, projectId, toolName, inputPayload }) {
  const { data, error } = await supabase.from('tool_runs').insert({ project_id: projectId, tool_name: toolName, input_payload: inputPayload, status: 'running' }).select('id').single();
  if (error) { console.error('Error logging tool run:', error); return null; }
  return data.id;
}

async function updateToolRun({ supabase, runId, status, outputPayload, errorMessage }) {
  const update = {
    status,
    completed_at: new Date().toISOString(),
    output: errorMessage ? { error: errorMessage } : outputPayload || null
  };
  const { error } = await supabase.from('tool_runs').update(update).eq('id', runId);
  if (error) { console.error('Error updating tool run:', error); }
}

// --- AI Prompt Engineering ---
const getAnalysisPrompt = (content: string, keywords: string[]): string => {
    const jsonSchema = `
    {
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
    }
    `;

    return `
    You are a Real-time AI Writing Assistant. Your task is to analyze a piece of text as it's being written and provide immediate, actionable feedback.

    **Analysis Task:**
    - **Content to Analyze:**
      ---
      ${content}
      ---
    - **Target Keywords:** ${keywords.join(', ')}

    **Your Instructions:**
    Analyze the content and provide a readability score, keyword density analysis, and a list of specific suggestions for improvement.

    **Output Format:**
    You MUST provide a response in a single, valid JSON object. Do not include any text or formatting outside of the JSON object. The JSON object must strictly adhere to the following schema:
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

    let runId;
    try {
        const { content, keywords, projectId }: AnalysisRequest = await req.json();

        runId = await logToolRun({ supabase, projectId, toolName: 'real-time-content-analysis', inputPayload: { keywords } });

        if (typeof content !== 'string') {
            throw new Error('`content` must be a string.');
        }

        // Handle cases with very short content without calling the AI
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

        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    response_mime_type: "application/json",
                    temperature: 0.3,
                    maxOutputTokens: 1024,
                }
            })
        });

        if (!geminiResponse.ok) {
            throw new Error(`The AI model failed to process the request. Status: ${geminiResponse.status}`);
        }

        const geminiData = await geminiResponse.json();
        const analysisJson: AnalysisResponse = JSON.parse(geminiData.candidates[0].content.parts[0].text);

        await updateToolRun({ supabase, runId, status: 'completed', outputPayload: analysisJson, errorMessage: null });

        return new Response(JSON.stringify({ success: true, data: analysisJson }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        if (runId) {
            await updateToolRun({ supabase, runId, status: 'error', outputPayload: null, errorMessage });
        }
        const errorCode = err instanceof Error ? err.name : 'UNKNOWN_ERROR';
        return new Response(JSON.stringify({ success: false, error: { message: errorMessage, code: errorCode } }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
};

// --- Server ---
Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }
    const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    return await analysisService(req, supabase);
});
