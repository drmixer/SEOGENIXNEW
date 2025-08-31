import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "node:crypto";
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
// --- AI Prompt ---
const getRelevancePrompt = (competitors, payload)=>{
  const jsonSchema = `{
      "competitors": [
        {
          "url": "string (The competitor's URL from the list)",
          "relevanceScore": "number (0-100, how relevant this competitor is)",
          "explanation": "string (A brief 1-sentence explanation of why)",
          "competitorType": "string (Enum: 'direct', 'indirect', 'aspirational', 'product')"
        }
      ]
    }`;
  return `You are an expert Market Analyst specializing in niche markets. Your task is to analyze a list of potential competitors and determine their true relevance to the user's business.

**User's Business Profile:**
- **Industry:** ${payload.industry}
- **Primary Topic/Service:** ${payload.topic || 'Not specified'}
- **Description:** ${payload.userDescription || 'Not specified'}

**List of Potential Competitors (from Google Search):**
${JSON.stringify(competitors.map((c)=>({
      title: c.title,
      link: c.link,
      snippet: c.snippet
    })), null, 2)}

**Analysis Instructions:**
1.  **Prioritize Niche Players:** Favor specialized businesses over large, general-purpose websites (like news sites or encyclopedias). A small, focused blog in the same niche is more relevant than a Forbes article.
2.  **Score Relevance (0-100):** For each competitor, assign a 'relevanceScore'. A score of 80+ indicates a direct competitor in the same niche. A score of 40-79 indicates an indirect or shoulder-niche competitor. Below 40 is likely irrelevant.
3.  **Classify Competitor Type:** Assign a 'competitorType' from the following:
    *   'direct': Offers very similar products/services to the same target audience.
    *   'indirect': Solves the same problem for the same audience but with a different solution.
    *   'aspirational': A major, well-known leader in the industry that the user might look up to.
    *   'product': A specific product that competes, rather than the entire company.
4.  **Provide a Concise Explanation:** Briefly explain your reasoning for the score and classification in one sentence.

**CRITICAL: Your response MUST be a single, valid JSON object enclosed in a \`\`\`json markdown block.**
The JSON object must follow this exact schema:
\`\`\`json
${jsonSchema}
\`\`\`

Analyze the list now, focusing on identifying true, niche competitors.`;
};
// --- Main Service Handler ---
export const competitorDiscoveryService = async (req, supabase)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  let runId = null;
  try {
    const payload = await req.json();
    const { industry, topic, existingCompetitors = [], projectId } = payload;
    if (!projectId) {
      throw new Error('`projectId` is required.');
    }
    if (!industry && !topic) {
      throw new Error('Either `industry` or `topic` is required.');
    }
    runId = await logToolRun(supabase, projectId, 'competitor-discovery', payload);
    const googleApiKey = Deno.env.get('GOOGLE_SEARCH_API_KEY');
    const googleCx = Deno.env.get('GOOGLE_SEARCH_ENGINE_ID');
    const mozAccessId = Deno.env.get('MOZ_ACCESS_ID');
    const mozSecretKey = Deno.env.get('MOZ_SECRET_KEY');
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!googleApiKey || !googleCx || !mozAccessId || !mozSecretKey || !geminiApiKey) {
      throw new Error('Required API keys are not configured as secrets.');
    }
    // Refine search query for more niche results
    const searchQuery = `"${industry || ''}" "${topic || ''}" niche competitors OR alternatives`;
    const googleUrl = `https://www.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${googleCx}&q=${encodeURIComponent(searchQuery)}`;
    const googleResponse = await fetch(googleUrl);
    if (!googleResponse.ok) {
      const errorText = await googleResponse.text();
      throw new Error(`Google Search API failed: ${googleResponse.status} ${errorText}`);
    }
    const searchResults = await googleResponse.json();

    // Filter out irrelevant/broad domains and existing competitors
    const blocklist = [
      'wikipedia.org', 'forbes.com', 'investopedia.com', 'bloomberg.com', 'businessinsider.com',
      'techcrunch.com', 'medium.com', 'youtube.com', 'facebook.com', 'twitter.com', 'linkedin.com',
      'quora.com', 'reddit.com', 'pinterest.com', 'amazon.com', 'ebay.com', 'appsumo.com', 'g2.com', 'capterra.com'
    ];
    const potentialCompetitors = searchResults.items?.filter(item => {
      if (!item.link) return false;
      const domain = new URL(item.link).hostname.replace('www.', '');
      if (blocklist.includes(domain)) return false;
      if (existingCompetitors.some(existing => domain.includes(new URL(existing).hostname.replace('www.','')))) return false;
      return true;
    }).slice(0, 15) || [];
    if (potentialCompetitors.length === 0) {
      const emptyResult = {
        competitorSuggestions: []
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
    // Analyze relevance with AI
    const relevancePrompt = getRelevancePrompt(potentialCompetitors, payload);
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
                text: relevancePrompt
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
    const relevanceAnalysis = JSON.parse(jsonMatch[1]);
    const relevanceMap = new Map(relevanceAnalysis.competitors.map((c)=>[
        c.url,
        c
      ]));
    // Get SEO metrics for relevant competitors
    const competitors = [];
    for (const competitor of potentialCompetitors){
      try {
        const url = competitor.link;
        const relevanceInfo = relevanceMap.get(url);
        if (!relevanceInfo || relevanceInfo.relevanceScore < 45) continue; // tighten relevance threshold
        const domain = new URL(url).hostname;
        // Get Moz domain authority
        const expires = Math.floor(Date.now() / 1000) + 300;
        const sig = createHmac('sha1', mozSecretKey).update(`${mozAccessId}\n${expires}`).digest('base64');
        const mozUrl = `https://lsapi.seomoz.com/v2/url_metrics?cols=4&url=${encodeURIComponent(domain)}&AccessID=${mozAccessId}&Expires=${expires}&Signature=${encodeURIComponent(sig)}`;
        let domainAuthority = null;
        try {
          const mozResponse = await fetch(mozUrl);
          if (mozResponse.ok) {
            const mozData = await mozResponse.json();
            domainAuthority = mozData?.domain_authority || null;
          }
        } catch (mozError) {
          console.warn(`Failed to get Moz data for ${domain}:`, mozError);
        }
        // Adjust score to prefer niche players: penalize very high DA unless aspirational
        let adjustedScore = relevanceInfo.relevanceScore;
        const type = (relevanceInfo.competitorType || 'direct') as string;
        if (typeof domainAuthority === 'number' && domainAuthority >= 80 && type !== 'aspirational') {
          adjustedScore = Math.max(0, adjustedScore - 20);
        }
        competitors.push({
          name: competitor.title || domain,
          url: url,
          domainAuthority: domainAuthority,
          relevanceScore: adjustedScore,
          explanation: relevanceInfo.explanation,
          type: type,
          analyzedAt: new Date().toISOString()
        });
      } catch (e) {
        console.error(`Failed to process competitor URL ${competitor.link}:`, e);
      }
    }
    // Sort by relevance score and limit results
    competitors.sort((a, b)=>b.relevanceScore - a.relevanceScore);
    const output = {
      competitorSuggestions: competitors.slice(0, 10)
    };
    await updateToolRun(supabase, runId, 'completed', output, null);
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
    console.error('Competitor discovery error:', err);
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
  return await competitorDiscoveryService(req, supabase);
});
