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
  Loader,
  CheckCircle
} from 'lucide-react';
import { apiService } from '../services/api';
import CompetitiveAnalysisModal from './CompetitiveAnalysisModal';
import { userDataService } from '../services/userDataService';
import { supabase } from '../lib/supabase';

interface ToolsGridProps {
  userPlan: 'free' | 'core' | 'pro' | 'agency';
  onToolRun: () => void;
  showPreview?: boolean;
  selectedTool?: string | null;
  selectedWebsite?: string;
  selectedProjectId?: string;
  userProfile?: any;
  onToolComplete?: (toolName: string, success: boolean, message?: string) => void;
  onSwitchTool: (toolId: string, context: any) => void;
  context?: any;
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
  selectedProjectId,
  userProfile,
  onToolComplete,
  onSwitchTool,
  context
}) => {
  const [activeToolId, setActiveToolId] = useState<string | null>(selectedTool || null);
  const [showCompetitiveAnalysisModal, setShowCompetitiveAnalysisModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toolData, setToolData] = useState<any>(null);
  const [runningTool, setRunningTool] = useState<string | null>(null);
  
  // AI Visibility Audit specific state
  const [auditScope, setAuditScope] = useState<'site' | 'page'>('site');
  const [pageUrl, setPageUrl] = useState('');

  // Schema Generator specific state
  const [schemaInputType, setSchemaInputType] = useState<'url' | 'text'>('url');
  const [schemaContent, setSchemaContent] = useState('');
  
  // Generator tool specific state
  const [generatorContentType, setGeneratorContentType] = useState<'faq' | 'meta-tags' | 'snippets' | 'headings' | 'descriptions'>('faq');
  const [generatorTopic, setGeneratorTopic] = useState('');
  const [generatorKeywords, setGeneratorKeywords] = useState('');
  const [generatorTone, setGeneratorTone] = useState<'professional' | 'casual' | 'technical' | 'friendly'>('professional');

  // Citation tracker specific state
  const [citationKeywords, setCitationKeywords] = useState('');
  const [fingerprintPhrases, setFingerprintPhrases] = useState('');

  // Prompt suggestions specific state
  const [promptTopic, setPromptTopic] = useState('');
  const [promptContentType, setPromptContentType] = useState<'article' | 'product' | 'service' | 'faq' | 'guide'>('article');
  const [promptUserIntent, setPromptUserIntent] = useState<'informational' | 'transactional' | 'navigational' | 'commercial'>('informational');

  // Entity to Content specific state
  const [selectedEntities, setSelectedEntities] = useState<string[]>([]);

  // Update active tool when selectedTool changes
  useEffect(() => {
    if (selectedTool) {
      setActiveToolId(selectedTool);
    }
  }, [selectedTool]);

  // Handle context passing when switching tools
  useEffect(() => {
    if (activeToolId === 'generator') {
      if (context?.entitiesToInclude) {
        setGeneratorTopic(context.topic || 'New content based on entity analysis');
        setGeneratorKeywords(context.entitiesToInclude.join(', '));
      } else if (context?.citation) {
        setGeneratorTopic(context.topic || `Responding to: "${context.citation.snippet}"`);
        setGeneratorKeywords(context.targetKeywords || '');
        setGeneratorContentType('faq'); // Default to FAQ for citation responses
      }
    }
  }, [activeToolId, context]);

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
      id: 'editor',
      name: 'Content Editor',
      description: 'Real-time analysis and suggestions for your content',
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
    // Remove the optimizer tool as it's redundant with the editor
    if (tool.id === 'optimizer') return false;
    
    const planHierarchy = { free: 0, core: 1, pro: 2, agency: 3 };
    const userLevel = planHierarchy[userPlan];
    const requiredLevel = planHierarchy[tool.planRequired];
    return userLevel >= requiredLevel;
  });

  const handleToolClick = (toolId: string) => {
    if (toolId === 'competitive') {
      setShowCompetitiveAnalysisModal(true);
    } else if (showPreview) {
      // In preview mode, just notify parent
      onToolRun();
    } else {
      // In normal mode, set active tool
      setActiveToolId(toolId);
      setToolData(null);
      setError(null);
      
      // Set default values for tool-specific inputs
      if (toolId === 'citations' && selectedWebsite) {
        const domain = extractDomain(selectedWebsite);
        setCitationKeywords(`${domain}, AI visibility, SEO`);
      }
      
      if (toolId === 'prompts' && selectedWebsite) {
        const domain = extractDomain(selectedWebsite);
        setPromptTopic(domain);
      }
    }
  };

  const handleFixItClick = (recommendation: any) => {
    if (recommendation.action_type === 'content-optimizer') {
      onSwitchTool('editor', { url: selectedWebsite });
    }
  };

  const handleGenerateWithEntities = () => {
    onSwitchTool('generator', {
      entitiesToInclude: selectedEntities,
      topic: `Content about ${extractDomain(selectedWebsite || '')} that includes key entities`,
      targetKeywords: selectedEntities,
    });
  };

  const handleCreateContentFromCitation = (citation: any) => {
    onSwitchTool('generator', {
      citation,
      topic: `Responding to a mention on ${citation.source}`,
      targetKeywords: citation.snippet.split(' ').slice(0, 5).join(', '), // Use first 5 words as keywords
    });
  };

  const extractDomain = (url: string): string => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch (e) {
      return url;
    }
  };

  const handleRunTool = async (toolId: string) => {
    if (!selectedWebsite && toolId !== 'generator') {
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
          const auditUrl = auditScope === 'page' && pageUrl ? `${selectedWebsite}${pageUrl}` : selectedWebsite;
          result = await apiService.runAudit(selectedProjectId, auditUrl);
          break;
        case 'schema':
          result = await apiService.generateSchema(
            selectedProjectId,
            schemaInputType === 'url' ? selectedWebsite : undefined,
            'article', // default content type
            schemaInputType === 'text' ? schemaContent : undefined
          );
          break;
        case 'citations':
          const domain = extractDomain(selectedWebsite);
          // Parse keywords from comma-separated string
          const citationKeywordsList = citationKeywords.split(',').map(k => k.trim()).filter(k => k);
          // Parse fingerprint phrases if any
          const fingerprintList = fingerprintPhrases.split('\n').map(p => p.trim()).filter(p => p);
          
          result = await apiService.trackCitations(
            selectedProjectId,
            domain, 
            citationKeywordsList.length > 0 ? citationKeywordsList : ['AI visibility', 'SEO'],
            fingerprintList.length > 0 ? fingerprintList : undefined
          );
          break;
        case 'voice':
          result = await apiService.testVoiceAssistants(
            `What is ${extractDomain(selectedWebsite)}?`, 
            ['siri', 'alexa', 'google']
          );
          break;
        case 'summaries':
          result = await apiService.generateLLMSummary(selectedProjectId, selectedWebsite, 'overview');
          break;
        case 'entities':
          result = await apiService.analyzeEntityCoverage(
            selectedProjectId,
            selectedWebsite, 
            undefined, 
            userProfile?.industry
          );
          break;
        case 'generator':
          // Parse keywords from comma-separated string
          const keywords = generatorKeywords.split(',').map(k => k.trim()).filter(k => k);
          
          if (!generatorTopic || keywords.length === 0) {
            throw new Error('Please provide a topic and at least one keyword');
          }
          
          result = await apiService.generateAIContent(
            selectedProjectId,
            generatorContentType,
            generatorTopic,
            keywords,
            generatorTone,
            userProfile?.industry,
            undefined,
            'medium'
          );
          break;
        case 'competitive':
          const competitors = userProfile?.competitors?.map((c: any) => c.url) || [];
          result = await apiService.performCompetitiveAnalysis(
            selectedProjectId,
            selectedWebsite,
            competitors.slice(0, 3),
            userProfile?.industry
          );
          break;
        case 'discovery':
          result = await apiService.discoverCompetitors(
            selectedProjectId,
            selectedWebsite,
            userProfile?.industry,
            userProfile?.business_description,
            userProfile?.competitors?.map((c: any) => c.url) || []
          );
          break;
        case 'prompts':
          if (!promptTopic) {
            setPromptTopic(extractDomain(selectedWebsite));
          }
          
          result = await apiService.generatePromptSuggestions(
            selectedProjectId,
            promptTopic || extractDomain(selectedWebsite),
            userProfile?.industry,
            undefined,
            promptContentType,
            promptUserIntent
          );
          break;
        default:
          throw new Error(`Tool ${toolId} not implemented`);
      }

      setToolData(result);
      onToolRun();

      // Save audit result to history
      if (toolId === 'audit') {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await userDataService.saveAuditResult({
              user_id: user.id,
              website_url: selectedWebsite,
              overall_score: result.overallScore,
              ai_understanding: result.subscores.aiUnderstanding,
              citation_likelihood: result.subscores.citationLikelihood,
              conversational_readiness: result.subscores.conversationalReadiness,
              content_structure: result.subscores.contentStructure,
              recommendations: result.recommendations,
              issues: result.issues.map((issue: any) => issue.title), // Storing titles for now
              audit_data: result
            });
          }
        } catch (error) {
          console.error('Error saving audit result:', error);
        }
      }

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
      setError(`Failed to run ${toolId}. Please try again. ${error instanceof Error ? error.message : ''}`);
      
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

          {/* AI Visibility Audit Tool Form */}
          {activeToolId === 'audit' && (
            <div className="mb-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Audit Scope</label>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="auditScope"
                      value="site"
                      checked={auditScope === 'site'}
                      onChange={() => setAuditScope('site')}
                      className="form-radio h-4 w-4 text-purple-600"
                    />
                    <span className="ml-2 text-gray-700">Entire Site</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="auditScope"
                      value="page"
                      checked={auditScope === 'page'}
                      onChange={() => setAuditScope('page')}
                      className="form-radio h-4 w-4 text-purple-600"
                    />
                    <span className="ml-2 text-gray-700">Specific Page</span>
                  </label>
                </div>
              </div>
              {auditScope === 'page' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Page URL</label>
                  <input
                    type="text"
                    value={pageUrl}
                    onChange={(e) => setPageUrl(e.target.value)}
                    placeholder="e.g., /blog/my-post"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                   <p className="mt-1 text-sm text-gray-500">
                    Enter a specific page path relative to your selected site.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Schema Generator Tool Form */}
          {activeToolId === 'schema' && (
            <div className="mb-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Input Type</label>
                <select
                  value={schemaInputType}
                  onChange={(e) => setSchemaInputType(e.target.value as any)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="url">Website URL</option>
                  <option value="text">Paste Content</option>
                </select>
              </div>
              {schemaInputType === 'text' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                  <textarea
                    value={schemaContent}
                    onChange={(e) => setSchemaContent(e.target.value)}
                    placeholder="Paste your content here..."
                    rows={6}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              )}
            </div>
          )}

          {/* Generator Tool Form */}
          {activeToolId === 'generator' && (
            <div className="mb-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Content Type
                  </label>
                  <select
                    value={generatorContentType}
                    onChange={(e) => setGeneratorContentType(e.target.value as any)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="faq">FAQ Content</option>
                    <option value="meta-tags">Meta Tags</option>
                    <option value="snippets">Featured Snippets</option>
                    <option value="headings">Heading Structure</option>
                    <option value="descriptions">Descriptions</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tone
                  </label>
                  <select
                    value={generatorTone}
                    onChange={(e) => setGeneratorTone(e.target.value as any)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="professional">Professional</option>
                    <option value="casual">Casual</option>
                    <option value="technical">Technical</option>
                    <option value="friendly">Friendly</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Topic
                </label>
                <input
                  type="text"
                  value={generatorTopic}
                  onChange={(e) => setGeneratorTopic(e.target.value)}
                  placeholder="e.g., AI Visibility, Content Optimization, Voice Search"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Keywords (comma separated)
                </label>
                <input
                  type="text"
                  value={generatorKeywords}
                  onChange={(e) => setGeneratorKeywords(e.target.value)}
                  placeholder="e.g., AI, SEO, optimization, visibility"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>
          )}

          {/* Citation Tracker Tool Form */}
          {activeToolId === 'citations' && (
            <div className="mb-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Keywords to Track (comma separated)
                </label>
                <input
                  type="text"
                  value={citationKeywords}
                  onChange={(e) => setCitationKeywords(e.target.value)}
                  placeholder="e.g., your brand name, product names, key topics"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Enter keywords related to your brand and content that you want to track mentions for
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fingerprint Phrases (optional, one per line)
                </label>
                <textarea
                  value={fingerprintPhrases}
                  onChange={(e) => setFingerprintPhrases(e.target.value)}
                  placeholder="Enter unique phrases that identify your content"
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Unique phrases that can be used to detect when your content is being cited
                </p>
              </div>
            </div>
          )}

          {/* Prompt Match Suggestions Tool Form */}
          {activeToolId === 'prompts' && (
            <div className="mb-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Topic
                </label>
                <input
                  type="text"
                  value={promptTopic}
                  onChange={(e) => setPromptTopic(e.target.value)}
                  placeholder="e.g., your product, service, or topic area"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <p className="mt-1 text-sm text-gray-500">
                  The main topic you want to generate AI prompt suggestions for
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Content Type
                  </label>
                  <select
                    value={promptContentType}
                    onChange={(e) => setPromptContentType(e.target.value as any)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="article">Article</option>
                    <option value="product">Product</option>
                    <option value="service">Service</option>
                    <option value="faq">FAQ</option>
                    <option value="guide">Guide</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    User Intent
                  </label>
                  <select
                    value={promptUserIntent}
                    onChange={(e) => setPromptUserIntent(e.target.value as any)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="informational">Informational</option>
                    <option value="transactional">Transactional</option>
                    <option value="navigational">Navigational</option>
                    <option value="commercial">Commercial</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="mb-6">
            <button
              onClick={() => handleRunTool(activeToolId)}
              disabled={loading || 
                (!selectedWebsite && activeToolId !== 'generator') || 
                (activeToolId === 'generator' && (!generatorTopic || !generatorKeywords)) ||
                (activeToolId === 'prompts' && !promptTopic)}
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
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg text-center">
                      <div className="text-2xl font-bold text-blue-600">{toolData.overallScore}</div>
                      <div className="text-sm text-blue-800">Overall Score</div>
                    </div>
                    <div className="bg-teal-50 p-4 rounded-lg text-center">
                      <div className="text-xl font-bold text-teal-600">{toolData.subscores?.aiUnderstanding}</div>
                      <div className="text-sm text-teal-800">AI Understanding</div>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg text-center">
                      <div className="text-xl font-bold text-purple-600">{toolData.subscores?.citationLikelihood}</div>
                      <div className="text-sm text-purple-800">Citation Likelihood</div>
                    </div>
                    <div className="bg-indigo-50 p-4 rounded-lg text-center">
                      <div className="text-xl font-bold text-indigo-600">{toolData.subscores?.conversationalReadiness}</div>
                      <div className="text-sm text-indigo-800">Conversational</div>
                    </div>
                  </div>

                  {toolData.recommendations && toolData.recommendations.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Key Recommendations:</h4>
                      <div className="space-y-3">
                        {toolData.recommendations.map((rec: { title: string, description: string, action_type?: string }, index: number) => (
                          <div key={index} className="bg-green-50 p-4 rounded-lg flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-start space-x-2">
                                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                                <span className="font-medium text-green-900">{rec.title}</span>
                              </div>
                              <p className="text-sm text-green-800 ml-6">{rec.description}</p>
                            </div>
                            {rec.action_type === 'content-optimizer' && (
                              <button
                                onClick={() => handleFixItClick(rec)}
                                className="ml-4 px-3 py-1 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 transition-colors"
                              >
                                Fix it
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {toolData.issues && toolData.issues.length > 0 && (
                    <div className="space-y-4">
                      <h4 className="font-medium text-gray-900">Issues Found:</h4>
                      <div className="space-y-3">
                        {toolData.issues.map((issue: any, index: number) => (
                          <IssueCard key={index} issue={issue} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {activeToolId === 'schema' && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-gray-900">Suggested Schema Type:</h4>
                    <p className="text-lg text-purple-600 font-semibold">{toolData.suggestedType}</p>
                  </div>
                  {toolData.validationWarnings && toolData.validationWarnings.length > 0 && (
                    <div className="bg-yellow-50 p-4 rounded-lg">
                      <h4 className="font-medium text-yellow-900 mb-2">Validation Warnings:</h4>
                      <ul className="text-sm text-yellow-800 space-y-2">
                        {toolData.validationWarnings.map((warning: any, index: number) => (
                          <li key={index} className="flex items-start space-x-2">
                            <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                            <span><strong>{warning.field}:</strong> {warning.message}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
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
                    <h4 className="font-medium mb-4">Generated {generatorContentType.replace('-', ' ')} Content</h4>
                    
                    {generatorContentType === 'faq' && toolData.generatedContent?.faqs && (
                      <div className="space-y-4">
                        {toolData.generatedContent.faqs.map((faq: any, i: number) => (
                          <div key={i} className="border-l-4 border-yellow-400 pl-4 py-1">
                            <h5 className="font-medium text-gray-900">{faq.question}</h5>
                            <p className="text-gray-700 mt-1">{faq.answer}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {generatorContentType === 'meta-tags' && toolData.generatedContent?.metaTags && (
                      <div className="space-y-3">
                        <div className="bg-gray-50 p-3 rounded border border-gray-200">
                          <div className="font-medium text-sm text-gray-500">Title Tag</div>
                          <div className="text-gray-800">{toolData.generatedContent.metaTags.title}</div>
                        </div>
                        <div className="bg-gray-50 p-3 rounded border border-gray-200">
                          <div className="font-medium text-sm text-gray-500">Meta Description</div>
                          <div className="text-gray-800">{toolData.generatedContent.metaTags.description}</div>
                        </div>
                        <div className="bg-gray-50 p-3 rounded border border-gray-200">
                          <div className="font-medium text-sm text-gray-500">Keywords</div>
                          <div className="text-gray-800">{toolData.generatedContent.metaTags.keywords}</div>
                        </div>
                      </div>
                    )}
                    
                    {(generatorContentType === 'snippets' || generatorContentType === 'headings' || generatorContentType === 'descriptions') && (
                      <div className="bg-gray-50 p-4 rounded border border-gray-200 whitespace-pre-wrap">
                        {toolData.generatedContent.raw}
                      </div>
                    )}
                  </div>
                  
                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <h4 className="font-medium mb-2">Optimization Tips</h4>
                    <ul className="space-y-2">
                      {toolData.optimizationTips?.map((tip: string, i: number) => (
                        <li key={i} className="flex items-start">
                          <span className="text-yellow-600 mr-2">•</span>
                          <span className="text-gray-700">{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="flex justify-end">
                    <button
                      onClick={() => navigator.clipboard.writeText(toolData.generatedContent.raw)}
                      className="text-purple-600 hover:text-purple-800 text-sm font-medium"
                    >
                      Copy Generated Content
                    </button>
                  </div>
                </div>
              )}
              
              {activeToolId === 'discovery' && (
                <div className="space-y-4">
                  <p className="text-gray-700">Found {toolData.competitorSuggestions?.length || 0} potential competitors for {selectedWebsite}</p>
                  
                  {toolData.competitorSuggestions && toolData.competitorSuggestions.length > 0 && (
                    <div className="mt-4 text-right">
                      <button
                        onClick={() => {
                          setShowCompetitiveAnalysisModal(true);
                        }}
                        className="bg-gradient-to-r from-red-500 to-orange-500 text-white px-4 py-2 rounded-lg font-medium hover:shadow-lg transition-all duration-300 flex items-center space-x-2"
                      >
                        <BarChart3 className="w-4 h-4" />
                        <span>Analyze these Competitors</span>
                      </button>
                    </div>
                  )}

                  <div className="space-y-3">
                    {toolData.competitorSuggestions?.map((comp: any, i: number) => (
                      <div key={i} className="bg-white p-4 rounded-lg shadow-sm">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium">{comp.name}</h4>
                            <a href={comp.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">{comp.url}</a>
                          </div>
                          <div className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full">
                            Relevance: {comp.relevanceScore}%
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 mt-2">{comp.explanation}</p>
                        <div className="mt-2">
                          <div className="text-xs text-gray-500">Domain Authority: {comp.domainAuthority || 'N/A'}</div>
                        </div>
                      </div>
                    )) || (
                      <div className="text-center py-8">
                        <p className="text-gray-500">No competitor suggestions found.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {activeToolId === 'entities' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                      <div className="bg-white p-4 rounded-lg shadow-sm">
                          <div className="text-3xl font-bold text-purple-600 mb-2">{toolData.coverageScore || 0}%</div>
                          <p className="text-gray-600">Coverage Score</p>
                      </div>
                      <div className="bg-white p-4 rounded-lg shadow-sm">
                          <div className="text-3xl font-bold text-blue-600 mb-2">{toolData.mentionedEntities?.length || 0}</div>
                          <p className="text-gray-600">Entities Mentioned</p>
                      </div>
                      <div className="bg-white p-4 rounded-lg shadow-sm">
                          <div className="text-3xl font-bold text-red-600 mb-2">{toolData.missingEntities?.length || 0}</div>
                          <p className="text-gray-600">Entities Missing</p>
                      </div>
                  </div>
                  
                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <h4 className="font-medium mb-4 text-red-700">Actionable Missing Entities</h4>
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {toolData.missingEntities?.map((entity: any, i: number) => (
                        <label key={i} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedEntities.includes(entity.name)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedEntities([...selectedEntities, entity.name]);
                              } else {
                                setSelectedEntities(selectedEntities.filter(name => name !== entity.name));
                              }
                            }}
                            className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                          />
                          <div className="flex-1">
                            <div className="flex justify-between">
                                <h5 className="font-medium text-gray-900">{entity.name}</h5>
                                <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full">{entity.type}</span>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">{entity.description}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                    {toolData.missingEntities?.length > 0 && (
                      <div className="mt-4 text-right">
                        <button
                          onClick={handleGenerateWithEntities}
                          disabled={selectedEntities.length === 0}
                          className="bg-gradient-to-r from-pink-500 to-yellow-500 text-white px-4 py-2 rounded-lg font-medium hover:shadow-lg transition-all duration-300 disabled:opacity-50 flex items-center space-x-2"
                        >
                          <Zap className="w-4 h-4" />
                          <span>Generate Content with {selectedEntities.length} Entities</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {activeToolId === 'competitive' && (
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <h4 className="font-medium mb-3">Competitive Analysis</h4>
                    
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Website</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Overall Score</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">AI Understanding</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Citation</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Conversational</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Structure</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {/* Primary site */}
                          {toolData.primarySiteAnalysis && (
                            <tr className="bg-purple-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {toolData.primarySiteAnalysis.name} (You)
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-purple-700">
                                {toolData.primarySiteAnalysis.overallScore}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                {toolData.primarySiteAnalysis.subscores.aiUnderstanding}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                {toolData.primarySiteAnalysis.subscores.citationLikelihood}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                {toolData.primarySiteAnalysis.subscores.conversationalReadiness}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                {toolData.primarySiteAnalysis.subscores.contentStructure}
                              </td>
                            </tr>
                          )}
                          
                          {/* Competitors */}
                          {toolData.competitorAnalyses?.map((comp: any, i: number) => (
                            <tr key={i}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {comp.name}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                {comp.overallScore}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                {comp.subscores.aiUnderstanding}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                {comp.subscores.citationLikelihood}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                {comp.subscores.conversationalReadiness}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                {comp.subscores.contentStructure}
                              </td>
                            </tr>
                          ))}
                          
                          {/* Industry average */}
                          <tr className="bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              Industry Average
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-700">
                              {toolData.benchmarks?.industryAverage || 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500" colSpan={4}>
                              
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                  
                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <h4 className="font-medium mb-3">Competitive Insights</h4>
                    <p className="text-gray-700 mb-4">
                      {toolData.summary?.competitivePosition === 'Leading' ? 
                        `You're leading your competitive set with a score of ${toolData.primarySiteAnalysis?.overallScore}. You're ${toolData.summary?.averageCompetitorScore ? toolData.primarySiteAnalysis?.overallScore - toolData.summary?.averageCompetitorScore : 0} points above the industry average.` :
                        toolData.summary?.competitivePosition === 'Competitive' ?
                        `You're competitive in your market with a score of ${toolData.primarySiteAnalysis?.overallScore}. The industry average is ${toolData.summary?.averageCompetitorScore}.` :
                        `You're currently behind competitors with a score of ${toolData.primarySiteAnalysis?.overallScore}. The industry average is ${toolData.summary?.averageCompetitorScore}.`
                      }
                    </p>
                    
                    <h5 className="font-medium text-gray-800 mb-2">Recommendations:</h5>
                    <ul className="space-y-1">
                      {toolData.recommendations?.map((rec: string, i: number) => (
                        <li key={i} className="flex items-start">
                          <span className="text-purple-600 mr-2">•</span>
                          <span className="text-gray-700">{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              
              {activeToolId === 'citations' && (
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <h4 className="font-medium mb-3">Citation Results</h4>
                    <p className="text-gray-700 mb-4">
                      Found {toolData.citations?.length || 0} mentions of your content across various platforms.
                    </p>
                    
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {toolData.citations?.map((citation: any, i: number) => (
                        <div key={i} className="border border-gray-200 rounded-lg p-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <h5 className="font-medium text-gray-900">{citation.source}</h5>
                              <a href={citation.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">{citation.url}</a>
                            </div>
                            <div className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full">
                              {citation.type}
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 mt-2 border-l-4 border-gray-200 pl-3 py-1">
                            "{citation.snippet}"
                          </p>
                          <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
                            <span>Confidence: {citation.confidence_score || 0}%</span>
                            <span>{new Date(citation.date).toLocaleDateString()}</span>
                          </div>
                          <div className="mt-3 pt-3 border-t border-gray-200 text-right">
                            <button
                              onClick={() => handleCreateContentFromCitation(citation)}
                              className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-3 py-1 rounded-md text-sm font-medium hover:shadow-lg transition-all duration-300 flex items-center space-x-2"
                            >
                              <Zap className="w-4 h-4" />
                              <span>Create Content</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              {activeToolId === 'voice' && (
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <h4 className="font-medium mb-3">Voice Assistant Test Results</h4>
                    <p className="text-gray-700 mb-4">
                      Query: "{toolData.query}"
                    </p>
                    
                    <div className="space-y-4">
                      {toolData.results?.map((result: any, i: number) => (
                        <div key={i} className={`border rounded-lg p-4 ${result.mentioned ? 'border-green-300 bg-green-50' : 'border-gray-200'}`}>
                          <div className="flex justify-between items-start">
                            <h5 className="font-medium text-gray-900">{result.assistant}</h5>
                            {result.mentioned && (
                              <div className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                                Mentioned Your Site
                              </div>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-2 border-l-4 border-gray-200 pl-3 py-1">
                            "{result.response}"
                          </p>
                          <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
                            <span>Confidence: {result.confidence}%</span>
                            {result.mentioned && (
                              <span>Ranking: #{result.ranking}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <h4 className="font-medium mb-3">Summary</h4>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold text-gray-900">{toolData.summary?.totalMentions || 0}/{toolData.summary?.assistantsTested || 0}</div>
                        <p className="text-sm text-gray-600">Assistants Mentioning You</p>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-gray-900">{toolData.summary?.averageRanking || 0}</div>
                        <p className="text-sm text-gray-600">Average Ranking</p>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-gray-900">{toolData.summary?.averageConfidence || 0}%</div>
                        <p className="text-sm text-gray-600">Average Confidence</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {activeToolId === 'summaries' && (
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <h4 className="font-medium mb-3">{toolData.summaryType?.charAt(0).toUpperCase() + toolData.summaryType?.slice(1)} Summary</h4>
                    <div className="bg-gray-50 p-4 rounded border border-gray-200 mb-4">
                      <p className="text-gray-700">{toolData.summary}</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h5 className="font-medium text-gray-800 mb-2">Key Entities</h5>
                        <ul className="space-y-1">
                          {toolData.entities?.map((entity: string, i: number) => (
                            <li key={i} className="text-sm text-gray-600 flex items-start">
                              <span className="text-purple-600 mr-2">•</span>
                              <span>{entity}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      
                      <div>
                        <h5 className="font-medium text-gray-800 mb-2">Main Topics</h5>
                        <ul className="space-y-1">
                          {toolData.topics?.map((topic: string, i: number) => (
                            <li key={i} className="text-sm text-gray-600 flex items-start">
                              <span className="text-purple-600 mr-2">•</span>
                              <span>{topic}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <h5 className="font-medium text-gray-800 mb-2">AI Optimization Notes</h5>
                      <p className="text-sm text-gray-600">{toolData.optimizationNotes}</p>
                    </div>
                  </div>
                </div>
              )}
              
              {activeToolId === 'prompts' && (
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <h4 className="font-medium mb-3">Prompt Match Suggestions</h4>
                    <p className="text-gray-700 mb-4">
                      Generated {toolData.totalPrompts} prompt suggestions for your content.
                    </p>
                    
                    <div className="space-y-4">
                      {Object.entries(toolData.promptsByCategory || {}).map(([category, prompts]: [string, any]) => (
                        <div key={category} className="border border-gray-200 rounded-lg p-4">
                          <h5 className="font-medium text-gray-900 mb-3">{category}</h5>
                          <div className="space-y-2">
                            {prompts.map((prompt: any, i: number) => (
                              <div key={i} className="bg-gray-50 p-3 rounded">
                                <div className="flex justify-between items-start">
                                  <p className="text-gray-800 font-medium">{prompt.prompt}</p>
                                  <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full">
                                    {prompt.intent}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-600 mt-2">{prompt.optimization}</p>
                                <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
                                  <span>Best for: {prompt.aiSystem}</span>
                                  <span>Likelihood: {prompt.likelihood}%</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
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
                {activeToolId === 'generator' ? 
                  'Configure the options above and click the button to generate content.' : 
                  `Click the button above to run this tool on ${selectedWebsite || 'your selected website'}.`}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Otherwise, show the grid of tools
  return (
    <>
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
      {showCompetitiveAnalysisModal && (
        <CompetitiveAnalysisModal
          userWebsites={userProfile?.websites || []}
          userCompetitors={toolData?.competitorSuggestions || userProfile?.competitors || []}
          onClose={() => setShowCompetitiveAnalysisModal(false)}
          onAnalysisComplete={(results) => {
            setToolData(results);
            setActiveToolId('competitive');
            setShowCompetitiveAnalysisModal(false);
          }}
        />
      )}
    </>
  );
};

export default ToolsGrid;

const IssueCard = ({ issue }: { issue: any }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const priorityColors = {
    High: 'bg-red-100 text-red-800',
    Medium: 'bg-yellow-100 text-yellow-800',
    Low: 'bg-blue-100 text-blue-800',
  };

  const categoryColors = {
    'Content': 'border-blue-500',
    'Technical SEO': 'border-purple-500',
    'User Experience': 'border-green-500',
    'Schema': 'border-orange-500',
  };

  return (
    <div className={`bg-white border-l-4 ${categoryColors[issue.category] || 'border-gray-500'} rounded-r-lg shadow-sm p-4`}>
      <div className="flex items-start justify-between">
        <div>
          <h5 className="font-semibold text-gray-800">{issue.title}</h5>
          <div className="flex items-center space-x-2 mt-1">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${priorityColors[issue.priority] || 'bg-gray-100 text-gray-800'}`}>
              {issue.priority} Priority
            </span>
            <span className="text-xs text-gray-500">{issue.category}</span>
          </div>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-sm text-purple-600 hover:text-purple-800"
        >
          {isExpanded ? 'Show Less' : 'Learn More'}
        </button>
      </div>
      <p className="text-gray-600 mt-3">{issue.suggestion}</p>
      {isExpanded && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <h6 className="font-semibold text-gray-700">Why it matters</h6>
          <p className="text-sm text-gray-600 mt-1">{issue.learnMore}</p>
        </div>
      )}
    </div>
  );
}