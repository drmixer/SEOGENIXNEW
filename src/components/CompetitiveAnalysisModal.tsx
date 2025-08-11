import React, { useState, useEffect } from 'react';
import { X, Loader, BarChart3 } from 'lucide-react';
import { apiService } from '../services/api';
import CompetitiveAnalysisSiteSelector from './CompetitiveAnalysisSiteSelector';

interface Website {
  url: string;
  name: string;
}

interface Competitor {
  url: string;
  name: string;
}

interface CompetitiveAnalysisModalProps {
  onClose: () => void;
  onAnalysisComplete: (results: any) => void;
  userWebsites: Website[];
  userCompetitors: Competitor[];
}

const CompetitiveAnalysisModal: React.FC<CompetitiveAnalysisModalProps> = ({
  onClose,
  onAnalysisComplete,
  userWebsites,
  userCompetitors,
}) => {
  console.log('userWebsites', userWebsites);
  console.log('userCompetitors', userCompetitors);
  const [selectedUserWebsite, setSelectedUserWebsite] = useState<string>('');
  const [selectedCompetitors, setSelectedCompetitors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userWebsites.length > 0 && !selectedUserWebsite) {
      setSelectedUserWebsite(userWebsites[0].url);
    }
    if (userCompetitors.length > 0) {
      // Pre-select all competitors passed in
      setSelectedCompetitors(userCompetitors.map(c => c.url));
    }
  }, [userWebsites, userCompetitors, selectedUserWebsite]);

  const handleCompetitorToggle = (competitorUrl: string) => {
    setSelectedCompetitors(prev =>
      prev.includes(competitorUrl)
        ? prev.filter(url => url !== competitorUrl)
        : [...prev, competitorUrl]
    );
  };

  const handleRunAnalysis = async () => {
    if (!selectedUserWebsite || selectedCompetitors.length === 0) {
      setError('Please select your website and at least one competitor.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const results = await apiService.performCompetitiveAnalysis(
        selectedUserWebsite,
        selectedCompetitors,
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="bg-red-500 p-2 rounded-lg">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Run Competitive Analysis</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Your Website</label>
            <select
              value={selectedUserWebsite}
              onChange={(e) => setSelectedUserWebsite(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              {userWebsites.map(site => (
                <option key={site.url} value={site.url}>{site.name || site.url}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Competitors to Analyze</label>
            <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-3">
              {userCompetitors.map(comp => (
                <label key={comp.url} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedCompetitors.includes(comp.url)}
                    onChange={() => handleCompetitorToggle(comp.url)}
                    className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                  />
                  <span className="text-gray-800">{comp.name || comp.url}</span>
                </label>
              ))}
            </div>
          </div>

          {error && <p className="text-red-500 text-sm mt-4">{error}</p>}
        </div>

        <div className="flex justify-end p-6 bg-gray-50 rounded-b-2xl space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleRunAnalysis}
            disabled={loading || selectedCompetitors.length === 0}
            className="bg-red-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <div className="flex items-center">
                <Loader className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                Running Analysis...
              </div>
            ) : (
              `Analyze ${selectedCompetitors.length} Competitor(s)`
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CompetitiveAnalysisModal;
