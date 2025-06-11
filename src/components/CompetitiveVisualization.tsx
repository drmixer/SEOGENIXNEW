import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Eye, Users, Target, Download, Filter } from 'lucide-react';
import { userDataService } from '../services/userDataService';
import { apiService } from '../services/api';
import { supabase } from '../lib/supabase';

interface CompetitiveVisualizationProps {
  userPlan: 'free' | 'core' | 'pro' | 'agency';
}

interface CompetitorData {
  name: string;
  url: string;
  overallScore: number;
  subscores: {
    aiUnderstanding: number;
    citationLikelihood: number;
    conversationalReadiness: number;
    contentStructure: number;
  };
  entityCoverage: string[];
  lastUpdated: string;
}

interface VisualizationData {
  competitors: CompetitorData[];
  userSite: CompetitorData;
  industryAverage: number;
  trends: Array<{
    date: string;
    userScore: number;
    competitorAverage: number;
  }>;
}

const CompetitiveVisualization: React.FC<CompetitiveVisualizationProps> = ({ userPlan }) => {
  const [data, setData] = useState<VisualizationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<'overall' | 'aiUnderstanding' | 'citationLikelihood' | 'conversationalReadiness' | 'contentStructure'>('overall');
  const [timeRange, setTimeRange] = useState<'30d' | '90d' | '1y'>('30d');
  const [viewType, setViewType] = useState<'scores' | 'entities' | 'trends'>('scores');

  useEffect(() => {
    loadCompetitiveData();
  }, [timeRange]);

  const loadCompetitiveData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const profile = await userDataService.getUserProfile(user.id);
      const auditHistory = await userDataService.getAuditHistory(user.id, 20);

      if (!profile?.websites?.[0] || !profile?.competitors?.length) {
        setLoading(false);
        return;
      }

      // Simulate competitive analysis data
      const userSite: CompetitorData = {
        name: profile.websites[0].name,
        url: profile.websites[0].url,
        overallScore: auditHistory[0]?.overall_score || 75,
        subscores: {
          aiUnderstanding: auditHistory[0]?.ai_understanding || 78,
          citationLikelihood: auditHistory[0]?.citation_likelihood || 72,
          conversationalReadiness: auditHistory[0]?.conversational_readiness || 76,
          contentStructure: auditHistory[0]?.content_structure || 74
        },
        entityCoverage: ['AI', 'SEO', 'Technology', 'Marketing', 'Analytics'],
        lastUpdated: auditHistory[0]?.created_at || new Date().toISOString()
      };

      // Generate competitor data
      const competitors: CompetitorData[] = profile.competitors.map((comp, index) => ({
        name: comp.name,
        url: comp.url,
        overallScore: Math.floor(Math.random() * 40) + 60,
        subscores: {
          aiUnderstanding: Math.floor(Math.random() * 40) + 60,
          citationLikelihood: Math.floor(Math.random() * 40) + 60,
          conversationalReadiness: Math.floor(Math.random() * 40) + 60,
          contentStructure: Math.floor(Math.random() * 40) + 60
        },
        entityCoverage: generateEntityCoverage(index),
        lastUpdated: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
      }));

      // Generate trend data
      const trends = generateTrendData(userSite.overallScore, competitors, timeRange);

      setData({
        competitors,
        userSite,
        industryAverage: Math.round((userSite.overallScore + competitors.reduce((sum, c) => sum + c.overallScore, 0)) / (competitors.length + 1)),
        trends
      });

    } catch (error) {
      console.error('Error loading competitive data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateEntityCoverage = (index: number): string[] => {
    const allEntities = [
      'AI', 'SEO', 'Technology', 'Marketing', 'Analytics', 'Content', 'Strategy',
      'Digital', 'Optimization', 'Search', 'Automation', 'Data', 'Performance',
      'Growth', 'Innovation', 'Solutions', 'Platform', 'Tools', 'Insights'
    ];
    
    const count = Math.floor(Math.random() * 8) + 5;
    return allEntities.slice(index * 2, index * 2 + count);
  };

  const generateTrendData = (userScore: number, competitors: CompetitorData[], range: string) => {
    const days = range === '30d' ? 30 : range === '90d' ? 90 : 365;
    const points = Math.min(days / 7, 20); // Weekly points, max 20
    
    return Array.from({ length: points }, (_, i) => {
      const date = new Date(Date.now() - (points - i - 1) * 7 * 24 * 60 * 60 * 1000);
      const variation = (Math.random() - 0.5) * 10;
      const competitorAvg = competitors.reduce((sum, c) => sum + c.overallScore, 0) / competitors.length;
      
      return {
        date: date.toISOString().split('T')[0],
        userScore: Math.max(20, Math.min(100, userScore + variation)),
        competitorAverage: Math.max(20, Math.min(100, competitorAvg + (Math.random() - 0.5) * 8))
      };
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getMetricValue = (competitor: CompetitorData, metric: string) => {
    if (metric === 'overall') return competitor.overallScore;
    return competitor.subscores[metric as keyof typeof competitor.subscores];
  };

  const canUseVisualization = ['pro', 'agency'].includes(userPlan);

  if (!canUseVisualization) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8 border border-gray-100 text-center">
        <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Advanced Competitive Visualizations</h3>
        <p className="text-gray-600 mb-4">
          Interactive charts, heatmaps, and trend analysis. Available with Pro plan and above.
        </p>
        <button className="bg-gradient-to-r from-teal-500 to-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:shadow-lg transition-all duration-300">
          Upgrade to Pro Plan
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8 border border-gray-100 text-center">
        <Eye className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Competitive Data</h3>
        <p className="text-gray-600 mb-4">
          Add competitors in your profile to see advanced visualizations and comparisons.
        </p>
        <button className="bg-gradient-to-r from-teal-500 to-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:shadow-lg transition-all duration-300">
          Add Competitors
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <h2 className="text-2xl font-bold text-gray-900">Competitive Intelligence</h2>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={viewType}
              onChange={(e) => setViewType(e.target.value as any)}
              className="border border-gray-300 rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="scores">Score Comparison</option>
              <option value="entities">Entity Heatmap</option>
              <option value="trends">Trend Analysis</option>
            </select>
          </div>
          
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="border border-gray-300 rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
          
          <button className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 px-3 py-1 rounded-lg hover:bg-gray-100 transition-colors">
            <Download className="w-4 h-4" />
            <span className="text-sm">Export</span>
          </button>
        </div>
      </div>

      {viewType === 'scores' && (
        <div className="space-y-6">
          {/* Metric Selector */}
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'overall', label: 'Overall Score' },
                { key: 'aiUnderstanding', label: 'AI Understanding' },
                { key: 'citationLikelihood', label: 'Citation Likelihood' },
                { key: 'conversationalReadiness', label: 'Conversational' },
                { key: 'contentStructure', label: 'Content Structure' }
              ].map((metric) => (
                <button
                  key={metric.key}
                  onClick={() => setSelectedMetric(metric.key as any)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedMetric === metric.key
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {metric.label}
                </button>
              ))}
            </div>
          </div>

          {/* Score Comparison Chart */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">
              {selectedMetric === 'overall' ? 'Overall Score' : selectedMetric.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())} Comparison
            </h3>
            
            <div className="space-y-4">
              {/* User's site */}
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-purple-600 rounded-full"></div>
                    <span className="font-medium text-gray-900">{data.userSite.name} (You)</span>
                  </div>
                  <span className={`px-2 py-1 rounded text-sm font-medium ${getScoreColor(getMetricValue(data.userSite, selectedMetric))}`}>
                    {getMetricValue(data.userSite, selectedMetric)}/100
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className="bg-gradient-to-r from-purple-500 to-purple-600 h-3 rounded-full transition-all duration-1000"
                    style={{ width: `${getMetricValue(data.userSite, selectedMetric)}%` }}
                  ></div>
                </div>
              </div>

              {/* Competitors */}
              {data.competitors.map((competitor, index) => (
                <div key={competitor.url} className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full`} style={{ backgroundColor: `hsl(${index * 60}, 60%, 50%)` }}></div>
                      <span className="font-medium text-gray-900">{competitor.name}</span>
                    </div>
                    <span className={`px-2 py-1 rounded text-sm font-medium ${getScoreColor(getMetricValue(competitor, selectedMetric))}`}>
                      {getMetricValue(competitor, selectedMetric)}/100
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="h-3 rounded-full transition-all duration-1000"
                      style={{ 
                        width: `${getMetricValue(competitor, selectedMetric)}%`,
                        backgroundColor: `hsl(${index * 60}, 60%, 50%)`
                      }}
                    ></div>
                  </div>
                </div>
              ))}

              {/* Industry Average */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                    <span className="font-medium text-gray-900">Industry Average</span>
                  </div>
                  <span className={`px-2 py-1 rounded text-sm font-medium ${getScoreColor(data.industryAverage)}`}>
                    {data.industryAverage}/100
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-1000"
                    style={{ width: `${data.industryAverage}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewType === 'entities' && (
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Entity Coverage Heatmap</h3>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left p-3 font-medium text-gray-900">Entity</th>
                  <th className="text-center p-3 font-medium text-purple-600">{data.userSite.name}</th>
                  {data.competitors.map((comp) => (
                    <th key={comp.url} className="text-center p-3 font-medium text-gray-600">{comp.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from(new Set([
                  ...data.userSite.entityCoverage,
                  ...data.competitors.flatMap(c => c.entityCoverage)
                ])).slice(0, 15).map((entity) => (
                  <tr key={entity} className="border-t border-gray-100">
                    <td className="p-3 font-medium text-gray-900">{entity}</td>
                    <td className="p-3 text-center">
                      <div className={`w-6 h-6 rounded mx-auto ${
                        data.userSite.entityCoverage.includes(entity) 
                          ? 'bg-purple-600' 
                          : 'bg-gray-200'
                      }`}></div>
                    </td>
                    {data.competitors.map((comp) => (
                      <td key={comp.url} className="p-3 text-center">
                        <div className={`w-6 h-6 rounded mx-auto ${
                          comp.entityCoverage.includes(entity) 
                            ? 'bg-green-500' 
                            : 'bg-gray-200'
                        }`}></div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="mt-4 flex items-center space-x-4 text-sm text-gray-600">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-purple-600 rounded"></div>
              <span>Your coverage</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-green-500 rounded"></div>
              <span>Competitor coverage</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-gray-200 rounded"></div>
              <span>Not covered</span>
            </div>
          </div>
        </div>
      )}

      {viewType === 'trends' && (
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Score Trends Over Time</h3>
          
          <div className="relative h-64">
            <svg className="w-full h-full" viewBox="0 0 800 200">
              {/* Grid lines */}
              {[0, 25, 50, 75, 100].map((y) => (
                <line
                  key={y}
                  x1="50"
                  y1={200 - (y * 1.5) - 25}
                  x2="750"
                  y2={200 - (y * 1.5) - 25}
                  stroke="#f3f4f6"
                  strokeWidth="1"
                />
              ))}
              
              {/* Y-axis labels */}
              {[0, 25, 50, 75, 100].map((y) => (
                <text
                  key={y}
                  x="40"
                  y={200 - (y * 1.5) - 20}
                  fontSize="12"
                  fill="#6b7280"
                  textAnchor="end"
                >
                  {y}
                </text>
              ))}
              
              {/* User trend line */}
              <polyline
                points={data.trends.map((point, index) => 
                  `${50 + (index * (700 / (data.trends.length - 1)))},${200 - (point.userScore * 1.5) - 25}`
                ).join(' ')}
                fill="none"
                stroke="#8b5cf6"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              
              {/* Competitor average trend line */}
              <polyline
                points={data.trends.map((point, index) => 
                  `${50 + (index * (700 / (data.trends.length - 1)))},${200 - (point.competitorAverage * 1.5) - 25}`
                ).join(' ')}
                fill="none"
                stroke="#10b981"
                strokeWidth="2"
                strokeDasharray="5,5"
              />
              
              {/* Data points */}
              {data.trends.map((point, index) => (
                <g key={index}>
                  <circle
                    cx={50 + (index * (700 / (data.trends.length - 1)))}
                    cy={200 - (point.userScore * 1.5) - 25}
                    r="4"
                    fill="#8b5cf6"
                  />
                  <circle
                    cx={50 + (index * (700 / (data.trends.length - 1)))}
                    cy={200 - (point.competitorAverage * 1.5) - 25}
                    r="3"
                    fill="#10b981"
                  />
                </g>
              ))}
            </svg>
          </div>
          
          <div className="mt-4 flex items-center space-x-6 text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-1 bg-purple-600 rounded"></div>
              <span className="text-gray-600">Your Score</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-1 bg-green-500 rounded border-dashed border border-green-500"></div>
              <span className="text-gray-600">Competitor Average</span>
            </div>
          </div>
        </div>
      )}

      {/* Insights Panel */}
      <div className="bg-gradient-to-r from-teal-50 to-purple-50 rounded-xl p-6 border border-teal-200">
        <h3 className="font-semibold text-gray-900 mb-3">Competitive Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-700">
              <strong>Your Position:</strong> {
                data.userSite.overallScore > data.industryAverage ? 'Above' : 'Below'
              } industry average by {Math.abs(data.userSite.overallScore - data.industryAverage)} points
            </p>
          </div>
          <div>
            <p className="text-gray-700">
              <strong>Top Competitor:</strong> {
                data.competitors.sort((a, b) => b.overallScore - a.overallScore)[0]?.name
              } ({data.competitors.sort((a, b) => b.overallScore - a.overallScore)[0]?.overallScore}/100)
            </p>
          </div>
          <div>
            <p className="text-gray-700">
              <strong>Biggest Opportunity:</strong> {
                selectedMetric === 'overall' ? 'Content Structure' : 'Citation Likelihood'
              } optimization
            </p>
          </div>
          <div>
            <p className="text-gray-700">
              <strong>Market Position:</strong> {
                data.competitors.filter(c => c.overallScore < data.userSite.overallScore).length + 1
              } of {data.competitors.length + 1} in your competitive set
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompetitiveVisualization;