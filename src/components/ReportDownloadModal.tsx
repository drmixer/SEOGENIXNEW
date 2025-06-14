import React, { useState } from 'react';
import { X, FileText, Download, Printer, Copy, ExternalLink, Loader, Settings } from 'lucide-react';
import { reportService, type ReportOptions } from '../services/reportService';

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
  const [selectedFormat, setSelectedFormat] = useState<'html' | 'pdf' | 'csv' | 'json'>('html');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [pdfOptions, setPdfOptions] = useState({
    format: 'A4',
    landscape: false,
    margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' },
    printBackground: true,
    headerTemplate: '',
    footerTemplate: ''
  });

  const handleDownload = async () => {
    setLoading(true);
    setError(null);
    
    try {
      if (selectedFormat === 'html') {
        await reportService.viewReport(reportId, 'html', true);
      } else if (selectedFormat === 'pdf') {
        // Generate PDF from HTML report
        const pdfUrl = await reportService.generatePDF(reportId, pdfOptions);
        window.open(pdfUrl, '_blank');
      } else {
        // For other formats, we would need to implement specific handlers
        // This is a placeholder for CSV and JSON downloads
        alert(`Download in ${selectedFormat.toUpperCase()} format is not implemented in this demo`);
      }
    } catch (err) {
      console.error('Download error:', err);
      setError(err instanceof Error ? err.message : 'Failed to download report');
    } finally {
      setLoading(false);
    }
  };

  const handleViewInBrowser = async () => {
    try {
      await reportService.viewReport(reportId, 'html', false);
    } catch (err) {
      console.error('View error:', err);
      setError(err instanceof Error ? err.message : 'Failed to view report');
    }
  };

  const copyLinkToClipboard = () => {
    if (downloadUrl) {
      navigator.clipboard.writeText(downloadUrl);
      alert('Link copied to clipboard!');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-xl font-semibold text-gray-900">Download Report</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
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
            <div className="grid grid-cols-2 gap-3">
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
                onClick={() => setSelectedFormat('pdf')}
                className={`p-4 border rounded-lg flex flex-col items-center justify-center transition-colors ${
                  selectedFormat === 'pdf' 
                    ? 'border-purple-500 bg-purple-50' 
                    : 'border-gray-200 hover:border-purple-300'
                }`}
              >
                <FileText className="w-6 h-6 text-red-600 mb-2" />
                <span className="font-medium text-gray-900">PDF</span>
                <span className="text-xs text-gray-500 mt-1">Print-ready document</span>
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

          {selectedFormat === 'pdf' && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-900">PDF Options</h4>
                <button
                  onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                  className="text-sm text-purple-600 flex items-center space-x-1"
                >
                  <Settings className="w-4 h-4" />
                  <span>{showAdvancedOptions ? 'Hide' : 'Show'} Advanced Options</span>
                </button>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={pdfOptions.format === 'A4'}
                      onChange={() => setPdfOptions({...pdfOptions, format: 'A4'})}
                      className="mr-2"
                    />
                    A4
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={pdfOptions.format === 'Letter'}
                      onChange={() => setPdfOptions({...pdfOptions, format: 'Letter'})}
                      className="mr-2"
                    />
                    Letter
                  </label>
                </div>
                
                <div className="flex items-center space-x-3">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={!pdfOptions.landscape}
                      onChange={() => setPdfOptions({...pdfOptions, landscape: false})}
                      className="mr-2"
                    />
                    Portrait
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={pdfOptions.landscape}
                      onChange={() => setPdfOptions({...pdfOptions, landscape: true})}
                      className="mr-2"
                    />
                    Landscape
                  </label>
                </div>
                
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={pdfOptions.printBackground}
                    onChange={() => setPdfOptions({...pdfOptions, printBackground: !pdfOptions.printBackground})}
                    className="mr-2"
                  />
                  Print Background Colors/Images
                </label>
                
                {showAdvancedOptions && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <h5 className="text-sm font-medium text-gray-900 mb-2">Margins</h5>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Top</label>
                        <input
                          type="text"
                          value={pdfOptions.margin.top}
                          onChange={(e) => setPdfOptions({
                            ...pdfOptions, 
                            margin: {...pdfOptions.margin, top: e.target.value}
                          })}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Right</label>
                        <input
                          type="text"
                          value={pdfOptions.margin.right}
                          onChange={(e) => setPdfOptions({
                            ...pdfOptions, 
                            margin: {...pdfOptions.margin, right: e.target.value}
                          })}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Bottom</label>
                        <input
                          type="text"
                          value={pdfOptions.margin.bottom}
                          onChange={(e) => setPdfOptions({
                            ...pdfOptions, 
                            margin: {...pdfOptions.margin, bottom: e.target.value}
                          })}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Left</label>
                        <input
                          type="text"
                          value={pdfOptions.margin.left}
                          onChange={(e) => setPdfOptions({
                            ...pdfOptions, 
                            margin: {...pdfOptions.margin, left: e.target.value}
                          })}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

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
      </div>
    </div>
  );
};

export default ReportDownloadModal;