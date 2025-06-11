const API_BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

const headers = {
  'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

// Add error handling wrapper
const apiCall = async (url: string, options: RequestInit) => {
  try {
    console.log(`Making API call to: ${url}`);
    const response = await fetch(url, options);
    
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
    return await apiCall(`${API_BASE_URL}/ai-visibility-audit`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ url, content })
    });
  },

  // Enhanced Audit Insights
  async getEnhancedAuditInsights(url: string, content: string, previousScore?: number) {
    return await apiCall(`${API_BASE_URL}/enhanced-audit-insights`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ url, content, previousScore })
    });
  },

  // Schema Generator
  async generateSchema(url: string, contentType: string, content?: string) {
    return await apiCall(`${API_BASE_URL}/schema-generator`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ url, contentType, content })
    });
  },

  // Citation Tracker
  async trackCitations(domain: string, keywords: string[]) {
    return await apiCall(`${API_BASE_URL}/citation-tracker`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ domain, keywords })
    });
  },

  // Content Optimizer
  async optimizeContent(content: string, targetKeywords: string[], contentType: string) {
    return await apiCall(`${API_BASE_URL}/content-optimizer`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ content, targetKeywords, contentType })
    });
  },

  // Voice Assistant Tester
  async testVoiceAssistants(query: string, assistants: string[]): Promise<{ results: VoiceTestResult[] }> {
    return await apiCall(`${API_BASE_URL}/voice-assistant-tester`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, assistants })
    });
  },

  // Genie Chatbot (Enhanced with user data)
  async chatWithGenie(
    message: string, 
    context: 'landing' | 'dashboard', 
    userPlan?: string,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
    userData?: any
  ) {
    return await apiCall(`${API_BASE_URL}/genie-chatbot`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ message, context, userPlan, conversationHistory, userData })
    });
  },

  // LLM Site Summaries
  async generateLLMSummary(url: string, summaryType: 'overview' | 'technical' | 'business' | 'audience', content?: string) {
    return await apiCall(`${API_BASE_URL}/llm-site-summaries`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ url, summaryType, content })
    });
  },

  // Entity Coverage Analyzer
  async analyzeEntityCoverage(url: string, content?: string, industry?: string, competitors?: string[]) {
    return await apiCall(`${API_BASE_URL}/entity-coverage-analyzer`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ url, content, industry, competitors })
    });
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
    return await apiCall(`${API_BASE_URL}/ai-content-generator`, {
      method: 'POST',
      headers,
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
  },

  // Prompt Match Suggestions
  async generatePromptSuggestions(
    topic: string,
    industry?: string,
    targetAudience?: string,
    contentType?: 'article' | 'product' | 'service' | 'faq' | 'guide',
    userIntent?: 'informational' | 'transactional' | 'navigational' | 'commercial'
  ) {
    return await apiCall(`${API_BASE_URL}/prompt-match-suggestions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ topic, industry, targetAudience, contentType, userIntent })
    });
  },

  // Competitive Analysis
  async performCompetitiveAnalysis(
    primaryUrl: string,
    competitorUrls: string[],
    industry?: string,
    analysisType?: 'basic' | 'detailed' | 'comprehensive'
  ) {
    return await apiCall(`${API_BASE_URL}/competitive-analysis`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ primaryUrl, competitorUrls, industry, analysisType })
    });
  },

  // Competitor Discovery
  async discoverCompetitors(
    url: string,
    industry?: string,
    businessDescription?: string,
    existingCompetitors?: string[],
    analysisDepth?: 'basic' | 'comprehensive'
  ) {
    return await apiCall(`${API_BASE_URL}/competitor-discovery`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ url, industry, businessDescription, existingCompetitors, analysisDepth })
    });
  },

  // Report Generator
  async generateReport(
    reportType: 'audit' | 'competitive' | 'citation' | 'comprehensive',
    reportData: any,
    reportName: string,
    format: 'pdf' | 'csv' | 'json' = 'pdf'
  ) {
    return await apiCall(`${API_BASE_URL}/generate-report`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ reportType, reportData, reportName, format })
    });
  },

  // CMS Integrations
  async connectWordPress(siteUrl: string, username: string, applicationPassword: string) {
    return await apiCall(`${API_BASE_URL}/wordpress-integration`, {
      method: 'POST',
      headers,
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
      headers,
      body: JSON.stringify({ 
        action: 'publish', 
        content 
      })
    });
  },

  async connectShopify(shopDomain: string, accessToken: string) {
    return await apiCall(`${API_BASE_URL}/shopify-integration`, {
      method: 'POST',
      headers,
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
      headers,
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
      headers,
      body: JSON.stringify({ action: 'sync' })
    });
  },

  async disconnectCMS(cmsType: 'wordpress' | 'shopify') {
    const endpoint = cmsType === 'wordpress' ? 'wordpress-integration' : 'shopify-integration';
    return await apiCall(`${API_BASE_URL}/${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action: 'disconnect' })
    });
  }
};