import { createHmac } from "https://deno.land/std@0.224.0/crypto/hmac.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CompetitorDiscoveryPayload {
    industry: string;
    topic?: string;
    existingCompetitors?: string[];
    userDescription?: string;
}

interface Competitor {
    name: string;
    url: string;
    domainAuthority: number | null;
    relevanceScore: number;
    explanation: string;
}

const getRelevancePrompt = (competitors: any[], payload: CompetitorDiscoveryPayload): string => {
    const jsonSchema = `
    {
      "competitors": [
        {
          "url": "string (The competitor's URL)",
          "relevanceScore": "number (0-100, how relevant this competitor is based on the user's request)",
          "explanation": "string (A brief 1-sentence explanation of why this competitor is relevant)"
        }
      ]
    }
    `;

    return `
    You are an expert Market Analyst Bot. Your task is to analyze a list of potential competitors and determine their relevance to the user's business.

    **Analysis Task:**
    - **User's Industry:** ${payload.industry}
    - **User's Topic:** ${payload.topic || 'Not specified'}
    - **User's Description:** ${payload.userDescription || 'Not specified'}
    - **Potential Competitors (from Google Search):**
      ---
      ${JSON.stringify(competitors.map(c => ({ title: c.title, link: c.link, snippet: c.snippet })), null, 2)}
      ---

    **Your Instructions:**
    1.  Review the user's details and the list of potential competitors.
    2.  For each competitor, assign a 'relevanceScore' from 0 to 100.
    3.  Provide a brief 'explanation' for your score.

    **Output Format:**
    You MUST provide a response in a single, valid JSON object. Do not include any text or formatting outside of the JSON object. The JSON object must strictly adhere to the following schema:
    \`\`\`json
    ${jsonSchema}
    \`\`\`

    Now, perform your expert market analysis.
    `;
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const payload: CompetitorDiscoveryPayload = await req.json();
        const { industry, topic, existingCompetitors = [] } = payload;

        if (!industry && !topic) {
            throw new Error('Either `industry` or `topic` is required.');
        }

        const googleApiKey = Deno.env.get('GOOGLE_SEARCH_API_KEY');
        const googleCx = Deno.env.get('GOOGLE_SEARCH_ENGINE_ID');
        const mozAccessId = Deno.env.get('MOZ_ACCESS_ID');
        const mozSecretKey = Deno.env.get('MOZ_SECRET_KEY');
        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

        if (!googleApiKey || !googleCx || !mozAccessId || !mozSecretKey || !geminiApiKey) {
            throw new Error('Required API keys are not configured as secrets.');
        }

        const searchQuery = `top ${industry || ''} ${topic || ''} companies`;
        const googleUrl = `https://www.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${googleCx}&q=${encodeURIComponent(searchQuery)}`;

        const googleResponse = await fetch(googleUrl);
        if (!googleResponse.ok) throw new Error(`Google Search API failed: ${googleResponse.statusText}`);
        const searchResults = await googleResponse.json();

        const potentialCompetitors = searchResults.items
            ?.filter((item: any) => item.link && !existingCompetitors.some(existing => item.link.includes(existing)))
            .slice(0, 15) || [];

        const relevancePrompt = getRelevancePrompt(potentialCompetitors, payload);
        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: relevancePrompt }] }],
                generationConfig: { response_mime_type: "application/json", temperature: 0.3, maxOutputTokens: 4096 }
            })
        });

        if (!geminiResponse.ok) throw new Error(`The AI model failed to process the request. Status: ${geminiResponse.status}`);
        const geminiData = await geminiResponse.json();
        const relevanceAnalysis = JSON.parse(geminiData.candidates[0].content.parts[0].text);
        const relevanceMap = new Map(relevanceAnalysis.competitors.map(c => [c.url, c]));

        const competitors: Competitor[] = [];
        for (const competitor of potentialCompetitors) {
            try {
                const url = competitor.link;
                const domain = new URL(url).hostname;
                const expires = Math.floor(Date.now() / 1000) + 300;
                const sig = createHmac('sha1', mozSecretKey).update(`${mozAccessId}\n${expires}`).digest('base64');
                const mozUrl = `https://lsapi.seomoz.com/v2/url_metrics?cols=4&url=${encodeURIComponent(domain)}&AccessID=${mozAccessId}&Expires=${expires}&Signature=${sig}`;

                const mozResponse = await fetch(mozUrl);
                let domainAuthority = null;
                if (mozResponse.ok) {
                    const mozData = await mozResponse.json();
                    domainAuthority = mozData?.domain_authority || null;
                }

                const relevanceInfo = relevanceMap.get(url);
                if (relevanceInfo) {
                    competitors.push({
                        name: competitor.title || domain,
                        url: url,
                        domainAuthority: domainAuthority,
                        relevanceScore: relevanceInfo.relevanceScore,
                        explanation: relevanceInfo.explanation,
                    });
                }
            } catch (e) {
                console.error(`Failed to process competitor URL ${competitor.link}:`, e.message);
            }
        }

        // Sort by relevance score
        competitors.sort((a, b) => b.relevanceScore - a.relevanceScore);

        return new Response(JSON.stringify({ success: true, data: { competitorSuggestions: competitors.slice(0, 10) } }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err) {
        return new Response(JSON.stringify({ success: false, error: { message: err.message } }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
