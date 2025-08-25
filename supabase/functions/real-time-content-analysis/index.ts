import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// --- CORS Headers ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE'
};
// --- Inline Logging Functions (to avoid import issues) ---
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
const getAnalysisPrompt = (content)=>{
  const jsonSchema = `{
    "aiReadabilityScore": "number (0-100, how easily an AI can parse and understand the text)",
    "suggestions": [
      {
        "type": "string ('clarity' | 'seo' | 'tone' | 'engagement')",
        "severity": "string ('critical' | 'warning' | 'suggestion')",
        "message": "string (A brief explanation of the issue)",
        "suggestion": "string (A concrete suggestion for how to fix it)"
      }
    ]
  }`;
  return `You are a Real-time AI Writing Assistant. Your task is to analyze a piece of text as it's being written and provide immediate, actionable feedback. Focus on high-level concepts like clarity, SEO alignment, and tone. Do not perform simple grammar or spell-checking.

**Content to Analyze:**
---
${content}
---

**Instructions:**
1. Provide an 'aiReadabilityScore' from 0 to 100.
2. Provide a list of specific, high-level 'suggestions' for improvement.

**CRITICAL: You MUST provide your response in a single, valid JSON object enclosed in a \`\`\`json markdown block.**
The JSON object must follow this exact schema:
\`\`\`json
${jsonSchema}
\`\`\`
Now, perform your real-time analysis. If the content is too short or empty, return a JSON object with a score of 0 and empty suggestions.`;
};
// --- Helper Functions ---
function calculateKeywordDensity(content, keywords) {
  if (!content || keywords.length === 0) return {};
  const words = content.toLowerCase().split(/\s+/);
  const wordCount = words.length;
  if (wordCount === 0) return {};
  const density = {};
  keywords.forEach((keyword)=>{
    const keywordLower = keyword.toLowerCase();
    const count = words.filter((word)=>word.includes(keywordLower)).length;
    density[keyword] = parseFloat((count / wordCount * 100).toFixed(2));
  });
  return density;
}
// --- Fallback Analysis Generator ---
function generateFallbackAnalysis(content, keywords, message) {
  const keywordDensity = calculateKeywordDensity(content, keywords);
  const contentLength = content?.length || 0;
  let baseScore = 0;
  let suggestions = [];
  if (contentLength > 0) {
    // Calculate basic readability score based on content length and structure
    baseScore = Math.min(75, Math.max(10, contentLength / 10));
    // Add basic suggestions
    if (contentLength < 50) {
      suggestions.push({
        type: "clarity",
        severity: "warning",
        message: "Content appears very short",
        suggestion: "Consider expanding your content to provide more value to readers and search engines."
      });
    }
    if (keywords.length > 0) {
      const totalDensity = Object.values(keywordDensity).reduce((sum, density)=>sum + density, 0);
      if (totalDensity === 0) {
        suggestions.push({
          type: "seo",
          severity: "warning",
          message: "Target keywords not found in content",
          suggestion: "Consider naturally incorporating your target keywords into the content."
        });
      }
    }
  }
  return {
    aiReadabilityScore: Math.round(baseScore),
    keywordDensity,
    suggestions,
    analyzedAt: new Date().toISOString(),
    contentLength,
    note: `Real-time analysis failed: ${message}. Basic analysis provided.`
  };
}
// --- Main Service Handler ---
const analysisService = async (req, supabase)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  let runId = null;
  try {
    const requestBody1 = await req.json();
    const { projectId, content, keywords = [] } = requestBody1;
    if (typeof content !== 'string' || !projectId) {
      throw new Error('`content` must be a string and `projectId` is required.');
    }
    // Calculate keyword density locally
    const keywordDensity = calculateKeywordDensity(content, keywords);
    // For very short content, return immediately without AI analysis
    if (content.trim().length < 25) {
      return new Response(JSON.stringify({
        success: true,
        data: {
          aiReadabilityScore: 0,
          keywordDensity,
          suggestions: [],
          analyzedAt: new Date().toISOString(),
          contentLength: content.length
        }
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Only log errors for this high-frequency tool to avoid noise
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      console.warn('Gemini API key not configured, using fallback analysis');
      const fallbackAnalysis = generateFallbackAnalysis(content, keywords, 'API key not configured');
      return new Response(JSON.stringify({
        success: true,
        data: fallbackAnalysis,
        note: 'Fallback analysis used due to missing API configuration'
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Generate AI analysis
    const prompt = getAnalysisPrompt(content);
    console.log('Sending real-time content analysis request to Gemini...');
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
          maxOutputTokens: 2048,
          topP: 0.8,
          topK: 40
        }
      })
    });
    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', geminiResponse.status, errorText);
      // Use fallback analysis on API failure
      const fallbackAnalysis = generateFallbackAnalysis(content, keywords, 'API error');
      return new Response(JSON.stringify({
        success: true,
        data: fallbackAnalysis,
        note: 'Fallback analysis used due to API error'
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const geminiData = await geminiResponse.json();
    console.log('Gemini response received');
    if (!geminiData.candidates || geminiData.candidates.length === 0) {
      console.error('No candidates in Gemini response');
      const fallbackAnalysis = generateFallbackAnalysis(content, keywords, 'No AI response candidates');
      return new Response(JSON.stringify({
        success: true,
        data: fallbackAnalysis,
        note: 'Fallback analysis used - no AI response candidates'
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const responseText = geminiData.candidates[0].content.parts[0].text;
    console.log('Processing AI response...');
    // Extract and parse JSON
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
    if (!jsonMatch || !jsonMatch[1]) {
      console.error('Failed to extract JSON from AI response');
      const fallbackAnalysis = generateFallbackAnalysis(content, keywords, 'Failed to parse AI response');
      return new Response(JSON.stringify({
        success: true,
        data: fallbackAnalysis,
        note: 'Fallback analysis used - failed to parse AI response'
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    let analysisResult;
    try {
      analysisResult = JSON.parse(jsonMatch[1]);
    } catch (parseError) {
      console.error('Failed to parse analysis JSON:', parseError);
      const fallbackAnalysis = generateFallbackAnalysis(content, keywords, 'JSON parse error');
      return new Response(JSON.stringify({
        success: true,
        data: fallbackAnalysis,
        note: 'Fallback analysis used - JSON parse error'
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Validate analysis result structure
    if (analysisResult.aiReadabilityScore === undefined || !analysisResult.suggestions) {
      console.error('Invalid analysis result structure');
      const fallbackAnalysis = generateFallbackAnalysis(content, keywords, 'Invalid analysis structure');
      return new Response(JSON.stringify({
        success: true,
        data: fallbackAnalysis,
        note: 'Fallback analysis used - invalid analysis structure'
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Ensure score is within valid range
    analysisResult.aiReadabilityScore = Math.max(0, Math.min(100, Math.round(analysisResult.aiReadabilityScore)));
    // Ensure suggestions is an array
    analysisResult.suggestions = analysisResult.suggestions || [];
    // Add calculated keyword density and metadata
    const finalResult = {
      ...analysisResult,
      keywordDensity,
      analyzedAt: new Date().toISOString(),
      contentLength: content.length
    };
    console.log('Real-time content analysis completed successfully');
    // Successful runs are not logged to tool_runs to avoid noise for this high-frequency tool
    return new Response(JSON.stringify({
      success: true,
      data: finalResult
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
    console.error('Real-time content analysis error:', errorMessage);
    // Log only errors to tool_runs for this high-frequency tool
    if (requestBody?.projectId) {
      try {
        runId = await logToolRun(supabase, requestBody.projectId, 'real-time-content-analysis-error', {
          error: errorMessage,
          contentLength: requestBody.content?.length
        });
        if (runId) await updateToolRun(supabase, runId, 'error', null, errorMessage);
      } catch (logError) {
        console.error('Error logging failed analysis:', logError);
      }
    }
    // Return a fallback analysis instead of erroring to avoid breaking the UI
    const fallbackAnalysis = generateFallbackAnalysis(requestBody?.content || '', requestBody?.keywords || [], errorMessage);
    return new Response(JSON.stringify({
      success: true,
      data: fallbackAnalysis,
      note: 'Fallback analysis used due to system error'
    }), {
      status: 200,
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
  return await analysisService(req, supabase);
});

