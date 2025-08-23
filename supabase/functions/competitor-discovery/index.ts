import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.224.0/node/crypto.ts";
import { logToolRun, updateToolRun } from "shared/logging.ts";

// --- CORS Headers ---
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// --- Type Definitions ---
interface DiscoveryRequest {
    industry: string;
    topic?: string;
    existingCompetitors?: string[];
    userDescription?: string;
    projectId: string;
}

// --- AI Prompt ---
const getRelevancePrompt = (competitors: any[], payload: DiscoveryRequest): string => {
    const jsonSchema = `{
      "competitors": [{
          "url": "string (The competitor's URL from the list)",
          "relevanceScore": "number (0-100, how relevant this competitor is based on the user's details)",
          "explanation": "string (A brief 1-sentence explanation for the score)",
          "reasoning": "string (Detailed reasoning explaining *why* this is a competitor, e.g., 'targets the same primary keywords for organic search' or 'offers a similar product to the same target audience')"
      }]
    }`;
    return `You are an expert Market Analyst. Your task is to analyze a list of potential competitors and determine their relevance to a user's business.

    **User Profile:**
    - **Industry:** ${payload.industry}
    - **Specific Topic/Niche:** ${payload.topic || 'Not specified'}
    - **User's Own Description:** ${payload.userDescription || 'Not specified'}

    **Potential Competitors (from Google Search):**
    ${JSON.stringify(competitors.map(c => ({ title: c.title, link: c.link, snippet: c.snippet })), null, 2)}

    **Analysis Instructions:**
    1.  Carefully review the user's profile.
    2.  For each potential competitor, evaluate how closely they compete with the user.
    3.  Assign a 'relevanceScore' from 0 (not relevant) to 100 (direct and major competitor).
    4.  Provide a concise 'explanation' for your score.
    5.  Provide detailed 'reasoning'. This is the most important part. Explain *why* they are a competitor. What signals are you using? (e.g., keyword overlap, similar products, same target audience, etc.).

    **CRITICAL: You MUST provide your response in a single, valid JSON object enclosed in a \`\`\`json markdown block.**
    The JSON object must follow this exact schema:
    \`\`\`json
    ${jsonSchema}
    \`\`\`
    If a competitor is not relevant, assign a low score and explain why. Perform your analysis now.`;
};

// --- Fallback Data Generator ---
function generateFallbackCompetitors(potentialCompetitors: any[]): any {
    console.warn("Generating fallback competitor data due to an AI analysis failure.");
    return {
        competitorSuggestions: potentialCompetitors.map(c => ({
            name: c.title || new URL(c.link).hostname,
            url: c.link,
            domainAuthority: null, // No Moz data in fallback
            relevanceScore: 50, // Assign a neutral score
            explanation: "Could not be analyzed by AI. Please review manually.",
            reasoning: "AI analysis failed. This suggestion is based on Google Search results for your industry/topic.",
            fallback: true
        })).slice(0, 10),
        note: "AI analysis failed. The following suggestions are based on initial search results and have not been vetted for relevance."
    };
}

// --- Main Service Handler ---
const competitorDiscoveryService = async (req: Request, supabase: SupabaseClient): Promise<Response> => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    let runId: string | null = null;
    try {
        const payload: DiscoveryRequest = await req.json();
        const { industry, topic, existingCompetitors = [], projectId } = payload;

        if (!projectId || (!industry && !topic)) {
            throw new Error('`projectId` and either `industry` or `topic` are required.');
        }

        runId = await logToolRun(supabase, projectId, 'competitor-discovery', payload);

        // --- API Key and Configuration ---
        const googleApiKey = Deno.env.get('GOOGLE_SEARCH_API_KEY');
        const googleCx = Deno.env.get('GOOGLE_SEARCH_ENGINE_ID');
        const mozAccessId = Deno.env.get('MOZ_ACCESS_ID');
        const mozSecretKey = Deno.env.get('MOZ_SECRET_KEY');
        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

        if (!googleApiKey || !googleCx || !mozAccessId || !mozSecretKey || !geminiApiKey) {
            throw new Error('Required API keys (Google, Moz, Gemini) are not configured as secrets.');
        }

        // --- Step 1: Find Potential Competitors via Google Search ---
        const searchQuery = `top companies in ${industry || ''} for ${topic || ''}`;
        const googleUrl = `https://www.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${googleCx}&q=${encodeURIComponent(searchQuery)}`;

        const googleResponse = await fetch(googleUrl);
        if (!googleResponse.ok) {
            console.error("Google Search API error:", await googleResponse.text());
            throw new Error(`Google Search API failed with status: ${googleResponse.status}`);
        }
        const searchResults = await googleResponse.json();

        const potentialCompetitors = searchResults.items
            ?.filter((item: any) => item.link && !existingCompetitors.some(existing => item.link.includes(existing)))
            .slice(0, 15) || [];

        if (potentialCompetitors.length === 0) {
            const output = { competitorSuggestions: [], note: "No potential competitors found for the given criteria." };
            await updateToolRun(supabase, runId, 'completed', output, null);
            return new Response(JSON.stringify({ success: true, data: output }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // --- Step 2: AI-Powered Relevance Analysis (with Fallback) ---
        let relevanceMap = new Map();
        try {
            const relevancePrompt = getRelevancePrompt(potentialCompetitors, payload);
            const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${geminiApiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: relevancePrompt }] }],
                    generationConfig: { temperature: 0.2, maxOutputTokens: 8192 }
                })
            });

            if (!geminiResponse.ok) throw new Error(`Gemini API responded with status ${geminiResponse.status}`);

            const geminiData = await geminiResponse.json();
            const responseText = geminiData.candidates[0].content.parts[0].text;
            const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
            if (!jsonMatch || !jsonMatch[1]) throw new Error('Failed to extract JSON from AI response.');

            const relevanceAnalysis = JSON.parse(jsonMatch[1]);
            relevanceMap = new Map(relevanceAnalysis.competitors.map((c: any) => [c.url, c]));

        } catch (aiError) {
            console.error("AI relevance analysis failed:", aiError.message);
            // On failure, use the fallback. It returns the complete final output.
            const fallbackOutput = generateFallbackCompetitors(potentialCompetitors);
            await updateToolRun(supabase, runId, 'completed', fallbackOutput, "AI analysis failed, used fallback data.");
            return new Response(JSON.stringify({ success: true, data: fallbackOutput }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // --- Step 3: Enrich Data with Moz API and Consolidate ---
        const competitors = [];
        for (const competitor of potentialCompetitors) {
            const url = competitor.link;
            const relevanceInfo = relevanceMap.get(url);
            if (!relevanceInfo || relevanceInfo.relevanceScore < 30) continue; // Filter out irrelevant results

            let domainAuthority = null;
            try {
                const domain = new URL(url).hostname;
                const expires = Math.floor(Date.now() / 1000) + 300;
                const sig = createHmac('sha1', mozSecretKey).update(`${mozAccessId}\n${expires}`).digest('base64');
                const mozUrl = `https://lsapi.seomoz.com/v2/url_metrics?cols=4&url=${encodeURIComponent(domain)}&AccessID=${mozAccessId}&Expires=${expires}&Signature=${sig}`;

                const mozResponse = await fetch(mozUrl);
                if (mozResponse.ok) {
                    const mozData = await mozResponse.json();
                    domainAuthority = mozData?.domain_authority || null;
                }
            } catch (mozError) {
                console.error(`Failed to fetch Moz data for ${url}:`, mozError.message);
            }

            competitors.push({
                name: competitor.title || new URL(url).hostname,
                url: url,
                domainAuthority: domainAuthority,
                relevanceScore: relevanceInfo.relevanceScore,
                explanation: relevanceInfo.explanation,
                reasoning: relevanceInfo.reasoning,
            });
        }

        competitors.sort((a, b) => b.relevanceScore - a.relevanceScore);
        const output = { competitorSuggestions: competitors.slice(0, 10) };

        await updateToolRun(supabase, runId, 'completed', output, null);

        return new Response(JSON.stringify({ success: true, data: output, runId }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        console.error("Main handler error:", errorMessage);
        if (runId) {
            await updateToolRun(supabase, runId, 'error', null, errorMessage);
        }
        return new Response(JSON.stringify({ success: false, error: { message: errorMessage }, runId }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
};

// --- Server ---
Deno.serve(async (req) => {
    const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    return await competitorDiscoveryService(req, supabase);
});
