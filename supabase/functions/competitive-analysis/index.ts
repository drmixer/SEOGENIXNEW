import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logToolRun, updateToolRun } from "shared/logging.ts";

// --- CORS Headers ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- Helper for URL analysis ---
const getAnalysisPrompt = (url: string, content: string, industry?: string) => {
    const jsonSchema = `{
        "overallScore": "number (0-100, overall AI visibility score)",
        "subscores": {
            "aiUnderstanding": "number (0-100)",
            "citationLikelihood": "number (0-100)",
            "conversationalReadiness": "number (0-100)",
            "contentStructure": "number (0-100)"
        },
        "strengths": ["string (2-3 key strengths)"],
        "weaknesses": ["string (2-3 key weaknesses)"],
        "opportunities": ["string (2-3 actionable opportunities)"]
    }`;
    return `You are a Competitive SEO Analyst. Analyze the following website content for its AI visibility and SEO performance.
    - **URL:** ${url}
    - **Industry Context:** ${industry || 'Not provided'}
    - **Content Snippet:** ${content.substring(0, 8000)}

    **Instructions:**
    1.  Score the site from 0-100 on the four sub-metrics.
    2.  Calculate an overall score.
    3.  Provide brief, bulleted lists for strengths, weaknesses, and opportunities.

    **CRITICAL: You MUST provide your response in a single, valid JSON object enclosed in a \`\`\`json markdown block.**
    The JSON object must follow this exact schema:
    \`\`\`json
    ${jsonSchema}
    \`\`\`
    Analyze the site now.`;
};

const analyzeUrl = async (url: string, industry: string | undefined, apiKey: string) => {
    console.log(`Analyzing URL: ${url}`);
    let content = '';
    try {
        const response = await fetch(url, { headers: { 'User-Agent': 'SEOGENIX Analysis Bot 1.0' } });
        if (response.ok) content = await response.text();
    } catch (fetchError) {
        console.error(`Failed to fetch content for ${url}:`, fetchError.message);
    }

    const prompt = getAnalysisPrompt(url, content, industry);
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 2048 }
        })
    });

    if (!geminiResponse.ok) {
        const errorBody = await geminiResponse.text();
        // Throw an error with details to be caught by Promise.allSettled
        throw new Error(`Analysis failed for ${url}. Status: ${geminiResponse.status}. Body: ${errorBody}`);
    }

    const geminiData = await geminiResponse.json();
    const responseText = geminiData.candidates[0].content.parts[0].text;
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
    if (!jsonMatch || !jsonMatch[1]) {
        throw new Error(`Failed to extract JSON from AI response for ${url}.`);
    }
    const analysisResult = JSON.parse(jsonMatch[1]);

    return {
        url,
        name: new URL(url).hostname,
        ...analysisResult
    };
};

// --- Main Service Handler ---
const competitiveAnalysisService = async (req: Request, supabase: SupabaseClient): Promise<Response> => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    let runId: string | null = null;
    try {
        const { projectId, primaryUrl, competitorUrls, industry } = await req.json();

        if (!projectId || !primaryUrl || !competitorUrls?.length) {
          throw new Error('`projectId`, `primaryUrl`, and `competitorUrls` are required.');
        }

        runId = await logToolRun(supabase, projectId, 'competitive-analysis', { primaryUrl, competitorUrls, industry });

        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
        if (!geminiApiKey) throw new Error('Gemini API key not configured');

        const allUrls = [primaryUrl, ...competitorUrls];
        const analysisPromises = allUrls.map(url => analyzeUrl(url, industry, geminiApiKey));

        const results = await Promise.allSettled(analysisPromises);

        const successfulAnalyses: any[] = [];
        results.forEach(r => {
            if (r.status === 'fulfilled') {
                successfulAnalyses.push(r.value);
            } else {
                console.error('An analysis failed:', r.reason);
            }
        });

        if (successfulAnalyses.length === 0) {
            throw new Error('All URL analyses failed. Please check the URLs and try again.');
        }

        const primarySiteAnalysis = successfulAnalyses.find(a => a.url === primaryUrl);
        const competitors = successfulAnalyses.filter(a => a.url !== primaryUrl);

        const averageCompetitorScore = competitors.length > 0
            ? Math.round(competitors.reduce((sum, c) => sum + c.overallScore, 0) / competitors.length)
            : 0;

        const summary = {
            primarySiteScore: primarySiteAnalysis?.overallScore || 0,
            averageCompetitorScore,
            totalSitesAnalyzed: successfulAnalyses.length,
            failedSites: allUrls.length - successfulAnalyses.length,
        };

        const output = { primarySiteAnalysis, competitorAnalyses: competitors, summary };

        await updateToolRun(supabase, runId, 'completed', output, null);

        return new Response(JSON.stringify({ success: true, data: { runId, ...output } }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        if (runId) {
            await updateToolRun(supabase, runId, 'error', null, errorMessage);
        }
        return new Response(JSON.stringify({ success: false, error: { message: errorMessage } }), {
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
