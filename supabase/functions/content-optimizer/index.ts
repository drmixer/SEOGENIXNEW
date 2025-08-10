import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- CORS Headers ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// --- Supabase Client ---
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// --- Type Definitions ---
interface LogToolRunParams {
  projectId: string;
  toolName: string;
  inputPayload: Record<string, unknown>;
}

interface UpdateToolRunParams {
  runId: string;
  status: 'completed' | 'error';
  outputPayload: Record<string, unknown> | null;
  errorMessage: string | null;
}

interface OptimizerRequest {
    projectId: string;
    content: string;
    targetKeywords: string[];
    contentType: 'blog post' | 'landing page' | 'product description';
}

// --- Database Helpers ---
async function logToolRun({ projectId, toolName, inputPayload }: LogToolRunParams): Promise<string | null> {
  const { data, error } = await supabase
    .from('tool_runs')
    .insert({ project_id: projectId, tool_name: toolName, input_payload: inputPayload, status: 'running' })
    .select('id')
    .single();
  if (error) {
    console.error('Error logging tool run:', error);
    return null;
  }
  return data.id;
}

async function updateToolRun({ runId, status, outputPayload, errorMessage }: UpdateToolRunParams): Promise<void> {
  const update = {
    status,
    completed_at: new Date().toISOString(),
    output_payload: outputPayload,
    error_message: errorMessage,
  };
  const { error } = await supabase.from('tool_runs').update(update).eq('id', runId);
  if (error) {
    console.error('Error updating tool run:', error);
  }
}

// --- AI Prompt Engineering ---
const getOptimizerPrompt = (content: string, targetKeywords: string[], contentType: string): string => {
    const jsonSchema = `
    {
      "optimizedContent": "string (the full, rewritten content, ready to be published)",
      "optimizedScore": "number (0-100, the SEO and AI visibility score of the new content)",
      "originalScore": "number (0-100, your estimated score of the original content)",
      "improvements": [
        "string (a specific, tangible improvement that was made)"
      ]
    }
    `;

    const fewShotExample = `
    {
      "optimizedContent": "<h1>Discover the Best Smart Home Devices of 2025</h1><p>Our comprehensive guide explores top-rated smart home gadgets, including smart speakers, lighting, and security systems, helping you build a more connected and efficient home...</p>",
      "optimizedScore": 92,
      "originalScore": 65,
      "improvements": [
        "Added a compelling H1 heading that includes the primary keyword.",
        "Integrated secondary keywords like 'smart speakers' and 'security systems' naturally into the opening paragraph.",
        "Simplified sentence structure for improved readability and voice assistant delivery.",
        "Restructured content to follow a logical, hierarchical flow with clear headings."
      ]
    }
    `;

    return `
    You are an expert SEO Content Strategist and AI Visibility Optimizer. Your task is to rewrite a piece of content to maximize its SEO performance, readability, and likelihood of being featured or cited by AI models like Google's SGE.

    **Content Details:**
    - **Content Type:** ${contentType}
    - **Primary Target Keywords:** ${targetKeywords.join(', ')}
    - **Original Content:**
      ---
      ${content.substring(0, 12000)}
      ---

    **Your Instructions:**
    1.  **Rewrite the Content:** Completely rewrite the original content. The new version must be professionally written, engaging, and seamlessly integrate the target keywords.
    2.  **Score Both Versions:** Provide an "Optimized Score" for your new version and an estimated "Original Score" for the provided content (both on a 0-100 scale).
    3.  **List Improvements:** Detail the specific, actionable improvements you made.

    **Output Format:**
    You MUST provide a response in a single, valid JSON object. Do not include any text, markdown, or formatting outside of the JSON object. The JSON object must strictly adhere to the following schema:
    \`\`\`json
    ${jsonSchema}
    \`\`\`

    **Example of Ideal Output:**
    \`\`\`json
    ${fewShotExample}
    \`\`\`

    Now, perform your expert optimization on the provided content.
    `;
}

// --- Main Service Handler ---
export const optimizerService = async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    let runId: string | null = null;
    try {
        const { projectId, content, targetKeywords, contentType }: OptimizerRequest = await req.json();

        runId = await logToolRun({
            projectId,
            toolName: 'content-optimizer',
            inputPayload: { contentType, targetKeywords, contentLength: content.length }
        });

        if (!content || !targetKeywords || !contentType) {
            throw new Error('`content`, `targetKeywords`, and `contentType` are required.');
        }

        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
        if (!geminiApiKey) throw new Error('Gemini API key not configured');

        const prompt = getOptimizerPrompt(content, targetKeywords, contentType);

        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    response_mime_type: "application/json",
                    temperature: 0.5, // Slightly more creative for content rewriting
                    topK: 40,
                    topP: 0.9,
                    maxOutputTokens: 4096,
                }
            })
        });

        if (!geminiResponse.ok) {
            const errorBody = await geminiResponse.text();
            console.error('Gemini API error:', errorBody);
            throw new Error(`The AI model failed to process the request. Status: ${geminiResponse.status}`);
        }

        const geminiData = await geminiResponse.json();
        const analysisJson = JSON.parse(geminiData.candidates[0].content.parts[0].text);

        const output = {
            ...analysisJson,
            originalContent: content, // Include original content for comparison
            targetKeywords,
        };

        if (runId) {
            await updateToolRun({
                runId,
                status: 'completed',
                outputPayload: output,
                errorMessage: null,
            });
        }

        return new Response(JSON.stringify({ success: true, data: { runId, ...output } }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        const errorCode = err instanceof Error ? err.name : 'UNKNOWN_ERROR';

        if (runId) {
            await updateToolRun({
                runId,
                status: 'error',
                outputPayload: null,
                errorMessage: errorMessage,
            });
        }

        return new Response(JSON.stringify({ success: false, error: { message: errorMessage, code: errorCode } }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
};

// --- Server ---
Deno.serve(optimizerService);
