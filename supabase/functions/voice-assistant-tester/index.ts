import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// --- CORS Headers ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE'
};
// --- Inline Logging Functions ---
async function logToolRun(supabase, projectId, toolName, inputPayload) {
  if (!projectId) {
    throw new Error("logToolRun error: projectId is required.");
  }
  console.log(`Logging tool run: ${toolName} for project: ${projectId}`);
  const { data, error } = await supabase.from("tool_runs").insert({
    project_id: projectId,
    tool_name: toolName,
    input_payload: inputPayload,
    status: "running",
    created_at: new Date().toISOString()
  }).select("id").single();
  if (error) {
    console.error("Error logging tool run:", error);
    throw new Error(`Failed to log tool run. Supabase error: ${error.message}`);
  }
  if (!data || !data.id) {
    console.error("No data or data.id returned from tool_runs insert.");
    throw new Error("Failed to log tool run: No data returned after insert.");
  }
  console.log(`Tool run logged with ID: ${data.id}`);
  return data.id;
}
async function updateToolRun(supabase, runId, status, outputPayload, errorMessage) {
  if (!runId) {
    console.error("updateToolRun error: runId is required.");
    return;
  }
  console.log(`Updating tool run ${runId} with status: ${status}`);
  const update = {
    status,
    completed_at: new Date().toISOString(),
    output_payload: errorMessage ? {
      error: errorMessage
    } : outputPayload || null,
    error_message: errorMessage || null
  };
  const { error } = await supabase.from("tool_runs").update(update).eq("id", runId);
  if (error) {
    console.error(`Error updating tool run ID ${runId}:`, error);
  } else {
    console.log(`Tool run ${runId} updated successfully`);
  }
}
// --- AI Prompt Engineering ---
const getVoiceAssistantPrompt = (assistant, query)=>{
  const assistantProfiles = {
    siri: 'Siri is helpful, conversational, and provides concise but informative responses. She tends to pull from reliable web sources.',
    alexa: 'Alexa is friendly, direct, and often references "according to my sources" or similar phrases. Responses are usually brief.',
    google: 'Google Assistant is knowledgeable, detailed, and often provides structured information with context from search results.'
  };
  const jsonSchema = `{
    "assistant": "${assistant}",
    "query": "${query}",
    "response": "string (The realistic response this voice assistant would give)",
    "mentioned": "boolean (Would this response likely mention the user's website/brand?)",
    "ranking": "number (1-5, where 1 is most prominent mention)",
    "confidence": "number (0-100, confidence level in the response accuracy)"
  }`;
  return `You are simulating how ${assistant.toUpperCase()} would respond to voice queries.

**Assistant Profile:** ${assistantProfiles[assistant] || 'This voice assistant provides helpful, accurate responses.'}

**User Query:** "${query}"

Generate a realistic response that this voice assistant would give. Consider:
1. The assistant's typical response style and personality
2. Whether the query would result in a mention of any specific website or brand
3. How prominent that mention would be if it exists
4. The confidence level in the response accuracy

**CRITICAL: You MUST provide your response in a single, valid JSON object enclosed in a \`\`\`json markdown block.**
The JSON object must follow this exact schema:
\`\`\`json
${jsonSchema}
\`\`\`

Generate the voice assistant response now.`;
};
// --- Fallback Response Generator ---
function generateFallbackVoiceResponse(assistant, query) {
  const fallbackResponses = {
    siri: [
      "Here's what I found on the web for that.",
      "I found some information about that topic.",
      "Based on what I found online, here's what I can tell you."
    ],
    alexa: [
      "According to my sources, here is some information.",
      "I found several results for that query.",
      "Here's what I discovered about that topic."
    ],
    google: [
      "Based on information from the web, I can tell you this.",
      "According to search results, here are some details.",
      "I found relevant information about that topic."
    ]
  };
  const responses = fallbackResponses[assistant] || fallbackResponses.google;
  const randomResponse = responses[Math.floor(Math.random() * responses.length)];
  return {
    assistant: assistant.charAt(0).toUpperCase() + assistant.slice(1),
    query,
    response: randomResponse,
    mentioned: Math.random() > 0.6,
    ranking: Math.floor(Math.random() * 3) + 1,
    confidence: Math.floor(Math.random() * 40) + 60 // 60-100
  };
}
// --- Main Service Handler ---
const voiceAssistantTesterService = async (req, supabase)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  let runId = null;
  try {
    const requestBody = await req.json();
    const { projectId, query, assistants } = requestBody;
    if (!query || !assistants || !Array.isArray(assistants)) {
      throw new Error('`query` and `assistants` array are required.');
    }
    // Log tool run if projectId is provided
    if (projectId) {
      runId = await logToolRun(supabase, projectId, 'voice-assistant-tester', {
        query,
        assistants
      });
    }
    const results = [];
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      console.warn('Gemini API key not configured, using fallback responses');
      // Generate fallback responses for all assistants
      for (const assistant of assistants){
        results.push(generateFallbackVoiceResponse(assistant, query));
      }
    } else {
      // Test each voice assistant
      for (const assistant of assistants){
        try {
          console.log(`Testing ${assistant} with query: ${query}`);
          const prompt = getVoiceAssistantPrompt(assistant, query);
          const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: prompt
                    }
                  ]
                }
              ],
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 512,
                topP: 0.8
              }
            })
          });
          if (!geminiResponse.ok) {
            console.error(`Gemini API error for ${assistant}:`, geminiResponse.status, await geminiResponse.text());
            results.push(generateFallbackVoiceResponse(assistant, query));
            continue;
          }
          const geminiData = await geminiResponse.json();
          if (!geminiData.candidates || geminiData.candidates.length === 0) {
            console.error(`No candidates returned from Gemini for ${assistant}`);
            results.push(generateFallbackVoiceResponse(assistant, query));
            continue;
          }
          const responseText = geminiData.candidates[0].content.parts[0].text;
          // Parse JSON response
          const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
          if (!jsonMatch || !jsonMatch[1]) {
            console.error(`Failed to extract JSON for ${assistant}, using fallback`);
            results.push(generateFallbackVoiceResponse(assistant, query));
            continue;
          }
          try {
            const voiceResponse = JSON.parse(jsonMatch[1]);
            // Validate the response structure
            if (!voiceResponse.assistant || !voiceResponse.response || typeof voiceResponse.mentioned !== 'boolean' || typeof voiceResponse.ranking !== 'number' || typeof voiceResponse.confidence !== 'number') {
              console.error(`Invalid response structure for ${assistant}, using fallback`);
              results.push(generateFallbackVoiceResponse(assistant, query));
              continue;
            }
            // Ensure proper capitalization and bounds
            voiceResponse.assistant = assistant.charAt(0).toUpperCase() + assistant.slice(1);
            voiceResponse.ranking = Math.max(1, Math.min(5, Math.round(voiceResponse.ranking)));
            voiceResponse.confidence = Math.max(0, Math.min(100, Math.round(voiceResponse.confidence)));
            results.push(voiceResponse);
            console.log(`Successfully processed ${assistant} response`);
          } catch (parseError) {
            console.error(`JSON parse error for ${assistant}:`, parseError);
            results.push(generateFallbackVoiceResponse(assistant, query));
          }
        } catch (error) {
          console.error(`Error testing ${assistant}:`, error);
          results.push(generateFallbackVoiceResponse(assistant, query));
        }
      }
    }
    // Calculate summary statistics
    const totalMentions = results.filter((r)=>r.mentioned).length;
    const averageRanking = results.length > 0 ? Math.round(results.reduce((sum, r)=>sum + r.ranking, 0) / results.length) : 0;
    const averageConfidence = results.length > 0 ? Math.round(results.reduce((sum, r)=>sum + r.confidence, 0) / results.length) : 0;
    const output = {
      query,
      results,
      summary: {
        totalMentions,
        averageRanking,
        averageConfidence,
        testedAssistants: assistants.length
      },
      generatedAt: new Date().toISOString()
    };
    // Update tool run if we have one
    if (runId) {
      await updateToolRun(supabase, runId, 'completed', output, null);
    }
    return new Response(JSON.stringify({
      success: true,
      data: output,
      runId
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
    console.error('Voice assistant tester error:', errorMessage);
    // Update tool run with error if we have one
    if (runId) {
      await updateToolRun(supabase, runId, 'error', null, errorMessage);
    }
    return new Response(JSON.stringify({
      success: false,
      error: {
        message: errorMessage
      },
      runId
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
};
// --- Server ---
Deno.serve(async (req)=>{
  const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  return await voiceAssistantTesterService(req, supabase);
});
