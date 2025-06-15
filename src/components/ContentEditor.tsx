import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FileText, Zap, Target, Brain, MessageSquare, Save, Copy, RefreshCw, AlertCircle, CheckCircle, Lightbulb } from 'lucide-react';
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

interface RealTimeSuggestion {
  type: 'grammar' | 'ai_clarity' | 'keyword' | 'structure' | 'entity';
  severity: 'error' | 'warning' | 'suggestion';
  message: string;
  suggestion: string;
  position: { start: number; end: number };
  replacement?: string;
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
  const [realTimeSuggestions, setRealTimeSuggestions] = useState<RealTimeSuggestion[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<RealTimeSuggestion | null>(null);
  const [highlightedText, setHighlightedText] = useState<{start: number, end: number} | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const analysisTimeoutRef = useRef<NodeJS.Timeout>();
  const [initialContentAdded, setInitialContentAdded] = useState(false);

  // Add sample content on first load to help users get started
  useEffect(() => {
    if (!initialContentAdded && !content) {
      const sampleContent = `# Introduction to AI Visibility

AI visibility refers to how well your content is structured and optimized for AI systems like ChatGPT, Google Bard, and voice assistants. As more people use AI to find information, traditional SEO isn't enough - your content needs to be easily understood and cited by AI systems.

## Why AI Visibility Matters

When users ask questions to AI systems, those systems need to:
1. Understand your content correctly
2. Consider it authoritative and relevant
3. Be able to extract and cite specific information

Poor AI visibility means your content might be ignored or misinterpreted, even if it contains valuable information.

## Key Components of AI Visibility

* AI Understanding - How well AI systems comprehend your content
* Citation Likelihood - How likely AI systems are to cite your content
* Conversational Readiness - How well your content answers natural language questions
* Content Structure - How well-organized your content is for AI parsing`;

      setContent(sampleContent);
      setTargetKeywords('AI visibility, SEO, content optimization');
      setInitialContentAdded(true);
    }
  }, [initialContentAdded, content]);

  // Debounced analysis
  const analyzeContent = useCallback(async () => {
    if (!content.trim() || content.length < 50) {
      setAnalysis(null);
      setRealTimeSuggestions([]);
      return;
    }

    setIsAnalyzing(true);
    try {
      // Generate real-time suggestions
      const keywords = targetKeywords.split(',').map(k => k.trim()).filter(k => k);
      
      // Simulate real-time analysis
      const suggestions: RealTimeSuggestion[] = [];
      
      // Check for passive voice
      const passivePattern = /\b(is|are|was|were|be|been|being)\s+\w+ed\b/gi;
      let match;
      while ((match = passivePattern.exec(content)) !== null) {
        suggestions.push({
          type: 'ai_clarity',
          severity: 'warning',
          message: 'Passive voice detected',
          suggestion: 'Use active voice for better AI understanding',
          position: { start: match.index, end: match.index + match[0].length },
          replacement: 'Use active voice instead'
        });
      }
      
      // Check for long sentences
      const sentences = content.split(/[.!?]+/).filter(s => s.trim());
      sentences.forEach(sentence => {
        if (sentence.trim().split(/\s+/).length > 25) {
          const start = content.indexOf(sentence);
          if (start !== -1) {
            suggestions.push({
              type: 'structure',
              severity: 'suggestion',
              message: 'Long sentence detected',
              suggestion: 'Break into shorter sentences for better AI comprehension',
              position: { start, end: start + sentence.length }
            });
          }
        }
      });
      
      // Check keyword density
      keywords.forEach(keyword => {
        if (keyword) {
          const regex = new RegExp(keyword, 'gi');
          const matches = content.match(regex) || [];
          const words = content.split(/\s+/).length;
          const density = words > 0 ? (matches.length / words) * 100 : 0;
          
          if (density > 3) {
            suggestions.push({
              type: 'keyword',
              severity: 'warning',
              message: `Keyword "${keyword}" appears too frequently (${density.toFixed(1)}%)`,
              suggestion: 'Reduce keyword density to avoid appearing spammy to AI systems',
              position: { start: 0, end: 0 }
            });
          } else if (density < 0.5 && content.length > 200) {
            suggestions.push({
              type: 'keyword',
              severity: 'suggestion',
              message: `Consider using "${keyword}" more frequently`,
              suggestion: 'Increase keyword presence for better topic relevance',
              position: { start: 0, end: 0 }
            });
          }
        }
      });
      
      // Check for missing question words for voice search
      if (!content.match(/\b(who|what|when|where|why|how)\b/i) && content.length > 200) {
        suggestions.push({
          type: 'entity',
          severity: 'suggestion',
          message: 'Missing question words for voice search',
          suggestion: 'Include "who, what, when, where, why, how" to match voice queries',
          position: { start: 0, end: 0 }
        });
      }
      
      setRealTimeSuggestions(suggestions);

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
    if (analysisTimeoutRef.current) {
      clearTimeout(analysisTimeoutRef.current);
    }

    analysisTimeoutRef.current = setTimeout(() => {
      if (content.trim()) {
        analyzeContent();
      }
    }, 1000);

    return () => {
      if (analysisTimeoutRef.current) {
        clearTimeout(analysisTimeoutRef.current);
      }
    };
  }, [analyzeContent]);

  const calculateKeywordDensity = (text: string, keywords: string): Record<string, number> => {
    if (!keywords.trim()) return {};
    
    const keywordList = keywords.split(',').map(k => k.trim().toLowerCase());
    const words = text.toLowerCase().split(/\s+/);
    const totalWords = words.length;
    
    const density: Record<string, number> = {};
    
    keywordList.forEach(keyword => {
      if (keyword) {
        const count = words.filter(word => word.includes(keyword)).length;
        density[keyword] = totalWords > 0 ? (count / totalWords) * 100 : 0;
      }
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

  const getScoreColor = (score?: number) => {
    if (!score) return 'text-gray-500';
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'from-green-500 to-green-600';
    if (score >= 60) return 'from-yellow-500 to-yellow-600';
    return 'from-red-500 to-red-600';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error': return 'text-red-600 bg-red-50 border-red-200';
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'suggestion': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error': return AlertCircle;
      case 'warning': return AlertCircle;
      case 'suggestion': return Lightbulb;
      default: return CheckCircle;
    }
  };

  const handleSuggestionClick = (suggestion: RealTimeSuggestion) => {
    setSelectedSuggestion(suggestion);
    setHighlightedText(suggestion.position);
    
    // Scroll to the position in the textarea
    if (textareaRef.current && suggestion.position.start !== suggestion.position.end) {
      const textarea = textareaRef.current;
      textarea.focus();
      textarea.setSelectionRange(suggestion.position.start, suggestion.position.end);
    }
  };

  const applySuggestion = (suggestion: RealTimeSuggestion) => {
    if (suggestion.replacement && suggestion.position.start !== suggestion.position.end) {
      const newContent = 
        content.substring(0, suggestion.position.start) + 
        suggestion.replacement + 
        content.substring(suggestion.position.end);
      setContent(newContent);
      
      // Remove this suggestion from the list
      setRealTimeSuggestions(prev => 
        prev.filter(s => s !== suggestion)
      );
    }
    setSelectedSuggestion(null);
    setHighlightedText(null);
  };

  const canUseEditor = userPlan !== 'free';

  if (!canUseEditor) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8 border border-gray-100 text-center">
        <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Content Editor</h3>
        <p className="text-gray-600 mb-4">
          Write and optimize content with AI visibility feedback. Available with Core plan and above.
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Content Type
                </label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Keywords
                </label>
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
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 relative">
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
            <div className="p-4 relative">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Start writing your content here. AI analysis will appear as you type..."
                rows={12}
                className="w-full border-0 resize-none focus:ring-0 focus:outline-none text-gray-900 placeholder-gray-500"
                style={{
                  background: 'transparent',
                  position: 'relative',
                  zIndex: 1
                }}
              />
              
              {/* Highlight layer for real-time suggestions */}
              {highlightedText && highlightedText.start !== highlightedText.end && (
                <div 
                  className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none"
                  style={{ zIndex: 0 }}
                >
                  <div 
                    className="absolute bg-yellow-200 opacity-40"
                    style={{
                      top: `${Math.floor(highlightedText.start / 80) * 1.5 + 1}rem`,
                      left: `${(highlightedText.start % 80) * 0.6}rem`,
                      width: `${(highlightedText.end - highlightedText.start) * 0.6}rem`,
                      height: '1.5rem'
                    }}
                  ></div>
                </div>
              )}
              
              {/* Suggestion markers */}
              {realTimeSuggestions.map((suggestion, index) => (
                suggestion.position.start !== suggestion.position.end && (
                  <div
                    key={index}
                    className="absolute cursor-pointer"
                    style={{
                      top: `${Math.floor(suggestion.position.start / 80) * 1.5 + 1}rem`,
                      left: `${(suggestion.position.start % 80) * 0.6}rem`,
                    }}
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    <div className={`w-2 h-2 rounded-full animate-pulse ${
                      suggestion.severity === 'error' ? 'bg-red-500' :
                      suggestion.severity === 'warning' ? 'bg-yellow-500' :
                      'bg-blue-500'
                    }`}></div>
                  </div>
                )
              ))}
            </div>
          </div>

          {/* Real-time Suggestions Panel */}
          {realTimeSuggestions.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
              <h3 className="font-medium text-gray-900 mb-3">Suggestions</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {realTimeSuggestions.map((suggestion, index) => {
                  const IconComponent = getSeverityIcon(suggestion.severity);
                  return (
                    <div
                      key={index}
                      className={`p-2 rounded-lg border cursor-pointer hover:shadow-sm transition-all ${getSeverityColor(suggestion.severity)} ${
                        selectedSuggestion === suggestion ? 'ring-2 ring-purple-500' : ''
                      }`}
                      onClick={() => handleSuggestionClick(suggestion)}
                    >
                      <div className="flex items-start space-x-2">
                        <IconComponent className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{suggestion.message}</p>
                          <p className="text-xs mt-1 opacity-80">{suggestion.suggestion}</p>
                          {suggestion.replacement && suggestion.position.start !== suggestion.position.end && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                applySuggestion(suggestion);
                              }}
                              className="text-xs mt-2 px-2 py-1 bg-white bg-opacity-50 rounded hover:bg-opacity-75 transition-colors"
                            >
                              Apply Fix
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
                {content.length > 0 ? 'Analyzing your content...' : 'Start writing content to see AI visibility analysis'}
              </p>
              {content.length > 0 && (
                <div className="mt-4">
                  <div className="animate-pulse flex space-x-4">
                    <div className="flex-1 space-y-4 py-1">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto"></div>
                      <div className="space-y-2">
                        <div className="h-4 bg-gray-200 rounded"></div>
                        <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContentEditor;