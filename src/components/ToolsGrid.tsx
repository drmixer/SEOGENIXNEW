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
  Loader
} from 'lucide-react';
import { apiService } from '../services/api';

interface ToolsGridProps {
  userPlan: 'free' | 'core' | 'pro' | 'agency';
}

interface ToolModalProps {
  tool: any;
  onClose: () => void;
  userPlan: string;
}

const ToolModal: React.FC<ToolModalProps> = ({ tool, onClose, userPlan }) => {
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
        default:
          response = { message: 'Tool functionality coming soon!' };
      }
      
      setResult(response);
    } catch (error) {
      console.error('Tool error:', error);
      setResult({ error: 'Failed to execute tool. Please try again.' });
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

const ToolsGrid: React.FC<ToolsGridProps> = ({ userPlan }) => {
  const [selectedTool, setSelectedTool] = useState<any>(null);

  const tools = [
    {
      id: 'audit',
      name: 'AI Visibility Audit',
      description: 'Full report analyzing content structure for AI visibility',
      icon: FileText,
      available: userPlan !== 'free',
      color: 'from-blue-500 to-blue-600'
    },
    {
      id: 'schema',
      name: 'Schema Generator', 
      description: 'Generate Schema.org markup for better AI comprehension',
      icon: Shield,
      available: userPlan !== 'free',
      color: 'from-green-500 to-green-600'
    },
    {
      id: 'citations',
      name: 'Citation Tracker',
      description: 'Monitor mentions from LLMs, Google, and other platforms',
      icon: Search,
      available: userPlan !== 'free',
      color: 'from-purple-500 to-purple-600'
    },
    {
      id: 'voice',
      name: 'Voice Assistant Tester',
      description: 'Simulate queries via Siri, Alexa, and Google Assistant',
      icon: Mic,
      available: userPlan !== 'free',
      color: 'from-indigo-500 to-indigo-600'
    },
    {
      id: 'summaries',
      name: 'LLM Site Summaries',
      description: 'Generate summaries for language model understanding',
      icon: Globe,
      available: userPlan !== 'free',
      color: 'from-teal-500 to-teal-600'
    },
    {
      id: 'optimizer',
      name: 'AI Content Optimizer',
      description: 'Score and rewrite content for maximum AI visibility',
      icon: TrendingUp,
      available: userPlan !== 'free',
      color: 'from-orange-500 to-orange-600'
    },
    {
      id: 'entities',
      name: 'Entity Coverage Analyzer',
      description: 'Identify missing people, places, and topics',
      icon: Users,
      available: ['pro', 'agency'].includes(userPlan),
      color: 'from-pink-500 to-pink-600'
    },
    {
      id: 'generator',
      name: 'AI Content Generator',
      description: 'Create optimized FAQs, snippets, and meta tags',
      icon: Zap,
      available: ['pro', 'agency'].includes(userPlan),
      color: 'from-yellow-500 to-yellow-600'
    },
    {
      id: 'prompts',
      name: 'Prompt Match Suggestions',
      description: 'Generate prompts aligned with user AI queries',
      icon: Lightbulb,
      available: ['pro', 'agency'].includes(userPlan),
      color: 'from-cyan-500 to-cyan-600'
    },
    {
      id: 'competitive',
      name: 'Competitive Analysis',
      description: 'Compare visibility scores against competitors',
      icon: BarChart3,
      available: ['pro', 'agency'].includes(userPlan),
      color: 'from-red-500 to-red-600'
    }
  ];

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">AI Optimization Tools</h2>
          <p className="text-gray-600">Click any available tool to get started</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tools.map((tool, index) => {
            const IconComponent = tool.icon;
            
            return (
              <div 
                key={index}
                className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden transition-all duration-300 ${
                  tool.available 
                    ? 'hover:shadow-lg hover:border-purple-200 cursor-pointer' 
                    : 'opacity-60'
                }`}
                onClick={() => tool.available && setSelectedTool(tool)}
              >
                <div className={`h-2 bg-gradient-to-r ${tool.color}`}></div>
                
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-lg bg-gradient-to-r ${tool.color}`}>
                      <IconComponent className="w-6 h-6 text-white" />
                    </div>
                    {!tool.available && (
                      <div className="bg-gray-100 p-1 rounded-full">
                        <Lock className="w-4 h-4 text-gray-400" />
                      </div>
                    )}
                  </div>
                  
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{tool.name}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed mb-4">{tool.description}</p>
                  
                  {tool.available ? (
                    <button className="w-full bg-gray-50 hover:bg-gray-100 text-gray-700 py-2 px-4 rounded-lg text-sm font-medium transition-colors">
                      Launch Tool
                    </button>
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
      </div>

      {selectedTool && (
        <ToolModal
          tool={selectedTool}
          onClose={() => setSelectedTool(null)}
          userPlan={userPlan}
        />
      )}
    </>
  );
};

export default ToolsGrid;