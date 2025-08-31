import React, { useState } from 'react';
import { X, FileText, Download, Copy, ExternalLink, Loader } from 'lucide-react';
import { reportService } from '../services/reportService';
import Modal from './ui/Modal';

interface ReportDownloadModalProps {
  onClose: () => void;
  reportId: string;
  reportName: string;
  reportType: string;
  downloadUrl?: string;
}

const ReportDownloadModal: React.FC<ReportDownloadModalProps> = ({ 
  onClose, 
  reportId, 
  reportName,
  reportType,
  downloadUrl
}) => {
  const [selectedFormat, setSelectedFormat] = useState<'html' | 'csv' | 'json'>('html');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    setLoading(true);
    setError(null);
    
    try {
      await reportService.viewReport(reportId, selectedFormat, true);
    } catch (err) {
      console.error('Download error:', err);
      setError(err instanceof Error ? err.message : 'Failed to download report');
    } finally {
      setLoading(false);
    }
  };

  const handleViewInBrowser = async () => {
    setLoading(true);
    setError(null);
    
    try {
      await reportService.viewReport(reportId, 'html', false);
    } catch (err) {
      console.error('View error:', err);
      setError(err instanceof Error ? err.message : 'Failed to view report');
    } finally {
      setLoading(false);
    }
  };

  const copyLinkToClipboard = () => {
    if (downloadUrl) {
      navigator.clipboard.writeText(downloadUrl);
      alert('Link copied to clipboard!');
    }
  };

  const header = (<h3 className="text-xl font-semibold text-gray-900">Download Report</h3>);
  const footer = (<button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">Close</button>);
  return (
    <Modal isOpen={true} onClose={onClose} header={header} footer={footer} size="md">
        <div className="">
          <div className="mb-6">
            <h4 className="font-medium text-gray-900 mb-2">Report Details</h4>
            <p className="text-gray-600 text-sm mb-1">
              <strong>Name:</strong> {reportName}
            </p>
            <p className="text-gray-600 text-sm mb-1">
              <strong>Type:</strong> {reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report
            </p>
            <p className="text-gray-600 text-sm">
              <strong>ID:</strong> {reportId.substring(0, 8)}...
            </p>
          </div>

          <div className="mb-6">
            <h4 className="font-medium text-gray-900 mb-2">Select Format</h4>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setSelectedFormat('html')}
                className={`p-4 border rounded-lg flex flex-col items-center justify-center transition-colors ${
                  selectedFormat === 'html' 
                    ? 'border-purple-500 bg-purple-50' 
                    : 'border-gray-200 hover:border-purple-300'
                }`}
              >
                <FileText className="w-6 h-6 text-purple-600 mb-2" />
                <span className="font-medium text-gray-900">HTML</span>
                <span className="text-xs text-gray-500 mt-1">Styled web page</span>
              </button>
              
              <button
                onClick={() => setSelectedFormat('csv')}
                className={`p-4 border rounded-lg flex flex-col items-center justify-center transition-colors ${
                  selectedFormat === 'csv' 
                    ? 'border-purple-500 bg-purple-50' 
                    : 'border-gray-200 hover:border-purple-300'
                }`}
              >
                <FileText className="w-6 h-6 text-green-600 mb-2" />
                <span className="font-medium text-gray-900">CSV</span>
                <span className="text-xs text-gray-500 mt-1">Spreadsheet data</span>
              </button>
              
              <button
                onClick={() => setSelectedFormat('json')}
                className={`p-4 border rounded-lg flex flex-col items-center justify-center transition-colors ${
                  selectedFormat === 'json' 
                    ? 'border-purple-500 bg-purple-50' 
                    : 'border-gray-200 hover:border-purple-300'
                }`}
              >
                <FileText className="w-6 h-6 text-blue-600 mb-2" />
                <span className="font-medium text-gray-900">JSON</span>
                <span className="text-xs text-gray-500 mt-1">Raw data</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          <div className="flex flex-col space-y-3">
            <button
              onClick={handleDownload}
              disabled={loading}
              className="w-full bg-gradient-to-r from-teal-500 to-purple-600 text-white py-3 px-4 rounded-lg font-medium hover:shadow-lg transition-all duration-300 disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  <span>Download {selectedFormat.toUpperCase()}</span>
                </>
              )}
            </button>
            
            {selectedFormat === 'html' && (
              <button
                onClick={handleViewInBrowser}
                disabled={loading}
                className="w-full border border-gray-300 bg-white text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center justify-center space-x-2"
              >
                <ExternalLink className="w-5 h-5" />
                <span>View in Browser</span>
              </button>
            )}
            
            {downloadUrl && (
              <button
                onClick={copyLinkToClipboard}
                className="w-full border border-gray-300 bg-white text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center justify-center space-x-2"
              >
                <Copy className="w-5 h-5" />
                <span>Copy Link</span>
              </button>
            )}
          </div>
        </div>
    </Modal>
  );
};

export default ReportDownloadModal;
