// --- CORS Headers ---
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// --- Type Definitions ---
interface EntityRequest {
    url?: string;
    content?: string;
    industry?: string;
}

interface Entity {
    name: string;
    type: string;
    relevance: number;
    importance: 'high' | 'medium' | 'low';
    description: string;
}

interface EntityAnalysisResponse {
    coverageScore: number;
    mentionedEntities: Entity[];
    missingEntities: Entity[];
}

// --- AI Prompt Engineering ---
const getEntityAnalysisPrompt = (content: string, industry?: string): string => {
    const jsonSchema = `
    {
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
    }
    `;

    return `
    You are an Expert SEO and Topical Authority Analyst. Your task is to analyze a piece of content and identify the key entities it mentions, as well as crucial entities that are missing.

    **Analysis Task:**
    - **Content to Analyze:**
      ---
      ${content.substring(0, 15000)}
      ---
    - **Industry Context:** ${industry || 'General'}

    **Your Instructions:**
    1.  Read the content and identify all key entities (people, organizations, products, concepts) that are mentioned.
    2.  Based on the topic and industry, identify important, relevant entities that are MISSING from the content.
    3.  Estimate an overall "Entity Coverage Score" from 0-100.
    4.  Provide a structured list of both mentioned and missing entities with the required details.

    **Output Format:**
    You MUST provide a response in a single, valid JSON object. Do not include any text or formatting outside of the JSON object. The JSON object must strictly adhere to the following schema:
    \`\`\`json
    ${jsonSchema}
    \`\`\`

    Now, perform your expert entity analysis.
    `;
};

// --- Main Service Handler ---
export const entityAnalyzerService = async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { url, content, industry }: EntityRequest = await req.json();

        let pageContent = content;
        if (url && !content) {
            const response = await fetch(url, { headers: { 'User-Agent': 'SEOGENIX Entity Analyzer Bot 1.0' } });
            if (!response.ok) {
                throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
            }
            pageContent = await response.text();
        }

        if (!pageContent) {
            throw new Error('Content or URL is required for analysis.');
        }

        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
        if (!geminiApiKey) throw new Error('Gemini API key not configured');

        const prompt = getEntityAnalysisPrompt(pageContent, industry);

        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    response_mime_type: "application/json",
                    temperature: 0.4,
                    maxOutputTokens: 4096,
                }
            })
        });

        if (!geminiResponse.ok) {
            throw new Error(`The AI model failed to process the request. Status: ${geminiResponse.status}`);
        }

        const geminiData = await geminiResponse.json();
        const analysisJson: EntityAnalysisResponse = JSON.parse(geminiData.candidates[0].content.parts[0].text);

        return new Response(JSON.stringify({ success: true, data: analysisJson }), {
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
Deno.serve(entityAnalyzerService);
