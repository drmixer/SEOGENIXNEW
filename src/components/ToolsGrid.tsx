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
  RefreshCw,
  X
} from 'lucide-react';
import { apiService } from '../services/api';
import { userDataService } from '../services/userDataService';
import { supabase } from '../lib/supabase';

interface ToolsGridProps {
  userPlan: 'free' | 'core' | 'pro' | 'agency';
  onToolRun?: () => void;
  showPreview?: boolean;
  selectedTool?: string;
  selectedWebsite?: string;
  userProfile?: any;
  onToolComplete?: (toolName: string, success: boolean, message?: string) => void;
}

interface ToolResult {
  [key: string]: any;
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
  const [toolResults, setToolResults] = useState<Record<string, ToolResult>>({});
  const [expandedTool, setExpandedTool] = useState<string | null>(selectedTool || null);
  const [showToolModal, setShowToolModal] = useState<string | null>(null);
  const [selectedCompetitor, setSelectedCompetitor] = useState<string>('');

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

  // Set initial expanded tool based on selectedTool prop
  useEffect(() => {
    if (selectedTool) {
      setExpandedTool(selectedTool);
    }
  }, [selectedTool]);

  // Set initial competitor if available
  useEffect(() => {
    if (userProfile?.competitors?.length > 0) {
      setSelectedCompetitor(userProfile.competitors[0].url);
    }
  }, [userProfile]);

  const runTool = async (toolId: string) => {
    if (!selectedWebsite && !selectedCompetitor && toolId !== 'generator' && toolId !== 'prompts') {
      alert('Please select a website first');
      return;
    }

    setLoadingTool(toolId);
    setExpandedTool(toolId);
    setShowToolModal(toolId);

    try {
      let result: any = {};
      const websiteUrl = selectedWebsite || 'https://example.com';
      const competitorUrl = selectedCompetitor || '';

      // Track tool usage
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await userDataService.trackActivity({
            user_id: user.id,
            activity_type: 'tool_used',
            tool_id: toolId,
            website_url: websiteUrl,
            activity_data: { timestamp: new Date().toISOString() }
          });
        }
      } catch (error) {
        console.error('Error tracking tool usage:', error);
      }

      switch (toolId) {
        case 'audit':
          result = await apiService.runAudit(websiteUrl);
          
          // Save audit result to history
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              await userDataService.saveAuditResult({
                user_id: user.id,
                website_url: websiteUrl,
                overall_score: result.overallScore,
                ai_understanding: result.subscores.aiUnderstanding,
                citation_likelihood: result.subscores.citationLikelihood,
                conversational_readiness: result.subscores.conversationalReadiness,
                content_structure: result.subscores.contentStructure,
                recommendations: result.recommendations,
                issues: result.issues,
                audit_data: result
              });
            }
          } catch (error) {
            console.error('Error saving audit result:', error);
          }
          break;

        case 'schema':
          result = await apiService.generateSchema(websiteUrl, 'article');
          break;

        case 'citations':
          const domain = new URL(websiteUrl).hostname;
          const keywords = userProfile?.industry ? [userProfile.industry, 'AI', 'SEO'] : ['AI', 'SEO', 'optimization'];
          result = await apiService.trackCitations(domain, keywords);
          break;

        case 'voice':
          const voiceQuery = `What is ${new URL(websiteUrl).hostname}?`;
          result = await apiService.testVoiceAssistants(voiceQuery, ['siri', 'alexa', 'google']);
          break;

        case 'summaries':
          result = await apiService.generateLLMSummary(websiteUrl, 'overview');
          break;

        case 'entities':
          result = await apiService.analyzeEntityCoverage(
            websiteUrl, 
            undefined, 
            userProfile?.industry,
            userProfile?.competitors?.map((c: any) => c.url) || []
          );
          break;

        case 'generator':
          result = await apiService.generateAIContent(
            'faq',
            userProfile?.industry || 'Technology',
            ['AI', 'SEO', 'optimization'],
            'professional',
            userProfile?.industry,
            'Business owners and marketers'
          );
          break;

        case 'optimizer':
          const sampleContent = `Welcome to our website. We provide excellent services and solutions for your business needs.`;
          result = await apiService.optimizeContent(
            sampleContent,
            ['AI', 'SEO', 'optimization'],
            'article'
          );
          break;

        case 'prompts':
          result = await apiService.generatePromptSuggestions(
            userProfile?.industry || 'Technology',
            userProfile?.industry,
            'Business professionals',
            'article',
            'informational'
          );
          break;

        case 'competitive':
          const competitors = userProfile?.competitors?.map((c: any) => c.url) || ['https://competitor1.com', 'https://competitor2.com'];
          result = await apiService.performCompetitiveAnalysis(
            websiteUrl,
            competitors,
            userProfile?.industry,
            'detailed'
          );
          break;

        case 'discovery':
          result = await apiService.discoverCompetitors(
            websiteUrl,
            userProfile?.industry,
            userProfile?.business_description,
            userProfile?.competitors?.map((c: any) => c.url) || [],
            'comprehensive'
          );
          break;

        default:
          throw new Error('Unknown tool');
      }

      setToolResults(prev => ({ ...prev, [toolId]: result }));
      onToolRun?.();
      onToolComplete?.(tools.find(t => t.id === toolId)?.name || toolId, true, 'Tool executed successfully');

    } catch (error) {
      console.error(`Error running ${toolId}:`, error);
      onToolComplete?.(tools.find(t => t.id === toolId)?.name || toolId, false, error.message);
      setToolResults(prev => ({ 
        ...prev, 
        [toolId]: { 
          error: error.message || 'Tool execution failed',
          timestamp: new Date().toISOString()
        }
      }));
    } finally {
      setLoadingTool(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const renderToolResult = (toolId: string, result: ToolResult) => {
    if (result.error) {
      return (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center space-x-2 text-red-800">
            <AlertCircle className="w-5 h-5" />
            <span className="font-medium">Error</span>
          </div>
          <p className="text-red-700 mt-2">{result.error}</p>
        </div>
      );
    }

    switch (toolId) {
      case 'audit':
        return (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-3 rounded-lg text-center">
                <div className="text-2xl font-bold text-blue-600">{result.overallScore}</div>
                <div className="text-sm text-blue-800">Overall Score</div>
              </div>
              <div className="bg-teal-50 p-3 rounded-lg text-center">
                <div className="text-xl font-bold text-teal-600">{result.subscores?.aiUnderstanding}</div>
                <div className="text-sm text-teal-800">AI Understanding</div>
              </div>
              <div className="bg-purple-50 p-3 rounded-lg text-center">
                <div className="text-xl font-bold text-purple-600">{result.subscores?.citationLikelihood}</div>
                <div className="text-sm text-purple-800">Citation Likelihood</div>
              </div>
              <div className="bg-indigo-50 p-3 rounded-lg text-center">
                <div className="text-xl font-bold text-indigo-600">{result.subscores?.conversationalReadiness}</div>
                <div className="text-sm text-indigo-800">Conversational</div>
              </div>
            </div>
            
            {result.recommendations && result.recommendations.length > 0 && (
              <div className="bg-green-50 p-4 rounded-lg">
                <h4 className="font-medium text-green-900 mb-2">Key Recommendations:</h4>
                <ul className="text-sm text-green-800 space-y-1">
                  {result.recommendations.slice(0, 3).map((rec: string, index: number) => (
                    <li key={index}>• {rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );

      case 'schema':
        return (
          <div className="mt-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-900">Generated Schema Markup</h4>
                <button
                  onClick={() => copyToClipboard(result.schema)}
                  className="text-blue-600 hover:text-blue-700 p-1 rounded"
                  title="Copy to clipboard"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <pre className="text-sm text-gray-700 bg-white p-3 rounded border overflow-x-auto max-h-60">
                {result.schema?.substring(0, 300)}...
              </pre>
              <p className="text-xs text-gray-600 mt-2">{result.instructions}</p>
            </div>
          </div>
        );

      case 'citations':
        return (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-blue-50 p-3 rounded-lg text-center">
                <div className="text-xl font-bold text-blue-600">{result.total || 0}</div>
                <div className="text-sm text-blue-800">Total Citations</div>
              </div>
              <div className="bg-green-50 p-3 rounded-lg text-center">
                <div className="text-xl font-bold text-green-600">{result.confidenceBreakdown?.high || 0}</div>
                <div className="text-sm text-green-800">High Confidence</div>
              </div>
              <div className="bg-purple-50 p-3 rounded-lg text-center">
                <div className="text-xl font-bold text-purple-600">{result.sources?.llm || 0}</div>
                <div className="text-sm text-purple-800">LLM Mentions</div>
              </div>
            </div>
            
            {result.citations && result.citations.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900">Recent Citations:</h4>
                {result.citations.slice(0, 3).map((citation: any, index: number) => (
                  <div key={index} className="bg-gray-50 p-3 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">{citation.source}</span>
                      <span className="text-sm text-gray-500">{citation.type}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{citation.snippet?.substring(0, 100)}...</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'voice':
        return (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-blue-50 p-3 rounded-lg text-center">
                <div className="text-xl font-bold text-blue-600">{result.summary?.totalMentions || 0}</div>
                <div className="text-sm text-blue-800">Mentions</div>
              </div>
              <div className="bg-green-50 p-3 rounded-lg text-center">
                <div className="text-xl font-bold text-green-600">{result.summary?.averageRanking || 0}</div>
                <div className="text-sm text-green-800">Avg Ranking</div>
              </div>
              <div className="bg-purple-50 p-3 rounded-lg text-center">
                <div className="text-xl font-bold text-purple-600">{result.summary?.averageConfidence || 0}%</div>
                <div className="text-sm text-purple-800">Confidence</div>
              </div>
            </div>
            
            {result.results && result.results.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900">Assistant Responses:</h4>
                {result.results.map((voiceResult: any, index: number) => (
                  <div key={index} className="bg-gray-50 p-3 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">{voiceResult.assistant}</span>
                      <span className={`text-sm px-2 py-1 rounded ${voiceResult.mentioned ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                        {voiceResult.mentioned ? 'Mentioned' : 'Not Mentioned'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{voiceResult.response}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'summaries':
        return (
          <div className="mt-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">AI-Optimized Summary</h4>
              <p className="text-gray-700 mb-3">{result.summary}</p>
              
              {result.entities && result.entities.length > 0 && (
                <div className="mb-3">
                  <h5 className="font-medium text-gray-800 mb-1">Key Entities:</h5>
                  <div className="flex flex-wrap gap-1">
                    {result.entities.slice(0, 5).map((entity: string, index: number) => (
                      <span key={index} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                        {entity.split(':')[0]}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {result.topics && result.topics.length > 0 && (
                <div>
                  <h5 className="font-medium text-gray-800 mb-1">Main Topics:</h5>
                  <div className="flex flex-wrap gap-1">
                    {result.topics.slice(0, 5).map((topic: string, index: number) => (
                      <span key={index} className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 'entities':
        return (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-blue-50 p-3 rounded-lg text-center">
                <div className="text-xl font-bold text-blue-600">{result.coverageScore || 0}%</div>
                <div className="text-sm text-blue-800">Coverage Score</div>
              </div>
              <div className="bg-green-50 p-3 rounded-lg text-center">
                <div className="text-xl font-bold text-green-600">{result.mentionedCount || 0}</div>
                <div className="text-sm text-green-800">Mentioned</div>
              </div>
              <div className="bg-red-50 p-3 rounded-lg text-center">
                <div className="text-xl font-bold text-red-600">{result.missingCount || 0}</div>
                <div className="text-sm text-red-800">Missing</div>
              </div>
            </div>
            
            {result.missingEntities && result.missingEntities.length > 0 && (
              <div className="bg-yellow-50 p-4 rounded-lg">
                <h4 className="font-medium text-yellow-900 mb-2">Missing Important Entities:</h4>
                <div className="space-y-2">
                  {result.missingEntities.slice(0, 5).map((entity: any, index: number) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-yellow-800">{entity.name}</span>
                      <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-1 rounded">
                        {entity.type} - {entity.importance}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case 'generator':
        return (
          <div className="mt-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-900">Generated Content</h4>
                <button
                  onClick={() => copyToClipboard(JSON.stringify(result.generatedContent, null, 2))}
                  className="text-blue-600 hover:text-blue-700 p-1 rounded"
                  title="Copy to clipboard"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              
              {result.generatedContent?.faqs && (
                <div className="space-y-2">
                  <h5 className="font-medium text-gray-800">Generated FAQs:</h5>
                  {result.generatedContent.faqs.slice(0, 3).map((faq: any, index: number) => (
                    <div key={index} className="bg-white p-3 rounded border">
                      <div className="font-medium text-gray-900">{faq.question}</div>
                      <div className="text-gray-700 text-sm mt-1">{faq.answer}</div>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="mt-3 text-xs text-gray-600">
                Word count: {result.wordCount} | Generated: {new Date(result.generatedAt).toLocaleString()}
              </div>
            </div>
          </div>
        );

      case 'optimizer':
        return (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-red-50 p-3 rounded-lg text-center">
                <div className="text-xl font-bold text-red-600">{result.originalScore || 0}</div>
                <div className="text-sm text-red-800">Original Score</div>
              </div>
              <div className="bg-green-50 p-3 rounded-lg text-center">
                <div className="text-xl font-bold text-green-600">{result.optimizedScore || 0}</div>
                <div className="text-sm text-green-800">Optimized Score</div>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg text-center">
                <div className="text-xl font-bold text-blue-600">+{result.improvement || 0}</div>
                <div className="text-sm text-blue-800">Improvement</div>
              </div>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Optimized Content:</h4>
              <div className="bg-white p-3 rounded border text-sm text-gray-700">
                {result.optimizedContent?.substring(0, 200)}...
              </div>
            </div>
            
            {result.improvements && result.improvements.length > 0 && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Improvements Made:</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  {result.improvements.slice(0, 3).map((improvement: string, index: number) => (
                    <li key={index}>• {improvement}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );

      case 'prompts':
        return (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-blue-50 p-3 rounded-lg text-center">
                <div className="text-xl font-bold text-blue-600">{result.totalPrompts || 0}</div>
                <div className="text-sm text-blue-800">Total Prompts</div>
              </div>
              <div className="bg-green-50 p-3 rounded-lg text-center">
                <div className="text-xl font-bold text-green-600">{result.averageLikelihood || 0}%</div>
                <div className="text-sm text-green-800">Avg Likelihood</div>
              </div>
              <div className="bg-purple-50 p-3 rounded-lg text-center">
                <div className="text-xl font-bold text-purple-600">{result.statistics?.highLikelihoodPrompts || 0}</div>
                <div className="text-sm text-purple-800">High Priority</div>
              </div>
            </div>
            
            {result.promptSuggestions && result.promptSuggestions.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900">Top Prompt Suggestions:</h4>
                {result.promptSuggestions.slice(0, 5).map((prompt: any, index: number) => (
                  <div key={index} className="bg-gray-50 p-3 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">{prompt.category}</span>
                      <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {prompt.likelihood}% likely
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mt-1">"{prompt.prompt}"</p>
                    <p className="text-xs text-gray-600 mt-1">{prompt.optimization}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'competitive':
        return (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-blue-50 p-3 rounded-lg text-center">
                <div className="text-xl font-bold text-blue-600">#{result.summary?.ranking || 'N/A'}</div>
                <div className="text-sm text-blue-800">Your Ranking</div>
              </div>
              <div className="bg-green-50 p-3 rounded-lg text-center">
                <div className="text-xl font-bold text-green-600">{result.summary?.primarySiteScore || 0}</div>
                <div className="text-sm text-green-800">Your Score</div>
              </div>
              <div className="bg-purple-50 p-3 rounded-lg text-center">
                <div className="text-xl font-bold text-purple-600">{result.summary?.averageCompetitorScore || 0}</div>
                <div className="text-sm text-purple-800">Competitor Avg</div>
              </div>
            </div>
            
            {result.competitorAnalyses && result.competitorAnalyses.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900">Competitor Analysis:</h4>
                {result.competitorAnalyses.slice(0, 3).map((competitor: any, index: number) => (
                  <div key={index} className="bg-gray-50 p-3 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">{competitor.name}</span>
                      <span className="text-sm bg-gray-200 text-gray-800 px-2 py-1 rounded">
                        {competitor.overallScore}/100
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 mt-2 text-xs">
                      <div>AI: {competitor.subscores?.aiUnderstanding}</div>
                      <div>Citation: {competitor.subscores?.citationLikelihood}</div>
                      <div>Voice: {competitor.subscores?.conversationalReadiness}</div>
                      <div>Structure: {competitor.subscores?.contentStructure}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'discovery':
        return (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-blue-50 p-3 rounded-lg text-center">
                <div className="text-xl font-bold text-blue-600">{result.totalSuggestions || 0}</div>
                <div className="text-sm text-blue-800">Competitors Found</div>
              </div>
              <div className="bg-green-50 p-3 rounded-lg text-center">
                <div className="text-xl font-bold text-green-600">{result.averageRelevance || 0}%</div>
                <div className="text-sm text-green-800">Avg Relevance</div>
              </div>
              <div className="bg-purple-50 p-3 rounded-lg text-center">
                <div className="text-xl font-bold text-purple-600">{result.competitiveIntensity || 'Low'}</div>
                <div className="text-sm text-purple-800">Market Intensity</div>
              </div>
            </div>
            
            {result.competitorSuggestions && result.competitorSuggestions.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900">New Competitors Discovered:</h4>
                {result.competitorSuggestions.slice(0, 5).map((competitor: any, index: number) => (
                  <div key={index} className="bg-gray-50 p-3 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">{competitor.name}</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {competitor.type}
                        </span>
                        <span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded">
                          {competitor.relevanceScore}% relevant
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{competitor.reason}</p>
                    <a 
                      href={competitor.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-700 flex items-center space-x-1 mt-1"
                    >
                      <span>{competitor.url}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      default:
        return (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <pre className="text-sm text-gray-700 overflow-x-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        );
    }
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

  // Tool Modal Component
  const ToolModal = ({ toolId, onClose }: { toolId: string, onClose: () => void }) => {
    const tool = tools.find(t => t.id === toolId);
    const result = toolResults[toolId];
    
    if (!tool) return null;
    
    const IconComponent = tool.icon;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className={`p-3 rounded-lg bg-gradient-to-r ${tool.color}`}>
                <IconComponent className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900">{tool.name}</h3>
                <p className="text-sm text-gray-500">{tool.description}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <div className="p-6 overflow-y-auto flex-1">
            {toolId === 'competitive' && userProfile?.competitors?.length > 0 && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Website to Analyze
                </label>
                <select
                  value={selectedCompetitor}
                  onChange={(e) => setSelectedCompetitor(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Select a competitor</option>
                  {userProfile.competitors.map((comp: any, index: number) => (
                    <option key={index} value={comp.url}>
                      {comp.name} ({comp.url})
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            {result ? (
              renderToolResult(toolId, result)
            ) : (
              <div className="text-center py-8">
                <div className="text-gray-400 mb-4">
                  <Target className="w-12 h-12 mx-auto" />
                </div>
                <p className="text-gray-600 mb-4">Run the tool to see results</p>
                <button
                  onClick={() => runTool(toolId)}
                  disabled={loadingTool === toolId}
                  className="bg-gradient-to-r from-teal-500 to-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:shadow-lg transition-all duration-300 disabled:opacity-50 flex items-center justify-center space-x-2 mx-auto"
                >
                  {loadingTool === toolId ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin" />
                      <span>Running...</span>
                    </>
                  ) : (
                    <>
                      <span>Run {tool.name}</span>
                      <Target className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
          
          <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
            {result && (
              <button
                onClick={() => runTool(toolId)}
                disabled={loadingTool === toolId}
                className="bg-gradient-to-r from-teal-500 to-purple-600 text-white px-6 py-2 rounded-lg font-medium hover:shadow-lg transition-all duration-300 disabled:opacity-50 flex items-center space-x-2"
              >
                {loadingTool === toolId ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    <span>Running...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    <span>Run Again</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

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
                const isExpanded = expandedTool === tool.id;
                const result = toolResults[tool.id];
                const hasResult = result && !result.error;

                return (
                  <div 
                    key={tool.id} 
                    className={`bg-white rounded-xl shadow-sm border transition-all duration-300 ${
                      isExpanded ? 'border-purple-300 shadow-lg' : 'border-gray-100 hover:border-purple-200'
                    }`}
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
                      
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => {
                            if (tool.available) {
                              setShowToolModal(tool.id);
                            }
                          }}
                          disabled={!tool.available || isLoading}
                          className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
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
                        
                        {result && (
                          <button
                            onClick={() => setShowToolModal(tool.id)}
                            className="text-gray-600 hover:text-gray-900 p-1 rounded"
                          >
                            View Results
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      ))}

      {/* Tool Modal */}
      {showToolModal && (
        <ToolModal 
          toolId={showToolModal} 
          onClose={() => setShowToolModal(null)} 
        />
      )}
    </div>
  );
};

export default ToolsGrid;