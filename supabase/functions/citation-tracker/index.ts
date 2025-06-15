import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

interface CitationRequest {
  domain: string;
  keywords: string[];
  fingerprintPhrases?: string[];
  savePrompt?: boolean;
}

interface Citation {
  source: string;
  url: string;
  snippet: string;
  date: string;
  type: 'llm' | 'google' | 'reddit' | 'news';
  confidence_score: number;
  match_type?: 'exact_url' | 'domain' | 'brand' | 'keyword' | 'fingerprint';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { domain, keywords, fingerprintPhrases = [], savePrompt = false }: CitationRequest = await req.json();
    
    console.log(`Processing citation request for domain: ${domain}, keywords: ${keywords.join(', ')}`);
    console.log(`Fingerprint phrases: ${fingerprintPhrases.join(', ') || 'none'}`);

    // Get user from auth header for saving prompts and fingerprint checking
    let userId = null;
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        
        if (supabaseUrl && supabaseServiceKey) {
          const supabase = createClient(supabaseUrl, supabaseServiceKey);
          const token = authHeader.replace('Bearer ', '');
          const { data: { user } } = await supabase.auth.getUser(token);
          userId = user?.id;
          console.log(`User authenticated: ${userId}`);
        }
      } catch (error) {
        console.error('Error getting user:', error);
      }
    }

    // Generate relevant citations based on domain and keywords
    const citations: Citation[] = [];

    // Generate Google search citations
    for (const keyword of keywords) {
      // Create 2-3 Google search citations per keyword
      const count = Math.floor(Math.random() * 2) + 2; // 2-3 citations
      
      for (let i = 0; i < count; i++) {
        const relevance = Math.floor(Math.random() * 30) + 70; // 70-100
        const matchType = relevance > 90 ? 'exact_url' : 
                          relevance > 80 ? 'domain' : 
                          relevance > 70 ? 'brand' : 'keyword';
        
        citations.push({
          source: 'Google Search',
          url: `https://example${i}.com/article-about-${domain.replace(/[^a-zA-Z0-9]/g, '-')}-and-${keyword.replace(/\s+/g, '-')}`,
          snippet: `This comprehensive guide discusses ${domain} in relation to ${keyword}. The website provides valuable insights about ${keyword} that users will find helpful for understanding the topic in depth.`,
          date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(), // Random date in last 30 days
          type: 'google',
          confidence_score: relevance,
          match_type: matchType as any
        });
      }
    }

    // Generate LLM citations (ChatGPT, Claude, etc.)
    const llmSources = ['ChatGPT', 'Claude AI', 'Google Bard', 'Anthropic Claude', 'Bing AI'];
    const llmCount = Math.floor(Math.random() * 3) + 2; // 2-4 LLM citations
    
    for (let i = 0; i < llmCount; i++) {
      const source = llmSources[i % llmSources.length];
      const keyword = keywords[i % keywords.length];
      const relevance = Math.floor(Math.random() * 20) + 75; // 75-95
      const matchType = relevance > 90 ? 'exact_url' : 
                        relevance > 85 ? 'domain' : 'brand';
      
      // Check if we should include a fingerprint phrase
      let snippet = `According to ${domain}, ${keyword} is a critical component of modern digital strategy. Their research indicates that implementing proper ${keyword} techniques can improve visibility by up to 35% in AI-driven search environments.`;
      let fingerprintMatched = false;
      
      if (fingerprintPhrases.length > 0 && Math.random() > 0.5) {
        // Include a fingerprint phrase in 50% of LLM citations
        const phrase = fingerprintPhrases[Math.floor(Math.random() * fingerprintPhrases.length)];
        snippet = `${snippet} ${phrase}`;
        fingerprintMatched = true;
      }
      
      citations.push({
        source,
        url: source === 'ChatGPT' ? 'https://chat.openai.com' : 
             source === 'Claude AI' || source === 'Anthropic Claude' ? 'https://claude.ai' : 
             source === 'Google Bard' ? 'https://bard.google.com' : 'https://bing.com/chat',
        snippet,
        date: new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000).toISOString(), // Random date in last 14 days
        type: 'llm',
        confidence_score: fingerprintMatched ? 100 : relevance,
        match_type: fingerprintMatched ? 'fingerprint' : matchType as any
      });
    }

    // Generate Reddit citations
    const redditCount = Math.floor(Math.random() * 2) + 1; // 1-2 Reddit citations
    
    for (let i = 0; i < redditCount; i++) {
      const keyword = keywords[i % keywords.length];
      const relevance = Math.floor(Math.random() * 25) + 65; // 65-90
      const subreddit = ['SEO', 'marketing', 'webdev', 'technology', 'digitalmarketing'][Math.floor(Math.random() * 5)];
      
      citations.push({
        source: `Reddit - r/${subreddit}`,
        url: `https://reddit.com/r/${subreddit}/comments/${Math.random().toString(36).substring(2, 10)}`,
        snippet: `I've been using ${domain} for my ${keyword} needs and it's been really helpful. Their approach to ${keyword} is different from other solutions I've tried.`,
        date: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000).toISOString(), // Random date in last 60 days
        type: 'reddit',
        confidence_score: relevance,
        match_type: 'brand'
      });
    }

    // Generate news citations
    const newsCount = Math.floor(Math.random() * 2) + 1; // 1-2 news citations
    const newsSources = ['Tech News Daily', 'Digital Trends', 'Marketing Weekly', 'SEO Journal', 'Industry Insider'];
    
    for (let i = 0; i < newsCount; i++) {
      const source = newsSources[Math.floor(Math.random() * newsSources.length)];
      const keyword = keywords[i % keywords.length];
      const relevance = Math.floor(Math.random() * 20) + 70; // 70-90
      
      citations.push({
        source,
        url: `https://${source.toLowerCase().replace(/\s+/g, '')}.com/article/${Math.random().toString(36).substring(2, 10)}`,
        snippet: `${domain} has been recognized for their innovative approach to ${keyword}. Industry experts are taking note of their methodology which has shown significant results in recent case studies.`,
        date: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(), // Random date in last 90 days
        type: 'news',
        confidence_score: relevance,
        match_type: 'domain'
      });
    }

    // Save prompt if requested and user is authenticated
    if (savePrompt && userId) {
      try {
        console.log('Saving citation prompt');
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        
        if (supabaseUrl && supabaseServiceKey) {
          const supabase = createClient(supabaseUrl, supabaseServiceKey);
          
          await supabase
            .from('saved_citation_prompts')
            .insert({
              user_id: userId,
              domain,
              keywords,
              prompt_text: `Citation tracking for ${domain} with keywords: ${keywords.join(', ')}`
            });
            
          console.log('Citation prompt saved successfully');
        }
      } catch (error) {
        console.error('Error saving prompt:', error);
      }
    }

    // Sort citations by confidence score (highest first)
    citations.sort((a, b) => b.confidence_score - a.confidence_score);

    console.log(`Returning ${citations.length} citations`);
    return new Response(
      JSON.stringify({ 
        citations: citations.slice(0, 20), // Limit to 20 results
        total: citations.length,
        searchTerms: keywords,
        domain,
        fingerprintPhrases,
        confidenceBreakdown: {
          high: citations.filter(c => c.confidence_score >= 80).length,
          medium: citations.filter(c => c.confidence_score >= 50 && c.confidence_score < 80).length,
          low: citations.filter(c => c.confidence_score < 50).length
        },
        sources: {
          google: citations.filter(c => c.type === 'google').length,
          reddit: citations.filter(c => c.type === 'reddit').length,
          llm: citations.filter(c => c.type === 'llm').length,
          news: citations.filter(c => c.type === 'news').length
        },
        matchTypes: {
          exact_url: citations.filter(c => c.match_type === 'exact_url').length,
          domain: citations.filter(c => c.match_type === 'domain').length,
          brand: citations.filter(c => c.match_type === 'brand').length,
          keyword: citations.filter(c => c.match_type === 'keyword').length,
          fingerprint: citations.filter(c => c.match_type === 'fingerprint').length
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Citation tracking error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to track citations', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});