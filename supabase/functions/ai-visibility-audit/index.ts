import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Self-contained CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// Initialize Supabase client for logging
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

// Helper functions for logging tool runs in the database
async function logToolRun({ projectId, toolName, inputPayload }: LogToolRunParams) {
  const { data, error } = await supabase
    .from('tool_runs')
    .insert({
      project_id: projectId,
      tool_name: toolName,
      input_payload: inputPayload,
      status: 'running'
    })
    .select('id')
    .single();
  if (error) {
    console.error('Error logging tool run:', error);
    return null;
  }
  return data.id;
}

async function updateToolRun({ runId, status, outputPayload, errorMessage }: UpdateToolRunParams) {
  const update = {
    status,
    completed_at: new Date().toISOString(),
    output_payload: outputPayload,
    error_message: errorMessage
  };
  const { error } = await supabase.from('tool_runs').update(update).eq('id', runId);
  if (error) {
    console.error('Error updating tool run:', error);
  }
}

// --- New Enhanced Prompt ---
const getAnalysisPrompt = (url: string, content: string) => {
  const jsonSchema = `
  {
    "overallScore": "number (0-100)",
    "subscores": {
      "aiUnderstanding": "number (0-100, how well an AI can understand the core topic)",
      "citationLikelihood": "number (0-100, likelihood of being cited by AI models)",
      "conversationalReadiness": "number (0-100, suitability for voice search and chatbots)",
      "contentStructure": "number (0-100, quality of HTML structure and metadata)"
    },
    "recommendations": [
      {
        "title": "string (short, clear title of the recommendation)",
        "description": "string (detailed explanation of the recommendation and why it's important)",
        "action_type": "string (enum: 'content-optimizer', 'schema-generator', 'general-advice')"
      }
    ],
    "issues": [
      {
        "title": "string (short, clear title of the issue found)",
        "description": "string (detailed explanation of the issue and its impact)"
      }
    ]
  }
  `;

  const fewShotExample = `
  {
    "overallScore": 85,
    "subscores": {
      "aiUnderstanding": 90,
      "citationLikelihood": 80,
      "conversationalReadiness": 88,
      "contentStructure": 82
    },
    "recommendations": [
      {
        "title": "Add FAQ Schema",
        "description": "The page answers common questions but lacks FAQ schema markup. Adding it will make these Q&As more visible to search engines and AI, improving conversational readiness.",
        "action_type": "schema-generator"
      },
      {
        "title": "Incorporate a 'Key Takeaways' Section",
        "description": "A concise summary section at the beginning of the article would improve AI understanding and increase the likelihood of being used as a citation source.",
        "action_type": "content-optimizer"
      }
    ],
    "issues": [
      {
        "title": "Missing Meta Description",
        "description": "The page is missing a meta description, which harms both user click-through rates from search results and AI's ability to quickly summarize the page's purpose."
      }
    ]
  }
  `;

  return `
  You are an expert AI Visibility Auditor. Your task is to analyze the provided web page content and evaluate its visibility and readiness for AI-driven platforms like Google's Search Generative Experience (SGE), Perplexity, and other large language models.

  Analyze the content from the following URL: ${url}
  Content:
  ---
  ${content.substring(0, 15000)}
  ---

  Based on your analysis, you MUST provide a response in a valid JSON format. Do not include any text or formatting outside of the JSON object.

  The JSON object must strictly adhere to the following schema:
  \`\`\`json
  ${jsonSchema}
  \`\`\`

  Here is an example of the ideal output format and quality (a "few-shot" example):
  \`\`\`json
  ${fewShotExample}
  \`\`\`

  Now, perform your expert analysis of the provided content and return the resulting JSON object.
  `;
};


export const auditService = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let runId: string | null = null;
  try {
    const { projectId, url, content } = await req.json();

    runId = await logToolRun({
      projectId: projectId,
      toolName: 'ai-visibility-audit',
      inputPayload: { url, content: content ? 'Content provided' : 'No content provided' }
    });

    if (!url && !content) {
      throw new Error('URL or content is required');
    }

    let pageContent = content;
    if (url && !content) {
      try {
        const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36' } });
        if (!response.ok) {
          throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
        }
        pageContent = await response.text();
      } catch (error) {
        console.error('Failed to fetch URL content:', error);
        // Throw a more specific error for the client
        throw new Error(`Could not retrieve content from the provided URL: ${url}. Please check the URL and try again.`);
      }
    }

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('Gemini API key not configured');
    }

    const prompt = getAnalysisPrompt(url, pageContent);

    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              response_mime_type: "application/json",
              temperature: 0.3,
              topK: 40,
              topP: 0.9,
              maxOutputTokens: 2048
            }
        })
    });

    if (!geminiResponse.ok) {
      const errorBody = await geminiResponse.text();
      console.error('Gemini API error:', errorBody);
      throw new Error(`The AI model failed to process the request. Status: ${geminiResponse.status}`);
    }

    const geminiData = await geminiResponse.json();
    const analysisText = geminiData.candidates[0].content.parts[0].text;
    const analysisJson = JSON.parse(analysisText);

    if (runId) {
      await updateToolRun({
        runId,
        status: 'completed',
        outputPayload: analysisJson,
        errorMessage: null,
      });
    }

    return new Response(JSON.stringify({ success: true, data: { runId, ...analysisJson, pageContent } }), {
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

// Start the server
Deno.serve(auditService);
