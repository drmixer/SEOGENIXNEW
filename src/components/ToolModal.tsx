import React, { useState } from 'react';
import { X, Loader, Copy, Download, ExternalLink, CheckCircle, AlertCircle, Target, FileText, Search, Mic, Globe, Users, Zap, TrendingUp, Lightbulb, BarChart3, Radar } from 'lucide-react';

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
      // Simulate API call with a delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Generate mock results based on tool type
      let mockResult: any = {};
      
      switch (toolId) {
        case 'audit':
          mockResult = {
            overallScore: Math.floor(Math.random() * 30) + 60,
            subscores: {
              aiUnderstanding: Math.floor(Math.random() * 30) + 60,
              citationLikelihood: Math.floor(Math.random() * 30) + 60,
              conversationalReadiness: Math.floor(Math.random() * 30) + 60,
              contentStructure: Math.floor(Math.random() * 30) + 60
            },
            recommendations: [
              'Add more structured data markup to improve AI comprehension',
              'Create FAQ sections to better answer common questions',
              'Improve heading structure for better content organization',
              'Add more entity definitions for key concepts',
              'Optimize for voice search with conversational content'
            ],
            issues: [
              'Limited structured data implementation',
              'Inconsistent heading hierarchy',
              'Missing conversational content elements',
              'Insufficient context for AI understanding'
            ]
          };
          break;

        case 'schema':
          mockResult = {
            schema: `{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Understanding AI Visibility",
  "author": {
    "@type": "Person",
    "name": "SEOGENIX Team"
  },
  "publisher": {
    "@type": "Organization",
    "name": "SEOGENIX",
    "logo": {
      "@type": "ImageObject",
      "url": "https://example.com/logo.png"
    }
  },
  "datePublished": "2025-01-15T08:00:00+08:00",
  "dateModified": "2025-01-20T09:30:00+08:00",
  "description": "Learn how AI visibility impacts your content's performance in modern search.",
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "${selectedWebsite || 'https://example.com'}"
  }
}`,
            instructions: 'Add this JSON-LD script tag to your page head section to improve AI understanding',
            implementation: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Understanding AI Visibility",
  "author": {
    "@type": "Person",
    "name": "SEOGENIX Team"
  },
  "publisher": {
    "@type": "Organization",
    "name": "SEOGENIX",
    "logo": {
      "@type": "ImageObject",
      "url": "https://example.com/logo.png"
    }
  },
  "datePublished": "2025-01-15T08:00:00+08:00",
  "dateModified": "2025-01-20T09:30:00+08:00",
  "description": "Learn how AI visibility impacts your content's performance in modern search.",
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "${selectedWebsite || 'https://example.com'}"
  }
}
</script>`
          };
          break;

        case 'citations':
          mockResult = {
            total: Math.floor(Math.random() * 20) + 5,
            confidenceBreakdown: {
              high: Math.floor(Math.random() * 10) + 2,
              medium: Math.floor(Math.random() * 10) + 2,
              low: Math.floor(Math.random() * 5)
            },
            sources: {
              llm: Math.floor(Math.random() * 10) + 2,
              google: Math.floor(Math.random() * 5) + 1,
              reddit: Math.floor(Math.random() * 3),
              news: Math.floor(Math.random() * 2)
            },
            citations: [
              {
                source: 'ChatGPT',
                url: 'https://chat.openai.com',
                snippet: `According to ${selectedWebsite || 'example.com'}, AI visibility refers to how well AI systems can understand, process, and cite your content...`,
                date: new Date().toISOString(),
                type: 'llm',
                confidence_score: 95
              },
              {
                source: 'Google Search',
                url: 'https://google.com/search?q=ai+visibility',
                snippet: `${selectedWebsite || 'Example.com'} provides a comprehensive guide to optimizing content for AI systems...`,
                date: new Date().toISOString(),
                type: 'google',
                confidence_score: 85
              },
              {
                source: 'Reddit - r/SEO',
                url: 'https://reddit.com/r/SEO/comments/abc123',
                snippet: `I found this great resource on ${selectedWebsite || 'example.com'} about AI visibility optimization...`,
                date: new Date().toISOString(),
                type: 'reddit',
                confidence_score: 70
              }
            ]
          };
          break;

        // Add more mock results for other tools as needed
        default:
          mockResult = {
            message: `${toolName} executed successfully`,
            timestamp: new Date().toISOString()
          };
      }

      setResult(mockResult);
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
                value={selectedWebsite || ''}
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
                value={selectedWebsite || ''}
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

      // Add more result renderers for other tools
      
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
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
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