import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logToolRun, updateToolRun } from "shared/logging.ts";

// --- CORS Headers ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- Type Definitions ---
interface SummaryRequest {
    projectId: string;
    url: string;
    content?: string;
    summaryType: 'overview' | 'technical' | 'business' | 'audience';
}

// --- AI Prompt Engineering ---
const getSummaryPrompt = (request: SummaryRequest, pageContent: string): string => {
    const { url, summaryType } = request;

    const summaryPrompts = {
        overview: `Create a comprehensive overview summary of this website.`,
        technical: `Generate a technical summary focusing on the website's functionality, frameworks, and structure.`,
        business: `Create a business-focused summary highlighting services, products, and target market.`,
        audience: `Generate an audience-focused summary describing the ideal user or customer for this website.`
    };

    const jsonSchema = `{
        "summary": "string (The detailed, well-written summary based on the requested type)",
        "keyEntities": ["string (A list of key people, products, or company names mentioned)"],
        "mainTopics": ["string (A list of the main topics or themes covered)"]
    }`;

    return `You are a Website Analysis Expert. Your task is to generate a specific type of summary for the given URL and content.

    **Context:**
    - **URL:** ${url}
    - **Summary Type Requested:** ${summaryType}
    - **Content Snippet:**
      ---
      ${pageContent.substring(0, 8000)}
      ---

    **Instructions:**
    1.  Read the content and generate the requested summary type: ${summaryPrompts[summaryType]}
    2.  Extract the key entities and main topics from the content.
    3.  Ensure the summary is concise, accurate, and directly addresses the prompt.

    **CRITICAL: You MUST provide your response in a single, valid JSON object enclosed in a \`\`\`json markdown block.**
    The JSON object must follow this exact schema:
    \`\`\`json
    ${jsonSchema}
    \`\`\`

    Generate the site summary now.`;
};

// --- Main Service Handler ---
const llmSiteSummariesService = async (req: Request, supabase: SupabaseClient): Promise<Response> => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    let runId;
    try {
        const requestBody: SummaryRequest = await req.json();
        const { projectId, url, content, summaryType } = requestBody;

        if (!projectId || !url || !summaryType) {
          throw new Error('`projectId`, `url`, and `summaryType` are required.');
        }

        runId = await logToolRun(supabase, projectId, 'llm-site-summaries', { url, summaryType, contentLength: content?.length });

        let pageContent = content;
        if (url && !content) {
            console.log(`Fetching content from URL: ${url}`);
            const response = await fetch(url, { headers: { 'User-Agent': 'SEOGENIX Summary Bot 1.0' } });
            if (!response.ok) throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
            pageContent = await response.text();
        }
        if (!pageContent) throw new Error("Content is empty and could not be fetched.");

        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
        if (!geminiApiKey) throw new Error('Gemini API key not configured');

        const prompt = getSummaryPrompt(requestBody, pageContent);

        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.3, maxOutputTokens: 2048 }
            })
        });

        if (!geminiResponse.ok) {
            const errorBody = await geminiResponse.text();
            throw new Error(`The AI model failed to process the request. Status: ${geminiResponse.status}. Body: ${errorBody}`);
        }

        const geminiData = await geminiResponse.json();
        const responseText = geminiData.candidates[0].content.parts[0].text;

        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
        if (!jsonMatch || !jsonMatch[1]) {
            throw new Error('Failed to extract JSON from AI response.');
        }
        const summaryJson = JSON.parse(jsonMatch[1]);

        if (!summaryJson.summary || !summaryJson.keyEntities || !summaryJson.mainTopics) {
          throw new Error('Generated summary content missing required fields.');
        }

        const finalOutput = {
            ...summaryJson,
            url,
            summaryType,
            generatedAt: new Date().toISOString(),
        };

        await updateToolRun(supabase, runId, 'completed', finalOutput, null);

        return new Response(JSON.stringify({ success: true, data: { runId, ...finalOutput } }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
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
    return await llmSiteSummariesService(req, supabase);
});
