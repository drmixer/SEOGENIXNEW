import React, { useState, useEffect } from 'react';
import { X, Loader, Copy, Download, ExternalLink, CheckCircle, AlertCircle, Target, FileText, Search, Mic, Globe, Users, Zap, TrendingUp, Lightbulb, BarChart3, Radar, Shield } from 'lucide-react';
import { apiService } from '../services/api';
import { mapRecommendationToTool } from '../utils/fixItRouter';
import { userDataService } from '../services/userDataService';
import { supabase } from '../lib/supabase';

interface ToolModalProps {
  isOpen: boolean;
  onClose: () => void;
  toolId: string;
  toolName: string;
  selectedWebsite?: string;
  selectedProjectId?: string;
  userProfile?: any;
  onComplete?: (toolName: string, success: boolean, message?: string) => void;
  onSwitchTool?: (toolId: string, context: any) => void;
}

const ToolModal: React.FC<ToolModalProps> = ({
  isOpen,
  onClose,
  toolId,
  toolName,
  selectedWebsite,
  selectedProjectId,
  userProfile,
  onComplete,
  onSwitchTool
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'config' | 'running' | 'results'>('config');
  const [formData, setFormData] = useState<Record<string, any>>({});

  // Reset form data when tool changes
  useEffect(() => {
    setFormData({});
    setResult(null);
    setError(null);
    setStep('config');
  }, [toolId]);

  // Initialize form data with defaults
  useEffect(() => {
    if (isOpen && toolId) {
      const defaults: Record<string, any> = {};
      
      switch (toolId) {
        case 'citations':
          if (selectedWebsite) {
            try {
              const domain = new URL(selectedWebsite).hostname.replace('www.', '');
              defaults.keywords = `${domain}, AI visibility, SEO`;
            } catch (e) {
              defaults.keywords = 'AI visibility, SEO';
            }
          }
          break;
        case 'voice':
          if (selectedWebsite) {
            try {
              const domain = new URL(selectedWebsite).hostname.replace('www.', '');
              defaults.query = `What is ${domain}?`;
            } catch (e) {
              defaults.query = 'What is your website about?';
            }
          }
          defaults.assistants = ['siri', 'alexa', 'google'];
          break;
        case 'prompts':
          if (selectedWebsite) {
            try {
              const domain = new URL(selectedWebsite).hostname.replace('www.', '');
              defaults.topic = domain;
            } catch (e) {
              defaults.topic = '';
            }
          }
          break;
        case 'generator':
          defaults.keywords = 'AI, SEO, optimization';
          defaults.tone = 'professional';
          defaults.contentType = 'faq';
          break;
        case 'audit':
          defaults.auditScope = 'site';
          break;
        case 'schema':
          defaults.inputType = 'url';
          defaults.contentType = 'Article';
          break;
      }
      
      setFormData(defaults);
    }
  }, [isOpen, toolId, selectedWebsite]);

  if (!isOpen) return null;

  const getToolIcon = (id: string) => {
    const iconMap: Record<string, React.ComponentType<any>> = {
      audit: FileText,
      schema: Shield,
      citations: Search,
      voice: Mic,
      summaries: Globe,
      entities: Users,
      generator: Zap,
      editor: TrendingUp,
      prompts: Lightbulb,
      competitive: BarChart3,
      discovery: Radar
    };
    return iconMap[id] || FileText;
  };

  const getToolColor = (id: string) => {
    const colorMap: Record<string, string> = {
      audit: 'from-blue-500 to-blue-600',
      schema: 'from-green-500 to-green-600',
      citations: 'from-purple-500 to-purple-600',
      voice: 'from-indigo-500 to-indigo-600',
      summaries: 'from-teal-500 to-teal-600',
      entities: 'from-pink-500 to-pink-600',
      generator: 'from-yellow-500 to-yellow-600',
      editor: 'from-orange-500 to-orange-600',
      prompts: 'from-cyan-500 to-cyan-600',
      competitive: 'from-red-500 to-red-600',
      discovery: 'from-violet-500 to-violet-600'
    };
    return colorMap[id] || 'from-gray-500 to-gray-600';
  };

  // Map recommendations to tools (mirror ToolsGrid logic)
  const handleFixItRouting = (recommendation: any) => {
    const route = mapRecommendationToTool(recommendation, { selectedWebsite });
    if (onSwitchTool) {
      onClose();
      onSwitchTool(route.toolId, {
        source: 'fixit',
        fromRecommendation: recommendation,
        ...(route.context || {}),
      });
    }
  };

  // Normalize different result structures into consistent format (matching ToolsGrid)
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

    // Tool-specific normalization matching ToolsGrid
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
          query: result.query || formData.query || 'Unknown query'
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
          contentType: formData.contentType || 'content'
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

  const handleRunTool = async () => {
    setIsLoading(true);
    setStep('running');
    setError(null);

    try {
      let result: any = {};
      const websiteUrl = selectedWebsite || formData.url || 'https://example.com';

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
        case 'audit': {
          const auditUrl = formData.auditScope === 'page' && formData.pageUrl ? 
            `${websiteUrl}${formData.pageUrl}` : websiteUrl;
          result = await apiService.runAudit(selectedProjectId, auditUrl);
          break;
        }

        case 'schema': {
          result = await apiService.generateSchema(
            selectedProjectId,
            formData.inputType === 'url' ? websiteUrl : '',
            formData.contentType || 'article',
            formData.inputType === 'text' ? formData.content : undefined
          );
          break;
        }

        case 'citations': {
          const domain = websiteUrl.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
          const keywords = formData.keywords ? 
            formData.keywords.split(',').map((k: string) => k.trim()) : 
            [domain, 'AI visibility', 'SEO'];
          result = await apiService.trackCitations(selectedProjectId, domain, keywords);
          break;
        }

        case 'voice': {
          const voiceQuery = formData.query || `What is ${websiteUrl}?`;
          const assistants = formData.assistants || ['siri', 'alexa', 'google'];
          result = await apiService.testVoiceAssistants(voiceQuery, assistants);
          break;
        }

        case 'summaries': {
          result = await apiService.generateLLMSummary(
            selectedProjectId, 
            websiteUrl, 
            formData.summaryType || 'overview'
          );
          break;
        }

        case 'entities': {
          result = await apiService.analyzeEntityCoverage(
            selectedProjectId,
            websiteUrl, 
            undefined, 
            userProfile?.industry,
            userProfile?.competitors?.map((c: any) => c.url) || []
          );
          break;
        }

        case 'generator': {
          const generatorKeywords = formData.keywords ? 
            formData.keywords.split(',').map((k: string) => k.trim()) : 
            ['AI', 'SEO', 'optimization'];
            
          if (!formData.topic || generatorKeywords.length === 0) {
            throw new Error('Please provide a topic and at least one keyword');
          }
          
          result = await apiService.generateAIContent(
            selectedProjectId,
            formData.contentType || 'faq',
            formData.topic,
            generatorKeywords,
            formData.tone || 'professional',
            userProfile?.industry,
            formData.audience || 'Business owners and marketers'
          );
          break;
        }

        case 'prompts': {
          result = await apiService.generatePromptSuggestions(
            selectedProjectId,
            formData.topic || userProfile?.industry || 'Technology',
            userProfile?.industry,
            formData.audience || 'Business professionals',
            formData.contentType || 'article',
            formData.intent || 'informational'
          );
          break;
        }

        case 'competitive': {
          const competitors = formData.selectedCompetitors || 
                           userProfile?.competitors?.map((c: any) => c.url) || 
                           (formData.competitors ? formData.competitors.split(',').map((c: string) => c.trim()) : []);
          result = await apiService.performCompetitiveAnalysis(
            selectedProjectId,
            websiteUrl,
            competitors.slice(0, 5),
            userProfile?.industry,
            formData.analysisType || 'detailed'
          );
          break;
        }

      case 'discovery': {
          const options = {
            preferNiche: !!formData.preferNiche,
            hintKeywords: (formData.hintKeywords ? String(formData.hintKeywords).split(',').map((s: string)=>s.trim()).filter(Boolean) : undefined),
            blocklist: userProfile?.competitor_blocklist || []
          };
          result = await apiService.discoverCompetitors(
            selectedProjectId,
            websiteUrl,
            formData.industry || userProfile?.industry,
            userProfile?.business_description,
            userProfile?.competitors?.map((c: any) => c.url) || [],
            formData.analysisDepth || 'comprehensive',
            options
          );
          break;
        }

        default:
          throw new Error('Unknown tool');
      }

      // Normalize the result structure
      const normalizedResult = normalizeResult(toolId, result);
      setResult(normalizedResult);
      setStep('results');

      // Save audit result to history
      if (toolId === 'audit' && normalizedResult) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await userDataService.saveAuditResult({
              user_id: user.id,
              website_url: websiteUrl,
              overall_score: normalizedResult.overallScore,
              ai_understanding: normalizedResult.subscores.aiUnderstanding,
              citation_likelihood: normalizedResult.subscores.citationLikelihood,
              conversational_readiness: normalizedResult.subscores.conversationalReadiness,
              content_structure: normalizedResult.subscores.contentStructure,
              recommendations: normalizedResult.recommendations?.map((r: any) => r.title || r) || [],
              issues: normalizedResult.issues?.map((issue: any) => issue.title || issue) || [],
              audit_data: normalizedResult
            });
          }
        } catch (error) {
          console.error('Error saving audit result:', error);
        }
      }

      onComplete?.(toolName, true, 'Tool executed successfully');

    } catch (error) {
      console.error(`Error running ${toolId}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Tool execution failed';
      setError(errorMessage);
      onComplete?.(toolName, false, errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const renderToolConfig = () => {
    switch (toolId) {
      case 'audit':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Website URL</label>
              <input
                type="url"
                value={selectedWebsite || formData.url || ''}
                readOnly={!!selectedWebsite}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder="https://example.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Audit Scope</label>
              <select
                value={formData.auditScope || 'site'}
                onChange={(e) => setFormData({ ...formData, auditScope: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="site">Entire Site</option>
                <option value="page">Specific Page</option>
              </select>
            </div>
            {formData.auditScope === 'page' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Page Path</label>
                <input
                  type="text"
                  value={formData.pageUrl || ''}
                  onChange={(e) => setFormData({ ...formData, pageUrl: e.target.value })}
                  placeholder="e.g., /blog/my-post"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            )}
          </div>
        );
      
      case 'schema':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Input Method</label>
              <select
                value={formData.inputType || 'url'}
                onChange={(e) => setFormData({ ...formData, inputType: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="url">Analyze URL</option>
                <option value="text">Paste Content</option>
              </select>
            </div>
            {formData.inputType === 'url' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Website URL</label>
                <input
                  type="url"
                  value={selectedWebsite || formData.url || ''}
                  readOnly={!!selectedWebsite}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder="https://example.com"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            )}
            {formData.inputType === 'text' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                <textarea
                  value={formData.content || ''}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Paste your content here..."
                  rows={6}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            )}
             <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Schema Type</label>
              <select
                value={formData.contentType || 'Article'}
                onChange={(e) => setFormData({ ...formData, contentType: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="Article">Article</option>
                <option value="FAQPage">FAQ Page</option>
                <option value="HowTo">How-To Guide</option>
              </select>
            </div>
          </div>
        );
      
      case 'citations':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Domain to Track</label>
              <input
                type="text"
                value={selectedWebsite ? selectedWebsite.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] : formData.domain || ''}
                readOnly={!!selectedWebsite}
                onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                placeholder="example.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Keywords (comma separated)</label>
              <input
                type="text"
                value={formData.keywords || ''}
                onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                placeholder="AI, SEO, visibility"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="savePrompt"
                checked={formData.savePrompt || false}
                onChange={(e) => setFormData({ ...formData, savePrompt: e.target.checked })}
                className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
              />
              <label htmlFor="savePrompt" className="ml-2 block text-sm text-gray-700">
                Save this search for future tracking
              </label>
            </div>
          </div>
        );
      
      case 'voice':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Voice Query</label>
              <input
                type="text"
                value={formData.query || ''}
                onChange={(e) => setFormData({ ...formData, query: e.target.value })}
                placeholder="What is your website about?"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Voice Assistants</label>
              <div className="space-y-2">
                {['siri', 'alexa', 'google'].map(assistant => (
                  <label key={assistant} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.assistants ? formData.assistants.includes(assistant) : true}
                      onChange={(e) => {
                        const current = formData.assistants || ['siri', 'alexa', 'google'];
                        if (e.target.checked) {
                          setFormData({ ...formData, assistants: [...current.filter((a: string) => a !== assistant), assistant] });
                        } else {
                          setFormData({ ...formData, assistants: current.filter((a: string) => a !== assistant) });
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
        );

      case 'summaries':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Website URL</label>
              <input
                type="url"
                value={selectedWebsite || formData.url || ''}
                readOnly={!!selectedWebsite}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder="https://example.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Summary Type</label>
              <select
                value={formData.summaryType || 'overview'}
                onChange={(e) => setFormData({ ...formData, summaryType: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="overview">Overview</option>
                <option value="detailed">Detailed</option>
                <option value="technical">Technical</option>
                <option value="marketing">Marketing-focused</option>
              </select>
            </div>
          </div>
        );
      
      case 'competitive':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Your Website</label>
              <input
                type="url"
                value={selectedWebsite || formData.url || ''}
                readOnly={!!selectedWebsite}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder="https://example.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Competitors</label>
              {userProfile?.competitors && userProfile.competitors.length > 0 ? (
                <div className="space-y-2">
                  {userProfile.competitors.map((competitor: any, index: number) => (
                    <label key={index} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.selectedCompetitors ? formData.selectedCompetitors.includes(competitor.url) : true}
                        onChange={(e) => {
                          const current = formData.selectedCompetitors || userProfile.competitors.map((c: any) => c.url);
                          if (e.target.checked) {
                            setFormData({ ...formData, selectedCompetitors: [...current.filter((url: string) => url !== competitor.url), competitor.url] });
                          } else {
                            setFormData({ ...formData, selectedCompetitors: current.filter((url: string) => url !== competitor.url) });
                          }
                        }}
                        className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">{competitor.name} ({competitor.url})</span>
                    </label>
                  ))}
                </div>
              ) : (
                <div>
                  <input
                    type="text"
                    value={formData.competitors || ''}
                    onChange={(e) => setFormData({ ...formData, competitors: e.target.value })}
                    placeholder="https://competitor1.com, https://competitor2.com"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">Enter competitor URLs separated by commas</p>
                </div>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Analysis Type</label>
              <select
                value={formData.analysisType || 'detailed'}
                onChange={(e) => setFormData({ ...formData, analysisType: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="basic">Basic Analysis</option>
                <option value="detailed">Detailed Analysis</option>
                <option value="comprehensive">Comprehensive Analysis</option>
              </select>
            </div>
          </div>
        );
      
      case 'discovery':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Your Website</label>
              <input
                type="url"
                value={selectedWebsite || formData.url || ''}
                readOnly={!!selectedWebsite}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder="https://example.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
              <input
                type="text"
                value={formData.industry || userProfile?.industry || ''}
                onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                placeholder="Technology, Healthcare, Finance, etc."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Analysis Depth</label>
              <select
                value={formData.analysisDepth || 'comprehensive'}
                onChange={(e) => setFormData({ ...formData, analysisDepth: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="basic">Basic</option>
                <option value="comprehensive">Comprehensive</option>
              </select>
            </div>

            <div className="flex items-center space-x-3">
              <label className="flex items-center space-x-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={!!formData.preferNiche}
                  onChange={(e) => setFormData({ ...formData, preferNiche: e.target.checked })}
                  className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                />
                <span>Prefer niche competitors</span>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hint keywords (comma separated)</label>
              <input
                type="text"
                value={formData.hintKeywords || ''}
                onChange={(e) => setFormData({ ...formData, hintKeywords: e.target.value })}
                placeholder="e.g., hiring platform, developer recruiting, YC startups"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>
        );
      
      case 'generator':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Content Type</label>
              <select
                value={formData.contentType || 'faq'}
                onChange={(e) => setFormData({ ...formData, contentType: e.target.value })}
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Topic</label>
              <input
                type="text"
                value={formData.topic || ''}
                onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                placeholder="AI Visibility, SEO, etc."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Keywords (comma separated)</label>
              <input
                type="text"
                value={formData.keywords || ''}
                onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                placeholder="AI, SEO, optimization"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tone</label>
              <select
                value={formData.tone || 'professional'}
                onChange={(e) => setFormData({ ...formData, tone: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="professional">Professional</option>
                <option value="casual">Casual</option>
                <option value="technical">Technical</option>
                <option value="friendly">Friendly</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Audience</label>
              <input
                type="text"
                value={formData.audience || 'Business owners and marketers'}
                onChange={(e) => setFormData({ ...formData, audience: e.target.value })}
                placeholder="Business owners and marketers"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>
        );

      case 'prompts':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Topic</label>
              <input
                type="text"
                value={formData.topic || ''}
                onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                placeholder="e.g., your product, service, or topic area"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Content Type</label>
                <select
                  value={formData.contentType || 'article'}
                  onChange={(e) => setFormData({ ...formData, contentType: e.target.value })}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">User Intent</label>
                <select
                  value={formData.intent || 'informational'}
                  onChange={(e) => setFormData({ ...formData, intent: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="informational">Informational</option>
                  <option value="transactional">Transactional</option>
                  <option value="navigational">Navigational</option>
                  <option value="commercial">Commercial</option>
                </select>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Audience</label>
              <input
                type="text"
                value={formData.audience || 'Business professionals'}
                onChange={(e) => setFormData({ ...formData, audience: e.target.value })}
                placeholder="Business professionals"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>
        );
      
      default:
        return (
          <div className="text-center py-4">
            <p className="text-gray-600">Configure {toolName} settings</p>
          </div>
        );
    }
  };

  const renderToolResults = () => {
    if (error) {
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center space-x-2 text-red-800">
            <AlertCircle className="w-5 h-5" />
            <span className="font-medium">Error</span>
          </div>
          <p className="text-red-700 mt-2">{error}</p>
        </div>
      );
    }

    if (!result) return null;

    // Use the same ToolResultsDisplay component from ToolsGrid with working Fix It
    return (
      <ToolResultsDisplay
        toolId={toolId}
        data={result}
        onFixItClick={handleFixItRouting}
        onGenerateWithEntities={() => {}}
        onCreateContentFromCitation={() => {}}
        onSwitchTool={onSwitchTool || (() => {})}
      />
    );
  };

  const IconComponent = getToolIcon(toolId);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className={`p-3 rounded-lg bg-gradient-to-r ${getToolColor(toolId)}`}>
              <IconComponent className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900">{toolName}</h3>
              <p className="text-sm text-gray-500">
                {step === 'config' ? 'Configure settings' : 
                 step === 'running' ? 'Running...' : 
                 'Results'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 p-6 overflow-y-auto">
          {step === 'config' && renderToolConfig()}
          {step === 'running' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader className="w-12 h-12 text-purple-600 animate-spin mb-4" />
              <p className="text-gray-600">Running {toolName}...</p>
              <p className="text-sm text-gray-500 mt-2">This may take a few moments</p>
            </div>
          )}
          {step === 'results' && renderToolResults()}
        </div>

        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
          {step === 'config' && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRunTool}
                disabled={isLoading}
                className="bg-gradient-to-r from-teal-500 to-purple-600 text-white px-6 py-2 rounded-lg font-medium hover:shadow-lg transition-all duration-300 disabled:opacity-50"
              >
                {isLoading ? 'Running...' : `Run ${toolName}`}
              </button>
            </>
          )}
          {step === 'results' && (
            <>
              <button
                onClick={() => setStep('config')}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Run Again
              </button>
              <button
                onClick={onClose}
                className="bg-gradient-to-r from-teal-500 to-purple-600 text-white px-6 py-2 rounded-lg font-medium hover:shadow-lg transition-all duration-300"
              >
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Shared ToolResultsDisplay component - matches the one in ToolsGrid
const ToolResultsDisplay: React.FC<{
  toolId: string;
  data: any;
  onFixItClick: (recommendation: any) => void;
  onGenerateWithEntities: () => void;
  onCreateContentFromCitation: (citation: any) => void;
  onSwitchTool?: (toolId: string, context: any) => void;
}> = ({ toolId, data, onFixItClick, onGenerateWithEntities, onCreateContentFromCitation }) => {
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

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
                  </div>
                ))}
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
                onClick={() => copyToClipboard(data.schema)}
                className="text-blue-600 hover:text-blue-700 p-1 rounded"
                title="Copy to clipboard"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-gray-800 text-green-400 p-4 rounded-lg overflow-x-auto mb-4">
              <pre className="text-sm">{data.schema}</pre>
            </div>
            <p className="text-gray-700 mb-2">{data.instructions}</p>
            {data.implementation && (
              <button
                onClick={() => copyToClipboard(data.implementation)}
                className="text-purple-600 hover:text-purple-800 text-sm font-medium"
              >
                Copy Implementation Code
              </button>
            )}
          </div>
        </div>
      );

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

    case 'entities':
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
          
          {data.competitorSuggestions && data.competitorSuggestions.length > 0 && (
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">New Competitors Discovered:</h4>
              {data.competitorSuggestions.map((competitor: any, index: number) => (
                <div key={index} className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{competitor.name || `Competitor ${index + 1}`}</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {competitor.type || 'Direct'}
                      </span>
                      <span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded">
                        {competitor.relevanceScore || 0}% relevant
                      </span>
                      {competitor.aiVisibilityScore && (
                        <span className="text-sm bg-purple-100 text-purple-800 px-2 py-1 rounded">
                          AI: {competitor.aiVisibilityScore}/100
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">{competitor.reason || competitor.description || 'Similar business model and target audience'}</p>
                  {competitor.url && (
                    <a 
                      href={competitor.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-700 flex items-center space-x-1 mt-1"
                    >
                      <span>{competitor.url}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {competitor.keyStrengths && competitor.keyStrengths.length > 0 && (
                    <div className="mt-2">
                      <h5 className="text-xs font-medium text-gray-700">Key Strengths:</h5>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {competitor.keyStrengths.slice(0, 3).map((strength: string, i: number) => (
                          <span key={i} className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                            {strength}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
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

export default ToolModal;
