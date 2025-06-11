import { corsHeaders } from '../_shared/cors.ts';

interface CompetitorDiscoveryRequest {
  url: string;
  industry?: string;
  businessDescription?: string;
  existingCompetitors?: string[];
  analysisDepth?: 'basic' | 'comprehensive';
}

interface CompetitorSuggestion {
  name: string;
  url: string;
  type: 'direct' | 'indirect' | 'industry_leader' | 'emerging';
  relevanceScore: number;
  reason: string;
  marketPosition: string;
  keyStrengths: string[];
  differentiators: string[];
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { 
      url, 
      industry, 
      businessDescription, 
      existingCompetitors = [],
      analysisDepth = 'basic'
    }: CompetitorDiscoveryRequest = await req.json();

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: 'Gemini API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch content from the user's website for analysis
    let websiteContent = '';
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'SEOGENIX Competitor Discovery Bot 1.0'
        }
      });
      if (response.ok) {
        websiteContent = await response.text();
      }
    } catch (error) {
      console.error('Failed to fetch website:', error);
      websiteContent = `Website: ${url}`;
    }

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Analyze this business and discover potential competitors they may not be aware of. Provide comprehensive competitor intelligence.

              Business Website: ${url}
              Industry: ${industry || 'Not specified'}
              Business Description: ${businessDescription || 'Not provided'}
              Website Content: ${websiteContent.substring(0, 3000)}
              
              Existing Known Competitors: ${existingCompetitors.length > 0 ? existingCompetitors.join(', ') : 'None specified'}
              Analysis Depth: ${analysisDepth}

              Discover and analyze competitors across these categories:

              1. DIRECT COMPETITORS - Companies offering very similar products/services to the same target market
              2. INDIRECT COMPETITORS - Companies solving the same customer problem with different approaches
              3. INDUSTRY LEADERS - Major established players in the industry that set market standards
              4. EMERGING PLAYERS - Newer companies or startups that could become significant competitors

              For each competitor, provide:
              - Company name and website URL
              - Competitor type (direct/indirect/industry_leader/emerging)
              - Relevance score (1-100) based on how directly they compete
              - Detailed reason why they're a competitor
              - Market position analysis
              - 3-5 key strengths
              - 2-3 key differentiators

              Focus on discovering competitors the user might not already know about. Avoid suggesting the existing competitors they've already listed.

              ${analysisDepth === 'comprehensive' ? `
              For comprehensive analysis, also include:
              - International competitors
              - Adjacent market players
              - Platform/marketplace competitors
              - Technology stack competitors
              ` : ''}

              Format each competitor as:
              COMPETITOR: [Company Name]
              URL: [Website URL]
              TYPE: [direct/indirect/industry_leader/emerging]
              RELEVANCE: [1-100 score]
              REASON: [Why they're a competitor]
              MARKET_POSITION: [Their position in the market]
              STRENGTHS: [Strength 1] | [Strength 2] | [Strength 3]
              DIFFERENTIATORS: [Diff 1] | [Diff 2]

              Provide 8-15 competitor suggestions depending on analysis depth.`
            }]
          }],
          generationConfig: {
            temperature: 0.4,
            topK: 40,
            topP: 0.8,
            maxOutputTokens: 2048,
          }
        })
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', errorText);
      throw new Error(`Gemini API failed: ${geminiResponse.status}`);
    }

    const geminiData = await geminiResponse.json();
    const responseText = geminiData.candidates[0].content.parts[0].text;

    // Parse competitor suggestions
    const competitorSuggestions: CompetitorSuggestion[] = [];
    const sections = responseText.split('COMPETITOR:').slice(1);

    for (const section of sections) {
      const nameMatch = section.match(/^([^\n]+)/);
      const urlMatch = section.match(/URL:\s*(.*)/i);
      const typeMatch = section.match(/TYPE:\s*(.*)/i);
      const relevanceMatch = section.match(/RELEVANCE:\s*(\d+)/i);
      const reasonMatch = section.match(/REASON:\s*(.*)/i);
      const positionMatch = section.match(/MARKET_POSITION:\s*(.*)/i);
      const strengthsMatch = section.match(/STRENGTHS:\s*(.*)/i);
      const diffMatch = section.match(/DIFFERENTIATORS:\s*(.*)/i);

      if (nameMatch && urlMatch && typeMatch && relevanceMatch && reasonMatch) {
        const strengths = strengthsMatch ? 
          strengthsMatch[1].split('|').map(s => s.trim()).filter(s => s) : [];
        const differentiators = diffMatch ? 
          diffMatch[1].split('|').map(d => d.trim()).filter(d => d) : [];

        competitorSuggestions.push({
          name: nameMatch[1].trim(),
          url: urlMatch[1].trim(),
          type: typeMatch[1].trim() as CompetitorSuggestion['type'],
          relevanceScore: parseInt(relevanceMatch[1]),
          reason: reasonMatch[1].trim(),
          marketPosition: positionMatch ? positionMatch[1].trim() : 'Market position analysis not available',
          keyStrengths: strengths.slice(0, 5),
          differentiators: differentiators.slice(0, 3)
        });
      }
    }

    // Sort by relevance score
    competitorSuggestions.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Group by type
    const competitorsByType = competitorSuggestions.reduce((acc, comp) => {
      if (!acc[comp.type]) {
        acc[comp.type] = [];
      }
      acc[comp.type].push(comp);
      return acc;
    }, {} as Record<string, CompetitorSuggestion[]>);

    // Calculate insights
    const averageRelevance = competitorSuggestions.length > 0 ? 
      Math.round(competitorSuggestions.reduce((sum, comp) => sum + comp.relevanceScore, 0) / competitorSuggestions.length) : 0;

    const competitiveIntensity = averageRelevance >= 80 ? 'High' : 
                                averageRelevance >= 60 ? 'Medium' : 'Low';

    return new Response(
      JSON.stringify({
        businessUrl: url,
        industry,
        analysisDepth,
        totalSuggestions: competitorSuggestions.length,
        averageRelevance,
        competitiveIntensity,
        competitorSuggestions,
        competitorsByType,
        insights: {
          directCompetitors: competitorsByType.direct?.length || 0,
          indirectCompetitors: competitorsByType.indirect?.length || 0,
          industryLeaders: competitorsByType.industry_leader?.length || 0,
          emergingPlayers: competitorsByType.emerging?.length || 0,
          highRelevanceCompetitors: competitorSuggestions.filter(c => c.relevanceScore >= 80).length,
          marketGaps: competitorSuggestions.length < 5 ? 'Low competitive density - potential market opportunity' : 
                     competitorSuggestions.length > 12 ? 'High competitive density - crowded market' : 
                     'Moderate competitive density - balanced market'
        },
        recommendations: [
          'Monitor high-relevance competitors for strategic insights',
          'Analyze competitor strengths to identify improvement opportunities',
          'Track emerging players for early competitive intelligence',
          'Consider partnerships with indirect competitors',
          'Differentiate from industry leaders through unique value propositions'
        ],
        analyzedAt: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Competitor discovery error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to discover competitors',
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});