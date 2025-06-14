import React, { useState, useEffect, useRef } from 'react';
import { TrendingUp, TrendingDown, Calendar, BarChart3, Target, FileText, Search, Mic, Globe, Users, Zap, Lightbulb, Filter, SortAsc, SortDesc, ExternalLink, Eye, X, Download, RefreshCw, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import { userDataService, type AuditHistoryEntry, type UserActivity, type Report } from '../services/userDataService';
import { supabase } from '../lib/supabase';

interface HistoricalPerformanceProps {
  userPlan: 'free' | 'core' | 'pro' | 'agency';
  selectedWebsite?: string;
}

interface ActivityEntry {
  id: string;
  type: 'audit' | 'activity' | 'report';
  title: string;
  description: string;
  score?: number;
  icon: React.ComponentType<any>;
  color: string;
  date: string;
  data: any;
  website_url?: string;
}

interface TrendData {
  date: string;
  overallScore: number;
  aiUnderstanding?: number;
  citationLikelihood?: number;
  conversationalReadiness?: number;
  contentStructure?: number;
}

interface ComparisonWebsite {
  url: string;
  name: string;
  color: string;
  visible: boolean;
}

const HistoricalPerformance: React.FC<HistoricalPerformanceProps> = ({ userPlan, selectedWebsite }) => {
  const [allEntries, setAllEntries] = useState<ActivityEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [filterType, setFilterType] = useState<'all' | 'audit' | 'activity' | 'report'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'score'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedEntry, setSelectedEntry] = useState<ActivityEntry | null>(null);
  const [dataFetched, setDataFetched] = useState(false);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [showTrendView, setShowTrendView] = useState(false);
  const [activeMetric, setActiveMetric] = useState<'overallScore' | 'aiUnderstanding' | 'citationLikelihood' | 'conversationalReadiness' | 'contentStructure'>('overallScore');
  const [comparisonWebsites, setComparisonWebsites] = useState<ComparisonWebsite[]>([]);
  const [showComparisonSelector, setShowComparisonSelector] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showInsightPanel, setShowInsightPanel] = useState(true);
  const [insights, setInsights] = useState<{text: string, type: 'positive' | 'negative' | 'neutral'}[]>([]);
  const [performanceGoal, setPerformanceGoal] = useState<number | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const getToolIcon = (toolId: string) => {
    const iconMap: Record<string, React.ComponentType<any>> = {
      audit: FileText,
      schema: Target,
      citations: Search,
      voice: Mic,
      summaries: Globe,
      entities: Users,
      generator: Zap,
      optimizer: TrendingUp,
      prompts: Lightbulb,
      competitive: BarChart3
    };
    return iconMap[toolId] || FileText;
  };

  const getToolColor = (toolId: string) => {
    const colorMap: Record<string, string> = {
      audit: 'text-blue-600',
      schema: 'text-green-600',
      citations: 'text-purple-600',
      voice: 'text-indigo-600',
      summaries: 'text-teal-600',
      entities: 'text-pink-600',
      generator: 'text-yellow-600',
      optimizer: 'text-orange-600',
      prompts: 'text-cyan-600',
      competitive: 'text-red-600'
    };
    return colorMap[toolId] || 'text-gray-600';
  };

  useEffect(() => {
    // Only load data once to prevent redundant fetches
    if (!dataFetched) {
      loadAllData();
    }
  }, [selectedWebsite, dataFetched]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const entries: ActivityEntry[] = [];

      // Load audit history - use a single fetch with the largest limit we'll need
      let auditHistory: AuditHistoryEntry[];
      if (selectedWebsite) {
        auditHistory = await userDataService.getAuditHistoryForWebsite(user.id, selectedWebsite);
      } else {
        auditHistory = await userDataService.getAuditHistory(user.id);
      }

      // Process audit history for trend data
      processTrendData(auditHistory);

      // Load user profile to get all websites for comparison
      if (['pro', 'agency'].includes(userPlan)) {
        const profile = await userDataService.getUserProfile(user.id);
        if (profile?.websites) {
          const websiteColors = [
            'rgb(79, 70, 229)', // indigo-600
            'rgb(16, 185, 129)', // emerald-500
            'rgb(245, 158, 11)', // amber-500
            'rgb(239, 68, 68)', // red-500
            'rgb(6, 182, 212)', // cyan-500
            'rgb(168, 85, 247)', // purple-500
            'rgb(236, 72, 153)', // pink-500
          ];
          
          const websites = profile.websites.map((website, index) => ({
            url: website.url,
            name: website.name,
            color: websiteColors[index % websiteColors.length],
            visible: website.url === selectedWebsite
          }));
          
          setComparisonWebsites(websites);
        }
      }

      auditHistory.forEach(audit => {
        entries.push({
          id: audit.id,
          type: 'audit',
          title: 'AI Visibility Audit',
          description: `Overall score: ${audit.overall_score}/100`,
          score: audit.overall_score,
          icon: FileText,
          color: 'text-blue-600',
          date: audit.created_at,
          data: audit,
          website_url: audit.website_url
        });
      });

      // Load user activity (tool usage)
      const activities = await userDataService.getRecentActivity(user.id, 100);
      
      activities.forEach(activity => {
        if (activity.tool_id && activity.activity_type === 'tool_used') {
          // Filter by website if selected
          if (selectedWebsite && activity.website_url && activity.website_url !== selectedWebsite) {
            return;
          }

          const toolIcon = getToolIcon(activity.tool_id);
          const toolColor = getToolColor(activity.tool_id);
          
          entries.push({
            id: activity.id,
            type: 'activity',
            title: `${activity.tool_id.charAt(0).toUpperCase() + activity.tool_id.slice(1)} Tool`,
            description: `Tool executed successfully`,
            icon: toolIcon,
            color: toolColor,
            date: activity.created_at,
            data: activity,
            website_url: activity.website_url
          });
        } else if (activity.activity_type === 'audit_run') {
          // Filter by website if selected
          if (selectedWebsite && activity.activity_data?.url && activity.activity_data.url !== selectedWebsite) {
            return;
          }

          entries.push({
            id: activity.id,
            type: 'activity',
            title: 'Audit Completed',
            description: `Score: ${activity.activity_data?.score || 'N/A'}/100`,
            score: activity.activity_data?.score,
            icon: FileText,
            color: 'text-blue-600',
            date: activity.created_at,
            data: activity,
            website_url: activity.activity_data?.url
          });
        } else if (activity.activity_type === 'content_optimized') {
          entries.push({
            id: activity.id,
            type: 'activity',
            title: 'Content Optimized',
            description: `Improved by +${activity.activity_data?.improvement || 0} points`,
            score: activity.activity_data?.optimizedScore,
            icon: TrendingUp,
            color: 'text-orange-600',
            date: activity.created_at,
            data: activity
          });
        } else if (activity.activity_type === 'content_generated') {
          entries.push({
            id: activity.id,
            type: 'activity',
            title: 'Content Generated',
            description: `${activity.activity_data?.contentType || 'Content'} created`,
            icon: Zap,
            color: 'text-yellow-600',
            date: activity.created_at,
            data: activity
          });
        }
      });

      // Load reports
      const reports = await userDataService.getUserReports(user.id);
      
      reports.forEach(report => {
        entries.push({
          id: report.id,
          type: 'report',
          title: report.report_name,
          description: `${report.report_type.charAt(0).toUpperCase() + report.report_type.slice(1)} report generated`,
          icon: BarChart3,
          color: 'text-indigo-600',
          date: report.created_at,
          data: report
        });
      });

      setAllEntries(entries);
      setDataFetched(true);
      
      // Generate insights based on the data
      generateInsights(auditHistory);
      
      // Set a performance goal if there's enough data
      if (auditHistory.length > 0) {
        const latestScore = auditHistory[0].overall_score;
        setPerformanceGoal(Math.min(100, Math.round(latestScore * 1.15))); // 15% improvement goal
      }
    } catch (error) {
      console.error('Error loading historical data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Process audit history into trend data
  const processTrendData = (auditHistory: AuditHistoryEntry[]) => {
    if (!auditHistory || auditHistory.length === 0) return;
    
    // Sort by date (oldest to newest)
    const sortedAudits = [...auditHistory].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    
    const trends: TrendData[] = sortedAudits.map(audit => ({
      date: new Date(audit.created_at).toLocaleDateString(),
      overallScore: audit.overall_score,
      aiUnderstanding: audit.ai_understanding,
      citationLikelihood: audit.citation_likelihood,
      conversationalReadiness: audit.conversational_readiness,
      contentStructure: audit.content_structure
    }));
    
    setTrendData(trends);
  };

  // Generate insights based on audit history
  const generateInsights = (auditHistory: AuditHistoryEntry[]) => {
    if (!auditHistory || auditHistory.length < 2) {
      setInsights([{
        text: "Run more audits to see performance insights and trends over time.",
        type: "neutral"
      }]);
      return;
    }
    
    const newInsights: {text: string, type: 'positive' | 'negative' | 'neutral'}[] = [];
    
    // Get latest and previous audit
    const latest = auditHistory[0];
    const previous = auditHistory[1];
    
    // Overall score trend
    const scoreDiff = latest.overall_score - previous.overall_score;
    if (scoreDiff > 5) {
      newInsights.push({
        text: `Your overall score has improved by ${scoreDiff} points since your last audit. Keep up the good work!`,
        type: "positive"
      });
    } else if (scoreDiff < -5) {
      newInsights.push({
        text: `Your overall score has decreased by ${Math.abs(scoreDiff)} points since your last audit. Consider reviewing recent content changes.`,
        type: "negative"
      });
    } else {
      newInsights.push({
        text: `Your overall score has remained relatively stable (${scoreDiff > 0 ? '+' : ''}${scoreDiff} points).`,
        type: "neutral"
      });
    }
    
    // Subscore analysis
    const subscores = [
      { name: 'AI Understanding', current: latest.ai_understanding, previous: previous.ai_understanding },
      { name: 'Citation Likelihood', current: latest.citation_likelihood, previous: previous.citation_likelihood },
      { name: 'Conversational Readiness', current: latest.conversational_readiness, previous: previous.conversational_readiness },
      { name: 'Content Structure', current: latest.content_structure, previous: previous.content_structure }
    ];
    
    // Find biggest improvement and decline
    const changes = subscores.map(score => ({
      name: score.name,
      change: score.current - score.previous
    }));
    
    const biggestImprovement = changes.reduce((prev, current) => 
      (current.change > prev.change) ? current : prev, changes[0]);
      
    const biggestDecline = changes.reduce((prev, current) => 
      (current.change < prev.change) ? current : prev, changes[0]);
    
    if (biggestImprovement.change > 5) {
      newInsights.push({
        text: `Your ${biggestImprovement.name} score has improved significantly by ${biggestImprovement.change} points.`,
        type: "positive"
      });
    }
    
    if (biggestDecline.change < -5) {
      newInsights.push({
        text: `Your ${biggestDecline.name} score has declined by ${Math.abs(biggestDecline.change)} points. This area needs attention.`,
        type: "negative"
      });
    }
    
    // Long-term trend analysis if we have enough data
    if (auditHistory.length >= 4) {
      const oldestRecentAudit = auditHistory[auditHistory.length - 1];
      const longTermChange = latest.overall_score - oldestRecentAudit.overall_score;
      const auditsCount = auditHistory.length;
      
      if (longTermChange > 10) {
        newInsights.push({
          text: `You've improved your overall score by ${longTermChange} points over your last ${auditsCount} audits. Excellent progress!`,
          type: "positive"
        });
      } else if (longTermChange < -10) {
        newInsights.push({
          text: `Your overall score has declined by ${Math.abs(longTermChange)} points over your last ${auditsCount} audits. Consider a content strategy review.`,
          type: "negative"
        });
      }
    }
    
    // Add actionable recommendation based on lowest subscore
    const lowestSubscore = subscores.reduce((prev, current) => 
      (current.current < prev.current) ? current : prev, subscores[0]);
      
    if (lowestSubscore.current < 70) {
      let toolRecommendation = '';
      let actionText = '';
      
      switch(lowestSubscore.name) {
        case 'AI Understanding':
          toolRecommendation = 'entities';
          actionText = 'Run Entity Coverage Analyzer';
          break;
        case 'Citation Likelihood':
          toolRecommendation = 'citations';
          actionText = 'Check Citation Tracker';
          break;
        case 'Conversational Readiness':
          toolRecommendation = 'voice';
          actionText = 'Test Voice Assistants';
          break;
        case 'Content Structure':
          toolRecommendation = 'schema';
          actionText = 'Generate Schema Markup';
          break;
      }
      
      newInsights.push({
        text: `Your ${lowestSubscore.name} score (${lowestSubscore.current}) is your lowest area. Focus on improving this for better overall results.`,
        type: "negative",
        toolId: toolRecommendation,
        actionText
      });
    }
    
    setInsights(newInsights);
  };

  // Filter and sort entries
  useEffect(() => {
    let filtered = [...allEntries];

    // Filter by time range
    const now = new Date();
    filtered = filtered.filter(entry => {
      const entryDate = new Date(entry.date);
      const daysDiff = (now.getTime() - entryDate.getTime()) / (1000 * 3600 * 24);
      
      switch (timeRange) {
        case '7d': return daysDiff <= 7;
        case '30d': return daysDiff <= 30;
        case '90d': return daysDiff <= 90;
        default: return true;
      }
    });

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(entry => entry.type === filterType);
    }

    // Sort entries
    filtered.sort((a, b) => {
      if (sortBy === 'date') {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
      } else if (sortBy === 'score') {
        const scoreA = a.score || 0;
        const scoreB = b.score || 0;
        return sortOrder === 'desc' ? scoreB - scoreA : scoreA - scoreB;
      }
      return 0;
    });

    setFilteredEntries(filtered);
  }, [allEntries, timeRange, filterType, sortBy, sortOrder]);

  const getScoreColor = (score?: number) => {
    if (!score) return 'text-gray-500';
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const renderEntryDetails = (entry: ActivityEntry) => {
    switch (entry.type) {
      case 'audit':
        const audit = entry.data as AuditHistoryEntry;
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm text-gray-600">AI Understanding</div>
                <div className="text-lg font-semibold">{audit.ai_understanding}/100</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm text-gray-600">Citation Likelihood</div>
                <div className="text-lg font-semibold">{audit.citation_likelihood}/100</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm text-gray-600">Conversational</div>
                <div className="text-lg font-semibold">{audit.conversational_readiness}/100</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm text-gray-600">Content Structure</div>
                <div className="text-lg font-semibold">{audit.content_structure}/100</div>
              </div>
            </div>
            {audit.recommendations.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Recommendations:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  {audit.recommendations.slice(0, 3).map((rec, i) => (
                    <li key={i}>• {rec}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex justify-end">
              <button 
                className="text-sm text-purple-600 hover:text-purple-800 flex items-center space-x-1"
                onClick={() => {
                  setShowTrendView(true);
                  setActiveMetric('overallScore');
                }}
              >
                <span>View in Trends</span>
                <TrendingUp className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      
      case 'activity':
        const activity = entry.data as UserActivity;
        return (
          <div className="space-y-3">
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-sm text-gray-600">Activity Type</div>
              <div className="font-medium">{activity.activity_type.replace('_', ' ')}</div>
            </div>
            {activity.activity_data && Object.keys(activity.activity_data).length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Details:</h4>
                <div className="text-sm text-gray-600 space-y-1">
                  {Object.entries(activity.activity_data).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="capitalize">{key.replace('_', ' ')}:</span>
                      <span>{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      
      case 'report':
        const report = entry.data as Report;
        return (
          <div className="space-y-3">
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-sm text-gray-600">Report Type</div>
              <div className="font-medium">{report.report_type.charAt(0).toUpperCase() + report.report_type.slice(1)}</div>
            </div>
            {report.file_url && (
              <a
                href={report.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-2 text-blue-600 hover:text-blue-700"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Download Report</span>
              </a>
            )}
          </div>
        );
      
      default:
        return <div>No additional details available.</div>;
    }
  };

  const toggleWebsiteVisibility = (url: string) => {
    setComparisonWebsites(prev => 
      prev.map(website => 
        website.url === url 
          ? { ...website, visible: !website.visible } 
          : website
      )
    );
  };

  const exportData = async () => {
    setIsExporting(true);
    try {
      // Create CSV content
      let csv = 'Date,Type,Title,Score,Website\n';
      
      filteredEntries.forEach(entry => {
        const date = new Date(entry.date).toLocaleDateString();
        const type = entry.type;
        const title = entry.title.replace(/,/g, ' ');
        const score = entry.score || '';
        const website = entry.website_url || '';
        
        csv += `${date},${type},${title},${score},${website}\n`;
      });
      
      // Create download link
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.setAttribute('hidden', '');
      a.setAttribute('href', url);
      a.setAttribute('download', `performance_history_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Add toast notification
      addToast({
        id: `export-${Date.now()}`,
        type: 'success',
        title: 'Export Successful',
        message: 'Your performance history has been exported to CSV',
        duration: 3000,
        onClose: () => {}
      });
    } catch (error) {
      console.error('Error exporting data:', error);
      // Add error toast
      addToast({
        id: `export-error-${Date.now()}`,
        type: 'error',
        title: 'Export Failed',
        message: 'There was a problem exporting your data',
        duration: 4000,
        onClose: () => {}
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Simulate toast functionality
  const addToast = (toast: any) => {
    console.log('Toast:', toast);
    // In a real implementation, this would use the useToast hook
  };

  // Render trend chart
  const renderTrendChart = () => {
    if (trendData.length === 0) return null;
    
    const visibleWebsites = comparisonWebsites.filter(w => w.visible);
    const hasComparisonData = visibleWebsites.length > 1 && ['pro', 'agency'].includes(userPlan);
    
    // Chart dimensions
    const width = 800;
    const height = 300;
    const padding = { top: 20, right: 30, bottom: 40, left: 50 };
    
    // Calculate min and max values for y-axis
    const allValues = trendData.map(d => d[activeMetric] as number);
    const minValue = Math.max(0, Math.min(...allValues) - 10);
    const maxValue = Math.min(100, Math.max(...allValues) + 10);
    
    // X and Y scales
    const xScale = (i: number) => padding.left + (i * (width - padding.left - padding.right) / (trendData.length - 1));
    const yScale = (value: number) => height - padding.bottom - ((value - minValue) * (height - padding.top - padding.bottom) / (maxValue - minValue));
    
    // Generate path for trend line
    const generatePath = (data: TrendData[]) => {
      return data.map((point, i) => {
        const x = xScale(i);
        const y = yScale(point[activeMetric] as number);
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      }).join(' ');
    };
    
    // Format date for x-axis labels
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    };
    
    // Calculate performance goal line
    const goalLine = performanceGoal ? `M ${padding.left} ${yScale(performanceGoal)} L ${width - padding.right} ${yScale(performanceGoal)}` : '';
    
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <h3 className="text-lg font-semibold text-gray-900">Performance Trends</h3>
            <div className="flex space-x-2">
              {['overallScore', 'aiUnderstanding', 'citationLikelihood', 'conversationalReadiness', 'contentStructure'].map((metric) => (
                <button
                  key={metric}
                  onClick={() => setActiveMetric(metric as any)}
                  className={`px-3 py-1 text-xs rounded-full ${
                    activeMetric === metric 
                      ? 'bg-purple-600 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {metric === 'overallScore' ? 'Overall' : 
                   metric === 'aiUnderstanding' ? 'AI Understanding' :
                   metric === 'citationLikelihood' ? 'Citation' :
                   metric === 'conversationalReadiness' ? 'Conversational' : 'Structure'}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {['pro', 'agency'].includes(userPlan) && (
              <button
                onClick={() => setShowComparisonSelector(!showComparisonSelector)}
                className="flex items-center space-x-1 text-sm text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-lg transition-colors"
              >
                <span>Compare</span>
                {showComparisonSelector ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            )}
            
            <button
              onClick={() => setShowTrendView(false)}
              className="text-gray-600 hover:text-gray-900 p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {showComparisonSelector && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Select websites to compare:</h4>
            <div className="flex flex-wrap gap-2">
              {comparisonWebsites.map(website => (
                <button
                  key={website.url}
                  onClick={() => toggleWebsiteVisibility(website.url)}
                  className={`flex items-center space-x-1 px-3 py-1 rounded-full text-xs ${
                    website.visible 
                      ? 'bg-gray-800 text-white' 
                      : 'bg-gray-200 text-gray-700'
                  }`}
                  style={website.visible ? { backgroundColor: website.color } : {}}
                >
                  <span>{website.name}</span>
                  {website.visible ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                </button>
              ))}
            </div>
          </div>
        )}
        
        <div ref={chartRef} className="relative h-64 w-full">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
            {/* X and Y axes */}
            <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke="#e5e7eb" />
            <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} stroke="#e5e7eb" />
            
            {/* Y-axis labels */}
            {[0, 25, 50, 75, 100].filter(v => v >= minValue && v <= maxValue).map(value => (
              <g key={`y-${value}`}>
                <line 
                  x1={padding.left} 
                  y1={yScale(value)} 
                  x2={width - padding.right} 
                  y2={yScale(value)} 
                  stroke="#f3f4f6" 
                />
                <text 
                  x={padding.left - 10} 
                  y={yScale(value)} 
                  textAnchor="end" 
                  dominantBaseline="middle" 
                  fontSize="12" 
                  fill="#6b7280"
                >
                  {value}
                </text>
              </g>
            ))}
            
            {/* X-axis labels (dates) */}
            {trendData.map((point, i) => (
              i % Math.max(1, Math.floor(trendData.length / 5)) === 0 && (
                <text 
                  key={`x-${i}`}
                  x={xScale(i)} 
                  y={height - padding.bottom + 20} 
                  textAnchor="middle" 
                  fontSize="12" 
                  fill="#6b7280"
                >
                  {formatDate(point.date)}
                </text>
              )
            ))}
            
            {/* Performance goal line */}
            {performanceGoal && (
              <g>
                <path d={goalLine} stroke="#f59e0b" strokeWidth="2" strokeDasharray="5,5" />
                <text 
                  x={width - padding.right + 5} 
                  y={yScale(performanceGoal)} 
                  dominantBaseline="middle" 
                  fontSize="12" 
                  fill="#f59e0b"
                >
                  Goal: {performanceGoal}
                </text>
              </g>
            )}
            
            {/* Main trend line */}
            <path 
              d={generatePath(trendData)} 
              fill="none" 
              stroke="#8b5cf6" 
              strokeWidth="3" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
            />
            
            {/* Data points */}
            {trendData.map((point, i) => (
              <circle
                key={`point-${i}`}
                cx={xScale(i)}
                cy={yScale(point[activeMetric] as number)}
                r="4"
                fill="#8b5cf6"
              />
            ))}
            
            {/* Comparison lines for other websites */}
            {hasComparisonData && visibleWebsites.map((website, websiteIndex) => (
              websiteIndex > 0 && (
                <path 
                  key={`comp-${website.url}`}
                  d={generatePath(trendData)} 
                  fill="none" 
                  stroke={website.color} 
                  strokeWidth="2" 
                  strokeDasharray="5,5" 
                />
              )
            ))}
          </svg>
          
          {/* Legend */}
          <div className="absolute bottom-0 left-0 flex items-center space-x-4 text-xs text-gray-600">
            <div className="flex items-center space-x-1">
              <div className="w-3 h-1 bg-purple-600 rounded"></div>
              <span>Your Score</span>
            </div>
            {performanceGoal && (
              <div className="flex items-center space-x-1">
                <div className="w-3 h-1 bg-amber-500 rounded border-dashed border border-amber-500"></div>
                <span>Goal ({performanceGoal})</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Trend insights */}
        <div className="mt-4 p-4 bg-purple-50 rounded-lg">
          <h4 className="font-medium text-purple-900 mb-2">Trend Analysis</h4>
          <p className="text-sm text-purple-800">
            {trendData.length >= 3 ? (
              trendData[trendData.length - 1][activeMetric] > trendData[0][activeMetric] ?
                `Your ${activeMetric === 'overallScore' ? 'overall score' : activeMetric.replace(/([A-Z])/g, ' $1').toLowerCase()} has improved by ${Math.round(trendData[trendData.length - 1][activeMetric] as number - trendData[0][activeMetric] as number)} points over this period. Continue your optimization efforts to maintain this positive trend.` :
                trendData[trendData.length - 1][activeMetric] < trendData[0][activeMetric] ?
                  `Your ${activeMetric === 'overallScore' ? 'overall score' : activeMetric.replace(/([A-Z])/g, ' $1').toLowerCase()} has decreased by ${Math.round(trendData[0][activeMetric] as number - trendData[trendData.length - 1][activeMetric] as number)} points over this period. Consider revisiting your content strategy to reverse this trend.` :
                  `Your ${activeMetric === 'overallScore' ? 'overall score' : activeMetric.replace(/([A-Z])/g, ' $1').toLowerCase()} has remained stable over this period.`
            ) : (
              "Run more audits to see detailed trend analysis."
            )}
          </p>
        </div>
      </div>
    );
  };

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

  if (allEntries.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div className="text-center py-8">
          <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Activity Yet</h3>
          <p className="text-gray-600">Start using tools and running audits to see your performance history.</p>
        </div>
      </div>
    );
  }

  if (showTrendView) {
    return renderTrendChart();
  }

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <h2 className="text-2xl font-bold text-gray-900">Activity History</h2>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Time Range Filter */}
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

          {/* Type Filter */}
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="border border-gray-300 rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="all">All Activities</option>
              <option value="audit">Audits Only</option>
              <option value="activity">Tool Usage</option>
              <option value="report">Reports</option>
            </select>
          </div>

          {/* Sort Options */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setSortBy(sortBy === 'date' ? 'score' : 'date')}
              className="flex items-center space-x-1 text-sm text-gray-600 hover:text-gray-900"
            >
              {sortBy === 'date' ? <Calendar className="w-4 h-4" /> : <Target className="w-4 h-4" />}
              <span>{sortBy === 'date' ? 'Date' : 'Score'}</span>
            </button>
            <button
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              className="text-gray-600 hover:text-gray-900"
            >
              {sortOrder === 'desc' ? <SortDesc className="w-4 h-4" /> : <SortAsc className="w-4 h-4" />}
            </button>
          </div>
          
          {/* Export Button */}
          <button
            onClick={exportData}
            disabled={isExporting}
            className="flex items-center space-x-1 text-sm text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-lg transition-colors"
          >
            {isExporting ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>Export</span>
          </button>
          
          {/* View Trends Button */}
          {trendData.length > 0 && (
            <button
              onClick={() => setShowTrendView(true)}
              className="flex items-center space-x-1 text-sm text-purple-600 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 px-3 py-1 rounded-lg transition-colors"
            >
              <TrendingUp className="w-4 h-4" />
              <span>View Trends</span>
            </button>
          )}
        </div>
      </div>

      {/* Performance Insights Panel */}
      {showInsightPanel && insights.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Performance Insights</h3>
            <button 
              onClick={() => setShowInsightPanel(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="space-y-3">
            {insights.map((insight, index) => (
              <div 
                key={index} 
                className={`p-3 rounded-lg ${
                  insight.type === 'positive' ? 'bg-green-50 border-l-4 border-green-500' :
                  insight.type === 'negative' ? 'bg-red-50 border-l-4 border-red-500' :
                  'bg-blue-50 border-l-4 border-blue-500'
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className={`text-sm ${
                    insight.type === 'positive' ? 'text-green-800' :
                    insight.type === 'negative' ? 'text-red-800' :
                    'text-blue-800'
                  }`}>
                    {insight.text}
                  </p>
                  
                  {(insight as any).toolId && (
                    <button 
                      className={`text-xs px-3 py-1 rounded-full ${
                        insight.type === 'positive' ? 'bg-green-100 text-green-800' :
                        insight.type === 'negative' ? 'bg-red-100 text-red-800' :
                        'bg-blue-100 text-blue-800'
                      }`}
                      onClick={() => {
                        // In a real implementation, this would navigate to the tool
                        console.log(`Navigate to tool: ${(insight as any).toolId}`);
                      }}
                    >
                      {(insight as any).actionText}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          {performanceGoal && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Target className="w-4 h-4 text-purple-600" />
                  <span className="text-sm font-medium text-gray-900">Performance Goal</span>
                </div>
                <span className="text-sm font-medium text-purple-600">{performanceGoal}/100</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="h-2 rounded-full bg-gradient-to-r from-purple-500 to-purple-600"
                  style={{ width: `${performanceGoal}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Target score based on your current performance and improvement potential
              </p>
            </div>
          )}
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-gray-900">{allEntries.filter(e => e.type === 'audit').length}</div>
              <div className="text-sm text-gray-500">Audits Run</div>
            </div>
            <FileText className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-gray-900">{allEntries.filter(e => e.type === 'activity').length}</div>
              <div className="text-sm text-gray-500">Tools Used</div>
            </div>
            <Zap className="w-8 h-8 text-yellow-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-gray-900">{allEntries.filter(e => e.type === 'report').length}</div>
              <div className="text-sm text-gray-500">Reports Generated</div>
            </div>
            <BarChart3 className="w-8 h-8 text-indigo-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {Math.round(allEntries.filter(e => e.score).reduce((sum, e) => sum + (e.score || 0), 0) / allEntries.filter(e => e.score).length) || 0}
              </div>
              <div className="text-sm text-gray-500">Avg Score</div>
            </div>
            <Target className="w-8 h-8 text-green-600" />
          </div>
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Activity Timeline ({filteredEntries.length} entries)
          </h3>
          
          {filteredEntries.length === 0 ? (
            <div className="text-center py-8">
              <Filter className="w-8 h-8 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">No activities found for the selected filters.</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {filteredEntries.map((entry) => {
                const IconComponent = entry.icon;
                return (
                  <div key={entry.id} className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className={`p-2 rounded-lg bg-white ${entry.color}`}>
                      <IconComponent className="w-5 h-5" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-gray-900 truncate">{entry.title}</h4>
                        <div className="flex items-center space-x-2">
                          {entry.score && (
                            <span className={`text-sm font-medium ${getScoreColor(entry.score)}`}>
                              {entry.score}/100
                            </span>
                          )}
                          <button
                            onClick={() => setSelectedEntry(entry)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-600 mt-1">{entry.description}</p>
                      
                      <div className="flex items-center justify-between mt-2">
                        <div className="text-xs text-gray-500">
                          {new Date(entry.date).toLocaleDateString()} at {new Date(entry.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        {entry.website_url && (
                          <div className="text-xs text-gray-500 truncate max-w-xs">
                            {entry.website_url}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Entry Details Modal */}
      {selectedEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${selectedEntry.color}`}>
                  <selectedEntry.icon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">{selectedEntry.title}</h3>
                  <p className="text-sm text-gray-500">
                    {new Date(selectedEntry.date).toLocaleDateString()} at {new Date(selectedEntry.date).toLocaleTimeString()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedEntry(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              {renderEntryDetails(selectedEntry)}
            </div>
            
            <div className="flex items-center justify-end space-x-3 p-4 border-t border-gray-200">
              {selectedEntry.type === 'audit' && (
                <button
                  onClick={() => {
                    setSelectedEntry(null);
                    setShowTrendView(true);
                  }}
                  className="flex items-center space-x-2 text-purple-600 hover:text-purple-800"
                >
                  <TrendingUp className="w-4 h-4" />
                  <span>View in Trends</span>
                </button>
              )}
              <button
                onClick={() => setSelectedEntry(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoricalPerformance;