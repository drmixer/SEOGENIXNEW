import { createHmac } from "node:crypto";

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
}

interface Competitor {
    name: string;
    url: string;
    domainAuthority: number | null;
    relevanceScore: number;
}

// --- Main Service Handler ---
export const competitorDiscoveryService = async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { industry, topic, existingCompetitors = [] }: DiscoveryRequest = await req.json();

        if (!industry && !topic) {
            throw new Error('Either `industry` or `topic` is required.');
        }

        // 1. Get API Keys from environment
        const googleApiKey = Deno.env.get('GOOGLE_SEARCH_API_KEY');
        const googleCx = Deno.env.get('GOOGLE_SEARCH_ENGINE_ID');
        const mozAccessId = Deno.env.get('MOZ_ACCESS_ID');
        const mozSecretKey = Deno.env.get('MOZ_SECRET_KEY');

        if (!googleApiKey || !googleCx || !mozAccessId || !mozSecretKey) {
            throw new Error('Required API keys (Google Search, Moz) are not configured as secrets.');
        }

        // 2. Perform Google Search to find potential competitors
        const searchQuery = `top ${industry || ''} ${topic || ''} companies`;
        const googleUrl = `https://www.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${googleCx}&q=${encodeURIComponent(searchQuery)}`;

        const googleResponse = await fetch(googleUrl);
        if (!googleResponse.ok) {
            throw new Error(`Google Search API request failed: ${googleResponse.statusText}`);
        }
        const searchResults = await googleResponse.json();

        const competitorUrls = searchResults.items
            ?.map((item: any) => item.link)
            .filter((url: string) => url && !existingCompetitors.some(existing => url.includes(existing)))
            .slice(0, 10) || []; // Limit to top 10 results to avoid excessive Moz API calls

        // 3. Enrich with Moz Domain Authority
        // Note: The free Moz API has strict rate limits. In a real app, this might need batching or queuing.
        const competitors: Competitor[] = [];
        for (const url of competitorUrls) {
            try {
                const domain = new URL(url).hostname;
                const expires = Math.floor(Date.now() / 1000) + 300;
                // Correct signature generation for Moz API using Node.js crypto compatibility
                const sig = createHmac('sha1', mozSecretKey).update(`${mozAccessId}\n${expires}`).digest('base64');
                const mozUrl = `https://lsapi.seomoz.com/v2/url_metrics?Cols=4&url=${domain}&AccessID=${mozAccessId}&Expires=${expires}&Signature=${sig}`;

                const mozResponse = await fetch(mozUrl);
                let domainAuthority = null;
                if (mozResponse.ok) {
                    const mozData = await mozResponse.json();
                    domainAuthority = mozData?.domain_authority || null;
                }

                competitors.push({
                    name: searchResults.items.find((item: any) => item.link === url)?.title || domain,
                    url: url,
                    domainAuthority: domainAuthority,
                    relevanceScore: Math.floor(Math.random() * 20) + 75, // Placeholder relevance
                });

            } catch (e: unknown) {
                const errorMessage = e instanceof Error ? e.message : String(e);
                console.error(`Failed to process competitor URL ${url}:`, errorMessage);
            }
        }

        return new Response(JSON.stringify({ success: true, data: { competitorSuggestions: competitors } }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        const errorCode = err instanceof Error ? err.name : 'UNKNOWN_ERROR';
        return new Response(JSON.stringify({ success: false, error: { message: errorMessage, code: errorCode } }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
};

// --- Server ---
Deno.serve(competitorDiscoveryService);
