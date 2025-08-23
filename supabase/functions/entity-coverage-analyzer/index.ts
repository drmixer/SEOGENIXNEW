import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logToolRun, updateToolRun } from 'shared/logging.ts';

// --- CORS Headers ---
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// --- Type Definitions ---
interface EntityRequest {
    projectId: string;
    url?: string;
    content?: string;
    industry?: string;
}

// --- AI Prompt Engineering ---
const getEntityAnalysisPrompt = (content: string, industry?: string): string => {
    const jsonSchema = `{
      "coverageScore": "number (0-100, how well the content covers the essential entities for its topic)",
      "strategicSummary": "string (A 2-3 sentence summary explaining how improving entity coverage will boost the content's authority and SEO performance)",
      "mentionedEntities": [
        {
          "name": "string (The name of the entity mentioned)",
          "type": "string ('Person' | 'Organization' | 'Concept' | 'Product' | 'Location')",
          "relevance": "number (1-100, how relevant this entity is to the core topic)",
          "description": "string (A brief description of the entity)"
        }
      ],
      "missingEntities": [
        {
          "name": "string (The name of an important entity MISSING from the text)",
          "type": "string ('Person' | 'Organization' | 'Concept' | 'Product' | 'Location')",
          "importance": "string ('High' | 'Medium' | 'Low')",
          "reasoning": "string (A brief explanation of why this entity is important to include for topical authority)"
        }
      ]
    }`;

    return `
    You are an Expert SEO and Topical Authority Analyst. Your task is to analyze a piece of content to identify key entities it mentions and, more importantly, crucial entities that are missing. An 'entity' is a specific, well-known person, organization, place, event, or concept, often with a corresponding Wikipedia entry.

    **Analysis Task:**
    - **Content to Analyze (first 15,000 characters):**
      ---
      ${content.substring(0, 15000)}
      ---
    - **Industry Context:** ${industry || 'General'}

    **Instructions:**
    1.  **Identify Mentioned Entities:** Read the content and identify all key entities that are currently mentioned.
    2.  **Identify Missing Entities:** Based on the topic, identify important, relevant entities that are MISSING. This is the most critical part of your analysis. Focus on entities that would build topical authority.
    3.  **Score and Summarize:** Provide an overall 'coverageScore' (0-100) and a 'strategicSummary' explaining why improving entity coverage is important for this content.
    4.  **Provide Structured Lists:** Populate the 'mentionedEntities' and 'missingEntities' arrays with the required details.

    **CRITICAL: You MUST provide your response in a single, valid JSON object enclosed in a \`\`\`json markdown block.**
    The JSON object must strictly adhere to the following schema:
    \`\`\`json
    ${jsonSchema}
    \`\`\`

    Now, perform your expert entity analysis.
    `;
};

// --- Fallback Generator ---
function generateFallbackOutput(message: string): any {
    return {
        coverageScore: 0,
        strategicSummary: "Analysis failed. Could not generate insights.",
        mentionedEntities: [],
        missingEntities: [],
        note: `Entity analysis failed: ${message}`
    };
}

// --- Main Service Handler ---
const entityAnalyzerService = async (req: Request, supabase: SupabaseClient): Promise<Response> => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    let runId: string | null = null;
    let requestBody: EntityRequest;
    try {
        requestBody = await req.json();
        const { projectId, url, content, industry } = requestBody;

        if (!projectId || (!url && !content)) {
            throw new Error('`projectId` and either `url` or `content` are required.');
        }

        runId = await logToolRun(supabase, projectId, 'entity-coverage-analyzer', { url, industry, hasContent: !!content });

        let pageContent = content;
        if (url && !content) {
            try {
                const response = await fetch(url, { headers: { 'User-Agent': 'SEOGENIX-Bot/1.0' } });
                if (!response.ok) throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
                pageContent = await response.text();
            } catch (e) {
                // If fetch fails, we can't proceed without content.
                 throw new Error(`Failed to fetch content from ${url}. Error: ${e.message}`);
            }
        }

        if (!pageContent || pageContent.trim() === '') {
            throw new Error('Content is empty and could not be fetched or provided.');
        }

        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
        if (!geminiApiKey) throw new Error('GEMINI_API_KEY is not configured.');

        const prompt = getEntityAnalysisPrompt(pageContent, industry);

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

        const analysisJson = JSON.parse(jsonMatch[1]);
        if (!analysisJson.coverageScore || !analysisJson.mentionedEntities || !analysisJson.missingEntities) {
            throw new Error('Generated entity analysis is missing required fields.');
        }

        await updateToolRun(supabase, runId, 'completed', analysisJson, null);

        return new Response(JSON.stringify({ success: true, data: analysisJson, runId }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        console.error("Entity Analyzer Error:", errorMessage);

        if (runId) {
            const fallbackOutput = generateFallbackOutput(errorMessage);
            await updateToolRun(supabase, runId, 'error', fallbackOutput, errorMessage);
            return new Response(JSON.stringify({ success: true, data: fallbackOutput, runId }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
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
    return await entityAnalyzerService(req, supabase);
});
