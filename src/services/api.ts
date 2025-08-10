import { supabase } from '../lib/supabase';

const API_BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

// Add error handling wrapper with dynamic authentication
const apiCall = async (url: string, options: RequestInit, authRequired: boolean = true) => {
  try {
    console.log(`Making API call to: ${url}`);
    
    const headers = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {})
    };

    // Only add authentication if required
    if (authRequired) {
      // Get current user session for authentication
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Session error:', sessionError);
        throw new Error('Failed to get user session');
      }
      
      if (!session?.access_token) {
        throw new Error('User not authenticated. Please log in to continue.');
      }
      
      // Add user's access token to headers
      headers['Authorization'] = `Bearer ${session.access_token}`;
    } else {
      // For unauthenticated calls, use the anon key
      headers['Authorization'] = `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`;
    }
    
    const response = await fetch(url, {
      ...options,
      headers
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error (${response.status}):`, errorText);
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`API response from ${url}:`, data);
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
  recommendations: string[];
  issues: string[];
}

export interface Citation {
  source: string;
  url: string;
  snippet: string;
  date: string;
  type: 'llm' | 'google' | 'reddit' | 'news';
}

export interface VoiceTestResult {
  assistant: string;
  query: string;
  response: string;
  mentioned: boolean;
  ranking: number;
  confidence: number;
}

export const apiService = {
  // AI Visibility Audit
  async runAudit(url: string, content?: string): Promise<AuditResult> {
    const cacheKey = generateCacheKey(`${API_BASE_URL}/ai-visibility-audit`, { url, content });
    
    if (pendingApiRequests.has(cacheKey)) {
      console.log('Audit request already in progress, returning existing promise');
      return pendingApiRequests.get(cacheKey);
    }
    
    const auditPromise = apiCall(`${API_BASE_URL}/ai-visibility-audit`, {
      method: 'POST',
      body: JSON.stringify({ url, content })
    });
    
    pendingApiRequests.set(cacheKey, auditPromise);
    
    auditPromise.finally(() => {
      pendingApiRequests.delete(cacheKey);
    });
    
    return auditPromise;
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
    });
    
    pendingApiRequests.set(cacheKey, insightsPromise);
    
    insightsPromise.finally(() => {
      pendingApiRequests.delete(cacheKey);
    });
    
    return insightsPromise;
  },

  // Schema Generator
  async generateSchema(url: string, contentType: string, content?: string) {
    const cacheKey = generateCacheKey(`${API_BASE_URL}/schema-generator`, { url, contentType, content });
    
    if (pendingApiRequests.has(cacheKey)) {
      console.log('Schema generator request already in progress, returning existing promise');
      return pendingApiRequests.get(cacheKey);
    }
    
    const schemaPromise = apiCall(`${API_BASE_URL}/schema-generator`, {
      method: 'POST',
      body: JSON.stringify({ url, contentType, content })
    });
    
    pendingApiRequests.set(cacheKey, schemaPromise);
    
    schemaPromise.finally(() => {
      pendingApiRequests.delete(cacheKey);
    });
    
    return schemaPromise;
  },

  // Citation Tracker
  async trackCitations(domain: string, keywords: string[], fingerprintPhrases?: string[]) {
    const cacheKey = generateCacheKey(`${API_BASE_URL}/citation-tracker`, { domain, keywords, fingerprintPhrases });
    
    if (pendingApiRequests.has(cacheKey)) {
      console.log('Citation tracker request already in progress, returning existing promise');
      return pendingApiRequests.get(cacheKey);
    }
    
    const citationsPromise = apiCall(`${API_BASE_URL}/citation-tracker`, {
      method: 'POST',
      body: JSON.stringify({ domain, keywords, fingerprintPhrases })
    });
    
    pendingApiRequests.set(cacheKey, citationsPromise);
    
    citationsPromise.finally(() => {
      pendingApiRequests.delete(cacheKey);
    });
    
    return citationsPromise;
  },

  // Content Optimizer
  async optimizeContent(content: string, targetKeywords: string[], contentType: string) {
    const cacheKey = generateCacheKey(`${API_BASE_URL}/content-optimizer`, { content, targetKeywords, contentType });
    
    if (pendingApiRequests.has(cacheKey)) {
      console.log('Content optimizer request already in progress, returning existing promise');
      return pendingApiRequests.get(cacheKey);
    }
    
    const optimizePromise = apiCall(`${API_BASE_URL}/content-optimizer`, {
      method: 'POST',
      body: JSON.stringify({ content, targetKeywords, contentType })
    });
    
    pendingApiRequests.set(cacheKey, optimizePromise);
    
    optimizePromise.finally(() => {
      pendingApiRequests.delete(cacheKey);
    });
    
    return optimizePromise;
  },

  // Voice Assistant Tester
  async testVoiceAssistants(query: string, assistants: string[]): Promise<{ results: VoiceTestResult[] }> {
    const cacheKey = generateCacheKey(`${API_BASE_URL}/voice-assistant-tester`, { query, assistants });
    
    if (pendingApiRequests.has(cacheKey)) {
      console.log('Voice assistant test request already in progress, returning existing promise');
      return pendingApiRequests.get(cacheKey);
    }
    
    const voicePromise = apiCall(`${API_BASE_URL}/voice-assistant-tester`, {
      method: 'POST',
      body: JSON.stringify({ query, assistants })
    });
    
    pendingApiRequests.set(cacheKey, voicePromise);
    
    voicePromise.finally(() => {
      pendingApiRequests.delete(cacheKey);
    });
    
    return voicePromise;
  },

  // Genie Chatbot (Enhanced with user data)
  async chatWithGenie(
    message: string, 
    context: 'landing' | 'dashboard', 
    userPlan?: string,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
    userData?: any
  ) {
    // Don't cache chat requests as they should always be unique
    // Don't require authentication for landing page context
    const authRequired = context !== 'landing';
    
    return await apiCall(`${API_BASE_URL}/genie-chatbot`, {
      method: 'POST',
      body: JSON.stringify({ message, context, userPlan, conversationHistory, userData })
    }, authRequired);
  },

  // LLM Site Summaries
  async generateLLMSummary(url: string, summaryType: 'overview' | 'technical' | 'business' | 'audience', content?: string) {
    const cacheKey = generateCacheKey(`${API_BASE_URL}/llm-site-summaries`, { url, summaryType, content });
    
    if (pendingApiRequests.has(cacheKey)) {
      console.log('LLM summary request already in progress, returning existing promise');
      return pendingApiRequests.get(cacheKey);
    }
    
    const summaryPromise = apiCall(`${API_BASE_URL}/llm-site-summaries`, {
      method: 'POST',
      body: JSON.stringify({ url, summaryType, content })
    });
    
    pendingApiRequests.set(cacheKey, summaryPromise);
    
    summaryPromise.finally(() => {
      pendingApiRequests.delete(cacheKey);
    });
    
    return summaryPromise;
  },

  // Entity Coverage Analyzer
  async analyzeEntityCoverage(url: string, content?: string, industry?: string, competitors?: string[]) {
    const cacheKey = generateCacheKey(`${API_BASE_URL}/entity-coverage-analyzer`, { url, content, industry, competitors });
    
    if (pendingApiRequests.has(cacheKey)) {
      console.log('Entity coverage analysis request already in progress, returning existing promise');
      return pendingApiRequests.get(cacheKey);
    }
    
    const entityPromise = apiCall(`${API_BASE_URL}/entity-coverage-analyzer`, {
      method: 'POST',
      body: JSON.stringify({ url, content, industry, competitors })
    });
    
    pendingApiRequests.set(cacheKey, entityPromise);
    
    entityPromise.finally(() => {
      pendingApiRequests.delete(cacheKey);
    });
    
    return entityPromise;
  },

  // AI Content Generator
  async generateAIContent(
    contentType: 'faq' | 'meta-tags' | 'snippets' | 'headings' | 'descriptions',
    topic: string,
    targetKeywords: string[],
    tone?: 'professional' | 'casual' | 'technical' | 'friendly',
    industry?: string,
    targetAudience?: string,
    contentLength?: 'short' | 'medium' | 'long'
  ) {
    const cacheKey = generateCacheKey(`${API_BASE_URL}/ai-content-generator`, { 
      contentType, topic, targetKeywords, tone, industry, targetAudience, contentLength 
    });
    
    if (pendingApiRequests.has(cacheKey)) {
      console.log('AI content generator request already in progress, returning existing promise');
      return pendingApiRequests.get(cacheKey);
    }
    
    const contentPromise = apiCall(`${API_BASE_URL}/ai-content-generator`, {
      method: 'POST',
      body: JSON.stringify({ 
        contentType, 
        topic, 
        targetKeywords, 
        tone, 
        industry, 
        targetAudience, 
        contentLength 
      })
    });
    
    pendingApiRequests.set(cacheKey, contentPromise);
    
    contentPromise.finally(() => {
      pendingApiRequests.delete(cacheKey);
    });
    
    return contentPromise;
  },

  // Prompt Match Suggestions
  async generatePromptSuggestions(
    topic: string,
    industry?: string,
    targetAudience?: string,
    contentType?: 'article' | 'product' | 'service' | 'faq' | 'guide',
    userIntent?: 'informational' | 'transactional' | 'navigational' | 'commercial'
  ) {
    const cacheKey = generateCacheKey(`${API_BASE_URL}/prompt-match-suggestions`, { 
      topic, industry, targetAudience, contentType, userIntent 
    });
    
    if (pendingApiRequests.has(cacheKey)) {
      console.log('Prompt suggestions request already in progress, returning existing promise');
      return pendingApiRequests.get(cacheKey);
    }
    
    const promptsPromise = apiCall(`${API_BASE_URL}/prompt-match-suggestions`, {
      method: 'POST',
      body: JSON.stringify({ topic, industry, targetAudience, contentType, userIntent })
    });
    
    pendingApiRequests.set(cacheKey, promptsPromise);
    
    promptsPromise.finally(() => {
      pendingApiRequests.delete(cacheKey);
    });
    
    return promptsPromise;
  },

  // Competitive Analysis
  async performCompetitiveAnalysis(
    primaryUrl: string,
    competitorUrls: string[],
    industry?: string,
    analysisType?: 'basic' | 'detailed' | 'comprehensive'
  ) {
    const cacheKey = generateCacheKey(`${API_BASE_URL}/competitive-analysis`, { 
      primaryUrl, competitorUrls, industry, analysisType 
    });
    
    if (pendingApiRequests.has(cacheKey)) {
      console.log('Competitive analysis request already in progress, returning existing promise');
      return pendingApiRequests.get(cacheKey);
    }
    
    const analysisPromise = apiCall(`${API_BASE_URL}/competitive-analysis`, {
      method: 'POST',
      body: JSON.stringify({ primaryUrl, competitorUrls, industry, analysisType })
    });
    
    pendingApiRequests.set(cacheKey, analysisPromise);
    
    analysisPromise.finally(() => {
      pendingApiRequests.delete(cacheKey);
    });
    
    return analysisPromise;
  },

  // Competitor Discovery
  async discoverCompetitors(
    url: string,
    industry?: string,
    businessDescription?: string,
    existingCompetitors?: string[],
    analysisDepth?: 'basic' | 'comprehensive'
  ) {
    const cacheKey = generateCacheKey(`${API_BASE_URL}/competitor-discovery`, { 
      url, industry, businessDescription, existingCompetitors, analysisDepth 
    });
    
    if (pendingApiRequests.has(cacheKey)) {
      console.log('Competitor discovery request already in progress, returning existing promise');
      return pendingApiRequests.get(cacheKey);
    }
    
    const discoveryPromise = apiCall(`${API_BASE_URL}/competitor-discovery`, {
      method: 'POST',
      body: JSON.stringify({ url, industry, businessDescription, existingCompetitors, analysisDepth })
    });
    
    pendingApiRequests.set(cacheKey, discoveryPromise);
    
    discoveryPromise.finally(() => {
      pendingApiRequests.delete(cacheKey);
    });
    
    return discoveryPromise;
  },

  // Real-time Content Analysis
  async analyzeContentRealTime(content: string, keywords: string[]) {
    const cacheKey = generateCacheKey(`${API_BASE_URL}/real-time-content-analysis`, { content, keywords });
    
    if (pendingApiRequests.has(cacheKey)) {
      console.log('Real-time analysis request already in progress, returning existing promise');
      return pendingApiRequests.get(cacheKey);
    }
    
    const analysisPromise = apiCall(`${API_BASE_URL}/real-time-content-analysis`, {
      method: 'POST',
      body: JSON.stringify({ content, keywords })
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
    // Don't cache report generation as each report should be unique
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
  }) {
    return await apiCall(`${API_BASE_URL}/wordpress-integration`, {
      method: 'POST',
      body: JSON.stringify({ 
        action: 'publish', 
        content 
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

  async publishToShopify(product: {
    title: string;
    body_html: string;
    vendor?: string;
    product_type?: string;
    tags?: string;
    variants?: Array<{
      price: string;
      inventory_quantity?: number;
    }>;
  }) {
    return await apiCall(`${API_BASE_URL}/shopify-integration`, {
      method: 'POST',
      body: JSON.stringify({ 
        action: 'publish', 
        product 
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
  
  // Clear pending requests cache
  clearPendingRequests() {
    pendingApiRequests.clear();
    console.log('Cleared all pending API requests');
  },

  // URL Content Fetcher
  async fetchUrlContent(url: string): Promise<{ content: string }> {
    // This is a utility function, so we don't cache it.
    // It does not require authentication to run.
    const result = await apiCall(`${API_BASE_URL}/url-fetcher`, {
      method: 'POST',
      body: JSON.stringify({ url })
    }, false); // authRequired = false
    return result.data;
  },

  // Adaptive Playbook Generator
  async generateAdaptivePlaybook(userId: string, goal: string, focusArea: string) {
    const result = await apiCall(`${API_BASE_URL}/adaptive-playbook-generator`, {
      method: 'POST',
      body: JSON.stringify({ userId, goal, focusArea })
    });
    return result.data;
  }
};