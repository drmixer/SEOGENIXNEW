import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- CORS Headers ---
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- Type Definitions ---
interface CitationRequest {
    domain: string;
    keywords: string[];
    projectId: string; // projectId is required for logging
}

interface Citation {
    source: string;
    url: string;
    snippet: string;
    date: string;
    type: 'reddit';
    confidence_score: number;
}

interface RedditPost {
    kind: string;
    data: {
        title: string;
        selftext: string;
        url: string;
        permalink: string;
        created_utc: number;
        subreddit_name_prefixed: string;
    };
}

// --- Database Logging Helpers ---
async function logToolRun(supabase: SupabaseClient, projectId: string, toolName: string, inputPayload: object) {
  if (!projectId) {
    throw new Error("logToolRun error: projectId is required.");
  }
  const { data, error } = await supabase
    .from("tool_runs")
    .insert({
      project_id: projectId,
      tool_name: toolName,
      input_payload: inputPayload,
      status: "running",
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error logging tool run:", error);
    throw new Error(`Failed to log tool run. Supabase error: ${error.message}`);
  }
  if (!data || !data.id) {
    console.error("No data or data.id returned from tool_runs insert.");
    throw new Error("Failed to log tool run: No data returned after insert.");
  }
  return data.id;
}

async function updateToolRun(supabase: SupabaseClient, runId: string, status: string, outputPayload: object | null, errorMessage: string | null) {
  if (!runId) {
    console.error("updateToolRun error: runId is required.");
    return;
  }
  const update = {
    status,
    completed_at: new Date().toISOString(),
    output_payload: errorMessage ? { error: errorMessage } : outputPayload || null,
    error_message: errorMessage || null,
  };
  const { error } = await supabase.from("tool_runs").update(update).eq("id", runId);
  if (error) {
    console.error(`Error updating tool run ID ${runId}:`, error);
  }
}

// --- AI Prompt Engineering ---
const getAnalysisPrompt = (posts: RedditPost[], domain: string): string => {
    const jsonSchema = `
    {
      "citations": [
        {
          "source": "string (The subreddit where the mention occurred, e.g., 'r/technology')",
          "url": "string (The full URL to the Reddit comment or post)",
          "snippet": "string (A 1-2 sentence quote of the most relevant part of the mention)",
          "date": "string (The ISO 8601 timestamp of the post)",
          "type": "string (Should always be 'reddit')",
          "confidence_score": "number (0-100, your confidence that this is a genuine and relevant citation)"
        }
      ]
    }
    `;

    return `
    You are an expert Data Extraction Bot. Your task is to analyze a list of Reddit posts and extract genuine citations or mentions of a specific brand or domain.
    **Analysis Task:**
    - **Domain to track:** ${domain}
    - **Raw Reddit Search Results (JSON):**
      ---
      ${JSON.stringify(posts.slice(0, 25), null, 2)}
      ---
    **Your Instructions:**
    1.  Read through each post.
    2.  Identify posts that contain a genuine mention or citation of the tracked domain. Ignore passing mentions or irrelevant results.
    3.  For each genuine citation, extract the required information.
    4.  The 'snippet' should be the most relevant sentence from the post's title or body.
    5.  The 'url' should be the full Reddit URL (https://www.reddit.com + permalink).
    **Output Format:**
    You MUST provide a response in a single, valid JSON object. Do not include any text or formatting outside of the JSON object. The JSON object must strictly adhere to the following schema:
    \`\`\`json
    ${jsonSchema}
    \`\`\`
    Now, perform your expert data extraction.
    `;
};

// --- Main Service Handler ---
export const citationTrackerService = async (req: Request, supabase: SupabaseClient): Promise<Response> => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    let runId: string | null = null;
    try {
        const { projectId, domain, keywords }: CitationRequest = await req.json();

        if (!domain || !keywords || keywords.length === 0) {
            throw new Error('`domain` and `keywords` are required.');
        }

        runId = await logToolRun(supabase, projectId, 'citation-tracker', { domain, keywords });

        const clientId = Deno.env.get('REDDIT_CLIENT_ID');
        const clientSecret = Deno.env.get('REDDIT_CLIENT_SECRET');
        const userAgent = Deno.env.get('REDDIT_USER_AGENT');
        if (!clientId || !clientSecret || !userAgent) {
            throw new Error('Reddit API credentials are not configured as secrets.');
        }

        const tokenResponse = await fetch('https://www.reddit.com/api/v1/access_token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
                'User-Agent': userAgent,
            },
            body: 'grant_type=client_credentials',
        });
        if (!tokenResponse.ok) throw new Error(`Failed to get Reddit access token: ${tokenResponse.statusText}`);
        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        const searchQuery = `${domain} OR ${keywords.join(' OR ')}`;
        const searchUrl = `https://oauth.reddit.com/search?q=${encodeURIComponent(searchQuery)}&sort=new&limit=50`;
        const searchResponse = await fetch(searchUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}`, 'User-Agent': userAgent }
        });
        if (!searchResponse.ok) throw new Error(`Reddit API search failed: ${searchResponse.statusText}`);
        const searchData = await searchResponse.json();
        const posts: RedditPost[] = searchData.data.children;

        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
        if (!geminiApiKey) throw new Error('Gemini API key not configured');

        const prompt = getAnalysisPrompt(posts, domain);
        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { response_mime_type: "application/json", temperature: 0.2, maxOutputTokens: 4096 }
            })
        });
        if (!geminiResponse.ok) throw new Error(`The AI model failed to process the request. Status: ${geminiResponse.status}`);

        const geminiData = await geminiResponse.json();
        const finalData: { citations: Citation[] } = JSON.parse(geminiData.candidates[0].content.parts[0].text);

        if (runId) {
            await updateToolRun(supabase, runId, 'completed', finalData, null);
        }

        return new Response(JSON.stringify({ success: true, data: finalData }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        if (runId) {
            await updateToolRun(supabase, runId, 'error', null, errorMessage);
        }
        return new Response(JSON.stringify({ success: false, error: { message: errorMessage } }), {
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
