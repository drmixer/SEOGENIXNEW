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

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    let runId;
    try {
        const { projectId, url, content, previousScore } = await req.json();

        runId = await logToolRun({
            projectId: projectId,
            toolName: 'enhanced-audit-insights',
            inputPayload: { url, previousScore, contentLength: content?.length }
        });

        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
        if (!geminiApiKey) throw new Error('Gemini API key not configured');

        const sentenceAnalysisResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: `Perform sentence-level analysis of this content for AI visibility issues.
Content: ${content.substring(0, 4000)}
For each problematic sentence, identify:
- Specific AI comprehension issues
- Ambiguous references or unclear context
- Complex sentence structures
Format each analysis as:
SENTENCE: [exact sentence text]
ISSUES: [issue1] | [issue2]
SUGGESTIONS: [suggestion1] | [suggestion2]` }] }],
                generationConfig: { temperature: 0.3, maxOutputTokens: 1024 }
            })
        });

        const scoreExplanationResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: `Provide detailed explanations for each AI visibility score component.
Content: ${content.substring(0, 4000)}
${previousScore ? `Previous Score: ${previousScore}` : ''}
Explain why the score is what it is, specific issues, and actions to improve for:
- AI Understanding, Citation Likelihood, Conversational Readiness, Content Structure
Format as:
COMPONENT: [component name]
SCORE: [0-100]
REASONING: [detailed explanation]` }] }],
                generationConfig: { temperature: 0.2, maxOutputTokens: 1536 }
            })
        });

        if (!sentenceAnalysisResponse.ok || !scoreExplanationResponse.ok) {
            throw new Error('Failed to get enhanced analysis from Gemini API');
        }

        const sentenceData = await sentenceAnalysisResponse.json();
        const scoreData = await scoreExplanationResponse.json();
        const sentenceAnalysisText = sentenceData.candidates[0].content.parts[0].text;
        const scoreExplanationText = scoreData.candidates[0].content.parts[0].text;

        const sentenceAnalyses = [];
        const sentenceSections = sentenceAnalysisText.split('SENTENCE:').slice(1);
        for (const section of sentenceSections) {
            const sentenceMatch = section.match(/^([^\n]+)/);
            const issuesMatch = section.match(/ISSUES:\s*(.*)/i);
            const suggestionsMatch = section.match(/SUGGESTIONS:\s*(.*)/i);
            if (sentenceMatch && issuesMatch && suggestionsMatch) {
                sentenceAnalyses.push({
                    sentence: sentenceMatch[1].trim(),
                    issues: issuesMatch[1].split('|').map(i => i.trim()),
                    suggestions: suggestionsMatch[1].split('|').map(s => s.trim()),
                });
            }
        }

        const scoreExplanations = [];
        const scoreSections = scoreExplanationText.split('COMPONENT:').slice(1);
        for (const section of scoreSections) {
            const componentMatch = section.match(/^([^\n]+)/);
            const scoreMatch = section.match(/SCORE:\s*(\d+)/i);
            const reasoningMatch = section.match(/REASONING:\s*(.*?)(?=ISSUES:|$)/is);
            if (componentMatch && scoreMatch && reasoningMatch) {
                scoreExplanations.push({
                    component: componentMatch[1].trim(),
                    score: parseInt(scoreMatch[1]),
                    reasoning: reasoningMatch[1].trim(),
                });
            }
        }

        const output = { enhancedInsights: { sentenceAnalyses, scoreExplanations } };

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
