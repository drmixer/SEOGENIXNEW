import { serve } from "https://deno.land/std@0.200.0/http/server.ts";
import { logToolRun } from 'shared/logToolRun.ts';
import { updateToolRun } from 'shared/updateToolRun.ts';

interface AnomalyDetectionRequest {
  userId: string;
  sensitivity?: 'low' | 'medium' | 'high';
  timeframe?: '7d' | '30d' | '90d' | 'all';
}

interface Anomaly {
  id: string;
  type: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  impact: 'low' | 'medium' | 'high';
  detectedAt: string;
  data: any;
  recommendations: string[];
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { userId, sensitivity = 'medium', timeframe = '30d' }: AnomalyDetectionRequest = await req.json();

    // Validate auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    
    if (!user) {
      throw new Error('Invalid authentication');
    }

    // Fetch user data for analysis
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    // Fetch audit history
    const timeConstraint = timeframe !== 'all' ? 
      new Date(Date.now() - parseInt(timeframe) * 24 * 60 * 60 * 1000).toISOString() : 
      undefined;

    const { data: auditHistory } = await supabase
      .from('audit_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Fetch user activity
    const { data: userActivity } = await supabase
      .from('user_activity')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    // Set sensitivity thresholds
    const thresholds = {
      scoreDrop: sensitivity === 'low' ? 15 : sensitivity === 'medium' ? 10 : 5,
      subscore: sensitivity === 'low' ? 20 : sensitivity === 'medium' ? 15 : 10,
      trendConfidence: sensitivity === 'low' ? 0.8 : sensitivity === 'medium' ? 0.7 : 0.6,
      activityGap: sensitivity === 'low' ? 14 : sensitivity === 'medium' ? 10 : 7
    };

    const anomalies: Anomaly[] = [];

    // 1. Detect significant score drops
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
            description: `Your AI visibility score dropped by ${Math.abs(scoreDiff)} points (${previous.overall_score} → ${current.overall_score})`,
            severity: scoreDiff <= -20 ? 'critical' : scoreDiff <= -15 ? 'high' : 'medium',
            confidence: 95,
            impact: scoreDiff <= -20 ? 'high' : 'medium',
            detectedAt: new Date().toISOString(),
            data: { 
              current, 
              previous, 
              scoreDiff,
              website_url: current.website_url
            },
            recommendations: [
              'Run a new audit to confirm the drop',
              'Check for recent content changes',
              'Verify schema markup is still present',
              'Use Content Optimizer to address issues',
              'Review competitor activity'
            ]
          });
          
          // Only report the first significant drop
          break;
        }
      }
    }

    // 2. Detect subscore anomalies
    if (auditHistory && auditHistory.length >= 2) {
      const latest = auditHistory[0];
      const previous = auditHistory[1];
      
      const subscoreChanges = {
        ai_understanding: latest.ai_understanding - previous.ai_understanding,
        citation_likelihood: latest.citation_likelihood - previous.citation_likelihood,
        conversational_readiness: latest.conversational_readiness - previous.conversational_readiness,
        content_structure: latest.content_structure - previous.content_structure
      };
      
      // Find the largest negative change
      const largestDrop = Math.min(...Object.values(subscoreChanges));
      const problematicArea = Object.entries(subscoreChanges).find(([_, change]) => change === largestDrop)?.[0];
      
      if (largestDrop <= -thresholds.subscore) {
        const readableArea = problematicArea?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        
        anomalies.push({
          id: `subscore_anomaly_${latest.id}_${problematicArea}`,
          type: 'subscore_anomaly',
          title: `${readableArea} Score Anomaly`,
          description: `Your ${readableArea} score dropped by ${Math.abs(largestDrop)} points while other scores remained stable`,
          severity: largestDrop <= -20 ? 'high' : 'medium',
          confidence: 90,
          impact: 'medium',
          detectedAt: new Date().toISOString(),
          data: {
            latest,
            previous,
            problematicArea,
            change: largestDrop,
            website_url: latest.website_url
          },
          recommendations: getRecommendationsForSubscore(problematicArea || '')
        });
      }
    }

    // 3. Detect unusual activity patterns
    if (userActivity && userActivity.length > 0) {
      const toolUsage = userActivity.filter(a => a.activity_type === 'tool_used');
      const lastToolUsage = toolUsage[0];
      
      if (lastToolUsage) {
        const daysSinceLastTool = (Date.now() - new Date(lastToolUsage.created_at).getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysSinceLastTool > thresholds.activityGap && auditHistory && auditHistory.length > 0) {
          anomalies.push({
            id: `inactivity_${Date.now()}`,
            type: 'inactivity',
            title: 'Unusual Inactivity Detected',
            description: `No optimization activity for ${Math.floor(daysSinceLastTool)} days. Regular maintenance is important for AI visibility.`,
            severity: 'medium',
            confidence: 85,
            impact: 'medium',
            detectedAt: new Date().toISOString(),
            data: {
              daysSinceLastTool,
              lastToolUsage
            },
            recommendations: [
              'Run a new AI visibility audit',
              'Check for recent algorithm updates',
              'Review competitor activity',
              'Update your content optimization',
              'Set up a regular maintenance schedule'
            ]
          });
        }
      }
    }

    // 4. Detect trend anomalies using linear regression
    if (auditHistory && auditHistory.length >= 5) {
      const recentScores = auditHistory.slice(0, 5).map(a => a.overall_score).reverse(); // Oldest to newest
      const trend = calculateTrend(recentScores);
      
      if (trend.direction === 'declining' && trend.confidence > thresholds.trendConfidence) {
        anomalies.push({
          id: `declining_trend_${Date.now()}`,
          type: 'trend_anomaly',
          title: 'Declining Performance Trend',
          description: `Your scores show a consistent declining trend over the last ${recentScores.length} audits`,
          severity: trend.slope < -2 ? 'high' : 'medium',
          confidence: Math.round(trend.confidence * 100),
          impact: 'high',
          detectedAt: new Date().toISOString(),
          data: {
            trend,
            recentScores,
            predictedScore: trend.predictedValue
          },
          recommendations: [
            'Conduct a comprehensive content audit',
            'Update your schema markup',
            'Refresh your entity coverage',
            'Optimize for voice search patterns',
            'Consider using an optimization playbook'
          ]
        });
      }
    }

    return new Response(
      JSON.stringify({
        anomalies,
        analysisMetadata: {
          userId,
          sensitivityLevel: sensitivity,
          timeframe,
          thresholds,
          dataPoints: {
            auditHistory: auditHistory?.length || 0,
            userActivity: userActivity?.length || 0
          },
          analyzedAt: new Date().toISOString()
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Anomaly detection error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to detect anomalies',
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function calculateTrend(scores: number[]) {
  if (scores.length < 3) return { direction: 'stable', confidence: 0, predictedValue: scores[scores.length - 1], slope: 0 };

  // Simple linear regression
  const n = scores.length;
  const x = Array.from({ length: n }, (_, i) => i);
  const y = scores;
  
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  // Calculate R-squared for confidence
  const yMean = sumY / n;
  const ssRes = y.reduce((sum, yi, i) => sum + Math.pow(yi - (slope * i + intercept), 2), 0);
  const ssTot = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
  const rSquared = 1 - (ssRes / ssTot);
  
  const predictedValue = slope * (n + 2) + intercept; // Predict 2 periods ahead
  
  return {
    direction: slope > 1 ? 'improving' : slope < -1 ? 'declining' : 'stable',
    confidence: Math.max(0, Math.min(1, rSquared)),
    predictedValue: Math.max(0, Math.min(100, predictedValue)),
    slope
  };
}

function getRecommendationsForSubscore(subscore: string): string[] {
  switch (subscore) {
    case 'ai_understanding':
      return [
        'Improve content clarity and structure',
        'Add more context and definitions',
        'Use simpler sentence structures',
        'Include more entity relationships',
        'Add explanatory content for complex topics'
      ];
    case 'citation_likelihood':
      return [
        'Add more factual, citable information',
        'Include statistics and data points',
        'Improve content authority signals',
        'Add expert quotes or references',
        'Structure content for easy extraction'
      ];
    case 'conversational_readiness':
      return [
        'Add more question-answer content',
        'Use natural language patterns',
        'Include conversational transitions',
        'Optimize for voice search queries',
        'Add FAQ sections to key pages'
      ];
    case 'content_structure':
      return [
        'Improve heading hierarchy (H1-H6)',
        'Add more structured data markup',
        'Use lists and tables for organization',
        'Improve semantic HTML structure',
        'Add clear section demarcations'
      ];
    default:
      return [
        'Run a comprehensive audit',
        'Review recent content changes',
        'Check technical implementation',
        'Update schema markup',
        'Optimize content structure'
      ];
  }
}