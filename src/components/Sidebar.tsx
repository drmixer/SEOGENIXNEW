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
  Settings,
  History,
  Edit3,
  Download,
  Radar,
  Brain,
  Eye,
  Layers,
  BookOpen,
  Target
} from 'lucide-react';

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  userPlan: 'free' | 'core' | 'pro' | 'agency';
  onSettingsClick?: () => void;
  onBillingClick?: () => void;
  userGoals?: string[];
}

const Sidebar: React.FC<SidebarProps> = ({ 
  activeSection, 
  onSectionChange, 
  userPlan, 
  onSettingsClick, 
  onBillingClick,
  userGoals = []
}) => {
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
    { id: 'prompts', label: 'Prompt Suggestions', icon: Lightbulb, available: isDevelopment || ['pro', 'agency'].includes(userPlan) },
    { id: 'competitive', label: 'Competitive Analysis', icon: BarChart3, available: isDevelopment || ['pro', 'agency'].includes(userPlan) },
    { id: 'discovery', label: 'Competitor Discovery', icon: Radar, available: isDevelopment || ['core', 'pro', 'agency'].includes(userPlan) },
  ];

  // Highlight tools based on user goals
  const getHighlightedTools = () => {
    const toolMap: Record<string, string[]> = {
      'increase_citations': ['citations', 'editor', 'generator'],
      'improve_understanding': ['entities', 'summaries', 'editor'],
      'voice_search': ['voice', 'prompts', 'generator'],
      'competitive_edge': ['competitive', 'discovery', 'audit'],
      'content_structure': ['schema', 'editor', 'audit']
    };
    
    // Collect all tools that should be highlighted based on user goals
    const highlightedTools = new Set<string>();
    userGoals.forEach(goal => {
      if (toolMap[goal]) {
        toolMap[goal].forEach(tool => highlightedTools.add(tool));
      }
    });
    
    return highlightedTools;
  };

  const highlightedTools = getHighlightedTools();

  const newFeatures = [
    { id: 'playbooks', label: 'Optimization Playbooks', icon: BookOpen, available: isDevelopment || ['core', 'pro', 'agency'].includes(userPlan) },
    { id: 'history', label: 'Performance History', icon: History, available: isDevelopment || userPlan !== 'free' },
    { id: 'editor', label: 'Content Editor', icon: Edit3, available: isDevelopment || userPlan !== 'free' },
    // Removed redundant real-time editor
    { id: 'reports', label: 'Reports', icon: Download, available: isDevelopment || userPlan !== 'free' },
    { id: 'competitive-viz', label: 'Competitive Insights', icon: Eye, available: isDevelopment || ['pro', 'agency'].includes(userPlan) },
    { id: 'integrations', label: 'CMS Integrations', icon: Layers, available: isDevelopment || ['core', 'pro', 'agency'].includes(userPlan) },
  ];

  const bottomItems = [
    { 
      id: 'billing', 
      label: 'Billing', 
      icon: CreditCard,
      onClick: onBillingClick
    },
    { 
      id: 'settings', 
      label: 'Settings', 
      icon: Settings,
      onClick: onSettingsClick
    },
  ];

  const handleItemClick = (item: any) => {
    if (item.onClick) {
      item.onClick();
    } else {
      onSectionChange(item.id);
    }
  };

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
            const isHighlighted = highlightedTools.has(item.id);
            
            return (
              <button
                key={item.id}
                onClick={() => isAvailable && onSectionChange(item.id)}
                disabled={!isAvailable}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  isActive 
                    ? 'bg-gradient-to-r from-teal-500 to-purple-600 text-white' 
                    : isAvailable
                      ? isHighlighted 
                        ? 'text-gray-700 bg-purple-50 border border-purple-200'
                        : 'text-gray-700 hover:bg-gray-100'
                      : 'text-gray-400 cursor-not-allowed'
                }`}
              >
                <IconComponent className="w-5 h-5" />
                <span className="text-sm font-medium">{item.label}</span>
                {isHighlighted && !isActive && (
                  <span className="ml-auto flex-shrink-0 w-2 h-2 rounded-full bg-purple-500"></span>
                )}
                {!isAvailable && !isDevelopment && (
                  <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full ml-auto">
                    Pro
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* New Features Section */}
        <div className="mt-8">
          <div className="flex items-center space-x-2 mb-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Advanced Features</h3>
            <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full">NEW</span>
          </div>
          <nav className="space-y-2">
            {newFeatures.map((item) => {
              const IconComponent = item.icon;
              const isActive = activeSection === item.id;
              const isAvailable = item.available;
              const isHighlighted = item.id === 'playbooks' && userGoals.length > 0;
              
              return (
                <button
                  key={item.id}
                  onClick={() => isAvailable && onSectionChange(item.id)}
                  disabled={!isAvailable}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    isActive 
                      ? 'bg-gradient-to-r from-teal-500 to-purple-600 text-white' 
                      : isAvailable
                        ? isHighlighted 
                          ? 'text-gray-700 bg-purple-50 border border-purple-200'
                          : 'text-gray-700 hover:bg-gray-100'
                        : 'text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <IconComponent className="w-5 h-5" />
                  <span className="text-sm font-medium">{item.label}</span>
                  {isHighlighted && !isActive && (
                    <span className="ml-auto flex-shrink-0 w-2 h-2 rounded-full bg-purple-500"></span>
                  )}
                  {!isAvailable && !isDevelopment && (
                    <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full ml-auto">
                      Core
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
        
        <div className="border-t border-gray-200 mt-8 pt-4">
          <nav className="space-y-2">
            {bottomItems.map((item) => {
              const IconComponent = item.icon;
              const isActive = activeSection === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item)}
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
