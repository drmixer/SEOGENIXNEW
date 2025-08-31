import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FileText, Zap, Target, Brain, MessageSquare, Save, Copy, RefreshCw, AlertCircle, CheckCircle, Lightbulb, ChevronsUpDown, UploadCloud, Loader, Shield } from 'lucide-react';
import { apiService } from '../services/api';
import { userDataService } from '../services/userDataService';
import { supabase } from '../lib/supabase';
import CMSContentModal from './CMSContentModal';

interface ContentEditorProps {
  userPlan: 'free' | 'core' | 'pro' | 'agency';
  context?: { url?: string; content?: string; title?: string; keywords?: string; contentType?: 'article' | 'product' | 'faq' | 'meta' };
  onToast?: (toast: { type: 'success' | 'error' | 'info' | 'warning'; title: string; message?: string; duration?: number }) => void;
  selectedProjectId?: string;
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

const ContentEditor: React.FC<ContentEditorProps> = ({ userPlan, context, onToast, selectedProjectId }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'text' | 'html'>('text');
  const [targetKeywords, setTargetKeywords] = useState('');
  const [contentType, setContentType] = useState<'article' | 'product' | 'faq' | 'meta'>('article');
  const [analysis, setAnalysis] = useState<ContentAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizedContent, setOptimizedContent] = useState('');
  const [showOptimized, setShowOptimized] = useState(false);
  const [optimizedViewMode, setOptimizedViewMode] = useState<'optimized' | 'diff'>('optimized');
  const [diffGranularity, setDiffGranularity] = useState<'line' | 'word'>('line');
  const [realTimeSuggestions, setRealTimeSuggestions] = useState<RealTimeSuggestion[]>([]);
  // URL resolved from Fix It context or selected project
  const [currentUrl, setCurrentUrl] = useState<string | undefined>(context?.url);
  const [siteName, setSiteName] = useState<string>('');
  const [selectedSuggestion, setSelectedSuggestion] = useState<RealTimeSuggestion | null>(null);
  const [highlightedText, setHighlightedText] = useState<{start: number, end: number} | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const analysisTimeoutRef = useRef<NodeJS.Timeout>();
  // Panel refs for deep-link scrolling
  const entitiesPanelRef = useRef<HTMLDivElement>(null);
  const schemaPanelRef = useRef<HTMLDivElement>(null);
  const citationsPanelRef = useRef<HTMLDivElement>(null);

  // Entities state (Phase 1 cross-tool integration)
  type SuggestedEntity = { name: string; type?: string; relevance?: number; description?: string };
  type MissingEntity = { name: string; type?: string; importance?: string; reasoning?: string };
  const [entitiesSuggested, setEntitiesSuggested] = useState<SuggestedEntity[]>([]);
  const [entitiesMissing, setEntitiesMissing] = useState<MissingEntity[]>([]);
  const [entitiesAccepted, setEntitiesAccepted] = useState<string[]>([]);
  const [showEntitiesPanel, setShowEntitiesPanel] = useState<boolean>(false);
  const [entityCoverageScore, setEntityCoverageScore] = useState<number | null>(null);
  const [entitySummary, setEntitySummary] = useState<string | null>(null);

  // Schema state (Phase 2)
  const [showSchemaPanel, setShowSchemaPanel] = useState<boolean>(false);
  const [schemaJson, setSchemaJson] = useState<string>('');
  const [schemaValid, setSchemaValid] = useState<boolean | null>(null);
  const [schemaIssues, setSchemaIssues] = useState<Array<{ path?: string; message: string }>>([]);
  const [schemaApplied, setSchemaApplied] = useState<boolean>(false);
  const [hasAppliedSchemaForContext, setHasAppliedSchemaForContext] = useState<boolean>(false);
  const [useInsertedSchema, setUseInsertedSchema] = useState<boolean>(true);
  // Citations (lean)
  const [showCitationsPanel, setShowCitationsPanel] = useState<boolean>(false);
  const [citations, setCitations] = useState<Array<{ title: string; url: string; anchorText?: string; used?: boolean; relNofollow?: boolean }>>([]);
  const [relNofollowDefault, setRelNofollowDefault] = useState<boolean>(true);
  const [citationSearchQuery, setCitationSearchQuery] = useState<string>('');
  const [citationSearchResults, setCitationSearchResults] = useState<Array<{ title: string; url: string; snippet?: string }>>([]);
  const [isSearchingSources, setIsSearchingSources] = useState<boolean>(false);
  // Publish Impact
  const [recentImpacts, setRecentImpacts] = useState<Array<any>>([]);

  // CMS Integration State
  const [connectedIntegrations, setConnectedIntegrations] = useState<Integration[]>([]);
  const [isCmsModalOpen, setIsCmsModalOpen] = useState(false);
  const [selectedCmsType, setSelectedCmsType] = useState<'wordpress' | 'shopify' | null>(null);
  const [loadedCmsContent, setLoadedCmsContent] = useState<{ id: any; cmsType: 'wordpress' | 'shopify'; title: string } | null>(null);
  const [isPushing, setIsPushing] = useState(false);
  const [autoGenerateSchema, setAutoGenerateSchema] = useState(true);
  const [defaultPublishTarget, setDefaultPublishTarget] = useState<'wordpress' | 'shopify' | 'none'>('none');
  const [publishMenuOpen, setPublishMenuOpen] = useState(false);

  // Convert fetched HTML into readable plain text for the editor
  const htmlToPlainText = (html: string): string => {
    try {
      const container = document.createElement('div');
      container.innerHTML = html;

      // Remove non-content elements
      container.querySelectorAll('script, style, noscript, svg, nav, footer, header, aside').forEach(el => el.remove());

      // Prefer a main-like content wrapper if present
      const root = (container.querySelector('main, article, [role="main"], #main, #content, .content') as HTMLElement) || container;

      const lines: string[] = [];
      const blocks = root.querySelectorAll('h1, h2, h3, p, li, blockquote, pre');
      blocks.forEach((el) => {
        const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (!text) return;
        const tag = el.tagName.toLowerCase();
        if (tag === 'li') {
          lines.push(`- ${text}`);
        } else if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
          // Add a visual break before headings
          if (lines.length && lines[lines.length - 1] !== '') lines.push('');
          lines.push(text);
          lines.push('');
        } else if (tag === 'blockquote') {
          lines.push(text);
          lines.push('');
        } else if (tag === 'pre') {
          lines.push(text);
          lines.push('');
        } else {
          lines.push(text);
        }
      });

      // Fallback to body text if nothing was captured
      let output = lines.join('\n').trim();
      if (!output) {
        output = container.textContent?.replace(/\s+/g, ' ').trim() || '';
      }

      // Collapse excessive blank lines
      output = output.replace(/\n{3,}/g, '\n\n');

      // Keep the content at a reasonable size
      if (output.length > 20000) {
        output = output.slice(0, 20000) + '\n\n…';
      }
      return output;
    } catch {
      // If parsing fails, just return a stripped string
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      return (tmp.textContent || '').replace(/\s+/g, ' ').trim();
    }
  };

  // Strip simple markdown emphasis wrappers
  const stripBasicMarkdownEmphasis = (text: string): string => {
    try {
      let out = text;
      out = out.replace(/\*\*(.*?)\*\*/g, '$1');
      out = out.replace(/\*(.*?)\*/g, '$1');
      out = out.replace(/_(.*?)_/g, '$1');
      return out;
    } catch {
      return text;
    }
  };

  // Simple line-level diff for Original vs Optimized
  const computeLineDiff = (
    original: string,
    optimized: string
  ): { left: Array<{ text: string; changed: boolean }>; right: Array<{ text: string; changed: boolean }> } => {
    const a = original.split(/\r?\n/);
    const b = optimized.split(/\r?\n/);
    const max = Math.max(a.length, b.length);
    const left: Array<{ text: string; changed: boolean }> = [];
    const right: Array<{ text: string; changed: boolean }> = [];
    for (let i = 0; i < max; i++) {
      const l = a[i] ?? '';
      const r = b[i] ?? '';
      const changed = l !== r;
      left.push({ text: l, changed });
      right.push({ text: r, changed });
    }
    return { left, right };
  };

  // Word-level diff for a single line using LCS
  const computeWordDiffForLine = (aLine: string, bLine: string): {
    left: Array<{ value: string; type: 'equal' | 'removed' }>
    right: Array<{ value: string; type: 'equal' | 'added' }>
  } => {
    const a = aLine.split(/(\s+)/); // keep spaces as tokens to preserve spacing
    const b = bLine.split(/(\s+)/);
    const m = a.length, n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = m - 1; i >= 0; i--) {
      for (let j = n - 1; j >= 0; j--) {
        dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    const left: Array<{ value: string; type: 'equal' | 'removed' }> = [];
    const right: Array<{ value: string; type: 'equal' | 'added' }> = [];
    let i = 0, j = 0;
    while (i < m && j < n) {
      if (a[i] === b[j]) {
        left.push({ value: a[i], type: 'equal' });
        right.push({ value: b[j], type: 'equal' });
        i++; j++;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) {
        left.push({ value: a[i], type: 'removed' });
        i++;
      } else {
        right.push({ value: b[j], type: 'added' });
        j++;
      }
    }
    while (i < m) { left.push({ value: a[i++], type: 'removed' }); }
    while (j < n) { right.push({ value: b[j++], type: 'added' }); }
    return { left, right };
  };

  const renderWordDiffSpanLeft = (tokens: Array<{ value: string; type: 'equal' | 'removed' }>, keyPrefix: string) => (
    <div>
      {tokens.map((t, idx) => t.type === 'equal'
        ? <span key={`${keyPrefix}-l-${idx}`}>{t.value}</span>
        : <span key={`${keyPrefix}-l-${idx}`} className="bg-red-50 text-red-700 line-through decoration-red-400">{t.value}</span>
      )}
    </div>
  );

  const renderWordDiffSpanRight = (tokens: Array<{ value: string; type: 'equal' | 'added' }>, keyPrefix: string) => (
    <div>
      {tokens.map((t, idx) => t.type === 'equal'
        ? <span key={`${keyPrefix}-r-${idx}`}>{t.value}</span>
        : <span key={`${keyPrefix}-r-${idx}`} className="bg-green-100 text-green-800">{t.value}</span>
      )}
    </div>
  );

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
      setCurrentUrl(context.url);
      const loadContentFromUrl = async () => {
        setIsLoadingUrl(true);
        setLoadedCmsContent(null); // Reset CMS context
        try {
          const result = await apiService.fetchUrlContent(context.url);
          if (result.content) {
            // Extract a sensible title and readable text content
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = result.content;
            const h1 = tempDiv.querySelector('h1');
            setTitle(h1 ? h1.innerText.trim() : 'Untitled');
            const plain = htmlToPlainText(result.content);
            setContent(plain);
            setHtmlContent(result.content);
          } else {
            setTitle('Untitled');
            setContent('');
            setHtmlContent(null);
          }
        } catch (error) {
          console.error("Failed to fetch URL content:", error);
          onToast?.({
            type: 'warning',
            title: 'Could not load page content',
            message: `Failed to load ${context.url}. Paste content manually or try another URL.`,
            duration: 6000
          });
        } finally {
          setIsLoadingUrl(false);
        }
      };
      loadContentFromUrl();
    }
  }, [context]);

  // Deep-link handling: open target tab/panel and scroll into view
  useEffect(() => {
    const tab = (context as any)?.tab as undefined | 'entities' | 'schema' | 'citations';
    if (!tab) return;
    if (tab === 'entities') {
      setShowEntitiesPanel(true);
      setShowSchemaPanel(false);
      setShowCitationsPanel(false);
      setTimeout(() => entitiesPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } else if (tab === 'schema') {
      setShowSchemaPanel(true);
      setShowEntitiesPanel(false);
      setShowCitationsPanel(false);
      setTimeout(() => schemaPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } else if (tab === 'citations') {
      setShowCitationsPanel(true);
      setShowEntitiesPanel(false);
      setShowSchemaPanel(false);
      setTimeout(() => citationsPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context?.tab]);

  // If no specific page URL provided, resolve the website URL from the selected project
  useEffect(() => {
    const loadFromSelectedProject = async () => {
      if (context?.url || context?.content) return; // already handled
      if (!selectedProjectId || currentUrl) return; // need a project and avoid duplicate loads
      try {
        setIsLoadingUrl(true);
        const { data, error } = await supabase
          .from('projects')
          .select('url, name')
          .eq('id', selectedProjectId)
          .single();
        if (error) throw error;
        const siteUrl: string | undefined = data?.url;
        if (data?.name) setSiteName(data.name);
        if (!siteUrl) return;
        setCurrentUrl(siteUrl);
        setLoadedCmsContent(null);
        // Fetch homepage content via standard fetcher
        const result = await apiService.fetchUrlContent(siteUrl);
        if (result.content) {
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = result.content;
          const h1 = tempDiv.querySelector('h1');
          setTitle(h1 ? h1.innerText.trim() : 'Untitled');
          const plain = htmlToPlainText(result.content);
          setContent(plain);
          setHtmlContent(result.content);
        } else {
          setTitle('Untitled');
          setContent('');
          setHtmlContent(null);
        }
      } catch (e: any) {
        console.error('Failed to load site content from selected project:', e);
        onToast?.({ type: 'info', title: 'Editor Ready', message: 'Start by pasting content or load from CMS.', duration: 4000 });
      } finally {
        setIsLoadingUrl(false);
      }
    };
    loadFromSelectedProject();
  }, [selectedProjectId, context?.url, context?.content, currentUrl]);

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
      if (!selectedProjectId) {
        // If missing, do a graceful no-op and avoid calling the API
        setRealTimeSuggestions([]);
      } else {
        const result = await apiService.analyzeContentRealTime(selectedProjectId, content, keywords);
        setRealTimeSuggestions(result.suggestions || []);
      }
      // Best-effort analysis summary without blocking if audit fails
      try {
        if (selectedProjectId) {
          const auditUrl = currentUrl || context?.url || 'https://example.com';
          const auditResult = await apiService.runAudit(selectedProjectId, auditUrl, content);
          const contentAnalysis: ContentAnalysis = {
            overallScore: auditResult.overallScore,
            subscores: auditResult.subscores,
            suggestions: auditResult.recommendations?.slice(0, 5) || [],
            keywordDensity: calculateKeywordDensity(content, targetKeywords),
            readabilityScore: calculateReadabilityScore(content)
          };
          setAnalysis(contentAnalysis);
        } else {
          setAnalysis({
            overallScore: 0,
            subscores: { aiUnderstanding: 0, citationLikelihood: 0, conversationalReadiness: 0, contentStructure: 0 },
            suggestions: [],
            keywordDensity: calculateKeywordDensity(content, targetKeywords),
            readabilityScore: calculateReadabilityScore(content)
          });
        }
      } catch {
        setAnalysis({
          overallScore: 0,
          subscores: { aiUnderstanding: 0, citationLikelihood: 0, conversationalReadiness: 0, contentStructure: 0 },
          suggestions: [],
          keywordDensity: calculateKeywordDensity(content, targetKeywords),
          readabilityScore: calculateReadabilityScore(content)
        });
      }
    } catch (error) {
      console.error('Error analyzing content:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [content, targetKeywords, contentType, selectedProjectId, context?.url]);

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
      const resp = await apiService.updateCMSContentItem(
        loadedCmsContent.cmsType,
        loadedCmsContent.id,
        { title, content },
        { 
          autoGenerateSchema: autoGenerateSchema, 
          projectId: selectedProjectId,
          pageUrl: (currentUrl || context?.url),
          useInsertedSchema
        }
      );
      const payload = resp?.data || resp;
      const maybePermalink = payload?.permalink || payload?.post?.link || null;
      alert('Content updated successfully!');
      setLoadedCmsContent(prev => prev ? { ...prev, title } : null);
      // Post-publish follow-up: validate schema and re-audit
      try {
        await postPublishFollowup(loadedCmsContent.cmsType, maybePermalink || undefined);
      } catch (e) {
        console.warn('Post-publish follow-up failed:', e);
      }
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
        const resp = await apiService.publishToWordPress({ 
          title, 
          content, 
          status: 'draft', 
          autoGenerateSchema,
          projectId: selectedProjectId,
          pageUrl: (currentUrl || context?.url),
          useInsertedSchema
        });
        const payload = resp?.data || resp;
        const maybePermalink = payload?.permalink || payload?.post?.link || null;
        const newId = payload?.post?.id;
        // Upsert schema draft with the new cms_item_id for future matches
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user && selectedProjectId && newId != null) {
            const websiteUrl = (maybePermalink || currentUrl || context?.url || '') as string;
            const draft: any = { cms_type: 'wordpress', cms_item_id: newId };
            if (hasAppliedSchemaForContext && schemaJson?.trim()) {
              draft.applied = true;
              draft.schema = JSON.parse(schemaJson);
              if (schemaValid != null) draft.valid = schemaValid;
              if (schemaIssues?.length) draft.issues = schemaIssues;
            }
            await userDataService.saveSchemaDraft({
              userId: user.id,
              projectId: selectedProjectId,
              websiteUrl,
              draft
            });
          }
        } catch (e) { console.warn('Failed to upsert schema draft with cms_item_id:', e); }
        await postPublishFollowup('wordpress', maybePermalink || undefined, newId);
      } else {
        const resp = await apiService.publishToShopify({
          product: { title, body_html: content },
          autoGenerateSchema,
          projectId: selectedProjectId,
          pageUrl: (currentUrl || context?.url),
          useInsertedSchema
        });
        const payload = resp?.data || resp;
        const maybePermalink = payload?.permalink || null;
        const newId = payload?.product?.id;
        // Upsert schema draft with the new cms_item_id for future matches
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user && selectedProjectId && newId != null) {
            const websiteUrl = (maybePermalink || currentUrl || context?.url || '') as string;
            const draft: any = { cms_type: 'shopify', cms_item_id: newId };
            if (hasAppliedSchemaForContext && schemaJson?.trim()) {
              draft.applied = true;
              draft.schema = JSON.parse(schemaJson);
              if (schemaValid != null) draft.valid = schemaValid;
              if (schemaIssues?.length) draft.issues = schemaIssues;
            }
            await userDataService.saveSchemaDraft({
              userId: user.id,
              projectId: selectedProjectId,
              websiteUrl,
              draft
            });
          }
        } catch (e) { console.warn('Failed to upsert schema draft with cms_item_id:', e); }
        await postPublishFollowup('shopify', maybePermalink || undefined, newId);
      }
      alert('New content pushed successfully as a draft!');
      setLoadedCmsContent(null);
      try {
        await postPublishFollowup(loadedCmsContent.cmsType);
      } catch (e) {
        console.warn('Post-publish follow-up failed:', e);
      }
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
        const resp = await apiService.publishToWordPress({ 
          title, 
          content, 
          status: 'draft', 
          autoGenerateSchema,
          projectId: selectedProjectId,
          pageUrl: (currentUrl || context?.url),
          useInsertedSchema
        });
        const payload = resp?.data || resp;
        const maybePermalink = payload?.permalink || payload?.post?.link || null;
        const newId = payload?.post?.id;
        // Upsert schema draft with cms_item_id for future exact matches
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user && selectedProjectId && newId != null) {
            const websiteUrl = (maybePermalink || currentUrl || context?.url || '') as string;
            const draft: any = { cms_type: 'wordpress', cms_item_id: newId };
            if (hasAppliedSchemaForContext && schemaJson?.trim()) {
              draft.applied = true;
              draft.schema = JSON.parse(schemaJson);
              if (schemaValid != null) draft.valid = schemaValid;
              if (schemaIssues?.length) draft.issues = schemaIssues;
            }
            await userDataService.saveSchemaDraft({
              userId: user.id,
              projectId: selectedProjectId,
              websiteUrl,
              draft
            });
          }
        } catch (e) { console.warn('Failed to upsert schema draft with cms_item_id:', e); }
        await postPublishFollowup('wordpress', maybePermalink || undefined, newId);
        result = resp;
      } else {
        const resp = await apiService.publishToShopify({ 
          product: { title, body_html: content }, 
          autoGenerateSchema,
          projectId: selectedProjectId,
          pageUrl: (currentUrl || context?.url),
          useInsertedSchema
        });
        const payload = resp?.data || resp;
        const maybePermalink = payload?.permalink || null;
        const newId = payload?.product?.id;
        // Upsert schema draft with cms_item_id for future exact matches
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user && selectedProjectId && newId != null) {
            const websiteUrl = (maybePermalink || currentUrl || context?.url || '') as string;
            const draft: any = { cms_type: 'shopify', cms_item_id: newId };
            if (hasAppliedSchemaForContext && schemaJson?.trim()) {
              draft.applied = true;
              draft.schema = JSON.parse(schemaJson);
              if (schemaValid != null) draft.valid = schemaValid;
              if (schemaIssues?.length) draft.issues = schemaIssues;
            }
            await userDataService.saveSchemaDraft({
              userId: user.id,
              projectId: selectedProjectId,
              websiteUrl,
              draft
            });
          }
        } catch (e) { console.warn('Failed to upsert schema draft with cms_item_id:', e); }
        await postPublishFollowup('shopify', maybePermalink || undefined, newId);
        result = resp;
      }
      const maybeUrl = result?.data?.url || result?.data?.permalink || result?.data?.product_url || result?.data?.admin_url;
      onToast?.({
        type: 'success',
        title: `Published to ${cmsType === 'wordpress' ? 'WordPress' : 'Shopify'}`,
        message: maybeUrl ? `Draft created. View: ${maybeUrl}` : 'Draft created successfully.',
        duration: 4000
      });
      try {
        await postPublishFollowup(cmsType, maybeUrl);
      } catch (e) {
        console.warn('Post-publish follow-up failed:', e);
      }
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

  // Post-publish validation and re-audit
  const postPublishFollowup = async (
    cmsType: 'wordpress' | 'shopify',
    permalink?: string,
    cmsItemIdOverride?: string | number
  ) => {
    try {
      const usedSchema = (useInsertedSchema && hasAppliedSchemaForContext)
        ? 'inserted'
        : (autoGenerateSchema ? 'generator' : 'none');

      let schemaValid: boolean | null = null;
      let issues: Array<{ path?: string; message: string }> = [];

      if (usedSchema !== 'none') {
        try {
          if (useInsertedSchema && hasAppliedSchemaForContext && schemaJson?.trim()) {
            const res = await apiService.validateSchema(schemaJson);
            schemaValid = !!res.valid;
            issues = Array.isArray(res.issues) ? res.issues : [];
          } else if (autoGenerateSchema && selectedProjectId) {
            const gen = await apiService.generateSchema(
              selectedProjectId,
              permalink || currentUrl || context?.url || '',
              contentType,
              content,
              entitiesAccepted,
              siteName
            );
            const candidate = gen?.schema || gen?.markup || gen?.schemaMarkup || gen;
            const jsonStr = typeof candidate === 'string' ? candidate : JSON.stringify(candidate);
            const res = await apiService.validateSchema(jsonStr);
            schemaValid = !!res.valid;
            issues = Array.isArray(res.issues) ? res.issues : [];
          }
        } catch (e) {
          console.warn('Schema validation after publish failed:', e);
        }
      }

      // Re-audit
      let afterScore: number | null = null;
      let delta: number | null = null;
      try {
        if (selectedProjectId) {
          const auditUrl = permalink || currentUrl || context?.url || 'https://example.com';
          const res = await apiService.runAudit(selectedProjectId, auditUrl, content);
          afterScore = res?.overallScore ?? null;
          if (analysis?.overallScore != null && afterScore != null) {
            delta = Math.round(afterScore - analysis.overallScore);
          }
        }
      } catch (e) {
        console.warn('Re-audit after publish failed:', e);
      }

      // Toast summary
      const schemaMsg = usedSchema === 'none'
        ? 'Schema: none'
        : (schemaValid === true ? 'Schema: valid' : (schemaValid === false ? `Schema: invalid (${issues.length} issues)` : 'Schema: checked'));
      const auditMsg = afterScore != null
        ? `Visibility: ${afterScore}${delta != null && delta !== 0 ? (delta > 0 ? ` (▲${delta})` : ` (▼${Math.abs(delta)})`) : ''}`
        : 'Visibility: checked';
      onToast?.({
        type: 'success',
        title: `Post-publish checks (${cmsType})`,
        message: `${schemaMsg} • ${auditMsg}`,
        duration: 6000
      });

      // Track activity
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && selectedProjectId) {
          await userDataService.trackActivity({
            user_id: user.id,
            activity_type: 'post_publish_validation',
            tool_id: selectedProjectId,
            website_url: permalink || currentUrl || context?.url,
            created_at: new Date().toISOString(),
            activity_data: {
              cms_type: cmsType,
              cms_item_id: (cmsItemIdOverride != null ? cmsItemIdOverride : loadedCmsContent?.id),
              usedSchema,
              schemaValid,
              schemaIssueCount: issues.length,
              afterScore,
              delta,
              permalink
            }
          });
        }
      } catch (e) {
        console.warn('Failed to track post-publish activity:', e);
      }
    } catch (e) {
      console.warn('postPublishFollowup error:', e);
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
    if (!selectedProjectId) {
      onToast?.({ type: 'warning', title: 'Missing project', message: 'Please select a website before optimizing.', duration: 5000 });
      return;
    }
    setIsOptimizing(true);
    try {
      const keywords = targetKeywords.split(',').map(k => k.trim()).filter(k => k);
      // Map editor contentType to optimizer-accepted values
      const optimizerType = ((): 'article' | 'blog' | 'landing-page' => {
        if (contentType === 'article') return 'article';
        // Default other types to 'article' for now
        return 'article';
      })();
      const result = await apiService.optimizeContent(selectedProjectId, content, keywords, optimizerType);
      const rawOptimized = result?.optimizedContent || result?.optimized_content || '';
      const optimized = stripBasicMarkdownEmphasis(rawOptimized);
      if (optimized) {
        setOptimizedContent(optimized);
        setShowOptimized(true);
        setOptimizedViewMode('optimized');
        onToast?.({ type: 'success', title: 'Optimization ready', message: 'Review and apply the optimized draft.', duration: 3500 });

        // Trigger entity analysis on the optimized draft
        try {
          if (selectedProjectId) {
            const entityRes = await apiService.analyzeEntityCoverage(selectedProjectId, currentUrl || '', optimized);
            const analysis = (entityRes?.data) ? entityRes.data : entityRes; // normalize
            const suggested = Array.isArray(analysis?.mentionedEntities) ? analysis.mentionedEntities : [];
            const missing = Array.isArray(analysis?.missingEntities) ? analysis.missingEntities : [];
            setEntitiesSuggested(suggested);
            setEntitiesMissing(missing);
            if (typeof analysis?.coverageScore === 'number') setEntityCoverageScore(analysis.coverageScore);
            if (typeof analysis?.strategicSummary === 'string') setEntitySummary(analysis.strategicSummary);
            setShowEntitiesPanel(true);

            // Persist draft (without changing accepted selection)
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (user && selectedProjectId && (currentUrl || context?.url)) {
                await userDataService.saveEntitiesDraft({
                  userId: user.id,
                  projectId: selectedProjectId,
                  websiteUrl: (currentUrl || context?.url)!,
                  draft: { suggested, missing, accepted: entitiesAccepted }
                });
              }
            } catch {}
          }
        } catch (e) {
          console.warn('Entity analysis failed or returned no data:', e);
        }
      } else {
        onToast?.({ type: 'info', title: 'No changes suggested', message: 'The optimizer did not return a rewritten draft.', duration: 4000 });
      }
    } catch (error) {
      console.error('Error optimizing content:', error);
      onToast?.({ type: 'error', title: 'Optimization failed', message: 'Failed to optimize content. Please try again.', duration: 6000 });
    } finally {
      setIsOptimizing(false);
    }
  };

  // Load persisted entities draft for current project + URL
  useEffect(() => {
    (async () => {
      try {
        if (!selectedProjectId || !(currentUrl || context?.url)) return;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const draft = await userDataService.getEntitiesDraft(user.id, selectedProjectId, (currentUrl || context?.url)!);
        if (draft) {
          setEntitiesSuggested(Array.isArray(draft.suggested) ? draft.suggested as any : []);
          setEntitiesMissing(Array.isArray(draft.missing) ? draft.missing as any : []);
          setEntitiesAccepted(Array.isArray(draft.accepted) ? draft.accepted : []);
        }
        const schemaDraft = await userDataService.getSchemaDraft(
          user.id,
          selectedProjectId,
          (currentUrl || context?.url)!,
          loadedCmsContent ? { cms_type: loadedCmsContent.cmsType, cms_item_id: loadedCmsContent.id } : undefined
        );
        if (schemaDraft?.schema) {
          const jsonStr = typeof schemaDraft.schema === 'string' ? schemaDraft.schema : JSON.stringify(schemaDraft.schema, null, 2);
          setSchemaJson(jsonStr);
          setSchemaValid(typeof schemaDraft.valid === 'boolean' ? schemaDraft.valid : null);
          setSchemaIssues(Array.isArray(schemaDraft.issues) ? schemaDraft.issues : []);
          setSchemaApplied(!!schemaDraft.applied);
          setHasAppliedSchemaForContext(!!schemaDraft.applied);
        } else {
          setHasAppliedSchemaForContext(false);
        }
        // Load citations usage and/or seed suggestions from accepted entities
        try {
          const usage = await userDataService.getCitationsUsage(user.id, selectedProjectId, (currentUrl || context?.url)!);
          if (usage?.citations?.length) {
            setCitations(usage.citations);
            if (typeof usage.citations[0]?.relNofollow === 'boolean') setRelNofollowDefault(!!usage.citations[0].relNofollow);
          } else if (entitiesAccepted.length) {
            const suggestions: Array<{ title: string; url: string; anchorText?: string; used?: boolean; relNofollow?: boolean }> = [];
            const pushUnique = (title: string, url: string, anchor?: string) => {
              if (!url) return;
              if (suggestions.find(s => s.url === url)) return;
              suggestions.push({ title, url, anchorText: anchor || title, used: false, relNofollow: relNofollowDefault });
            };
            entitiesAccepted.forEach(name => {
              const slug = encodeURIComponent(name.replace(/\s+/g, '_'));
              pushUnique(`Wikipedia: ${name}`, `https://en.wikipedia.org/wiki/${slug}`, name);
              const q = encodeURIComponent(`${name} official site`);
              pushUnique(`${name} (official site search)`, `https://www.google.com/search?q=${q}`, name);
            });
            setCitations(suggestions);
          }
        } catch {}
      } catch (e) {
        console.warn('Failed to load entities draft:', e);
      }
    })();
  }, [selectedProjectId, currentUrl, context?.url]);

  // Load recent Publish Impact entries (post_publish_validation) for this context
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const entries = await userDataService.getRecentActivity(user.id, 30);
        const keyUrl = (currentUrl || context?.url) || '';
        const cmsMatchId = loadedCmsContent?.id;
        const filtered = (entries || []).filter((e: any) => e.activity_type === 'post_publish_validation' && (
          (e.website_url && keyUrl && e.website_url === keyUrl) ||
          (e.activity_data?.cms_item_id && cmsMatchId && String(e.activity_data.cms_item_id) === String(cmsMatchId))
        ));
        setRecentImpacts(filtered.slice(0, 3));
      } catch (e) {
        console.warn('Failed to load recent publish impact entries:', e);
      }
    })();
  }, [selectedProjectId, currentUrl, context?.url, loadedCmsContent?.id]);

  const toggleAcceptEntity = (name: string) => {
    setEntitiesAccepted(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  };

  const acceptAllEntities = () => {
    const names = [
      ...entitiesSuggested.map(e => e.name),
      ...entitiesMissing.map(e => e.name)
    ];
    const unique = Array.from(new Set(names.filter(Boolean)));
    setEntitiesAccepted(unique);
  };

  const saveEntitiesDraft = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !selectedProjectId || !(currentUrl || context?.url)) return;
      await userDataService.saveEntitiesDraft({
        userId: user.id,
        projectId: selectedProjectId,
        websiteUrl: (currentUrl || context?.url)!,
        draft: { suggested: entitiesSuggested, missing: entitiesMissing, accepted: entitiesAccepted }
      });
      onToast?.({ type: 'success', title: 'Entities saved', message: 'Draft saved to your project context.', duration: 2500 });
    } catch (e: any) {
      onToast?.({ type: 'error', title: 'Save failed', message: e?.message || 'Could not save entities draft.', duration: 4000 });
    }
  };

  // Citations helpers
  const saveCitations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !selectedProjectId || !(currentUrl || context?.url)) return;
      await userDataService.saveCitationsUsage({
        userId: user.id,
        projectId: selectedProjectId,
        websiteUrl: (currentUrl || context?.url)!,
        usage: { citations, insertedAnchors: false, insertedReferences: false }
      });
      onToast?.({ type: 'success', title: 'Citations saved', message: 'Saved to your project context.', duration: 2500 });
    } catch (e) {
      console.warn('Failed to save citations:', e);
    }
  };

  const insertAnchorOnce = (text: string, href: string, anchorText?: string, relNoFollow?: boolean): { applied: boolean; updated: string } => {
    const label = (anchorText || text || '').trim();
    if (!label) return { applied: false, updated: content };
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(\\\b)(${escaped})(\\\b)`, 'i');
    if (!pattern.test(content)) {
      return { applied: false, updated: content };
    }
    const rel = relNoFollow ? ' rel="nofollow"' : '';
    const replaced = content.replace(pattern, `$1<a href="${href}"${rel}>$2</a>$3`);
    return { applied: true, updated: replaced };
  };

  const handleInsertAnchors = async () => {
    let updated = content;
    let count = 0;
    const next = citations.map(c => ({ ...c }));
    next.forEach(c => {
      if (!c.url) return;
      const res = insertAnchorOnce(c.anchorText || c.title, c.url, c.anchorText || c.title, c.relNofollow ?? relNofollowDefault);
      if (res.applied) {
        updated = res.updated;
        count += 1;
        c.used = true;
      }
    });
    setContent(updated);
    setCitations(next);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && selectedProjectId && (currentUrl || context?.url)) {
        await userDataService.saveCitationsUsage({
          userId: user.id,
          projectId: selectedProjectId,
          websiteUrl: (currentUrl || context?.url)!,
          usage: { citations: next, insertedAnchors: true, insertedReferences: false }
        });
      }
    } catch {}
    onToast?.({ type: 'success', title: 'Anchors inserted', message: count ? `${count} anchors added` : 'No matching phrases found to anchor', duration: 3000 });
  };

  const handleInsertReferences = async () => {
    const list = citations.filter(c => (c.used || c.anchorText || c.title) && c.url).slice(0, 20);
    if (list.length === 0) {
      onToast?.({ type: 'info', title: 'No citations selected', message: 'Add or select citations first.' });
      return;
    }
    const items = list.map((c, i) => `<li><a href="${c.url}"${(c.relNofollow ?? relNofollowDefault) ? ' rel="nofollow"' : ''}>${c.title || c.anchorText || `Source ${i+1}`}</a></li>`).join('\n');
    const block = `\n\n<h3>References</h3>\n<ol>\n${items}\n</ol>\n`;
    const updated = content.trimEnd() + block;
    setContent(updated);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && selectedProjectId && (currentUrl || context?.url)) {
        await userDataService.saveCitationsUsage({
          userId: user.id,
          projectId: selectedProjectId,
          websiteUrl: (currentUrl || context?.url)!,
          usage: { citations, insertedAnchors: true, insertedReferences: true }
        });
      }
    } catch {}
    onToast?.({ type: 'success', title: 'References inserted', message: 'References block appended to content.' });
  };

  // Schema helpers
  const generateSchema = async () => {
    if (!selectedProjectId) {
      onToast?.({ type: 'warning', title: 'Missing project', message: 'Select a website first.', duration: 3000 });
      return;
    }
    try {
      const output = await apiService.generateSchema(
        selectedProjectId,
        currentUrl || context?.url || '',
        contentType,
        (optimizedContent && showOptimized) ? optimizedContent : content,
        entitiesAccepted,
        siteName
      );
      const schemaObj = output?.schema || output?.markup || output?.schemaMarkup || output;
      const jsonStr = typeof schemaObj === 'string' ? schemaObj : JSON.stringify(schemaObj, null, 2);
      setSchemaJson(jsonStr);
      setSchemaValid(null);
      setSchemaIssues([]);
      setSchemaApplied(false);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && selectedProjectId && (currentUrl || context?.url)) {
          await userDataService.saveSchemaDraft({
            userId: user.id,
            projectId: selectedProjectId,
            websiteUrl: (currentUrl || context?.url)!,
            draft: {
              schema: typeof schemaObj === 'string' ? JSON.parse(schemaObj) : schemaObj,
              cms_type: loadedCmsContent?.cmsType,
              cms_item_id: loadedCmsContent?.id
            }
          });
        }
      } catch {}
      onToast?.({ type: 'success', title: 'Schema generated', message: 'Review, validate, then insert.', duration: 2500 });
    } catch (e: any) {
      onToast?.({ type: 'error', title: 'Generation failed', message: e?.message || 'Could not generate schema.', duration: 4000 });
    }
  };

  const validateSchema = async () => {
    try {
      const res = await apiService.validateSchema(schemaJson);
      setSchemaValid(!!res.valid);
      setSchemaIssues(Array.isArray(res.issues) ? res.issues : []);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && selectedProjectId && (currentUrl || context?.url)) {
          await userDataService.saveSchemaDraft({
            userId: user.id,
            projectId: selectedProjectId,
            websiteUrl: (currentUrl || context?.url)!,
            draft: {
              schema: JSON.parse(schemaJson),
              valid: !!res.valid,
              issues: res.issues || [],
              cms_type: loadedCmsContent?.cmsType,
              cms_item_id: loadedCmsContent?.id
            }
          });
        }
      } catch {}
    } catch (e: any) {
      onToast?.({ type: 'error', title: 'Validation failed', message: e?.message || 'Could not validate schema.', duration: 4000 });
    }
  };

  const insertSchemaIntoDraft = async () => {
    try {
      setSchemaApplied(true);
      onToast?.({ type: 'success', title: 'Schema inserted', message: 'Will be included when publishing.', duration: 2500 });
      const { data: { user } } = await supabase.auth.getUser();
      if (user && selectedProjectId && (currentUrl || context?.url)) {
        await userDataService.saveSchemaDraft({
          userId: user.id,
          projectId: selectedProjectId,
          websiteUrl: (currentUrl || context?.url)!,
          draft: {
            applied: true,
            schema: JSON.parse(schemaJson),
            valid: schemaValid ?? undefined,
            issues: schemaIssues,
            cms_type: loadedCmsContent?.cmsType,
            cms_item_id: loadedCmsContent?.id
          }
        });
        setHasAppliedSchemaForContext(true);
      }
    } catch {}
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const useOptimizedContent = () => {
    setContent(optimizedContent);
    setShowOptimized(false);
    setOptimizedContent('');
    setOptimizedViewMode('optimized');
    onToast?.({ type: 'success', title: 'Applied optimized draft', message: 'Your editor content was replaced.', duration: 2500 });
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-gray-900">Content Editor</h2>
        <div className="flex flex-wrap items-center gap-2 sm:space-x-3">
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
          {/* Schema application status + quick actions */}
          <div className="hidden md:flex items-center space-x-2 text-xs text-gray-700">
            <span
              className={`px-2 py-1 rounded border ${
                (useInsertedSchema && hasAppliedSchemaForContext)
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : (autoGenerateSchema ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-600')
              }`}
            >
              Applied schema: {(useInsertedSchema && hasAppliedSchemaForContext) ? 'Inserted' : (autoGenerateSchema ? 'Auto-generate' : 'None')}
            </span>
            <button
              onClick={() => setShowSchemaPanel(true)}
              className="px-2 py-1 rounded border border-gray-300 hover:bg-gray-50"
              title="View or edit schema draft"
            >View</button>
            <button
              onClick={() => {
                const next = !useInsertedSchema;
                setUseInsertedSchema(next);
                onToast?.({
                  type: 'success',
                  title: 'Schema preference',
                  message: next ? 'Will prefer inserted schema if available.' : 'Will use generator when publishing.',
                  duration: 2500
                });
              }}
              className="px-2 py-1 rounded border border-gray-300 hover:bg-gray-50"
              title="Toggle between using inserted schema and generator"
            >
              {useInsertedSchema ? 'Switch to generator' : 'Switch to inserted'}
            </button>
          </div>
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
                  {/* Quick Load from CMS */}
                  {connectedIntegrations.length > 0 && (
                    <div className="hidden md:flex items-center space-x-1 mr-3">
                      {connectedIntegrations.some(i => i.cms_type === 'wordpress') && (
                        <button
                          onClick={() => handleOpenCmsModal('wordpress')}
                          className="px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100"
                          title="Load content from WordPress"
                        >Load WP</button>
                      )}
                      {connectedIntegrations.some(i => i.cms_type === 'shopify') && (
                        <button
                          onClick={() => handleOpenCmsModal('shopify')}
                          className="px-2 py-1 text-xs font-medium bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100"
                          title="Load content from Shopify"
                        >Load Shopify</button>
                      )}
                    </div>
                  )}
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
                <div className="flex items-center space-x-3">
                  {/* View mode toggle */}
                  <div className="inline-flex rounded-md overflow-hidden border border-gray-200 bg-white" role="tablist" aria-label="Editor view mode">
                    <button
                      role="tab"
                      aria-selected={viewMode === 'text'}
                      onClick={() => setViewMode('text')}
                      className={`${viewMode === 'text' ? 'bg-purple-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'} px-2.5 py-1 text-xs font-medium border-r border-gray-200`}
                      title="Edit clean text (recommended)"
                    >
                      Text
                    </button>
                    <button
                      role="tab"
                      aria-selected={viewMode === 'html'}
                      onClick={() => htmlContent && setViewMode('html')}
                      disabled={!htmlContent}
                      className={`${viewMode === 'html' ? 'bg-purple-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'} px-2.5 py-1 text-xs font-medium ${htmlContent ? '' : 'opacity-50 cursor-not-allowed'}`}
                      title={htmlContent ? 'Preview raw HTML (read-only)' : 'HTML preview unavailable'}
                    >
                      HTML
                    </button>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-gray-500">
                    <span>{content.length} characters</span>
                    {isAnalyzing && <div className="flex items-center space-x-1"><RefreshCw className="w-3 h-3 animate-spin" /><span>Analyzing...</span></div>}
                  </div>
                </div>
                {/* Schema preference pill */}
                <div className="flex items-center space-x-2">
                  <span className="text-xs px-2 py-1 rounded-full border border-gray-200 bg-gray-50 text-gray-700">
                    Applied schema: {hasAppliedSchemaForContext && useInsertedSchema ? 'Inserted' : (autoGenerateSchema ? 'Auto-generate' : 'None')}
                  </span>
                  <button
                    onClick={() => setShowSchemaPanel(true)}
                    className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50"
                  >View</button>
                  <button
                    onClick={() => {
                      if (hasAppliedSchemaForContext) {
                        setUseInsertedSchema(prev => !prev);
                        onToast?.({ type: 'info', title: 'Schema preference', message: !useInsertedSchema ? 'Using inserted schema' : 'Using generator', duration: 2500 });
                      } else {
                        setAutoGenerateSchema(prev => !prev);
                        onToast?.({ type: 'info', title: 'Schema preference', message: !autoGenerateSchema ? 'Auto-generate enabled' : 'Auto-generate disabled', duration: 2500 });
                      }
                    }}
                    className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50"
                  >Switch</button>
                </div>
              </div>
            </div>
            <div className="p-4 relative">
              {viewMode === 'html' && htmlContent ? (
                <div>
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-xs text-gray-600 mr-2">Read-only HTML preview. Switch to Text to edit.</p>
                    <button
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(htmlContent || '');
                          onToast?.({ type: 'success', title: 'HTML copied', message: 'Raw HTML copied to clipboard.', duration: 2500 });
                        } catch (e: any) {
                          onToast?.({ type: 'error', title: 'Copy failed', message: e?.message || 'Could not copy HTML.', duration: 4000 });
                        }
                      }}
                      className="flex items-center space-x-1.5 text-xs font-medium text-gray-700 bg-gray-100 px-2.5 py-1.5 rounded-md hover:bg-gray-200"
                      title="Copy raw HTML"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy HTML</span>
                    </button>
                  </div>
                  <pre className="whitespace-pre-wrap text-xs bg-gray-50 border border-gray-200 rounded-md p-3 max-h-96 overflow-auto">
                    {htmlContent}
                  </pre>
                </div>
              ) : (
                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Start writing your content here..."
                  rows={12}
                  className="w-full border-0 resize-none focus:ring-0 focus:outline-none"
                />
              )}
            </div>

            {/* If fetched text is likely from an SPA (very short), suggest pasting content */}
            {(currentUrl || context?.url) && content.trim().length > 0 && content.trim().length < 300 && (
              <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 flex items-center justify-between">
                <span>This page may be a JavaScript-powered site and returned limited text. Paste content or try a prerendered fetch.</span>
                <button
                  onClick={async () => {
                    try {
                      setIsLoadingUrl(true);
                      const res = await apiService.fetchUrlContentPrerender((currentUrl || context?.url)!);
                      const prerendered = (res?.content || '').toString();
                      if (prerendered.trim().length > 0) {
                        // Prerender service returns plain text; set directly
                        setContent(prerendered);
                        onToast?.({ type: 'success', title: 'Loaded prerendered text', message: 'Replaced with prerendered content for better editing.', duration: 3000 });
                      } else {
                        onToast?.({ type: 'warning', title: 'No text returned', message: 'Prerender service returned empty content.', duration: 3000 });
                      }
                    } catch (e: any) {
                      onToast?.({ type: 'error', title: 'Prerender fetch failed', message: e?.message || 'Please paste your content instead.', duration: 4000 });
                    } finally {
                      setIsLoadingUrl(false);
                    }
                  }}
                  className="ml-2 px-2 py-1 bg-amber-600 text-white rounded hover:bg-amber-700"
                >
                  Try prerender fetch
                </button>
              </div>
            )}
          </div>

          {/* Optimized content preview panel */}
          {showOptimized && optimizedContent && (
            <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <h4 className="font-medium text-gray-900">Optimized Draft</h4>
                  <div className="inline-flex rounded-md overflow-hidden border border-gray-200 bg-white">
                    <button
                      className={`${optimizedViewMode === 'optimized' ? 'bg-purple-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'} px-2.5 py-1 text-xs font-medium border-r border-gray-200`}
                      onClick={() => setOptimizedViewMode('optimized')}
                    >
                      View Optimized
                    </button>
                    <button
                      className={`${optimizedViewMode === 'diff' ? 'bg-purple-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'} px-2.5 py-1 text-xs font-medium`}
                      onClick={() => setOptimizedViewMode('diff')}
                    >
                      View Diff
                    </button>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={useOptimizedContent}
                    className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700"
                  >
                    Replace Current Content
                  </button>
                  <button
                    onClick={() => setShowEntitiesPanel(v => !v)}
                    className={`px-3 py-1 text-sm rounded border ${showEntitiesPanel ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'border-gray-300 hover:bg-gray-50 text-gray-700'}`}
                    title="View and manage suggested entities"
                  >
                    Entities{entitiesAccepted.length ? ` (${entitiesAccepted.length})` : ''}
                  </button>
                  <button
                    onClick={() => setShowSchemaPanel(v => !v)}
                    className={`px-3 py-1 text-sm rounded border ${showSchemaPanel ? 'bg-green-50 border-green-200 text-green-700' : 'border-gray-300 hover:bg-gray-50 text-gray-700'}`}
                    title="Generate and validate JSON-LD schema"
                  >
                    <span className="inline-flex items-center space-x-1">
                      <Shield className="w-3.5 h-3.5" />
                      <span>Schema</span>
                    </span>
                  </button>
                  <button
                    onClick={() => setShowCitationsPanel(v => !v)}
                    className={`px-3 py-1 text-sm rounded border ${showCitationsPanel ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : 'border-gray-300 hover:bg-gray-50 text-gray-700'}`}
                    title="Add citations and references"
                  >
                    Citations{citations.length ? ` (${citations.length})` : ''}
                  </button>
                  <button
                    onClick={() => {
                      setShowOptimized(false);
                      setOptimizedContent('');
                      setOptimizedViewMode('optimized');
                    }}
                    className="px-3 py-1 border border-gray-300 text-sm rounded hover:bg-gray-50"
                  >
                    Dismiss
                  </button>
                  {optimizedViewMode === 'diff' && (
                    <div className="ml-2 inline-flex rounded-md overflow-hidden border border-gray-200 bg-white">
                      <button
                        className={`${diffGranularity === 'line' ? 'bg-gray-800 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'} px-2 py-1 text-xs font-medium border-r border-gray-200`}
                        onClick={() => setDiffGranularity('line')}
                        title="Highlight whole-line changes"
                      >Line</button>
                      <button
                        className={`${diffGranularity === 'word' ? 'bg-gray-800 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'} px-2 py-1 text-xs font-medium`}
                        onClick={() => setDiffGranularity('word')}
                        title="Highlight changes within lines"
                      >Word</button>
                    </div>
                  )}
                </div>
              </div>
              {optimizedViewMode === 'optimized' ? (
                <textarea
                  value={optimizedContent}
                  readOnly
                  className="w-full border border-gray-200 rounded p-3 text-sm bg-gray-50"
                  rows={10}
                />
              ) : (
                (() => {
                  const { left, right } = computeLineDiff(content, optimizedContent);
                  if (diffGranularity === 'line') {
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Original</div>
                          <div className="border border-gray-200 rounded p-3 text-sm bg-gray-50 max-h-80 overflow-auto">
                            {left.map((l, i) => (
                              <div key={i} className={l.changed ? 'bg-red-50 line-through decoration-red-400' : ''}>{l.text || '\u00A0'}</div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Optimized</div>
                          <div className="border border-gray-200 rounded p-3 text-sm bg-gray-50 max-h-80 overflow-auto">
                            {right.map((r, i) => (
                              <div key={i} className={r.changed ? 'bg-green-50' : ''}>{r.text || '\u00A0'}</div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  // Word-level rendering within changed lines
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Original</div>
                        <div className="border border-gray-200 rounded p-3 text-sm bg-gray-50 max-h-80 overflow-auto">
                          {left.map((l, i) => {
                            if (!l.changed) return <div key={i}>{l.text || '\u00A0'}</div>;
                            const { left: lTokens } = computeWordDiffForLine(l.text, right[i]?.text ?? '');
                            return (
                              <div key={i}>{renderWordDiffSpanLeft(lTokens, `wl-${i}`)}</div>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Optimized</div>
                        <div className="border border-gray-200 rounded p-3 text-sm bg-gray-50 max-h-80 overflow-auto">
                          {right.map((r, i) => {
                            if (!r.changed) return <div key={i}>{r.text || '\u00A0'}</div>;
                            const { right: rTokens } = computeWordDiffForLine(left[i]?.text ?? '', r.text);
                            return (
                              <div key={i}>{renderWordDiffSpanRight(rTokens, `wr-${i}`)}</div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
          )}

          {showEntitiesPanel && (
            <div ref={entitiesPanelRef} className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 mt-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <h4 className="font-medium text-gray-900">Entities</h4>
                  {typeof entityCoverageScore === 'number' && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">Coverage: {entityCoverageScore}</span>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={acceptAllEntities}
                    className="px-2.5 py-1 text-xs font-medium border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Accept All
                  </button>
                  <button
                    onClick={() => setTargetKeywords(entitiesAccepted.join(', '))}
                    className="px-2.5 py-1 text-xs font-medium bg-purple-600 text-white rounded hover:bg-purple-700"
                    title="Use accepted entities as target keywords"
                  >
                    Use as Keywords
                  </button>
                  <button
                    onClick={saveEntitiesDraft}
                    className="px-2.5 py-1 text-xs font-medium border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Save
                  </button>
                </div>
              </div>
              {entitySummary && (
                <p className="text-xs text-gray-600 mb-3">{entitySummary}</p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Mentioned</div>
                  <div className="flex flex-wrap gap-2">
                    {entitiesSuggested.length === 0 && <span className="text-xs text-gray-400">None detected yet.</span>}
                    {entitiesSuggested.map((e, idx) => (
                      <button
                        key={`s-${idx}`}
                        onClick={() => toggleAcceptEntity(e.name)}
                        className={`text-xs px-2 py-1 rounded border ${entitiesAccepted.includes(e.name) ? 'bg-green-50 border-green-200 text-green-800' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                        title={e.description || e.type}
                      >
                        {e.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Missing</div>
                  <div className="flex flex-wrap gap-2">
                    {entitiesMissing.length === 0 && <span className="text-xs text-gray-400">No gaps identified.</span>}
                    {entitiesMissing.map((e, idx) => (
                      <button
                        key={`m-${idx}`}
                        onClick={() => toggleAcceptEntity(e.name)}
                        className={`text-xs px-2 py-1 rounded border ${entitiesAccepted.includes(e.name) ? 'bg-yellow-50 border-yellow-200 text-yellow-800' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                        title={e.reasoning || e.type}
                      >
                        {e.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {showSchemaPanel && (
            <div ref={schemaPanelRef} className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 mt-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <h4 className="font-medium text-gray-900">Schema</h4>
                  {schemaValid === true && (<span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Valid</span>)}
                  {schemaValid === false && (<span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">Invalid</span>)}
                </div>
                <div className="flex items-center space-x-2">
                  <button onClick={generateSchema} className="px-2.5 py-1 text-xs font-medium border border-gray-300 rounded hover:bg-gray-50">Generate</button>
                  <button onClick={validateSchema} className="px-2.5 py-1 text-xs font-medium border border-gray-300 rounded hover:bg-gray-50">Validate</button>
                  <button onClick={() => { try { navigator.clipboard.writeText(schemaJson); onToast?.({ type: 'success', title: 'Copied', message: 'Schema JSON copied.' }); } catch {} }} className="px-2.5 py-1 text-xs font-medium border border-gray-300 rounded hover:bg-gray-50">Copy</button>
                  <button onClick={insertSchemaIntoDraft} className={`px-2.5 py-1 text-xs font-medium rounded ${schemaApplied ? 'bg-green-600 text-white' : 'bg-purple-600 text-white hover:bg-purple-700'}`}>{schemaApplied ? 'Inserted' : 'Insert Into Draft'}</button>
                </div>
              </div>
              {!!schemaIssues?.length && (
                <div className="mb-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
                  {schemaIssues.length} issue(s): {schemaIssues.map((i, idx) => i.message).join('; ')}
                </div>
              )}
              <textarea value={schemaJson} onChange={(e) => setSchemaJson(e.target.value)} rows={12} className="w-full border border-gray-200 rounded p-3 text-xs font-mono bg-gray-50" placeholder='{"@context":"https://schema.org","@type":"Article",...}' />
            </div>
          )}

          {showCitationsPanel && (
            <div ref={citationsPanelRef} className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 mt-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-900">Citations</h4>
                <div className="flex items-center space-x-2">
                  <label className="text-xs text-gray-600 flex items-center space-x-1">
                    <input type="checkbox" checked={relNofollowDefault} onChange={(e) => setRelNofollowDefault(e.target.checked)} />
                    <span>rel="nofollow"</span>
                  </label>
                  <button onClick={saveCitations} className="px-2.5 py-1 text-xs font-medium border border-gray-300 rounded hover:bg-gray-50">Save</button>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={citationSearchQuery}
                    onChange={(e)=> setCitationSearchQuery(e.target.value)}
                    placeholder="Find sources (e.g., 'Google Quality Rater Guidelines')"
                    className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
                  />
                  <button
                    onClick={async ()=>{
                      if (!citationSearchQuery.trim()) return;
                      setIsSearchingSources(true);
                      try {
                        const { results } = await apiService.searchSources(citationSearchQuery.trim());
                        setCitationSearchResults(results || []);
                      } catch(e) { console.warn('Search sources failed:', e); }
                      finally { setIsSearchingSources(false); }
                    }}
                    className="px-2.5 py-1 text-xs font-medium border border-gray-300 rounded hover:bg-gray-50"
                  >{isSearchingSources ? 'Searching…' : 'Search'}</button>
                </div>
                {citationSearchResults.length > 0 && (
                  <div className="border border-gray-200 rounded p-2 bg-gray-50">
                    <div className="text-xs text-gray-600 mb-1">Results</div>
                    <div className="space-y-1 max-h-40 overflow-auto">
                      {citationSearchResults.map((r, i)=> (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <div className="truncate pr-2">
                            <div className="font-medium text-gray-800 truncate">{r.title}</div>
                            <div className="text-gray-600 truncate">{r.url}</div>
                          </div>
                          <button
                            onClick={() => setCitations(prev => [...prev, { title: r.title, url: r.url, anchorText: r.title, used: false, relNofollow: relNofollowDefault }])}
                            className="px-2 py-0.5 border border-gray-300 rounded hover:bg-white"
                          >Add</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {citations.map((c, idx) => (
                  <div key={idx} className="p-2 border border-gray-200 rounded flex items-center space-x-2">
                    <input
                      type="text"
                      value={c.title}
                      onChange={(e) => setCitations(prev => prev.map((x, i) => i === idx ? { ...x, title: e.target.value } : x))}
                      placeholder="Title"
                      className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs"
                    />
                    <input
                      type="text"
                      value={c.url}
                      onChange={(e) => setCitations(prev => prev.map((x, i) => i === idx ? { ...x, url: e.target.value } : x))}
                      placeholder="https://example.com/article"
                      className="flex-[2] border border-gray-200 rounded px-2 py-1 text-xs"
                    />
                    <input
                      type="text"
                      value={c.anchorText || ''}
                      onChange={(e) => setCitations(prev => prev.map((x, i) => i === idx ? { ...x, anchorText: e.target.value } : x))}
                      placeholder="Anchor text in content"
                      className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs"
                    />
                    <label className="text-[11px] text-gray-600 flex items-center space-x-1">
                      <input type="checkbox" checked={c.relNofollow ?? relNofollowDefault} onChange={(e) => setCitations(prev => prev.map((x, i) => i === idx ? { ...x, relNofollow: e.target.checked } : x))} />
                      <span>nofollow</span>
                    </label>
                    <button
                      onClick={() => setCitations(prev => prev.filter((_, i) => i !== idx))}
                      className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50"
                    >Remove</button>
                  </div>
                ))}
                <div className="flex space-x-2">
                  <button
                    onClick={() => setCitations(prev => [...prev, { title: '', url: '', anchorText: '', used: false, relNofollow: relNofollowDefault }])}
                    className="px-2.5 py-1 text-xs font-medium border border-gray-300 rounded hover:bg-gray-50"
                  >Add source</button>
                  <button onClick={handleInsertAnchors} className="px-2.5 py-1 text-xs font-medium border border-gray-300 rounded hover:bg-gray-50">Insert anchors</button>
                  <button onClick={handleInsertReferences} className="px-2.5 py-1 text-xs font-medium border border-gray-300 rounded hover:bg-gray-50">Insert References block</button>
                </div>
              </div>
            </div>
          )}

          {/* Publish Impact panel */}
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 mt-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-900">Publish Impact</h4>
              <span className="text-xs text-gray-500">Last {recentImpacts.length || 0}</span>
            </div>
            {recentImpacts.length === 0 ? (
              <p className="text-xs text-gray-500">No recent publish checks yet. Publish to see schema validation and visibility changes.</p>
            ) : (
              <div className="space-y-2">
                {recentImpacts.map((it: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-600">{new Date(it.created_at).toLocaleString()}</span>
                      <span className={`px-1.5 py-0.5 rounded ${it.activity_data?.schemaValid ? 'bg-green-100 text-green-700' : (it.activity_data?.usedSchema === 'none' ? 'bg-gray-100 text-gray-700' : 'bg-red-100 text-red-700')}`}>
                        {it.activity_data?.usedSchema === 'none' ? 'Schema: none' : (it.activity_data?.schemaValid ? 'Schema: valid' : 'Schema: invalid')}
                      </span>
                      {typeof it.activity_data?.afterScore === 'number' && (
                        <span className="text-gray-700">Visibility: {it.activity_data.afterScore}{typeof it.activity_data?.delta === 'number' && it.activity_data.delta !== 0 ? (it.activity_data.delta > 0 ? ` (▲${it.activity_data.delta})` : ` (▼${Math.abs(it.activity_data.delta)})`) : ''}</span>
                      )}
                    </div>
                    {it.activity_data?.permalink && (
                      <a href={it.activity_data.permalink} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">View</a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
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
