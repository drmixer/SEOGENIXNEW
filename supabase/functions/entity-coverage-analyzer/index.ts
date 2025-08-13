import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logToolRun, updateToolRun } from "../_shared/logging.ts";

// --- CORS Headers ---
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- Type Definitions ---
interface EntityRequest {
    url?: string;
    content?: string;
    industry?: string;
    projectId: string;
}

// --- AI Prompt Engineering ---
const getEntityAnalysisPrompt = (content: string, industry?: string): string => {
    const jsonSchema = `{
      "coverageScore": "number (0-100, an estimated score of how well the content covers the essential entities for its topic)",
      "mentionedEntities": [
        {
          "name": "string (The name of the entity mentioned in the text)",
          "type": "string (e.g., 'Person', 'Organization', 'Concept', 'Product')",
          "relevance": "number (1-100, how relevant this entity is to the core topic)",
          "importance": "string (enum: 'high', 'medium', 'low')",
          "description": "string (A brief description of the entity)"
        }
      ],
      "missingEntities": [
        {
          "name": "string (The name of an important entity that is MISSING from the text)",
          "type": "string (e.g., 'Person', 'Organization', 'Concept', 'Product')",
          "relevance": "number (1-100, how relevant this entity is to the core topic)",
          "importance": "string (enum: 'high', 'medium', 'low')",
          "description": "string (A brief description of why this entity is important to include)"
        }
      ]
    }`;

    return `
    You are an Expert SEO and Topical Authority Analyst. Your task is to analyze a piece of content and identify the key entities it mentions, as well as crucial entities that are missing.

    **Analysis Task:**
    - **Content to Analyze:**
      ---
      ${content.substring(0, 15000)}
      ---
    - **Industry Context:** ${industry || 'General'}

    **Instructions:**
    1.  Read the content and identify all key entities (people, organizations, products, concepts) that are mentioned.
    2.  Based on the topic and industry, identify important, relevant entities that are MISSING from the content.
    3.  Estimate an overall "Entity Coverage Score" from 0-100.
    4.  Provide a structured list of both mentioned and missing entities with the required details.

    **CRITICAL: You MUST provide your response in a single, valid JSON object enclosed in a \`\`\`json markdown block.**
    The JSON object must strictly adhere to the following schema:
    \`\`\`json
    ${jsonSchema}
    \`\`\`

    Now, perform your expert entity analysis.
    `;
};

// --- Main Service Handler ---
export const entityAnalyzerService = async (req: Request, supabase: SupabaseClient): Promise<Response> => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    let runId;
    try {
        const { url, content, industry, projectId }: EntityRequest = await req.json();

        if (!projectId || (!url && !content)) {
            throw new Error('`projectId` and either `url` or `content` are required.');
        }

        runId = await logToolRun(supabase, projectId, 'entity-coverage-analyzer', { url, industry, hasContent: !!content });

        let pageContent = content;
        if (url && !content) {
            const response = await fetch(url, { headers: { 'User-Agent': 'SEOGENIX Entity Analyzer Bot 1.0' } });
            if (!response.ok) {
                throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
            }
            pageContent = await response.text();
        }

        if (!pageContent) {
            throw new Error('Content is empty and could not be fetched.');
        }

        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
        if (!geminiApiKey) throw new Error('Gemini API key not configured');

        const prompt = getEntityAnalysisPrompt(pageContent, industry);

        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.4,
                    maxOutputTokens: 4096,
                }
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
        const analysisJson = JSON.parse(jsonMatch[1]);

        if (!analysisJson.coverageScore || !analysisJson.mentionedEntities || !analysisJson.missingEntities) {
            throw new Error('Generated entity analysis is missing required fields.');
        }

        await updateToolRun(supabase, runId, 'completed', analysisJson, null);

        return new Response(JSON.stringify({ success: true, data: analysisJson }), {
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
    return await entityAnalyzerService(req, supabase);
});
