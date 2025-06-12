import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Calendar, BarChart3, Target, FileText, Search, Mic, Globe, Users, Zap, Lightbulb, Filter, SortAsc, SortDesc, ExternalLink, Eye, X } from 'lucide-react';
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
    } catch (error) {
      console.error('Error loading historical data:', error);
    } finally {
      setLoading(false);
    }
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
        </div>
      </div>

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
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoricalPerformance;