import React, { useState, useEffect } from 'react';
import { FileText, Download, Calendar, BarChart3, Target, Loader, X } from 'lucide-react';
import { userDataService, type Report } from '../services/userDataService';
import { apiService } from '../services/api';
import { supabase } from '../lib/supabase';

interface ReportGeneratorProps {
  userPlan: 'free' | 'core' | 'pro' | 'agency';
}

const ReportGenerator: React.FC<ReportGeneratorProps> = ({ userPlan }) => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [reportConfig, setReportConfig] = useState({
    type: 'audit' as 'audit' | 'competitive' | 'citation' | 'comprehensive',
    name: '',
    format: 'pdf' as 'pdf' | 'csv' | 'json',
    dateRange: '30d' as '7d' | '30d' | '90d' | 'all',
    includeRecommendations: true,
    includeCharts: true,
    includeHistory: true
  });

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

  const generateReport = async () => {
    if (!reportConfig.name.trim()) {
      alert('Please enter a report name');
      return;
    }

    setGenerating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Gather data based on report type
      let reportData: any = {};

      if (reportConfig.type === 'audit' || reportConfig.type === 'comprehensive') {
        const auditHistory = await userDataService.getAuditHistory(user.id);
        reportData.auditHistory = auditHistory;
      }

      if (reportConfig.type === 'comprehensive') {
        const profile = await userDataService.getUserProfile(user.id);
        const activity = await userDataService.getRecentActivity(user.id, 100);
        reportData.profile = profile;
        reportData.activity = activity;
      }

      // Generate the report
      const response = await apiService.generateReport(
        reportConfig.type,
        reportData,
        reportConfig.name,
        reportConfig.format
      );

      // Save report metadata
      await userDataService.saveReport({
        user_id: user.id,
        report_type: reportConfig.type,
        report_name: reportConfig.name,
        report_data: reportData,
        file_url: response.downloadUrl
      });

      // Refresh reports list
      await loadReports();
      setShowGenerator(false);
      setReportConfig({ ...reportConfig, name: '' });

      // Download the report
      if (response.downloadUrl) {
        window.open(response.downloadUrl, '_blank');
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
      default: return FileText;
    }
  };

  const canGenerateReports = userPlan !== 'free';

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
        <h2 className="text-2xl font-bold text-gray-900">Reports</h2>
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
            <p className="text-sm text-gray-500 mb-2">Reports available with Core plan and above</p>
            <button className="bg-gradient-to-r from-teal-500 to-purple-600 text-white px-4 py-2 rounded-lg text-sm hover:shadow-lg transition-all duration-300">
              Upgrade Plan
            </button>
          </div>
        )}
      </div>

      {!canGenerateReports ? (
        <div className="bg-white rounded-xl shadow-sm p-8 border border-gray-100 text-center">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Advanced Reporting</h3>
          <p className="text-gray-600 mb-4">
            Generate comprehensive PDF and CSV reports of your AI visibility audits, competitive analyses, and performance trends.
          </p>
          <button className="bg-gradient-to-r from-teal-500 to-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:shadow-lg transition-all duration-300">
            Upgrade to Core Plan
          </button>
        </div>
      ) : reports.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-8 border border-gray-100 text-center">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Reports Yet</h3>
          <p className="text-gray-600 mb-4">
            Generate your first report to track your AI visibility performance over time.
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
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {report.file_url && (
                        <button
                          onClick={() => window.open(report.file_url, '_blank')}
                          className="text-blue-600 hover:text-blue-700 p-2 rounded-lg hover:bg-blue-50 transition-colors"
                          title="Download Report"
                        >
                          <Download className="w-4 h-4" />
                        </button>
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

      {/* Report Generator Modal */}
      {showGenerator && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">Generate Report</h3>
              <button
                onClick={() => setShowGenerator(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Report Name</label>
                <input
                  type="text"
                  value={reportConfig.name}
                  onChange={(e) => setReportConfig({ ...reportConfig, name: e.target.value })}
                  placeholder="My AI Visibility Report"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Report Type</label>
                <select
                  value={reportConfig.type}
                  onChange={(e) => setReportConfig({ ...reportConfig, type: e.target.value as any })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="audit">Audit Report</option>
                  <option value="competitive">Competitive Analysis</option>
                  <option value="citation">Citation Tracking</option>
                  <option value="comprehensive">Comprehensive Report</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
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

              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={reportConfig.includeRecommendations}
                    onChange={(e) => setReportConfig({ ...reportConfig, includeRecommendations: e.target.checked })}
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Include recommendations</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={reportConfig.includeCharts}
                    onChange={(e) => setReportConfig({ ...reportConfig, includeCharts: e.target.checked })}
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Include charts and graphs</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={reportConfig.includeHistory}
                    onChange={(e) => setReportConfig({ ...reportConfig, includeHistory: e.target.checked })}
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Include historical data</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
              <button
                onClick={() => setShowGenerator(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={generateReport}
                disabled={generating || !reportConfig.name.trim()}
                className="bg-gradient-to-r from-teal-500 to-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:shadow-lg transition-all duration-300 disabled:opacity-50 flex items-center space-x-2"
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
        </div>
      )}
    </div>
  );
};

export default ReportGenerator;