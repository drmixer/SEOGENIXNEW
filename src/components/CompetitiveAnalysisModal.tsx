import React, { useState, useEffect } from 'react';
import { X, Loader, BarChart3 } from 'lucide-react';
import { apiService } from '../services/api';

interface Website {
  url: string;
  name: string;
}

interface Competitor {
  url: string;
  name: string;
}

interface CompetitiveAnalysisModalProps {
  selectedUserWebsite: string;
  selectedCompetitor: string;
  onClose: () => void;
  onAnalysisComplete: (results: any) => void;
  userWebsites: Website[];
  userCompetitors: Competitor[];
}

const CompetitiveAnalysisModal: React.FC<CompetitiveAnalysisModalProps> = ({
  selectedUserWebsite,
  selectedCompetitor,
  onClose,
  onAnalysisComplete,
  userWebsites,
  userCompetitors,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRunAnalysis = async () => {
    if (!selectedUserWebsite || !selectedCompetitor) {
      setError('Please select a website and a competitor.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const results = await apiService.performCompetitiveAnalysis(
        selectedUserWebsite,
        [selectedCompetitor],
        '' // Industry is optional
      );
      onAnalysisComplete(results);
      onClose();
    } catch (err) {
      setError('Failed to run analysis. Please try again.');
      console.error('Error running competitive analysis:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="bg-red-500 p-2 rounded-lg">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Competitive Analysis</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Your Website
              </label>
              <p className="text-lg font-semibold text-gray-900">{userWebsites.find(site => site.url === selectedUserWebsite)?.name || selectedUserWebsite}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Competitor's Website
              </label>
              <p className="text-lg font-semibold text-gray-900">{userCompetitors.find(c => c.url === selectedCompetitor)?.name || selectedCompetitor}</p>
            </div>
          </div>

          {error && <p className="text-red-500 text-sm mt-4">{error}</p>}
        </div>

        <div className="flex justify-end p-6 bg-gray-50 rounded-b-2xl">
          <button
            onClick={handleRunAnalysis}
            disabled={loading}
            className="bg-red-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <div className="flex items-center">
                <Loader className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                Running...
              </div>
            ) : (
              'Run Analysis'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CompetitiveAnalysisModal;
