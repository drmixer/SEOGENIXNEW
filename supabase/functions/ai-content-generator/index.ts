import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logToolRun, updateToolRun } from "shared/logging.ts";

// --- CORS Headers ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// --- Type Definitions ---
interface ContentGenerationRequest {
    projectId: string;
    contentType: 'faq' | 'meta-tags' | 'snippets' | 'headings' | 'descriptions';
    topic: string;
    targetKeywords: string[];
    tone?: 'professional' | 'casual' | 'technical' | 'friendly';
    entitiesToInclude?: string[];
}

// --- AI Prompt Engineering ---
const getContentGenerationPrompt = (request: ContentGenerationRequest): string => {
    const { contentType, topic, targetKeywords, tone, entitiesToInclude } = request;

    const baseInstructions = {
        'faq': 'Generate 5-7 comprehensive FAQ pairs. Create questions that people commonly ask and provide clear, detailed answers.',
        'meta-tags': 'Generate optimized meta tags: a title (50-60 characters), a description (150-160 characters), and a comma-separated list of 5-7 relevant keywords.',
        'snippets': 'Create a featured snippet-optimized paragraph that directly answers a common question about the topic. It should be concise and well-structured.',
        'headings': 'Generate a comprehensive and logical heading structure (H1, H2s, H3s) that follows SEO best practices and outlines a full article.',
        'descriptions': 'Write a compelling, SEO-optimized product or service description that clearly explains the topic and includes target keywords naturally.'
    };

    const entityInstruction = entitiesToInclude && entitiesToInclude.length > 0
        ? `**Important: You must naturally integrate these entities into the content:** ${entitiesToInclude.join(', ')}.`
        : '';

    const jsonSchemas = {
        'faq': `{ "faqs": [{ "question": "string", "answer": "string" }] }`,
        'meta-tags': `{ "title": "string", "description": "string", "keywords": "string" }`,
        'snippets': `{ "snippet": "string" }`,
        'headings': `{ "h1": "string", "sections": [{ "h2": "string", "h3s": ["string"] }] }`,
        'descriptions': `{ "description": "string" }`
    };

    return `You are an Expert Content Strategist and SEO Copywriter. Your task is to generate high-quality, SEO-optimized content based on the user's request.

    **Content Generation Task:**
    - **Content Type to Generate:** ${contentType}
    - **Primary Topic:** ${topic}
    - **Target Keywords:** ${targetKeywords.join(', ')}
    - **Desired Tone:** ${tone || 'professional'}
    ${entityInstruction}

    **Instructions:**
    1.  **Fulfill the Core Request:** ${baseInstructions[contentType]}
    2.  **Optimize for SEO:** Naturally incorporate the target keywords.
    3.  **Adhere to Tone:** Ensure the generated content matches the requested tone.
    4.  **Be Ready for Publication:** The content should be high-quality and accurate.

    **CRITICAL: You MUST provide your response in a single, valid JSON object enclosed in a \`\`\`json markdown block.**
    The JSON object must contain a single key, "generatedContent", which holds another object matching the exact schema for the requested content type.

    **Schema for '${contentType}':**
    \`\`\`json
    {
        "generatedContent": ${jsonSchemas[contentType]}
    }
    \`\`\`

    Generate the content now.`;
};

// --- Fallback Generator ---
function generateFallbackContent(contentType: string, message: string): any {
    console.warn(`Generating fallback for content generator: ${message}`);
    const fallbackContent = {
        'faq': { faqs: [{ question: "Generation Failed", answer: message }] },
        'meta-tags': { title: "Generation Failed", description: message, keywords: "" },
        'snippets': { snippet: `Content generation failed: ${message}` },
        'headings': { h1: "Content Generation Failed", sections: [{ h2: message, h3s: [] }] },
        'descriptions': { description: `Content generation failed: ${message}` }
    };

    return {
        generatedContent: fallbackContent[contentType],
        note: `AI analysis failed. ${message}`
    };
}

// --- Main Service Handler ---
const contentGeneratorService = async (req: Request, supabase: SupabaseClient) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    let runId: string | null = null;
    let requestBody: ContentGenerationRequest;

    try {
        requestBody = await req.json();
        const { projectId, contentType, topic } = requestBody;

        if (!projectId || !contentType || !topic) {
            throw new Error('`projectId`, `contentType`, and `topic` are required.');
        }

        const validContentTypes = ['faq', 'meta-tags', 'snippets', 'headings', 'descriptions'];
        if (!validContentTypes.includes(contentType)) {
            throw new Error(`Invalid contentType. Must be one of: ${validContentTypes.join(', ')}`);
        }

        runId = await logToolRun(supabase, projectId, 'ai-content-generator', requestBody);

        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
        if (!geminiApiKey) throw new Error('GEMINI_API_KEY is not configured.');

        const prompt = getContentGenerationPrompt(requestBody);

        const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${geminiApiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.7, maxOutputTokens: 4096 }
                })
            }
        );

        if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text();
            throw new Error(`Gemini API failed with status ${geminiResponse.status}: ${errorText}`);
        }

        const geminiData = await geminiResponse.json();
        const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!responseText) {
            throw new Error("No response text from Gemini.");
        }

        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
        if (!jsonMatch || !jsonMatch[1]) {
            throw new Error('Could not extract JSON from AI response.');
        }

        const generatedJson = JSON.parse(jsonMatch[1]);
        if (!generatedJson.generatedContent) {
            throw new Error('Generated content from AI is missing the required `generatedContent` field.');
        }

        const output = { ...generatedJson, generatedAt: new Date().toISOString(), contentType };
        await updateToolRun(supabase, runId, 'completed', output, null);

        return new Response(JSON.stringify({ success: true, data: output, runId }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        console.error('Content Generator Error:', errorMessage);

        if (runId) {
            const fallbackOutput = generateFallbackContent(requestBody?.contentType, errorMessage);
            await updateToolRun(supabase, runId, 'error', fallbackOutput, errorMessage);
            return new Response(JSON.stringify({ success: true, data: { ...fallbackOutput, runId } }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        return new Response(JSON.stringify({ success: false, error: { message: errorMessage }, runId }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
};

// --- Server ---
Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  return await contentGeneratorService(req, supabase);
});
