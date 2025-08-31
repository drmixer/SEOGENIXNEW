import { supabase } from '../lib/supabase';

const API_BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

// Add error handling wrapper with dynamic authentication
const apiCall = async (url: string, options: RequestInit, authRequired: boolean = true) => {
  try {
    console.log(`Making API call to: ${url}`);
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Only add authentication if required
    if (authRequired) {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Session error:', sessionError);
        throw new Error('Failed to get user session');
      }
      
      if (!session?.access_token) {
        throw new Error('User not authenticated. Please log in to continue.');
      }
      
      headers['Authorization'] = `Bearer ${session.access_token}`;
    } else {
      headers['apikey'] = import.meta.env.VITE_SUPABASE_ANON_KEY;
    }
    
    const response = await fetch(url, {
      ...options,
      headers
    });
    
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
      console.error(`API Error (${response.status}):`, errorBody);
      
      // Handle different error response formats from edge functions
      let errorMessage = 'API request failed';
      
      if (errorBody.error) {
        if (typeof errorBody.error === 'string') {
          errorMessage = errorBody.error;
        } else if (errorBody.error.message) {
          errorMessage = errorBody.error.message;
        } else if (errorBody.error.details) {
          errorMessage = errorBody.error.details;
        }
      } else if (errorBody.message) {
        errorMessage = errorBody.message;
      } else {
        errorMessage = `${response.status} ${response.statusText}`;
      }
      
      throw new Error(errorMessage);
    }
    
    const data = await response.json();
    console.log(`API response from ${url}:`, data);
    
    // Handle different response formats from edge functions
    if (typeof data?.success !== 'undefined') {
      if (data.success === false) {
        throw new Error(data.error?.message || 'API returned error');
      }
      // success: true — normalize common payload keys
      // Prefer explicit payload properties, otherwise return the full object
      if (typeof data.data !== 'undefined') return data.data;
      if (typeof data.output !== 'undefined') return data.output;
      if (typeof data.result !== 'undefined') return data.result;
      return data;
    }
    
    // No success flag — return parsed body as-is
    return data;
  } catch (error) {
    console.error(`API call failed for ${url}:`, error);
    throw error;
  }
};

// Add request deduplication
const pendingApiRequests = new Map<string, Promise<any>>();

// Create a function to generate a cache key for API requests
const generateCacheKey = (url: string, body: any): string => {
  const bodyKey = body ? JSON.stringify(body) : '';
  return `${url}:${bodyKey}`;
};

export interface AuditResult {
  overallScore: number;
  subscores: {
    aiUnderstanding: number;
    citationLikelihood: number;
    conversationalReadiness: number;
    contentStructure: number;
  };
  recommendations: Array<{
    title: string;
    description: string;
    action_type?: string;
  }>;
  issues: Array<{
    title: string;
    description: string;
    category: string;
    priority: string;
    suggestion: string;
    learnMore: string;
  }>;
}

export interface Citation {
  source: string;
  url: string;
  snippet: string;
  date: string;
  type: 'llm' | 'google' | 'reddit' | 'news';
}

export const apiService = {
  // AI Visibility Audit
  async runAudit(projectId: string, url: string, content?: string): Promise<AuditResult> {
    const cacheKey = generateCacheKey(`${API_BASE_URL}/ai-visibility-audit`, { projectId, url, content });
    
    if (pendingApiRequests.has(cacheKey)) {
      console.log('Audit request already in progress, returning existing promise');
      return pendingApiRequests.get(cacheKey);
    }
    
    const auditPromise = apiCall(`${API_BASE_URL}/ai-visibility-audit`, {
      method: 'POST',
      body: JSON.stringify({ projectId, url, content })
    }).then(response => {
      // Handle the response structure correctly - some functions return { output: ... }
      if (response.output) {
        return response.output;
      }
      return response;
    });
    
    pendingApiRequests.set(cacheKey, auditPromise);
    
    auditPromise.finally(() => {
      pendingApiRequests.delete(cacheKey);
    });
    
    return auditPromise;
  },

  // Source search (for Citations)
  async searchSources(query: string): Promise<{ results: Array<{ title: string; url: string; snippet?: string }> }> {
    const result = await apiCall(`${API_BASE_URL}/search-sources`, {
      method: 'POST',
      body: JSON.stringify({ query })
    }, false); // no auth required
    return result.data || result.output || result;
  },

  // Enhanced Audit Insights
  async getEnhancedAuditInsights(url: string, content: string, previousScore?: number) {
    const cacheKey = generateCacheKey(`${API_BASE_URL}/enhanced-audit-insights`, { url, content, previousScore });
    
    if (pendingApiRequests.has(cacheKey)) {
      console.log('Enhanced audit insights request already in progress, returning existing promise');
      return pendingApiRequests.get(cacheKey);
    }
    
    const insightsPromise = apiCall(`${API_BASE_URL}/enhanced-audit-insights`, {
      method: 'POST',
      body: JSON.stringify({ url, content, previousScore })
    }).then(response => {
      if (response.output) {
        return response.output;
      }
      return response;
    });
    
    pendingApiRequests.set(cacheKey, insightsPromise);
    
    insightsPromise.finally(() => {
      pendingApiRequests.delete(cacheKey);
    });
    
    return insightsPromise;
  },

  // Schema Generator
  async generateSchema(projectId: string, url: string, contentType: string, content?: string, acceptedEntities?: string[], siteName?: string) {
    const cacheKey = generateCacheKey(`${API_BASE_URL}/schema-generator`, { projectId, url, contentType, content, siteName });
    
    if (pendingApiRequests.has(cacheKey)) {
      console.log('Schema generator request already in progress, returning existing promise');
      return pendingApiRequests.get(cacheKey);
    }
    
    const schemaPromise = apiCall(`${API_BASE_URL}/schema-generator`, {
      method: 'POST',
      body: JSON.stringify({ projectId, url, contentType, content, acceptedEntities, siteName })
    }).then(response => {
      // Handle the response structure correctly
      if (response.output) {
        return response.output;
      }
      return response;
    });
    
    pendingApiRequests.set(cacheKey, schemaPromise);
    
    schemaPromise.finally(() => {
      pendingApiRequests.delete(cacheKey);
    });
    
    return schemaPromise;
  },

  async validateSchema(schema: object | string): Promise<{ valid: boolean; issues: Array<{ path?: string; message: string }> }> {
    const result = await apiCall(`${API_BASE_URL}/schema-validator`, {
      method: 'POST',
      body: JSON.stringify({ schema })
    });
    return result.output || result.data || result;
  },

  async batchValidateSchemas(projectId: string, urls?: string[]): Promise<{ results: Array<{ url: string; valid: boolean; issues: any[] }> }> {
    const result = await apiCall(`${API_BASE_URL}/schema-batch-validator`, {
      method: 'POST',
      body: JSON.stringify({ projectId, urls })
    });
    return result.data || result.output || result;
  },

  // Publish AI Sitemap to CMS
  async publishAISitemapToCMS(cmsType: 'wordpress' | 'shopify', params: { projectId: string; publicUrl: string; embeddedContent?: string }) {
    const endpoint = cmsType === 'wordpress' ? 'wordpress-integration' : 'shopify-integration';
    return await apiCall(`${API_BASE_URL}/${endpoint}`, {
      method: 'POST',
      body: JSON.stringify({ action: 'publish_ai_sitemap', ...params })
    });
  },

  // Citation Tracker
  async trackCitations(projectId: string, domain: string, keywords: string[], fingerprintPhrases?: string[]) {
    const cacheKey = generateCacheKey(`${API_BASE_URL}/citation-tracker`, { projectId, domain, keywords, fingerprintPhrases });
    
    if (pendingApiRequests.has(cacheKey)) {
      console.log('Citation tracker request already in progress, returning existing promise');
      return pendingApiRequests.get(cacheKey);
    }
    
    const citationsPromise = apiCall(`${API_BASE_URL}/citation-tracker`, {
      method: 'POST',
      body: JSON.stringify({ projectId, domain, keywords, fingerprintPhrases })
    }).then(response => {
      if (response.output) {
        return response.output;
      }
      return response;
    });
    
    pendingApiRequests.set(cacheKey, citationsPromise);
    
    citationsPromise.finally(() => {
      pendingApiRequests.delete(cacheKey);
    });
    
    return citationsPromise;
  },

  // Content Optimizer
  async optimizeContent(projectId: string, content: string, targetKeywords: string[], contentType: string) {
    const cacheKey = generateCacheKey(`${API_BASE_URL}/content-optimizer`, { projectId, content, targetKeywords, contentType });
    
    if (pendingApiRequests.has(cacheKey)) {
      console.log('Content optimizer request already in progress, returning existing promise');
      return pendingApiRequests.get(cacheKey);
    }
    
    const optimizePromise = apiCall(`${API_BASE_URL}/content-optimizer`, {
      method: 'POST',
      body: JSON.stringify({ projectId, content, targetKeywords, contentType })
    }).then(response => {
      // Normalize to return the actual data payload directly
      if (response?.output) return response.output;
      if (response?.data) return response.data;
      return response;
    });
    
    pendingApiRequests.set(cacheKey, optimizePromise);
    
    optimizePromise.finally(() => {
      pendingApiRequests.delete(cacheKey);
    });
    
    return optimizePromise;
  },



  // AI Sitemap
  async generateAISitemap(projectId: string, urls?: string[], fetchContent: boolean = false): Promise<any> {
    const result = await apiCall(`${API_BASE_URL}/ai-sitemap`, {
      method: 'POST',
      body: JSON.stringify({ projectId, urls, fetch: fetchContent })
    });
    return result?.data || result?.output || result;
  },

  // Genie Chatbot (Enhanced with user data)
  async chatWithGenie(
    message: string, 
    context: 'landing' | 'dashboard', 
    userPlan?: string,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
    userData?: any
  ) {
    const authRequired = context === 'dashboard';
    
    const response = await apiCall(`${API_BASE_URL}/genie-chatbot`, {
      method: 'POST',
      body: JSON.stringify({ message, context, userPlan, conversationHistory, userData })
    }, authRequired);
    
    // Handle the response structure correctly
    if (response.data) {
      return response.data;
    }
    return response;
  },

  // LLM Site Summaries
  async generateLLMSummary(projectId: string, url: string, summaryType: 'overview' | 'technical' | 'business' | 'audience', content?: string) {
    const cacheKey = generateCacheKey(`${API_BASE_URL}/llm-site-summaries`, { projectId, url, summaryType, content });
    
    if (pendingApiRequests.has(cacheKey)) {
      console.log('LLM summary request already in progress, returning existing promise');
      return pendingApiRequests.get(cacheKey);
    }
    
    const summaryPromise = apiCall(`${API_BASE_URL}/llm-site-summaries`, {
      method: 'POST',
      body: JSON.stringify({ projectId, url, summaryType, content })
    });
    
    pendingApiRequests.set(cacheKey, summaryPromise);
    
    summaryPromise.finally(() => {
      pendingApiRequests.delete(cacheKey);
    });
    
    return summaryPromise;
  },

  // Entity Coverage Analyzer
  async analyzeEntityCoverage(projectId: string, url: string, content?: string, industry?: string, competitors?: string[]) {
    const cacheKey = generateCacheKey(`${API_BASE_URL}/entity-coverage-analyzer`, { projectId, url, content, industry, competitors });
    
    if (pendingApiRequests.has(cacheKey)) {
      console.log('Entity coverage analysis request already in progress, returning existing promise');
      return pendingApiRequests.get(cacheKey);
    }
    
    const entityPromise = apiCall(`${API_BASE_URL}/entity-coverage-analyzer`, {
      method: 'POST',
      body: JSON.stringify({ projectId, url, content, industry, competitors })
    }).then(response => {
      if (response.output) {
        return response.output;
      }
      return response;
    });
    
    pendingApiRequests.set(cacheKey, entityPromise);
    
    entityPromise.finally(() => {
      pendingApiRequests.delete(cacheKey);
    });
    
    return entityPromise;
  },

  // AI Content Generator - FIXED
  async generateAIContent(
    projectId: string,
    contentType: 'faq' | 'meta-tags' | 'snippets' | 'headings' | 'descriptions',
    topic: string,
    targetKeywords: string[],
    tone?: 'professional' | 'casual' | 'technical' | 'friendly',
    industry?: string,
    targetAudience?: string,
    contentLength?: 'short' | 'medium' | 'long'
  ) {
    const cacheKey = generateCacheKey(`${API_BASE_URL}/ai-content-generator`, { 
      projectId, contentType, topic, targetKeywords, tone, industry, targetAudience, contentLength
    });
    
    if (pendingApiRequests.has(cacheKey)) {
      console.log('AI content generator request already in progress, returning existing promise');
      return pendingApiRequests.get(cacheKey);
    }
    
    // Ensure targetKeywords is always an array
    const keywordsArray = Array.isArray(targetKeywords) ? targetKeywords : [targetKeywords];
    
    const contentPromise = apiCall(`${API_BASE_URL}/ai-content-generator`, {
      method: 'POST',
      body: JSON.stringify({ 
        projectId,
        contentType, 
        topic, 
        targetKeywords: keywordsArray, 
        tone: tone || 'professional', 
        industry, 
        targetAudience, 
        contentLength: contentLength || 'medium'
      })
    }).then(response => {
      console.log('AI Content Generator Response:', response);
      return response;
    }).catch(error => {
      console.error('AI Content Generator Error:', error);
      throw error;
    });
    
    pendingApiRequests.set(cacheKey, contentPromise);
    
    contentPromise.finally(() => {
      pendingApiRequests.delete(cacheKey);
    });
    
    return contentPromise;
  },

  // Prompt Match Suggestions
  async generatePromptSuggestions(
    projectId: string,
    topic: string,
    industry?: string,
    targetAudience?: string,
    contentType?: 'article' | 'product' | 'service' | 'faq' | 'guide',
    userIntent?: 'informational' | 'transactional' | 'navigational' | 'commercial'
  ) {
    const cacheKey = generateCacheKey(`${API_BASE_URL}/prompt-match-suggestions`, { 
      projectId, topic, industry, targetAudience, contentType, userIntent
    });
    
    if (pendingApiRequests.has(cacheKey)) {
      console.log('Prompt suggestions request already in progress, returning existing promise');
      return pendingApiRequests.get(cacheKey);
    }
    
    const promptsPromise = apiCall(`${API_BASE_URL}/prompt-match-suggestions`, {
      method: 'POST',
      body: JSON.stringify({ projectId, topic, industry, targetAudience, contentType, userIntent })
    }).then(response => {
      if (response.output) {
        return response.output;
      }
      return response;
    });
    
    pendingApiRequests.set(cacheKey, promptsPromise);
    
    promptsPromise.finally(() => {
      pendingApiRequests.delete(cacheKey);
    });
    
    return promptsPromise;
  },

  // Competitive Analysis
  async performCompetitiveAnalysis(
    projectId: string,
    primaryUrl: string,
    competitorUrls: string[],
    industry?: string,
    analysisType?: 'basic' | 'detailed' | 'comprehensive'
  ) {
    const cacheKey = generateCacheKey(`${API_BASE_URL}/competitive-analysis`, { 
      projectId, primaryUrl, competitorUrls, industry, analysisType
    });
    
    if (pendingApiRequests.has(cacheKey)) {
      console.log('Competitive analysis request already in progress, returning existing promise');
      return pendingApiRequests.get(cacheKey);
    }
    
    const analysisPromise = apiCall(`${API_BASE_URL}/competitive-analysis`, {
      method: 'POST',
      body: JSON.stringify({ projectId, primaryUrl, competitorUrls, industry, analysisType })
    }).then(response => {
      // Normalize common envelopes: {success,data|output|result}
      if (response?.data) return response.data;
      if (response?.output) return response.output;
      if (response?.result) return response.result;
      return response;
    });
    
    pendingApiRequests.set(cacheKey, analysisPromise);
    
    analysisPromise.finally(() => {
      pendingApiRequests.delete(cacheKey);
    });
    
    return analysisPromise;
  },

  // Competitor Discovery
  async discoverCompetitors(
    projectId: string,
    url: string,
    industry?: string,
    businessDescription?: string,
    existingCompetitors?: string[],
    analysisDepth?: 'basic' | 'comprehensive',
    options?: { preferNiche?: boolean; hintKeywords?: string[]; blocklist?: string[] }
  ) {
    const cacheKey = generateCacheKey(`${API_BASE_URL}/competitor-discovery`, { 
      projectId, url, industry, businessDescription, existingCompetitors, analysisDepth, options
    });
    
    if (pendingApiRequests.has(cacheKey)) {
      console.log('Competitor discovery request already in progress, returning existing promise');
      return pendingApiRequests.get(cacheKey);
    }
    
    const discoveryPromise = apiCall(`${API_BASE_URL}/competitor-discovery`, {
      method: 'POST',
      body: JSON.stringify({ projectId, url, industry, businessDescription, existingCompetitors, analysisDepth, options })
    }).then(response => {
      if (response?.data) return response.data;
      if (response?.output) return response.output;
      if (response?.result) return response.result;
      if (response?.results) return response.results;
      if (response?.competitors) return response.competitors;
      return response;
    });
    
    pendingApiRequests.set(cacheKey, discoveryPromise);
    
    discoveryPromise.finally(() => {
      pendingApiRequests.delete(cacheKey);
    });
    
    return discoveryPromise;
  },

  // Domain Rules (Allow/Block) manager for Competitor Discovery
  async getDomainRules(projectId: string) {
    const result = await apiCall(`${API_BASE_URL}/competitor-discovery?action=rules&projectId=${encodeURIComponent(projectId)}` , { method: 'GET' });
    return result.data?.rules || result.rules || result;
  },
  async addDomainRule(projectId: string, type: 'allow' | 'block', pattern: string, reason?: string) {
    const result = await apiCall(`${API_BASE_URL}/competitor-discovery?action=add_rule`, {
      method: 'POST',
      body: JSON.stringify({ projectId, type, pattern, reason })
    });
    return result.data?.rule || result.rule || result;
  },
  async deleteDomainRule(projectId: string, id: string) {
    const result = await apiCall(`${API_BASE_URL}/competitor-discovery?action=delete_rule`, {
      method: 'DELETE',
      body: JSON.stringify({ id, projectId })
    });
    return result.data || result;
  },

  // Real-time Content Analysis
  async analyzeContentRealTime(projectId: string, content: string, keywords: string[]) {
    const cacheKey = generateCacheKey(`${API_BASE_URL}/real-time-content-analysis`, { projectId, content, keywords });
    
    if (pendingApiRequests.has(cacheKey)) {
      console.log('Real-time analysis request already in progress, returning existing promise');
      return pendingApiRequests.get(cacheKey);
    }
    
    const analysisPromise = apiCall(`${API_BASE_URL}/real-time-content-analysis`, {
      method: 'POST',
      body: JSON.stringify({ projectId, content, keywords })
    });
    
    pendingApiRequests.set(cacheKey, analysisPromise);
    
    analysisPromise.finally(() => {
      pendingApiRequests.delete(cacheKey);
    });
    
    return analysisPromise;
  },

  // Report Generator
  async generateReport(
    reportType: 'audit' | 'competitive' | 'citation' | 'comprehensive' | 'roi_focused',
    reportData: any,
    reportName: string,
    format: 'html' | 'csv' | 'json' = 'html'
  ) {
    return await apiCall(`${API_BASE_URL}/generate-report`, {
      method: 'POST',
      body: JSON.stringify({ reportType, reportData, reportName, format })
    });
  },

  // CMS Integrations
  async connectWordPress(siteUrl: string, username: string, applicationPassword: string) {
    return await apiCall(`${API_BASE_URL}/wordpress-integration`, {
      method: 'POST',
      body: JSON.stringify({ 
        action: 'connect', 
        siteUrl, 
        username, 
        applicationPassword 
      })
    });
  },

  async publishToWordPress(content: {
    title: string;
    content: string;
    excerpt?: string;
    status?: 'draft' | 'publish';
    categories?: string[];
    tags?: string[];
    autoGenerateSchema?: boolean;
    // Prefer inserted schema on server if present
    projectId?: string;
    pageUrl?: string;
    useInsertedSchema?: boolean;
  }) {
    return await apiCall(`${API_BASE_URL}/wordpress-integration`, {
      method: 'POST',
      body: JSON.stringify({
        action: 'publish',
        ...content
      })
    });
  },

  async connectShopify(shopDomain: string, accessToken: string) {
    return await apiCall(`${API_BASE_URL}/shopify-integration`, {
      method: 'POST',
      body: JSON.stringify({ 
        action: 'connect', 
        shopDomain, 
        accessToken 
      })
    });
  },

  async publishToShopify(payload: {
    product: {
      title: string;
      body_html: string;
      vendor?: string;
      product_type?: string;
      tags?: string;
      variants?: Array<{
        price: string;
        inventory_quantity?: number;
      }>;
    };
    autoGenerateSchema?: boolean;
    projectId?: string;
    pageUrl?: string;
    useInsertedSchema?: boolean;
  }) {
    return await apiCall(`${API_BASE_URL}/shopify-integration`, {
      method: 'POST',
      body: JSON.stringify({
        action: 'publish',
        ...payload
      })
    });
  },

  async syncCMSData(cmsType: 'wordpress' | 'shopify') {
    const endpoint = cmsType === 'wordpress' ? 'wordpress-integration' : 'shopify-integration';
    return await apiCall(`${API_BASE_URL}/${endpoint}`, {
      method: 'POST',
      body: JSON.stringify({ action: 'sync' })
    });
  },

  async disconnectCMS(cmsType: 'wordpress' | 'shopify') {
    const endpoint = cmsType === 'wordpress' ? 'wordpress-integration' : 'shopify-integration';
    return await apiCall(`${API_BASE_URL}/${endpoint}`, {
      method: 'POST',
      body: JSON.stringify({ action: 'disconnect' })
    });
  },

  async getCMSContentList(cmsType: 'wordpress' | 'shopify', options: { page?: number, search?: string }) {
    const endpoint = cmsType === 'wordpress' ? 'wordpress-integration' : 'shopify-integration';
    const action = cmsType === 'wordpress' ? 'get_posts' : 'get_products';
    const result = await apiCall(`${API_BASE_URL}/${endpoint}`, {
        method: 'POST',
        body: JSON.stringify({
            action,
            ...options
        })
    });
    // Normalized apiCall returns the output payload directly
    return result?.items ? result.items : result;
  },

  async getCMSContentItem(cmsType: 'wordpress' | 'shopify', itemId: number | string) {
      const endpoint = cmsType === 'wordpress' ? 'wordpress-integration' : 'shopify-integration';
      const idKey = cmsType === 'wordpress' ? 'postId' : 'productId';
      const result = await apiCall(`${API_BASE_URL}/${endpoint}`, {
          method: 'POST',
          body: JSON.stringify({
              action: 'get_content',
              [idKey]: itemId
          })
      });
      // Normalized apiCall returns the output payload directly
      return result;
  },

  async updateCMSContentItem(
    cmsType: 'wordpress' | 'shopify',
    itemId: number | string,
    content: { title?: string; content: string },
    options?: { autoGenerateSchema?: boolean; projectId?: string; pageUrl?: string; useInsertedSchema?: boolean }
  ) {
      const endpoint = cmsType === 'wordpress' ? 'wordpress-integration' : 'shopify-integration';
      const idKey = cmsType === 'wordpress' ? 'postId' : 'productId';

      return await apiCall(`${API_BASE_URL}/${endpoint}`, {
          method: 'POST',
          body: JSON.stringify({
              action: 'update_content',
              [idKey]: itemId,
              // For Shopify, wrap content under product; for WordPress, send top-level title/content
              ...(cmsType === 'shopify' 
                ? { content: { product: { id: itemId, body_html: content.content } } }
                : { title: content.title, content: content.content }
              ),
              // Allow auto-schema and inserted-schema usage on update
              autoGenerateSchema: options?.autoGenerateSchema,
              projectId: options?.projectId,
              pageUrl: options?.pageUrl,
              useInsertedSchema: options?.useInsertedSchema
          })
      });
  },
  
  clearPendingRequests() {
    pendingApiRequests.clear();
    console.log('Cleared all pending API requests');
  },

  async fetchUrlContent(url: string): Promise<{ content: string }> {
    // Use authenticated call to satisfy functions that require JWT
    const result = await apiCall(`${API_BASE_URL}/url-fetcher`, {
      method: 'POST',
      body: JSON.stringify({ url })
    }, true);
    return result.data || result;
  },

  async fetchUrlContentPrerender(url: string): Promise<{ content: string }> {
    // Prerender/extracted text via edge function (no auth required)
    const result = await apiCall(`${API_BASE_URL}/prerender-fetch`, {
      method: 'POST',
      body: JSON.stringify({ url })
    }, false);
    return result.data || result;
  },

  async generateAdaptivePlaybook(userId: string, goal: string, focusArea: string) {
    const result = await apiCall(`${API_BASE_URL}/adaptive-playbook-generator`, {
      method: 'POST',
      body: JSON.stringify({ userId, goal, focusArea })
    });
    return result.data || result;
  },

  async getConnectedIntegrations(): Promise<Array<{ id: string; cms_type: 'wordpress' | 'shopify'; cms_name: string; site_url: string }>> {
    const result = await apiCall(`${API_BASE_URL}/get-integrations`, {
      method: 'GET',
    });
    // Normalize possible shapes:
    // - [{...}] (already array)
    // - { integrations: [...] }
    // - { success: true, integrations: [...] }
    // - { success: true, data: { integrations: [...] } }
    if (Array.isArray(result)) return result;
    if (Array.isArray(result?.integrations)) return result.integrations;
    if (Array.isArray(result?.data?.integrations)) return result.data.integrations;
    return [];
  }
};
