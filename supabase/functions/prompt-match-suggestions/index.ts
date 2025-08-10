// --- CORS Headers ---
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// --- Type Definitions ---
interface SuggestionRequest {
    topic: string;
    industry?: string;
    targetAudience?: string;
    contentType?: string;
    userIntent?: 'informational' | 'commercial' | 'transactional' | 'navigational';
}

interface PromptSuggestion {
    prompt: string;
    category: string;
    intent: string;
}

// --- AI Prompt Engineering ---
const getSuggestionPrompt = (request: SuggestionRequest): string => {
    const { topic, industry, targetAudience, contentType, userIntent } = request;
    const jsonSchema = `
    {
      "promptSuggestions": [
        {
          "prompt": "string (The suggested search query or content title)",
          "category": "string (A high-level category, e.g., 'How-To Guides', 'Comparison', 'Beginner Questions')",
          "intent": "string (The likely user intent, e.g., 'informational', 'commercial')"
        }
      ]
    }
    `;

    return `
    You are an Expert SEO Strategist and Content Ideator. Your task is to brainstorm a diverse list of search queries and content ideas that an AI user (like someone using Google SGE or Perplexity) would find highly relevant.

    **Content Idea Details:**
    - **Core Topic:** ${topic}
    - **Industry:** ${industry || 'General'}
    - **Target Audience:** ${targetAudience || 'General'}
    - **Desired Content Type:** ${contentType || 'Any'}
    - **Primary User Intent:** ${userIntent || 'Any'}

    **Your Instructions:**
    Generate a list of 10 creative and relevant prompt suggestions based on the details provided. The suggestions should cover a range of categories and intents to provide a comprehensive content strategy.

    **Output Format:**
    You MUST provide a response in a single, valid JSON object. Do not include any text or formatting outside of the JSON object. The JSON object must strictly adhere to the following schema:
    \`\`\`json
    ${jsonSchema}
    \`\`\`

    Now, perform your expert brainstorming.
    `;
};

// --- Main Service Handler ---
export const suggestionService = async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const requestBody: SuggestionRequest = await req.json();

        if (!requestBody.topic || requestBody.topic.trim().length === 0) {
            throw new Error('`topic` is a required field.');
        }

        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
        if (!geminiApiKey) throw new Error('Gemini API key not configured');

        const prompt = getSuggestionPrompt(requestBody);

        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    response_mime_type: "application/json",
                    temperature: 0.8, // Higher temperature for more creative brainstorming
                    maxOutputTokens: 2048,
                }
            })
        });

        if (!geminiResponse.ok) {
            throw new Error(`The AI model failed to process the request. Status: ${geminiResponse.status}`);
        }

        const geminiData = await geminiResponse.json();
        const suggestionsJson: { promptSuggestions: PromptSuggestion[] } = JSON.parse(geminiData.candidates[0].content.parts[0].text);

        return new Response(JSON.stringify({ success: true, data: suggestionsJson }), {
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
Deno.serve(suggestionService);
