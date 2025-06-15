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
  ArrowRight,
  AlertTriangle,
  Loader
} from 'lucide-react';
import { apiService } from '../services/api';
import { userDataService } from '../services/userDataService';
import { supabase } from '../lib/supabase';

interface ToolsGridProps {
  userPlan: 'free' | 'core' | 'pro' | 'agency';
  onToolRun: () => void;
  showPreview?: boolean;
  selectedTool?: string | null;
  selectedWebsite?: string;
  userProfile?: any;
  onToolComplete?: (toolName: string, success: boolean, message?: string) => void;
}

interface Tool {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  color: string;
  planRequired: 'free' | 'core' | 'pro' | 'agency';
  component?: React.ComponentType<any>;
  isNew?: boolean;
  isPopular?: boolean;
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
  const [activeToolId, setActiveToolId] = useState<string | null>(selectedTool || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toolData, setToolData] = useState<any>(null);
  const [runningTool, setRunningTool] = useState<string | null>(null);

  // Update active tool when selectedTool changes
  useEffect(() => {
    if (selectedTool) {
      setActiveToolId(selectedTool);
    }
  }, [selectedTool]);

  // Reset tool data when active tool changes
  useEffect(() => {
    setToolData(null);
    setError(null);
  }, [activeToolId]);

  const tools: Tool[] = [
    {
      id: 'audit',
      name: 'AI Visibility Audit',
      description: 'Comprehensive analysis of how well your content is structured for AI systems',
      icon: FileText,
      color: 'from-blue-500 to-blue-600',
      planRequired: 'core',
      isPopular: true
    },
    {
      id: 'schema',
      name: 'Schema Generator',
      description: 'Create structured data markup to improve AI comprehension',
      icon: Shield,
      color: 'from-green-500 to-green-600',
      planRequired: 'core'
    },
    {
      id: 'citations',
      name: 'Citation Tracker',
      description: 'Monitor when AI systems mention your content',
      icon: Search,
      color: 'from-purple-500 to-purple-600',
      planRequired: 'core'
    },
    {
      id: 'voice',
      name: 'Voice Assistant Tester',
      description: 'Test how voice assistants respond to queries about your business',
      icon: Mic,
      color: 'from-indigo-500 to-indigo-600',
      planRequired: 'core'
    },
    {
      id: 'summaries',
      name: 'LLM Site Summaries',
      description: 'Generate summaries that help AI systems understand your site',
      icon: Globe,
      color: 'from-teal-500 to-teal-600',
      planRequired: 'core'
    },
    {
      id: 'entities',
      name: 'Entity Coverage Analyzer',
      description: 'Identify missing entities that should be mentioned in your content',
      icon: Users,
      color: 'from-pink-500 to-pink-600',
      planRequired: 'pro'
    },
    {
      id: 'generator',
      name: 'AI Content Generator',
      description: 'Create optimized FAQs, snippets, and meta tags for AI consumption',
      icon: Zap,
      color: 'from-yellow-500 to-yellow-600',
      planRequired: 'pro',
      isNew: true
    },
    {
      id: 'optimizer',
      name: 'Content Optimizer',
      description: 'Score and rewrite your content to maximize AI visibility',
      icon: TrendingUp,
      color: 'from-orange-500 to-orange-600',
      planRequired: 'core'
    },
    {
      id: 'prompts',
      name: 'Prompt Match Suggestions',
      description: 'Generate prompts that align with how users ask AI systems questions',
      icon: Lightbulb,
      color: 'from-cyan-500 to-cyan-600',
      planRequired: 'pro'
    },
    {
      id: 'competitive',
      name: 'Competitive Analysis',
      description: 'Compare your AI visibility against competitors',
      icon: BarChart3,
      color: 'from-red-500 to-red-600',
      planRequired: 'pro'
    },
    {
      id: 'discovery',
      name: 'Competitor Discovery',
      description: 'Find competitors you might not be aware of',
      icon: Search,
      color: 'from-purple-500 to-purple-600',
      planRequired: 'core',
      isNew: true
    }
  ];

  // Filter tools based on user plan
  const availableTools = tools.filter(tool => {
    const planHierarchy = { free: 0, core: 1, pro: 2, agency: 3 };
    const userLevel = planHierarchy[userPlan];
    const requiredLevel = planHierarchy[tool.planRequired];
    return userLevel >= requiredLevel;
  });

  const handleToolClick = (toolId: string) => {
    if (showPreview) {
      // In preview mode, just notify parent
      onToolRun();
    } else {
      // In normal mode, set active tool
      setActiveToolId(toolId);
      setToolData(null);
      setError(null);
    }
  };

  const handleRunTool = async (toolId: string) => {
    if (!selectedWebsite) {
      setError('Please select a website first');
      return;
    }

    setLoading(true);
    setError(null);
    setRunningTool(toolId);

    try {
      let result;
      
      switch (toolId) {
        case 'audit':
          result = await apiService.runAudit(selectedWebsite);
          break;
        case 'schema':
          result = await apiService.generateSchema(selectedWebsite, 'article');
          break;
        case 'citations':
          const domain = new URL(selectedWebsite).hostname;
          result = await apiService.trackCitations(domain, ['AI visibility', 'SEO']);
          break;
        case 'voice':
          result = await apiService.testVoiceAssistants(
            `What is ${new URL(selectedWebsite).hostname}?`, 
            ['siri', 'alexa', 'google']
          );
          break;
        case 'summaries':
          result = await apiService.generateLLMSummary(selectedWebsite, 'overview');
          break;
        case 'entities':
          result = await apiService.analyzeEntityCoverage(
            selectedWebsite, 
            undefined, 
            userProfile?.industry
          );
          break;
        case 'generator':
          result = await apiService.generateAIContent(
            'faq',
            'AI Visibility',
            ['AI', 'SEO'],
            selectedWebsite
          );
          break;
        case 'competitive':
          const competitors = userProfile?.competitors?.map((c: any) => c.url) || [];
          result = await apiService.performCompetitiveAnalysis(
            selectedWebsite,
            competitors.slice(0, 3),
            userProfile?.industry
          );
          break;
        case 'discovery':
          result = await apiService.discoverCompetitors(
            selectedWebsite,
            userProfile?.industry,
            userProfile?.business_description,
            userProfile?.competitors?.map((c: any) => c.url) || []
          );
          break;
        default:
          throw new Error(`Tool ${toolId} not implemented`);
      }

      setToolData(result);
      onToolRun();

      // Track tool usage
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await userDataService.trackActivity({
            user_id: user.id,
            activity_type: 'tool_used',
            activity_data: { result },
            tool_id: toolId,
            website_url: selectedWebsite
          });
        }
      } catch (error) {
        console.error('Error tracking tool usage:', error);
      }

      // Notify parent of completion
      if (onToolComplete) {
        onToolComplete(
          tools.find(t => t.id === toolId)?.name || toolId,
          true,
          'Tool executed successfully'
        );
      }

    } catch (error) {
      console.error(`Error running ${toolId}:`, error);
      setError(`Failed to run ${toolId}. Please try again.`);
      
      // Notify parent of failure
      if (onToolComplete) {
        onToolComplete(
          tools.find(t => t.id === toolId)?.name || toolId,
          false,
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    } finally {
      setLoading(false);
      setRunningTool(null);
    }
  };

  // If in preview mode, just show the grid
  if (showPreview) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Available Tools</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {availableTools.map((tool) => {
            const IconComponent = tool.icon;
            return (
              <div
                key={tool.id}
                onClick={() => handleToolClick(tool.id)}
                className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md hover:border-purple-200 transition-all duration-300 cursor-pointer relative"
                data-walkthrough={tool.id === 'audit' ? 'audit-tool' : undefined}
              >
                {tool.isNew && (
                  <div className="absolute top-4 right-4 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                    NEW
                  </div>
                )}
                {tool.isPopular && (
                  <div className="absolute top-4 right-4 bg-purple-500 text-white text-xs px-2 py-1 rounded-full">
                    POPULAR
                  </div>
                )}
                <div className={`p-3 rounded-lg bg-gradient-to-r ${tool.color} mb-4`}>
                  <IconComponent className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{tool.name}</h3>
                <p className="text-gray-600 text-sm mb-4">{tool.description}</p>
                <button className="text-sm text-purple-600 hover:text-purple-800 flex items-center space-x-1">
                  <span>Run Tool</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // If a tool is selected, show the tool interface
  if (activeToolId) {
    const activeTool = tools.find(tool => tool.id === activeToolId);
    
    if (!activeTool) {
      return (
        <div className="bg-white rounded-xl shadow-sm p-8 border border-gray-100 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Tool Not Found</h3>
          <p className="text-gray-600 mb-4">
            The selected tool could not be found. Please try another tool.
          </p>
          <button
            onClick={() => setActiveToolId(null)}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
          >
            Back to Tools
          </button>
        </div>
      );
    }

    const IconComponent = activeTool.icon;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg bg-gradient-to-r ${activeTool.color}`}>
              <IconComponent className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">{activeTool.name}</h2>
          </div>
          <button
            onClick={() => setActiveToolId(null)}
            className="text-gray-500 hover:text-gray-700"
          >
            Back to Tools
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <p className="text-gray-600 mb-6">{activeTool.description}</p>
          
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 mr-2" />
                <p className="text-red-700">{error}</p>
              </div>
            </div>
          )}

          <div className="mb-6">
            <button
              onClick={() => handleRunTool(activeToolId)}
              disabled={loading || !selectedWebsite}
              className="bg-gradient-to-r from-teal-500 to-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:shadow-lg transition-all duration-300 disabled:opacity-50 flex items-center space-x-2"
            >
              {loading && runningTool === activeToolId ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  <span>Running {activeTool.name}...</span>
                </>
              ) : (
                <>
                  <IconComponent className="w-5 h-5" />
                  <span>Run {activeTool.name}</span>
                </>
              )}
            </button>
          </div>

          {loading && runningTool === activeToolId ? (
            <div className="text-center py-12">
              <Loader className="w-12 h-12 text-purple-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-600">Running {activeTool.name}...</p>
              <p className="text-gray-500 text-sm mt-2">This may take a few moments</p>
            </div>
          ) : toolData ? (
            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
              <h3 className="font-medium text-gray-900 mb-4">Results</h3>
              
              {/* Display tool-specific results */}
              {activeToolId === 'audit' && (
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-purple-600 mb-2">{toolData.overallScore}</div>
                    <p className="text-gray-600">Overall AI Visibility Score</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                      <div className="text-lg font-semibold">{toolData.subscores.aiUnderstanding}</div>
                      <p className="text-sm text-gray-600">AI Understanding</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                      <div className="text-lg font-semibold">{toolData.subscores.citationLikelihood}</div>
                      <p className="text-sm text-gray-600">Citation Likelihood</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                      <div className="text-lg font-semibold">{toolData.subscores.conversationalReadiness}</div>
                      <p className="text-sm text-gray-600">Conversational Readiness</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                      <div className="text-lg font-semibold">{toolData.subscores.contentStructure}</div>
                      <p className="text-sm text-gray-600">Content Structure</p>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Recommendations:</h4>
                    <ul className="space-y-2">
                      {toolData.recommendations.map((rec: string, i: number) => (
                        <li key={i} className="flex items-start">
                          <span className="text-purple-600 mr-2">•</span>
                          <span className="text-gray-700">{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              
              {activeToolId === 'schema' && (
                <div>
                  <div className="bg-gray-800 text-green-400 p-4 rounded-lg overflow-x-auto mb-4">
                    <pre className="text-sm">{toolData.schema}</pre>
                  </div>
                  <p className="text-gray-700 mb-2">{toolData.instructions}</p>
                  <button
                    onClick={() => navigator.clipboard.writeText(toolData.implementation)}
                    className="text-purple-600 hover:text-purple-800 text-sm font-medium"
                  >
                    Copy Implementation Code
                  </button>
                </div>
              )}
              
              {activeToolId === 'generator' && (
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <h4 className="font-medium mb-2">Generated Content</h4>
                    <div className="space-y-3">
                      {toolData.content && toolData.content.map((item: any, i: number) => (
                        <div key={i} className="border-l-4 border-yellow-400 pl-4">
                          <h5 className="font-medium text-gray-900">{item.title || item.question}</h5>
                          <p className="text-gray-700 mt-1">{item.content || item.answer}</p>
                          {item.keywords && (
                            <div className="mt-2">
                              <span className="text-xs text-gray-500">Keywords: </span>
                              {item.keywords.map((keyword: string, ki: number) => (
                                <span key={ki} className="inline-block bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full mr-1">
                                  {keyword}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {toolData.suggestions && (
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                      <h4 className="font-medium mb-2">Implementation Suggestions</h4>
                      <ul className="space-y-2">
                        {toolData.suggestions.map((suggestion: string, i: number) => (
                          <li key={i} className="flex items-start">
                            <span className="text-yellow-600 mr-2">•</span>
                            <span className="text-gray-700">{suggestion}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              
              {activeToolId === 'discovery' && (
                <div className="space-y-4">
                  <p className="text-gray-700">Found {toolData.totalSuggestions} potential competitors for {selectedWebsite}</p>
                  
                  <div className="space-y-3">
                    {toolData.competitorSuggestions.map((comp: any, i: number) => (
                      <div key={i} className="bg-white p-4 rounded-lg shadow-sm">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium">{comp.name}</h4>
                            <a href={comp.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">{comp.url}</a>
                          </div>
                          <div className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full">
                            {comp.type.replace('_', ' ')}
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 mt-2">{comp.reason}</p>
                        <div className="mt-2">
                          <div className="text-xs text-gray-500">Relevance Score: {comp.relevanceScore}/100</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Add more tool-specific result displays as needed */}
              
              <div className="mt-6">
                <button
                  onClick={() => handleRunTool(activeToolId)}
                  className="text-purple-600 hover:text-purple-800 font-medium"
                >
                  Run Again
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
              <p className="text-gray-600 text-center">
                Click the button above to run this tool on {selectedWebsite || 'your selected website'}.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Otherwise, show the grid of tools
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Tools</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {availableTools.map((tool) => {
          const IconComponent = tool.icon;
          return (
            <div
              key={tool.id}
              onClick={() => handleToolClick(tool.id)}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md hover:border-purple-200 transition-all duration-300 cursor-pointer relative"
              data-walkthrough={tool.id === 'audit' ? 'audit-tool' : undefined}
            >
              {tool.isNew && (
                <div className="absolute top-4 right-4 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                  NEW
                </div>
              )}
              {tool.isPopular && (
                <div className="absolute top-4 right-4 bg-purple-500 text-white text-xs px-2 py-1 rounded-full">
                  POPULAR
                </div>
              )}
              <div className={`p-3 rounded-lg bg-gradient-to-r ${tool.color} mb-4`}>
                <IconComponent className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{tool.name}</h3>
              <p className="text-gray-600 text-sm mb-4">{tool.description}</p>
              <button className="text-sm text-purple-600 hover:text-purple-800 flex items-center space-x-1">
                <span>Run Tool</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ToolsGrid;