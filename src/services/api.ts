const API_BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

const headers = {
  'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
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
    const response = await fetch(`${API_BASE_URL}/ai-visibility-audit`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ url, content })
    });
    
    if (!response.ok) {
      throw new Error('Failed to run audit');
    }
    
    return response.json();
  },

  // Schema Generator
  async generateSchema(url: string, contentType: string, content?: string) {
    const response = await fetch(`${API_BASE_URL}/schema-generator`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ url, contentType, content })
    });
    
    if (!response.ok) {
      throw new Error('Failed to generate schema');
    }
    
    return response.json();
  },

  // Citation Tracker
  async trackCitations(domain: string, keywords: string[]) {
    const response = await fetch(`${API_BASE_URL}/citation-tracker`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ domain, keywords })
    });
    
    if (!response.ok) {
      throw new Error('Failed to track citations');
    }
    
    return response.json();
  },

  // Content Optimizer
  async optimizeContent(content: string, targetKeywords: string[], contentType: string) {
    const response = await fetch(`${API_BASE_URL}/content-optimizer`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ content, targetKeywords, contentType })
    });
    
    if (!response.ok) {
      throw new Error('Failed to optimize content');
    }
    
    return response.json();
  },

  // Voice Assistant Tester
  async testVoiceAssistants(query: string, assistants: string[]): Promise<{ results: VoiceTestResult[] }> {
    const response = await fetch(`${API_BASE_URL}/voice-assistant-tester`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, assistants })
    });
    
    if (!response.ok) {
      throw new Error('Failed to test voice assistants');
    }
    
    return response.json();
  },

  // Genie Chatbot (Enhanced with user data)
  async chatWithGenie(
    message: string, 
    context: 'landing' | 'dashboard', 
    userPlan?: string,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
    userData?: any
  ) {
    const response = await fetch(`${API_BASE_URL}/genie-chatbot`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ message, context, userPlan, conversationHistory, userData })
    });
    
    if (!response.ok) {
      throw new Error('Failed to chat with Genie');
    }
    
    return response.json();
  },

  // LLM Site Summaries
  async generateLLMSummary(url: string, summaryType: 'overview' | 'technical' | 'business' | 'audience', content?: string) {
    const response = await fetch(`${API_BASE_URL}/llm-site-summaries`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ url, summaryType, content })
    });
    
    if (!response.ok) {
      throw new Error('Failed to generate LLM summary');
    }
    
    return response.json();
  },

  // Entity Coverage Analyzer
  async analyzeEntityCoverage(url: string, content?: string, industry?: string, competitors?: string[]) {
    const response = await fetch(`${API_BASE_URL}/entity-coverage-analyzer`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ url, content, industry, competitors })
    });
    
    if (!response.ok) {
      throw new Error('Failed to analyze entity coverage');
    }
    
    return response.json();
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
    const response = await fetch(`${API_BASE_URL}/ai-content-generator`, {
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
    
    if (!response.ok) {
      throw new Error('Failed to generate AI content');
    }
    
    return response.json();
  },

  // Prompt Match Suggestions
  async generatePromptSuggestions(
    topic: string,
    industry?: string,
    targetAudience?: string,
    contentType?: 'article' | 'product' | 'service' | 'faq' | 'guide',
    userIntent?: 'informational' | 'transactional' | 'navigational' | 'commercial'
  ) {
    const response = await fetch(`${API_BASE_URL}/prompt-match-suggestions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ topic, industry, targetAudience, contentType, userIntent })
    });
    
    if (!response.ok) {
      throw new Error('Failed to generate prompt suggestions');
    }
    
    return response.json();
  },

  // Competitive Analysis
  async performCompetitiveAnalysis(
    primaryUrl: string,
    competitorUrls: string[],
    industry?: string,
    analysisType?: 'basic' | 'detailed' | 'comprehensive'
  ) {
    const response = await fetch(`${API_BASE_URL}/competitive-analysis`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ primaryUrl, competitorUrls, industry, analysisType })
    });
    
    if (!response.ok) {
      throw new Error('Failed to perform competitive analysis');
    }
    
    return response.json();
  },

  // Report Generator
  async generateReport(
    reportType: 'audit' | 'competitive' | 'citation' | 'comprehensive',
    reportData: any,
    reportName: string,
    format: 'pdf' | 'csv' | 'json' = 'pdf'
  ) {
    const response = await fetch(`${API_BASE_URL}/generate-report`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ reportType, reportData, reportName, format })
    });
    
    if (!response.ok) {
      throw new Error('Failed to generate report');
    }
    
    return response.json();
  }
};