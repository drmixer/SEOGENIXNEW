import React, { useState, useEffect } from 'react';
import { X, Loader, Copy, Download, ExternalLink, CheckCircle, AlertCircle, Target, FileText, Search, Mic, Globe, Users, Zap, TrendingUp, Lightbulb, BarChart3, Radar } from 'lucide-react';
import { apiService } from '../services/api';
import { userDataService } from '../services/userDataService';
import { supabase } from '../lib/supabase';

interface ToolModalProps {
  isOpen: boolean;
  onClose: () => void;
  toolId: string;
  toolName: string;
  selectedWebsite?: string;
  userProfile?: any;
  onComplete?: (toolName: string, success: boolean, message?: string) => void;
}

const ToolModal: React.FC<ToolModalProps> = ({
  isOpen,
  onClose,
  toolId,
  toolName,
  selectedWebsite,
  userProfile,
  onComplete
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

  if (!isOpen) return null;

  const getToolIcon = (id: string) => {
    const iconMap: Record<string, React.ComponentType<any>> = {
      audit: FileText,
      schema: Target,
      citations: Search,
      voice: Mic,
      summaries: Globe,
      entities: Users,
      generator: Zap,
      optimizer: TrendingUp,
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
      optimizer: 'from-orange-500 to-orange-600',
      prompts: 'from-cyan-500 to-cyan-600',
      competitive: 'from-red-500 to-red-600',
      discovery: 'from-violet-500 to-violet-600'
    };
    return colorMap[id] || 'from-gray-500 to-gray-600';
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
          result = await apiService.generateSchema(websiteUrl, formData.contentType || 'article');
          break;

        case 'citations':
          const domain = new URL(websiteUrl).hostname;
          const keywords = formData.keywords ? formData.keywords.split(',').map((k: string) => k.trim()) : 
                          userProfile?.industry ? [userProfile.industry, 'AI', 'SEO'] : ['AI', 'SEO', 'optimization'];
          result = await apiService.trackCitations(domain, keywords);
          break;

        case 'voice':
          const voiceQuery = formData.query || `What is ${new URL(websiteUrl).hostname}?`;
          const assistants = formData.assistants || ['siri', 'alexa', 'google'];
          result = await apiService.testVoiceAssistants(voiceQuery, assistants);
          break;

        case 'summaries':
          result = await apiService.generateLLMSummary(websiteUrl, formData.summaryType || 'overview');
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
            formData.contentType || 'faq',
            formData.topic || userProfile?.industry || 'Technology',
            formData.keywords ? formData.keywords.split(',').map((k: string) => k.trim()) : ['AI', 'SEO', 'optimization'],
            formData.tone || 'professional',
            userProfile?.industry,
            formData.audience || 'Business owners and marketers'
          );
          break;

        case 'optimizer':
          const sampleContent = formData.content || `Welcome to our website. We provide excellent services and solutions for your business needs.`;
          result = await apiService.optimizeContent(
            sampleContent,
            formData.keywords ? formData.keywords.split(',').map((k: string) => k.trim()) : ['AI', 'SEO', 'optimization'],
            formData.contentType || 'article'
          );
          break;

        case 'prompts':
          result = await apiService.generatePromptSuggestions(
            formData.topic || userProfile?.industry || 'Technology',
            userProfile?.industry,
            formData.audience || 'Business professionals',
            formData.contentType || 'article',
            formData.intent || 'informational'
          );
          break;

        case 'competitive':
          const competitors = userProfile?.competitors?.map((c: any) => c.url) || 
                             formData.competitors?.split(',').map((c: string) => c.trim()) || 
                             ['https://competitor1.com', 'https://competitor2.com'];
          result = await apiService.performCompetitiveAnalysis(
            websiteUrl,
            competitors,
            userProfile?.industry,
            formData.analysisType || 'detailed'
          );
          break;

        case 'discovery':
          result = await apiService.discoverCompetitors(
            websiteUrl,
            userProfile?.industry,
            userProfile?.business_description,
            userProfile?.competitors?.map((c: any) => c.url) || [],
            formData.analysisDepth || 'comprehensive'
          );
          break;

        default:
          throw new Error('Unknown tool');
      }

      setResult(result);
      setStep('results');
      onComplete?.(toolName, true, 'Tool executed successfully');

    } catch (error) {
      console.error(`Error running ${toolId}:`, error);
      setError(error.message || 'Tool execution failed');
      onComplete?.(toolName, false, error.message);
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Audit Type</label>
              <select
                value={formData.auditType || 'comprehensive'}
                onChange={(e) => setFormData({ ...formData, auditType: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="comprehensive">Comprehensive Audit</option>
                <option value="quick">Quick Scan</option>
                <option value="technical">Technical Focus</option>
                <option value="content">Content Focus</option>
              </select>
            </div>
          </div>
        );
      
      case 'schema':
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Content Type</label>
              <select
                value={formData.contentType || 'article'}
                onChange={(e) => setFormData({ ...formData, contentType: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="article">Article</option>
                <option value="product">Product</option>
                <option value="organization">Organization</option>
                <option value="person">Person</option>
                <option value="faq">FAQ</option>
                <option value="howto">How-To Guide</option>
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
                value={selectedWebsite ? new URL(selectedWebsite).hostname : formData.domain || ''}
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
                value={formData.keywords || userProfile?.industry || 'AI, SEO, visibility'}
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
                value={formData.query || `What is ${selectedWebsite ? new URL(selectedWebsite).hostname : 'your website'} about?`}
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
                value={formData.topic || userProfile?.industry || ''}
                onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                placeholder="AI Visibility, SEO, etc."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Keywords (comma separated)</label>
              <input
                type="text"
                value={formData.keywords || 'AI, SEO, optimization'}
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
          </div>
        );
      
      // Add more tool configurations as needed
      
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

    switch (toolId) {
      case 'audit':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-blue-600">{result.overallScore}</div>
                <div className="text-sm text-blue-800">Overall Score</div>
              </div>
              <div className="bg-teal-50 p-4 rounded-lg text-center">
                <div className="text-xl font-bold text-teal-600">{result.subscores?.aiUnderstanding}</div>
                <div className="text-sm text-teal-800">AI Understanding</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg text-center">
                <div className="text-xl font-bold text-purple-600">{result.subscores?.citationLikelihood}</div>
                <div className="text-sm text-purple-800">Citation Likelihood</div>
              </div>
              <div className="bg-indigo-50 p-4 rounded-lg text-center">
                <div className="text-xl font-bold text-indigo-600">{result.subscores?.conversationalReadiness}</div>
                <div className="text-sm text-indigo-800">Conversational</div>
              </div>
            </div>
            
            {result.recommendations && result.recommendations.length > 0 && (
              <div className="bg-green-50 p-4 rounded-lg">
                <h4 className="font-medium text-green-900 mb-2">Key Recommendations:</h4>
                <ul className="text-sm text-green-800 space-y-2">
                  {result.recommendations.map((rec: string, index: number) => (
                    <li key={index} className="flex items-start space-x-2">
                      <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.issues && result.issues.length > 0 && (
              <div className="bg-yellow-50 p-4 rounded-lg">
                <h4 className="font-medium text-yellow-900 mb-2">Issues Found:</h4>
                <ul className="text-sm text-yellow-800 space-y-2">
                  {result.issues.map((issue: string, index: number) => (
                    <li key={index} className="flex items-start space-x-2">
                      <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                      <span>{issue}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );

      case 'schema':
        return (
          <div className="space-y-4">
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
              <pre className="text-sm text-gray-700 bg-white p-4 rounded border overflow-x-auto max-h-60">
                {result.schema}
              </pre>
              <p className="text-xs text-gray-600 mt-2">{result.instructions}</p>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Implementation</h4>
              <pre className="text-sm text-blue-800 bg-white p-4 rounded border overflow-x-auto max-h-40">
                {result.implementation}
              </pre>
              <div className="flex justify-end mt-2">
                <button
                  onClick={() => copyToClipboard(result.implementation)}
                  className="text-blue-600 hover:text-blue-700 flex items-center space-x-1 text-sm"
                >
                  <Copy className="w-4 h-4" />
                  <span>Copy Code</span>
                </button>
              </div>
            </div>
          </div>
        );

      case 'citations':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg text-center">
                <div className="text-xl font-bold text-blue-600">{result.total || 0}</div>
                <div className="text-sm text-blue-800">Total Citations</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg text-center">
                <div className="text-xl font-bold text-green-600">{result.confidenceBreakdown?.high || 0}</div>
                <div className="text-sm text-green-800">High Confidence</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg text-center">
                <div className="text-xl font-bold text-purple-600">{result.sources?.llm || 0}</div>
                <div className="text-sm text-purple-800">LLM Mentions</div>
              </div>
            </div>
            
            {result.citations && result.citations.length > 0 && (
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Recent Citations:</h4>
                {result.citations.map((citation: any, index: number) => (
                  <div key={index} className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">{citation.source}</span>
                      <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {citation.type}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">{citation.snippet}</p>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-xs text-gray-500">
                        {new Date(citation.date).toLocaleDateString()}
                      </span>
                      <a 
                        href={citation.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:text-blue-700 flex items-center space-x-1"
                      >
                        <span>View Source</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
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
                <div className="text-xl font-bold text-blue-600">{result.summary?.totalMentions || 0}</div>
                <div className="text-sm text-blue-800">Mentions</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg text-center">
                <div className="text-xl font-bold text-green-600">{result.summary?.averageRanking || 0}</div>
                <div className="text-sm text-green-800">Avg Ranking</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg text-center">
                <div className="text-xl font-bold text-purple-600">{result.summary?.averageConfidence || 0}%</div>
                <div className="text-sm text-purple-800">Confidence</div>
              </div>
            </div>
            
            {result.results && result.results.length > 0 && (
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Assistant Responses:</h4>
                {result.results.map((voiceResult: any, index: number) => (
                  <div key={index} className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">{voiceResult.assistant}</span>
                      <span className={`text-sm px-2 py-1 rounded ${voiceResult.mentioned ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                        {voiceResult.mentioned ? 'Mentioned' : 'Not Mentioned'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">{voiceResult.response}</p>
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
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg text-center">
                <div className="text-xl font-bold text-blue-600">{result.coverageScore || 0}%</div>
                <div className="text-sm text-blue-800">Coverage Score</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg text-center">
                <div className="text-xl font-bold text-green-600">{result.mentionedCount || 0}</div>
                <div className="text-sm text-green-800">Mentioned</div>
              </div>
              <div className="bg-red-50 p-4 rounded-lg text-center">
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
          <div className="space-y-4">
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
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-red-50 p-4 rounded-lg text-center">
                <div className="text-xl font-bold text-red-600">{result.originalScore || 0}</div>
                <div className="text-sm text-red-800">Original Score</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg text-center">
                <div className="text-xl font-bold text-green-600">{result.optimizedScore || 0}</div>
                <div className="text-sm text-green-800">Optimized Score</div>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg text-center">
                <div className="text-xl font-bold text-blue-600">+{result.improvement || 0}</div>
                <div className="text-sm text-blue-800">Improvement</div>
              </div>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Optimized Content:</h4>
              <div className="bg-white p-3 rounded border text-sm text-gray-700 whitespace-pre-wrap max-h-60 overflow-y-auto">
                {result.optimizedContent}
              </div>
              <div className="flex justify-end mt-2">
                <button
                  onClick={() => copyToClipboard(result.optimizedContent)}
                  className="text-blue-600 hover:text-blue-700 flex items-center space-x-1 text-sm"
                >
                  <Copy className="w-4 h-4" />
                  <span>Copy Content</span>
                </button>
              </div>
            </div>
            
            {result.improvements && result.improvements.length > 0 && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Improvements Made:</h4>
                <ul className="text-sm text-blue-800 space-y-2">
                  {result.improvements.map((improvement: string, index: number) => (
                    <li key={index} className="flex items-start space-x-2">
                      <CheckCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <span>{improvement}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );

      case 'prompts':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg text-center">
                <div className="text-xl font-bold text-blue-600">{result.totalPrompts || 0}</div>
                <div className="text-sm text-blue-800">Total Prompts</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg text-center">
                <div className="text-xl font-bold text-green-600">{result.averageLikelihood || 0}%</div>
                <div className="text-sm text-green-800">Avg Likelihood</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg text-center">
                <div className="text-xl font-bold text-purple-600">{result.statistics?.highLikelihoodPrompts || 0}</div>
                <div className="text-sm text-purple-800">High Priority</div>
              </div>
            </div>
            
            {result.promptSuggestions && result.promptSuggestions.length > 0 && (
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Top Prompt Suggestions:</h4>
                {result.promptSuggestions.slice(0, 5).map((prompt: any, index: number) => (
                  <div key={index} className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">{prompt.category}</span>
                      <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {prompt.likelihood}% likely
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mt-2 font-medium">"{prompt.prompt}"</p>
                    <p className="text-xs text-gray-600 mt-1">{prompt.optimization}</p>
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
                <div className="text-xl font-bold text-blue-600">#{result.summary?.ranking || 'N/A'}</div>
                <div className="text-sm text-blue-800">Your Ranking</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg text-center">
                <div className="text-xl font-bold text-green-600">{result.summary?.primarySiteScore || 0}</div>
                <div className="text-sm text-green-800">Your Score</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg text-center">
                <div className="text-xl font-bold text-purple-600">{result.summary?.averageCompetitorScore || 0}</div>
                <div className="text-sm text-purple-800">Competitor Avg</div>
              </div>
            </div>
            
            {result.competitorAnalyses && result.competitorAnalyses.length > 0 && (
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Competitor Analysis:</h4>
                {result.competitorAnalyses.map((competitor: any, index: number) => (
                  <div key={index} className="bg-gray-50 p-4 rounded-lg">
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
                    
                    {competitor.strengths && competitor.strengths.length > 0 && (
                      <div className="mt-2">
                        <h5 className="text-xs font-medium text-gray-700">Strengths:</h5>
                        <p className="text-xs text-gray-600">{competitor.strengths[0]}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'discovery':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg text-center">
                <div className="text-xl font-bold text-blue-600">{result.totalSuggestions || 0}</div>
                <div className="text-sm text-blue-800">Competitors Found</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg text-center">
                <div className="text-xl font-bold text-green-600">{result.averageRelevance || 0}%</div>
                <div className="text-sm text-green-800">Avg Relevance</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg text-center">
                <div className="text-xl font-bold text-purple-600">{result.competitiveIntensity || 'Low'}</div>
                <div className="text-sm text-purple-800">Market Intensity</div>
              </div>
            </div>
            
            {result.competitorSuggestions && result.competitorSuggestions.length > 0 && (
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">New Competitors Discovered:</h4>
                {result.competitorSuggestions.map((competitor: any, index: number) => (
                  <div key={index} className="bg-gray-50 p-4 rounded-lg">
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
                    <p className="text-sm text-gray-600 mt-2">{competitor.reason}</p>
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
          <div className="p-4 bg-gray-50 rounded-lg">
            <pre className="text-sm text-gray-700 overflow-x-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        );
    }
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
                className="bg-gradient-to-r from-teal-500 to-purple-600 text-white px-6 py-2 rounded-lg font-medium hover:shadow-lg transition-all duration-300"
              >
                Run {toolName}
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

export default ToolModal;