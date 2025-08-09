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
async function logToolRun({ projectId, toolName, inputPayload }) {
  const { data, error } = await supabase.from('tool_runs').insert({ project_id: projectId, tool_name: toolName, input_payload: inputPayload, status: 'running' }).select('id').single();
  if (error) { console.error('Error logging tool run:', error); return null; }
  return data.id;
}

async function updateToolRun({ runId, status, outputPayload, errorMessage }) {
  const update = { status, completed_at: new Date().toISOString(), output_payload: outputPayload || null, error_message: errorMessage || null };
  const { error } = await supabase.from('tool_runs').update(update).eq('id', runId);
  if (error) { console.error('Error updating tool run:', error); }
}

function generateFallbackAnalysis(content, keywords) {
    const suggestions = [{ type: 'grammar', severity: 'warning', message: 'Fallback analysis could not connect to the main service.', suggestion: 'Please try again later.', position: { start: 0, end: content.length } }];
    return new Response(JSON.stringify({ suggestions, note: 'This is fallback data.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    let runId;
    try {
        const { projectId, content, keywords } = await req.json();

        runId = await logToolRun({
            projectId: projectId,
            toolName: 'real-time-content-analysis',
            inputPayload: { keywords, contentLength: content?.length }
        });

        if (!content || content.length < 10) throw new Error('Content too short for analysis');

        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
        if (!geminiApiKey) throw new Error('Gemini API key not configured');

        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: `Analyze this content for AI visibility.
Content: ${content}
Keywords: ${keywords.join(', ')}
Provide:
- AI READABILITY SCORE (0-100)
- KEYWORD DENSITY for each keyword
- 3-5 REAL-TIME SUGGESTIONS with positions
Format as:
AI_READABILITY: [score]
KEYWORD_DENSITY:
[keyword1]: [percentage]
SUGGESTIONS:
TYPE: [type] | SEVERITY: [severity] | MESSAGE: [message] | SUGGESTION: [suggestion] | POSITION: [start]-[end]` }] }],
                generationConfig: { temperature: 0.3, maxOutputTokens: 1024 }
            })
        });

        if (!geminiResponse.ok) {
            console.error('Gemini API error:', await geminiResponse.text());
            return generateFallbackAnalysis(content, keywords);
        }

        const geminiData = await geminiResponse.json();
        const analysisText = geminiData.candidates[0].content.parts[0].text;

        const aiReadabilityScore = parseInt(analysisText.match(/AI_READABILITY:\s*(\d+)/i)?.[1] || '75');
        const keywordDensitySection = analysisText.match(/KEYWORD_DENSITY:\s*([\s\S]*?)(?=SUGGESTIONS:|$)/i);
        const keywordDensity = {};
        if (keywordDensitySection) {
            keywordDensitySection[1].split('\n').forEach(line => {
                const parts = line.split(':');
                if (parts.length === 2) keywordDensity[parts[0].trim()] = parseFloat(parts[1].trim().replace('%', ''));
            });
        }

        const suggestions = [];
        const suggestionSections = analysisText.match(/SUGGESTIONS:\s*([\s\S]*)/i);
        if (suggestionSections) {
            suggestionSections[1].split('TYPE:').slice(1).forEach(section => {
                const parts = section.split('|').map(p => p.trim());
                if (parts.length >= 5) {
                    const pos = parts[4].match(/(\d+)-(\d+)/);
                    suggestions.push({
                        type: parts[0].split(':')[1]?.trim(),
                        severity: parts[1].split(':')[1]?.trim(),
                        message: parts[2].split(':')[1]?.trim(),
                        suggestion: parts[3].split(':')[1]?.trim(),
                        position: pos ? { start: parseInt(pos[1]), end: parseInt(pos[2]) } : { start: 0, end: 0 }
                    });
                }
            });
        }

        const output = { aiReadabilityScore, keywordDensity, suggestions };

        await updateToolRun({
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
            await updateToolRun({ runId, status: 'error', errorMessage: errorMessage });
        }
        return new Response(JSON.stringify({ error: errorMessage }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
