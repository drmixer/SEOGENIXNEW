import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Zap, Target, Brain, MessageSquare, Save, Copy, RefreshCw } from 'lucide-react';
import { apiService } from '../services/api';
import { userDataService } from '../services/userDataService';
import { supabase } from '../lib/supabase';

interface ContentEditorProps {
  userPlan: 'free' | 'core' | 'pro' | 'agency';
}

interface ContentAnalysis {
  overallScore: number;
  subscores: {
    aiUnderstanding: number;
    citationLikelihood: number;
    conversationalReadiness: number;
    contentStructure: number;
  };
  suggestions: string[];
  keywordDensity: Record<string, number>;
  readabilityScore: number;
}

const ContentEditor: React.FC<ContentEditorProps> = ({ userPlan }) => {
  const [content, setContent] = useState('');
  const [targetKeywords, setTargetKeywords] = useState('');
  const [contentType, setContentType] = useState<'article' | 'product' | 'faq' | 'meta'>('article');
  const [analysis, setAnalysis] = useState<ContentAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizedContent, setOptimizedContent] = useState('');
  const [showOptimized, setShowOptimized] = useState(false);

  // Debounced analysis
  const analyzeContent = useCallback(async () => {
    if (!content.trim() || content.length < 50) {
      setAnalysis(null);
      return;
    }

    setIsAnalyzing(true);
    try {
      // Simulate real-time analysis using the audit API
      const result = await apiService.runAudit('https://example.com', content);
      
      // Convert audit result to content analysis format
      const contentAnalysis: ContentAnalysis = {
        overallScore: result.overallScore,
        subscores: result.subscores,
        suggestions: result.recommendations.slice(0, 5),
        keywordDensity: calculateKeywordDensity(content, targetKeywords),
        readabilityScore: calculateReadabilityScore(content)
      };

      setAnalysis(contentAnalysis);

      // Track activity
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await userDataService.trackActivity({
            user_id: user.id,
            activity_type: 'content_analyzed',
            activity_data: { 
              contentLength: content.length,
              score: contentAnalysis.overallScore,
              contentType 
            }
          });
        }
      } catch (error) {
        console.error('Error tracking activity:', error);
      }

    } catch (error) {
      console.error('Error analyzing content:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [content, targetKeywords, contentType]);

  // Debounce the analysis
  useEffect(() => {
    const timer = setTimeout(() => {
      analyzeContent();
    }, 1000);

    return () => clearTimeout(timer);
  }, [analyzeContent]);

  const calculateKeywordDensity = (text: string, keywords: string): Record<string, number> => {
    if (!keywords.trim()) return {};
    
    const keywordList = keywords.split(',').map(k => k.trim().toLowerCase());
    const words = text.toLowerCase().split(/\s+/);
    const totalWords = words.length;
    
    const density: Record<string, number> = {};
    
    keywordList.forEach(keyword => {
      const count = words.filter(word => word.includes(keyword)).length;
      density[keyword] = totalWords > 0 ? (count / totalWords) * 100 : 0;
    });
    
    return density;
  };

  const calculateReadabilityScore = (text: string): number => {
    // Simple readability calculation (Flesch Reading Ease approximation)
    const sentences = text.split(/[.!?]+/).length - 1;
    const words = text.split(/\s+/).length;
    const syllables = text.split(/[aeiouAEIOU]/).length - 1;
    
    if (sentences === 0 || words === 0) return 0;
    
    const avgWordsPerSentence = words / sentences;
    const avgSyllablesPerWord = syllables / words;
    
    const score = 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord);
    return Math.max(0, Math.min(100, Math.round(score)));
  };

  const optimizeContent = async () => {
    if (!content.trim()) return;

    setIsOptimizing(true);
    try {
      const keywords = targetKeywords.split(',').map(k => k.trim()).filter(k => k);
      const result = await apiService.optimizeContent(content, keywords, contentType);
      
      setOptimizedContent(result.optimizedContent);
      setShowOptimized(true);

      // Track optimization activity
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await userDataService.trackActivity({
            user_id: user.id,
            activity_type: 'content_optimized',
            activity_data: { 
              originalScore: result.originalScore,
              optimizedScore: result.optimizedScore,
              improvement: result.improvement,
              contentType 
            }
          });
        }
      } catch (error) {
        console.error('Error tracking activity:', error);
      }

    } catch (error) {
      console.error('Error optimizing content:', error);
      alert('Failed to optimize content. Please try again.');
    } finally {
      setIsOptimizing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // You could add a toast notification here
  };

  const useOptimizedContent = () => {
    setContent(optimizedContent);
    setShowOptimized(false);
    setOptimizedContent('');
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'from-green-500 to-green-600';
    if (score >= 60) return 'from-yellow-500 to-yellow-600';
    return 'from-red-500 to-red-600';
  };

  const canUseEditor = userPlan !== 'free';

  if (!canUseEditor) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8 border border-gray-100 text-center">
        <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Real-time Content Editor</h3>
        <p className="text-gray-600 mb-4">
          Write and optimize content with instant AI visibility feedback as you type. Available with Core plan and above.
        </p>
        <button className="bg-gradient-to-r from-teal-500 to-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:shadow-lg transition-all duration-300">
          Upgrade to Core Plan
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Content Editor</h2>
        <div className="flex items-center space-x-3">
          <button
            onClick={optimizeContent}
            disabled={isOptimizing || !content.trim()}
            className="bg-gradient-to-r from-teal-500 to-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:shadow-lg transition-all duration-300 disabled:opacity-50 flex items-center space-x-2"
          >
            {isOptimizing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Optimizing...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                <span>Optimize</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Editor Panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Content Type and Keywords */}
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Content Type</label>
                <select
                  value={contentType}
                  onChange={(e) => setContentType(e.target.value as any)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="article">Article</option>
                  <option value="product">Product Description</option>
                  <option value="faq">FAQ</option>
                  <option value="meta">Meta Description</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target Keywords</label>
                <input
                  type="text"
                  value={targetKeywords}
                  onChange={(e) => setTargetKeywords(e.target.value)}
                  placeholder="AI, SEO, optimization"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Main Editor */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900">Content Editor</h3>
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <span>{content.length} characters</span>
                  {isAnalyzing && (
                    <div className="flex items-center space-x-1">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>Analyzing...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="p-4">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Start writing your content here. AI analysis will appear as you type..."
                rows={12}
                className="w-full border-0 resize-none focus:ring-0 focus:outline-none text-gray-900 placeholder-gray-500"
              />
            </div>
          </div>

          {/* Optimized Content Display */}
          {showOptimized && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-gray-900">Optimized Content</h3>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => copyToClipboard(optimizedContent)}
                      className="text-gray-600 hover:text-gray-900 p-1 rounded transition-colors"
                      title="Copy to clipboard"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={useOptimizedContent}
                      className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors"
                    >
                      Use This Version
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">
                  {optimizedContent}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Analysis Panel */}
        <div className="space-y-4">
          {analysis ? (
            <>
              {/* Overall Score */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <h3 className="font-medium text-gray-900 mb-4">AI Visibility Score</h3>
                <div className="text-center">
                  <div className={`text-3xl font-bold ${getScoreColor(analysis.overallScore)} mb-2`}>
                    {analysis.overallScore}
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full bg-gradient-to-r ${getScoreBg(analysis.overallScore)} transition-all duration-1000`}
                      style={{ width: `${analysis.overallScore}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Subscores */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <h3 className="font-medium text-gray-900 mb-4">Detailed Scores</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Brain className="w-4 h-4 text-teal-600" />
                      <span className="text-sm">AI Understanding</span>
                    </div>
                    <span className="font-medium">{analysis.subscores.aiUnderstanding}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Target className="w-4 h-4 text-purple-600" />
                      <span className="text-sm">Citation Likelihood</span>
                    </div>
                    <span className="font-medium">{analysis.subscores.citationLikelihood}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <MessageSquare className="w-4 h-4 text-indigo-600" />
                      <span className="text-sm">Conversational</span>
                    </div>
                    <span className="font-medium">{analysis.subscores.conversationalReadiness}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <FileText className="w-4 h-4 text-blue-600" />
                      <span className="text-sm">Structure</span>
                    </div>
                    <span className="font-medium">{analysis.subscores.contentStructure}</span>
                  </div>
                </div>
              </div>

              {/* Keyword Density */}
              {Object.keys(analysis.keywordDensity).length > 0 && (
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <h3 className="font-medium text-gray-900 mb-4">Keyword Density</h3>
                  <div className="space-y-2">
                    {Object.entries(analysis.keywordDensity).map(([keyword, density]) => (
                      <div key={keyword} className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">{keyword}</span>
                        <span className={`text-sm font-medium ${
                          density > 3 ? 'text-red-600' : density > 1 ? 'text-green-600' : 'text-yellow-600'
                        }`}>
                          {density.toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggestions */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <h3 className="font-medium text-gray-900 mb-4">Suggestions</h3>
                <ul className="space-y-2">
                  {analysis.suggestions.map((suggestion, index) => (
                    <li key={index} className="text-sm text-gray-600 flex items-start space-x-2">
                      <span className="text-purple-600 mt-1">•</span>
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Readability */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <h3 className="font-medium text-gray-900 mb-4">Readability</h3>
                <div className="text-center">
                  <div className={`text-2xl font-bold ${getScoreColor(analysis.readabilityScore)} mb-2`}>
                    {analysis.readabilityScore}
                  </div>
                  <p className="text-sm text-gray-600">
                    {analysis.readabilityScore >= 80 ? 'Very Easy' :
                     analysis.readabilityScore >= 60 ? 'Easy' :
                     analysis.readabilityScore >= 40 ? 'Moderate' : 'Difficult'}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 text-center">
              <FileText className="w-8 h-8 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 text-sm">
                Start writing content to see real-time AI visibility analysis
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContentEditor;