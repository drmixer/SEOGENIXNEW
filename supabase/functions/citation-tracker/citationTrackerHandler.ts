import { SupabaseClient, createClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function citationTrackerHandler(
  supabase: SupabaseClient,
  req: Request,
  input: any
) {
  const { domain, keywords, fingerprintPhrases = [], savePrompt = false } = input;

  let userId = null;
  const authHeader = req.headers.get('Authorization');
  if (authHeader) {
    try {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id;
    } catch (error) {
      console.error('Error getting user:', error);
    }
  }

  // This is mock data generation logic, it should be kept as is.
  const citations = [];
  for (const keyword of keywords){
    const count = Math.floor(Math.random() * 2) + 2;
    for(let i = 0; i < count; i++){
      const relevance = Math.floor(Math.random() * 30) + 70;
      citations.push({
        source: 'Google Search',
        url: `https://example.com/article-about-${keyword}`,
        snippet: `A guide on ${domain} regarding ${keyword}.`,
        date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        type: 'google',
        confidence_score: relevance,
        match_type: 'domain'
      });
    }
  }

  if (savePrompt && userId) {
    try {
      await supabase.from('saved_citation_prompts').insert({
        user_id: userId,
        domain,
        keywords,
        prompt_text: `Citation tracking for ${domain}`
      });
    } catch (error) {
      console.error('Error saving prompt:', error);
    }
  }

  citations.sort((a, b) => b.confidence_score - a.confidence_score);

  return {
    citations: citations.slice(0, 20),
    total: citations.length,
    searchTerms: keywords,
    domain,
    fingerprintPhrases,
  };
}
