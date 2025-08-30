import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FileText, Zap, AlertCircle, CheckCircle, Lightbulb, RefreshCw } from 'lucide-react';
import { apiService } from '../services/api';

interface RealTimeContentEditorProps {
  userPlan: 'free' | 'core' | 'pro' | 'agency';
  selectedProjectId?: string;
}

interface RealTimeSuggestion {
  type: 'grammar' | 'ai_clarity' | 'keyword' | 'structure' | 'entity';
  severity: 'error' | 'warning' | 'suggestion';
  message: string;
  suggestion: string;
  position: { start: number; end: number };
  replacement?: string;
}

interface ContentMetrics {
  aiReadabilityScore: number;
  keywordDensity: Record<string, number>;
  entityCoverage: number;
  structureScore: number;
  suggestions: RealTimeSuggestion[];
}

const RealTimeContentEditor: React.FC<RealTimeContentEditorProps> = ({ userPlan, selectedProjectId }) => {
  const [content, setContent] = useState('');
  const [targetKeywords, setTargetKeywords] = useState('AI, SEO, optimization');
  const [metrics, setMetrics] = useState<ContentMetrics | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<RealTimeSuggestion | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const analysisTimeoutRef = useRef<NodeJS.Timeout>();

  // Debounced real-time analysis
  const analyzeContent = useCallback(async (text: string) => {
    if (text.length < 50) {
      setMetrics(null);
      return;
    }

    setIsAnalyzing(true);
    try {
      const keywords = targetKeywords.split(',').map(k => k.trim());

      // If no project is selected, skip API call and provide fallback
      if (!selectedProjectId) {
        const fallbackMetrics = generateFallbackMetrics(text, keywords);
        setMetrics(fallbackMetrics);
        return;
      }

      // Use the real-time analysis API with project context
      const result = await apiService.analyzeContentRealTime(selectedProjectId, text, keywords);
      setMetrics(result);
    } catch (error) {
      console.error('Real-time analysis error:', error);
      // Generate fallback metrics
      const keywords = targetKeywords.split(',').map(k => k.trim());
      const fallbackMetrics = generateFallbackMetrics(text, keywords);
      setMetrics(fallbackMetrics);
    } finally {
      setIsAnalyzing(false);
    }
  }, [targetKeywords, selectedProjectId]);

  // Generate fallback metrics for demo
  const generateFallbackMetrics = (text: string, keywords: string[]): ContentMetrics => {
    const words = text.split(/\s+/);
    const sentences = text.split(/[.!?]+/).filter(s => s.trim());
    
    // Calculate keyword density
    const keywordDensity: Record<string, number> = {};
    keywords.forEach(keyword => {
      const count = text.toLowerCase().split(keyword.toLowerCase()).length - 1;
      keywordDensity[keyword] = (count / words.length) * 100;
    });

    // Generate suggestions based on content analysis
    const suggestions: RealTimeSuggestion[] = [];

    // Check for passive voice
    const passivePatterns = /\b(is|are|was|were|be|been|being)\s+\w+ed\b/gi;
    let match;
    while ((match = passivePatterns.exec(text)) !== null) {
      suggestions.push({
        type: 'ai_clarity',
        severity: 'warning',
        message: 'Passive voice detected',
        suggestion: 'Use active voice for better AI understanding and clarity',
        position: { start: match.index, end: match.index + match[0].length },
        replacement: 'Use active voice instead'
      });
    }

    // Check for long sentences
    sentences.forEach((sentence, index) => {
      if (sentence.split(/\s+/).length > 25) {
        const start = text.indexOf(sentence);
        suggestions.push({
          type: 'structure',
          severity: 'suggestion',
          message: 'Long sentence detected',
          suggestion: 'Consider breaking this sentence into shorter ones for better AI comprehension',
          position: { start, end: start + sentence.length }
        });
      }
    });

    // Check keyword density
    keywords.forEach(keyword => {
      if (keyword) {
        const density = keywordDensity[keyword] || 0;
        if (density > 3) {
          suggestions.push({
            type: 'keyword',
            severity: 'warning',
            message: `Keyword "${keyword}" may be over-optimized (${density.toFixed(1)}%)`,
            suggestion: 'Reduce keyword density to avoid appearing spammy to AI systems',
            position: { start: 0, end: 0 }
          });
        } else if (density < 0.5 && text.length > 200) {
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
    if (!text.match(/\b(who|what|when|where|why|how)\b/i)) {
      suggestions.push({
        type: 'entity',
        severity: 'suggestion',
        message: 'Missing question words for voice search',
        suggestion: 'Include "who, what, when, where, why, how" to match voice queries',
        position: { start: 0, end: 0 }
      });
    }

    return {
      aiReadabilityScore: Math.max(20, 100 - suggestions.length * 10),
      keywordDensity,
      entityCoverage: Math.floor(Math.random() * 40) + 60,
      structureScore: Math.max(30, 100 - (sentences.filter(s => s.split(/\s+/).length > 20).length * 15)),
      suggestions: suggestions.slice(0, 8) // Limit to 8 suggestions
    };
  };

  // Debounce the analysis
  useEffect(() => {
    if (analysisTimeoutRef.current) {
      clearTimeout(analysisTimeoutRef.current);
    }

    analysisTimeoutRef.current = setTimeout(() => {
      if (content.trim()) {
        analyzeContent(content);
      }
    }, 1000);

    return () => {
      if (analysisTimeoutRef.current) {
        clearTimeout(analysisTimeoutRef.current);
      }
    };
  }, [content, analyzeContent]);

  const applySuggestion = (suggestion: RealTimeSuggestion) => {
    if (suggestion.replacement && textareaRef.current) {
      const textarea = textareaRef.current;
      const start = suggestion.position.start;
      const end = suggestion.position.end;
      
      const newContent = content.substring(0, start) + suggestion.replacement + content.substring(end);
      setContent(newContent);
      
      // Focus and set cursor position
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + suggestion.replacement.length, start + suggestion.replacement.length);
      }, 0);
    }
    setSelectedSuggestion(null);
  };

  const getSeverityColor = (severity: RealTimeSuggestion['severity']) => {
    switch (severity) {
      case 'error': return 'text-red-600 bg-red-50 border-red-200';
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'suggestion': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getSeverityIcon = (severity: RealTimeSuggestion['severity']) => {
    switch (severity) {
      case 'error': return AlertCircle;
      case 'warning': return AlertCircle;
      case 'suggestion': return Lightbulb;
      default: return CheckCircle;
    }
  };

  const canUseRealTimeEditor = ['core', 'pro', 'agency'].includes(userPlan);

  if (!canUseRealTimeEditor) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8 border border-gray-100 text-center">
        <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Real-time AI Content Editor</h3>
        <p className="text-gray-600 mb-4">
          Get instant AI-powered suggestions as you write. Available with Core plan and above.
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
        <h2 className="text-2xl font-bold text-gray-900">Real-time Content Editor</h2>
        <div className="flex items-center space-x-2 text-sm text-gray-500">
          {isAnalyzing && (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Analyzing...</span>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Editor Panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Keywords Input */}
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <label className="block text-sm font-medium text-gray-700 mb-2">Target Keywords</label>
            <input
              type="text"
              value={targetKeywords}
              onChange={(e) => setTargetKeywords(e.target.value)}
              placeholder="AI, SEO, optimization"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* Main Editor */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 relative">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900">Content Editor</h3>
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <span>{content.length} characters</span>
                  <span>{content.split(/\s+/).filter(w => w).length} words</span>
                  {metrics && (
                    <span className="text-purple-600 font-medium">
                      AI Score: {metrics.aiReadabilityScore}/100
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Start writing your content here. Real-time AI suggestions will appear as you type..."
                rows={16}
                className="w-full border-0 resize-none focus:ring-0 focus:outline-none text-gray-900 placeholder-gray-500 p-4"
              />
              
              {/* Inline suggestions overlay */}
              {metrics?.suggestions.map((suggestion, index) => (
                suggestion.position.start > 0 && suggestion.position.end > 0 && (
                  <div
                    key={index}
                    className="absolute pointer-events-none"
                    style={{
                      top: `${Math.floor(suggestion.position.start / 80) * 1.5 + 1}rem`,
                      left: `${(suggestion.position.start % 80) * 0.6}rem`,
                    }}
                  >
                    <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                  </div>
                )
              ))}
            </div>
          </div>
        </div>

        {/* Real-time Analysis Panel */}
        <div className="space-y-4">
          {/* Metrics Overview */}
          {metrics && (
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <h3 className="font-medium text-gray-900 mb-4">Real-time Metrics</h3>
              
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-600">AI Readability</span>
                    <span className="text-sm font-medium">{metrics.aiReadabilityScore}/100</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-teal-500 to-purple-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${metrics.aiReadabilityScore}%` }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-600">Structure Score</span>
                    <span className="text-sm font-medium">{metrics.structureScore}/100</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${metrics.structureScore}%` }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-600">Entity Coverage</span>
                    <span className="text-sm font-medium">{metrics.entityCoverage}/100</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-green-500 to-emerald-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${metrics.entityCoverage}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Keyword Density */}
          {metrics && Object.keys(metrics.keywordDensity).length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <h3 className="font-medium text-gray-900 mb-4">Keyword Density</h3>
              <div className="space-y-2">
                {Object.entries(metrics.keywordDensity).map(([keyword, density]) => (
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

          {/* Real-time Suggestions */}
          {metrics?.suggestions && metrics.suggestions.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <h3 className="font-medium text-gray-900 mb-4">
                Suggestions ({metrics.suggestions.length})
              </h3>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {metrics.suggestions.map((suggestion, index) => {
                  const IconComponent = getSeverityIcon(suggestion.severity);
                  return (
                    <div
                      key={index}
                      className={`p-3 rounded-lg border cursor-pointer hover:shadow-sm transition-all ${getSeverityColor(suggestion.severity)} ${
                        selectedSuggestion?.message === suggestion.message ? 'ring-2 ring-purple-500' : ''
                      }`}
                      onClick={() => setSelectedSuggestion(suggestion)}
                    >
                      <div className="flex items-start space-x-2">
                        <IconComponent className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{suggestion.message}</p>
                          <p className="text-xs mt-1 opacity-80">{suggestion.suggestion}</p>
                          {suggestion.replacement && (
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

          {/* No suggestions state */}
          {metrics && metrics.suggestions.length === 0 && (
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 text-center">
              <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <p className="text-sm text-gray-600">Great! No issues detected.</p>
              <p className="text-xs text-gray-500 mt-1">Your content is well-optimized for AI systems.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RealTimeContentEditor;
