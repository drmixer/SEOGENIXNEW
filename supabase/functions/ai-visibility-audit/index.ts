import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- Injected Shared Code ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE'
};

function createErrorResponse(message, status = 500) {
  return new Response(JSON.stringify({
    success: false,
    error: {
      message
    }
  }), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

function createSuccessResponse(data, status = 200) {
  return new Response(JSON.stringify({
    success: true,
    data
  }), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

// --- Service Handler ---
async function serviceHandler(req, toolLogic) {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const supabaseAdminClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? '',
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return createErrorResponse('Missing Authorization header', 401);
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? '',
      Deno.env.get("SUPABASE_ANON_KEY") ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    return await toolLogic(req, { supabaseClient, supabaseAdminClient });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unknown server error occurred.';
    console.error(`[ServiceHandler Error] ${errorMessage}`, err);
    return createErrorResponse(errorMessage);
  }
}

// --- Tool Run Logging ---
async function logToolRun(supabase, projectId, toolName, inputPayload) {
  if (!projectId) {
    throw new Error("logToolRun error: projectId is required.");
  }
  const { data, error } = await supabase.from("tool_runs").insert({
    project_id: projectId,
    tool_name: toolName,
    input_payload: inputPayload,
    status: "running"
  }).select("id").single();
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
    output_payload: errorMessage ? {
      error: errorMessage
    } : outputPayload || null,
    error_message: errorMessage || null
  };
  const { error } = await supabase.from("tool_runs").update(update).eq("id", runId);
  if (error) {
    console.error(`Error updating tool run ID ${runId}:`, error);
  }
}

// --- AI Prompts ---
const getStep1Prompt = (content) => `Analyze the following webpage content...`; // Content omitted for brevity
const getStep2Prompt = (content) => `Analyze the structural and technical elements...`; // Content omitted for brevity
const getStep3Prompt = (content) => `Assess the provided webpage content...`; // Content omitted for brevity

// --- FINAL FIX: Robust AI Call Function with Correct Exponential Backoff ---
async function callGeminiWithRetry(prompt, apiKey) {
  let attempts = 0;
  const maxAttempts = 4;
  let delay = 1000; // Start with a 1-second delay

  while (attempts < maxAttempts) {
    try {
      // Attempt to call the Gemini API
      return await callGemini(prompt, apiKey);
    } catch (error) {
      // Check if the error is a 503 (Service Unavailable) or other retryable code
      if (error.message.includes("Status: 503") || error.message.includes("Status: 429")) {
        attempts++;
        console.log(`AI model is overloaded or rate-limited. Retrying in ${delay / 1000} seconds... (Attempt ${attempts}/${maxAttempts})`);
        // Wait for the specified delay
        await new Promise(resolve => setTimeout(resolve, delay));
        // Double the delay for the next attempt
        delay *= 2;
      } else {
        // If it's a different error, fail immediately
        throw error;
      }
    }
  }

  // If we exit the loop, it means all retries have failed.
  throw new Error("The AI model is currently overloaded. Please try again later.");
}

async function callGemini(prompt, apiKey) {
  const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        response_mime_type: "application/json",
        temperature: 0.2,
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

  if (geminiData.promptFeedback && geminiData.promptFeedback.blockReason) {
    throw new Error(`The request was blocked by the AI's safety filters. Reason: ${geminiData.promptFeedback.blockReason}`);
  }

  if (geminiData.candidates && geminiData.candidates[0].content.parts && geminiData.candidates[0].content.parts[0].text) {
      let rawText = geminiData.candidates[0].content.parts[0].text;
      
      const jsonStartIndex = rawText.indexOf('{');
      const jsonEndIndex = rawText.lastIndexOf('}');

      if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
        const jsonString = rawText.substring(jsonStartIndex, jsonEndIndex + 1);
        try {
          return JSON.parse(jsonString);
        } catch (e) {
          throw new Error("Failed to parse JSON from the AI's response.");
        }
      }
  }
  
  throw new Error("Unexpected response structure from Gemini API.");
}

// --- Main Tool Logic ---
const auditToolLogic = async (req, { supabaseClient, supabaseAdminClient }) => {
  let runId = null;
  try {
    console.log("Audit function started.");
    const { projectId, url, content } = await req.json();
    if (!projectId || !url) {
        throw new Error("projectId and url are required.");
    }
    console.log(`Received request for projectId: ${projectId}`);

    const { data: project, error: projectError } = await supabaseClient
      .from('projects')
      .select('id, name')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      throw new Error("Access denied or project not found.");
    }
    console.log(`User has access to project: ${project.name}`);

    runId = await logToolRun(supabaseAdminClient, projectId, 'ai-visibility-audit', {
      url,
      content: content ? 'Content provided' : 'No content provided'
    });
    if (!runId) throw new Error("Failed to create a run log.");
    console.log(`Tool run logged with ID: ${runId}`);

    let pageContent = content;
    if (url && !content) {
      console.log(`Fetching content from URL: ${url}`);
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'SEOGENIX Audit Bot 1.0'
        }
      });
      if (!response.ok) throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
      pageContent = await response.text();
      console.log(`Successfully fetched content. Length: ${pageContent.length}`);
    }
    if (!pageContent) throw new Error("Content is empty.");

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) throw new Error('Gemini API key not configured');
    console.log("Gemini API key found.");

    console.log("Calling Gemini for Step 1: AI Understanding...");
    const step1Result = await callGeminiWithRetry(getStep1Prompt(pageContent), geminiApiKey);
    console.log("Step 1 complete.");

    console.log("Calling Gemini for Step 2: Content Structure...");
    const step2Result = await callGeminiWithRetry(getStep2Prompt(pageContent), geminiApiKey);
    console.log("Step 2 complete.");

    console.log("Calling Gemini for Step 3: Conversational Readiness...");
    const step3Result = await callGeminiWithRetry(getStep3Prompt(pageContent), geminiApiKey);
    console.log("Step 3 complete. All AI analysis finished.");

    const finalResult = {
      subscores: {
        aiUnderstanding: step1Result.aiUnderstanding || 0,
        contentStructure: step2Result.contentStructure || 0,
        citationLikelihood: step3Result.citationLikelihood || 0,
        conversationalReadiness: step3Result.conversationalReadiness || 0
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
    console.log(`Final score calculated: ${finalResult.overallScore}`);

    await updateToolRun(supabaseAdminClient, runId, 'completed', finalResult, null);
    console.log("Tool run log updated to 'completed'.");

    return createSuccessResponse({
      runId,
      ...finalResult
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
    console.error(`Audit failed: ${errorMessage}`);
    if (runId) {
      await updateToolRun(supabaseAdminClient, runId, 'error', null, errorMessage);
    }
    return createErrorResponse(errorMessage);
  }
};

Deno.serve((req) => serviceHandler(req, auditToolLogic));
