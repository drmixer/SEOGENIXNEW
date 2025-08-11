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

function calculateTrend(scores) {
    if (scores.length < 3) return { direction: 'stable', confidence: 0, predictedValue: scores[scores.length - 1], slope: 0 };
    const n = scores.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = scores;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    const yMean = sumY / n;
    const ssRes = y.reduce((sum, yi, i) => sum + Math.pow(yi - (slope * i + intercept), 2), 0);
    const ssTot = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
    const rSquared = 1 - ssRes / ssTot;
    const predictedValue = slope * (n + 2) + intercept;
    return {
        direction: slope > 1 ? 'improving' : slope < -1 ? 'declining' : 'stable',
        confidence: Math.max(0, Math.min(1, rSquared)),
        predictedValue: Math.max(0, Math.min(100, predictedValue)),
        slope
    };
}

function getRecommendationsForSubscore(subscore) {
    switch(subscore){
        case 'ai_understanding': return ['Improve content clarity and structure', 'Add more context and definitions'];
        case 'citation_likelihood': return ['Add more factual, citable information', 'Improve content authority signals'];
        case 'conversational_readiness': return ['Add more question-answer content', 'Use natural language patterns'];
        case 'content_structure': return ['Improve heading hierarchy (H1-H6)', 'Add more structured data markup'];
        default: return ['Run a comprehensive audit', 'Review recent content changes'];
    }
}

const anomalyDetectionService = async (req: Request, supabase: SupabaseClient): Promise<Response> => {
    let runId;
    try {
        const { projectId, userId, sensitivity = 'medium', timeframe = '30d' } = await req.json();

        runId = await logToolRun({
            supabase,
            projectId: projectId,
            toolName: 'anomaly-detection',
            inputPayload: { userId, sensitivity, timeframe }
        });

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('Authorization header required');
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabase.auth.getUser(token);
        if (!user) throw new Error('Invalid authentication');

        const { data: auditHistory } = await supabase.from('audit_history').select('*').eq('user_id', userId).order('created_at', { ascending: false });
        const { data: userActivity } = await supabase.from('user_activity').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(100);

        const thresholds = {
            scoreDrop: sensitivity === 'low' ? 15 : 10,
            subscore: sensitivity === 'low' ? 20 : 15,
            activityGap: sensitivity === 'low' ? 14 : 7
        };

        const anomalies = [];

        if (auditHistory && auditHistory.length >= 2) {
            for (let i = 0; i < auditHistory.length - 1; i++) {
                const current = auditHistory[i];
                const previous = auditHistory[i + 1];
                const scoreDiff = current.overall_score - previous.overall_score;
                if (scoreDiff <= -thresholds.scoreDrop) {
                    anomalies.push({
                        id: `score_drop_${current.id}`,
                        type: 'score_drop',
                        title: 'Significant Score Drop Detected',
                        description: `Your AI visibility score dropped by ${Math.abs(scoreDiff)} points`,
                        severity: 'high',
                    });
                    break;
                }
            }
        }

        if (userActivity && userActivity.length > 0) {
            const lastToolUsage = userActivity.find(a => a.activity_type === 'tool_used');
            if (lastToolUsage) {
                const daysSinceLastTool = (Date.now() - new Date(lastToolUsage.created_at).getTime()) / (1000 * 60 * 60 * 24);
                if (daysSinceLastTool > thresholds.activityGap) {
                    anomalies.push({
                        id: `inactivity_${Date.now()}`,
                        type: 'inactivity',
                        title: 'Unusual Inactivity Detected',
                        description: `No optimization activity for ${Math.floor(daysSinceLastTool)} days.`,
                        severity: 'medium',
                    });
                }
            }
        }

        const output = { anomalies };

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

    return await anomalyDetectionService(req, supabase)
});
