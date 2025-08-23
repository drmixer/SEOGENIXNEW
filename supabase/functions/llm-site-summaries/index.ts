import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logToolRun, updateToolRun } from "../_shared/logging.ts";

// --- CORS Headers ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
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
        "mainTopics": ["string (A list of the main topics or themes covered)"],
        "suggestedNextStep": "string (Based on the summary, suggest a single, actionable next step for the user, such as 'Run a schema-generator' or 'Analyze competitors')"
    }`;

    return `You are a Website Analysis Expert. Your task is to generate a specific type of summary for the given URL and content.

    **Context:**
    - **URL:** ${url}
    - **Summary Type Requested:** ${summaryType}
    - **Content Snippet:**
      ---
      ${pageContent.substring(0, 12000)}
      ---

    **Instructions:**
    1.  Read the content and generate the requested summary type: ${summaryPrompts[summaryType]}
    2.  Extract the key entities and main topics from the content.
    3.  Based on your summary, provide a single, actionable 'suggestedNextStep'.
    4.  Ensure the summary is concise, accurate, and directly addresses the prompt.

    **CRITICAL: You MUST provide your response in a single, valid JSON object enclosed in a \`\`\`json markdown block.**
    The JSON object must follow this exact schema:
    \`\`\`json
    ${jsonSchema}
    \`\`\`

    Generate the site summary now.`;
};

// --- Fallback Generator ---
function generateFallbackOutput(request: SummaryRequest, message: string): any {
    return {
        summary: `Could not generate a ${request.summaryType} summary for ${request.url}: ${message}`,
        keyEntities: [],
        mainTopics: [],
        suggestedNextStep: "Run a full AI Visibility Audit to diagnose potential issues.",
        note: `Summary generation failed: ${message}`
    };
}

// --- Main Service Handler ---
const llmSiteSummariesService = async (req: Request, supabase: SupabaseClient): Promise<Response> => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    let runId: string | null = null;
    let requestBody: SummaryRequest;
    try {
        requestBody = await req.json();
        const { projectId, url, content, summaryType } = requestBody;

        if (!projectId || !url || !summaryType) {
          throw new Error('`projectId`, `url`, and `summaryType` are required.');
        }

        runId = await logToolRun(supabase, projectId, 'llm-site-summaries', { url, summaryType, hasContent: !!content });

        let pageContent = content;
        if (!pageContent) {
            try {
                const response = await fetch(url, { headers: { 'User-Agent': 'SEOGENIX-Bot/1.0' } });
                if (!response.ok) throw new Error(`Failed to fetch URL: ${response.statusText}`);
                pageContent = await response.text();
            } catch (e) {
                throw new Error(`Failed to fetch content from ${url}. Error: ${e.message}`);
            }
        }

        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
        if (!geminiApiKey) throw new Error('GEMINI_API_KEY is not configured.');

        const prompt = getSummaryPrompt(requestBody, pageContent);

        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.3, maxOutputTokens: 4096 }
            })
        });

        if (!geminiResponse.ok) throw new Error(`Gemini API failed: ${await geminiResponse.text()}`);

        const geminiData = await geminiResponse.json();
        const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!responseText) throw new Error("No response text from Gemini.");

        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
        if (!jsonMatch || !jsonMatch[1]) throw new Error('Could not extract JSON from AI response.');

        const summaryJson = JSON.parse(jsonMatch[1]);
        if (!summaryJson.summary || !summaryJson.keyEntities || !summaryJson.mainTopics) {
          throw new Error('Generated summary content missing required fields.');
        }

        const output = { ...summaryJson, url, summaryType, generatedAt: new Date().toISOString() };
        await updateToolRun(supabase, runId, 'completed', output, null);

        return new Response(JSON.stringify({ success: true, data: output, runId }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        console.error("LLM Site Summaries Error:", errorMessage);

        if (runId) {
            const fallbackOutput = generateFallbackOutput(requestBody, errorMessage);
            await updateToolRun(supabase, runId, 'error', fallbackOutput, errorMessage);
            return new Response(JSON.stringify({ success: true, data: { ...fallbackOutput, runId } }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
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
    return await llmSiteSummariesService(req, supabase);
});
