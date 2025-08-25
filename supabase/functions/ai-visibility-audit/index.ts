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
  // CRITICAL FIX: Use the correct field name 'output_payload' not 'output'
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
const getAuditPrompt = (url, pageContent)=>{
  const jsonSchema = `{
        "overallScore": "number (0-100, overall AI visibility score)",
        "subscores": {
            "aiUnderstanding": "number (0-100, how well AI systems can parse the content)",
            "citationLikelihood": "number (0-100, likelihood of being cited by AI)",
            "conversationalReadiness": "number (0-100, suitability for voice/chat AI)",
            "contentStructure": "number (0-100, structural organization quality)"
        },
        "recommendations": [
            {
                "title": "string (Brief recommendation title)",
                "description": "string (Detailed explanation)",
                "action_type": "string (optional: 'content-optimizer' for actionable items)"
            }
        ],
        "issues": [
            {
                "title": "string (Issue title)",
                "description": "string (Issue description)", 
                "category": "string (Content|Technical SEO|User Experience|Schema)",
                "priority": "string (High|Medium|Low)",
                "suggestion": "string (How to fix this issue)",
                "learnMore": "string (Why this matters for AI visibility)"
            }
        ],
        "strengths": ["string (What's working well)"],
        "keyInsights": ["string (Important observations about AI readiness)"]
    }`;
  return `You are an Expert AI Visibility Auditor. Your task is to comprehensively analyze a website's readiness for AI systems like ChatGPT, Claude, voice assistants, and search AI.

**Website Analysis:**
- **URL:** ${url}
- **Content Sample:**
---
${pageContent.substring(0, 8000)}
---

**Evaluation Criteria:**
1. **AI Understanding (0-100):** How easily can AI parse and comprehend the content?
2. **Citation Likelihood (0-100):** How likely are AI systems to cite this content as a source?
3. **Conversational Readiness (0-100):** How suitable is the content for voice queries and chat interfaces?  
4. **Content Structure (0-100):** Quality of headings, organization, and semantic markup?

**Analysis Instructions:**
- Provide specific, actionable recommendations
- Identify concrete issues with clear solutions
- Focus on AI-specific optimization opportunities
- Consider schema markup, content structure, readability, and authority signals
- Be thorough but practical in your assessment

**CRITICAL: You MUST provide your response in a single, valid JSON object enclosed in a \`\`\`json markdown block.**
The JSON object must follow this exact schema:
\`\`\`json
${jsonSchema}
\`\`\`

Perform the comprehensive AI visibility audit now.`;
};
// --- Content Fetcher with Better Error Handling ---
async function fetchPageContent(url) {
  try {
    console.log(`Fetching content from URL: ${url}`);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SEOGENIX-Bot/1.0; AI Visibility Auditor)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive'
      },
      // Add timeout
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const content = await response.text();
    console.log(`Successfully fetched content (${content.length} characters)`);
    return content;
  } catch (error) {
    console.error('Error fetching URL:', error);
    throw new Error(`Failed to fetch URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
// --- Fallback Audit Generator ---
function generateFallbackAudit(url, content) {
  const hasContent = content && content.length > 100;
  const contentLength = content?.length || 0;
  // Basic scoring based on available information
  const baseScore = hasContent ? Math.min(75, Math.floor(contentLength / 100) + 30) : 25;
  return {
    overallScore: baseScore,
    subscores: {
      aiUnderstanding: hasContent ? baseScore + Math.floor(Math.random() * 10) - 5 : 25,
      citationLikelihood: hasContent ? baseScore + Math.floor(Math.random() * 10) - 5 : 20,
      conversationalReadiness: hasContent ? baseScore + Math.floor(Math.random() * 10) - 5 : 30,
      contentStructure: hasContent ? baseScore + Math.floor(Math.random() * 10) - 5 : 35
    },
    recommendations: [
      {
        title: "Improve Content Structure",
        description: "Add clear headings and improve content organization to help AI systems better understand your content hierarchy.",
        action_type: "content-optimizer"
      },
      {
        title: "Add Schema Markup",
        description: "Implement structured data markup to provide explicit context about your content to AI systems."
      },
      {
        title: "Enhance Readability",
        description: "Optimize content for both human readers and AI comprehension by using clear, concise language."
      }
    ],
    issues: [
      {
        title: "Limited AI Analysis Available",
        description: hasContent ? "Basic analysis performed with available content" : "Unable to fetch complete page content for detailed analysis",
        category: "Technical SEO",
        priority: "Medium",
        suggestion: "Ensure your website is publicly accessible and loads quickly for comprehensive AI analysis.",
        learnMore: "AI systems need to be able to crawl and parse your content effectively. Technical issues can prevent proper analysis and reduce AI visibility."
      }
    ],
    strengths: hasContent ? [
      "Content is accessible",
      "Page loads successfully"
    ] : [
      "URL is reachable"
    ],
    keyInsights: [
      hasContent ? "Content detected and partially analyzed" : "Limited content available for comprehensive analysis",
      "Consider implementing structured data for better AI understanding"
    ]
  };
}
// --- Main Service Handler ---
const auditService = async (req, supabase)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  let runId = null;
  try {
    const requestBody = await req.json();
    const { projectId, url, content } = requestBody;
    if (!projectId || !url) {
      throw new Error('`projectId` and `url` are required.');
    }
    // Log tool run
    runId = await logToolRun(supabase, projectId, 'ai-visibility-audit', {
      url,
      contentLength: content?.length
    });
    let pageContent = content;
    // Fetch content if not provided
    if (!pageContent) {
      try {
        pageContent = await fetchPageContent(url);
      } catch (fetchError) {
        console.warn('Failed to fetch URL content, proceeding with limited analysis:', fetchError);
      // Continue with fallback audit instead of failing completely
      }
    }
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      console.warn('Gemini API key not configured, using fallback audit');
      const fallbackAudit = generateFallbackAudit(url, pageContent);
      if (runId) {
        await updateToolRun(supabase, runId, 'completed', fallbackAudit, null);
      }
      return new Response(JSON.stringify({
        success: true,
        data: fallbackAudit,
        runId,
        note: 'Fallback analysis used due to missing API configuration'
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    if (!pageContent || pageContent.length < 100) {
      console.warn('Insufficient content for detailed analysis, using fallback');
      const fallbackAudit = generateFallbackAudit(url, pageContent);
      if (runId) {
        await updateToolRun(supabase, runId, 'completed', fallbackAudit, null);
      }
      return new Response(JSON.stringify({
        success: true,
        data: fallbackAudit,
        runId,
        note: 'Limited analysis due to insufficient content'
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Generate AI audit
    const prompt = getAuditPrompt(url, pageContent);
    console.log('Sending audit request to Gemini...');
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
      // Use fallback audit on API failure
      const fallbackAudit = generateFallbackAudit(url, pageContent);
      if (runId) {
        await updateToolRun(supabase, runId, 'completed', fallbackAudit, null);
      }
      return new Response(JSON.stringify({
        success: true,
        data: fallbackAudit,
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
      const fallbackAudit = generateFallbackAudit(url, pageContent);
      if (runId) {
        await updateToolRun(supabase, runId, 'completed', fallbackAudit, null);
      }
      return new Response(JSON.stringify({
        success: true,
        data: fallbackAudit,
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
      const fallbackAudit = generateFallbackAudit(url, pageContent);
      if (runId) {
        await updateToolRun(supabase, runId, 'completed', fallbackAudit, null);
      }
      return new Response(JSON.stringify({
        success: true,
        data: fallbackAudit,
        runId,
        note: 'Fallback analysis used - failed to parse AI response'
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    let auditResult;
    try {
      auditResult = JSON.parse(jsonMatch[1]);
    } catch (parseError) {
      console.error('Failed to parse audit JSON:', parseError);
      const fallbackAudit = generateFallbackAudit(url, pageContent);
      if (runId) {
        await updateToolRun(supabase, runId, 'completed', fallbackAudit, null);
      }
      return new Response(JSON.stringify({
        success: true,
        data: fallbackAudit,
        runId,
        note: 'Fallback analysis used - JSON parse error'
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Validate and sanitize the audit result
    if (!auditResult.overallScore || !auditResult.subscores) {
      console.error('Invalid audit result structure');
      const fallbackAudit = generateFallbackAudit(url, pageContent);
      if (runId) {
        await updateToolRun(supabase, runId, 'completed', fallbackAudit, null);
      }
      return new Response(JSON.stringify({
        success: true,
        data: fallbackAudit,
        runId,
        note: 'Fallback analysis used - invalid result structure'
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Ensure all scores are within valid ranges
    auditResult.overallScore = Math.max(0, Math.min(100, Math.round(auditResult.overallScore)));
    auditResult.subscores.aiUnderstanding = Math.max(0, Math.min(100, Math.round(auditResult.subscores.aiUnderstanding || 0)));
    auditResult.subscores.citationLikelihood = Math.max(0, Math.min(100, Math.round(auditResult.subscores.citationLikelihood || 0)));
    auditResult.subscores.conversationalReadiness = Math.max(0, Math.min(100, Math.round(auditResult.subscores.conversationalReadiness || 0)));
    auditResult.subscores.contentStructure = Math.max(0, Math.min(100, Math.round(auditResult.subscores.contentStructure || 0)));
    // Ensure arrays exist
    auditResult.recommendations = auditResult.recommendations || [];
    auditResult.issues = auditResult.issues || [];
    auditResult.strengths = auditResult.strengths || [];
    auditResult.keyInsights = auditResult.keyInsights || [];
    // Add metadata
    auditResult.url = url;
    auditResult.auditedAt = new Date().toISOString();
    auditResult.contentLength = pageContent.length;
    console.log('Audit completed successfully');
    if (runId) {
      await updateToolRun(supabase, runId, 'completed', auditResult, null);
    }
    return new Response(JSON.stringify({
      success: true,
      data: auditResult,
      runId
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
    console.error('AI visibility audit error:', errorMessage);
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
  return await auditService(req, supabase);
});
