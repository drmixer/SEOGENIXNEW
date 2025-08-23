import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logToolRun, updateToolRun } from '../_shared/logging.ts';

// --- CORS Headers ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// --- Type Definitions ---
interface SchemaRequest {
    projectId: string;
    url: string;
    contentType: 'Article' | 'FAQPage' | 'HowTo';
    content?: string;
}

// --- AI Prompt Engineering ---
const getSchemaPrompt = (request: SchemaRequest): string => {
    const { url, contentType, content } = request;

    const baseInstruction = `You are an expert in SEO and structured data. Your task is to generate a valid Schema.org JSON-LD markup object based on the provided content.

    **Analysis Context:**
    - **URL:** ${url}
    - **Requested Schema Type:** ${contentType}
    - **Content Snippet:**
      ---
      ${content ? content.substring(0, 8000) : 'Content not provided, analyze the URL.'}
      ---

    **Instructions:**
    1.  Analyze the content to extract the necessary information for the ${contentType} schema.
    2.  If key information is missing (e.g., author name, publish date), make a reasonable inference or use placeholder values like "Not available".
    3.  Construct a complete and valid JSON-LD object.

    **CRITICAL: You MUST provide your response in a single, valid JSON object enclosed in a \`\`\`json markdown block.**
    The JSON object must follow the specified schema structure.`;

    const schemas = {
        Article: `{
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": "string (The main headline of the article)",
            "author": { "@type": "Person", "name": "string (Author's name)" },
            "datePublished": "string (ISO 8601 format, e.g., '2025-08-23T12:00:00Z')",
            "image": "string (URL of the main image, if available)",
            "publisher": { "@type": "Organization", "name": "string (Publisher's name)", "logo": { "@type": "ImageObject", "url": "string (URL to logo)" } }
        }`,
        FAQPage: `{
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
                {
                    "@type": "Question",
                    "name": "string (The full text of the question)",
                    "acceptedAnswer": { "@type": "Answer", "text": "string (The full text of the answer)" }
                }
            ]
        }`,
        HowTo: `{
            "@context": "https://schema.org",
            "@type": "HowTo",
            "name": "string (The goal of the how-to, e.g., 'How to Change a Tire')",
            "totalTime": "string (ISO 8601 duration, e.g., 'PT1H30M')",
            "step": [
                {
                    "@type": "HowToStep",
                    "text": "string (Description of the first step)",
                    "name": "string (A short name for the step)"
                }
            ]
        }`
    };

    return `${baseInstruction}\n\nThe JSON object must follow this exact schema:\n\`\`\`json\n${schemas[contentType] || schemas['Article']}\n\`\`\``;
};

// --- Fallback Generator ---
function generateFallbackSchema(contentType: string, url: string, message: string): any {
    console.warn(`Generating fallback schema for ${contentType}: ${message}`);
    const schema = {
        "@context": "https://schema.org",
        "@type": contentType || "WebPage",
        "name": `Fallback Schema for ${contentType}`,
        "url": url,
        "description": `Could not generate schema: ${message}`
    };
    const formattedSchema = JSON.stringify(schema, null, 2);
    return {
        schema: formattedSchema,
        implementation: `<script type="application/ld+json">${formattedSchema}</script>`,
        note: `AI analysis failed. A basic fallback schema was generated.`
    };
}

// --- Main Service Handler ---
const schemaGeneratorService = async (req: Request, supabase: SupabaseClient): Promise<Response> => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    let runId: string | null = null;
    let requestBody: SchemaRequest;

    try {
        requestBody = await req.json();
        const { projectId, url, contentType, content } = requestBody;

        if (!projectId || !url || !contentType) {
            throw new Error('`projectId`, `url`, and `contentType` are required.');
        }

        runId = await logToolRun(supabase, projectId, 'schema-generator', { url, contentType, contentLength: content?.length });

        let pageContent = content;
        if (!pageContent) {
            try {
                const response = await fetch(url, { headers: { 'User-Agent': 'SEOGENIX-SchemaBot/1.0' } });
                if (response.ok) {
                    pageContent = await response.text();
                } else {
                    throw new Error(`Failed to fetch URL with status: ${response.status}`);
                }
            } catch (fetchError) {
                console.error('URL fetch error:', fetchError.message);
                // We can still proceed, the AI will have to work with just the URL
            }
        }

        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
        if (!geminiApiKey) throw new Error('GEMINI_API_KEY is not configured.');

        const prompt = getSchemaPrompt({ ...requestBody, content: pageContent });

        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.2, maxOutputTokens: 4096 }
            })
        });

        if (!geminiResponse.ok) {
            throw new Error(`Gemini API request failed with status ${geminiResponse.status}`);
        }

        const geminiData = await geminiResponse.json();
        const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!responseText) {
            throw new Error("No response text from Gemini.");
        }

        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
        if (!jsonMatch || !jsonMatch[1]) {
            throw new Error("Could not extract JSON from AI response.");
        }

        const parsedSchema = JSON.parse(jsonMatch[1]);
        const formattedSchema = JSON.stringify(parsedSchema, null, 2);
        const output = {
            schema: formattedSchema,
            implementation: `<script type="application/ld+json">${formattedSchema}</script>`
        };

        await updateToolRun(supabase, runId, 'completed', output, null);

        return new Response(JSON.stringify({ success: true, data: { runId, ...output } }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        console.error("Schema Generator Error:", errorMessage);

        if (runId) {
            const fallbackOutput = generateFallbackSchema(requestBody?.contentType, requestBody?.url, errorMessage);
            await updateToolRun(supabase, runId, 'error', fallbackOutput, errorMessage);
            return new Response(JSON.stringify({ success: true, data: { runId, ...fallbackOutput } }), {
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
Deno.serve(async (req: Request) => {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    return await schemaGeneratorService(req, supabase);
});
