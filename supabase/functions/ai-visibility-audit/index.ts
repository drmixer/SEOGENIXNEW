import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- Injected Shared Code ---

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

function createErrorResponse(message: string, status: number = 500) {
  return new Response(JSON.stringify({ success: false, error: { message } }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function createSuccessResponse(data: object, status: number = 200) {
  return new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type ToolLogic = (req: Request, supabase: SupabaseClient) => Promise<Response>;

async function serviceHandler(req: Request, toolLogic: ToolLogic): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    return await toolLogic(req, supabase);

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'An unknown server error occurred.';
    console.error(`[ServiceHandler Error] ${errorMessage}`, err);
    return createErrorResponse(errorMessage);
  }
}

// --- Original File Content ---

async function logToolRun(supabase: SupabaseClient, projectId: string, toolName: string, inputPayload: object) {
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

async function updateToolRun(supabase: SupabaseClient, runId: string, status: string, outputPayload: object | null, errorMessage: string | null) {
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

async function updateToolRunProgress(supabase: SupabaseClient, runId: string, progress: Record<string, unknown>) {
  const { error } = await supabase.from('tool_runs').update({ progress }).eq('id', runId);
  if (error) {
    console.error('Error updating tool run progress:', error);
  }
}

const getStep1Prompt = (content: string) => `Analyze the following webpage content to determine its clarity and comprehensibility for an AI model. Focus on on-page elements.

**Content to Analyze:**
\`\`\`html
${content}
\`\`\`

**Instructions:**
1.  **AI Understanding Score (0-100):** Rate how easily an AI can understand the main topics, entities, and intent of the content. A higher score means the content is clear, well-written, and uses unambiguous language.
2.  **On-Page Issues:** Identify specific problems that hinder AI understanding (e.g., keyword stuffing, vague language, conflicting statements, lack of clear focus).
3.  **On-Page Recommendations:** Suggest concrete improvements to enhance AI clarity (e.g., "Define the acronym 'XYZ' immediately," "Use the primary keyword 'ABC' in the main heading," "Clarify the relationship between Concept A and Concept B.").

**Output Format:**
You MUST provide a response in a single, valid JSON object. Do not include any text outside of the JSON. The JSON object must strictly adhere to the following schema:
\`\`\`json
{
  "aiUnderstanding": "number (0-100)",
  "onPageIssues": [
    {
      "issue": "string (A concise description of the problem)",
      "recommendation": "string (A specific, actionable recommendation to fix it)"
    }
  ],
  "onPageRecommendations": [
    {
      "recommendation": "string (A specific, actionable recommendation for improvement)",
      "priority": "string ('High', 'Medium', or 'Low')"
    }
  ]
}
\`\`\`
`;

const getStep2Prompt = (content: string) => `Analyze the structural and technical elements of the following webpage content. Focus on how the structure impacts an AI's ability to parse, categorize, and interpret the information.

**Content to Analyze:**
\`\`\`html
${content}
\`\`\`

**Instructions:**
1.  **Content Structure Score (0-100):** Rate the quality of the content's structure for machine readability. Consider the logical use of headings (H1, H2, etc.), presence of lists, tables, and any structured data (like Schema.org JSON-LD).
2.  **Structure Issues:** Identify structural problems (e.g., "Multiple H1 tags found," "Lack of semantic HTML tags like <article> or <nav>," "No structured data detected," "Poor heading hierarchy").
3.  **Structure Recommendations:** Suggest concrete improvements to the structure (e.g., "Use a single H1 for the main title," "Implement FAQPage schema for the FAQ section," "Break down long paragraphs into bulleted lists.").

**Output Format:**
You MUST provide a response in a single, valid JSON object. Do not include any text outside of the JSON. The JSON object must strictly adhere to the following schema:
\`\`\`json
{
  "contentStructure": "number (0-100)",
  "structureIssues": [
    {
      "issue": "string (A concise description of the problem)",
      "recommendation": "string (A specific, actionable recommendation to fix it)"
    }
  ],
  "structureRecommendations": [
    {
      "recommendation": "string (A specific, actionable recommendation for improvement)",
      "priority": "string ('High', 'Medium', or 'Low')"
    }
  ]
}
\`\`\`
`;

const getStep3Prompt = (content: string) => `Assess the provided webpage content for its conversational readiness and likelihood of being cited by an AI.

**Content to Analyze:**
\`\`\`html
${content}
\`\`\`

**Instructions:**
1.  **Conversational Readiness Score (0-100):** Rate how well the content answers questions directly. Is it suitable for a voice assistant to read aloud? Does it contain clear, concise answers to potential user queries?
2.  **Citation Likelihood Score (0-100):** Rate how likely an AI is to cite this page as a source. Consider the presence of unique data, statistics, expert opinions, and clear, quotable statements.
3.  **Readiness Issues:** Identify issues that harm its conversational or citation potential (e.g., "Answers are buried in long paragraphs," "Lacks specific data or statistics," "Content is purely opinion-based with no evidence.").
4.  **Readiness Recommendations:** Suggest concrete improvements (e.g., "Create a 'Key Takeaways' section at the top," "Add a Q&A section that directly answers common questions," "Include specific data points and cite their sources to build authority.").

**Output Format:**
You MUST provide a response in a single, valid JSON object. Do not include any text outside of the JSON. The JSON object must strictly adhere to the following schema:
\`\`\`json
{
  "conversationalReadiness": "number (0-100)",
  "citationLikelihood": "number (0-100)",
  "readinessIssues": [
    {
      "issue": "string (A concise description of the problem)",
      "recommendation": "string (A specific, actionable recommendation to fix it)"
    }
  ],
  "readinessRecommendations": [
    {
      "recommendation": "string (A specific, actionable recommendation for improvement)",
      "priority": "string ('High', 'Medium', or 'Low')"
    }
  ]
}
\`\`\`
`;

async function callGemini(prompt: string, apiKey: string) {
    // ... (callGemini logic is correct)
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              response_mime_type: "application/json",
              temperature: 0.2, maxOutputTokens: 2048
            }
        })
    });
    if (!geminiResponse.ok) {
        const errorBody = await geminiResponse.text();
        console.error('Gemini API error:', errorBody);
        throw new Error(`The AI model failed to process the request. Status: ${geminiResponse.status}`);
    }
    const geminiData = await geminiResponse.json();
    return JSON.parse(geminiData.candidates[0].content.parts[0].text);
}

const auditToolLogic = async (req: Request, supabase: SupabaseClient): Promise<Response> => {
  let runId: string | null = null;
  try {
    const { projectId, url, content } = await req.json();

    runId = await logToolRun(
      supabase,
      projectId,
      'ai-visibility-audit',
      { url, content: content ? 'Content provided' : 'No content provided' }
    );
    if (!runId) throw new Error("Failed to create a run log.");

    let pageContent = content;
    if (url && !content) {
        const response = await fetch(url, { headers: { 'User-Agent': 'SEOGENIX Audit Bot 1.0' } });
        if (!response.ok) throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
        pageContent = await response.text();
    }
    if (!pageContent) throw new Error("Content is empty.");

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) throw new Error('Gemini API key not configured');

    const step1Result = await callGemini(getStep1Prompt(pageContent), geminiApiKey);
    const step2Result = await callGemini(getStep2Prompt(pageContent), geminiApiKey);
    const step3Result = await callGemini(getStep3Prompt(pageContent), geminiApiKey);

    const finalResult = {
        subscores: {
            aiUnderstanding: step1Result.aiUnderstanding || 0,
            contentStructure: step2Result.contentStructure || 0,
            citationLikelihood: step3Result.citationLikelihood || 0,
            conversationalReadiness: step3Result.conversationalReadiness || 0,
        },
        recommendations: [
            ...(step1Result.onPageRecommendations || []),
            ...(step2Result.structureRecommendations || []),
            ...(step3Result.readinessRecommendations || [])
        ],
        issues: [
            ...(step1Result.onPageIssues || []),
            ...(step2Result.structureIssues || []),
            ...(step3Result.readinessIssues || [])
        ],
        overallScore: 0
    };

    const scores = Object.values(finalResult.subscores);
    finalResult.overallScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

    await updateToolRun(supabase, runId, 'completed', finalResult, null);

    return createSuccessResponse({ runId, ...finalResult });

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
    if (runId) {
      await updateToolRun(supabase, runId, 'error', null, errorMessage);
    }
    return createErrorResponse(errorMessage);
  }
};

Deno.serve((req) => serviceHandler(req, auditToolLogic));
