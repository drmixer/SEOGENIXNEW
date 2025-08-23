import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logToolRun, updateToolRun } from '../_shared/logging.ts';

// --- CORS Headers ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// --- Type Definitions ---
interface AnalysisRequest {
    projectId: string;
    primaryUrl: string;
    competitorUrls: string[];
    industry?: string;
}

interface SiteData {
    url: string;
    content: string;
    error?: string;
}

// --- AI Prompt Engineering ---
const getComparativeAnalysisPrompt = (primarySite: SiteData, competitors: SiteData[], industry?: string) => {
    const jsonSchema = `{
      "primarySiteAnalysis": {
        "url": "string",
        "overallScore": "number (0-100)",
        "strengths": ["string (2-3 key strengths)"],
        "weaknesses": ["string (2-3 key weaknesses)"]
      },
      "competitorAnalyses": [
        {
          "url": "string",
          "overallScore": "number (0-100)",
          "strengths": ["string (1-2 key strengths)"],
          "weaknesses": ["string (1-2 key weaknesses)"]
        }
      ],
      "competitiveLandscape": {
        "primaryAdvantage": "string (The single biggest advantage the primary site has over its competitors)",
        "primaryDisadvantage": "string (The single biggest disadvantage or gap the primary site has)",
        "strategySummary": "string (A 2-3 sentence summary of a high-level strategy for the primary site to win)"
      }
    }`;

    return `You are a master Competitive SEO Strategist. Your task is to perform a comprehensive competitive analysis comparing a primary website against its competitors.

    **Analysis Context:**
    - **Industry:** ${industry || 'General Web'}
    - **Primary Site (Our User):** ${primarySite.url}
    - **Competitors:** ${competitors.map(c => c.url).join(', ')}

    **Content to Analyze:**
    ---
    **Primary Site Content (${primarySite.url}):**
    ${primarySite.content.substring(0, 6000)}
    ---
    ${competitors.map(c => `
    **Competitor Content (${c.url}):**
    ${c.content.substring(0, 6000)}
    ---
    `).join('')}

    **Analysis Instructions:**
    1.  **Analyze Each Site:** Individually assess the primary site and each competitor for their overall SEO and AI visibility. Assign an 'overallScore' (0-100) and identify key strengths and weaknesses.
    2.  **Perform Comparative Analysis:** This is the most important step. Directly compare the primary site to the competitors.
    3.  **Identify Key Differentiators:** Determine the 'primaryAdvantage' (where the user's site is strongest) and the 'primaryDisadvantage' (where it's weakest).
    4.  **Formulate a Strategy:** Provide a concise, high-level 'strategySummary' outlining how the primary site can leverage its advantages and close the gaps to outperform the competition.

    **CRITICAL: You MUST provide your response in a single, valid JSON object enclosed in a \`\`\`json markdown block.**
    The JSON object must follow this exact schema:
    \`\`\`json
    ${jsonSchema}
    \`\`\`
    Perform your expert competitive analysis now.`;
};

// --- Helper for fetching content ---
async function fetchSiteContent(url: string): Promise<SiteData> {
    try {
        const response = await fetch(url, { headers: { 'User-Agent': 'SEOGENIX-AnalysisBot/1.0' }, signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error(`HTTP status ${response.status}`);
        const content = await response.text();
        return { url, content };
    } catch (e) {
        console.error(`Failed to fetch ${url}:`, e.message);
        return { url, content: '', error: `Failed to fetch content: ${e.message}` };
    }
}

// --- Main Service Handler ---
const competitiveAnalysisService = async (req: Request, supabase: SupabaseClient): Promise<Response> => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    let runId: string | null = null;
    try {
        const requestBody: AnalysisRequest = await req.json();
        const { projectId, primaryUrl, competitorUrls, industry } = requestBody;

        if (!projectId || !primaryUrl || !competitorUrls?.length) {
          throw new Error('`projectId`, `primaryUrl`, and at least one `competitorUrls` are required.');
        }

        runId = await logToolRun(supabase, projectId, 'competitive-analysis', { primaryUrl, competitorUrls, industry });

        // Step 1: Fetch content from all sites in parallel
        const allUrls = [primaryUrl, ...competitorUrls];
        const siteDataPromises = allUrls.map(fetchSiteContent);
        const allSiteData = await Promise.all(siteDataPromises);

        const primarySiteData = allSiteData.find(d => d.url === primaryUrl)!;
        const competitorSiteData = allSiteData.filter(d => d.url !== primaryUrl);

        const successfullyFetchedSites = allSiteData.filter(d => !d.error);
        if (successfullyFetchedSites.length < 2) {
             throw new Error('Could not fetch content for at least two sites. Please check the URLs.');
        }

        // Step 2: Perform single, comprehensive AI analysis
        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
        if (!geminiApiKey) throw new Error('GEMINI_API_KEY is not configured.');

        const prompt = getComparativeAnalysisPrompt(primarySiteData, competitorSiteData, industry);

        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.4, maxOutputTokens: 8192 }
            })
        });

        if (!geminiResponse.ok) throw new Error(`Gemini API failed: ${await geminiResponse.text()}`);

        const geminiData = await geminiResponse.json();
        const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!responseText) throw new Error("No response text from Gemini.");

        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
        if (!jsonMatch || !jsonMatch[1]) throw new Error('Could not extract JSON from AI response.');

        const analysisResult = JSON.parse(jsonMatch[1]);

        // Add metadata about fetch errors for transparency
        const fetchErrors = allSiteData.filter(d => d.error).map(d => ({ url: d.url, error: d.error }));
        const output = { ...analysisResult, fetchErrors };

        await updateToolRun(supabase, runId, 'completed', output, null);

        return new Response(JSON.stringify({ success: true, data: output, runId }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        console.error("Competitive Analysis Error:", errorMessage);
        if (runId) {
            await updateToolRun(supabase, runId, 'error', { note: errorMessage }, errorMessage);
        }
        return new Response(JSON.stringify({ success: false, error: { message: errorMessage }, runId }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
}

// --- Server ---
Deno.serve(async (req) => {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    return await competitiveAnalysisService(req, supabase);
});
