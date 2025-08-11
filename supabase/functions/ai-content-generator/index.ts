import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// --- CORS Headers ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
// --- Database Logging Helpers ---
async function logToolRun(supabase, projectId, toolName, inputPayload) {
  if (!projectId) {
    throw new Error("logToolRun error: projectId is required.");
  }
  const { data, error } = await supabase
    .from("tool_runs")
    .insert({
      project_id: projectId,
      tool_name: toolName,
      input_payload: inputPayload,
      status: "running",
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error logging tool run:", error);
    throw new Error(`Failed to log tool run. Supabase error: ${error.message}`);
  }
  if (!data || !data.id) {
    console.error("No data or data.id returned from tool_runs insert.");
    throw new Error("Failed to log tool run: No data returned after insert.");
  }
  return data.id;
}

async function updateToolRun(supabase, runId, status, outputPayload, errorMessage) {
  if (!runId) {
    console.error("updateToolRun error: runId is required.");
    return;
  }
  const update = {
    status,
    completed_at: new Date().toISOString(),
    output_payload: errorMessage ? { error: errorMessage } : outputPayload || null,
    error_message: errorMessage || null,
  };
  const { error } = await supabase.from("tool_runs").update(update).eq("id", runId);
  if (error) {
    console.error(`Error updating tool run ID ${runId}:`, error);
  }
}
// --- AI Prompt Engineering ---
const getContentGenerationPrompt = (request)=>{
  const { contentType, topic, targetKeywords, tone, entitiesToInclude } = request;
  const baseInstructions = {
    'faq': 'Generate a comprehensive FAQ section. Create questions that people commonly ask and provide clear, concise answers.',
    'meta-tags': 'Generate optimized meta tags (title, description, keywords).',
    'snippets': 'Create a featured snippet-optimized content piece (e.g., a definition, a short list, or a step-by-step guide).',
    'headings': 'Generate a comprehensive and logical heading structure (H1, H2s, H3s).',
    'article-section': 'Write a detailed and engaging section for an article.'
  };
  const jsonSchema = `{ "generatedTitle": "string", "generatedContent": "string", "supportingDetails": { "wordCount": "number", "keywordsUsed": ["string"] } }`;
  const entityInstruction = entitiesToInclude && entitiesToInclude.length > 0 ? `**Crucially, you must naturally integrate the following entities into the content:** ${entitiesToInclude.join(', ')}.` : '';
  return `
    You are an Expert Content Strategist and SEO Copywriter.
    **Content Generation Task:**
    - **Content Type to Generate:** ${contentType}
    - **Primary Topic:** ${topic}
    - **Target Keywords:** ${targetKeywords.join(', ')}
    - **Tone of Voice:** ${tone || 'professional'}
    ${entityInstruction}
    **Instructions:**
    - Fulfill the primary instruction: ${baseInstructions[contentType]}
    - The content must be well-written, accurate, and ready for publication.
    **Output Format:**
    You MUST provide a response in a single, valid JSON object adhering to this schema:
    \`\`\`json
    ${jsonSchema}
    \`\`\`
    Now, perform your expert content generation.
    `;
};
// --- Main Service Handler ---
export const contentGeneratorService = async (req, supabase)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  let runId = null;
  try {
    const requestBody = await req.json();
    const { projectId, ...inputPayload } = requestBody;
    if (!projectId) throw new Error("projectId is required for logging.");
    if (!requestBody.topic || !requestBody.contentType) throw new Error('`topic` and `contentType` are required fields.');
    runId = await logToolRun(
      supabase,
      projectId,
      'ai-content-generator',
      inputPayload
    );
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) throw new Error('Gemini API key not configured');
    const prompt = getContentGenerationPrompt(requestBody);
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${geminiApiKey}`, {
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
          response_mime_type: "application/json",
          temperature: 0.7,
          maxOutputTokens: 4096
        }
      })
    });
    if (!geminiResponse.ok) throw new Error(`The AI model failed to process the request. Status: ${geminiResponse.status}`);
    const geminiData = await geminiResponse.json();
    const generatedJson = JSON.parse(geminiData.candidates[0].content.parts[0].text);
    if (runId) {
      await updateToolRun(supabase, runId, 'completed', generatedJson, null);
    }
    return new Response(JSON.stringify({
      success: true,
      data: generatedJson
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
    if (runId) {
      await updateToolRun(supabase, runId, 'error', null, errorMessage);
    }
    return new Response(JSON.stringify({
      success: false,
      error: {
        message: errorMessage
      }
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
  return await contentGeneratorService(req, supabase);
});
