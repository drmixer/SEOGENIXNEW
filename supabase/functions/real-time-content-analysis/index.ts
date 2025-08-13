import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- SHARED: CORS Headers ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- SHARED: Response Helpers ---
function createErrorResponse(message: string, status = 500, details?: any) {
  return new Response(JSON.stringify({
    success: false,
    error: {
      message,
      details: details || undefined,
    }
  }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function createSuccessResponse(data: object, status = 200) {
  return new Response(JSON.stringify({
    success: true,
    data,
  }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// --- SHARED: Service Handler ---
async function serviceHandler(req: Request, toolLogic: Function) {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    const supabaseAdminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return createErrorResponse('Missing Authorization header', 401);

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return createErrorResponse('Invalid or expired token', 401);

    return await toolLogic(req, { user, supabaseClient, supabaseAdminClient });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unknown server error occurred.';
    console.error(`[ServiceHandler Error]`, err);
    return createErrorResponse(errorMessage, 500, err instanceof Error ? err.stack : undefined);
  }
}

// --- SHARED: Database Logging ---
// This tool runs on every keystroke, so we will not log it to tool_runs to avoid excessive noise.
async function logToolRun() { return "real_time_run"; }
async function updateToolRun() { return; }

// --- SHARED: Robust AI Call Function ---
async function callGeminiWithRetry(prompt: string, apiKey: string) {
  let attempts = 0;
  const maxAttempts = 4;
  let delay = 1000;
  while (attempts < maxAttempts) {
    try {
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
          }),
        }
      );
      if (!geminiResponse.ok) {
        if (geminiResponse.status === 429 || geminiResponse.status === 503) {
            throw new Error(`Retryable Gemini API error: ${geminiResponse.status}`);
        }
        throw new Error(`Gemini API failed with status ${geminiResponse.status}`);
      }
      const geminiData = await geminiResponse.json();
      const candidate = geminiData.candidates?.[0];
      const responseText = candidate?.content?.parts?.[0]?.text;
      if (!responseText) throw new Error('Invalid response structure from Gemini API');
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
      if (!jsonMatch?.[1]) throw new Error('Failed to extract JSON from AI response.');
      return JSON.parse(jsonMatch[1]);
    } catch (error) {
       if (error.message.includes("Retryable")) {
            attempts++;
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2;
       } else {
           throw error;
       }
    }
  }
  throw new Error("The AI model is currently overloaded after multiple retries.");
}


// --- TOOL-SPECIFIC: Type Definitions ---
interface AnalysisRequest {
    projectId: string;
    content: string;
    keywords: string[];
}

// --- TOOL-SPECIFIC: AI Prompt ---
const getAnalysisPrompt = (content: string, keywords: string[]): string => {
    const jsonSchema = `{
      "aiReadabilityScore": "number (0-100)",
      "keywordDensity": { "keyword1": "number (percentage)" },
      "suggestions": [{
          "type": "string ('grammar'|'clarity'|'seo'|'tone')",
          "severity": "string ('critical'|'warning'|'suggestion')",
          "message": "string",
          "suggestion": "string",
          "position": { "start": "number", "end": "number" }
      }]
    }`;

    return `You are a Real-time AI Writing Assistant. Analyze the text and provide immediate, actionable feedback.
    - **Content to Analyze:** ${content}
    - **Target Keywords:** ${keywords.join(', ')}

    **Instructions:**
    Analyze the content for readability, keyword density, and provide specific suggestions for improvement.

    **CRITICAL: You MUST provide your response in a single, valid JSON object enclosed in a \`\`\`json markdown block.**
    The JSON object must follow this exact schema:
    \`\`\`json
    ${jsonSchema}
    \`\`\`
    If the content is too short, return empty values.`;
};

// --- TOOL-SPECIFIC: Main Logic ---
const realTimeAnalysisToolLogic = async (req: Request, { user, supabaseClient, supabaseAdminClient }: { user: any, supabaseClient: SupabaseClient, supabaseAdminClient: SupabaseClient }) => {
  try {
    const { projectId, content, keywords }: AnalysisRequest = await req.json();

    if (!projectId || typeof content !== 'string') {
      throw new Error('`projectId` and `content` (as a string) are required.');
    }

    // No need to check project access for a real-time tool that doesn't save anything to the project.

    if (content.length < 25) {
        return createSuccessResponse({
            aiReadabilityScore: 0,
            keywordDensity: {},
            suggestions: [],
        });
    }

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) throw new Error('Gemini API key not configured');

    const prompt = getAnalysisPrompt(content, keywords || []);
    const analysisJson = await callGeminiWithRetry(prompt, geminiApiKey);

    if (!analysisJson.aiReadabilityScore || !analysisJson.keywordDensity || !analysisJson.suggestions) {
        throw new Error('Generated analysis is missing required fields.');
    }

    return createSuccessResponse(analysisJson);

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
    // Do not log to tool_runs, but log to console for debugging
    console.error('Real-time analysis error:', err);
    return createErrorResponse(errorMessage, 500, err instanceof Error ? err.stack : undefined);
  }
};

// --- Server ---
Deno.serve((req) => serviceHandler(req, realTimeAnalysisToolLogic));
