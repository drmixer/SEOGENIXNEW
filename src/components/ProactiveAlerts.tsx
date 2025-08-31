import React, { useState, useEffect, useRef } from 'react';
import { Bell, TrendingUp, TrendingDown, AlertTriangle, Info, X, Eye, ExternalLink, Brain, Target, Zap, Calendar, CheckCircle, ArrowRight } from 'lucide-react';
import { userDataService } from '../services/userDataService';
import { supabase } from '../lib/supabase';

interface Alert {
  id: string;
  type: 'score_change' | 'competitor_update' | 'industry_trend' | 'recommendation' | 'milestone' | 'anomaly' | 'predictive';
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  actionUrl?: string;
  actionLabel?: string;
  data?: any;
  createdAt: string;
  read: boolean;
  confidence?: number;
  impact?: 'low' | 'medium' | 'high';
  timeframe?: string;
  steps?: string[];
}

interface ProactiveAlertsProps {
  user: any;
  userPlan: 'free' | 'core' | 'pro' | 'agency';
}

const ProactiveAlerts: React.FC<ProactiveAlertsProps> = ({ user, userPlan }) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [showAlerts, setShowAlerts] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [alertThresholds, setAlertThresholds] = useState({
    scoreChangeThreshold: 10,
    competitorScoreThreshold: 15,
    industryTrendConfidence: 70,
    anomalyDetectionSensitivity: 'medium'
  });

  useEffect(() => {
    if (user) {
      generateProactiveAlerts();
      // Set up periodic alert checking for Pro/Agency users
      if (['pro', 'agency'].includes(userPlan)) {
        const interval = setInterval(generateProactiveAlerts, 10 * 60 * 1000); // Every 10 minutes
        return () => clearInterval(interval);
      }
    }
  }, [user, userPlan]);

  const generateProactiveAlerts = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const profile = await userDataService.getUserProfile(user.id);
      const auditHistory = await userDataService.getAuditHistory(user.id, 20);
      const recentActivity = await userDataService.getRecentActivity(user.id, 50);

      const newAlerts: Alert[] = [];

      // 1. ANOMALY DETECTION - Significant score changes
      if (auditHistory.length >= 3) {
        const latest = auditHistory[0];
        const previous = auditHistory[1];
        const baseline = auditHistory.slice(0, 5).reduce((sum, audit) => sum + audit.overall_score, 0) / Math.min(5, auditHistory.length);
        
        const scoreDiff = latest.overall_score - previous.overall_score;
        const baselineDiff = latest.overall_score - baseline;

        // Detect sudden score drops
        if (scoreDiff <= -alertThresholds.scoreChangeThreshold) {
          newAlerts.push({
            id: `score_drop_${latest.id}`,
            type: 'anomaly',
            title: '🚨 Significant Score Drop Detected',
            message: `Your AI visibility score dropped by ${Math.abs(scoreDiff)} points (${previous.overall_score} → ${latest.overall_score}). This requires immediate attention.`,
            severity: scoreDiff <= -20 ? 'critical' : 'high',
            actionUrl: 'audit',
            actionLabel: 'Investigate Issues',
            data: { scoreDiff, latest, previous, type: 'score_drop' },
            createdAt: latest.created_at,
            read: false,
            confidence: 95,
            impact: scoreDiff <= -20 ? 'high' : 'medium',
            timeframe: 'immediate',
            steps: [
              "Review recent content changes that might have affected your score",
              "Check if schema markup is still present and valid",
              "Verify that key content sections haven't been removed",
              "Run a new audit to confirm the drop",
              "Open the Content Editor to address identified issues"
            ]
          });
        }

        // Detect unusual patterns in subscores
        const subscore_changes = {
          ai_understanding: latest.ai_understanding - previous.ai_understanding,
          citation_likelihood: latest.citation_likelihood - previous.citation_likelihood,
          conversational_readiness: latest.conversational_readiness - previous.conversational_readiness,
          content_structure: latest.content_structure - previous.content_structure
        };

        const largestDrop = Math.min(...Object.values(subscore_changes));
        if (largestDrop <= -15) {
          const problematicArea = Object.entries(subscore_changes).find(([_, change]) => change === largestDrop)?.[0];
          newAlerts.push({
            id: `subscore_anomaly_${latest.id}`,
            type: 'anomaly',
            title: 'Subscore Anomaly Detected',
            message: `${problematicArea?.replace('_', ' ')} score dropped significantly by ${Math.abs(largestDrop)} points. This may indicate a specific technical issue.`,
            severity: 'high',
            actionUrl: 'editor',
            actionLabel: 'Fix Content Issues',
            data: { problematicArea, change: largestDrop },
            createdAt: latest.created_at,
            read: false,
            confidence: 88,
            impact: 'medium',
            steps: [
              `Run a detailed analysis of your ${problematicArea?.replace('_', ' ')} score`,
              "Review recent content changes in this specific area",
              "Check for technical issues that might affect this subscore",
              "Use the recommended tool to address the specific issues",
              "Run a follow-up audit to verify improvements"
            ]
          });
        }
      }

      // 2. PREDICTIVE INSIGHTS - Trend analysis
      if (auditHistory.length >= 5) {
        const recentScores = auditHistory.slice(0, 5).map(a => a.overall_score);
        const trend = calculateTrend(recentScores);
        
        if (trend.direction === 'declining' && trend.confidence > 0.7) {
          newAlerts.push({
            id: `declining_trend_${Date.now()}`,
            type: 'predictive',
            title: 'Declining Performance Trend',
            message: `Your scores show a declining trend over the last 5 audits. Predicted score in 2 weeks: ${Math.round(trend.predictedValue)}`,
            severity: trend.predictedValue < 60 ? 'high' : 'medium',
            actionUrl: 'playbooks',
            actionLabel: 'Start Optimization Playbook',
            data: { trend, predictedScore: trend.predictedValue },
            createdAt: new Date().toISOString(),
            read: false,
            confidence: Math.round(trend.confidence * 100),
            impact: 'high',
            timeframe: '2 weeks',
            steps: [
              "Review your content strategy and recent changes",
              "Identify patterns in declining subscores",
              "Start a comprehensive optimization playbook",
              "Focus on your weakest performance areas first",
              "Schedule regular audits to monitor progress"
            ]
          });
        }
      }

      // 3. COMPETITOR INTELLIGENCE (Pro/Agency only)
      if (['pro', 'agency'].includes(userPlan) && profile?.competitors?.length > 0) {
        // Simulate competitor score changes (in real implementation, this would come from actual competitor monitoring)
        const competitorAlerts = profile.competitors.slice(0, 2).map((competitor, index) => {
          const scoreIncrease = Math.floor(Math.random() * 20) + 10;
          if (Math.random() > 0.7) { // 30% chance of competitor improvement
            return {
              id: `competitor_surge_${competitor.url}_${Date.now()}`,
              type: 'competitor_update' as const,
              title: 'Competitor AI Visibility Surge',
              message: `${competitor.name} improved their AI visibility score by ${scoreIncrease} points. They may be implementing new optimization strategies.`,
              severity: scoreIncrease > 15 ? 'high' : 'medium' as const,
              actionUrl: 'competitive',
              actionLabel: 'Analyze Competitor',
              data: { competitor, scoreIncrease },
              createdAt: new Date().toISOString(),
              read: false,
              confidence: 75,
              impact: 'medium' as const,
              steps: [
                "Run a competitive analysis to understand their improvements",
                "Identify which areas they've improved most significantly",
                "Analyze their content changes and new strategies",
                "Implement similar improvements on your own content",
                "Monitor their ongoing optimization efforts"
              ]
            };
          }
          return null;
        }).filter(Boolean);

        newAlerts.push(...competitorAlerts);
      }

      // 4. INDUSTRY TREND ALERTS (Pro/Agency only)
      if (['pro', 'agency'].includes(userPlan) && profile?.industry) {
        // Simulate industry trend detection
        const industryTrends = [
          {
            trend: 'Voice search optimization',
            impact: 'AI systems are increasingly prioritizing conversational content',
            action: 'voice',
            steps: [
              "Test your content with voice search queries",
              "Add more conversational content and FAQs",
              "Implement question-answer format content",
              "Optimize for natural language patterns",
              "Monitor voice search performance regularly"
            ]
          },
          {
            trend: 'Entity-rich content',
            impact: 'Content with comprehensive entity coverage is getting more AI citations',
            action: 'entities',
            steps: [
              "Run an entity coverage analysis",
              "Identify missing important entities in your content",
              "Add clear definitions for key entities",
              "Establish relationships between entities",
              "Monitor citation improvements after implementation"
            ]
          },
          {
            trend: 'FAQ-structured content',
            impact: 'Q&A format content is being preferred by AI systems for direct answers',
            action: 'generator',
            steps: [
              "Generate FAQ content for your key topics",
              "Structure FAQs to match common user questions",
              "Implement FAQ schema markup",
              "Ensure answers are concise and informative",
              "Monitor how AI systems cite your FAQ content"
            ]
          }
        ];

        if (Math.random() > 0.8) { // 20% chance of industry trend alert
          const trend = industryTrends[Math.floor(Math.random() * industryTrends.length)];
          newAlerts.push({
            id: `industry_trend_${Date.now()}`,
            type: 'industry_trend',
            title: `Industry Trend: ${trend.trend}`,
            message: `Emerging trend in ${profile.industry}: ${trend.impact}`,
            severity: 'medium',
            actionUrl: trend.action,
            actionLabel: 'Adapt to Trend',
            data: { industry: profile.industry, trend },
            createdAt: new Date().toISOString(),
            read: false,
            confidence: alertThresholds.industryTrendConfidence,
            impact: 'medium',
            steps: trend.steps
          });
        }
      }

      // 5. MILESTONE AND ACHIEVEMENT ALERTS
      if (auditHistory.length > 0) {
        const latestScore = auditHistory[0].overall_score;
        const milestones = [
          { threshold: 90, title: 'Elite AI Visibility Achieved!', message: 'You\'ve reached the top 10% of AI visibility scores', steps: [
            "Share your achievement with stakeholders",
            "Document your successful strategies",
            "Focus on maintaining your excellent performance",
            "Consider running competitive analysis to stay ahead",
            "Explore advanced optimization techniques"
          ]},
          { threshold: 80, title: 'Excellent AI Visibility!', message: 'Your content is highly optimized for AI systems', steps: [
            "Identify which strategies contributed most to your success",
            "Apply these successful approaches to other content",
            "Set a goal to reach 90+ score",
            "Monitor for any performance fluctuations",
            "Consider competitive analysis to maintain your edge"
          ]},
          { threshold: 70, title: 'Good AI Visibility Milestone', message: 'You\'ve achieved a solid foundation for AI visibility', steps: [
            "Celebrate this important milestone",
            "Identify your next improvement targets",
            "Focus on your lowest subscore areas",
            "Implement more advanced optimization techniques",
            "Set a goal to reach 80+ score"
          ]}
        ];

        const achievedMilestone = milestones.find(m => 
          latestScore >= m.threshold && 
          !alerts.some(a => a.type === 'milestone' && a.data?.threshold === m.threshold)
        );

        if (achievedMilestone) {
          newAlerts.push({
            id: `milestone_${achievedMilestone.threshold}_${Date.now()}`,
            type: 'milestone',
            title: achievedMilestone.title,
            message: `${achievedMilestone.message} (Score: ${latestScore}/100)`,
            severity: 'low',
            actionUrl: 'competitive',
            actionLabel: 'Compare with Competitors',
            data: { milestone: achievedMilestone.threshold, score: latestScore },
            createdAt: new Date().toISOString(),
            read: false,
            confidence: 100,
            impact: 'low',
            steps: achievedMilestone.steps
          });
        }
      }

      // 6. PROACTIVE OPTIMIZATION SUGGESTIONS
      const lastToolUsage = recentActivity.filter(a => a.activity_type === 'tool_used');
      const daysSinceLastTool = lastToolUsage.length > 0 ? 
        (Date.now() - new Date(lastToolUsage[0].created_at).getTime()) / (1000 * 60 * 60 * 24) : 999;

      if (daysSinceLastTool > 7 && auditHistory.length > 0) {
        newAlerts.push({
          id: `proactive_optimization_${Date.now()}`,
          type: 'recommendation',
          title: 'Proactive Optimization Opportunity',
          message: 'It\'s been a week since your last optimization. Regular maintenance keeps your AI visibility competitive.',
          severity: 'low',
          actionUrl: 'audit',
          actionLabel: 'Run Health Check',
          data: { daysSinceLastTool },
          createdAt: new Date().toISOString(),
          read: false,
          confidence: 85,
          impact: 'medium',
          timeframe: 'this week',
          steps: [
            "Run a new AI visibility audit to check current status",
            "Review any changes in your scores since last audit",
            "Identify areas that need immediate attention",
            "Implement recommended optimizations",
            "Schedule regular maintenance checks"
          ]
        });
      }

      // 7. CONTENT FRESHNESS ALERTS
      if (auditHistory.length > 0 && profile?.websites?.length > 0) {
        const randomWebsite = profile.websites[Math.floor(Math.random() * profile.websites.length)];
        newAlerts.push({
          id: `content_freshness_${Date.now()}`,
          type: 'recommendation',
          title: 'Content Freshness Check',
          message: `${randomWebsite.name} may need content updates to maintain AI visibility. Fresh content is more likely to be cited.`,
          severity: 'low',
          actionUrl: 'editor',
          actionLabel: 'Update Content',
          data: { website: randomWebsite },
          createdAt: new Date().toISOString(),
          read: false,
          confidence: 70,
          impact: 'medium',
          timeframe: 'next 2 weeks',
          steps: [
            "Review your most important pages for outdated information",
            "Update statistics, dates, and references",
            "Add new sections addressing recent developments",
            "Refresh examples and case studies",
            "Run a new audit after updates to measure improvement"
          ]
        });
      }

      // Filter out duplicates and set alerts
      const uniqueAlerts = newAlerts.filter(newAlert => 
        !alerts.some(existingAlert => existingAlert.id === newAlert.id)
      );

      if (uniqueAlerts.length > 0) {
        setAlerts(prev => [...uniqueAlerts, ...prev].slice(0, 15)); // Keep only 15 most recent
      }

    } catch (error) {
      console.error('Error generating proactive alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTrend = (scores: number[]) => {
    if (scores.length < 3) return { direction: 'stable', confidence: 0, predictedValue: scores[0] };

    // Simple linear regression
    const n = scores.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = scores.reverse(); // Oldest to newest
    
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
      confidence: Math.max(0, rSquared),
      predictedValue: Math.max(0, Math.min(100, predictedValue)),
      slope
    };
  };

  const markAsRead = (alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId ? { ...alert, read: true } : alert
    ));
  };

  const dismissAlert = (alertId: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  };

  const unreadCount = alerts.filter(a => !a.read).length;

  const getAlertIcon = (type: Alert['type']) => {
    switch (type) {
      case 'score_change': return TrendingUp;
      case 'competitor_update': return Eye;
      case 'industry_trend': return Info;
      case 'recommendation': return AlertTriangle;
      case 'milestone': return CheckCircle;
      case 'anomaly': return AlertTriangle;
      case 'predictive': return Brain;
      default: return Bell;
    }
  };

  const getSeverityColor = (severity: Alert['severity']) => {
    switch (severity) {
      case 'critical': return 'text-red-700 bg-red-100 border-red-300';
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'text-green-600';
    if (confidence >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const handleActionClick = (alert: Alert) => {
    if (alert.actionUrl) {
      // Mark as read
      markAsRead(alert.id);
      
      // Dispatch a custom event that Dashboard can listen for
      const event = new CustomEvent('alertAction', { 
        detail: { 
          actionUrl: alert.actionUrl,
          alertId: alert.id
        } 
      });
      window.dispatchEvent(event);
      
      // Close the alerts dropdown
      setShowAlerts(false);
      setSelectedAlert(null);
    }
  };

  return (
    <div className="relative">
      {/* Alert Bell Button */}
      <button
        onClick={() => setShowAlerts(!showAlerts)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Alerts Dropdown */}
      {showAlerts && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 max-h-[80vh] overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Smart Alerts & Insights</h3>
              <button
                onClick={() => setShowAlerts(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {loading && (
              <div className="text-xs text-gray-500 mt-1">Analyzing patterns...</div>
            )}
            {['pro', 'agency'].includes(userPlan) && (
              <div className="text-xs text-green-600 mt-1">✨ Advanced anomaly detection enabled</div>
            )}
          </div>

          <div className="max-h-[calc(80vh-60px)] overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <Brain className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p>No alerts yet</p>
                <p className="text-xs">AI monitoring is active and learning your patterns</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {alerts.map((alert) => {
                  const IconComponent = getAlertIcon(alert.type);
                  return (
                    <div
                      key={alert.id}
                      className={`p-4 hover:bg-gray-50 transition-colors ${!alert.read ? 'bg-blue-50' : ''}`}
                      onClick={() => setSelectedAlert(alert)}
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`p-2 rounded-lg ${getSeverityColor(alert.severity)}`}>
                          <IconComponent className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <h4 className="font-medium text-gray-900 text-sm">{alert.title}</h4>
                            {alert.severity === 'critical' && (
                              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                                URGENT
                              </span>
                            )}
                          </div>
                          <p className="text-gray-600 text-xs mt-1">{alert.message}</p>
                          
                          {/* Enhanced metadata for advanced alerts */}
                          {(alert.confidence || alert.impact || alert.timeframe) && (
                            <div className="flex items-center space-x-3 mt-2 text-xs">
                              {alert.confidence && (
                                <span className={`${getConfidenceColor(alert.confidence)}`}>
                                  {alert.confidence}% confidence
                                </span>
                              )}
                              {alert.impact && (
                                <span className="text-gray-500">
                                  {alert.impact} impact
                                </span>
                              )}
                              {alert.timeframe && (
                                <span className="text-gray-500">
                                  {alert.timeframe}
                                </span>
                              )}
                            </div>
                          )}
                          
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-gray-400">
                              {new Date(alert.createdAt).toLocaleDateString()}
                            </span>
                            <div className="flex items-center space-x-2">
                              {alert.actionUrl && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleActionClick(alert);
                                  }}
                                  className="text-xs text-blue-600 hover:text-blue-700 flex items-center space-x-1"
                                >
                                  <span>{alert.actionLabel}</span>
                                  <ExternalLink className="w-3 h-3" />
                                </button>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  dismissAlert(alert.id);
                                }}
                                className="text-xs text-gray-400 hover:text-gray-600"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {alerts.length > 0 && (
            <div className="p-3 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setAlerts(prev => prev.map(a => ({ ...a, read: true })))}
                  className="text-xs text-gray-600 hover:text-gray-900"
                >
                  Mark all as read
                </button>
                {['pro', 'agency'].includes(userPlan) && (
                  <span className="text-xs text-purple-600">
                    🧠 AI-powered insights
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Alert Details Modal */}
      {selectedAlert && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${getSeverityColor(selectedAlert.severity)}`}>
                  {(() => { const Icon = getAlertIcon(selectedAlert.type); return <Icon className="w-5 h-5" />; })()}
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">{selectedAlert.title}</h3>
                  <p className="text-sm text-gray-500">
                    {new Date(selectedAlert.createdAt).toLocaleString()}
                    {selectedAlert.confidence && (
                      <span className="ml-2">• {selectedAlert.confidence}% confidence</span>
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedAlert(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="space-y-6">
                <div className={`p-4 rounded-lg ${getSeverityColor(selectedAlert.severity)}`}>
                  <p className="text-base">{selectedAlert.message}</p>
                </div>
                
                {selectedAlert.impact && (
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-gray-700">Impact:</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      selectedAlert.impact === 'high' ? 'bg-red-100 text-red-800' :
                      selectedAlert.impact === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {selectedAlert.impact.toUpperCase()}
                    </span>
                  </div>
                )}
                
                {selectedAlert.timeframe && (
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-gray-600" />
                    <span className="text-gray-700">Timeframe: {selectedAlert.timeframe}</span>
                  </div>
                )}
                
                {selectedAlert.steps && selectedAlert.steps.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Recommended Steps:</h4>
                    <div className="space-y-2">
                      {selectedAlert.steps.map((step, index) => (
                        <div key={index} className="flex items-start space-x-3">
                          <div className="bg-purple-100 text-purple-800 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                            {index + 1}
                          </div>
                          <p className="text-gray-700">{step}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {selectedAlert.data && selectedAlert.type === 'anomaly' && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">Anomaly Details:</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Previous Score:</span>
                        <span className="font-medium">{selectedAlert.data.previous?.overall_score || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Current Score:</span>
                        <span className="font-medium">{selectedAlert.data.latest?.overall_score || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Change:</span>
                        <span className={`font-medium ${selectedAlert.data.scoreDiff < 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {selectedAlert.data.scoreDiff > 0 ? '+' : ''}{selectedAlert.data.scoreDiff}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                
                {selectedAlert.data && selectedAlert.type === 'predictive' && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">Prediction Details:</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Current Trend:</span>
                        <span className="font-medium capitalize">{selectedAlert.data.trend?.direction || 'Unknown'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Predicted Score:</span>
                        <span className="font-medium">{Math.round(selectedAlert.data.predictedScore || 0)}/100</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Confidence:</span>
                        <span className="font-medium">{selectedAlert.confidence}%</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  markAsRead(selectedAlert.id);
                  setSelectedAlert(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Dismiss
              </button>
              {selectedAlert.actionUrl && (
                <button
                  onClick={() => handleActionClick(selectedAlert)}
                  className="bg-gradient-to-r from-teal-500 to-purple-600 text-white px-6 py-2 rounded-lg font-medium hover:shadow-lg transition-all duration-300 flex items-center space-x-2"
                >
                  <span>{selectedAlert.actionLabel}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProactiveAlerts;
