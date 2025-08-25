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
const getInsightsPrompt = (auditResult)=>{
  const { url, overallScore, subscores, recommendations, issues, strengths, keyInsights } = auditResult;
  const jsonSchema = `{
    "deepDiveAnalysis": [
      {
        "subscoreName": "string (e.g., 'aiUnderstanding')",
        "score": "number (The score for this component)",
        "reasoning": "string (A detailed explanation for why this score was given, citing specific examples from the audit)",
        "actionableAdvice": "string (A concrete next step the user can take to improve this specific score)"
      }
    ],
    "prioritizedRecommendations": [
      {
        "title": "string (Recommendation title)",
        "description": "string (Detailed description)",
        "priority": "string (High|Medium|Low)",
        "estimatedImpact": "string (Expected improvement in AI visibility)",
        "implementationSteps": ["string (Step-by-step instructions)"]
      }
    ],
    "quickWins": [
      {
        "title": "string (Quick improvement title)",
        "description": "string (What to do)",
        "timeToImplement": "string (e.g., '5 minutes', '1 hour')",
        "expectedImpact": "string (What improvement to expect)"
      }
    ],
    "strategicInsights": [
      "string (High-level insights about the site's AI readiness)"
    ]
  }`;
  return `You are a Senior AI SEO Strategist. Your task is to provide enhanced insights and strategic recommendations based on a previous AI Visibility Audit.

**Original Audit Data:**
- **URL:** ${url}
- **Overall Score:** ${overallScore}
- **Subscores:** ${JSON.stringify(subscores, null, 2)}
- **Existing Recommendations:** ${JSON.stringify(recommendations, null, 2)}
- **Issues Found:** ${JSON.stringify(issues, null, 2)}
- **Strengths:** ${JSON.stringify(strengths, null, 2)}
- **Key Insights:** ${JSON.stringify(keyInsights, null, 2)}

**Analysis Instructions:**
1. **Deep Dive Analysis:** For each subscore, provide detailed reasoning based on the audit data and actionable advice for improvement.
2. **Prioritized Recommendations:** Transform the existing recommendations into prioritized, detailed action plans with implementation steps.
3. **Quick Wins:** Identify 3-5 quick improvements that can be implemented immediately for fast results.
4. **Strategic Insights:** Provide high-level strategic observations about the site's AI optimization potential.

Focus on practical, implementable advice that will directly improve AI visibility and citation likelihood.

**CRITICAL: You MUST provide your response in a single, valid JSON object enclosed in a \`\`\`json markdown block.**
The JSON object must follow this exact schema:
\`\`\`json
${jsonSchema}
\`\`\`

Perform your enhanced insights analysis now.`;
};
// --- Fallback Generator ---
function generateFallbackInsights(url, message) {
  return {
    deepDiveAnalysis: [
      {
        subscoreName: "aiUnderstanding",
        score: 50,
        reasoning: "Unable to perform detailed analysis due to technical limitations.",
        actionableAdvice: "Ensure your content uses clear, structured language with proper headings and bullet points."
      },
      {
        subscoreName: "citationLikelihood",
        score: 45,
        reasoning: "Limited analysis available for citation potential assessment.",
        actionableAdvice: "Add authoritative sources and references to increase content credibility."
      },
      {
        subscoreName: "conversationalReadiness",
        score: 50,
        reasoning: "Cannot assess conversational suitability without full analysis.",
        actionableAdvice: "Write content that directly answers common questions in a natural tone."
      },
      {
        subscoreName: "contentStructure",
        score: 55,
        reasoning: "Basic structure assessment performed with limited data.",
        actionableAdvice: "Implement proper heading hierarchy (H1, H2, H3) and use clear section breaks."
      }
    ],
    prioritizedRecommendations: [
      {
        title: "Improve Content Structure",
        description: "Enhance the organization and hierarchy of your content to make it more AI-friendly.",
        priority: "High",
        estimatedImpact: "15-25 point increase in AI Understanding score",
        implementationSteps: [
          "Add clear H1, H2, H3 heading structure",
          "Break up long paragraphs into shorter, scannable sections",
          "Use bullet points and numbered lists where appropriate",
          "Add table of contents for longer pages"
        ]
      }
    ],
    quickWins: [
      {
        title: "Add Schema Markup",
        description: "Implement basic structured data to help AI systems understand your content better.",
        timeToImplement: "30 minutes",
        expectedImpact: "Improved AI comprehension and citation likelihood"
      },
      {
        title: "Optimize Meta Descriptions",
        description: "Write clear, descriptive meta descriptions that summarize your content effectively.",
        timeToImplement: "15 minutes",
        expectedImpact: "Better AI understanding of page purpose"
      }
    ],
    strategicInsights: [
      `Enhanced insights could not be generated: ${message}`,
      "Consider implementing a comprehensive AI optimization strategy focusing on content structure and semantic markup."
    ],
    url: url,
    generatedAt: new Date().toISOString(),
    note: `Fallback analysis used: ${message}`
  };
}
// --- Main Service Handler ---
const enhancedAuditInsightsService = async (req, supabase)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  let runId = null;
  try {
    const requestBody = await req.json();
    const { projectId, auditRunId } = requestBody;
    if (!projectId || !auditRunId) {
      throw new Error('`projectId` and `auditRunId` are required.');
    }
    runId = await logToolRun(supabase, projectId, 'enhanced-audit-insights', {
      auditRunId
    });
    // Fetch the original audit data
    const { data: auditRun, error: auditError } = await supabase.from('tool_runs').select('input_payload, output_payload').eq('id', auditRunId).single();
    if (auditError || !auditRun) {
      throw new Error(`Failed to fetch original audit run (ID: ${auditRunId}): ${auditError?.message || 'Not found'}`);
    }
    const auditResult = {
      ...auditRun.input_payload,
      ...auditRun.output_payload
    };
    if (!auditResult.overallScore || !auditResult.subscores) {
      throw new Error("The provided audit run does not contain the necessary score data.");
    }
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      console.warn('Gemini API key not configured, using fallback insights');
      const fallbackInsights = generateFallbackInsights(auditResult.url, 'Missing API configuration');
      if (runId) {
        await updateToolRun(supabase, runId, 'completed', fallbackInsights, null);
      }
      return new Response(JSON.stringify({
        success: true,
        data: fallbackInsights,
        runId,
        note: 'Fallback analysis used due to missing API configuration'
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const prompt = getInsightsPrompt(auditResult);
    console.log('Sending insights request to Gemini...');
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
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', geminiResponse.status, errorText);
      const fallbackInsights = generateFallbackInsights(auditResult.url, 'API error');
      if (runId) {
        await updateToolRun(supabase, runId, 'completed', fallbackInsights, null);
      }
      return new Response(JSON.stringify({
        success: true,
        data: fallbackInsights,
        runId,
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
      const fallbackInsights = generateFallbackInsights(auditResult.url, 'No AI response candidates');
      if (runId) {
        await updateToolRun(supabase, runId, 'completed', fallbackInsights, null);
      }
      return new Response(JSON.stringify({
        success: true,
        data: fallbackInsights,
        runId,
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
      const fallbackInsights = generateFallbackInsights(auditResult.url, 'Failed to parse AI response');
      if (runId) {
        await updateToolRun(supabase, runId, 'completed', fallbackInsights, null);
      }
      return new Response(JSON.stringify({
        success: true,
        data: fallbackInsights,
        runId,
        note: 'Fallback analysis used - failed to parse AI response'
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    let insightsResult;
    try {
      insightsResult = JSON.parse(jsonMatch[1]);
    } catch (parseError) {
      console.error('Failed to parse insights JSON:', parseError);
      const fallbackInsights = generateFallbackInsights(auditResult.url, 'JSON parse error');
      if (runId) {
        await updateToolRun(supabase, runId, 'completed', fallbackInsights, null);
      }
      return new Response(JSON.stringify({
        success: true,
        data: fallbackInsights,
        runId,
        note: 'Fallback analysis used - JSON parse error'
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Validate and sanitize output
    if (!insightsResult.deepDiveAnalysis || !Array.isArray(insightsResult.deepDiveAnalysis)) {
      console.error('Invalid insights result structure');
      const fallbackInsights = generateFallbackInsights(auditResult.url, 'Invalid result structure');
      if (runId) {
        await updateToolRun(supabase, runId, 'completed', fallbackInsights, null);
      }
      return new Response(JSON.stringify({
        success: true,
        data: fallbackInsights,
        runId,
        note: 'Fallback analysis used - invalid result structure'
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Ensure arrays exist and add metadata
    insightsResult.deepDiveAnalysis = insightsResult.deepDiveAnalysis || [];
    insightsResult.prioritizedRecommendations = insightsResult.prioritizedRecommendations || [];
    insightsResult.quickWins = insightsResult.quickWins || [];
    insightsResult.strategicInsights = insightsResult.strategicInsights || [];
    insightsResult.url = auditResult.url;
    insightsResult.generatedAt = new Date().toISOString();
    insightsResult.auditRunId = auditRunId;
    console.log('Enhanced insights completed successfully');
    if (runId) {
      await updateToolRun(supabase, runId, 'completed', insightsResult, null);
    }
    return new Response(JSON.stringify({
      success: true,
      data: insightsResult,
      runId
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
    console.error('Enhanced Audit Insights Error:', errorMessage);
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
  return await enhancedAuditInsightsService(req, supabase);
});

