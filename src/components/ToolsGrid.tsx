import React, { useState } from 'react';
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
  Lock,
  ExternalLink,
  Loader,
  X
} from 'lucide-react';
import { apiService } from '../services/api';

interface ToolsGridProps {
  userPlan: 'free' | 'core' | 'pro' | 'agency';
  onToolRun?: () => void;
  showPreview?: boolean;
  selectedTool?: string;
}

interface ToolModalProps {
  tool: any;
  onClose: () => void;
  userPlan: string;
  onToolRun?: () => void;
}

const ToolModal: React.FC<ToolModalProps> = ({ tool, onClose, userPlan, onToolRun }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setResult(null);

    try {
      let response;
      
      switch (tool.id) {
        case 'audit':
          response = await apiService.runAudit(formData.url || 'https://example.com', formData.content);
          break;
        case 'schema':
          response = await apiService.generateSchema(formData.url || 'https://example.com', formData.contentType || 'article');
          break;
        case 'citations':
          response = await apiService.trackCitations(formData.domain || 'example.com', formData.keywords?.split(',') || ['AI', 'SEO']);
          break;
        case 'voice':
          response = await apiService.testVoiceAssistants(formData.query || 'What is AI SEO?', ['siri', 'alexa', 'google']);
          break;
        case 'optimizer':
          response = await apiService.optimizeContent(
            formData.content || 'Sample content to optimize',
            formData.keywords?.split(',') || ['AI', 'SEO'],
            formData.contentType || 'article'
          );
          break;
        case 'summaries':
          response = await apiService.generateLLMSummary(
            formData.url || 'https://example.com',
            formData.summaryType || 'overview',
            formData.content
          );
          break;
        case 'entities':
          response = await apiService.analyzeEntityCoverage(
            formData.url || 'https://example.com',
            formData.content,
            formData.industry,
            formData.competitors?.split(',').map(c => c.trim()).filter(c => c)
          );
          break;
        case 'generator':
          response = await apiService.generateAIContent(
            formData.contentType || 'faq',
            formData.topic || 'AI SEO',
            formData.keywords?.split(',') || ['AI', 'SEO'],
            formData.tone,
            formData.industry,
            formData.targetAudience,
            formData.contentLength
          );
          break;
        case 'prompts':
          response = await apiService.generatePromptSuggestions(
            formData.topic || 'AI SEO',
            formData.industry,
            formData.targetAudience,
            formData.contentType,
            formData.userIntent
          );
          break;
        case 'competitive':
          response = await apiService.performCompetitiveAnalysis(
            formData.primaryUrl || 'https://example.com',
            formData.competitorUrls?.split(',').map(url => url.trim()).filter(url => url) || ['https://competitor1.com'],
            formData.industry,
            formData.analysisType
          );
          break;
        default:
          response = { message: 'Tool functionality coming soon!' };
      }
      
      setResult(response);
      
      // Mark that user has run a tool
      if (onToolRun) {
        localStorage.setItem('seogenix_tools_run', 'true');
        onToolRun();
      }
    } catch (error) {
      console.error('Tool error:', error);
      setResult({ 
        error: `Failed to execute ${tool.name}. Please check your internet connection and try again.`,
        details: error.message 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderForm = () => {
    switch (tool.id) {
      case 'audit':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Website URL</label>
              <input
                type="url"
                value={formData.url || ''}
                onChange={(e) => setFormData({...formData, url: e.target.value})}
                placeholder="https://example.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Content (optional)</label>
              <textarea
                value={formData.content || ''}
                onChange={(e) => setFormData({...formData, content: e.target.value})}
                placeholder="Paste content to analyze..."
                rows={4}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
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
                value={formData.url || ''}
                onChange={(e) => setFormData({...formData, url: e.target.value})}
                placeholder="https://example.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Content Type</label>
              <select
                value={formData.contentType || 'article'}
                onChange={(e) => setFormData({...formData, contentType: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="article">Article</option>
                <option value="product">Product</option>
                <option value="organization">Organization</option>
                <option value="person">Person</option>
                <option value="faq">FAQ</option>
                <option value="howto">How-To</option>
              </select>
            </div>
          </div>
        );
      
      case 'citations':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Domain</label>
              <input
                type="text"
                value={formData.domain || ''}
                onChange={(e) => setFormData({...formData, domain: e.target.value})}
                placeholder="example.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Keywords (comma-separated)</label>
              <input
                type="text"
                value={formData.keywords || ''}
                onChange={(e) => setFormData({...formData, keywords: e.target.value})}
                placeholder="AI, SEO, optimization"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
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
                onChange={(e) => setFormData({...formData, query: e.target.value})}
                placeholder="What is AI SEO?"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>
        );
      
      case 'optimizer':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Content to Optimize</label>
              <textarea
                value={formData.content || ''}
                onChange={(e) => setFormData({...formData, content: e.target.value})}
                placeholder="Enter content to optimize for AI visibility..."
                rows={4}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Keywords</label>
              <input
                type="text"
                value={formData.keywords || ''}
                onChange={(e) => setFormData({...formData, keywords: e.target.value})}
                placeholder="AI, SEO, optimization"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
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
                value={formData.url || ''}
                onChange={(e) => setFormData({...formData, url: e.target.value})}
                placeholder="https://example.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Summary Type</label>
              <select
                value={formData.summaryType || 'overview'}
                onChange={(e) => setFormData({...formData, summaryType: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="overview">Overview</option>
                <option value="technical">Technical</option>
                <option value="business">Business</option>
                <option value="audience">Audience</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Content (optional)</label>
              <textarea
                value={formData.content || ''}
                onChange={(e) => setFormData({...formData, content: e.target.value})}
                placeholder="Paste content to analyze..."
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>
        );
      
      case 'entities':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Website URL</label>
              <input
                type="url"
                value={formData.url || ''}
                onChange={(e) => setFormData({...formData, url: e.target.value})}
                placeholder="https://example.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Industry (optional)</label>
              <input
                type="text"
                value={formData.industry || ''}
                onChange={(e) => setFormData({...formData, industry: e.target.value})}
                placeholder="Technology, Healthcare, Finance..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Competitors (optional)</label>
              <input
                type="text"
                value={formData.competitors || ''}
                onChange={(e) => setFormData({...formData, competitors: e.target.value})}
                placeholder="competitor1.com, competitor2.com"
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
                onChange={(e) => setFormData({...formData, contentType: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="faq">FAQ</option>
                <option value="meta-tags">Meta Tags</option>
                <option value="snippets">Featured Snippets</option>
                <option value="headings">Headings</option>
                <option value="descriptions">Descriptions</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Topic</label>
              <input
                type="text"
                value={formData.topic || ''}
                onChange={(e) => setFormData({...formData, topic: e.target.value})}
                placeholder="AI SEO, Machine Learning, etc."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Keywords</label>
              <input
                type="text"
                value={formData.keywords || ''}
                onChange={(e) => setFormData({...formData, keywords: e.target.value})}
                placeholder="AI, SEO, optimization"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tone</label>
                <select
                  value={formData.tone || 'professional'}
                  onChange={(e) => setFormData({...formData, tone: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="professional">Professional</option>
                  <option value="casual">Casual</option>
                  <option value="technical">Technical</option>
                  <option value="friendly">Friendly</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Length</label>
                <select
                  value={formData.contentLength || 'medium'}
                  onChange={(e) => setFormData({...formData, contentLength: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="short">Short</option>
                  <option value="medium">Medium</option>
                  <option value="long">Long</option>
                </select>
              </div>
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
                onChange={(e) => setFormData({...formData, topic: e.target.value})}
                placeholder="AI SEO, Machine Learning, etc."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Industry (optional)</label>
              <input
                type="text"
                value={formData.industry || ''}
                onChange={(e) => setFormData({...formData, industry: e.target.value})}
                placeholder="Technology, Healthcare, Finance..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Content Type</label>
                <select
                  value={formData.contentType || 'article'}
                  onChange={(e) => setFormData({...formData, contentType: e.target.value})}
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
                  value={formData.userIntent || 'informational'}
                  onChange={(e) => setFormData({...formData, userIntent: e.target.value})}
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
        );
      
      case 'competitive':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Your Website URL</label>
              <input
                type="url"
                value={formData.primaryUrl || ''}
                onChange={(e) => setFormData({...formData, primaryUrl: e.target.value})}
                placeholder="https://yoursite.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Competitor URLs</label>
              <textarea
                value={formData.competitorUrls || ''}
                onChange={(e) => setFormData({...formData, competitorUrls: e.target.value})}
                placeholder="https://competitor1.com, https://competitor2.com"
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Industry (optional)</label>
                <input
                  type="text"
                  value={formData.industry || ''}
                  onChange={(e) => setFormData({...formData, industry: e.target.value})}
                  placeholder="Technology, Healthcare..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Analysis Type</label>
                <select
                  value={formData.analysisType || 'basic'}
                  onChange={(e) => setFormData({...formData, analysisType: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="basic">Basic</option>
                  <option value="detailed">Detailed</option>
                  <option value="comprehensive">Comprehensive</option>
                </select>
              </div>
            </div>
          </div>
        );
      
      default:
        return (
          <div className="text-center py-8">
            <p className="text-gray-600">This tool is coming soon!</p>
          </div>
        );
    }
  };

  const renderResult = () => {
    if (!result) return null;

    if (result.error) {
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{result.error}</p>
        </div>
      );
    }

    switch (tool.id) {
      case 'audit':
        return (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="font-medium text-green-900 mb-2">Audit Results</h4>
              <p className="text-green-800">Overall Score: <strong>{result.overallScore}/100</strong></p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div>AI Understanding: {result.subscores.aiUnderstanding}</div>
                <div>Citation Likelihood: {result.subscores.citationLikelihood}</div>
                <div>Conversational: {result.subscores.conversationalReadiness}</div>
                <div>Structure: {result.subscores.contentStructure}</div>
              </div>
            </div>
            <div>
              <h5 className="font-medium text-gray-900 mb-2">Recommendations:</h5>
              <ul className="text-sm text-gray-600 space-y-1">
                {result.recommendations.map((rec: string, i: number) => (
                  <li key={i}>• {rec}</li>
                ))}
              </ul>
            </div>
          </div>
        );
      
      case 'schema':
        return (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">Generated Schema</h4>
              <p className="text-blue-800 text-sm mb-3">{result.instructions}</p>
              <pre className="bg-white p-3 rounded border text-xs overflow-x-auto">
                {result.implementation}
              </pre>
            </div>
          </div>
        );
      
      case 'citations':
        return (
          <div className="space-y-4">
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h4 className="font-medium text-purple-900 mb-2">Citation Results</h4>
              <p className="text-purple-800">Found {result.total} mentions across platforms</p>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {result.citations.slice(0, 5).map((citation: any, i: number) => (
                <div key={i} className="border border-gray-200 rounded p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{citation.source}</span>
                    <span className="text-xs text-gray-500">{citation.type}</span>
                  </div>
                  <p className="text-sm text-gray-600">{citation.snippet}</p>
                  <a href={citation.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center mt-1">
                    View source <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        );
      
      case 'voice':
        return (
          <div className="space-y-4">
            {result.results.map((test: any, i: number) => (
              <div key={i} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="font-medium">{test.assistant}</h5>
                  <span className={`text-sm px-2 py-1 rounded ${test.mentioned ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {test.mentioned ? 'Mentioned' : 'Not Mentioned'}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-2">{test.response}</p>
                {test.mentioned && (
                  <p className="text-xs text-gray-500">Ranking: #{test.ranking} | Confidence: {test.confidence}%</p>
                )}
              </div>
            ))}
          </div>
        );
      
      case 'optimizer':
        return (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="font-medium text-green-900 mb-2">Optimization Results</h4>
              <p className="text-green-800">Score improved from {result.originalScore} to {result.optimizedScore} (+{result.improvement} points)</p>
            </div>
            <div>
              <h5 className="font-medium text-gray-900 mb-2">Optimized Content:</h5>
              <div className="bg-gray-50 p-3 rounded border text-sm max-h-40 overflow-y-auto">
                {result.optimizedContent}
              </div>
            </div>
          </div>
        );
      
      case 'summaries':
        return (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">LLM Summary ({result.summaryType})</h4>
              <p className="text-blue-800 text-sm">{result.summary}</p>
              <p className="text-xs text-blue-600 mt-2">Word count: {result.wordCount}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h5 className="font-medium text-gray-900 mb-2">Key Entities:</h5>
                <ul className="text-sm text-gray-600 space-y-1">
                  {result.entities.slice(0, 5).map((entity: string, i: number) => (
                    <li key={i}>• {entity}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h5 className="font-medium text-gray-900 mb-2">Main Topics:</h5>
                <ul className="text-sm text-gray-600 space-y-1">
                  {result.topics.slice(0, 5).map((topic: string, i: number) => (
                    <li key={i}>• {topic}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        );
      
      case 'entities':
        return (
          <div className="space-y-4">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <h4 className="font-medium text-orange-900 mb-2">Entity Coverage Analysis</h4>
              <p className="text-orange-800">Coverage Score: {result.coverageScore}% ({result.mentionedCount}/{result.totalEntities} entities)</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h5 className="font-medium text-gray-900 mb-2">Missing Entities:</h5>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {result.missingEntities.slice(0, 5).map((entity: any, i: number) => (
                    <div key={i} className="text-sm border-l-2 border-red-300 pl-2">
                      <span className="font-medium">{entity.name}</span> ({entity.type})
                      <p className="text-gray-600 text-xs">{entity.description}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h5 className="font-medium text-gray-900 mb-2">Recommendations:</h5>
                <ul className="text-sm text-gray-600 space-y-1">
                  {result.recommendations.slice(0, 3).map((rec: string, i: number) => (
                    <li key={i}>• {rec}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        );
      
      case 'generator':
        return (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="font-medium text-green-900 mb-2">Generated {result.contentType} Content</h4>
              <p className="text-green-800 text-sm">Word count: {result.wordCount}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded border max-h-60 overflow-y-auto">
              {result.generatedContent.faqs ? (
                <div className="space-y-3">
                  {result.generatedContent.faqs.map((faq: any, i: number) => (
                    <div key={i} className="border-b border-gray-200 pb-2">
                      <p className="font-medium text-sm">{faq.question}</p>
                      <p className="text-sm text-gray-600 mt-1">{faq.answer}</p>
                    </div>
                  ))}
                </div>
              ) : result.generatedContent.metaTags ? (
                <div className="space-y-2 text-sm">
                  <div><strong>Title:</strong> {result.generatedContent.metaTags.title}</div>
                  <div><strong>Description:</strong> {result.generatedContent.metaTags.description}</div>
                  <div><strong>Keywords:</strong> {result.generatedContent.metaTags.keywords}</div>
                </div>
              ) : (
                <pre className="text-sm whitespace-pre-wrap">{result.generatedContent.raw}</pre>
              )}
            </div>
          </div>
        );
      
      case 'prompts':
        return (
          <div className="space-y-4">
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h4 className="font-medium text-purple-900 mb-2">Prompt Suggestions</h4>
              <p className="text-purple-800">Generated {result.totalPrompts} prompts with {result.averageLikelihood}% average likelihood</p>
            </div>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {result.promptSuggestions.slice(0, 8).map((prompt: any, i: number) => (
                <div key={i} className="border border-gray-200 rounded p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs bg-gray-100 px-2 py-1 rounded">{prompt.category}</span>
                    <span className="text-xs text-gray-500">{prompt.likelihood}% likely</span>
                  </div>
                  <p className="text-sm font-medium">{prompt.prompt}</p>
                  <p className="text-xs text-gray-600 mt-1">{prompt.optimization}</p>
                </div>
              ))}
            </div>
          </div>
        );
      
      case 'competitive':
        return (
          <div className="space-y-4">
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
              <h4 className="font-medium text-indigo-900 mb-2">Competitive Analysis</h4>
              <p className="text-indigo-800">Your ranking: #{result.summary.ranking} | Your score: {result.summary.primarySiteScore}</p>
              <p className="text-indigo-800 text-sm">Position: {result.summary.competitivePosition}</p>
            </div>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {result.competitorAnalyses.slice(0, 3).map((comp: any, i: number) => (
                <div key={i} className="border border-gray-200 rounded p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{comp.name}</span>
                    <span className="text-sm font-bold">{comp.overallScore}/100</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>AI Understanding: {comp.subscores.aiUnderstanding}</div>
                    <div>Citation: {comp.subscores.citationLikelihood}</div>
                    <div>Conversational: {comp.subscores.conversationalReadiness}</div>
                    <div>Structure: {comp.subscores.contentStructure}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      
      default:
        return (
          <div className="bg-gray-50 p-4 rounded">
            <pre className="text-sm">{JSON.stringify(result, null, 2)}</pre>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-xl font-semibold text-gray-900">{tool.name}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <p className="text-gray-600 mb-6">{tool.description}</p>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {renderForm()}
            
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-teal-500 to-purple-600 text-white py-3 px-4 rounded-lg font-medium hover:shadow-lg transition-all duration-300 disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {isLoading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <span>Run {tool.name}</span>
              )}
            </button>
          </form>
          
          {result && (
            <div className="mt-6">
              <h4 className="font-medium text-gray-900 mb-3">Results:</h4>
              {renderResult()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ToolsGrid: React.FC<ToolsGridProps> = ({ userPlan, onToolRun, showPreview = false, selectedTool: selectedToolProp }) => {
  const [selectedTool, setSelectedTool] = useState<any>(null);

  // Auto-open tool if selectedTool prop is provided
  React.useEffect(() => {
    if (selectedToolProp && !showPreview) {
      const tool = tools.find(t => t.id === selectedToolProp);
      if (tool && tool.available) {
        setSelectedTool(tool);
      }
    }
  }, [selectedToolProp, showPreview]);

  // Enable all tools for development/testing
  const isDevelopment = true; // Set to false for production

  const tools = [
    {
      id: 'audit',
      name: 'AI Visibility Audit',
      description: 'Full report analyzing content structure for AI visibility',
      icon: FileText,
      available: true, // Always available
      color: 'from-blue-500 to-blue-600'
    },
    {
      id: 'schema',
      name: 'Schema Generator', 
      description: 'Generate Schema.org markup for better AI comprehension',
      icon: Shield,
      available: isDevelopment || userPlan !== 'free',
      color: 'from-green-500 to-green-600'
    },
    {
      id: 'citations',
      name: 'Citation Tracker',
      description: 'Monitor mentions from LLMs, Google, and other platforms',
      icon: Search,
      available: isDevelopment || userPlan !== 'free',
      color: 'from-purple-500 to-purple-600'
    },
    {
      id: 'voice',
      name: 'Voice Assistant Tester',
      description: 'Simulate queries via Siri, Alexa, and Google Assistant',
      icon: Mic,
      available: isDevelopment || userPlan !== 'free',
      color: 'from-indigo-500 to-indigo-600'
    },
    {
      id: 'summaries',
      name: 'LLM Site Summaries',
      description: 'Generate summaries for language model understanding',
      icon: Globe,
      available: isDevelopment || userPlan !== 'free',
      color: 'from-teal-500 to-teal-600'
    },
    {
      id: 'optimizer',
      name: 'AI Content Optimizer',
      description: 'Score and rewrite content for maximum AI visibility',
      icon: TrendingUp,
      available: isDevelopment || userPlan !== 'free',
      color: 'from-orange-500 to-orange-600'
    },
    {
      id: 'entities',
      name: 'Entity Coverage Analyzer',
      description: 'Identify missing people, places, and topics',
      icon: Users,
      available: isDevelopment || ['pro', 'agency'].includes(userPlan),
      color: 'from-pink-500 to-pink-600'
    },
    {
      id: 'generator',
      name: 'AI Content Generator',
      description: 'Create optimized FAQs, snippets, and meta tags',
      icon: Zap,
      available: isDevelopment || ['pro', 'agency'].includes(userPlan),
      color: 'from-yellow-500 to-yellow-600'
    },
    {
      id: 'prompts',
      name: 'Prompt Match Suggestions',
      description: 'Generate prompts aligned with user AI queries',
      icon: Lightbulb,
      available: isDevelopment || ['pro', 'agency'].includes(userPlan),
      color: 'from-cyan-500 to-cyan-600'
    },
    {
      id: 'competitive',
      name: 'Competitive Analysis',
      description: 'Compare visibility scores against competitors',
      icon: BarChart3,
      available: isDevelopment || ['pro', 'agency'].includes(userPlan),
      color: 'from-red-500 to-red-600'
    }
  ];

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">AI Optimization Tools</h2>
          <p className="text-gray-600">
            {showPreview ? 'Preview of available tools - run your first audit to unlock full dashboard' : 'Click any available tool to get started'}
          </p>
        </div>
        
        {isDevelopment && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800 text-sm">
              <strong>Development Mode:</strong> All tools are enabled for testing with real API data.
            </p>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(showPreview ? tools.slice(0, 6) : tools).map((tool, index) => {
            const IconComponent = tool.icon;
            
            return (
              <div 
                key={index}
                data-walkthrough={tool.id === 'audit' ? 'audit-tool' : undefined}
                className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden transition-all duration-300 ${
                  tool.available && !showPreview
                    ? 'hover:shadow-lg hover:border-purple-200 cursor-pointer' 
                    : 'opacity-60'
                }`}
                onClick={() => tool.available && !showPreview && setSelectedTool(tool)}
              >
                <div className={`h-2 bg-gradient-to-r ${tool.color}`}></div>
                
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-lg bg-gradient-to-r ${tool.color}`}>
                      <IconComponent className="w-6 h-6 text-white" />
                    </div>
                    {!tool.available && !isDevelopment && (
                      <div className="bg-gray-100 p-1 rounded-full">
                        <Lock className="w-4 h-4 text-gray-400" />
                      </div>
                    )}
                  </div>
                  
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{tool.name}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed mb-4">{tool.description}</p>
                  
                  {tool.available && !showPreview ? (
                    <button className="w-full bg-gray-50 hover:bg-gray-100 text-gray-700 py-2 px-4 rounded-lg text-sm font-medium transition-colors">
                      {tool.id === 'audit' ? 'Run Audit' : 'Launch Tool'}
                    </button>
                  ) : showPreview ? (
                    <div className="text-center">
                      <p className="text-xs text-gray-500 mb-2">Available after first audit</p>
                      <div className="bg-gray-100 text-gray-500 py-2 px-4 rounded-lg text-xs">
                        Preview Mode
                      </div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-xs text-gray-500 mb-2">
                        Available with {userPlan === 'free' ? 'Core' : 'Pro'} plan
                      </p>
                      <button className="bg-gradient-to-r from-teal-500 to-purple-600 text-white py-2 px-4 rounded-lg text-xs hover:shadow-lg transition-all duration-300">
                        Upgrade Plan
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        {showPreview && (
          <div className="text-center mt-8">
            <p className="text-gray-500 text-sm">
              And {tools.length - 6} more tools available after running your first audit...
            </p>
          </div>
        )}
      </div>

      {selectedTool && (
        <ToolModal
          tool={selectedTool}
          onClose={() => setSelectedTool(null)}
          userPlan={userPlan}
          onToolRun={onToolRun}
        />
      )}
    </>
  );
};

export default ToolsGrid;