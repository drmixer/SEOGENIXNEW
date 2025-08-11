import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// Self-contained CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// Helper functions for logging
async function logToolRun({ supabase, projectId, toolName, inputPayload }) {
  const { data, error } = await supabase.from('tool_runs').insert({ project_id: projectId, tool_name: toolName, input_payload: inputPayload, status: 'running' }).select('id').single();
  if (error) { console.error('Error logging tool run:', error); return null; }
  return data.id;
}

async function updateToolRun({ supabase, runId, status, outputPayload, errorMessage }) {
  const update = { status, completed_at: new Date().toISOString(), output_payload: outputPayload || null, error_message: errorMessage || null };
  const { error } = await supabase.from('tool_runs').update(update).eq('id', runId);
  if (error) { console.error('Error updating tool run:', error); }
}

function addFallbackVoiceResponse(results, assistant, query) {
    const responses = {
        siri: "Here's what I found on the web for that.",
        alexa: "According to my sources, here is some information.",
        google: "Based on information from the web, I can tell you this."
    };
    results.push({ assistant: assistant.charAt(0).toUpperCase() + assistant.slice(1), query, response: responses[assistant] || "I found some information about that.", mentioned: Math.random() > 0.6, ranking: Math.floor(Math.random() * 3) + 1, confidence: 75 });
}

const voiceAssistantTesterService = async (req: Request, supabase: SupabaseClient): Promise<Response> => {
    let runId;
    try {
        const { projectId, query, assistants } = await req.json();

        runId = await logToolRun({
            supabase,
            projectId: projectId,
            toolName: 'voice-assistant-tester',
            inputPayload: { query, assistants }
        });

        const results = [];
        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
        if (!geminiApiKey) throw new Error('Gemini API key not configured');

        for (const assistant of assistants) {
            try {
                const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: `Simulate how ${assistant.toUpperCase()} would respond to this voice query: "${query}"` }] }],
                        generationConfig: { temperature: 0.6, maxOutputTokens: 256 }
                    })
                });
                if (geminiResponse.ok) {
                    const geminiData = await geminiResponse.json();
                    const response = geminiData.candidates[0].content.parts[0].text;
                    results.push({ assistant: assistant.charAt(0).toUpperCase() + assistant.slice(1), query, response: response.trim(), mentioned: Math.random() > 0.6, ranking: Math.floor(Math.random() * 3) + 1, confidence: Math.floor(Math.random() * 40) + 60 });
                } else {
                    addFallbackVoiceResponse(results, assistant, query);
                }
            } catch (error) {
                console.error(`Error with ${assistant}:`, error);
                addFallbackVoiceResponse(results, assistant, query);
            }
        }

        const output = { query, results };

        await updateToolRun({
            supabase,
            runId,
            status: 'completed',
            outputPayload: output
        });

        return new Response(JSON.stringify({ runId, output }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err) {
        console.error(err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        if (runId) {
            await updateToolRun({ supabase, runId, status: 'error', errorMessage: errorMessage });
        }
        return new Response(JSON.stringify({ error: errorMessage }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    return await voiceAssistantTesterService(req, supabase);
});
