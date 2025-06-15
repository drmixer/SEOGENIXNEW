import { corsHeaders } from '../_shared/cors.ts';

interface CompetitorDiscoveryRequest {
  url: string;
  industry?: string;
  businessDescription?: string;
  existingCompetitors?: string[];
  analysisDepth?: 'basic' | 'comprehensive';
  location?: string; // Added explicit location parameter
}

interface CompetitorSuggestion {
  name: string;
  url: string;
  type: 'direct' | 'indirect' | 'industry_leader' | 'emerging' | 'local';  // Added 'local' type
  relevanceScore: number;
  reason: string;
  marketPosition: string;
  keyStrengths: string[];
  differentiators: string[];
  location?: string; // Added location field
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
      analysisDepth = 'basic',
      location // Get explicit location if provided
    }: CompetitorDiscoveryRequest = await req.json();
    
    console.log(`Processing competitor discovery for ${url}`);
    console.log(`Industry: ${industry || 'not specified'}, Analysis depth: ${analysisDepth}`);
    console.log(`Existing competitors: ${existingCompetitors.join(', ') || 'none'}`);
    console.log(`Location: ${location || 'not specified'}`);

    // Fetch content if URL provided to extract location and business details
    let pageContent = '';
    let extractedLocation = location || '';
    
    try {
      console.log(`Fetching content from ${url}`);
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'SEOGENIX Competitor Discovery Bot 1.0'
        }
      });
      if (response.ok) {
        pageContent = await response.text();
        console.log(`Successfully fetched content, length: ${pageContent.length} characters`);
        
        // If no explicit location was provided, try to extract it from the content
        if (!extractedLocation) {
          extractedLocation = extractLocationFromContent(pageContent, url);
          console.log(`Extracted location from content: ${extractedLocation || 'none found'}`);
        }
      } else {
        console.error(`Failed to fetch URL: ${url}, status: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to fetch website:', error);
    }

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY') || 'AIzaSyDJC5a7zgGvBk58ojXPKkQJXu-fR3qHHHM'; // Fallback to demo key
    
    if (!geminiApiKey) {
      console.error('Gemini API key not configured');
      return new Response(
        JSON.stringify({ error: 'Gemini API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Calling Gemini API for competitor discovery...');
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Analyze this business and discover potential competitors they may not be aware of. Provide comprehensive competitor intelligence with a focus on LOCATION-SPECIFIC and HIGHLY RELEVANT competitors.

              Business Website: ${url}
              Industry: ${industry || 'Not specified'}
              Business Description: ${businessDescription || 'Not provided'}
              Location: ${extractedLocation || 'Not specified'}
              Website Content: ${pageContent ? pageContent.substring(0, 3000) : 'Not available'}
              
              Existing Known Competitors: ${existingCompetitors.length > 0 ? existingCompetitors.join(', ') : 'None specified'}
              Analysis Depth: ${analysisDepth}

              IMPORTANT: If this is a location-based business (like "${extractedLocation}"), focus heavily on finding LOCAL competitors in the SAME GEOGRAPHIC AREA. Be very specific about the location in your analysis.

              Discover and analyze competitors across these categories:

              1. DIRECT COMPETITORS - Companies offering very similar products/services to the same target market in the same location
              2. LOCAL COMPETITORS - Businesses in the same geographic area serving similar needs
              3. INDIRECT COMPETITORS - Companies solving the same customer problem with different approaches
              4. INDUSTRY LEADERS - Major established players in the industry that set market standards
              5. EMERGING PLAYERS - Newer companies or startups that could become significant competitors

              For each competitor, provide:
              - Company name and website URL (use REAL, SPECIFIC competitors, not generic examples)
              - Competitor type (direct/local/indirect/industry_leader/emerging)
              - Relevance score (1-100) based on how directly they compete
              - Detailed reason why they're a competitor
              - Market position analysis
              - 3-5 key strengths
              - 2-3 key differentiators
              - Location information (city, state, region) if available

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
              TYPE: [direct/local/indirect/industry_leader/emerging]
              RELEVANCE: [1-100 score]
              REASON: [Why they're a competitor]
              MARKET_POSITION: [Their position in the market]
              LOCATION: [City, State/Region, Country if applicable]
              STRENGTHS: [Strength 1] | [Strength 2] | [Strength 3]
              DIFFERENTIATORS: [Diff 1] | [Diff 2]

              Provide 8-15 competitor suggestions depending on analysis depth. Make sure they are SPECIFIC, REAL companies, not generic placeholders.`
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
      
      // Return fallback data if API fails
      console.log('Using fallback competitor discovery data');
      return generateFallbackCompetitors(url, industry, extractedLocation, existingCompetitors, analysisDepth);
    }

    console.log('Received response from Gemini API');
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
      const locationMatch = section.match(/LOCATION:\s*(.*)/i);
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
          differentiators: differentiators.slice(0, 3),
          location: locationMatch ? locationMatch[1].trim() : extractedLocation
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

    console.log(`Competitor discovery complete. Found ${competitorSuggestions.length} potential competitors`);
    return new Response(
      JSON.stringify({
        businessUrl: url,
        industry,
        analysisDepth,
        location: extractedLocation,
        totalSuggestions: competitorSuggestions.length,
        averageRelevance,
        competitiveIntensity,
        competitorSuggestions,
        competitorsByType,
        insights: {
          directCompetitors: competitorsByType.direct?.length || 0,
          localCompetitors: competitorsByType.local?.length || 0,
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

// Helper function to extract location from content
function extractLocationFromContent(content: string, url: string): string {
  // Try to find location patterns in the content
  // Look for city, state patterns like "Prescott, Arizona" or "Prescott AZ"
  const cityStatePattern = /\b([A-Z][a-z]+)(?:,?\s+)(?:([A-Z][a-z]+)|([A-Z]{2}))\b/g;
  const matches = [...content.matchAll(cityStatePattern)];
  
  // Check URL for location hints
  const urlObj = new URL(url);
  const domain = urlObj.hostname;
  const path = urlObj.pathname;
  
  // Look for location names in the domain or path
  const domainParts = domain.split('.');
  const pathParts = path.split('/').filter(p => p);
  
  // Common US city names that might appear in domains
  const commonCities = [
    'phoenix', 'tucson', 'flagstaff', 'prescott', 'sedona', 'scottsdale', 'tempe',
    'chandler', 'glendale', 'mesa', 'peoria', 'surprise', 'yuma', 'kingman'
  ];
  
  // Common US state names or abbreviations
  const commonStates = [
    'arizona', 'az', 'california', 'ca', 'nevada', 'nv', 'utah', 'ut', 
    'colorado', 'co', 'new-mexico', 'nm', 'texas', 'tx'
  ];
  
  // Check domain and path for location hints
  for (const part of [...domainParts, ...pathParts]) {
    const lowerPart = part.toLowerCase();
    
    // Check for city names
    const cityMatch = commonCities.find(city => lowerPart.includes(city));
    if (cityMatch) {
      // If we find a city, look for a state nearby
      for (const part2 of [...domainParts, ...pathParts]) {
        const lowerPart2 = part2.toLowerCase();
        const stateMatch = commonStates.find(state => lowerPart2.includes(state));
        if (stateMatch) {
          // Format properly
          const city = cityMatch.charAt(0).toUpperCase() + cityMatch.slice(1);
          const state = stateMatch.length <= 2 
            ? stateMatch.toUpperCase() 
            : stateMatch.charAt(0).toUpperCase() + stateMatch.slice(1);
          return `${city}, ${state}`;
        }
      }
      
      // Return just the city if no state found
      return cityMatch.charAt(0).toUpperCase() + cityMatch.slice(1);
    }
  }
  
  // If we found city/state patterns in the content, use the first one
  if (matches.length > 0) {
    const [_, city, stateName, stateAbbr] = matches[0];
    const state = stateName || stateAbbr;
    return `${city}, ${state}`;
  }
  
  // Look for address patterns
  const addressPattern = /\b\d+\s+[A-Za-z\s]+(?:Avenue|Ave|Street|St|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Plaza|Plz|Square|Sq|Highway|Hwy|Parkway|Pkwy)\b[,\s]+\b[A-Za-z\s]+\b[,\s]+\b[A-Z]{2}\b\s+\b\d{5}\b/i;
  const addressMatch = content.match(addressPattern);
  
  if (addressMatch) {
    // Extract city and state from address
    const addressParts = addressMatch[0].split(',');
    if (addressParts.length >= 2) {
      const cityStatePart = addressParts[1].trim();
      const cityStateMatch = cityStatePart.match(/([A-Za-z\s]+)\s+([A-Z]{2})/);
      if (cityStateMatch) {
        return `${cityStateMatch[1].trim()}, ${cityStateMatch[2]}`;
      }
    }
  }
  
  // If no location found, return empty string
  return '';
}

// Fallback function to generate sample competitors when API fails
function generateFallbackCompetitors(
  url: string, 
  industry?: string, 
  location?: string,
  existingCompetitors: string[] = [],
  analysisDepth: string = 'basic'
): Response {
  console.log(`Generating fallback competitors for ${url}`);
  
  // Define location-specific competitors if location is provided
  const locationCompetitors: Record<string, CompetitorSuggestion[]> = {
    'Prescott, Arizona': [
      {
        name: 'Prescott Web Design',
        url: 'https://prescottwebdesign.com',
        type: 'direct',
        relevanceScore: 95,
        reason: 'Local web design company serving the same Prescott area with similar services',
        marketPosition: 'Established local web design agency with strong community presence',
        keyStrengths: ['Local reputation', 'Custom WordPress development', 'SEO services'],
        differentiators: ['Specializes in local businesses', 'In-person consultations'],
        location: 'Prescott, Arizona'
      },
      {
        name: 'Arizona Web Team',
        url: 'https://arizonawebteam.com',
        type: 'local',
        relevanceScore: 90,
        reason: 'Regional web design company serving Prescott and surrounding areas',
        marketPosition: 'Growing regional agency with clients throughout Northern Arizona',
        keyStrengths: ['Regional presence', 'E-commerce expertise', 'Digital marketing services'],
        differentiators: ['Focuses on tourism industry', 'Bilingual services'],
        location: 'Prescott Valley, Arizona'
      },
      {
        name: 'Prescott Digital Marketing',
        url: 'https://prescottdigitalmarketing.com',
        type: 'local',
        relevanceScore: 85,
        reason: 'Local digital marketing agency that also offers web design services',
        marketPosition: 'Full-service digital agency with strong local client base',
        keyStrengths: ['Integrated marketing approach', 'Local SEO expertise', 'Social media management'],
        differentiators: ['Marketing-first approach', 'Performance-based pricing'],
        location: 'Prescott, Arizona'
      },
      {
        name: 'Northern AZ Web Solutions',
        url: 'https://northernazwebsolutions.com',
        type: 'direct',
        relevanceScore: 88,
        reason: 'Direct competitor serving the same geographic area with similar service offerings',
        marketPosition: 'Boutique web design firm focused on small businesses in Northern Arizona',
        keyStrengths: ['Affordable packages', 'Quick turnaround times', 'Ongoing support plans'],
        differentiators: ['Small business focus', 'Fixed pricing model'],
        location: 'Prescott, Arizona'
      }
    ],
    'Phoenix, Arizona': [
      {
        name: 'Phoenix Web Group',
        url: 'https://phoenixwebgroup.com',
        type: 'direct',
        relevanceScore: 92,
        reason: 'Major web design company in Phoenix offering similar services',
        marketPosition: 'Leading web design agency in the Phoenix metro area',
        keyStrengths: ['Large portfolio', 'Full-service capabilities', 'Industry specialization'],
        differentiators: ['Enterprise solutions', 'In-house development team'],
        location: 'Phoenix, Arizona'
      },
      {
        name: 'AZ Digital Designs',
        url: 'https://azdigitaldesigns.com',
        type: 'local',
        relevanceScore: 88,
        reason: 'Regional competitor with growing presence in the Phoenix market',
        marketPosition: 'Mid-sized agency with diverse client portfolio',
        keyStrengths: ['Creative design focus', 'Custom CMS solutions', 'Branding services'],
        differentiators: ['Design-centric approach', 'Industry awards'],
        location: 'Scottsdale, Arizona'
      }
    ]
  };
  
  // Industry-specific competitors if industry is provided
  const industryCompetitors: Record<string, CompetitorSuggestion[]> = {
    'Web Design': [
      {
        name: 'WebFlow Studios',
        url: 'https://webflowstudios.com',
        type: 'industry_leader',
        relevanceScore: 80,
        reason: 'Major player in the web design industry with innovative approaches',
        marketPosition: 'Industry leader known for cutting-edge designs and no-code solutions',
        keyStrengths: ['Webflow expertise', 'Design innovation', 'Large resource library'],
        differentiators: ['No-code focus', 'Template marketplace'],
        location: 'San Francisco, CA'
      },
      {
        name: 'DesignCraft Agency',
        url: 'https://designcraftagency.com',
        type: 'direct',
        relevanceScore: 85,
        reason: 'Specialized web design agency with similar service offerings',
        marketPosition: 'Boutique agency with focus on custom designs and development',
        keyStrengths: ['Custom illustrations', 'Frontend development', 'UX research'],
        differentiators: ['Design-led process', 'Specialized in SaaS websites'],
        location: 'Remote/Distributed'
      },
      {
        name: 'WebsiteWizards',
        url: 'https://websitewizards.io',
        type: 'emerging',
        relevanceScore: 75,
        reason: 'Fast-growing web design startup with innovative business model',
        marketPosition: 'Disruptive player with subscription-based web design services',
        keyStrengths: ['Affordable monthly plans', 'Rapid deployment', 'Ongoing updates'],
        differentiators: ['Subscription model', 'AI-assisted design tools'],
        location: 'Austin, TX'
      }
    ],
    'Digital Marketing': [
      {
        name: 'DigitalEdge Marketing',
        url: 'https://digitaledgemarketing.com',
        type: 'direct',
        relevanceScore: 88,
        reason: 'Full-service digital marketing agency with web design services',
        marketPosition: 'Established agency with integrated marketing approach',
        keyStrengths: ['Comprehensive strategy', 'Data-driven approach', 'Multi-channel campaigns'],
        differentiators: ['Marketing-first approach', 'Performance guarantees'],
        location: 'Chicago, IL'
      },
      {
        name: 'ConversionCraft',
        url: 'https://conversioncraft.co',
        type: 'indirect',
        relevanceScore: 70,
        reason: 'Focuses on conversion optimization which complements web design',
        marketPosition: 'Specialized agency focused on improving website performance',
        keyStrengths: ['A/B testing expertise', 'User research', 'Analytics implementation'],
        differentiators: ['Conversion focus', 'Performance-based pricing'],
        location: 'Denver, CO'
      }
    ]
  };
  
  // Default competitors if location and industry not specified
  const defaultCompetitors: CompetitorSuggestion[] = [
    {
      name: 'WebDesignPro',
      url: 'https://webdesignpro.com',
      type: 'direct',
      relevanceScore: 85,
      reason: 'Offers similar web design services to the same target market',
      marketPosition: 'Established player with significant market share',
      keyStrengths: ['Brand recognition', 'Diverse portfolio', 'Technical expertise'],
      differentiators: ['Premium positioning', 'Industry specialization'],
      location: 'National'
    },
    {
      name: 'DigitalCraft Studios',
      url: 'https://digitalcraftstudios.com',
      type: 'direct',
      relevanceScore: 82,
      reason: 'Direct competitor with similar service offerings and target audience',
      marketPosition: 'Growing agency with creative focus',
      keyStrengths: ['Creative design', 'Custom development', 'Brand strategy'],
      differentiators: ['Design-led approach', 'Fixed project pricing'],
      location: 'National'
    },
    {
      name: 'WebSolutions Inc',
      url: 'https://websolutionsinc.com',
      type: 'industry_leader',
      relevanceScore: 78,
      reason: 'Major player setting standards in the industry',
      marketPosition: 'Market leader with broad service range',
      keyStrengths: ['Comprehensive services', 'Large team', 'Established processes'],
      differentiators: ['Enterprise focus', 'Global presence'],
      location: 'National'
    },
    {
      name: 'CodeCraft Agency',
      url: 'https://codecraftagency.io',
      type: 'indirect',
      relevanceScore: 70,
      reason: 'Development-focused agency that competes for similar clients',
      marketPosition: 'Technical agency with development expertise',
      keyStrengths: ['Technical excellence', 'Custom applications', 'API integrations'],
      differentiators: ['Development-first approach', 'Technical specialization'],
      location: 'National'
    },
    {
      name: 'DesignFusion',
      url: 'https://designfusion.co',
      type: 'emerging',
      relevanceScore: 65,
      reason: 'Innovative new agency gaining market share',
      marketPosition: 'Emerging disruptor with modern approach',
      keyStrengths: ['Modern design aesthetic', 'Fast turnaround', 'Subscription options'],
      differentiators: ['AI-enhanced design', 'Membership model'],
      location: 'National'
    }
  ];
  
  // Determine which competitors to use
  let competitorSuggestions: CompetitorSuggestion[] = [];
  
  // First priority: location-specific competitors
  if (location && locationCompetitors[location]) {
    competitorSuggestions = [...locationCompetitors[location]];
  }
  
  // Second priority: industry-specific competitors
  if (industry && industryCompetitors[industry]) {
    // Add industry competitors that aren't already included
    const industryComps = industryCompetitors[industry].filter(
      indComp => !competitorSuggestions.some(comp => comp.url === indComp.url)
    );
    competitorSuggestions = [...competitorSuggestions, ...industryComps];
  }
  
  // If we still don't have enough, add default competitors
  if (competitorSuggestions.length < 5) {
    const defaultComps = defaultCompetitors.filter(
      defComp => !competitorSuggestions.some(comp => comp.url === defComp.url)
    );
    competitorSuggestions = [...competitorSuggestions, ...defaultComps];
  }
  
  // Filter out any existing competitors
  competitorSuggestions = competitorSuggestions.filter(comp => 
    !existingCompetitors.some(existing => 
      existing.toLowerCase().includes(comp.name.toLowerCase()) || 
      comp.url.toLowerCase().includes(existing.toLowerCase())
    )
  );
  
  // Limit to a reasonable number
  competitorSuggestions = competitorSuggestions.slice(0, analysisDepth === 'comprehensive' ? 12 : 8);
  
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
      location,
      totalSuggestions: competitorSuggestions.length,
      averageRelevance,
      competitiveIntensity,
      competitorSuggestions,
      competitorsByType,
      insights: {
        directCompetitors: competitorsByType.direct?.length || 0,
        localCompetitors: competitorsByType.local?.length || 0,
        indirectCompetitors: competitorsByType.indirect?.length || 0,
        industryLeaders: competitorsByType.industry_leader?.length || 0,
        emergingPlayers: competitorsByType.emerging?.length || 0,
        highRelevanceCompetitors: competitorSuggestions.filter(c => c.relevanceScore >= 80).length,
        marketGaps: competitorSuggestions.length < 5 ? 'Low competitive density - potential market opportunity' : 
                   competitorSuggestions.length > 7 ? 'High competitive density - crowded market' : 
                   'Moderate competitive density - balanced market'
      },
      recommendations: [
        'Monitor high-relevance competitors for strategic insights',
        'Analyze competitor strengths to identify improvement opportunities',
        'Track emerging players for early competitive intelligence',
        'Consider partnerships with indirect competitors',
        'Differentiate from industry leaders through unique value propositions'
      ],
      analyzedAt: new Date().toISOString(),
      note: 'This is fallback competitor data as the API request failed'
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}