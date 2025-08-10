// --- CORS Headers ---
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// --- Type Definitions ---
interface ContentRequest {
    contentType: 'faq' | 'meta-tags' | 'snippets' | 'headings' | 'article-section';
    topic: string;
    targetKeywords: string[];
    tone?: 'professional' | 'casual' | 'technical' | 'friendly';
    entitiesToInclude?: string[]; // New field for entity integration
}

interface GeneratedContent {
    // This will vary based on contentType, can be refined with more specific types
    [key: string]: any;
}

// --- AI Prompt Engineering ---
const getContentGenerationPrompt = (request: ContentRequest): string => {
    const { contentType, topic, targetKeywords, tone, entitiesToInclude } = request;

    const baseInstructions = {
        'faq': 'Generate a comprehensive FAQ section. Create questions that people commonly ask and provide clear, concise answers.',
        'meta-tags': 'Generate optimized meta tags (title, description, keywords).',
        'snippets': 'Create a featured snippet-optimized content piece (e.g., a definition, a short list, or a step-by-step guide).',
        'headings': 'Generate a comprehensive and logical heading structure (H1, H2s, H3s).',
        'article-section': 'Write a detailed and engaging section for an article.'
    };

    const jsonSchema = `
    {
      "generatedTitle": "string (A suitable title for the generated content)",
      "generatedContent": "string (The main body of the generated content, in markdown format.)",
      "supportingDetails": {
        "wordCount": "number",
        "keywordsUsed": ["string"]
      }
    }
    `;

    // Add specific instructions if entities are provided
    const entityInstruction = entitiesToInclude && entitiesToInclude.length > 0
        ? `**Crucially, you must naturally integrate the following entities into the content:** ${entitiesToInclude.join(', ')}.`
        : '';

    return `
    You are an Expert Content Strategist and SEO Copywriter. Your task is to generate high-quality, AI-optimized content based on the user's request.

    **Content Generation Task:**
    - **Content Type to Generate:** ${contentType}
    - **Primary Topic:** ${topic}
    - **Target Keywords:** ${targetKeywords.join(', ')}
    - **Tone of Voice:** ${tone || 'professional'}
    ${entityInstruction}

    **Instructions:**
    - Fulfill the primary instruction: ${baseInstructions[contentType]}
    - The content must be well-written, accurate, and ready for publication.
    - Ensure the generated content is optimized for AI visibility and citation likelihood.

    **Output Format:**
    You MUST provide a response in a single, valid JSON object. The JSON object must strictly adhere to the following schema:
    \`\`\`json
    ${jsonSchema}
    \`\`\`

    Now, perform your expert content generation.
    `;
};

// --- Main Service Handler ---
export const contentGeneratorService = async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const requestBody: ContentRequest = await req.json();

        if (!requestBody.topic || !requestBody.contentType) {
            throw new Error('`topic` and `contentType` are required fields.');
        }

        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
        if (!geminiApiKey) throw new Error('Gemini API key not configured');

        const prompt = getContentGenerationPrompt(requestBody);

        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    response_mime_type: "application/json",
                    temperature: 0.7, // More creative for content generation
                    maxOutputTokens: 4096,
                }
            })
        });

        if (!geminiResponse.ok) {
            throw new Error(`The AI model failed to process the request. Status: ${geminiResponse.status}`);
        }

        const geminiData = await geminiResponse.json();
        const generatedJson: GeneratedContent = JSON.parse(geminiData.candidates[0].content.parts[0].text);

        return new Response(JSON.stringify({ success: true, data: generatedJson }), {
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
Deno.serve(contentGeneratorService);
