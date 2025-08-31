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
  CheckCircle,
  Radar,
  Copy,
  ExternalLink,
  Star,
  TrendingDown
} from 'lucide-react';
import { apiService } from '../services/api';
import CompetitiveAnalysisModal from './CompetitiveAnalysisModal';
import { userDataService } from '../services/userDataService';
import { supabase } from '../lib/supabase';
import { mapRecommendationToTool } from '../utils/fixItRouter';

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
  const [schemaContentType, setSchemaContentType] = useState<string>('Article');

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

  // Voice Assistant specific state
  const [voiceQuery, setVoiceQuery] = useState('');
  const [selectedAssistants, setSelectedAssistants] = useState<string[]>(['siri', 'alexa', 'google']);

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
      } else {
        if (context?.topic) setGeneratorTopic(context.topic);
        if (context?.targetKeywords) setGeneratorKeywords(context.targetKeywords);
        if (context?.contentType) setGeneratorContentType(context.contentType);
      }
    }
    if (activeToolId === 'competitive' && context?.competitors) {
        setShowCompetitiveAnalysisModal(true);
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
      planRequired: 'free',
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
      icon: Radar,
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
    if (toolId === 'competitive') {
      setShowCompetitiveAnalysisModal(true);
    } else if (showPreview) {
      onToolRun();
    } else {
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

      if (toolId === 'voice' && selectedWebsite) {
        const domain = extractDomain(selectedWebsite);
        setVoiceQuery(`What is ${domain}?`);
      }
    }
  };

  const extractDomain = (url: string): string => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch (e) {
      return url;
    }
  };

  const isRunDisabled = (toolId: string | null, projectId?: string, website?: string): boolean => {
    if (loading || !toolId) return true;

    // Most tools require a project and website
    if (!['voice', 'generator'].includes(toolId) && (!projectId || !website)) {
      return true;
    }

    // Tool-specific validation
    if (toolId === 'generator' && (!generatorTopic || !generatorKeywords)) return true;
    if (toolId === 'prompts' && !promptTopic) return true;
    if (toolId === 'voice' && !voiceQuery) return true;

    return false;
  };

  const handleRunTool = async (toolId: string) => {
    if (!selectedWebsite && toolId !== 'generator' && toolId !== 'voice') {
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
          result = await apiService.runAudit(selectedProjectId!, auditUrl!);
          break;

        case 'schema':
          result = await apiService.generateSchema(
            selectedProjectId!,
            schemaInputType === 'url' ? selectedWebsite! : '',
            schemaContentType,
            schemaInputType === 'text' ? schemaContent : undefined
          );
          break;

        case 'citations':
          const domain = extractDomain(selectedWebsite!);
          const citationKeywordsList = citationKeywords.split(',').map(k => k.trim()).filter(k => k);
          const fingerprintList = fingerprintPhrases.split('\n').map(p => p.trim()).filter(p => p);
          
          result = await apiService.trackCitations(
            selectedProjectId!,
            domain, 
            citationKeywordsList.length > 0 ? citationKeywordsList : ['AI visibility', 'SEO'],
            fingerprintList.length > 0 ? fingerprintList : undefined
          );
          break;

        case 'voice':
          result = await apiService.testVoiceAssistants(voiceQuery, selectedAssistants);
          break;

        case 'summaries':
          result = await apiService.generateLLMSummary(selectedProjectId!, selectedWebsite!, 'overview');
          break;

        case 'entities':
          result = await apiService.analyzeEntityCoverage(
            selectedProjectId!,
            selectedWebsite!, 
            undefined, 
            userProfile?.industry
          );
          break;

        case 'generator':
          const keywords = generatorKeywords.split(',').map(k => k.trim()).filter(k => k);
          
          if (!generatorTopic || keywords.length === 0) {
            throw new Error('Please provide a topic and at least one keyword');
          }
          
          result = await apiService.generateAIContent(
            selectedProjectId!,
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
            selectedProjectId!,
            selectedWebsite!,
            competitors.slice(0, 3),
            userProfile?.industry
          );
          break;

        case 'discovery':
          result = await apiService.discoverCompetitors(
            selectedProjectId!,
            selectedWebsite!,
            userProfile?.industry,
            userProfile?.business_description,
            userProfile?.competitors?.map((c: any) => c.url) || []
          );
          break;

        case 'prompts':
          if (!promptTopic) {
            setPromptTopic(extractDomain(selectedWebsite || ''));
          }
          
          result = await apiService.generatePromptSuggestions(
            selectedProjectId!,
            promptTopic || extractDomain(selectedWebsite || ''),
            userProfile?.industry,
            undefined,
            promptContentType,
            promptUserIntent
          );
          break;

        default:
          throw new Error(`Tool ${toolId} not implemented`);
      }

      // Ensure result has proper structure
      if (!result) {
        throw new Error('No result returned from API');
      }

      // Normalize result structure to handle different API response formats
      const normalizedResult = normalizeResult(toolId, result);
      
      setToolData(normalizedResult);
      onToolRun();

      // Save audit result to history
      if (toolId === 'audit') {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user && normalizedResult) {
            await userDataService.saveAuditResult({
              user_id: user.id,
              website_url: selectedWebsite!,
              overall_score: normalizedResult.overallScore || 0,
              ai_understanding: normalizedResult.subscores?.aiUnderstanding || 0,
              citation_likelihood: normalizedResult.subscores?.citationLikelihood || 0,
              conversational_readiness: normalizedResult.subscores?.conversationalReadiness || 0,
              content_structure: normalizedResult.subscores?.contentStructure || 0,
              recommendations: normalizedResult.recommendations?.map((r: any) => r.title || r) || [],
              issues: normalizedResult.issues?.map((issue: any) => issue.title || issue) || [],
              audit_data: normalizedResult
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
            activity_data: { toolId, result: normalizedResult },
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(`Failed to run ${toolId}. ${errorMessage}`);
      
      // Notify parent of failure
      if (onToolComplete) {
        onToolComplete(
          tools.find(t => t.id === toolId)?.name || toolId,
          false,
          errorMessage
        );
      }
    } finally {
      setLoading(false);
      setRunningTool(null);
    }
  };

  // Normalize different result structures into consistent format
  const normalizeResult = (toolId: string, result: any): any => {
    if (!result) return null;

    // Handle wrapped results
    if (result.data && typeof result.data === 'object') {
      result = result.data;
    }

    // Handle success wrapper
    if (result.success && result.data) {
      result = result.data;
    }

    // Tool-specific normalization
    switch (toolId) {
      case 'audit':
        return {
          overallScore: result.overallScore || result.overall_score || 0,
          subscores: {
            aiUnderstanding: result.subscores?.aiUnderstanding || result.ai_understanding || 0,
            citationLikelihood: result.subscores?.citationLikelihood || result.citation_likelihood || 0,
            conversationalReadiness: result.subscores?.conversationalReadiness || result.conversational_readiness || 0,
            contentStructure: result.subscores?.contentStructure || result.content_structure || 0
          },
          recommendations: result.recommendations || [],
          issues: result.issues || [],
          strengths: result.strengths || [],
          keyInsights: result.keyInsights || result.key_insights || [],
          auditedAt: result.auditedAt || result.audited_at || new Date().toISOString(),
          url: result.url || selectedWebsite
        };

      case 'schema':
        return {
          schema: result.schema || result.schemaMarkup || result.markup || JSON.stringify(result, null, 2),
          implementation: result.implementation || result.implementationCode || '',
          instructions: result.instructions || 'Add this schema markup to your HTML head section.',
          schemaType: result.schemaType || result.type || 'Article'
        };

      case 'citations':
        return {
          total: result.total || result.totalCitations || (result.citations ? result.citations.length : 0),
          citations: result.citations || result.results || [],
          sources: result.sources || { llm: 0, traditional: 0 },
          confidenceBreakdown: result.confidenceBreakdown || { high: 0, medium: 0, low: 0 },
          timeframe: result.timeframe || '30 days',
          keywords: result.keywords || []
        };

      case 'voice':
        return {
          results: result.results || result.assistantResults || [],
          summary: {
            totalMentions: result.summary?.totalMentions || 0,
            averageRanking: result.summary?.averageRanking || 0,
            averageConfidence: result.summary?.averageConfidence || 0
          },
          query: result.query || voiceQuery
        };

      case 'summaries':
        return {
          summary: result.summary || result.generatedSummary || 'Summary generated successfully',
          entities: result.entities || result.keyEntities || [],
          topics: result.topics || result.mainTopics || [],
          wordCount: result.wordCount || result.word_count || 0,
          readability: result.readability || 'Medium'
        };

      case 'entities':
        return {
          coverageScore: result.coverageScore || result.coverage_score || 0,
          mentionedCount: result.mentionedCount || result.mentioned_count || 0,
          missingCount: result.missingCount || result.missing_count || 0,
          missingEntities: result.missingEntities || result.missing_entities || [],
          mentionedEntities: result.mentionedEntities || result.mentioned_entities || [],
          recommendations: result.recommendations || []
        };

      case 'generator':
        return {
          generatedContent: result.generatedContent || result.content || result,
          optimizationTips: result.optimizationTips || result.tips || [],
          wordCount: result.wordCount || 0,
          generatedAt: result.generatedAt || new Date().toISOString(),
          contentType: generatorContentType
        };

      case 'prompts':
        return {
          promptSuggestions: result.promptSuggestions || result.prompts || result.suggestions || [],
          totalPrompts: result.totalPrompts || (result.promptSuggestions ? result.promptSuggestions.length : 0),
          averageLikelihood: result.averageLikelihood || 0,
          statistics: result.statistics || { highLikelihoodPrompts: 0 }
        };

      case 'competitive':
        return {
          summary: {
            ranking: result.summary?.ranking || result.ranking || 'N/A',
            primarySiteScore: result.summary?.primarySiteScore || result.yourScore || 0,
            averageCompetitorScore: result.summary?.averageCompetitorScore || result.competitorAverage || 0
          },
          competitorAnalyses: result.competitorAnalyses || result.competitors || [],
          insights: result.insights || []
        };

      case 'discovery':
        return {
          competitorSuggestions: result.competitorSuggestions || result.suggestions || result.competitors || [],
          totalSuggestions: result.totalSuggestions || (result.competitorSuggestions ? result.competitorSuggestions.length : 0),
          averageRelevance: result.averageRelevance || 0,
          competitiveIntensity: result.competitiveIntensity || 'Medium'
        };

      default:
        return result;
    }
  };

  const handleFixItClick = (recommendation: any) => {
    const route = mapRecommendationToTool(recommendation, { selectedWebsite });
    onSwitchTool(route.toolId, {
      source: 'fixit',
      fromRecommendation: recommendation,
      ...(route.context || {}),
    });
  };

  const handleGenerateWithEntities = (entitiesToInclude: string[]) => {
    onSwitchTool('generator', {
      entitiesToInclude,
      topic: `Content about ${extractDomain(selectedWebsite || '')} that includes key entities`,
      targetKeywords: entitiesToInclude.join(', '),
    });
  };

  const handleCreateContentFromCitation = (citation: any) => {
    onSwitchTool('generator', {
      citation,
      topic: `Responding to a mention on ${citation.source}`,
      targetKeywords: citation.snippet.split(' ').slice(0, 5).join(', '),
    });
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

          {/* Tool Configuration Forms */}
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

          {activeToolId === 'schema' && (
            <div className="mb-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Content Type</label>
                <select
                  value={schemaContentType}
                  onChange={(e) => setSchemaContentType(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="Article">Article</option>
                  <option value="FAQPage">FAQ</option>
                  <option value="HowTo">How-To Guide</option>
                </select>
              </div>
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

          {activeToolId === 'voice' && (
            <div className="mb-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Voice Query
                </label>
                <input
                  type="text"
                  value={voiceQuery}
                  onChange={(e) => setVoiceQuery(e.target.value)}
                  placeholder="What is your business about?"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Enter the question users might ask voice assistants about your business
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Voice Assistants</label>
                <div className="space-y-2">
                  {['siri', 'alexa', 'google'].map(assistant => (
                    <label key={assistant} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedAssistants.includes(assistant)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedAssistants([...selectedAssistants, assistant]);
                          } else {
                            setSelectedAssistants(selectedAssistants.filter(a => a !== assistant));
                          }
                        }}
                        className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700 capitalize">{assistant}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

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
              disabled={isRunDisabled(activeToolId, selectedProjectId, selectedWebsite)}
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
              
              {/* Tool-specific results rendering */}
              <ToolResultsDisplay 
                toolId={activeToolId} 
                data={toolData} 
                onFixItClick={handleFixItClick}
                onGenerateWithEntities={handleGenerateWithEntities}
                onCreateContentFromCitation={handleCreateContentFromCitation}
                onSwitchTool={onSwitchTool}
                userProfile={userProfile}
                selectedWebsite={selectedWebsite}
              />
              
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
          userCompetitors={context?.competitors || toolData?.competitorSuggestions || userProfile?.competitors || []}
          maxSelectable={{ free: 1, core: 3, pro: 10, agency: 25 }[(userProfile?.plan || 'free') as 'free'|'core'|'pro'|'agency']}
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

// Separate component for rendering tool results
const ToolResultsDisplay: React.FC<{
  toolId: string;
  data: any;
  onFixItClick: (recommendation: any) => void;
  onGenerateWithEntities: (entitiesToInclude: string[]) => void;
  onCreateContentFromCitation: (citation: any) => void;
  onSwitchTool: (toolId: string, context: any) => void;
  userProfile?: any;
  selectedWebsite?: string;
}> = ({ toolId, data, onFixItClick, onGenerateWithEntities, onCreateContentFromCitation, onSwitchTool, userProfile, selectedWebsite }) => {
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Lightweight state for a simple Fixes Playlist walkthrough (persisted per website)
  const [playlistIndex, setPlaylistIndex] = React.useState(0);
  // Selection for adding discovered competitors
  const [selectedToAdd, setSelectedToAdd] = React.useState<string[]>([]);

  React.useEffect(() => {
    const loadProgress = async () => {
      if (toolId !== 'audit' || !userProfile?.user_id || !selectedWebsite) return;
      try {
        const prog = await userDataService.getFixesPlaylistProgress(userProfile.user_id, selectedWebsite);
        if (prog && typeof prog.index === 'number' && data?.recommendations?.length) {
          const bounded = Math.min(Math.max(0, prog.index), data.recommendations.length - 1);
          setPlaylistIndex(bounded);
        }
      } catch {}
    };
    loadProgress();
  }, [toolId, userProfile?.user_id, selectedWebsite, data?.recommendations?.length]);

  switch (toolId) {
    case 'audit':
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-blue-600">{data.overallScore || 0}</div>
              <div className="text-sm text-blue-800">Overall Score</div>
            </div>
            <div className="bg-teal-50 p-4 rounded-lg text-center">
              <div className="text-xl font-bold text-teal-600">{data.subscores?.aiUnderstanding || 0}</div>
              <div className="text-sm text-teal-800">AI Understanding</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg text-center">
              <div className="text-xl font-bold text-purple-600">{data.subscores?.citationLikelihood || 0}</div>
              <div className="text-sm text-purple-800">Citation Likelihood</div>
            </div>
            <div className="bg-indigo-50 p-4 rounded-lg text-center">
              <div className="text-xl font-bold text-indigo-600">{data.subscores?.conversationalReadiness || 0}</div>
              <div className="text-sm text-indigo-800">Conversational</div>
            </div>
          </div>

          {data.recommendations && data.recommendations.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Key Recommendations:</h4>
              <div className="space-y-3">
                {data.recommendations.map((rec: any, index: number) => (
                  <div key={index} className="bg-green-50 p-4 rounded-lg flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-start space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span className="font-medium text-green-900">{rec.title || rec}</span>
                      </div>
                      {rec.description && (
                        <p className="text-sm text-green-800 ml-6">{rec.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => onFixItClick(rec)}
                      className="ml-4 px-3 py-1 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 transition-colors"
                    >
                      Fix it
                    </button>
                  </div>
                ))}
              </div>
              {/* Simple Fixes Playlist */}
              <div className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="font-medium text-gray-900">Fixes Playlist</h5>
                  <span className="text-xs text-gray-500">Step {Math.min(playlistIndex + 1, data.recommendations.length)} of {data.recommendations.length}</span>
                </div>
                {data.recommendations[playlistIndex] && (
                  <div className="flex items-start justify-between">
                    <div className="pr-4">
                      <div className="font-medium text-gray-800">{data.recommendations[playlistIndex].title || String(data.recommendations[playlistIndex])}</div>
                      {data.recommendations[playlistIndex].description && (
                        <p className="text-sm text-gray-600 mt-1">{data.recommendations[playlistIndex].description}</p>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={async () => {
                          const nextIndex = Math.max(0, playlistIndex - 1);
                          setPlaylistIndex(nextIndex);
                          if (userProfile?.user_id && selectedWebsite) {
                            await userDataService.saveFixesPlaylistProgress({
                              userId: userProfile.user_id,
                              websiteUrl: selectedWebsite,
                              index: nextIndex,
                              total: data.recommendations.length,
                              note: 'prev'
                            });
                          }
                        }}
                        className="px-3 py-1 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                        disabled={playlistIndex === 0}
                      >
                        Previous
                      </button>
                      <button
                        onClick={async () => {
                          if (userProfile?.user_id && selectedWebsite) {
                            await userDataService.saveFixesPlaylistProgress({
                              userId: userProfile.user_id,
                              websiteUrl: selectedWebsite,
                              index: playlistIndex,
                              total: data.recommendations.length,
                              note: 'do-it-now'
                            });
                          }
                          onFixItClick(data.recommendations[playlistIndex]);
                        }}
                        className="px-3 py-1 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700"
                      >
                        Do it now
                      </button>
                      <button
                        onClick={async () => {
                          const nextIndex = Math.min(data.recommendations.length - 1, playlistIndex + 1);
                          setPlaylistIndex(nextIndex);
                          if (userProfile?.user_id && selectedWebsite) {
                            await userDataService.saveFixesPlaylistProgress({
                              userId: userProfile.user_id,
                              websiteUrl: selectedWebsite,
                              index: nextIndex,
                              total: data.recommendations.length,
                              note: 'next'
                            });
                          }
                        }}
                        className="px-3 py-1 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                        disabled={playlistIndex >= data.recommendations.length - 1}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {data.issues && data.issues.length > 0 && (
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Issues Found:</h4>
              <div className="space-y-3">
                {data.issues.map((issue: any, index: number) => (
                  <IssueCard key={index} issue={issue} />
                ))}
              </div>
            </div>
          )}

          {data.strengths && data.strengths.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 mb-2">What's Working Well:</h4>
              <div className="bg-green-50 p-4 rounded-lg">
                <ul className="text-sm text-green-800 space-y-2">
                  {data.strengths.map((strength: string, index: number) => (
                    <li key={index} className="flex items-start space-x-2">
                      <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>{strength}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {data.keyInsights && data.keyInsights.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Key Insights:</h4>
              <div className="bg-blue-50 p-4 rounded-lg">
                <ul className="text-sm text-blue-800 space-y-2">
                  {data.keyInsights.map((insight: string, index: number) => (
                    <li key={index} className="flex items-start space-x-2">
                      <span className="text-blue-600 mr-2">💡</span>
                      <span>{insight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      );
      
    case 'schema':
      return (
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-900">Generated Schema Markup</h4>
              <button
                onClick={() => copyToClipboard(typeof data.schema === 'string' ? data.schema : JSON.stringify(data.schema, null, 2))}
                className="text-blue-600 hover:text-blue-700 p-1 rounded"
                title="Copy to clipboard"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-gray-800 text-green-400 p-4 rounded-lg overflow-x-auto mb-4">
              <pre className="text-sm">{typeof data.schema === 'string' ? data.schema : JSON.stringify(data.schema, null, 2)}</pre>
            </div>
            <p className="text-gray-700 mb-2">{data.instructions}</p>
            {data.implementation && (
              <button
                onClick={() => copyToClipboard(typeof data.implementation === 'string' ? data.implementation : JSON.stringify(data.implementation, null, 2))}
                className="text-purple-600 hover:text-purple-800 text-sm font-medium"
              >
                Copy Implementation Code
              </button>
            )}
          </div>
        </div>
      );

    // *** MODIFIED: Citation results now have "Create Response" button ***
    case 'citations':
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg text-center">
              <div className="text-xl font-bold text-blue-600">{data.total || 0}</div>
              <div className="text-sm text-blue-800">Total Citations</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg text-center">
              <div className="text-xl font-bold text-green-600">{data.confidenceBreakdown?.high || 0}</div>
              <div className="text-sm text-green-800">High Confidence</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg text-center">
              <div className="text-xl font-bold text-purple-600">{data.sources?.llm || 0}</div>
              <div className="text-sm text-purple-800">LLM Mentions</div>
            </div>
          </div>
          
          {data.citations && data.citations.length > 0 && (
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Recent Citations:</h4>
              {data.citations.slice(0, 5).map((citation: any, index: number) => (
                <div key={index} className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{citation.source || `Source ${index + 1}`}</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {citation.type || 'LLM'}
                      </span>
                      <button
                        onClick={() => onCreateContentFromCitation(citation)}
                        className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded hover:bg-purple-200 transition-colors"
                      >
                        Create Response
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">{citation.snippet || citation.text || 'No snippet available'}</p>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs text-gray-500">
                      {citation.date ? new Date(citation.date).toLocaleDateString() : 'Recent'}
                    </span>
                    {citation.url && (
                      <a 
                        href={citation.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:text-blue-700 flex items-center space-x-1"
                      >
                        <span>View Source</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );

    case 'voice':
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg text-center">
              <div className="text-xl font-bold text-blue-600">{data.summary?.totalMentions || 0}</div>
              <div className="text-sm text-blue-800">Mentions</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg text-center">
              <div className="text-xl font-bold text-green-600">{data.summary?.averageRanking || 0}</div>
              <div className="text-sm text-green-800">Avg Ranking</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg text-center">
              <div className="text-xl font-bold text-purple-600">{data.summary?.averageConfidence || 0}%</div>
              <div className="text-sm text-purple-800">Confidence</div>
            </div>
          </div>
          
          {data.results && data.results.length > 0 && (
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Assistant Responses:</h4>
              {data.results.map((voiceResult: any, index: number) => (
                <div key={index} className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900 capitalize">{voiceResult.assistant}</span>
                    <span className={`text-sm px-2 py-1 rounded ${voiceResult.mentioned ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      {voiceResult.mentioned ? 'Mentioned' : 'Not Mentioned'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">{voiceResult.response || 'No response available'}</p>
                  <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                    <span>Confidence: {voiceResult.confidence || 0}%</span>
                    {voiceResult.mentioned && voiceResult.ranking && (
                      <span>Ranking: #{voiceResult.ranking}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );

    case 'summaries':
      return (
        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">AI-Optimized Summary</h4>
            <p className="text-gray-700 mb-3">{data.summary}</p>
            
            {data.entities && data.entities.length > 0 && (
              <div className="mb-3">
                <h5 className="font-medium text-gray-800 mb-1">Key Entities:</h5>
                <div className="flex flex-wrap gap-1">
                  {data.entities.slice(0, 10).map((entity: string, index: number) => (
                    <span key={index} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                      {entity.split(':')[0]}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {data.topics && data.topics.length > 0 && (
              <div>
                <h5 className="font-medium text-gray-800 mb-1">Main Topics:</h5>
                <div className="flex flex-wrap gap-1">
                  {data.topics.slice(0, 8).map((topic: string, index: number) => (
                    <span key={index} className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            <div className="mt-3 text-xs text-gray-600">
              Word count: {data.wordCount} | Readability: {data.readability}
            </div>
          </div>
        </div>
      );

    // *** MODIFIED: Entity results now have "Generate Content" button ***
    case 'entities':
        const missingEntitiesForGeneration = (data.missingEntities || []).map(e => e.name || e).slice(0, 5);
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg text-center">
                        <div className="text-xl font-bold text-blue-600">{data.coverageScore || 0}%</div>
                        <div className="text-sm text-blue-800">Coverage Score</div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg text-center">
                        <div className="text-xl font-bold text-green-600">{data.mentionedCount || 0}</div>
                        <div className="text-sm text-green-800">Mentioned</div>
                    </div>
                    <div className="bg-red-50 p-4 rounded-lg text-center">
                        <div className="text-xl font-bold text-red-600">{data.missingCount || 0}</div>
                        <div className="text-sm text-red-800">Missing</div>
                    </div>
                </div>

                {data.missingEntities && data.missingEntities.length > 0 && (
                    <div className="bg-yellow-50 p-4 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-yellow-900">Missing Important Entities:</h4>
                            <button
                                onClick={() => onGenerateWithEntities(missingEntitiesForGeneration)}
                                className="text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded hover:bg-purple-200 transition-colors"
                            >
                                Generate Content
                            </button>
                        </div>
                        <div className="space-y-2">
                            {data.missingEntities.slice(0, 8).map((entity: any, index: number) => (
                                <div key={index} className="flex items-center justify-between">
                                    <span className="text-yellow-800">{entity.name || entity}</span>
                                    <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-1 rounded">
                                        {entity.type || 'Entity'} - {entity.importance || 'Important'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {data.mentionedEntities && data.mentionedEntities.length > 0 && (
                    <div className="bg-green-50 p-4 rounded-lg">
                        <h4 className="font-medium text-green-900 mb-2">Well-Covered Entities:</h4>
                        <div className="flex flex-wrap gap-2">
                            {data.mentionedEntities.slice(0, 10).map((entity: any, index: number) => (
                                <span key={index} className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                                    {entity.name || entity}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );

    case 'generator':
      return (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium">Generated {data.contentType?.replace('-', ' ') || 'Content'}</h4>
              <button
                onClick={() => copyToClipboard(JSON.stringify(data.generatedContent, null, 2))}
                className="text-blue-600 hover:text-blue-700 p-1 rounded"
                title="Copy to clipboard"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            
            {/* Upsell for advanced editing (Free plan) */}
            {userProfile?.plan === 'free' && (
              <div className="mb-3 p-3 rounded border border-purple-200 bg-purple-50 text-sm text-purple-900">
                Draft ready. Upgrade to Core to refine with Entities, Schema, Citations, and Publish.
              </div>
            )}
            {/* Open in Editor CTA */}
            <div className="mb-4">
              <button
                onClick={() => {
                  // Build plain content for editor context
                  let contentText = '';
                  let titleText = 'Generated Content';
                  let keywordsText = '';
                  const gc = data.generatedContent;
                  if (gc?.faqs) {
                    titleText = 'FAQs';
                    contentText = gc.faqs.map((f: any) => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n');
                  } else if (gc?.metaTags) {
                    titleText = gc.metaTags.title || 'Meta Tags';
                    contentText = `Title: ${gc.metaTags.title}\n\nDescription: ${gc.metaTags.description}\n\nKeywords: ${gc.metaTags.keywords || ''}`;
                    keywordsText = gc.metaTags.keywords || '';
                  } else if (typeof gc === 'string') {
                    contentText = gc;
                  } else if (gc?.raw || gc?.snippet || gc?.description || gc?.headings) {
                    contentText = gc.raw || gc.snippet || gc.description || (Array.isArray(gc.headings) ? gc.headings.join('\n') : String(gc.headings));
                  } else {
                    contentText = JSON.stringify(gc, null, 2);
                  }

                  onSwitchTool('editor', {
                    source: 'generator-open-in-editor',
                    content: contentText,
                    title: titleText,
                    keywords: keywordsText,
                    contentType: data.contentType || 'content'
                  });
                }}
                className="px-3 py-1 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 transition-colors"
              >
                Open in Editor
              </button>
            </div>

            {data.generatedContent?.faqs && (
              <div className="space-y-4">
                <h5 className="font-medium text-gray-800">Generated FAQs:</h5>
                {data.generatedContent.faqs.map((faq: any, i: number) => (
                  <div key={i} className="border-l-4 border-yellow-400 pl-4 py-2 bg-yellow-50">
                    <h6 className="font-medium text-gray-900">{faq.question}</h6>
                    <p className="text-gray-700 mt-1">{faq.answer}</p>
                  </div>
                ))}
              </div>
            )}
            
            {data.generatedContent?.metaTags && (
              <div className="space-y-3">
                <h5 className="font-medium text-gray-800">Generated Meta Tags:</h5>
                <div className="bg-gray-50 p-3 rounded border border-gray-200">
                  <div className="font-medium text-sm text-gray-500">Title Tag</div>
                  <div className="text-gray-800">{data.generatedContent.metaTags.title}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded border border-gray-200">
                  <div className="font-medium text-sm text-gray-500">Meta Description</div>
                  <div className="text-gray-800">{data.generatedContent.metaTags.description}</div>
                </div>
                {data.generatedContent.metaTags.keywords && (
                  <div className="bg-gray-50 p-3 rounded border border-gray-200">
                    <div className="font-medium text-sm text-gray-500">Keywords</div>
                    <div className="text-gray-800">{data.generatedContent.metaTags.keywords}</div>
                  </div>
                )}
              </div>
            )}
            
            {(data.generatedContent?.snippets || data.generatedContent?.headings || data.generatedContent?.descriptions) && (
              <div className="space-y-3">
                <h5 className="font-medium text-gray-800">Generated Content:</h5>
                <div className="bg-gray-50 p-4 rounded border border-gray-200 whitespace-pre-wrap">
                  {data.generatedContent?.raw || 
                   data.generatedContent?.snippet || 
                   data.generatedContent?.description ||
                   data.generatedContent?.headings ||
                   'Content generated successfully'}
                </div>
              </div>
            )}

            {typeof data.generatedContent === 'string' && (
              <div className="space-y-3">
                <h5 className="font-medium text-gray-800">Generated Content:</h5>
                <div className="bg-gray-50 p-4 rounded border border-gray-200 whitespace-pre-wrap">
                  {data.generatedContent}
                </div>
              </div>
            )}
          </div>
          
          {data.optimizationTips && data.optimizationTips.length > 0 && (
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <h4 className="font-medium mb-2">Optimization Tips</h4>
              <ul className="space-y-2">
                {data.optimizationTips.map((tip: string, i: number) => (
                  <li key={i} className="flex items-start">
                    <span className="text-yellow-600 mr-2">💡</span>
                    <span className="text-gray-700">{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          <div className="text-xs text-gray-600">
            Word count: {data.wordCount || 0} | Generated: {data.generatedAt ? new Date(data.generatedAt).toLocaleString() : 'Just now'}
          </div>
        </div>
      );

    case 'prompts':
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg text-center">
              <div className="text-xl font-bold text-blue-600">{data.totalPrompts || 0}</div>
              <div className="text-sm text-blue-800">Total Prompts</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg text-center">
              <div className="text-xl font-bold text-green-600">{data.averageLikelihood || 0}%</div>
              <div className="text-sm text-green-800">Avg Likelihood</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg text-center">
              <div className="text-xl font-bold text-purple-600">{data.statistics?.highLikelihoodPrompts || 0}</div>
              <div className="text-sm text-purple-800">High Priority</div>
            </div>
          </div>
          
          {data.promptSuggestions && data.promptSuggestions.length > 0 && (
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Top Prompt Suggestions:</h4>
              {data.promptSuggestions.slice(0, 8).map((prompt: any, index: number) => (
                <div key={index} className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{prompt.category || `Prompt ${index + 1}`}</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {prompt.likelihood || 'Medium'}% likely
                      </span>
                      {prompt.priority && (
                        <span className={`text-xs px-2 py-1 rounded ${
                          prompt.priority === 'high' ? 'bg-red-100 text-red-800' :
                          prompt.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {prompt.priority}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 mt-2 font-medium">"{prompt.prompt || prompt.text || prompt}"</p>
                  {prompt.optimization && (
                    <p className="text-xs text-gray-600 mt-1">{prompt.optimization}</p>
                  )}
                  {prompt.intent && (
                    <p className="text-xs text-blue-600 mt-1">Intent: {prompt.intent}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      );

    case 'competitive':
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg text-center">
              <div className="text-xl font-bold text-blue-600">#{data.summary?.ranking || 'N/A'}</div>
              <div className="text-sm text-blue-800">Your Ranking</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg text-center">
              <div className="text-xl font-bold text-green-600">{data.summary?.primarySiteScore || 0}</div>
              <div className="text-sm text-green-800">Your Score</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg text-center">
              <div className="text-xl font-bold text-purple-600">{data.summary?.averageCompetitorScore || 0}</div>
              <div className="text-sm text-purple-800">Competitor Avg</div>
            </div>
          </div>
          
          {data.competitorAnalyses && data.competitorAnalyses.length > 0 && (
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Competitor Analysis:</h4>
              {data.competitorAnalyses.map((competitor: any, index: number) => (
                <div key={index} className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{competitor.name || competitor.url || `Competitor ${index + 1}`}</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm bg-gray-200 text-gray-800 px-2 py-1 rounded">
                        {competitor.overallScore || competitor.score || 0}/100
                      </span>
                      {competitor.ranking && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          #{competitor.ranking}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {(competitor.subscores || competitor.scores) && (
                    <div className="grid grid-cols-4 gap-2 mt-2 text-xs">
                      <div>AI: {(competitor.subscores || competitor.scores)?.aiUnderstanding || (competitor.subscores || competitor.scores)?.ai_understanding || 0}</div>
                      <div>Citation: {(competitor.subscores || competitor.scores)?.citationLikelihood || (competitor.subscores || competitor.scores)?.citation_likelihood || 0}</div>
                      <div>Voice: {(competitor.subscores || competitor.scores)?.conversationalReadiness || (competitor.subscores || competitor.scores)?.conversational_readiness || 0}</div>
                      <div>Structure: {(competitor.subscores || competitor.scores)?.contentStructure || (competitor.subscores || competitor.scores)?.content_structure || 0}</div>
                    </div>
                  )}
                  
                  {competitor.strengths && competitor.strengths.length > 0 && (
                    <div className="mt-2">
                      <h5 className="text-xs font-medium text-gray-700">Strengths:</h5>
                      <p className="text-xs text-gray-600">{competitor.strengths[0]}</p>
                    </div>
                  )}
                  
                  {competitor.weaknesses && competitor.weaknesses.length > 0 && (
                    <div className="mt-1">
                      <h5 className="text-xs font-medium text-gray-700">Opportunities:</h5>
                      <p className="text-xs text-gray-600">{competitor.weaknesses[0]}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {data.insights && data.insights.length > 0 && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Key Insights:</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                {data.insights.slice(0, 5).map((insight: string, index: number) => (
                  <li key={index} className="flex items-start space-x-2">
                    <span className="text-blue-600 mr-1">•</span>
                    <span>{insight}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );

    case 'discovery':
        const currentCompetitors: Array<{ url: string; name?: string }> = userProfile?.competitors || [];
        const plan = (userProfile?.plan || 'free') as 'free' | 'core' | 'pro' | 'agency';
        const planLimitMap: Record<'free'|'core'|'pro'|'agency', number> = { free: 1, core: 3, pro: 10, agency: 25 };
        const maxCompetitors = planLimitMap[plan];
        const usedSlots = currentCompetitors.length;
        const remainingSlots = Math.max(0, maxCompetitors - usedSlots);
        const suggestions: Array<{ url: string; name?: string; reason?: string }> = (data.competitorSuggestions || []).slice(0, 10);
        const alreadyTracked = (url: string) => currentCompetitors.some(c => c.url?.replace(/\/$/, '') === (url || '').replace(/\/$/, ''));
        const toggleSelect = (url: string) => {
          setSelectedToAdd(prev => prev.includes(url) ? prev.filter(u => u !== url) : [...prev, url]);
        };
        const handleAddSelected = async () => {
          if (!userProfile?.user_id) return;
          const unique = suggestions.filter(s => selectedToAdd.includes(s.url) && !alreadyTracked(s.url));
          const toAdd = unique.slice(0, remainingSlots).map(s => ({ url: s.url, name: (s.name || new URL(s.url).hostname) }));
          if (toAdd.length === 0) return;
          const updated = [...currentCompetitors, ...toAdd];
          try {
            await userDataService.updateUserProfile(userProfile.user_id, { competitors: updated });
          } catch (e) {
            console.warn('Failed to add competitors:', e);
          }
          setSelectedToAdd([]);
        };
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg text-center">
                        <div className="text-xl font-bold text-blue-600">{data.totalSuggestions || 0}</div>
                        <div className="text-sm text-blue-800">Competitors Found</div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg text-center">
                        <div className="text-xl font-bold text-green-600">{data.averageRelevance || 0}%</div>
                        <div className="text-sm text-green-800">Avg Relevance</div>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg text-center">
                        <div className="text-xl font-bold text-purple-600">{data.competitiveIntensity || 'Medium'}</div>
                        <div className="text-sm text-purple-800">Market Intensity</div>
                    </div>
                </div>

                {suggestions && suggestions.length > 0 && (
                    <div className="space-y-4">
                        <h4 className="font-medium text-gray-900">New Competitors Discovered:</h4>
                        <div className="text-xs text-gray-600">Tracked: {usedSlots}/{maxCompetitors} • Available slots: {remainingSlots}</div>
                        {suggestions.map((competitor: any, index: number) => (
                            <div key={index} className="bg-gray-50 p-4 rounded-lg">
                                <div className="flex items-center justify-between">
                                    <span className="font-medium text-gray-900">{competitor.name || new URL(competitor.url).hostname}</span>
                                    {competitor.url && (
                                        <a
                                            href={competitor.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-blue-600 hover:text-blue-700 flex items-center space-x-1"
                                        >
                                            <span>Visit</span>
                                            <ExternalLink className="w-3 h-3" />
                                        </a>
                                    )}
                                </div>
                                <p className="text-sm text-gray-600 mt-1">{competitor.reason || 'Similar content and entity profile detected.'}</p>
                                <div className="mt-2 flex items-center justify-between">
                                  <label className="flex items-center space-x-2 text-xs text-gray-700">
                                    <input
                                      type="checkbox"
                                      disabled={alreadyTracked(competitor.url) || remainingSlots === 0}
                                      checked={selectedToAdd.includes(competitor.url) || alreadyTracked(competitor.url)}
                                      onChange={() => toggleSelect(competitor.url)}
                                    />
                                    <span>{alreadyTracked(competitor.url) ? 'Already tracked' : 'Select to add'}</span>
                                  </label>
                                  <div className="flex items-center space-x-2">
                                    {!alreadyTracked(competitor.url) && (
                                      <button
                                        disabled={remainingSlots === 0}
                                        onClick={async () => {
                                          if (!userProfile?.user_id || remainingSlots === 0) return;
                                          try {
                                            const updated = [...currentCompetitors, { url: competitor.url, name: competitor.name || new URL(competitor.url).hostname }];
                                            await userDataService.updateUserProfile(userProfile.user_id, { competitors: updated });
                                          } catch (e) { console.warn('Failed to add competitor:', e); }
                                        }}
                                        className={`text-xs px-2 py-1 rounded border ${remainingSlots === 0 ? 'border-gray-200 text-gray-400' : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`}
                                      >Add</button>
                                    )}
                                    <button
                                      onClick={async ()=>{
                                        if (!userProfile?.user_id) return;
                                        try {
                                          const domain = new URL(competitor.url).hostname.replace('www.','');
                                          const current = Array.isArray(userProfile.competitor_blocklist) ? userProfile.competitor_blocklist : [];
                                          if (!current.includes(domain)) {
                                            await userDataService.updateUserProfile(userProfile.user_id, { competitor_blocklist: [...current, domain] });
                                          }
                                        } catch(e){ console.warn('Failed to hide domain:', e); }
                                      }}
                                      className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
                                    >Hide</button>
                                  </div>
                                </div>
                            </div>
                        ))}
                        <div className="flex items-center justify-between">
                          <button
                              onClick={handleAddSelected}
                              disabled={selectedToAdd.length === 0 || remainingSlots === 0}
                              className={`px-4 py-2 rounded font-medium ${selectedToAdd.length === 0 || remainingSlots === 0 ? 'bg-gray-200 text-gray-500' : 'bg-gray-900 text-white hover:bg-black'}`}
                          >
                              Add Selected Competitors
                          </button>
                          <button
                              onClick={() => onSwitchTool('competitive', {})}
                              className="px-4 py-2 rounded font-medium bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:shadow-lg inline-flex items-center space-x-2"
                          >
                              <BarChart3 className="w-5 h-5" />
                              <span>Open Competitor Analysis</span>
                          </button>
                        </div>
                    </div>
                )}
            </div>
        );

    default:
      return (
        <div className="p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">Raw Results:</h4>
          <pre className="text-sm text-gray-700 overflow-x-auto whitespace-pre-wrap max-h-96">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      );
  }
};

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
      {isExpanded && issue.learnMore && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <h6 className="font-semibold text-gray-700">Why it matters</h6>
          <p className="text-sm text-gray-600 mt-1">{issue.learnMore}</p>
        </div>
      )}
    </div>
  );
};

export default ToolsGrid;
