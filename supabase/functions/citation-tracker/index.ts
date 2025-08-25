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
const getAnalysisPrompt = (posts, domain)=>{
  const jsonSchema = `{
      "citations": [
        {
          "source": "string (The subreddit, e.g., 'r/technology')",
          "url": "string (The full URL to the Reddit post)",
          "snippet": "string (A 1-2 sentence quote of the mention)",
          "date": "string (The ISO 8601 timestamp of the post)",
          "type": "reddit",
          "confidence_score": "number (0-100, confidence of a genuine citation)"
        }
      ]
    }`;
  return `You are an expert Data Extraction Bot. Analyze the provided Reddit posts to find genuine mentions of the domain "${domain}".

**Instructions:**
1. Read through each post and identify genuine mentions of the tracked domain.
2. For each genuine citation, extract the required information.
3. The 'url' should be the full Reddit URL (https://www.reddit.com + permalink).
4. If no relevant citations are found, return an empty "citations" array.

**Raw Reddit Search Results (JSON):**
---
${JSON.stringify(posts.slice(0, 25), null, 2)}
---

**CRITICAL: You MUST provide your response in a single, valid JSON object enclosed in a \`\`\`json markdown block.**
The JSON object must follow this exact schema:
\`\`\`json
${jsonSchema}
\`\`\`

Now, perform your expert data extraction.`;
};
// --- Main Service Handler ---
export const citationTrackerService = async (req, supabase)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  let runId = null;
  try {
    const { projectId, domain, keywords } = await req.json();
    if (!projectId || !domain || !keywords || keywords.length === 0) {
      throw new Error('`projectId`, `domain` and `keywords` are required.');
    }
    runId = await logToolRun(supabase, projectId, 'citation-tracker', {
      domain,
      keywords
    });
    const clientId = Deno.env.get('REDDIT_CLIENT_ID');
    const clientSecret = Deno.env.get('REDDIT_CLIENT_SECRET');
    const userAgent = Deno.env.get('REDDIT_USER_AGENT');
    if (!clientId || !clientSecret || !userAgent) {
      throw new Error('Reddit API credentials are not configured as secrets.');
    }
    // Get Reddit access token
    const tokenResponse = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        'User-Agent': userAgent
      },
      body: 'grant_type=client_credentials'
    });
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`Failed to get Reddit access token: ${tokenResponse.status} ${errorText}`);
    }
    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    // Search Reddit for domain mentions
    const searchQuery = `${domain} OR "${keywords.join('" OR "')}"`;
    const searchUrl = `https://oauth.reddit.com/search?q=${encodeURIComponent(searchQuery)}&sort=new&limit=50`;
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': userAgent
      }
    });
    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      throw new Error(`Reddit API search failed: ${searchResponse.status} ${errorText}`);
    }
    const searchData = await searchResponse.json();
    const posts = searchData.data?.children || [];
    if (posts.length === 0) {
      const emptyResult = {
        citations: []
      };
      await updateToolRun(supabase, runId, 'completed', emptyResult, null);
      return new Response(JSON.stringify({
        success: true,
        data: emptyResult,
        runId
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('Gemini API key not configured');
    }
    const prompt = getAnalysisPrompt(posts, domain);
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
    const finalData = JSON.parse(jsonMatch[1]);
    // Add metadata
    finalData.citations = finalData.citations.map((citation)=>({
        ...citation,
        analyzedAt: new Date().toISOString(),
        domain: domain
      }));
    if (runId) {
      await updateToolRun(supabase, runId, 'completed', finalData, null);
    }
    return new Response(JSON.stringify({
      success: true,
      data: finalData,
      runId
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
    console.error('Citation tracker error:', err);
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
  return await citationTrackerService(req, supabase);
});

