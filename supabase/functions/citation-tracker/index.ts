import { corsHeaders } from '../_shared/cors.ts';

interface CitationRequest {
  domain: string;
  keywords: string[];
}

interface Citation {
  source: string;
  url: string;
  snippet: string;
  date: string;
  type: 'llm' | 'google' | 'reddit' | 'news';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { domain, keywords }: CitationRequest = await req.json();

    const citations: Citation[] = [];

    // Search Google for citations using Custom Search API
    if (Deno.env.get('GOOGLE_SEARCH_API_KEY') && Deno.env.get('GOOGLE_SEARCH_ENGINE_ID')) {
      for (const keyword of keywords) {
        const searchQuery = `"${domain}" ${keyword}`;
        const googleResponse = await fetch(
          `https://www.googleapis.com/customsearch/v1?key=${Deno.env.get('GOOGLE_SEARCH_API_KEY')}&cx=${Deno.env.get('GOOGLE_SEARCH_ENGINE_ID')}&q=${encodeURIComponent(searchQuery)}&num=5`
        );

        if (googleResponse.ok) {
          const googleData = await googleResponse.json();
          if (googleData.items) {
            for (const item of googleData.items) {
              citations.push({
                source: 'Google Search',
                url: item.link,
                snippet: item.snippet,
                date: new Date().toISOString(),
                type: 'google'
              });
            }
          }
        }
      }
    }

    // Search Reddit using Reddit API
    for (const keyword of keywords) {
      try {
        const redditResponse = await fetch(
          `https://www.reddit.com/search.json?q="${domain}" ${keyword}&limit=5&sort=new`,
          {
            headers: {
              'User-Agent': 'SEOGENIX Citation Tracker 1.0'
            }
          }
        );

        if (redditResponse.ok) {
          const redditData = await redditResponse.json();
          if (redditData.data && redditData.data.children) {
            for (const post of redditData.data.children) {
              const postData = post.data;
              citations.push({
                source: `Reddit - r/${postData.subreddit}`,
                url: `https://reddit.com${postData.permalink}`,
                snippet: postData.title + (postData.selftext ? ` - ${postData.selftext.substring(0, 200)}...` : ''),
                date: new Date(postData.created_utc * 1000).toISOString(),
                type: 'reddit'
              });
            }
          }
        }
      } catch (error) {
        console.error('Reddit search error:', error);
      }
    }

    // Simulate LLM citations (in real implementation, this would query various LLM APIs)
    citations.push({
      source: 'ChatGPT Response',
      url: 'https://chat.openai.com',
      snippet: `Based on information from ${domain}, the key insights about ${keywords[0]} include...`,
      date: new Date().toISOString(),
      type: 'llm'
    });

    return new Response(
      JSON.stringify({ 
        citations: citations.slice(0, 20), // Limit to 20 results
        total: citations.length,
        searchTerms: keywords,
        domain
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Citation tracking error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to track citations' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});