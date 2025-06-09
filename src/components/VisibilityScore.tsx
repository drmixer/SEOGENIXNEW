import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Target, Brain, MessageSquare, FileText, RefreshCw } from 'lucide-react';
import { apiService, type AuditResult } from '../services/api';

interface VisibilityScoreProps {
  userPlan: 'free' | 'core' | 'pro' | 'agency';
}

const VisibilityScore: React.FC<VisibilityScoreProps> = ({ userPlan }) => {
  const [auditData, setAuditData] = useState<AuditResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weeklyChange = 8;
  const hasSubscores = userPlan !== 'free';

  const runSampleAudit = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Run audit on a sample URL for demonstration
      const result = await apiService.runAudit('https://example.com', 'Sample content for AI visibility analysis');
      setAuditData(result);
    } catch (err) {
      setError('Failed to run audit. Please try again.');
      console.error('Audit error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Load sample data on component mount
  useEffect(() => {
    if (hasSubscores) {
      runSampleAudit();
    }
  }, [hasSubscores]);

  const overallScore = auditData?.overallScore || 72;
  
  const subscores = auditData ? [
    { name: 'AI Understanding', score: auditData.subscores.aiUnderstanding, icon: Brain, color: 'text-teal-600' },
    { name: 'Citation Likelihood', score: auditData.subscores.citationLikelihood, icon: Target, color: 'text-purple-600' },
    { name: 'Conversational Readiness', score: auditData.subscores.conversationalReadiness, icon: MessageSquare, color: 'text-indigo-600' },
    { name: 'Content Structure', score: auditData.subscores.contentStructure, icon: FileText, color: 'text-blue-600' }
  ] : [
    { name: 'AI Understanding', score: 85, icon: Brain, color: 'text-teal-600' },
    { name: 'Citation Likelihood', score: 68, icon: Target, color: 'text-purple-600' },
    { name: 'Conversational Readiness', score: 74, icon: MessageSquare, color: 'text-indigo-600' },
    { name: 'Content Structure', score: 61, icon: FileText, color: 'text-blue-600' }
  ];

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
            <h3 className="text-lg font-semibold text-gray-900">AI Visibility Score</h3>
            <div className="flex items-center space-x-2">
              <div className={`flex items-center space-x-1 text-sm ${weeklyChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {weeklyChange > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                <span>{weeklyChange > 0 ? '+' : ''}{weeklyChange}% this week</span>
              </div>
              {hasSubscores && (
                <button
                  onClick={runSampleAudit}
                  disabled={isLoading}
                  className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  title="Refresh audit"
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
          
          <p className="text-center text-gray-600 text-sm">
            {auditData ? 
              'Live audit results from your content analysis' : 
              'Your content is performing well for AI visibility with room for improvement in structure.'
            }
          </p>
          
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
            {!hasSubscores && (
              <span className="text-sm text-gray-500 ml-2">(Upgrade to Core for detailed breakdown)</span>
            )}
          </h3>
          
          {hasSubscores ? (
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
          
          {auditData && hasSubscores && (
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