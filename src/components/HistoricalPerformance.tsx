import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Calendar, BarChart3, Target } from 'lucide-react';
import { userDataService, type AuditHistoryEntry } from '../services/userDataService';
import { supabase } from '../lib/supabase';

interface HistoricalPerformanceProps {
  userPlan: 'free' | 'core' | 'pro' | 'agency';
  selectedWebsite?: string;
}

const HistoricalPerformance: React.FC<HistoricalPerformanceProps> = ({ userPlan, selectedWebsite }) => {
  const [auditHistory, setAuditHistory] = useState<AuditHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  useEffect(() => {
    const loadAuditHistory = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          let history;
          if (selectedWebsite) {
            history = await userDataService.getAuditHistoryForWebsite(user.id, selectedWebsite);
          } else {
            history = await userDataService.getAuditHistory(user.id);
          }
          
          // Filter by time range
          const now = new Date();
          const filtered = history.filter(entry => {
            const entryDate = new Date(entry.created_at);
            const daysDiff = (now.getTime() - entryDate.getTime()) / (1000 * 3600 * 24);
            
            switch (timeRange) {
              case '7d': return daysDiff <= 7;
              case '30d': return daysDiff <= 30;
              case '90d': return daysDiff <= 90;
              default: return true;
            }
          });
          
          setAuditHistory(filtered);
        }
      } catch (error) {
        console.error('Error loading audit history:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAuditHistory();
  }, [selectedWebsite, timeRange]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (auditHistory.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div className="text-center py-8">
          <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Historical Data</h3>
          <p className="text-gray-600">Run more audits to see your performance trends over time.</p>
        </div>
      </div>
    );
  }

  // Calculate trends
  const latestScore = auditHistory[0]?.overall_score || 0;
  const previousScore = auditHistory[1]?.overall_score || latestScore;
  const scoreChange = latestScore - previousScore;
  const scoreChangePercent = previousScore > 0 ? ((scoreChange / previousScore) * 100) : 0;

  // Calculate average scores
  const avgOverallScore = Math.round(auditHistory.reduce((sum, entry) => sum + entry.overall_score, 0) / auditHistory.length);
  const avgAIUnderstanding = Math.round(auditHistory.reduce((sum, entry) => sum + entry.ai_understanding, 0) / auditHistory.length);
  const avgCitationLikelihood = Math.round(auditHistory.reduce((sum, entry) => sum + entry.citation_likelihood, 0) / auditHistory.length);

  return (
    <div className="space-y-6">
      {/* Header with time range selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Performance History</h2>
        <div className="flex items-center space-x-2">
          <Calendar className="w-4 h-4 text-gray-500" />
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="border border-gray-300 rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Current Score</h3>
            <div className={`flex items-center space-x-1 text-sm ${scoreChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {scoreChange >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              <span>{scoreChange >= 0 ? '+' : ''}{scoreChange}</span>
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900">{latestScore}</div>
          <p className="text-sm text-gray-500">
            {scoreChangePercent >= 0 ? '+' : ''}{scoreChangePercent.toFixed(1)}% from last audit
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Average Score</h3>
            <Target className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-3xl font-bold text-gray-900">{avgOverallScore}</div>
          <p className="text-sm text-gray-500">Across {auditHistory.length} audits</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Best Score</h3>
            <BarChart3 className="w-4 h-4 text-green-600" />
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {Math.max(...auditHistory.map(entry => entry.overall_score))}
          </div>
          <p className="text-sm text-gray-500">Personal best</p>
        </div>
      </div>

      {/* Score Trends Chart (Simple visualization) */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Score Trends</h3>
        <div className="space-y-4">
          {/* Simple bar chart representation */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">AI Understanding</span>
              <span className="font-medium">{avgAIUnderstanding}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-teal-500 h-2 rounded-full transition-all duration-1000"
                style={{ width: `${avgAIUnderstanding}%` }}
              ></div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Citation Likelihood</span>
              <span className="font-medium">{avgCitationLikelihood}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-purple-500 h-2 rounded-full transition-all duration-1000"
                style={{ width: `${avgCitationLikelihood}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Audits List */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Audits</h3>
        <div className="space-y-4">
          {auditHistory.slice(0, 5).map((entry, index) => (
            <div key={entry.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <div className="flex items-center space-x-3">
                  <div className="text-sm font-medium text-gray-900">
                    {new URL(entry.website_url).hostname}
                  </div>
                  <div className={`text-sm px-2 py-1 rounded-full ${
                    entry.overall_score >= 80 ? 'bg-green-100 text-green-800' :
                    entry.overall_score >= 60 ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {entry.overall_score}/100
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(entry.created_at).toLocaleDateString()} at {new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <div className="text-right">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>AI: {entry.ai_understanding}</div>
                  <div>Citation: {entry.citation_likelihood}</div>
                  <div>Conv: {entry.conversational_readiness}</div>
                  <div>Struct: {entry.content_structure}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HistoricalPerformance;