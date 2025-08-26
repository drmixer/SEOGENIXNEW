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
const getOptimizerPrompt = (request)=>{
  const { content, targetKeywords, contentType } = request;
  const jsonSchema = `{
        "optimizedContent": "string (The fully rewritten, optimized content)",
        "analysis": {
            "originalScore": "number (0-100, your estimated SEO score of the original text)",
            "optimizedScore": "number (0-100, your estimated SEO score of the new text)",
            "improvements": ["string (A list of the key improvements you made)"]
        }
    }`;
  return `You are an expert SEO Content Editor. Your task is to analyze and rewrite a piece of content to improve its SEO performance and AI visibility.

**Context:**
- **Content Type:** ${contentType}
- **Target Keywords:** ${targetKeywords.join(', ')}
- **Original Content:**
---
${content.substring(0, 12000)}
---

**Instructions:**
1. Thoroughly analyze the original content.
2. Rewrite the content to be more engaging, clear, and optimized for the target keywords.
3. Naturally integrate the keywords. Do not "stuff" them.
4. Improve the structure, headings, and overall flow.
5. Provide an analysis comparing the original to the optimized version.

**CRITICAL: You MUST provide your response in a single, valid JSON object enclosed in a \`\`\`json markdown block.**
The JSON object must follow this exact schema:
\`\`\`json
${jsonSchema}
\`\`\`

Rewrite and analyze the content now.`;
};
// --- Main Service Handler ---
export const optimizerService = async (req, supabase)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  let runId = null;
  try {
    const requestBody = await req.json();
    const { projectId, content, targetKeywords, contentType } = requestBody;
    if (!projectId || !content || !targetKeywords || !contentType) {
      throw new Error('`projectId`, `content`, `targetKeywords`, and `contentType` are required.');
    }
    if (![
      'article',
      'blog',
      'landing-page'
    ].includes(contentType)) {
      throw new Error('Invalid contentType. Must be one of: article, blog, landing-page');
    }
    runId = await logToolRun(supabase, projectId, 'content-optimizer', {
      contentType,
      targetKeywords,
      contentLength: content.length
    });
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('Gemini API key not configured');
    }
    const prompt = getOptimizerPrompt(requestBody);
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
          temperature: 0.3,
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
    const analysisJson = JSON.parse(jsonMatch[1]);
    if (!analysisJson.optimizedContent || !analysisJson.analysis?.optimizedScore) {
      throw new Error('Generated content from AI is missing required fields.');
    }
    // Add metadata
    const output = {
      ...analysisJson,
      originalContent: content,
      targetKeywords,
      optimizedAt: new Date().toISOString(),
      contentType
    };
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
    console.error('Content optimizer error:', err);
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
  return await optimizerService(req, supabase);
});
