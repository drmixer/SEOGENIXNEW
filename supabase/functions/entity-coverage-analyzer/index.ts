import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Self-contained CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Helper functions for logging
async function logToolRun({ projectId, toolName, inputPayload }: { projectId: string, toolName: string, inputPayload: Record<string, any>}) {
  const { data, error } = await supabase.from('tool_runs').insert({ project_id: projectId, tool_name: toolName, input_payload: inputPayload, status: 'running' }).select('id').single();
  if (error) { console.error('Error logging tool run:', error); return null; }
  return data.id;
}

async function updateToolRun({ runId, status, outputPayload, errorMessage }: { runId: string, status: string, outputPayload?: Record<string, any>, errorMessage?: string }) {
  const update: { status: string, completed_at: string, output_payload?: any, error_message?: string } = { status, completed_at: new Date().toISOString() };
  if (outputPayload) update.output_payload = outputPayload;
  if (errorMessage) update.error_message = errorMessage;

  const { error } = await supabase.from('tool_runs').update(update).eq('id', runId);
  if (error) { console.error('Error updating tool run:', error); }
}

function generateFallbackEntityAnalysis(url: string, industry: string) {
    const mentionedEntities = [{ name: 'Example Mentioned Entity', type: 'concept', relevance: 80, mentioned: true, importance: 'high', description: 'An example of a mentioned entity.' }];
    const missingEntities = [{ name: 'Example Missing Entity', type: 'concept', relevance: 90, mentioned: false, importance: 'high', description: 'An example of a missing entity.' }];
    const allEntities = [...mentionedEntities, ...missingEntities];
    return new Response(JSON.stringify({
        url, industry, coverageScore: 50, totalEntities: 2, mentionedCount: 1, missingCount: 1, mentionedEntities, missingEntities,
        note: 'This is fallback data.'
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

export async function app(req: Request): Promise<Response> {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    let runId: string | null = null;
    try {
        const { projectId, url, content, industry, competitors = [] } = await req.json();

        runId = await logToolRun({
            projectId: projectId,
            toolName: 'entity-coverage-analyzer',
            inputPayload: { url, industry, competitors, contentLength: content?.length }
        });

        let pageContent = content;
        if (url && !content) {
            try {
                const response = await fetch(url, { headers: { 'User-Agent': 'SEOGENIX Entity Analyzer Bot 1.0' } });
                if (response.ok) pageContent = await response.text();
            } catch (error) { console.error('Failed to fetch URL:', error); }
        }

        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
        if (!geminiApiKey) throw new Error('Gemini API key not configured');

        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: `Analyze entity coverage for this website.
URL: ${url}
Content: ${pageContent?.substring(0, 4000) || 'No content provided'}
Identify MENTIONED and MISSING entities (people, orgs, concepts). For each, provide Name, Type, Relevance (1-100), Importance (high/medium/low), and Description.
Format as:
MENTIONED ENTITIES:
- [Name] | [Type] | [Relevance] | [Importance] | [Description]
MISSING ENTITIES:
- [Name] | [Type] | [Relevance] | [Importance] | [Description]` }] }],
                generationConfig: { temperature: 0.4, maxOutputTokens: 2048 }
            })
        });

        if (!geminiResponse.ok) {
            console.error('Gemini API error:', await geminiResponse.text());
            return generateFallbackEntityAnalysis(url, industry);
        }

        const geminiData = await geminiResponse.json();
        const responseText = geminiData.candidates[0].content.parts[0].text;

        const parseEntities = (section: string | null, mentioned: boolean) => {
            const lines = section ? section.split('\n').filter((line: string) => line.trim().startsWith('-')) : [];
            return lines.map((line: string) => {
                const parts = line.substring(1).split('|').map((p: string) => p.trim());
                if (parts.length >= 5) return { name: parts[0], type: parts[1].toLowerCase(), relevance: parseInt(parts[2]) || 50, mentioned, importance: parts[3].toLowerCase(), description: parts[4] };
                return null;
            }).filter(Boolean);
        };

        const mentionedSection = responseText.match(/MENTIONED ENTITIES:\s*([\s\S]*?)(?=MISSING ENTITIES:|$)/i);
        const missingSection = responseText.match(/MISSING ENTITIES:\s*([\s\S]*?)$/i);
        const mentionedEntities = parseEntities(mentionedSection ? mentionedSection[1] : null, true);
        const missingEntities = parseEntities(missingSection ? missingSection[1] : null, false);
        const allEntities = [...mentionedEntities, ...missingEntities];
        const coverageScore = allEntities.length > 0 ? Math.round(mentionedEntities.length / allEntities.length * 100) : 0;

        const output = { url, industry, coverageScore, totalEntities: allEntities.length, mentionedCount: mentionedEntities.length, missingCount: missingEntities.length, mentionedEntities, missingEntities };

        if (runId) {
            await updateToolRun({
                runId,
                status: 'completed',
                outputPayload: output
            });
        }

        return new Response(JSON.stringify({ runId, output }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err) {
        console.error(err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        if (runId) {
            await updateToolRun({ runId, status: 'error', errorMessage: errorMessage });
        }
        return new Response(JSON.stringify({ error: errorMessage }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
}

if (import.meta.main) {
    Deno.serve(app);
}
