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
// --- Database Helpers ---
async function getUserData(supabase, userId) {
  const { data: profile } = await supabase.from('user_profiles').select('business_description, website_url, target_audience').eq('user_id', userId).single();
  const { data: auditHistory } = await supabase.from('audit_history').select('score, created_at, recommendations').eq('user_id', userId).order('created_at', {
    ascending: false
  }).limit(5);
  const { data: activity } = await supabase.from('user_activity').select('activity_type, activity_data, created_at').eq('user_id', userId).order('created_at', {
    ascending: false
  }).limit(10);
  return {
    profile,
    auditHistory,
    activity
  };
}
// --- AI Prompt Engineering ---
const getPlaybookPrompt = (request, userData)=>{
  const { goal, focusArea } = request;
  const jsonSchema = `{
        "playbookTitle": "string",
        "executiveSummary": "string",
        "steps": [
            {
                "stepNumber": "number",
                "title": "string",
                "description": "string",
                "rationale": "string",
                "action_type": "string"
            }
        ]
    }`;
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
export const playbookGeneratorService = async (req, supabase)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  let runId = null;
  try {
    const requestBody = await req.json();
    const { projectId, userId, goal, focusArea } = requestBody;
    if (!projectId || !userId || !goal || !focusArea) {
      throw new Error('`projectId`, `userId`, `goal`, and `focusArea` are required.');
    }
    runId = await logToolRun(supabase, projectId, 'adaptive-playbook-generator', {
      userId,
      goal,
      focusArea
    });
    const userData = await getUserData(supabase, userId);
    if (!userData.profile) {
      throw new Error("User profile not found.");
    }
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('Gemini API key not configured');
    }
    const prompt = getPlaybookPrompt(requestBody, userData);
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`, {
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
          temperature: 0.5,
          maxOutputTokens: 4096,
          topP: 0.8,
          topK: 40
        }
      })
    });
    if (!geminiResponse.ok) {
      const errorBody = await geminiResponse.text();
      throw new Error(`The AI model failed to process the request. Status: ${geminiResponse.status}. Body: ${errorBody}`);
    }
    const geminiData = await geminiResponse.json();
    if (!geminiData.candidates || geminiData.candidates.length === 0) {
      throw new Error('No content generated by Gemini API');
    }
    const responseText = geminiData.candidates[0].content.parts[0].text;
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
    if (!jsonMatch || !jsonMatch[1]) {
      throw new Error('Failed to extract JSON from AI response.');
    }
    const playbookJson = JSON.parse(jsonMatch[1]);
    // Validate response structure
    if (!playbookJson.playbookTitle || !playbookJson.steps) {
      throw new Error('Generated playbook missing required fields');
    }
    // Add metadata
    playbookJson.generatedAt = new Date().toISOString();
    playbookJson.userId = userId;
    playbookJson.goal = goal;
    playbookJson.focusArea = focusArea;
    if (runId) {
      await updateToolRun(supabase, runId, 'completed', playbookJson, null);
    }
    return new Response(JSON.stringify({
      success: true,
      data: playbookJson,
      runId
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
    console.error('Playbook generator error:', err);
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
  return await playbookGeneratorService(req, supabase);
});
