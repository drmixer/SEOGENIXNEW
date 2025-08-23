import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logToolRun, updateToolRun } from '../_shared/logging.ts';

// --- CORS Headers ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// --- Type Definitions ---
interface VoiceTestRequest {
    projectId: string;
    query: string;
    assistants: ('siri' | 'alexa' | 'google')[];
    brandName: string; // To help AI identify mentions
}

// --- AI Prompt Engineering ---
const getVoiceAssistantPrompt = (request: VoiceTestRequest): string => {
  const { query, assistants, brandName } = request;
  const assistantProfiles = {
    siri: 'Siri is helpful, conversational, and provides concise but informative responses. She tends to pull from reliable web sources.',
    alexa: 'Alexa is friendly, direct, and often references "according to my sources" or similar phrases. Responses are usually brief.',
    google: 'Google Assistant is knowledgeable, detailed, and often provides structured information with context from search results.'
  };

  const jsonSchema = `{
    "results": [
      {
        "assistant": "string (The name of the assistant, e.g., 'siri')",
        "response": "string (The realistic, simulated response this voice assistant would give)",
        "mentionedBrand": "boolean (Does the response likely mention the user's brand '${brandName}'?)",
        "rationale": "string (A brief explanation for the simulated response and brand mention assessment)"
      }
    ]
  }`;

  return `You are a Voice Search Simulator. Your task is to generate realistic responses for multiple voice assistants for the same user query.

  **Simulation Task:**
  - **User Query:** "${query}"
  - **Brand to Track:** "${brandName}"
  - **Assistants to Simulate:** ${assistants.join(', ')}

  **Assistant Profiles:**
  ${assistants.map(a => `- **${a.toUpperCase()}**: ${assistantProfiles[a]}`).join('\n')}

  **Instructions:**
  1.  For each assistant, generate a realistic response to the user's query, adhering to that assistant's known personality and response style.
  2.  For each response, determine if it would likely mention the specified brand ('${brandName}').
  3.  Provide a brief 'rationale' for each simulated response, explaining your thinking.

  **CRITICAL: You MUST provide your response in a single, valid JSON object enclosed in a \`\`\`json markdown block.**
  The JSON object must contain a "results" array, with one object per simulated assistant, and must strictly adhere to this schema:
  \`\`\`json
  ${jsonSchema}
  \`\`\`

  Generate the voice assistant responses now.`;
};

// --- Fallback Generator ---
function generateFallbackOutput(request: VoiceTestRequest, message: string): any {
    return {
        query: request.query,
        results: request.assistants.map(assistant => ({
            assistant,
            response: `Could not simulate response: ${message}`,
            mentionedBrand: false,
            rationale: "This is a fallback response due to an error."
        })),
        summary: { totalMentions: 0, testedAssistants: request.assistants.length },
        note: `Voice assistant test failed: ${message}`
    };
}

// --- Main Service Handler ---
const voiceAssistantTesterService = async (req: Request, supabase: SupabaseClient): Promise<Response> => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    let runId: string | null = null;
    let requestBody: VoiceTestRequest;
    try {
        requestBody = await req.json();
        const { projectId, query, assistants, brandName } = requestBody;

        if (!projectId || !query || !assistants?.length || !brandName) {
            throw new Error('`projectId`, `query`, `assistants` array, and `brandName` are required.');
        }

        runId = await logToolRun(supabase, projectId, 'voice-assistant-tester', { query, assistants, brandName });

        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
        if (!geminiApiKey) throw new Error('GEMINI_API_KEY is not configured.');
        
        const prompt = getVoiceAssistantPrompt(requestBody);

        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.7, maxOutputTokens: 4096 }
            })
        });

        if (!geminiResponse.ok) throw new Error(`Gemini API failed: ${await geminiResponse.text()}`);

        const geminiData = await geminiResponse.json();
        const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!responseText) throw new Error("No response text from Gemini.");

        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
        if (!jsonMatch || !jsonMatch[1]) throw new Error('Could not extract JSON from AI response.');

        const analysis = JSON.parse(jsonMatch[1]);
        if (!analysis.results) throw new Error('Generated analysis is missing required `results` field.');

        const totalMentions = analysis.results.filter((r: any) => r.mentionedBrand).length;
        const summary = {
            totalMentions,
            testedAssistants: assistants.length
        };

        const output = { query, results: analysis.results, summary, generatedAt: new Date().toISOString() };
        await updateToolRun(supabase, runId, 'completed', output, null);

        return new Response(JSON.stringify({ success: true, data: output, runId }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        console.error("Voice Assistant Tester Error:", errorMessage);
        
        if (runId) {
            const fallbackOutput = generateFallbackOutput(requestBody, errorMessage);
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
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    return await voiceAssistantTesterService(req, supabase);
});
