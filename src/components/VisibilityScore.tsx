import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Target, Brain, MessageSquare, FileText, RefreshCw } from 'lucide-react';
import { apiService, type AuditResult } from '../services/api';
import { userDataService } from '../services/userDataService';
import { supabase } from '../lib/supabase';

interface VisibilityScoreProps {
  userPlan: 'free' | 'core' | 'pro' | 'agency';
  selectedWebsite?: string;
}

const VisibilityScore: React.FC<VisibilityScoreProps> = ({ userPlan, selectedWebsite }) => {
  const [auditData, setAuditData] = useState<AuditResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasRunAudit, setHasRunAudit] = useState(false);
  const [weeklyChange, setWeeklyChange] = useState(0);

  // Enable subscores for all users during development
  const isDevelopment = true; // Set to false for production
  const hasSubscores = isDevelopment || userPlan !== 'free';

  // Helper function to safely extract hostname from URL
  const getHostname = (url: string): string => {
    try {
      return new URL(url).hostname;
    } catch {
      // Fallback: try to extract domain using regex
      const match = url.match(/^(?:https?:\/\/)?(?:www\.)?([^\/]+)/);
      return match ? match[1] : url;
    }
  };

  const runRealAudit = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Use selected website or fallback to example
      const urlToAudit = selectedWebsite || 'https://example.com';
      
      // Fetch real content from the website
      let websiteContent = '';
      try {
        const response = await fetch(urlToAudit, {
          headers: {
            'User-Agent': 'SEOGENIX AI Visibility Audit Bot 1.0'
          }
        });
        if (response.ok) {
          websiteContent = await response.text();
        }
      } catch (fetchError) {
        console.warn('Could not fetch website content, using URL only');
      }
      
      // Run real audit using Gemini API
      const result = await apiService.runAudit(urlToAudit, websiteContent);
      setAuditData(result);
      setHasRunAudit(true);
      localStorage.setItem('seogenix_audit_run', 'true');

      // Save audit result to history
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await userDataService.saveAuditResult({
            user_id: user.id,
            website_url: urlToAudit,
            overall_score: result.overallScore,
            ai_understanding: result.subscores.aiUnderstanding,
            citation_likelihood: result.subscores.citationLikelihood,
            conversational_readiness: result.subscores.conversationalReadiness,
            content_structure: result.subscores.contentStructure,
            recommendations: result.recommendations,
            issues: result.issues,
            audit_data: result
          });

          // Track audit activity
          await userDataService.trackActivity({
            user_id: user.id,
            activity_type: 'audit_run',
            activity_data: { 
              score: result.overallScore,
              url: urlToAudit,
              type: 'real_audit'
            }
          });
        }
      } catch (dbError) {
        console.error('Error saving audit result:', dbError);
      }

    } catch (err) {
      setError('Failed to run audit. Please try again.');
      console.error('Audit error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Load historical data and calculate trends
  useEffect(() => {
    const loadHistoricalData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          let auditHistory;
          
          if (selectedWebsite) {
            // Get audits for specific website
            auditHistory = await userDataService.getAuditHistoryForWebsite(user.id, selectedWebsite);
          } else {
            // Get all audits
            auditHistory = await userDataService.getAuditHistory(user.id, 10);
          }
          
          if (auditHistory.length > 0) {
            setHasRunAudit(true);
            
            // Use latest audit data
            const latest = auditHistory[0];
            setAuditData({
              overallScore: latest.overall_score,
              subscores: {
                aiUnderstanding: latest.ai_understanding,
                citationLikelihood: latest.citation_likelihood,
                conversationalReadiness: latest.conversational_readiness,
                contentStructure: latest.content_structure
              },
              recommendations: latest.recommendations,
              issues: latest.issues
            });

            // Calculate weekly change from real data
            if (auditHistory.length > 1) {
              const weekAgo = new Date();
              weekAgo.setDate(weekAgo.getDate() - 7);
              
              const weeklyAudits = auditHistory.filter(audit => 
                new Date(audit.created_at) >= weekAgo
              );
              
              if (weeklyAudits.length >= 2) {
                const oldestThisWeek = weeklyAudits[weeklyAudits.length - 1];
                const change = latest.overall_score - oldestThisWeek.overall_score;
                setWeeklyChange(change);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error loading historical data:', error);
      }
    };

    loadHistoricalData();

    // Also check localStorage for backward compatibility
    const auditRun = localStorage.getItem('seogenix_audit_run');
    if (auditRun && !hasRunAudit) {
      setHasRunAudit(true);
      if (hasSubscores) {
        runRealAudit();
      }
    }
  }, [selectedWebsite]);

  const overallScore = auditData?.overallScore || 0;
  
  const subscores = auditData ? [
    { name: 'AI Understanding', score: auditData.subscores.aiUnderstanding, icon: Brain, color: 'text-teal-600' },
    { name: 'Citation Likelihood', score: auditData.subscores.citationLikelihood, icon: Target, color: 'text-purple-600' },
    { name: 'Conversational Readiness', score: auditData.subscores.conversationalReadiness, icon: MessageSquare, color: 'text-indigo-600' },
    { name: 'Content Structure', score: auditData.subscores.contentStructure, icon: FileText, color: 'text-blue-600' }
  ] : [];

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'from-green-500 to-green-600';
    if (score >= 60) return 'from-yellow-500 to-yellow-600';
    return 'from-red-500 to-red-600';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Overall Score */}
      <div className="lg:col-span-1">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">AI Visibility Score</h3>
              {selectedWebsite && (
                <p className="text-xs text-gray-500 mt-1">
                  {getHostname(selectedWebsite)}
                </p>
              )}
            </div>
            <div className="flex items-center space-x-2">
              {weeklyChange !== 0 && (
                <div className={`flex items-center space-x-1 text-sm ${weeklyChange > 0 ? 'text-green-600' : weeklyChange < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                  {weeklyChange > 0 ? <TrendingUp className="w-4 h-4" /> : weeklyChange < 0 ? <TrendingDown className="w-4 h-4" /> : null}
                  <span>{weeklyChange > 0 ? '+' : ''}{weeklyChange}% this week</span>
                </div>
              )}
              {hasSubscores && (
                <button
                  onClick={runRealAudit}
                  disabled={isLoading}
                  className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  title="Run new audit"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
              )}
            </div>
          </div>
          
          <div className="relative">
            <div className="w-32 h-32 mx-auto mb-4">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  className="text-gray-200"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="url(#gradient)"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${overallScore * 2.51} 251`}
                  strokeLinecap="round"
                  className="transition-all duration-1000"
                />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#33D9C1" />
                    <stop offset="100%" stopColor="#971CB5" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className={`text-3xl font-bold ${getScoreColor(overallScore)}`}>{overallScore}</div>
                  <div className="text-sm text-gray-500">out of 100</div>
                </div>
              </div>
            </div>
          </div>
          
          {!hasRunAudit ? (
            <div className="text-center">
              <p className="text-gray-600 text-sm mb-4">
                Run your first AI visibility audit to see your score
              </p>
              <button
                onClick={runRealAudit}
                disabled={isLoading}
                className="bg-gradient-to-r from-teal-500 to-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:shadow-lg transition-all duration-300 disabled:opacity-50"
              >
                {isLoading ? 'Running Audit...' : 'Run First Audit'}
              </button>
            </div>
          ) : (
            <p className="text-center text-gray-600 text-sm">
              {auditData ? 
                'Real-time audit results from AI analysis' : 
                'Click refresh to run a new audit'
              }
            </p>
          )}
          
          {error && (
            <p className="text-center text-red-500 text-sm mt-2">{error}</p>
          )}
        </div>
      </div>
      
      {/* Subscores */}
      <div className="lg:col-span-2">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">
            AI Visibility Breakdown
            {!hasSubscores && !isDevelopment && (
              <span className="text-sm text-gray-500 ml-2">(Upgrade to Core for detailed breakdown)</span>
            )}
          </h3>
          
          {hasSubscores && auditData ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {subscores.map((subscore, index) => {
                const IconComponent = subscore.icon;
                return (
                  <div key={index} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <IconComponent className={`w-5 h-5 ${subscore.color}`} />
                        <span className="font-medium text-gray-900">{subscore.name}</span>
                      </div>
                      <span className={`font-bold ${getScoreColor(subscore.score)}`}>
                        {subscore.score}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full bg-gradient-to-r ${getScoreBg(subscore.score)} transition-all duration-1000`}
                        style={{ width: `${subscore.score}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : hasSubscores && !auditData ? (
            <div className="text-center py-8">
              <div className="text-gray-400 mb-4">
                <Target className="w-12 h-12 mx-auto" />
              </div>
              <p className="text-gray-600 mb-4">Run an audit to see detailed breakdown</p>
              <button
                onClick={runRealAudit}
                disabled={isLoading}
                className="bg-gradient-to-r from-teal-500 to-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:shadow-lg transition-all duration-300 disabled:opacity-50"
              >
                {isLoading ? 'Running Audit...' : 'Run Audit'}
              </button>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="bg-gray-50 rounded-lg p-6">
                <div className="text-gray-400 mb-2">
                  <Target className="w-12 h-12 mx-auto" />
                </div>
                <p className="text-gray-600 mb-4">Detailed breakdown available with Core plan and above</p>
                <button className="bg-gradient-to-r from-teal-500 to-purple-600 text-white px-4 py-2 rounded-lg text-sm hover:shadow-lg transition-all duration-300">
                  Upgrade to Core
                </button>
              </div>
            </div>
          )}
          
          {auditData && hasSubscores && auditData.recommendations && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Key Recommendations:</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                {auditData.recommendations.slice(0, 3).map((rec, index) => (
                  <li key={index}>• {rec}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VisibilityScore;