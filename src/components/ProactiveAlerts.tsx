import React, { useState, useEffect } from 'react';
import { Bell, TrendingUp, TrendingDown, AlertTriangle, Info, X, Eye, ExternalLink } from 'lucide-react';
import { userDataService } from '../services/userDataService';
import { supabase } from '../lib/supabase';

interface Alert {
  id: string;
  type: 'score_change' | 'competitor_update' | 'industry_trend' | 'recommendation' | 'milestone';
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
  actionUrl?: string;
  actionLabel?: string;
  data?: any;
  createdAt: string;
  read: boolean;
}

interface ProactiveAlertsProps {
  user: any;
  userPlan: 'free' | 'core' | 'pro' | 'agency';
}

const ProactiveAlerts: React.FC<ProactiveAlertsProps> = ({ user, userPlan }) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [showAlerts, setShowAlerts] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      generateProactiveAlerts();
      // Set up periodic alert checking
      const interval = setInterval(generateProactiveAlerts, 5 * 60 * 1000); // Every 5 minutes
      return () => clearInterval(interval);
    }
  }, [user]);

  const generateProactiveAlerts = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const profile = await userDataService.getUserProfile(user.id);
      const auditHistory = await userDataService.getAuditHistory(user.id, 10);
      const recentActivity = await userDataService.getRecentActivity(user.id, 20);

      const newAlerts: Alert[] = [];

      // Score change alerts
      if (auditHistory.length >= 2) {
        const latest = auditHistory[0];
        const previous = auditHistory[1];
        const scoreDiff = latest.overall_score - previous.overall_score;

        if (Math.abs(scoreDiff) >= 5) {
          newAlerts.push({
            id: `score_change_${latest.id}`,
            type: 'score_change',
            title: scoreDiff > 0 ? 'Score Improvement Detected!' : 'Score Decline Alert',
            message: `Your AI visibility score ${scoreDiff > 0 ? 'increased' : 'decreased'} by ${Math.abs(scoreDiff)} points (${previous.overall_score} → ${latest.overall_score})`,
            severity: Math.abs(scoreDiff) >= 15 ? 'high' : 'medium',
            actionUrl: '/audit',
            actionLabel: 'View Details',
            data: { scoreDiff, latest, previous },
            createdAt: latest.created_at,
            read: false
          });
        }
      }

      // Milestone alerts
      if (auditHistory.length > 0) {
        const latestScore = auditHistory[0].overall_score;
        if (latestScore >= 90 && !alerts.some(a => a.type === 'milestone' && a.data?.milestone === '90+')) {
          newAlerts.push({
            id: `milestone_90_${Date.now()}`,
            type: 'milestone',
            title: '🎉 Excellent AI Visibility!',
            message: `Congratulations! You've achieved a ${latestScore}/100 AI visibility score. Your content is highly optimized for AI systems.`,
            severity: 'low',
            actionUrl: '/competitive',
            actionLabel: 'Compare with Competitors',
            data: { milestone: '90+', score: latestScore },
            createdAt: new Date().toISOString(),
            read: false
          });
        }
      }

      // Activity-based recommendations
      const toolUsage = recentActivity.filter(a => a.activity_type === 'tool_used');
      const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentToolUsage = toolUsage.filter(a => new Date(a.created_at) > lastWeek);

      if (recentToolUsage.length === 0 && auditHistory.length > 0) {
        newAlerts.push({
          id: `inactive_${Date.now()}`,
          type: 'recommendation',
          title: 'Time for a Check-up?',
          message: 'You haven\'t used any optimization tools this week. Regular monitoring helps maintain your AI visibility.',
          severity: 'low',
          actionUrl: '/audit',
          actionLabel: 'Run Quick Audit',
          createdAt: new Date().toISOString(),
          read: false
        });
      }

      // Plan-specific alerts
      if (userPlan === 'free' && auditHistory.length >= 3) {
        newAlerts.push({
          id: `upgrade_suggestion_${Date.now()}`,
          type: 'recommendation',
          title: 'Unlock Advanced Insights',
          message: 'You\'ve run multiple audits! Upgrade to Core for detailed subscores and optimization tools.',
          severity: 'medium',
          actionUrl: '/billing',
          actionLabel: 'View Plans',
          createdAt: new Date().toISOString(),
          read: false
        });
      }

      // Industry trend alerts (simulated)
      if (['pro', 'agency'].includes(userPlan) && profile?.industry) {
        newAlerts.push({
          id: `trend_${Date.now()}`,
          type: 'industry_trend',
          title: 'Industry AI Trend Alert',
          message: `New AI optimization techniques are emerging in ${profile.industry}. Voice search optimization is becoming increasingly important.`,
          severity: 'medium',
          actionUrl: '/voice',
          actionLabel: 'Test Voice Optimization',
          data: { industry: profile.industry },
          createdAt: new Date().toISOString(),
          read: false
        });
      }

      // Filter out duplicates and set alerts
      const uniqueAlerts = newAlerts.filter(newAlert => 
        !alerts.some(existingAlert => existingAlert.id === newAlert.id)
      );

      if (uniqueAlerts.length > 0) {
        setAlerts(prev => [...uniqueAlerts, ...prev].slice(0, 10)); // Keep only 10 most recent
      }

    } catch (error) {
      console.error('Error generating proactive alerts:', error);
    } finally {
      setLoading(false);
    }
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
      case 'milestone': return TrendingUp;
      default: return Bell;
    }
  };

  const getSeverityColor = (severity: Alert['severity']) => {
    switch (severity) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
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
        <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 max-h-96 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Alerts & Insights</h3>
              <button
                onClick={() => setShowAlerts(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {loading && (
              <div className="text-xs text-gray-500 mt-1">Checking for updates...</div>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <Bell className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p>No alerts yet</p>
                <p className="text-xs">We'll notify you of important changes</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {alerts.map((alert) => {
                  const IconComponent = getAlertIcon(alert.type);
                  return (
                    <div
                      key={alert.id}
                      className={`p-4 hover:bg-gray-50 transition-colors ${!alert.read ? 'bg-blue-50' : ''}`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`p-2 rounded-lg ${getSeverityColor(alert.severity)}`}>
                          <IconComponent className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 text-sm">{alert.title}</h4>
                          <p className="text-gray-600 text-xs mt-1">{alert.message}</p>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-gray-400">
                              {new Date(alert.createdAt).toLocaleDateString()}
                            </span>
                            <div className="flex items-center space-x-2">
                              {alert.actionUrl && (
                                <button
                                  onClick={() => {
                                    markAsRead(alert.id);
                                    // In a real app, navigate to the URL
                                    console.log('Navigate to:', alert.actionUrl);
                                  }}
                                  className="text-xs text-blue-600 hover:text-blue-700 flex items-center space-x-1"
                                >
                                  <span>{alert.actionLabel}</span>
                                  <ExternalLink className="w-3 h-3" />
                                </button>
                              )}
                              <button
                                onClick={() => dismissAlert(alert.id)}
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
              <button
                onClick={() => setAlerts(prev => prev.map(a => ({ ...a, read: true })))}
                className="text-xs text-gray-600 hover:text-gray-900"
              >
                Mark all as read
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProactiveAlerts;