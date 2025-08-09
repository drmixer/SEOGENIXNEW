import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

function calculateTrend(scores: number[]) {
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

function getRecommendationsForSubscore(subscore: string) {
  switch(subscore){
    case 'ai_understanding': return ['Improve content clarity and structure', 'Add more context and definitions'];
    case 'citation_likelihood': return ['Add more factual, citable information', 'Include statistics and data points'];
    case 'conversational_readiness': return ['Add more question-answer content', 'Use natural language patterns'];
    case 'content_structure': return ['Improve heading hierarchy (H1-H6)', 'Add more structured data markup'];
    default: return ['Run a comprehensive audit', 'Review recent content changes'];
  }
}

export async function anomalyDetectionHandler(
  supabase: SupabaseClient,
  req: Request,
  input: any
) {
  const { userId, sensitivity = 'medium', timeframe = '30d' } = input;

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw new Error('Authorization header required');
  const token = authHeader.replace('Bearer ', '');
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) throw new Error('Invalid authentication');

  const { data: auditHistory } = await supabase.from('audit_history').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  const { data: userActivity } = await supabase.from('user_activity').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(100);

  const thresholds = {
    scoreDrop: sensitivity === 'low' ? 15 : sensitivity === 'medium' ? 10 : 5,
    subscore: sensitivity === 'low' ? 20 : sensitivity === 'medium' ? 15 : 10,
    trendConfidence: sensitivity === 'low' ? 0.8 : sensitivity === 'medium' ? 0.7 : 0.6,
    activityGap: sensitivity === 'low' ? 14 : sensitivity === 'medium' ? 10 : 7
  };

  const anomalies = [];

  if (auditHistory && auditHistory.length >= 2) {
    for(let i = 0; i < auditHistory.length - 1; i++){
      const current = auditHistory[i];
      const previous = auditHistory[i + 1];
      const scoreDiff = current.overall_score - previous.overall_score;
      if (scoreDiff <= -thresholds.scoreDrop) {
        anomalies.push({ type: 'score_drop', title: 'Significant Score Drop Detected', description: `Score dropped by ${Math.abs(scoreDiff)} points.`, severity: 'high' });
        break;
      }
    }
  }

  if (auditHistory && auditHistory.length >= 2) {
    const latest = auditHistory[0];
    const previous = auditHistory[1];
    const subscoreChanges = {
      ai_understanding: latest.ai_understanding - previous.ai_understanding,
      citation_likelihood: latest.citation_likelihood - previous.citation_likelihood,
      conversational_readiness: latest.conversational_readiness - previous.conversational_readiness,
      content_structure: latest.content_structure - previous.content_structure
    };
    const largestDrop = Math.min(...Object.values(subscoreChanges));
    if (largestDrop <= -thresholds.subscore) {
        anomalies.push({ type: 'subscore_anomaly', title: 'Subscore Anomaly Detected', description: `A specific subscore dropped significantly.`, severity: 'medium' });
    }
  }

  if (userActivity && userActivity.length > 0) {
    const lastToolUsage = userActivity.find(a => a.activity_type === 'tool_used');
    if (lastToolUsage) {
      const daysSinceLastTool = (Date.now() - new Date(lastToolUsage.created_at).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceLastTool > thresholds.activityGap) {
        anomalies.push({ type: 'inactivity', title: 'Unusual Inactivity Detected', description: `No optimization activity for ${Math.floor(daysSinceLastTool)} days.`, severity: 'medium' });
      }
    }
  }

  if (auditHistory && auditHistory.length >= 5) {
    const recentScores = auditHistory.slice(0, 5).map(a => a.overall_score).reverse();
    const trend = calculateTrend(recentScores);
    if (trend.direction === 'declining' && trend.confidence > thresholds.trendConfidence) {
      anomalies.push({ type: 'trend_anomaly', title: 'Declining Performance Trend', description: `Scores show a consistent declining trend.`, severity: 'high' });
    }
  }

  return {
    anomalies,
    analysisMetadata: {
      userId,
      sensitivityLevel: sensitivity,
      timeframe,
      dataPoints: {
        auditHistory: auditHistory?.length || 0,
        userActivity: userActivity?.length || 0
      },
      analyzedAt: new Date().toISOString()
    }
  };
}
