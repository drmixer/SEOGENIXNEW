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

function generateFallbackSummary(url, summaryType) {
    const summary = `This is a fallback ${summaryType} summary for ${url}. The main service could not be reached.`;
    const entities = ['Fallback Entity 1', 'Fallback Entity 2'];
    const topics = ['Fallback Topic 1', 'Fallback Topic 2'];
    return new Response(JSON.stringify({ url, summaryType, summary, entities, topics, note: 'This is fallback data.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

const llmSiteSummariesService = async (req: Request, supabase: SupabaseClient): Promise<Response> => {
    let runId;
    try {
        const { projectId, url, content, summaryType } = await req.json();

        runId = await logToolRun({
            supabase,
            projectId: projectId,
            toolName: 'llm-site-summaries',
            inputPayload: { url, summaryType, contentLength: content?.length }
        });

        let pageContent = content;
        if (url && !content) {
            try {
                const response = await fetch(url, { headers: { 'User-Agent': 'SEOGENIX LLM Summary Bot 1.0' } });
                if (response.ok) pageContent = await response.text();
            } catch (error) { console.error('Failed to fetch URL:', error); }
        }

        const summaryPrompts = {
            overview: `Create a comprehensive overview summary of this website.`,
            technical: `Generate a technical summary focusing on the website's functionality.`,
            business: `Create a business-focused summary highlighting services and target market.`,
            audience: `Generate an audience-focused summary describing who this website serves.`
        };

        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
        if (!geminiApiKey) throw new Error('Gemini API key not configured');

        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: `${summaryPrompts[summaryType]}
URL: ${url}
Content: ${pageContent?.substring(0, 4000) || 'No content provided'}
Format response as:
SUMMARY:
[summary]
KEY ENTITIES:
- [Entity 1]
- [Entity 2]
MAIN TOPICS:
- [Topic 1]
- [Topic 2]` }] }],
                generationConfig: { temperature: 0.3, maxOutputTokens: 1024 }
            })
        });

        if (!geminiResponse.ok) {
            console.error('Gemini API error:', await geminiResponse.text());
            return generateFallbackSummary(url, summaryType);
        }

        const geminiData = await geminiResponse.json();
        const responseText = geminiData.candidates[0].content.parts[0].text;

        const summaryMatch = responseText.match(/SUMMARY:\s*([\s\S]*?)(?=KEY ENTITIES:|$)/i);
        const entitiesMatch = responseText.match(/KEY ENTITIES:\s*([\s\S]*?)(?=MAIN TOPICS:|$)/i);
        const topicsMatch = responseText.match(/MAIN TOPICS:\s*([\s\S]*?)$/i);

        const summary = summaryMatch ? summaryMatch[1].trim() : responseText;
        const entities = entitiesMatch ? entitiesMatch[1].split('\n').filter(line => line.trim().startsWith('-')).map(line => line.trim().substring(1).trim()) : [];
        const topics = topicsMatch ? topicsMatch[1].split('\n').filter(line => line.trim().startsWith('-')).map(line => line.trim().substring(1).trim()) : [];

        const output = { url, summaryType, summary, entities, topics };

        await updateToolRun({
            supabase,
            runId,
            status: 'completed',
            outputPayload: output
        });

        return new Response(JSON.stringify({ runId, output }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

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

    return await llmSiteSummariesService(req, supabase);
});
