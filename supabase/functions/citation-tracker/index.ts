import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logToolRun, updateToolRun } from 'shared/logging.ts';

// --- CORS Headers ---
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// --- Type Definitions ---
interface CitationRequest {
    projectId: string;
    domain: string;
    keywords: string[];
    sources: ('reddit' | 'google_news')[];
}

interface RawSearchResult {
    source: string;
    url: string;
    title: string;
    snippet: string;
    date_utc: number;
}

// --- AI Prompt Engineering ---
const getAnalysisPrompt = (results: RawSearchResult[], domain: string): string => {
    const jsonSchema = `{
      "citations": [{
          "source": "string (The platform where the mention was found, e.g., 'Reddit')",
          "url": "string (The full URL to the mention)",
          "title": "string (The title of the article or post)",
          "snippet": "string (A 1-2 sentence quote of the specific mention)",
          "date": "string (The ISO 8601 timestamp of the post)",
          "sentiment": "string ('positive' | 'negative' | 'neutral')",
          "citationType": "string ('review' | 'link' | 'discussion' | 'passing_mention')",
          "confidenceScore": "number (0-100, your confidence that this is a genuine, relevant citation)"
      }]
    }`;

    return `You are an expert Brand Analyst. Your task is to analyze a list of search results and identify genuine citations or mentions of the domain "${domain}".

    **Analysis Instructions:**
    1.  **Filter for Relevance:** Scrutinize each result. Is it a real mention or just a coincidental keyword match? Discard irrelevant results.
    2.  **Extract Key Information:** For each genuine citation, extract the required data fields.
    3.  **Analyze Sentiment:** Determine the sentiment of the mention (positive, negative, or neutral).
    4.  **Categorize Citation Type:** Classify the type of mention (e.g., is it a product review, a simple link, a discussion, or just a passing mention?).
    5.  **Assign Confidence:** Provide a confidence score (0-100) based on how relevant and direct the citation is.
    6.  If no relevant citations are found, return an empty "citations" array.

    **Raw Search Results (JSON):**
    ---
    ${JSON.stringify(results.slice(0, 50), null, 2)}
    ---

    **CRITICAL: You MUST provide your response in a single, valid JSON object enclosed in a \`\`\`json markdown block.**
    The JSON object must follow this exact schema:
    \`\`\`json
    ${jsonSchema}
    \`\`\`
    Now, perform your expert analysis and data extraction.`;
};

// --- Data Fetching ---
async function searchReddit(domain: string, keywords: string[], userAgent: string): Promise<RawSearchResult[]> {
    const clientId = Deno.env.get('REDDIT_CLIENT_ID');
    const clientSecret = Deno.env.get('REDDIT_CLIENT_SECRET');
    if (!clientId || !clientSecret) throw new Error('Reddit API credentials are not configured.');

    const tokenResponse = await fetch('https://www.reddit.com/api/v1/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`, 'User-Agent': userAgent },
        body: 'grant_type=client_credentials',
    });
    if (!tokenResponse.ok) throw new Error(`Failed to get Reddit token: ${await tokenResponse.text()}`);
    const { access_token } = await tokenResponse.json();

    const searchQuery = `${domain} OR "${keywords.join('" OR "')}"`;
    const searchUrl = `https://oauth.reddit.com/search?q=${encodeURIComponent(searchQuery)}&sort=new&limit=50`;
    const response = await fetch(searchUrl, { headers: { 'Authorization': `Bearer ${access_token}`, 'User-Agent': userAgent } });
    if (!response.ok) throw new Error(`Reddit API search failed: ${await response.text()}`);
    const searchData = await response.json();

    return (searchData.data.children || []).map((post: any) => ({
        source: `Reddit (${post.data.subreddit_name_prefixed})`,
        url: `https://www.reddit.com${post.data.permalink}`,
        title: post.data.title,
        snippet: post.data.selftext.substring(0, 500),
        date_utc: post.data.created_utc,
    }));
}

// --- Main Service Handler ---
const citationTrackerService = async (req: Request, supabase: SupabaseClient): Promise<Response> => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    let runId: string | null = null;
    try {
        const requestBody: CitationRequest = await req.json();
        const { projectId, domain, keywords, sources } = requestBody;

        if (!projectId || !domain || !keywords || keywords.length === 0 || !sources || sources.length === 0) {
            throw new Error('`projectId`, `domain`, `keywords`, and `sources` are required.');
        }

        runId = await logToolRun(supabase, projectId, 'citation-tracker', requestBody);

        const userAgent = Deno.env.get('REDDIT_USER_AGENT') || 'SEOGENIX-Bot/1.0';

        let allResults: RawSearchResult[] = [];
        if (sources.includes('reddit')) {
            try {
                const redditResults = await searchReddit(domain, keywords, userAgent);
                allResults = allResults.concat(redditResults);
            } catch (e) {
                console.error("Reddit search failed:", e.message); // Log and continue
            }
        }
        // Future sources like 'google_news' would be added here.

        if (allResults.length === 0) {
            const output = { citations: [], note: "No potential mentions found in the selected sources." };
            await updateToolRun(supabase, runId, 'completed', output, null);
            return new Response(JSON.stringify({ success: true, data: output }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
        if (!geminiApiKey) throw new Error('GEMINI_API_KEY is not configured.');

        const prompt = getAnalysisPrompt(allResults, domain);
        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.2, maxOutputTokens: 8192 }
            })
        });

        if (!geminiResponse.ok) throw new Error(`Gemini API failed: ${await geminiResponse.text()}`);

        const geminiData = await geminiResponse.json();
        const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!responseText) throw new Error("No response text from Gemini.");

        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
        if (!jsonMatch || !jsonMatch[1]) throw new Error('Could not extract JSON from AI response.');

        const finalData = JSON.parse(jsonMatch[1]);
        finalData.citations.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

        await updateToolRun(supabase, runId, 'completed', finalData, null);

        return new Response(JSON.stringify({ success: true, data: finalData, runId }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        console.error("Citation Tracker Error:", errorMessage);
        if (runId) {
            await updateToolRun(supabase, runId, 'error', { citations: [], note: `An error occurred: ${errorMessage}` }, errorMessage);
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
    return await citationTrackerService(req, supabase);
});
