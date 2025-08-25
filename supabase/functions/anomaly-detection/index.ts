import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// --- CORS Headers ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE'
};
// --- Inline Logging Functions ---
async function logToolRun(supabase, projectId, toolName, inputPayload) {
  if (!projectId) {
    throw new Error("logToolRun error: projectId is required.");
  }
  console.log(`Logging tool run: ${toolName} for project: ${projectId}`);
  const { data, error } = await supabase.from("tool_runs").insert({
    project_id: projectId,
    tool_name: toolName,
    input_payload: inputPayload,
    status: "running",
    created_at: new Date().toISOString()
  }).select("id").single();
  if (error) {
    console.error("Error logging tool run:", error);
    throw new Error(`Failed to log tool run. Supabase error: ${error.message}`);
  }
  if (!data || !data.id) {
    console.error("No data or data.id returned from tool_runs insert.");
    throw new Error("Failed to log tool run: No data returned after insert.");
  }
  console.log(`Tool run logged with ID: ${data.id}`);
  return data.id;
}
async function updateToolRun(supabase, runId, status, outputPayload, errorMessage) {
  if (!runId) {
    console.error("updateToolRun error: runId is required.");
    return;
  }
  console.log(`Updating tool run ${runId} with status: ${status}`);
  const update = {
    status,
    completed_at: new Date().toISOString(),
    output_payload: errorMessage ? {
      error: errorMessage
    } : outputPayload || null,
    error_message: errorMessage || null
  };
  const { error } = await supabase.from("tool_runs").update(update).eq("id", runId);
  if (error) {
    console.error(`Error updating tool run ID ${runId}:`, error);
  } else {
    console.log(`Tool run ${runId} updated successfully`);
  }
}
// --- Utility Functions ---
function calculateTrend(scores) {
  if (scores.length < 3) {
    return {
      direction: 'stable',
      confidence: 0,
      predictedValue: scores[scores.length - 1] || 0,
      slope: 0
    };
  }
  const n = scores.length;
  const x = Array.from({
    length: n
  }, (_, i)=>i);
  const y = scores;
  const sumX = x.reduce((a, b)=>a + b, 0);
  const sumY = y.reduce((a, b)=>a + b, 0);
  const sumXY = x.reduce((sum, xi, i)=>sum + xi * y[i], 0);
  const sumXX = x.reduce((sum, xi)=>sum + xi * xi, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  const yMean = sumY / n;
  const ssRes = y.reduce((sum, yi, i)=>sum + Math.pow(yi - (slope * i + intercept), 2), 0);
  const ssTot = y.reduce((sum, yi)=>sum + Math.pow(yi - yMean, 2), 0);
  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;
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
    case 'ai_understanding':
      return [
        'Improve content clarity and structure',
        'Add more context and definitions'
      ];
    case 'citation_likelihood':
      return [
        'Add more factual, citable information',
        'Improve content authority signals'
      ];
    case 'conversational_readiness':
      return [
        'Add more question-answer content',
        'Use natural language patterns'
      ];
    case 'content_structure':
      return [
        'Improve heading hierarchy (H1-H6)',
        'Add more structured data markup'
      ];
    default:
      return [
        'Run a comprehensive audit',
        'Review recent content changes'
      ];
  }
}
// --- Main Service Handler ---
const anomalyDetectionService = async (req, supabase)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  let runId = null;
  try {
    const { projectId, userId, sensitivity = 'medium', timeframe = '30d' } = await req.json();
    if (!projectId || !userId) {
      throw new Error('`projectId` and `userId` are required.');
    }
    runId = await logToolRun(supabase, projectId, 'anomaly-detection', {
      userId,
      sensitivity,
      timeframe
    });
    // Fetch user data for analysis
    const { data: auditHistory, error: auditError } = await supabase.from('audit_history').select('*').eq('user_id', userId).order('created_at', {
      ascending: false
    }).limit(10);
    if (auditError) {
      console.error('Error fetching audit history:', auditError);
    }
    const { data: userActivity, error: activityError } = await supabase.from('user_activity').select('*').eq('user_id', userId).order('created_at', {
      ascending: false
    }).limit(100);
    if (activityError) {
      console.error('Error fetching user activity:', activityError);
    }
    // Set thresholds based on sensitivity
    const thresholds = {
      scoreDrop: sensitivity === 'low' ? 15 : sensitivity === 'high' ? 5 : 10,
      subscore: sensitivity === 'low' ? 20 : sensitivity === 'high' ? 10 : 15,
      activityGap: sensitivity === 'low' ? 14 : sensitivity === 'high' ? 3 : 7
    };
    const anomalies = [];
    // Check for score drops
    if (auditHistory && auditHistory.length >= 2) {
      for(let i = 0; i < Math.min(auditHistory.length - 1, 5); i++){
        const current = auditHistory[i];
        const previous = auditHistory[i + 1];
        if (current.overall_score && previous.overall_score) {
          const scoreDiff = current.overall_score - previous.overall_score;
          if (scoreDiff <= -thresholds.scoreDrop) {
            anomalies.push({
              id: `score_drop_${current.id}`,
              type: 'score_drop',
              title: 'Significant Score Drop Detected',
              description: `Your AI visibility score dropped by ${Math.abs(scoreDiff)} points from ${previous.overall_score} to ${current.overall_score}`,
              severity: scoreDiff <= -20 ? 'high' : 'medium',
              detectedAt: new Date().toISOString(),
              data: {
                previousScore: previous.overall_score,
                currentScore: current.overall_score,
                difference: scoreDiff
              }
            });
            break; // Only report the most recent significant drop
          }
        }
      }
    }
    // Check for inactivity patterns
    if (userActivity && userActivity.length > 0) {
      const lastToolUsage = userActivity.find((a)=>a.activity_type === 'tool_used');
      if (lastToolUsage) {
        const daysSinceLastTool = (Date.now() - new Date(lastToolUsage.created_at).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceLastTool > thresholds.activityGap) {
          anomalies.push({
            id: `inactivity_${Date.now()}`,
            type: 'inactivity',
            title: 'Unusual Inactivity Detected',
            description: `No optimization activity for ${Math.floor(daysSinceLastTool)} days. Regular optimization helps maintain AI visibility.`,
            severity: daysSinceLastTool > 30 ? 'high' : 'medium',
            detectedAt: new Date().toISOString(),
            data: {
              daysSinceLastActivity: Math.floor(daysSinceLastTool),
              lastActivity: lastToolUsage.created_at
            }
          });
        }
      } else {
        // No tool usage found at all
        anomalies.push({
          id: `no_activity_${Date.now()}`,
          type: 'no_activity',
          title: 'No Recent Tool Usage',
          description: 'No recorded tool usage found. Start using optimization tools to improve your AI visibility.',
          severity: 'medium',
          detectedAt: new Date().toISOString(),
          data: {}
        });
      }
    }
    // Add trend analysis if we have enough data
    if (auditHistory && auditHistory.length >= 3) {
      const scores = auditHistory.slice(0, 10).reverse().map((audit)=>audit.overall_score).filter((score)=>score !== null && score !== undefined);
      if (scores.length >= 3) {
        const trend = calculateTrend(scores);
        if (trend.direction === 'declining' && trend.confidence > 0.5) {
          anomalies.push({
            id: `declining_trend_${Date.now()}`,
            type: 'declining_trend',
            title: 'Declining Performance Trend',
            description: `Your AI visibility scores show a declining trend with ${Math.round(trend.confidence * 100)}% confidence.`,
            severity: trend.confidence > 0.8 ? 'high' : 'medium',
            detectedAt: new Date().toISOString(),
            data: {
              trendDirection: trend.direction,
              confidence: trend.confidence,
              predictedScore: Math.round(trend.predictedValue),
              recommendations: getRecommendationsForSubscore('ai_understanding')
            }
          });
        }
      }
    }
    const output = {
      anomalies,
      detectionSettings: {
        sensitivity,
        timeframe,
        thresholds
      },
      dataPoints: {
        auditHistoryCount: auditHistory?.length || 0,
        userActivityCount: userActivity?.length || 0
      },
      analyzedAt: new Date().toISOString()
    };
    await updateToolRun(supabase, runId, 'completed', output, null);
    return new Response(JSON.stringify({
      success: true,
      data: output,
      runId
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
    console.error('Anomaly detection error:', err);
    if (runId) {
      await updateToolRun(supabase, runId, 'error', null, errorMessage);
    }
    return new Response(JSON.stringify({
      success: false,
      error: {
        message: errorMessage
      },
      runId
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
};
// --- Server ---
Deno.serve(async (req)=>{
  const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  return await anomalyDetectionService(req, supabase);
});
