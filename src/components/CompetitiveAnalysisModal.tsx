import React, { useState, useEffect } from 'react';
import { X, Loader, BarChart3 } from 'lucide-react';
import { apiService } from '../services/api';
import { userDataService } from '../services/userDataService';

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
  maxSelectable?: number;
  projectId: string;
  industry?: string;
  userId?: string;
}

const CompetitiveAnalysisModal: React.FC<CompetitiveAnalysisModalProps> = ({
  onClose,
  onAnalysisComplete,
  userWebsites,
  userCompetitors,
  maxSelectable = 10,
  projectId,
  industry,
  userId,
}) => {
  console.log('userWebsites', userWebsites);
  console.log('userCompetitors', userCompetitors);
  const [selectedUserWebsite, setSelectedUserWebsite] = useState<string>('');
  const [selectedCompetitors, setSelectedCompetitors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const storageKey = `ca:lastSelection:${projectId}`;

  // Initialize selection from server (preferred) or local storage/defaults
  useEffect(() => {
    try {
      (async () => {
        let initialized = false;
        if (userId && projectId) {
          const serverSaved = await userDataService.getCompetitiveSelection(userId, projectId);
          if (serverSaved) {
            const primary = serverSaved.primaryUrl;
            const compUrls = Array.isArray(serverSaved.competitorUrls) ? serverSaved.competitorUrls : [];
            if (primary && userWebsites.some(w => w.url === primary)) {
              setSelectedUserWebsite(primary);
              initialized = true;
            }
            if (compUrls.length) {
              const available = new Set(userCompetitors.map(c => c.url));
              const filtered = compUrls.filter(url => available.has(url)).slice(0, maxSelectable);
              if (filtered.length) setSelectedCompetitors(filtered);
            }
          }
        }
        if (!initialized) {
          const saved = localStorage.getItem(storageKey);
          if (saved) {
            const parsed = JSON.parse(saved) as { primaryUrl?: string; competitorUrls?: string[] };
            if (parsed.primaryUrl && userWebsites.some(w => w.url === parsed.primaryUrl)) {
              setSelectedUserWebsite(parsed.primaryUrl);
            } else if (userWebsites.length > 0 && !selectedUserWebsite) {
              setSelectedUserWebsite(userWebsites[0].url);
            }
            if (Array.isArray(parsed.competitorUrls)) {
              const available = new Set(userCompetitors.map(c => c.url));
              const filtered = parsed.competitorUrls.filter(url => available.has(url)).slice(0, maxSelectable);
              if (filtered.length) setSelectedCompetitors(filtered);
            }
          } else {
            if (userWebsites.length > 0 && !selectedUserWebsite) {
              setSelectedUserWebsite(userWebsites[0].url);
            }
            if (userCompetitors.length > 0) {
              setSelectedCompetitors(userCompetitors.slice(0, maxSelectable).map(c => c.url));
            }
          }
        }
      })();
    } catch {
      // fallback to defaults
      if (userWebsites.length > 0 && !selectedUserWebsite) {
        setSelectedUserWebsite(userWebsites[0].url);
      }
      if (userCompetitors.length > 0) {
        setSelectedCompetitors(userCompetitors.slice(0, maxSelectable).map(c => c.url));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userWebsites, userCompetitors, maxSelectable, userId, projectId]);

  // Persist selection
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ primaryUrl: selectedUserWebsite, competitorUrls: selectedCompetitors }));
    } catch {}
    // Save server-side when we have identifiers
    if (userId && projectId && selectedUserWebsite) {
      userDataService.saveCompetitiveSelection({
        userId,
        projectId,
        primaryUrl: selectedUserWebsite,
        competitorUrls: selectedCompetitors,
      });
    }
  }, [storageKey, selectedUserWebsite, selectedCompetitors, userId, projectId]);

  const handleCompetitorToggle = (competitorUrl: string) => {
    setSelectedCompetitors(prev => {
      if (prev.includes(competitorUrl)) return prev.filter(url => url !== competitorUrl);
      if (prev.length >= maxSelectable) return prev; // enforce limit
      return [...prev, competitorUrl];
    });
  };

  const handleSelectAll = () => {
    const all = userCompetitors.map(c => c.url).slice(0, maxSelectable);
    setSelectedCompetitors(all);
  };

  const handleClearAll = () => {
    setSelectedCompetitors([]);
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
        projectId,
        selectedUserWebsite,
        selectedCompetitors,
        industry
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
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-gray-500">Selected {selectedCompetitors.length} / {maxSelectable}</div>
              <div className="space-x-2">
                <button type="button" onClick={handleSelectAll} className="text-xs text-purple-600 hover:text-purple-800 disabled:opacity-50" disabled={selectedCompetitors.length >= Math.min(userCompetitors.length, maxSelectable)}>Select All</button>
                <button type="button" onClick={handleClearAll} className="text-xs text-gray-600 hover:text-gray-800 disabled:opacity-50" disabled={selectedCompetitors.length === 0}>Clear</button>
              </div>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-3">
              {userCompetitors
                .slice()
                .sort((a, b) => (a.name || a.url).localeCompare(b.name || b.url))
                .map(comp => (
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
            {selectedCompetitors.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedCompetitors.map(url => (
                  <span key={url} className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded border border-purple-200">{url}</span>
                ))}
              </div>
            )}
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
