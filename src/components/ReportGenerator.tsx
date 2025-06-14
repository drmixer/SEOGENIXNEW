import React, { useState } from 'react';
import { FileText, Download, Loader, X, Star, RefreshCw, AlertTriangle, Brain, FileText as FileTextIcon, Lightbulb } from 'lucide-react';
import { reportService, type ReportOptions } from '../services/reportService';
import ReportList from './ReportList';

interface ReportGeneratorProps {
  userPlan: 'free' | 'core' | 'pro' | 'agency';
}

const ReportGenerator: React.FC<ReportGeneratorProps> = ({ userPlan }) => {
  const [showGenerator, setShowGenerator] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [reportConfig, setReportConfig] = useState<ReportOptions>({
    format: 'html',
    includeRecommendations: true,
    includeCharts: true,
    includeHistory: true,
    includeROI: false,
    includeCompetitorBenchmarks: false,
    brandingOptions: {
      includeLogo: false,
      customColors: false,
      companyName: '',
      footerText: ''
    }
  });
  const [reportName, setReportName] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReportList, setShowReportList] = useState(true);

  const reportTemplates = [
    {
      id: 'executive-summary',
      name: 'Executive Summary',
      description: 'High-level overview with ROI metrics and business impact',
      icon: Brain,
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
      icon: FileTextIcon,
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
      icon: Lightbulb,
      color: 'from-purple-500 to-purple-600',
      sections: ['Market Position', 'Competitor Analysis', 'Gap Analysis', 'Opportunity Matrix'],
      roiMetrics: true,
      customizable: true,
      planRequired: 'pro'
    }
  ];

  const canUseReports = userPlan !== 'free';
  const availableTemplates = reportTemplates.filter(template => {
    const planHierarchy = { free: 0, core: 1, pro: 2, agency: 3 };
    const userLevel = planHierarchy[userPlan];
    const requiredLevel = planHierarchy[template.planRequired as keyof typeof planHierarchy];
    return userLevel >= requiredLevel;
  });

  const handleGenerateReport = async () => {
    if (!reportName.trim()) {
      alert('Please enter a report name');
      return;
    }

    setGenerating(true);
    setError(null);
    
    try {
      // Simulate data for the report
      const reportData = {
        template: selectedTemplate,
        auditHistory: [
          {
            overall_score: 78,
            ai_understanding: 80,
            citation_likelihood: 75,
            conversational_readiness: 82,
            content_structure: 76,
            recommendations: [
              "Add more structured data markup for better AI comprehension",
              "Improve heading hierarchy with clear H1, H2, H3 structure",
              "Include FAQ sections to address common user questions",
              "Enhance entity definitions for key concepts",
              "Add more conversational elements for voice search"
            ],
            created_at: new Date().toISOString()
          },
          {
            overall_score: 72,
            ai_understanding: 74,
            citation_likelihood: 70,
            conversational_readiness: 75,
            content_structure: 70,
            created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
          }
        ],
        roiMetrics: reportConfig.includeROI ? {
          estimatedTrafficIncrease: 25,
          estimatedRevenueImpact: 5000,
          costSavingsFromAI: 2500,
          competitiveAdvantage: 12,
          brandVisibilityScore: 85,
          paybackPeriod: 2.5,
          totalROI: 180
        } : null
      };

      // Generate the report
      await reportService.generateReport(
        selectedTemplate.id,
        reportName,
        reportData,
        reportConfig
      );

      // Close the generator and show the report list
      setShowGenerator(false);
      setSelectedTemplate(null);
      setReportName('');
      setShowReportList(true);
      
    } catch (err) {
      console.error('Report generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  if (!canUseReports) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8 border border-gray-100 text-center">
        <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Advanced ROI-Focused Reporting</h3>
        <p className="text-gray-600 mb-4">
          Generate comprehensive HTML and PDF reports with ROI metrics, competitive benchmarks, and business impact analysis. Perfect for stakeholder presentations and business cases.
        </p>
        <button className="bg-gradient-to-r from-teal-500 to-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:shadow-lg transition-all duration-300">
          Upgrade to Core Plan
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Advanced Reports</h2>
        {showReportList && (
          <button
            onClick={() => {
              setShowGenerator(true);
              setShowReportList(false);
            }}
            className="bg-gradient-to-r from-teal-500 to-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:shadow-lg transition-all duration-300 flex items-center space-x-2"
          >
            <FileText className="w-4 h-4" />
            <span>Generate Report</span>
          </button>
        )}
      </div>

      {showReportList ? (
        <ReportList />
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          {/* Template Selection */}
          {!selectedTemplate ? (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Choose Report Template</h3>
                <button
                  onClick={() => {
                    setShowGenerator(false);
                    setShowReportList(true);
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <div className="p-6">
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
                  <h3 className="font-medium text-gray-900">{selectedTemplate.name}</h3>
                  <p className="text-sm text-gray-500">{selectedTemplate.description}</p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Report Name</label>
                  <input
                    type="text"
                    value={reportName}
                    onChange={(e) => setReportName(e.target.value)}
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
                      <option value="html">HTML Report</option>
                      <option value="pdf">PDF Document</option>
                      <option value="csv">CSV Data Export</option>
                      <option value="json">JSON Data Export</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium text-gray-900">Report Content</h4>
                  
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
                    <h4 className="font-medium text-gray-900">White-Label Options</h4>
                    
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={reportConfig.brandingOptions?.includeLogo}
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
                        value={reportConfig.brandingOptions?.companyName || ''}
                        onChange={(e) => setReportConfig({ 
                          ...reportConfig, 
                          brandingOptions: { ...reportConfig.brandingOptions, companyName: e.target.value }
                        })}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                      <input
                        type="text"
                        placeholder="Footer Text"
                        value={reportConfig.brandingOptions?.footerText || ''}
                        onChange={(e) => setReportConfig({ 
                          ...reportConfig, 
                          brandingOptions: { ...reportConfig.brandingOptions, footerText: e.target.value }
                        })}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                )}

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start">
                      <AlertTriangle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-800">{error}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setSelectedTemplate(null);
                    setReportName('');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleGenerateReport}
                  disabled={generating || !reportName.trim()}
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
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReportGenerator;