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

  // Genie Chatbot
  async chatWithGenie(
    message: string, 
    context: 'landing' | 'dashboard', 
    userPlan?: string,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  ) {
    const response = await fetch(`${API_BASE_URL}/genie-chatbot`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ message, context, userPlan, conversationHistory })
    });
    
    if (!response.ok) {
      throw new Error('Failed to chat with Genie');
    }
    
    return response.json();
  }
};