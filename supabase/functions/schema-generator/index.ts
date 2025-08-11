import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// Self-contained CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// Helper functions for logging
async function logToolRun({ supabase, projectId, toolName, inputPayload }) {
  const { data, error } = await supabase.from('tool_runs').insert({ project_id: projectId, tool_name: toolName, input_payload: inputPayload, status: 'running' }).select('id').single();
  if (error) { console.error('Error logging tool run:', error); return null; }
  return data.id;
}

async function updateToolRun({ supabase, runId, status, outputPayload, errorMessage }) {
  const update = { status, completed_at: new Date().toISOString(), output_payload: outputPayload || null, error_message: errorMessage || null };
  const { error } = await supabase.from('tool_runs').update(update).eq('id', runId);
  if (error) { console.error('Error updating tool run:', error); }
}

function generateFallbackSchema(contentType, url) {
    const schema = { "@context": "https://schema.org", "@type": "WebPage", "name": "Fallback Schema", "url": url };
    return new Response(JSON.stringify({ schema: JSON.stringify(schema, null, 2), note: 'This is fallback data.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

const schemaGeneratorService = async (req: Request, supabase: SupabaseClient): Promise<Response> => {
    let runId;
    try {
        const { projectId, url, contentType, content } = await req.json();

        runId = await logToolRun({
            supabase,
            projectId: projectId,
            toolName: 'schema-generator',
            inputPayload: { url, contentType, contentLength: content?.length }
        });

        let pageContent = content;
        if (url && !content) {
            try {
                const response = await fetch(url, { headers: { 'User-Agent': 'SEOGENIX Schema Bot 1.0' } });
                if (response.ok) pageContent = await response.text();
            } catch (error) { console.error('Failed to fetch URL:', error); }
        }

        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
        if (!geminiApiKey) throw new Error('Gemini API key not configured');

        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: `Generate a Schema.org JSON-LD markup for a ${contentType}.
URL: ${url}
Content: ${pageContent ? pageContent.substring(0, 3000) : 'Not available'}
Return ONLY the JSON object.` }] }],
                generationConfig: { temperature: 0.2, maxOutputTokens: 1024 }
            })
        });

        if (!geminiResponse.ok) {
            console.error('Gemini API error:', await geminiResponse.text());
            return generateFallbackSchema(contentType, url);
        }

        const geminiData = await geminiResponse.json();
        let schemaMarkup = geminiData.candidates[0].content.parts[0].text;

        schemaMarkup = schemaMarkup.replace(/```json\s*/g, '').replace(/```\s*/g, '');
        const startIndex = schemaMarkup.indexOf('{');
        const endIndex = schemaMarkup.lastIndexOf('}');
        if (startIndex === -1 || endIndex === -1) return generateFallbackSchema(contentType, url);
        schemaMarkup = schemaMarkup.substring(startIndex, endIndex + 1);

        try {
            const parsedSchema = JSON.parse(schemaMarkup);
            const formattedSchema = JSON.stringify(parsedSchema, null, 2);
            const output = { schema: formattedSchema, implementation: `<script type="application/ld+json">${formattedSchema}</script>` };

            await updateToolRun({
                supabase,
                runId,
                status: 'completed',
                outputPayload: output
            });

            return new Response(JSON.stringify({ runId, output }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            return generateFallbackSchema(contentType, url);
        }

    } catch (err) {
        console.error(err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        if (runId) {
            await updateToolRun({ supabase, runId, status: 'error', errorMessage: errorMessage });
        }
        return new Response(JSON.stringify({ error: errorMessage }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    return await schemaGeneratorService(req, supabase);
});
