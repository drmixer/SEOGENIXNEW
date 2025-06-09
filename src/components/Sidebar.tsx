import React from 'react';
import { 
  BarChart3, 
  FileText, 
  Shield, 
  Search, 
  Mic, 
  Globe, 
  Users, 
  Zap,
  TrendingUp,
  Lightbulb,
  CreditCard,
  Settings
} from 'lucide-react';

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  userPlan: 'free' | 'core' | 'pro' | 'agency';
}

const Sidebar: React.FC<SidebarProps> = ({ activeSection, onSectionChange, userPlan }) => {
  // Enable all features for development/testing
  const isDevelopment = true; // Set to false for production

  const menuItems = [
    { id: 'overview', label: 'Overview', icon: BarChart3, available: true },
    { id: 'audit', label: 'AI Visibility Audit', icon: FileText, available: isDevelopment || userPlan !== 'free' },
    { id: 'schema', label: 'Schema Generator', icon: Shield, available: isDevelopment || userPlan !== 'free' },
    { id: 'citations', label: 'Citation Tracker', icon: Search, available: isDevelopment || userPlan !== 'free' },
    { id: 'voice', label: 'Voice Assistant Tester', icon: Mic, available: isDevelopment || userPlan !== 'free' },
    { id: 'summaries', label: 'LLM Site Summaries', icon: Globe, available: isDevelopment || userPlan !== 'free' },
    { id: 'entities', label: 'Entity Coverage', icon: Users, available: isDevelopment || ['pro', 'agency'].includes(userPlan) },
    { id: 'generator', label: 'AI Content Generator', icon: Zap, available: isDevelopment || ['pro', 'agency'].includes(userPlan) },
    { id: 'optimizer', label: 'Content Optimizer', icon: TrendingUp, available: isDevelopment || userPlan !== 'free' },
    { id: 'prompts', label: 'Prompt Suggestions', icon: Lightbulb, available: isDevelopment || ['pro', 'agency'].includes(userPlan) },
    { id: 'competitive', label: 'Competitive Analysis', icon: BarChart3, available: isDevelopment || ['pro', 'agency'].includes(userPlan) },
  ];

  const bottomItems = [
    { id: 'billing', label: 'Billing', icon: CreditCard },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex-shrink-0 flex flex-col" data-walkthrough="sidebar">
      <div className="p-6 flex-1 overflow-y-auto min-h-0">
        {isDevelopment && (
          <div className="mb-4 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-xs text-yellow-800">Development Mode: All features enabled</p>
          </div>
        )}
        
        <nav className="space-y-2">
          {menuItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = activeSection === item.id;
            const isAvailable = item.available;
            
            return (
              <button
                key={item.id}
                onClick={() => isAvailable && onSectionChange(item.id)}
                disabled={!isAvailable}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  isActive 
                    ? 'bg-gradient-to-r from-teal-500 to-purple-600 text-white' 
                    : isAvailable
                      ? 'text-gray-700 hover:bg-gray-100'
                      : 'text-gray-400 cursor-not-allowed'
                }`}
              >
                <IconComponent className="w-5 h-5" />
                <span className="text-sm font-medium">{item.label}</span>
                {!isAvailable && !isDevelopment && (
                  <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full ml-auto">
                    Pro
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        
        <div className="border-t border-gray-200 mt-8 pt-4">
          <nav className="space-y-2">
            {bottomItems.map((item) => {
              const IconComponent = item.icon;
              const isActive = activeSection === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => onSectionChange(item.id)}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    isActive 
                      ? 'bg-gradient-to-r from-teal-500 to-purple-600 text-white' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <IconComponent className="w-5 h-5" />
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;