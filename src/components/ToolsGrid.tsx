import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Shield, 
  Search, 
  Mic, 
  Globe, 
  Users, 
  Zap,
  TrendingUp,
  Lightbulb,
  BarChart3,
  Radar,
  Loader,
  CheckCircle,
  AlertCircle,
  Target,
  Brain,
  MessageSquare,
  ExternalLink,
  Download,
  Copy,
  RefreshCw
} from 'lucide-react';
import { apiService } from '../services/api';
import { userDataService } from '../services/userDataService';
import { supabase } from '../lib/supabase';
import ToolModal from './ToolModal';

interface ToolsGridProps {
  userPlan: 'free' | 'core' | 'pro' | 'agency';
  onToolRun?: () => void;
  showPreview?: boolean;
  selectedTool?: string;
  selectedWebsite?: string;
  userProfile?: any;
  onToolComplete?: (toolName: string, success: boolean, message?: string) => void;
}

const ToolsGrid: React.FC<ToolsGridProps> = ({ 
  userPlan, 
  onToolRun, 
  showPreview = false, 
  selectedTool,
  selectedWebsite,
  userProfile,
  onToolComplete
}) => {
  const [loadingTool, setLoadingTool] = useState<string | null>(null);
  const [toolResults, setToolResults] = useState<Record<string, any>>({});
  const [activeToolModal, setActiveToolModal] = useState<string | null>(selectedTool || null);

  // Enable all tools for development/testing
  const isDevelopment = true;

  const tools = [
    {
      id: 'audit',
      name: 'AI Visibility Audit',
      description: 'Comprehensive analysis of how well your content is structured for AI systems',
      icon: FileText,
      color: 'from-blue-500 to-blue-600',
      available: true,
      category: 'Analysis'
    },
    {
      id: 'schema',
      name: 'Schema Generator',
      description: 'Generate Schema.org markup to improve AI comprehension',
      icon: Shield,
      color: 'from-green-500 to-green-600',
      available: isDevelopment || userPlan !== 'free',
      category: 'Technical'
    },
    {
      id: 'citations',
      name: 'Citation Tracker',
      description: 'Monitor when your content gets mentioned by AI systems',
      icon: Search,
      color: 'from-purple-500 to-purple-600',
      available: isDevelopment || userPlan !== 'free',
      category: 'Monitoring'
    },
    {
      id: 'voice',
      name: 'Voice Assistant Tester',
      description: 'Test how voice assistants respond to queries about your content',
      icon: Mic,
      color: 'from-indigo-500 to-indigo-600',
      available: isDevelopment || userPlan !== 'free',
      category: 'Testing'
    },
    {
      id: 'summaries',
      name: 'LLM Site Summaries',
      description: 'Generate AI-optimized summaries of your website',
      icon: Globe,
      color: 'from-teal-500 to-teal-600',
      available: isDevelopment || userPlan !== 'free',
      category: 'Content'
    },
    {
      id: 'entities',
      name: 'Entity Coverage Analyzer',
      description: 'Identify missing entities that should be mentioned in your content',
      icon: Users,
      color: 'from-pink-500 to-pink-600',
      available: isDevelopment || ['pro', 'agency'].includes(userPlan),
      category: 'Analysis'
    },
    {
      id: 'generator',
      name: 'AI Content Generator',
      description: 'Create AI-optimized content including FAQs and meta tags',
      icon: Zap,
      color: 'from-yellow-500 to-yellow-600',
      available: isDevelopment || ['pro', 'agency'].includes(userPlan),
      category: 'Content'
    },
    {
      id: 'optimizer',
      name: 'Content Optimizer',
      description: 'Optimize existing content for better AI visibility',
      icon: TrendingUp,
      color: 'from-orange-500 to-orange-600',
      available: isDevelopment || userPlan !== 'free',
      category: 'Optimization'
    },
    {
      id: 'prompts',
      name: 'Prompt Match Suggestions',
      description: 'Generate prompts that align with how users ask AI systems',
      icon: Lightbulb,
      color: 'from-cyan-500 to-cyan-600',
      available: isDevelopment || ['pro', 'agency'].includes(userPlan),
      category: 'Strategy'
    },
    {
      id: 'competitive',
      name: 'Competitive Analysis',
      description: 'Compare your AI visibility against competitors',
      icon: BarChart3,
      color: 'from-red-500 to-red-600',
      available: isDevelopment || ['pro', 'agency'].includes(userPlan),
      category: 'Analysis'
    },
    {
      id: 'discovery',
      name: 'Competitor Discovery',
      description: 'Discover new competitors you might not be aware of',
      icon: Radar,
      color: 'from-violet-500 to-violet-600',
      available: isDevelopment || ['core', 'pro', 'agency'].includes(userPlan),
      category: 'Research'
    }
  ];

  // Set active tool modal based on selectedTool prop
  useEffect(() => {
    if (selectedTool) {
      setActiveToolModal(selectedTool);
    }
  }, [selectedTool]);

  const handleOpenToolModal = (toolId: string) => {
    if (!selectedWebsite && toolId !== 'generator' && toolId !== 'prompts') {
      alert('Please select a website first');
      return;
    }
    
    setActiveToolModal(toolId);
  };

  const handleCloseToolModal = () => {
    setActiveToolModal(null);
  };

  const handleToolComplete = (toolName: string, success: boolean, message?: string) => {
    onToolRun?.();
    onToolComplete?.(toolName, success, message);
  };

  if (showPreview) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Available Tools</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tools.slice(0, 6).map((tool) => {
            const IconComponent = tool.icon;
            return (
              <div key={tool.id} className="p-4 border border-gray-200 rounded-lg hover:border-purple-300 transition-colors">
                <div className="flex items-center space-x-3 mb-2">
                  <div className={`p-2 rounded-lg bg-gradient-to-r ${tool.color}`}>
                    <IconComponent className="w-5 h-5 text-white" />
                  </div>
                  <h4 className="font-medium text-gray-900">{tool.name}</h4>
                </div>
                <p className="text-sm text-gray-600">{tool.description}</p>
                {!tool.available && (
                  <div className="mt-2">
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                      Upgrade Required
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const categoriesToShow = selectedTool ? 
    tools.filter(tool => tool.id === selectedTool) : 
    tools;

  const categories = [...new Set(categoriesToShow.map(tool => tool.category))];

  return (
    <div className="space-y-8">
      {categories.map(category => (
        <div key={category} className="space-y-4">
          <h3 className="text-xl font-semibold text-gray-900">{category} Tools</h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {categoriesToShow
              .filter(tool => tool.category === category)
              .map((tool) => {
                const IconComponent = tool.icon;
                const isLoading = loadingTool === tool.id;
                const hasResult = toolResults[tool.id] && !toolResults[tool.id].error;

                return (
                  <div 
                    key={tool.id} 
                    className="bg-white rounded-xl shadow-sm border transition-all duration-300 border-gray-100 hover:border-purple-200"
                    data-walkthrough={tool.id === 'audit' ? 'audit-tool' : undefined}
                  >
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className={`p-3 rounded-lg bg-gradient-to-r ${tool.color}`}>
                            <IconComponent className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900">{tool.name}</h4>
                            <span className="text-xs text-gray-500">{tool.category}</span>
                          </div>
                        </div>
                        
                        {hasResult && (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        )}
                      </div>
                      
                      <p className="text-gray-600 text-sm mb-4">{tool.description}</p>
                      
                      <button
                        onClick={() => tool.available ? handleOpenToolModal(tool.id) : null}
                        disabled={!tool.available || isLoading}
                        className={`w-full flex items-center justify-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                          tool.available
                            ? isLoading
                              ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                              : 'bg-gradient-to-r from-teal-500 to-purple-600 text-white hover:shadow-lg'
                            : 'bg-gray-100 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        {isLoading ? (
                          <>
                            <Loader className="w-4 h-4 animate-spin" />
                            <span>Running...</span>
                          </>
                        ) : (
                          <>
                            <span>{tool.available ? 'Run Tool' : 'Upgrade Required'}</span>
                            {tool.available && <Target className="w-4 h-4" />}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      ))}

      {/* Tool Modal */}
      {activeToolModal && (
        <ToolModal
          isOpen={!!activeToolModal}
          onClose={handleCloseToolModal}
          toolId={activeToolModal}
          toolName={tools.find(t => t.id === activeToolModal)?.name || 'Tool'}
          selectedWebsite={selectedWebsite}
          userProfile={userProfile}
          onComplete={handleToolComplete}
        />
      )}
    </div>
  );
};

export default ToolsGrid;