import React, { useState, useEffect } from 'react';
import { FileText, Download, Calendar, BarChart3, Target, Loader, X, TrendingUp, DollarSign, Users, Zap } from 'lucide-react';
import { userDataService, type Report } from '../services/userDataService';
import { apiService } from '../services/api';
import { supabase } from '../lib/supabase';

interface ReportGeneratorProps {
  userPlan: 'free' | 'core' | 'pro' | 'agency';
}

interface ROIMetrics {
  estimatedTrafficIncrease: number;
  estimatedRevenueImpact: number;
  costSavingsFromAI: number;
  competitiveAdvantage: number;
  brandVisibilityScore: number;
}

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  color: string;
  sections: string[];
  roiMetrics: boolean;
  customizable: boolean;
  planRequired: 'free' | 'core' | 'pro' | 'agency';
}

const ReportGenerator: React.FC<ReportGeneratorProps> = ({ userPlan }) => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [reportConfig, setReportConfig] = useState({
    type: 'audit' as 'audit' | 'competitive' | 'citation' | 'comprehensive' | 'roi_focused',
    name: '',
    format: 'pdf' as 'pdf' | 'csv' | 'json',
    dateRange: '30d' as '7d' | '30d' | '90d' | 'all',
    includeRecommendations: true,
    includeCharts: true,
    includeHistory: true,
    includeROI: false,
    includeCompetitorBenchmarks: false,
    customMetrics: [] as string[],
    brandingOptions: {
      includeLogo: false,
      customColors: false,
      companyName: '',
      footerText: ''
    }
  });

  const reportTemplates: ReportTemplate[] = [
    {
      id: 'executive-summary',
      name: 'Executive Summary',
      description: 'High-level overview with ROI metrics and business impact',
      icon: TrendingUp,
      color: 'from-blue-500 to-blue-600',
      sections: ['Executive Summary', 'Key Metrics', 'ROI Analysis', 'Strategic Recommendations'],
      roiMetrics: true,
      customizable: true,
      planRequired: 'core'
    },
    {
      id: 'technical-audit',
      name: 'Technical Audit Report',
      description: 'Detailed technical analysis with implementation guidance',
      icon: Target,
      color: 'from-green-500 to-green-600',
      sections: ['Technical Analysis', 'Score Breakdown', 'Implementation Guide', 'Code Examples'],
      roiMetrics: false,
      customizable: true,
      planRequired: 'core'
    },
    {
      id: 'competitive-intelligence',
      name: 'Competitive Intelligence',
      description: 'Market positioning and competitive analysis with benchmarks',
      icon: Users,
      color: 'from-purple-500 to-purple-600',
      sections: ['Market Position', 'Competitor Analysis', 'Gap Analysis', 'Opportunity Matrix'],
      roiMetrics: true,
      customizable: true,
      planRequired: 'pro'
    },
    {
      id: 'roi-business-case',
      name: 'ROI & Business Case',
      description: 'Comprehensive business case with financial projections',
      icon: DollarSign,
      color: 'from-yellow-500 to-yellow-600',
      sections: ['Business Impact', 'Financial Projections', 'Cost-Benefit Analysis', 'Implementation Timeline'],
      roiMetrics: true,
      customizable: true,
      planRequired: 'pro'
    },
    {
      id: 'client-presentation',
      name: 'Client Presentation',
      description: 'White-labeled report for agency client presentations',
      icon: FileText,
      color: 'from-indigo-500 to-indigo-600',
      sections: ['Executive Summary', 'Performance Metrics', 'Recommendations', 'Next Steps'],
      roiMetrics: true,
      customizable: true,
      planRequired: 'agency'
    }
  ];

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const userReports = await userDataService.getUserReports(user.id);
        setReports(userReports);
      }
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateROIMetrics = async (reportData: any): Promise<ROIMetrics> => {
    // Simulate ROI calculations based on audit data
    const latestScore = reportData.auditHistory?.[0]?.overall_score || 70;
    const previousScore = reportData.auditHistory?.[1]?.overall_score || latestScore;
    const improvement = latestScore - previousScore;
    
    // Industry benchmarks and multipliers (these would come from real data in production)
    const baseTrafficMultiplier = 0.15; // 15% traffic increase per 10-point score improvement
    const revenuePerVisitor = 2.50; // Average revenue per visitor
    const adSpendReduction = 0.08; // 8% ad spend reduction per 10-point improvement
    const brandVisibilityMultiplier = 1.2;

    return {
      estimatedTrafficIncrease: Math.round((improvement / 10) * baseTrafficMultiplier * 100),
      estimatedRevenueImpact: Math.round((improvement / 10) * baseTrafficMultiplier * 1000 * revenuePerVisitor),
      costSavingsFromAI: Math.round((improvement / 10) * adSpendReduction * 5000), // Assuming $5k monthly ad spend
      competitiveAdvantage: Math.round(latestScore - 65), // Points above industry average
      brandVisibilityScore: Math.round(latestScore * brandVisibilityMultiplier)
    };
  };

  const generateReport = async () => {
    if (!reportConfig.name.trim()) {
      alert('Please enter a report name');
      return;
    }

    setGenerating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Gather comprehensive data based on report type
      let reportData: any = {};

      if (reportConfig.type === 'audit' || reportConfig.type === 'comprehensive' || reportConfig.type === 'roi_focused') {
        const auditHistory = await userDataService.getAuditHistory(user.id);
        reportData.auditHistory = auditHistory;
      }

      if (reportConfig.type === 'comprehensive' || reportConfig.type === 'roi_focused') {
        const profile = await userDataService.getUserProfile(user.id);
        const activity = await userDataService.getRecentActivity(user.id, 100);
        reportData.profile = profile;
        reportData.activity = activity;
      }

      // Calculate ROI metrics if requested
      if (reportConfig.includeROI || reportConfig.type === 'roi_focused') {
        reportData.roiMetrics = await calculateROIMetrics(reportData);
      }

      // Add competitive benchmarks if requested
      if (reportConfig.includeCompetitorBenchmarks && reportData.profile?.competitors) {
        // Simulate competitive data (in production, this would come from actual competitor monitoring)
        reportData.competitiveBenchmarks = {
          industryAverage: 68,
          topPerformer: 89,
          yourRanking: Math.floor(Math.random() * 10) + 1,
          competitorScores: reportData.profile.competitors.map((comp: any) => ({
            name: comp.name,
            score: Math.floor(Math.random() * 40) + 50,
            trend: Math.random() > 0.5 ? 'improving' : 'declining'
          }))
        };
      }

      // Enhanced report generation with template support
      const enhancedReportData = {
        ...reportData,
        template: selectedTemplate,
        config: reportConfig,
        generatedAt: new Date().toISOString(),
        reportMetadata: {
          userPlan,
          includesROI: reportConfig.includeROI,
          includesCompetitive: reportConfig.includeCompetitorBenchmarks,
          customBranding: reportConfig.brandingOptions.includeLogo || reportConfig.brandingOptions.customColors
        }
      };

      // Generate the report
      const response = await apiService.generateReport(
        reportConfig.type,
        enhancedReportData,
        reportConfig.name,
        reportConfig.format
      );

      // Save report metadata with enhanced information
      await userDataService.saveReport({
        user_id: user.id,
        report_type: reportConfig.type,
        report_name: reportConfig.name,
        report_data: enhancedReportData,
        file_url: response.downloadUrl
      });

      // Refresh reports list
      await loadReports();
      setShowGenerator(false);
      setSelectedTemplate(null);
      setReportConfig({ ...reportConfig, name: '' });

      // Download the report
      if (response.downloadUrl) {
        // Create a temporary link element to trigger the download
        const link = document.createElement('a');
        link.href = response.downloadUrl;
        link.target = '_blank';
        link.download = response.fileName || 'report.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

    } catch (error) {
      console.error('Error generating report:', error);
      alert('Failed to generate report. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const deleteReport = async (reportId: string) => {
    if (!confirm('Are you sure you want to delete this report?')) return;

    try {
      await userDataService.deleteReport(reportId);
      await loadReports();
    } catch (error) {
      console.error('Error deleting report:', error);
      alert('Failed to delete report. Please try again.');
    }
  };

  const getReportIcon = (type: string) => {
    switch (type) {
      case 'audit': return FileText;
      case 'competitive': return BarChart3;
      case 'citation': return Target;
      case 'comprehensive': return Calendar;
      case 'roi_focused': return DollarSign;
      default: return FileText;
    }
  };

  const canGenerateReports = userPlan !== 'free';
  const availableTemplates = reportTemplates.filter(template => {
    const planHierarchy = { free: 0, core: 1, pro: 2, agency: 3 };
    const userLevel = planHierarchy[userPlan];
    const requiredLevel = planHierarchy[template.planRequired];
    return userLevel >= requiredLevel;
  });

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Advanced Reports</h2>
        {canGenerateReports ? (
          <button
            onClick={() => setShowGenerator(true)}
            className="bg-gradient-to-r from-teal-500 to-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:shadow-lg transition-all duration-300 flex items-center space-x-2"
          >
            <FileText className="w-4 h-4" />
            <span>Generate Report</span>
          </button>
        ) : (
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-2">Advanced reporting available with Core plan and above</p>
            <button className="bg-gradient-to-r from-teal-500 to-purple-600 text-white px-4 py-2 rounded-lg text-sm hover:shadow-lg transition-all duration-300">
              Upgrade Plan
            </button>
          </div>
        )}
      </div>

      {!canGenerateReports ? (
        <div className="bg-white rounded-xl shadow-sm p-8 border border-gray-100 text-center">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Advanced ROI-Focused Reporting</h3>
          <p className="text-gray-600 mb-4">
            Generate comprehensive PDF and CSV reports with ROI metrics, competitive benchmarks, and business impact analysis. Perfect for stakeholder presentations and business cases.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <DollarSign className="w-6 h-6 text-blue-600 mb-2" />
              <h4 className="font-medium text-blue-900">ROI Analysis</h4>
              <p className="text-sm text-blue-700">Estimated revenue impact and cost savings</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <Users className="w-6 h-6 text-purple-600 mb-2" />
              <h4 className="font-medium text-purple-900">Competitive Benchmarks</h4>
              <p className="text-sm text-purple-700">Compare against industry standards</p>
            </div>
          </div>
          <button className="bg-gradient-to-r from-teal-500 to-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:shadow-lg transition-all duration-300">
            Upgrade to Core Plan
          </button>
        </div>
      ) : reports.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-8 border border-gray-100 text-center">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Reports Yet</h3>
          <p className="text-gray-600 mb-4">
            Generate your first advanced report with ROI metrics and competitive analysis.
          </p>
          <button
            onClick={() => setShowGenerator(true)}
            className="bg-gradient-to-r from-teal-500 to-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:shadow-lg transition-all duration-300"
          >
            Generate First Report
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Reports</h3>
            <div className="space-y-4">
              {reports.map((report) => {
                const IconComponent = getReportIcon(report.report_type);
                return (
                  <div key={report.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="bg-gradient-to-r from-teal-500 to-purple-600 p-2 rounded-lg">
                        <IconComponent className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">{report.report_name}</h4>
                        <p className="text-sm text-gray-500">
                          {report.report_type.charAt(0).toUpperCase() + report.report_type.slice(1)} Report • 
                          {new Date(report.created_at).toLocaleDateString()}
                          {report.report_data?.roiMetrics && (
                            <span className="ml-2 bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded">
                              ROI Analysis
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {report.file_url && (
                        <a
                          href={report.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700 p-2 rounded-lg hover:bg-blue-50 transition-colors"
                          title="Download Report"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      )}
                      <button
                        onClick={() => deleteReport(report.id)}
                        className="text-red-600 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-colors"
                        title="Delete Report"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Report Generator Modal */}
      {showGenerator && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">Generate Advanced Report</h3>
              <button
                onClick={() => {
                  setShowGenerator(false);
                  setSelectedTemplate(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex flex-1 min-h-0">
              {/* Template Selection */}
              {!selectedTemplate ? (
                <div className="w-full p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Choose Report Template</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {availableTemplates.map((template) => {
                      const IconComponent = template.icon;
                      return (
                        <div
                          key={template.id}
                          onClick={() => setSelectedTemplate(template)}
                          className="p-4 border border-gray-200 rounded-lg hover:border-purple-300 hover:shadow-md transition-all cursor-pointer"
                        >
                          <div className="flex items-center space-x-3 mb-3">
                            <div className={`p-2 rounded-lg bg-gradient-to-r ${template.color}`}>
                              <IconComponent className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <h5 className="font-medium text-gray-900">{template.name}</h5>
                              <p className="text-xs text-gray-500">{template.planRequired.toUpperCase()} plan</p>
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                          <div className="space-y-1">
                            {template.sections.slice(0, 3).map((section, index) => (
                              <div key={index} className="text-xs text-gray-500">• {section}</div>
                            ))}
                          </div>
                          {template.roiMetrics && (
                            <div className="mt-2">
                              <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                                ROI Metrics
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Report Configuration */
                <div className="w-full p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                  <div className="flex items-center space-x-3 mb-6">
                    <button
                      onClick={() => setSelectedTemplate(null)}
                      className="text-purple-600 hover:text-purple-700"
                    >
                      ← Back
                    </button>
                    <div className={`p-2 rounded-lg bg-gradient-to-r ${selectedTemplate.color}`}>
                      <selectedTemplate.icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{selectedTemplate.name}</h4>
                      <p className="text-sm text-gray-500">{selectedTemplate.description}</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Report Name</label>
                      <input
                        type="text"
                        value={reportConfig.name}
                        onChange={(e) => setReportConfig({ ...reportConfig, name: e.target.value })}
                        placeholder="Q1 2025 AI Visibility Report"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Format</label>
                        <select
                          value={reportConfig.format}
                          onChange={(e) => setReportConfig({ ...reportConfig, format: e.target.value as any })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        >
                          <option value="pdf">PDF</option>
                          <option value="csv">CSV</option>
                          <option value="json">JSON</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
                        <select
                          value={reportConfig.dateRange}
                          onChange={(e) => setReportConfig({ ...reportConfig, dateRange: e.target.value as any })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        >
                          <option value="7d">Last 7 days</option>
                          <option value="30d">Last 30 days</option>
                          <option value="90d">Last 90 days</option>
                          <option value="all">All time</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h5 className="font-medium text-gray-900">Report Content</h5>
                      
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={reportConfig.includeRecommendations}
                          onChange={(e) => setReportConfig({ ...reportConfig, includeRecommendations: e.target.checked })}
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">Include actionable recommendations</span>
                      </label>

                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={reportConfig.includeCharts}
                          onChange={(e) => setReportConfig({ ...reportConfig, includeCharts: e.target.checked })}
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">Include charts and visualizations</span>
                      </label>

                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={reportConfig.includeHistory}
                          onChange={(e) => setReportConfig({ ...reportConfig, includeHistory: e.target.checked })}
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">Include historical performance data</span>
                      </label>

                      {selectedTemplate.roiMetrics && (
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={reportConfig.includeROI}
                            onChange={(e) => setReportConfig({ ...reportConfig, includeROI: e.target.checked })}
                            className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">
                            Include ROI analysis and business impact metrics
                            <span className="ml-1 bg-green-100 text-green-800 text-xs px-1 py-0.5 rounded">NEW</span>
                          </span>
                        </label>
                      )}

                      {['pro', 'agency'].includes(userPlan) && (
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={reportConfig.includeCompetitorBenchmarks}
                            onChange={(e) => setReportConfig({ ...reportConfig, includeCompetitorBenchmarks: e.target.checked })}
                            className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">
                            Include competitive benchmarks and industry comparisons
                            <span className="ml-1 bg-purple-100 text-purple-800 text-xs px-1 py-0.5 rounded">PRO</span>
                          </span>
                        </label>
                      )}
                    </div>

                    {userPlan === 'agency' && (
                      <div className="space-y-3">
                        <h5 className="font-medium text-gray-900">White-Label Options</h5>
                        
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={reportConfig.brandingOptions.includeLogo}
                            onChange={(e) => setReportConfig({ 
                              ...reportConfig, 
                              brandingOptions: { ...reportConfig.brandingOptions, includeLogo: e.target.checked }
                            })}
                            className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">Include custom logo and branding</span>
                        </label>

                        <div className="grid grid-cols-2 gap-3">
                          <input
                            type="text"
                            placeholder="Company Name"
                            value={reportConfig.brandingOptions.companyName}
                            onChange={(e) => setReportConfig({ 
                              ...reportConfig, 
                              brandingOptions: { ...reportConfig.brandingOptions, companyName: e.target.value }
                            })}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                          <input
                            type="text"
                            placeholder="Footer Text"
                            value={reportConfig.brandingOptions.footerText}
                            onChange={(e) => setReportConfig({ 
                              ...reportConfig, 
                              brandingOptions: { ...reportConfig.brandingOptions, footerText: e.target.value }
                            })}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {selectedTemplate && (
              <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
                <button
                  onClick={() => setSelectedTemplate(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={generateReport}
                  disabled={generating || !reportConfig.name.trim()}
                  className="bg-gradient-to-r from-teal-500 to-purple-600 text-white px-6 py-2 rounded-lg font-medium hover:shadow-lg transition-all duration-300 disabled:opacity-50 flex items-center space-x-2"
                >
                  {generating ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      <span>Generate Report</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportGenerator;