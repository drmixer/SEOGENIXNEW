import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FileText, Zap, Target, Brain, MessageSquare, Save, Copy, RefreshCw, AlertCircle, CheckCircle, Lightbulb, ChevronsUpDown, UploadCloud, Loader } from 'lucide-react';
import { apiService } from '../services/api';
import { userDataService } from '../services/userDataService';
import { supabase } from '../lib/supabase';
import CMSContentModal from './CMSContentModal';

interface ContentEditorProps {
  userPlan: 'free' | 'core' | 'pro' | 'agency';
  context?: { url?: string; content?: string; title?: string; keywords?: string; contentType?: 'article' | 'product' | 'faq' | 'meta' };
  onToast?: (toast: { type: 'success' | 'error' | 'info' | 'warning'; title: string; message?: string; duration?: number }) => void;
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

type Integration = { id: string; cms_type: 'wordpress' | 'shopify'; cms_name: string; site_url: string };

const ContentEditor: React.FC<ContentEditorProps> = ({ userPlan, context, onToast }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
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

  // CMS Integration State
  const [connectedIntegrations, setConnectedIntegrations] = useState<Integration[]>([]);
  const [isCmsModalOpen, setIsCmsModalOpen] = useState(false);
  const [selectedCmsType, setSelectedCmsType] = useState<'wordpress' | 'shopify' | null>(null);
  const [loadedCmsContent, setLoadedCmsContent] = useState<{ id: any; cmsType: 'wordpress' | 'shopify'; title: string } | null>(null);
  const [isPushing, setIsPushing] = useState(false);
  const [autoGenerateSchema, setAutoGenerateSchema] = useState(true);
  const [defaultPublishTarget, setDefaultPublishTarget] = useState<'wordpress' | 'shopify' | 'none'>('none');
  const [publishMenuOpen, setPublishMenuOpen] = useState(false);

  // Fetch integrations on mount
  useEffect(() => {
    const fetchIntegrations = async () => {
      try {
        const integrations = await apiService.getConnectedIntegrations();
        const arr = Array.isArray(integrations) ? integrations : [];
        setConnectedIntegrations(arr);
        // Set default publish target based on last-used and available integrations
        try {
          const { data: { user } } = await supabase.auth.getUser();
          const hasWP = arr.some((i: any) => i.cms_type === 'wordpress');
          const hasShop = arr.some((i: any) => i.cms_type === 'shopify');
          if (user && hasWP && hasShop) {
            const last = await userDataService.getLastCmsTarget(user.id);
            if (last) setDefaultPublishTarget(last);
            else setDefaultPublishTarget('wordpress');
          } else if (hasWP) {
            setDefaultPublishTarget('wordpress');
          } else if (hasShop) {
            setDefaultPublishTarget('shopify');
          } else {
            setDefaultPublishTarget('none');
          }
        } catch {}
      } catch (error) {
        console.error("Failed to fetch connected integrations:", error);
      }
    };
    fetchIntegrations();
  }, []);

  useEffect(() => {
    // Load direct content if provided via context (e.g., from Generator)
    if (context?.content) {
      setLoadedCmsContent(null);
      setTitle(context.title || 'Generated Content');
      setContent(context.content);
      if (context.keywords) setTargetKeywords(context.keywords);
      if (context.contentType) setContentType(context.contentType);
      return; // Prefer direct content over URL fetch
    }

    if (context?.url) {
      const loadContentFromUrl = async () => {
        setIsLoadingUrl(true);
        setLoadedCmsContent(null); // Reset CMS context
        try {
          const result = await apiService.fetchUrlContent(context.url);
          if (result.content) {
            // Basic title extraction
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = result.content;
            const h1 = tempDiv.querySelector('h1');
            setTitle(h1 ? h1.innerText : 'Untitled');
            setContent(result.content);
          }
        } catch (error) {
          console.error("Failed to fetch URL content:", error);
          alert(`Failed to load content from ${context.url}. Please check the URL or paste the content manually.`);
        } finally {
          setIsLoadingUrl(false);
        }
      };
      loadContentFromUrl();
    }
  }, [context]);

  // Debounced analysis
  const analyzeContent = useCallback(async () => {
    if (!content.trim() || content.length < 50) {
      setAnalysis(null);
      setRealTimeSuggestions([]);
      return;
    }
    setIsAnalyzing(true);
    try {
      const keywords = targetKeywords.split(',').map(k => k.trim()).filter(k => k);
      const result = await apiService.analyzeContentRealTime(content, keywords);
      setRealTimeSuggestions(result.suggestions || []);
      const auditResult = await apiService.runAudit('https://example.com', content);
      const contentAnalysis: ContentAnalysis = {
        overallScore: auditResult.overallScore,
        subscores: auditResult.subscores,
        suggestions: auditResult.recommendations.slice(0, 5),
        keywordDensity: calculateKeywordDensity(content, targetKeywords),
        readabilityScore: calculateReadabilityScore(content)
      };
      setAnalysis(contentAnalysis);
    } catch (error) {
      console.error('Error analyzing content:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [content, targetKeywords, contentType]);

  useEffect(() => {
    if (analysisTimeoutRef.current) clearTimeout(analysisTimeoutRef.current);
    analysisTimeoutRef.current = setTimeout(() => {
      if (content.trim()) analyzeContent();
    }, 1000);
    return () => {
      if (analysisTimeoutRef.current) clearTimeout(analysisTimeoutRef.current);
    };
  }, [analyzeContent]);

  // CMS Handlers
  const handleOpenCmsModal = (cmsType: 'wordpress' | 'shopify') => {
    setSelectedCmsType(cmsType);
    setIsCmsModalOpen(true);
  };

  const handleCmsContentSelect = async (selectedItem: any) => {
    if (!selectedCmsType) return;
    setIsCmsModalOpen(false);
    setIsLoadingUrl(true);
    try {
      const fullContent = await apiService.getCMSContentItem(selectedCmsType, selectedItem.id);
      setTitle(fullContent.title || selectedItem.title || '');
      setContent(fullContent.content || '');
      setLoadedCmsContent({ id: selectedItem.id, cmsType: selectedCmsType, title: fullContent.title || selectedItem.title || '' });
    } catch (error) {
      console.error("Failed to load CMS content item:", error);
      alert('Failed to load the selected content.');
    } finally {
      setIsLoadingUrl(false);
    }
  };

  const handleUpdateCmsContent = async () => {
    if (!loadedCmsContent) return;
    setIsPushing(true);
    try {
      await apiService.updateCMSContentItem(loadedCmsContent.cmsType, loadedCmsContent.id, { title, content });
      alert('Content updated successfully!');
      setLoadedCmsContent(prev => prev ? { ...prev, title } : null);
    } catch (error) {
      console.error("Failed to update CMS content:", error);
      alert('Failed to update content.');
    } finally {
      setIsPushing(false);
    }
  };

  const handlePushNewCmsContent = async () => {
    if (!loadedCmsContent) return;
    setIsPushing(true);
    try {
      if (loadedCmsContent.cmsType === 'wordpress') {
        await apiService.publishToWordPress({ title, content, status: 'draft', autoGenerateSchema });
      } else {
        await apiService.publishToShopify({
          product: { title, body_html: content },
          autoGenerateSchema
        });
      }
      alert('New content pushed successfully as a draft!');
      setLoadedCmsContent(null);
    } catch (error) {
      console.error("Failed to push new content:", error);
      alert('Failed to push new content.');
    } finally {
      setIsPushing(false);
    }
  };

  // Quick publish without loading an existing CMS item
  const handleQuickPublish = async (cmsType: 'wordpress' | 'shopify') => {
    if (!title.trim() || !content.trim()) {
      onToast?.({ type: 'warning', title: 'Cannot publish', message: 'Please add a title and content before publishing.', duration: 5000 });
      return;
    }
    setIsPushing(true);
    try {
      let result: any;
      if (cmsType === 'wordpress') {
        result = await apiService.publishToWordPress({ title, content, status: 'draft', autoGenerateSchema });
      } else {
        result = await apiService.publishToShopify({ product: { title, body_html: content }, autoGenerateSchema });
      }
      const maybeUrl = result?.data?.url || result?.data?.permalink || result?.data?.product_url || result?.data?.admin_url;
      onToast?.({
        type: 'success',
        title: `Published to ${cmsType === 'wordpress' ? 'WordPress' : 'Shopify'}`,
        message: maybeUrl ? `Draft created. View: ${maybeUrl}` : 'Draft created successfully.',
        duration: 4000
      });
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) await userDataService.saveLastCmsTarget(user.id, cmsType);
      } catch {}
    } catch (e: any) {
      console.error('Quick publish failed:', e);
      onToast?.({ type: 'error', title: 'Publish failed', message: e?.message || 'Failed to publish draft. Please check your integration.', duration: 7000 });
    } finally {
      setIsPushing(false);
    }
  };

  // Other functions (calculateKeywordDensity, etc.) remain the same
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
    } catch (error) {
      console.error('Error optimizing content:', error);
      alert('Failed to optimize content. Please try again.');
    } finally {
      setIsOptimizing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
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
    if (textareaRef.current && suggestion.position.start !== suggestion.position.end) {
      const textarea = textareaRef.current;
      textarea.focus();
      textarea.setSelectionRange(suggestion.position.start, suggestion.position.end);
    }
  };

  const applySuggestion = (suggestion: RealTimeSuggestion) => {
    if (suggestion.replacement && suggestion.position.start !== suggestion.position.end) {
      const newContent = content.substring(0, suggestion.position.start) + suggestion.replacement + content.substring(suggestion.position.end);
      setContent(newContent);
      setRealTimeSuggestions(prev => prev.filter(s => s !== suggestion));
    }
    setSelectedSuggestion(null);
    setHighlightedText(null);
  };


  if (userPlan === 'free') {
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
          {connectedIntegrations.map(int => (
            <button
              key={int.id}
              onClick={() => handleOpenCmsModal(int.cms_type)}
              className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 flex items-center space-x-2"
            >
              <span>Load from {int.cms_type === 'wordpress' ? 'WordPress' : 'Shopify'}</span>
            </button>
          ))}
          {connectedIntegrations.length > 0 && (() => {
            const hasWP = connectedIntegrations.some(ci => ci.cms_type === 'wordpress');
            const hasShop = connectedIntegrations.some(ci => ci.cms_type === 'shopify');
            if (hasWP && hasShop) {
              const label = defaultPublishTarget === 'shopify' ? 'Shopify' : 'WordPress';
              const primaryColor = defaultPublishTarget === 'shopify' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700';
              return (
                <div className="relative flex items-center">
                  <button
                    onClick={() => handleQuickPublish(defaultPublishTarget === 'none' ? 'wordpress' : defaultPublishTarget)}
                    disabled={isPushing || !content.trim()}
                    className={`${primaryColor} text-white px-3 py-2 rounded-l-lg font-medium disabled:opacity-50 flex items-center space-x-2`}
                  >
                    {isPushing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                    <span>Publish to {label}</span>
                  </button>
                  <button
                    onClick={() => setPublishMenuOpen(v => !v)}
                    className={`${primaryColor} text-white px-2 py-2 rounded-r-lg border-l border-white/20`}
                  >
                    <ChevronsUpDown className="w-4 h-4" />
                  </button>
                  {publishMenuOpen && (
                    <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                      <button
                        onClick={async () => {
                          setPublishMenuOpen(false);
                          setDefaultPublishTarget('wordpress');
                          try { const { data: { user } } = await supabase.auth.getUser(); if (user) await userDataService.saveLastCmsTarget(user.id, 'wordpress'); } catch {}
                          handleQuickPublish('wordpress');
                        }}
                        className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                      >Publish to WordPress</button>
                      <button
                        onClick={async () => {
                          setPublishMenuOpen(false);
                          setDefaultPublishTarget('shopify');
                          try { const { data: { user } } = await supabase.auth.getUser(); if (user) await userDataService.saveLastCmsTarget(user.id, 'shopify'); } catch {}
                          handleQuickPublish('shopify');
                        }}
                        className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                      >Publish to Shopify</button>
                    </div>
                  )}
                </div>
              );
            }
            if (hasWP) {
              return (
                <button
                  onClick={() => handleQuickPublish('wordpress')}
                  disabled={isPushing || !content.trim()}
                  className="bg-blue-600 text-white px-3 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
                >
                  {isPushing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                  <span>Publish to WordPress</span>
                </button>
              );
            }
            if (hasShop) {
              return (
                <button
                  onClick={() => handleQuickPublish('shopify')}
                  disabled={isPushing || !content.trim()}
                  className="bg-green-600 text-white px-3 py-2 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 flex items-center space-x-2"
                >
                  {isPushing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                  <span>Publish to Shopify</span>
                </button>
              );
            }
            return null;
          })()}
          <button
            onClick={optimizeContent}
            disabled={isOptimizing || !content.trim()}
            className="bg-gradient-to-r from-teal-500 to-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:shadow-lg transition-all duration-300 disabled:opacity-50 flex items-center space-x-2"
          >
            {isOptimizing ? <><RefreshCw className="w-4 h-4 animate-spin" /><span>Optimizing...</span></> : <><Zap className="w-4 h-4" /><span>Optimize</span></>}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter your content title here"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              {loadedCmsContent && <p className="text-xs text-gray-500 mt-1">Loaded from: "{loadedCmsContent.title}" on {loadedCmsContent.cmsType}</p>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Content Type</label>
                <select value={contentType} onChange={(e) => setContentType(e.target.value as any)} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent">
                  <option value="article">Article</option>
                  <option value="product">Product Description</option>
                  <option value="faq">FAQ</option>
                  <option value="meta">Meta Description</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target Keywords</label>
                <input type="text" value={targetKeywords} onChange={(e) => setTargetKeywords(e.target.value)} placeholder="AI, SEO, optimization" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 relative">
            {isLoadingUrl && (
              <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-20">
                <Loader className="w-8 h-8 text-purple-600 animate-spin" />
                <span className="ml-2 text-gray-600">Loading content...</span>
              </div>
            )}
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900">Editor</h3>
                <div className="flex items-center space-x-2">
                  {loadedCmsContent && (
                    <>
                      <button onClick={handleUpdateCmsContent} disabled={isPushing || !content.trim()} className="flex items-center space-x-1.5 text-sm font-medium text-white bg-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:bg-gray-400">
                        {isPushing ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4" />}
                        <span>Update</span>
                      </button>
                      <button onClick={handlePushNewCmsContent} disabled={isPushing || !content.trim()} className="flex items-center space-x-1.5 text-sm font-medium text-gray-700 bg-gray-100 px-3 py-1.5 rounded-lg hover:bg-gray-200 disabled:bg-gray-300">
                        {isPushing ? <RefreshCw className="w-4 h-4 animate-spin"/> : <UploadCloud className="w-4 h-4" />}
                        <span>Push as New</span>
                      </button>
                      <div className="flex items-center space-x-2 pl-2 border-l border-gray-200">
                        <input
                          type="checkbox"
                          id="autoSchema"
                          checked={autoGenerateSchema}
                          onChange={(e) => setAutoGenerateSchema(e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <label htmlFor="autoSchema" className="text-xs text-gray-600">Auto-generate Schema</label>
                      </div>
                    </>
                  )}
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <span>{content.length} characters</span>
                  {isAnalyzing && <div className="flex items-center space-x-1"><RefreshCw className="w-3 h-3 animate-spin" /><span>Analyzing...</span></div>}
                </div>
              </div>
            </div>
            <div className="p-4 relative">
              <textarea ref={textareaRef} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Start writing your content here..." rows={12} className="w-full border-0 resize-none focus:ring-0 focus:outline-none" />
            </div>
          </div>

          {/* Other panels (Real-time suggestions, Optimized content) go here */}
        </div>

        <div className="space-y-4">
          {/* Analysis panel goes here */}
        </div>
      </div>
      {isCmsModalOpen && selectedCmsType && (
        <CMSContentModal
          isOpen={isCmsModalOpen}
          onClose={() => setIsCmsModalOpen(false)}
          cmsType={selectedCmsType}
          onContentSelect={handleCmsContentSelect}
        />
      )}
    </div>
  );
};

export default ContentEditor;
