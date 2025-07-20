import React from 'react';
import { ChevronDown, Target } from 'lucide-react';

interface Website {
  url: string;
  name: string;
}

interface Competitor {
  url: string;
  name: string;
}

interface CompetitiveAnalysisSiteSelectorProps {
  userWebsites: Website[];
  competitors: Competitor[];
  selectedUserWebsite: string;
  selectedCompetitor: string;
  onUserWebsiteChange: (url: string) => void;
  onCompetitorChange: (url: string) => void;
}

const CompetitiveAnalysisSiteSelector: React.FC<CompetitiveAnalysisSiteSelectorProps> = ({
  userWebsites,
  competitors,
  selectedUserWebsite,
  selectedCompetitor,
  onUserWebsiteChange,
  onCompetitorChange,
}) => {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Competitive Analysis Setup</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Your Website
          </label>
          <div className="relative">
            <select
              value={selectedUserWebsite}
              onChange={(e) => onUserWebsiteChange(e.target.value)}
              className="w-full appearance-none bg-white border border-gray-300 rounded-lg px-4 py-3 pr-10 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              {userWebsites.length === 0 ? (
                <option value="">No websites available</option>
              ) : (
                userWebsites.map((website, index) => (
                  <option key={index} value={website.url}>
                    {website.name} ({website.url})
                  </option>
                ))
              )}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Competitor's Website
          </label>
          <div className="relative">
            <select
              value={selectedCompetitor}
              onChange={(e) => onCompetitorChange(e.target.value)}
              className="w-full appearance-none bg-white border border-gray-300 rounded-lg px-4 py-3 pr-10 focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              {competitors.length === 0 ? (
                <option value="">No competitors available</option>
              ) : (
                competitors.map((competitor, index) => (
                  <option key={index} value={competitor.url}>
                    {competitor.name} ({competitor.url})
                  </option>
                ))
              )}
            </select>
            <Target className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompetitiveAnalysisSiteSelector;
