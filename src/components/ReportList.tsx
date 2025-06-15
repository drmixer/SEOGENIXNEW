import React, { useState, useEffect } from 'react';
import { FileText, Download, Trash2, Eye, Calendar, Loader, RefreshCw } from 'lucide-react';
import { reportService, type GeneratedReport } from '../services/reportService';
import ReportDownloadModal from './ReportDownloadModal';

const ReportList: React.FC = () => {
  const [reports, setReports] = useState<GeneratedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<GeneratedReport | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const userReports = await reportService.getUserReports();
      setReports(userReports);
    } catch (err) {
      console.error('Error loading reports:', err);
      setError(err instanceof Error ? err.message : 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadReports();
    } finally {
      setRefreshing(false);
    }
  };

  const handleDelete = async (reportId: string) => {
    if (!confirm('Are you sure you want to delete this report?')) return;
    
    try {
      await reportService.deleteReport(reportId);
      setReports(reports.filter(r => r.id !== reportId));
    } catch (err) {
      console.error('Error deleting report:', err);
      alert('Failed to delete report');
    }
  };

  const handleViewReport = async (reportId: string) => {
    try {
      await reportService.viewReport(reportId, 'html', false);
    } catch (err) {
      console.error('Error viewing report:', err);
      alert('Failed to view report: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const getReportIcon = (type: string) => {
    switch (type) {
      case 'audit': return <FileText className="w-5 h-5 text-blue-600" />;
      case 'competitive': return <FileText className="w-5 h-5 text-purple-600" />;
      case 'citation': return <FileText className="w-5 h-5 text-green-600" />;
      case 'comprehensive': return <FileText className="w-5 h-5 text-orange-600" />;
      case 'roi_focused': return <FileText className="w-5 h-5 text-red-600" />;
      default: return <FileText className="w-5 h-5 text-gray-600" />;
    }
  };

  const getFormatBadge = (format: string) => {
    switch (format) {
      case 'html': return <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-xs rounded-full">HTML</span>;
      case 'pdf': return <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded-full">PDF</span>;
      case 'csv': return <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full">CSV</span>;
      case 'json': return <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">JSON</span>;
      default: return <span className="px-2 py-0.5 bg-gray-100 text-gray-800 text-xs rounded-full">{format.toUpperCase()}</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader className="w-8 h-8 text-purple-600 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-800 mb-4">{error}</p>
        <button
          onClick={loadReports}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8 border border-gray-100 text-center">
        <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Reports Yet</h3>
        <p className="text-gray-600 mb-4">
          Generate your first report to see it here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">Your Reports</h2>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center space-x-1 text-purple-600 hover:text-purple-800"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Report
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Format
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {reports.map((report) => (
                <tr key={report.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getReportIcon(report.type)}
                      <div className="ml-3">
                        <div className="text-sm font-medium text-gray-900">{report.name}</div>
                        <div className="text-xs text-gray-500">ID: {report.id.substring(0, 8)}...</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {report.type.charAt(0).toUpperCase() + report.type.slice(1).replace('_', ' ')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getFormatBadge(report.format)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-500">
                      <Calendar className="w-4 h-4 mr-1" />
                      {new Date(report.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => setSelectedReport(report)}
                        className="text-purple-600 hover:text-purple-900"
                        title="Download"
                      >
                        <Download className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleViewReport(report.id)}
                        className="text-blue-600 hover:text-blue-900"
                        title="View"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(report.id)}
                        className="text-red-600 hover:text-red-900"
                        title="Delete"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedReport && (
        <ReportDownloadModal
          onClose={() => setSelectedReport(null)}
          reportId={selectedReport.id}
          reportName={selectedReport.name}
          reportType={selectedReport.type}
          downloadUrl={selectedReport.downloadUrl}
        />
      )}
    </div>
  );
};

export default ReportList;