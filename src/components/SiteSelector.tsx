import React from 'react';
import { Globe, Target, ChevronDown, Info } from 'lucide-react';

interface Website {
  url: string;
  name: string;
}

interface Competitor {
  url: string;
  name: string;
}

interface SiteSelectorProps {
  websites: Website[];
  competitors: Competitor[];
  selectedWebsite: string;
  onWebsiteChange: (url: string) => void;
  userPlan: 'free' | 'core' | 'pro' | 'agency';
}

const SiteSelector: React.FC<SiteSelectorProps> = ({
  websites,
  competitors,
  selectedWebsite,
  onWebsiteChange,
  userPlan
}) => {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Your Websites</h3>
        <div className="flex items-center space-x-4 text-sm text-gray-500">
          <div className="flex items-center space-x-1">
            <Globe className="w-4 h-4" />
            <span>{websites.length} website{websites.length !== 1 ? 's' : ''}</span>
          </div>
          {competitors.length > 0 && (
            <div className="flex items-center space-x-1">
              <Target className="w-4 h-4" />
              <span>{competitors.length} competitor{competitors.length !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Website Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Active Website
          </label>
          <div className="flex items-center space-x-2 mb-2">
            <Info className="w-4 h-4 text-blue-500" />
            <p className="text-xs text-gray-600">
              The selected website will be used for all tool analyses.
            </p>
          </div>
          <div className="relative">
            <select
              value={selectedWebsite}
              onChange={(e) => onWebsiteChange(e.target.value)}
              className="w-full appearance-none bg-white border border-gray-300 rounded-lg px-4 py-3 pr-10 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              {websites.length === 0 ? (
                <option value="">No websites available</option>
              ) : (
                websites.map((website, index) => (
                  <option key={index} value={website.url}>
                    {website.name} ({website.url})
                  </option>
                ))
              )}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Competitors Display */}
        {competitors.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tracked Competitors
            </label>
            <div className="space-y-2 max-h-24 overflow-y-auto">
              {competitors.map((competitor, index) => (
                <div key={index} className="flex items-center space-x-2 text-sm">
                  <Target className="w-3 h-3 text-purple-600 flex-shrink-0" />
                  <span className="text-gray-700 truncate">
                    {competitor.name}
                  </span>
                  <span className="text-gray-400 text-xs truncate">
                    ({competitor.url})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-semibold text-gray-900">{websites.length}</div>
            <div className="text-xs text-gray-500">Website{websites.length !== 1 ? 's' : ''}</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-900">{competitors.length}</div>
            <div className="text-xs text-gray-500">Competitor{competitors.length !== 1 ? 's' : ''}</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-purple-600">{userPlan.toUpperCase()}</div>
            <div className="text-xs text-gray-500">Plan</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SiteSelector;