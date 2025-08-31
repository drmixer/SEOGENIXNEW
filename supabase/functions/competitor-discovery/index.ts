import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "node:crypto";
import { getDomain } from "https://esm.sh/tldts@6";
import { ok, fail } from "../_shared/response.ts";
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
          "url": "string (Homepage URL from the provided list; keep exactly as given)",
          "relevanceScore": "number (0-100, how relevant this competitor is)",
          "explanation": "string (A brief 1-sentence explanation of why)",
          "competitorType": "string (Enum: 'direct', 'indirect', 'aspirational', 'product')"
        }
      ]
    }`;
  return `You are an expert Market Analyst specializing in niche markets. Your task is to analyze a list of potential competitors and determine their true relevance to the user's business. Only consider each company's primary homepage URL.

**User's Business Profile:**
- **Industry:** ${payload.industry}
- **Primary Topic/Service:** ${payload.topic || 'Not specified'}
- **Description:** ${payload.userDescription || payload.businessDescription || 'Not specified'}
${payload.siteUrl ? `- **User Site:** ${payload.siteUrl}` : ''}
${payload.options?.hintKeywords && payload.options.hintKeywords.length ? `- **Hint Keywords:** ${payload.options.hintKeywords.join(', ')}` : ''}

**List of Potential Competitors (deduped by domain, homepage URLs):**
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
5.  Only return entries that match the homepages provided in the list. Do not invent new URLs.

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
  // Lightweight router for managing allow/block rules
  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    if ((req.method === 'GET' && action === 'rules') || (req.method === 'POST' && action === 'add_rule') || (req.method === 'DELETE' && action === 'delete_rule')) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) return new Response(JSON.stringify({ success: false, error: { message: 'Auth required' } }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      if (!user) return new Response(JSON.stringify({ success: false, error: { message: 'Invalid token' } }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (req.method === 'GET') {
        const projectId = url.searchParams.get('projectId') as string;
        if (!projectId) return new Response(JSON.stringify({ success: false, error: { message: 'projectId required' } }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        const { data, error } = await supabase
          .from('project_domain_rules')
          .select('*')
          .eq('project_id', projectId)
          .eq('created_by', user.id)
          .order('created_at', { ascending: false });
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, data: { rules: data || [] } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (req.method === 'POST') {
        const body = await req.json();
        const { projectId, type, pattern, reason } = body || {};
        if (!projectId || (type !== 'allow' && type !== 'block') || !pattern) {
          return new Response(JSON.stringify({ success: false, error: { message: 'projectId, type, pattern required' } }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const { data, error } = await supabase
          .from('project_domain_rules')
          .insert({ project_id: projectId, type, pattern, reason, created_by: user.id })
          .select()
          .single();
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, data: { rule: data } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (req.method === 'DELETE') {
        const body = await req.json().catch(() => ({}));
        const { id, projectId } = body || {};
        if (!id || !projectId) return new Response(JSON.stringify({ success: false, error: { message: 'id and projectId required' } }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        const { error } = await supabase
          .from('project_domain_rules')
          .delete()
          .eq('id', id)
          .eq('created_by', user.id)
          .eq('project_id', projectId);
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, data: { id } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }
  } catch (e) {
    // fallthrough to main handler
  }
  let runId = null;
  try {
    const payload = await req.json();
    const { industry, topic, existingCompetitors = [], projectId, options } = payload;
    // Normalize common fields received from UI
    const siteUrl: string | undefined = payload.url || payload.siteUrl;
    const userDescription: string | undefined = payload.businessDescription || payload.userDescription;
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
    // Build search query: prefer related:domain if siteUrl provided; otherwise a niche-focused query
    let searchQuery: string;
    const userRoot = (() => {
      try {
        if (!siteUrl) return undefined;
        const host = new URL(siteUrl).hostname.replace(/^www\./, '');
        return getDomain(host) || host;
      } catch {
        return undefined;
      }
    })();
    if (userRoot) {
      // related: often returns company homepages similar to the root domain
      searchQuery = `related:${userRoot}`;
    } else {
      const parts = [industry || '', topic || ''].filter(Boolean).join(' ');
      searchQuery = `${parts} competitors OR alternatives`;
    }
    const googleUrl = `https://www.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${googleCx}&q=${encodeURIComponent(searchQuery)}`;
    const googleResponse = await fetch(googleUrl);
    if (!googleResponse.ok) {
      const errorText = await googleResponse.text();
      throw new Error(`Google Search API failed: ${googleResponse.status} ${errorText}`);
    }
    const searchResults = await googleResponse.json();

    // Track filtered items for explainability
    const rejected: Array<{ url?: string; root?: string; reason: string }> = [];

    // Filter out irrelevant/broad domains and existing competitors; dedupe to root domains
    const blocklist = [
      'wikipedia.org','forbes.com','investopedia.com','bloomberg.com','businessinsider.com',
      'techcrunch.com','medium.com','youtube.com','facebook.com','twitter.com','linkedin.com',
      'quora.com','reddit.com','pinterest.com','amazon.com','ebay.com','appsumo.com','g2.com','capterra.com',
      'crunchbase.com','similarweb.com','semrush.com','ahrefs.com','builtwith.com','trustpilot.com',
      'yelp.com','yellowpages.com','glassdoor.com','indeed.com','getapp.com','pcmag.com','theverge.com',
      'news.ycombinator.com','producthunt.com','openai.com','google.com'
    ].concat(Array.isArray(options?.blocklist) ? options.blocklist.map((d)=>String(d).replace(/^www\./,'').toLowerCase()) : []);

    const existingRoots = new Set<string>();
    for (const e of Array.isArray(existingCompetitors) ? existingCompetitors : []) {
      try {
        const host = new URL(e).hostname.replace(/^www\./,'');
        existingRoots.add((getDomain(host) || host).toLowerCase());
      } catch {}
    }

    const domainMap = new Map<string, { title: string; link: string; snippet?: string }>();
    for (const item of searchResults.items || []) {
      try {
        if (!item.link) continue;
        const url = new URL(item.link);
        const host = url.hostname.replace(/^www\./,'');
        const root = (getDomain(host) || host).toLowerCase();
        if (!root) continue;
        if (blocklist.includes(root)) { rejected.push({ url: item.link, root, reason: 'blocked_domain' }); continue; }
        if (userRoot && root === userRoot) { rejected.push({ url: item.link, root, reason: 'self_domain' }); continue; }
        if (existingRoots.has(root)) { rejected.push({ url: item.link, root, reason: 'already_tracked' }); continue; }
        // Avoid common non-homepage subdomains by normalizing to root homepage URL
        const homepage = `https://${root}`;
        if (!domainMap.has(root)) {
          // Prefer the first encountered title; fallback to root
          domainMap.set(root, { title: item.title || root, link: homepage, snippet: item.snippet });
        }
      } catch (_) {
        continue;
      }
    }
    // Load project-level allow/block rules (if any)
    let allowRules: Array<{ pattern: string }> = [];
    let blockRules: Array<{ pattern: string }> = [];
    try {
      const { data: rulesData } = await supabase
        .from('project_domain_rules')
        .select('type,pattern')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      (rulesData || []).forEach((r: any) => {
        if (r?.type === 'allow') allowRules.push({ pattern: String(r.pattern) });
        else if (r?.type === 'block') blockRules.push({ pattern: String(r.pattern) });
      });
    } catch {}
    const matchesRule = (root: string, pattern: string) => {
      const p = String(pattern || '').toLowerCase();
      if (!p) return false;
      const r = String(root || '').toLowerCase();
      return r === p || r.endsWith(p) || r.includes(p);
    };
    // Apply allow/block rules to candidate domains before model scoring
    const prelim = Array.from(domainMap.entries()).filter(([root, v]) => {
      if (blockRules.some(br => matchesRule(root, br.pattern))) {
        rejected.push({ url: v.link, root, reason: 'blocked_by_rule' });
        return false;
      }
      if (allowRules.length > 0 && !allowRules.some(ar => matchesRule(root, ar.pattern))) {
        rejected.push({ url: v.link, root, reason: 'not_in_allow_list' });
        return false;
      }
      return true;
    }).map(([, v]) => v);

    const potentialCompetitors = prelim.slice(0, 20);
    if (potentialCompetitors.length === 0) {
      const emptyResult = { competitorSuggestions: [] };
      await updateToolRun(supabase, runId, 'completed', emptyResult, null);
      return new Response(JSON.stringify(ok(emptyResult, { runId })), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Analyze relevance with AI
    const augmentedPayload = { ...payload, siteUrl, userDescription };
    const relevancePrompt = getRelevancePrompt(potentialCompetitors, augmentedPayload);
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
    let relevanceAnalysis: any;
    if (jsonMatch && jsonMatch[1]) {
      relevanceAnalysis = JSON.parse(jsonMatch[1]);
    } else {
      // Fallback: try parsing as raw JSON
      try {
        relevanceAnalysis = JSON.parse(responseText);
      } catch {
        throw new Error('Failed to extract JSON from AI response.');
      }
    }
    const relevanceMap = new Map(relevanceAnalysis.competitors.map((c)=>[ c.url, c ]));
    // Get SEO metrics for relevant competitors
    const competitors = [];
    const preferNiche = options?.preferNiche === true;
    for (const competitor of potentialCompetitors){
      try {
        // Ensure we only use the homepage URL (already normalized)
        const url = competitor.link;
        const relevanceInfo = relevanceMap.get(url);
        const minScore = preferNiche ? 60 : 45;
        if (!relevanceInfo) { rejected.push({ url, root: new URL(url).hostname.replace(/^www\./,''), reason: 'no_relevance_match' }); continue; }
        if (relevanceInfo.relevanceScore < minScore) { rejected.push({ url, root: new URL(url).hostname.replace(/^www\./,''), reason: 'below_threshold' }); continue; } // threshold based on mode
        const domain = new URL(url).hostname.replace(/^www\./,'');
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
        if (typeof domainAuthority === 'number' && domainAuthority >= (preferNiche ? 70 : 80) && type !== 'aspirational') {
          adjustedScore = Math.max(0, adjustedScore - (preferNiche ? 30 : 20));
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
    // Summarize rejections
    const rejectedSummary = rejected.reduce((acc: Record<string, number>, r) => {
      acc[r.reason] = (acc[r.reason] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const output = {
      competitorSuggestions: competitors.slice(0, 10),
      rejectedSummary,
      rejectedSamples: rejected.slice(0, 20)
    };
    await updateToolRun(supabase, runId, 'completed', output, null);
    return new Response(JSON.stringify(ok(output, { runId })), {
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
    return new Response(JSON.stringify(fail(errorMessage, 'SERVER_ERROR', { runId })), {
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
