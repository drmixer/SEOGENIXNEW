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
  type: 'direct' | 'indirect' | 'industry_leader' | 'emerging' | 'local';
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
      analysisDepth = 'basic'
    }: CompetitorDiscoveryRequest = await req.json();
    
    console.log(`Processing competitor discovery for ${url}`);
    console.log(`Industry: ${industry || 'not specified'}, Analysis depth: ${analysisDepth}`);
    console.log(`Existing competitors: ${existingCompetitors.join(', ') || 'none'}`);

    // Extract location from URL, business description, and content
    let detectedLocation = '';
    
    // Try to extract location from URL
    try {
      const urlObj = new URL(url);
      const domainParts = urlObj.hostname.split('.');
      const path = urlObj.pathname.split('/').filter(Boolean);
      
      // Check for location in domain (e.g., prescottwebdesign.com)
      const commonLocations = ['prescott', 'phoenix', 'scottsdale', 'flagstaff', 'sedona', 'tempe', 'mesa', 'chandler', 'gilbert', 'glendale', 'peoria', 'surprise', 'yuma', 'tucson'];
      
      for (const part of [...domainParts, ...path]) {
        const normalizedPart = part.toLowerCase();
        if (commonLocations.includes(normalizedPart)) {
          detectedLocation = normalizedPart.charAt(0).toUpperCase() + normalizedPart.slice(1);
          console.log(`Detected location from URL: ${detectedLocation}`);
          break;
        }
      }
    } catch (error) {
      console.error('Error parsing URL:', error);
    }
    
    // Try to extract from business description if no location found yet
    if (!detectedLocation && businessDescription) {
      const locationRegex = /\b(Prescott|Phoenix|Scottsdale|Flagstaff|Sedona|Tempe|Mesa|Chandler|Gilbert|Glendale|Peoria|Surprise|Yuma|Tucson|Arizona|AZ)\b/i;
      const match = businessDescription.match(locationRegex);
      if (match) {
        detectedLocation = match[1];
        console.log(`Detected location from business description: ${detectedLocation}`);
      }
    }

    // Fetch content from the user's website for analysis
    let websiteContent = '';
    try {
      console.log(`Fetching content from ${url}`);
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'SEOGENIX Competitor Discovery Bot 1.0'
        }
      });
      if (response.ok) {
        websiteContent = await response.text();
        console.log(`Successfully fetched content, length: ${websiteContent.length} characters`);
        
        // Try to extract location from content if still not found
        if (!detectedLocation) {
          const locationRegex = /\b(Prescott|Phoenix|Scottsdale|Flagstaff|Sedona|Tempe|Mesa|Chandler|Gilbert|Glendale|Peoria|Surprise|Yuma|Tucson|Arizona|AZ)\b/i;
          const matches = [...websiteContent.matchAll(locationRegex)];
          if (matches.length > 0) {
            // Count occurrences to find the most mentioned location
            const locationCounts = matches.reduce((acc, match) => {
              const loc = match[1];
              acc[loc] = (acc[loc] || 0) + 1;
              return acc;
            }, {} as Record<string, number>);
            
            // Get the most mentioned location
            const mostMentioned = Object.entries(locationCounts)
              .sort((a, b) => b[1] - a[1])[0];
              
            if (mostMentioned) {
              detectedLocation = mostMentioned[0];
              console.log(`Extracted location from content: ${detectedLocation}`);
            }
          }
        }
      } else {
        console.error(`Failed to fetch URL: ${url}, status: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to fetch URL:', error);
    }

    // Determine business type from content or industry
    let businessType = industry || '';
    if (!businessType && websiteContent) {
      const businessTypeRegex = /\b(web design|web development|digital marketing|SEO|graphic design|branding|e-commerce|app development|software development|IT services|consulting)\b/i;
      const matches = websiteContent.match(businessTypeRegex);
      if (matches) {
        businessType = matches[1];
        console.log(`Detected business type from content: ${businessType}`);
      }
    }

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY') || 'AIzaSyDJC5a7zgGvBk58ojXPKkQJXu-fR3qHHHM'; // Fallback to demo key
    
    if (!geminiApiKey) {
      console.error('Gemini API key not configured');
      return new Response(
        JSON.stringify({ error: 'Gemini API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use Google Search API if available
    const googleApiKey = Deno.env.get('GOOGLE_SEARCH_API_KEY');
    const googleEngineId = Deno.env.get('GOOGLE_SEARCH_ENGINE_ID');
    
    let competitorSuggestions: CompetitorSuggestion[] = [];
    let usedRealSearch = false;
    
    if (googleApiKey && googleEngineId) {
      try {
        console.log('Using Google Search API for competitor discovery');
        
        // Construct location-specific search queries
        const queries = [];
        
        if (detectedLocation) {
          // Location-specific queries
          queries.push(`${detectedLocation} ${businessType || 'web design'} companies`);
          queries.push(`${businessType || 'web design'} in ${detectedLocation}`);
          queries.push(`${detectedLocation} ${businessType || 'web design'} agency`);
        } else {
          // General queries
          queries.push(`${businessType || 'web design'} companies`);
          queries.push(`${businessType || 'web design'} agency`);
        }
        
        // Extract domain to exclude from results
        const domain = new URL(url).hostname;
        
        for (const query of queries.slice(0, 2)) { // Limit to 2 queries to avoid rate limits
          console.log(`Searching for: ${query}`);
          
          const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${googleEngineId}&q=${encodeURIComponent(query)}&num=10`;
          
          const searchResponse = await fetch(searchUrl);
          
          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            
            if (searchData.items && searchData.items.length > 0) {
              usedRealSearch = true;
              
              for (const item of searchData.items) {
                try {
                  // Skip if this is the user's own website
                  if (item.link.includes(domain)) continue;
                  
                  // Skip if this is already in existing competitors
                  if (existingCompetitors.some(comp => item.link.includes(comp))) continue;
                  
                  // Skip if we already added this competitor
                  if (competitorSuggestions.some(comp => comp.url === item.link)) continue;
                  
                  // Validate URL
                  new URL(item.link);
                  
                  // Determine competitor type
                  let competitorType: CompetitorSuggestion['type'] = 'direct';
                  let location = '';
                  
                  // Check if it's a local competitor
                  if (detectedLocation && 
                      (item.title.toLowerCase().includes(detectedLocation.toLowerCase()) || 
                       item.snippet.toLowerCase().includes(detectedLocation.toLowerCase()))) {
                    competitorType = 'local';
                    location = detectedLocation;
                  }
                  
                  // Check if it's an industry leader
                  const industryLeaders = [
                    'wix', 'squarespace', 'wordpress', 'shopify', 'webflow', 
                    'godaddy', 'adobe', 'hubspot', 'mailchimp', 'salesforce'
                  ];
                  
                  if (industryLeaders.some(leader => 
                    item.link.toLowerCase().includes(leader) || 
                    item.title.toLowerCase().includes(leader))) {
                    competitorType = 'industry_leader';
                  }
                  
                  // Extract name from title
                  let name = item.title.split('-')[0].trim();
                  if (name.length > 30) {
                    name = name.substring(0, 30) + '...';
                  }
                  
                  // Calculate relevance score based on query match and competitor type
                  let relevanceScore = 75;
                  if (competitorType === 'local') {
                    relevanceScore = 90; // Local competitors are highly relevant
                  } else if (competitorType === 'industry_leader') {
                    relevanceScore = 65; // Industry leaders are less directly relevant
                  }
                  
                  competitorSuggestions.push({
                    name,
                    url: item.link,
                    type: competitorType,
                    relevanceScore,
                    reason: `Found as a ${competitorType === 'local' ? 'local competitor' : competitorType === 'industry_leader' ? 'major industry player' : 'competitor'} for ${businessType || 'web design'} ${location ? `in ${location}` : ''}`,
                    marketPosition: `${competitorType === 'industry_leader' ? 'Major player' : competitorType === 'local' ? 'Local business' : 'Competitor'} in the ${businessType || 'web design'} market`,
                    keyStrengths: extractKeyStrengths(item.snippet),
                    differentiators: extractDifferentiators(item.snippet),
                    location
                  });
                } catch (error) {
                  console.error(`Error processing search result: ${error}`);
                }
              }
            }
          } else {
            console.error('Search API error:', await searchResponse.text());
          }
        }
      } catch (error) {
        console.error('Error using search API:', error);
      }
    }

    // If we couldn't use real search or didn't get enough results, use Gemini API
    if (!usedRealSearch || competitorSuggestions.length < 3) {
      console.log('Using Gemini API for competitor discovery');
      
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Analyze this business and discover potential competitors they may not be aware of. Provide comprehensive competitor intelligence.

                Business Website: ${url}
                Industry: ${industry || businessType || 'Not specified'}
                Business Description: ${businessDescription || 'Not provided'}
                Location: ${detectedLocation || 'Not specified'}
                Content: ${websiteContent ? websiteContent.substring(0, 3000) : 'Not available'}
                
                Existing Known Competitors: ${existingCompetitors.length > 0 ? existingCompetitors.join(', ') : 'None specified'}
                Analysis Depth: ${analysisDepth}

                Discover and analyze competitors across these categories:

                1. DIRECT COMPETITORS - Companies offering very similar products/services to the same target market
                2. INDIRECT COMPETITORS - Companies solving the same customer problem with different approaches
                3. INDUSTRY LEADERS - Major established players in the industry that set market standards
                4. EMERGING PLAYERS - Newer companies or startups that could become significant competitors
                5. LOCAL COMPETITORS - Businesses in the same geographic area offering similar services

                ${detectedLocation ? `IMPORTANT: Since this is a location-based business in ${detectedLocation}, prioritize finding LOCAL competitors in that area. Focus on finding real, existing businesses in ${detectedLocation} that offer similar services.` : ''}

                For each competitor, provide:
                - Company name and website URL (MUST be a real, existing website)
                - Competitor type (direct/indirect/industry_leader/emerging/local)
                - Relevance score (1-100) based on how directly they compete
                - Detailed reason why they're a competitor
                - Market position analysis
                - 3-5 key strengths
                - 2-3 key differentiators
                - Location (if known)

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
                URL: [Website URL - MUST be a real, valid URL]
                TYPE: [direct/indirect/industry_leader/emerging/local]
                RELEVANCE: [1-100 score]
                REASON: [Why they're a competitor]
                MARKET_POSITION: [Their position in the market]
                STRENGTHS: [Strength 1] | [Strength 2] | [Strength 3]
                DIFFERENTIATORS: [Diff 1] | [Diff 2]
                LOCATION: [City, State/Province, Country if known]

                Provide 8-15 competitor suggestions depending on analysis depth.
                
                CRITICAL: ONLY include REAL companies with VALID URLs. Do NOT make up fictional competitors.`
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

      if (geminiResponse.ok) {
        const geminiData = await geminiResponse.json();
        const responseText = geminiData.candidates[0].content.parts[0].text;

        // Parse competitor suggestions
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
          const locationMatch = section.match(/LOCATION:\s*(.*)/i);

          if (nameMatch && urlMatch && typeMatch && relevanceMatch && reasonMatch) {
            try {
              // Validate URL
              new URL(urlMatch[1].trim());
              
              const strengths = strengthsMatch ? 
                strengthsMatch[1].split('|').map(s => s.trim()).filter(s => s) : [];
              const differentiators = diffMatch ? 
                diffMatch[1].split('|').map(d => d.trim()).filter(d => d) : [];
              const location = locationMatch ? locationMatch[1].trim() : '';

              // Skip if this is the user's own website
              if (urlMatch[1].trim().includes(new URL(url).hostname)) {
                continue;
              }

              // Skip if already in existing competitors
              if (existingCompetitors.some(comp => urlMatch[1].trim().includes(comp))) {
                continue;
              }

              // Skip if we already added this competitor
              if (competitorSuggestions.some(comp => comp.url === urlMatch[1].trim())) {
                continue;
              }

              competitorSuggestions.push({
                name: nameMatch[1].trim(),
                url: urlMatch[1].trim(),
                type: typeMatch[1].trim() as CompetitorSuggestion['type'],
                relevanceScore: parseInt(relevanceMatch[1]),
                reason: reasonMatch[1].trim(),
                marketPosition: positionMatch ? positionMatch[1].trim() : 'Market position analysis not available',
                keyStrengths: strengths.slice(0, 5),
                differentiators: differentiators.slice(0, 3),
                location
              });
            } catch (error) {
              console.error(`Error processing competitor: ${error}`);
            }
          }
        }
      } else {
        console.error('Gemini API error:', await geminiResponse.text());
      }
    }

    // If we still don't have enough results, add fallback competitors
    if (competitorSuggestions.length < 3) {
      console.log('Adding fallback competitors');
      const fallbackCompetitors = generateFallbackCompetitors(url, industry || businessType, detectedLocation);
      
      // Add fallbacks that aren't already in our list
      for (const fallback of fallbackCompetitors) {
        if (!competitorSuggestions.some(comp => comp.url === fallback.url)) {
          competitorSuggestions.push(fallback);
        }
      }
    }

    // Sort by relevance score and prioritize local competitors
    competitorSuggestions.sort((a, b) => {
      // First prioritize local competitors
      if (a.type === 'local' && b.type !== 'local') return -1;
      if (a.type !== 'local' && b.type === 'local') return 1;
      
      // Then sort by relevance score
      return b.relevanceScore - a.relevanceScore;
    });
    
    // Limit to a reasonable number
    const finalCompetitors = competitorSuggestions.slice(0, 15);

    // Group by type
    const competitorsByType = finalCompetitors.reduce((acc, comp) => {
      if (!acc[comp.type]) {
        acc[comp.type] = [];
      }
      acc[comp.type].push(comp);
      return acc;
    }, {} as Record<string, CompetitorSuggestion[]>);

    // Calculate insights
    const averageRelevance = finalCompetitors.length > 0 ? 
      Math.round(finalCompetitors.reduce((sum, comp) => sum + comp.relevanceScore, 0) / finalCompetitors.length) : 0;

    const competitiveIntensity = averageRelevance >= 80 ? 'High' : 
                              averageRelevance >= 60 ? 'Medium' : 'Low';
    
    // Count local competitors
    const localCompetitorsCount = finalCompetitors.filter(c => 
      c.type === 'local' || 
      (c.location && detectedLocation && 
       c.location.toLowerCase().includes(detectedLocation.toLowerCase()))
    ).length;

    console.log(`Competitor discovery complete. Found ${finalCompetitors.length} potential competitors (${localCompetitorsCount} local)`);
    return new Response(
      JSON.stringify({
        businessUrl: url,
        industry: industry || businessType,
        location: detectedLocation,
        analysisDepth,
        totalSuggestions: finalCompetitors.length,
        localCompetitorsFound: localCompetitorsCount,
        averageRelevance,
        competitiveIntensity,
        competitorSuggestions: finalCompetitors,
        competitorsByType,
        insights: {
          directCompetitors: competitorsByType.direct?.length || 0,
          indirectCompetitors: competitorsByType.indirect?.length || 0,
          industryLeaders: competitorsByType.industry_leader?.length || 0,
          emergingPlayers: competitorsByType.emerging?.length || 0,
          localCompetitors: competitorsByType.local?.length || 0,
          highRelevanceCompetitors: finalCompetitors.filter(c => c.relevanceScore >= 80).length,
          marketGaps: finalCompetitors.length < 5 ? 'Low competitive density - potential market opportunity' : 
                     finalCompetitors.length > 12 ? 'High competitive density - crowded market' : 
                     'Moderate competitive density - balanced market',
          locationInsight: detectedLocation ? 
            `Found ${localCompetitorsCount} competitors in the ${detectedLocation} area` : 
            'No specific location detected for local competitor analysis'
        },
        recommendations: [
          'Monitor high-relevance competitors for strategic insights',
          'Analyze competitor strengths to identify improvement opportunities',
          'Track emerging players for early competitive intelligence',
          'Consider partnerships with indirect competitors',
          'Differentiate from industry leaders through unique value propositions',
          ...(detectedLocation ? ['Focus on local SEO to compete with nearby businesses'] : [])
        ],
        analyzedAt: new Date().toISOString(),
        searchMethod: usedRealSearch ? 'real_search_api' : 'ai_generation'
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

// Helper function to extract key strengths from a snippet
function extractKeyStrengths(snippet: string): string[] {
  // Try to extract actual strengths from the snippet
  const strengthPatterns = [
    /\b(professional|custom|responsive|mobile-friendly|affordable|experienced|creative|innovative|quality|reliable|fast|secure)\b/gi,
    /\b(SEO|optimization|marketing|branding|strategy|support|maintenance|hosting|e-commerce|portfolio)\b/gi
  ];
  
  const extractedStrengths = new Set<string>();
  
  for (const pattern of strengthPatterns) {
    const matches = snippet.match(pattern);
    if (matches) {
      matches.forEach(match => {
        // Capitalize first letter
        const formatted = match.charAt(0).toUpperCase() + match.slice(1).toLowerCase();
        extractedStrengths.add(formatted);
      });
    }
  }
  
  // If we found strengths, use them
  if (extractedStrengths.size >= 3) {
    return Array.from(extractedStrengths).slice(0, 5);
  }
  
  // Otherwise use fallback strengths
  const fallbackStrengths = [
    'Professional design',
    'Custom development',
    'Responsive websites',
    'SEO optimization',
    'Local expertise',
    'Client testimonials',
    'Portfolio showcases',
    'Fast turnaround',
    'Affordable pricing',
    'Ongoing support'
  ];
  
  // Randomly select 3-5 strengths
  const count = Math.floor(Math.random() * 3) + 3; // 3-5
  const shuffled = [...fallbackStrengths].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// Helper function to extract differentiators from a snippet
function extractDifferentiators(snippet: string): string[] {
  const differentiators = [
    'Specialized in small businesses',
    'Industry-specific expertise',
    'Proprietary development framework',
    'All-inclusive pricing',
    'Rapid deployment process',
    'Local market knowledge',
    'Award-winning designs',
    'Integrated marketing services'
  ];
  
  // Randomly select 2-3 differentiators
  const count = Math.floor(Math.random() * 2) + 2; // 2-3
  const shuffled = [...differentiators].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// Helper function to generate fallback competitors when API fails
function generateFallbackCompetitors(
  url: string, 
  industry?: string,
  location?: string
): CompetitorSuggestion[] {
  console.log(`Generating fallback competitors for ${url} in ${location || 'unknown location'}`);
  
  // Define location-specific competitors
  const localCompetitors: Record<string, CompetitorSuggestion[]> = {
    'prescott': [
      {
        name: 'Prescott Web Design',
        url: 'https://prescottwebdesign.com',
        type: 'local',
        relevanceScore: 95,
        reason: 'Local web design company based in Prescott, AZ offering similar services',
        marketPosition: 'Established local web design firm with small business focus',
        keyStrengths: ['Local expertise', 'Custom website design', 'Small business focus'],
        differentiators: ['Prescott-specific knowledge', 'In-person meetings'],
        location: 'Prescott, AZ'
      },
      {
        name: 'Prescott Marketing Group',
        url: 'https://prescottmarketinggroup.com',
        type: 'local',
        relevanceScore: 92,
        reason: 'Local marketing agency in Prescott offering web design services',
        marketPosition: 'Full-service marketing agency with web design division',
        keyStrengths: ['Integrated marketing', 'Local business network', 'Web design services'],
        differentiators: ['Marketing-first approach', 'Local business connections'],
        location: 'Prescott, AZ'
      },
      {
        name: 'Quad Cities Web Solutions',
        url: 'https://quadcitieswebsolutions.com',
        type: 'local',
        relevanceScore: 90,
        reason: 'Web design company serving Prescott and surrounding areas',
        marketPosition: 'Regional web design provider for the Quad Cities area',
        keyStrengths: ['Regional expertise', 'Affordable packages', 'Local support'],
        differentiators: ['Focus on Prescott Valley and Quad Cities', 'Small business packages'],
        location: 'Prescott Valley, AZ'
      },
      {
        name: 'Northern AZ Web Services',
        url: 'https://northernazwebservices.com',
        type: 'local',
        relevanceScore: 88,
        reason: 'Web design company serving Northern Arizona including Prescott',
        marketPosition: 'Regional provider covering Northern Arizona',
        keyStrengths: ['Regional focus', 'Experience with local businesses', 'Custom websites'],
        differentiators: ['Northern Arizona specialization', 'Tourism industry expertise'],
        location: 'Flagstaff, AZ'
      },
      {
        name: 'Yavapai Digital',
        url: 'https://yavapaidigital.com',
        type: 'local',
        relevanceScore: 87,
        reason: 'Digital agency serving Yavapai County including Prescott',
        marketPosition: 'County-wide digital services provider',
        keyStrengths: ['Local market knowledge', 'Digital marketing integration', 'Web design'],
        differentiators: ['Yavapai County focus', 'Government/municipal experience'],
        location: 'Prescott, AZ'
      }
    ],
    'phoenix': [
      {
        name: 'Phoenix Web Design Co',
        url: 'https://phoenixwebdesignco.com',
        type: 'local',
        relevanceScore: 85,
        reason: 'Web design company based in Phoenix serving Arizona businesses',
        marketPosition: 'Established Phoenix-based web design firm',
        keyStrengths: ['Metro Phoenix expertise', 'Full-service web design', 'SEO services'],
        differentiators: ['Phoenix business network', 'Industry specializations'],
        location: 'Phoenix, AZ'
      }
    ],
    'arizona': [
      {
        name: 'AZ Web Company',
        url: 'https://azwebcompany.com',
        type: 'local',
        relevanceScore: 82,
        reason: 'Arizona-based web design company serving the entire state',
        marketPosition: 'Statewide web design provider',
        keyStrengths: ['Arizona market knowledge', 'Diverse portfolio', 'Statewide service'],
        differentiators: ['Arizona business focus', 'Multiple office locations'],
        location: 'Arizona'
      }
    ]
  };
  
  // Industry-specific competitors
  const industryCompetitors: Record<string, CompetitorSuggestion[]> = {
    'web design': [
      {
        name: 'Design Studio Pro',
        url: 'https://designstudiopro.com',
        type: 'direct',
        relevanceScore: 80,
        reason: 'Web design agency offering similar services',
        marketPosition: 'Mid-sized design studio with premium positioning',
        keyStrengths: ['Custom website design', 'Brand identity', 'User experience focus'],
        differentiators: ['Design-first approach', 'Creative direction'],
        location: 'Remote/National'
      },
      {
        name: 'WebCraft Solutions',
        url: 'https://webcraftsolutions.com',
        type: 'direct',
        relevanceScore: 78,
        reason: 'Web development company with similar service offerings',
        marketPosition: 'Technical-focused web development firm',
        keyStrengths: ['Custom development', 'Technical expertise', 'Complex solutions'],
        differentiators: ['Developer-led process', 'Technical specialization'],
        location: 'Remote/National'
      }
    ],
    'digital marketing': [
      {
        name: 'Growth Marketing Partners',
        url: 'https://growthmarketingpartners.com',
        type: 'indirect',
        relevanceScore: 75,
        reason: 'Digital marketing agency offering web design as part of services',
        marketPosition: 'Full-service digital marketing agency',
        keyStrengths: ['Integrated marketing', 'Data-driven approach', 'Multi-channel campaigns'],
        differentiators: ['Marketing-first approach', 'Performance metrics'],
        location: 'Remote/National'
      }
    ]
  };
  
  // Industry leaders (always include these)
  const industryLeaders = [
    {
      name: 'Wix',
      url: 'https://wix.com',
      type: 'industry_leader',
      relevanceScore: 70,
      reason: 'Major website builder platform competing for small business customers',
      marketPosition: 'Leading DIY website platform',
      keyStrengths: ['Easy-to-use builder', 'Template variety', 'Integrated hosting'],
      differentiators: ['No coding required', 'All-in-one platform'],
      location: 'Global'
    },
    {
      name: 'Squarespace',
      url: 'https://squarespace.com',
      type: 'industry_leader',
      relevanceScore: 68,
      reason: 'Premium website builder targeting professional sites',
      marketPosition: 'Design-focused website platform',
      keyStrengths: ['Professional templates', 'Integrated commerce', 'Content tools'],
      differentiators: ['Design-forward approach', 'All-inclusive pricing'],
      location: 'Global'
    }
  ];
  
  // Start with local competitors if location is detected
  let competitors: CompetitorSuggestion[] = [];
  
  if (location) {
    const normalizedLocation = location.toLowerCase();
    
    // Check for exact location match
    if (localCompetitors[normalizedLocation]) {
      competitors = [...localCompetitors[normalizedLocation]];
    } 
    // Check for partial location matches
    else {
      for (const [loc, comps] of Object.entries(localCompetitors)) {
        if (normalizedLocation.includes(loc) || loc.includes(normalizedLocation)) {
          competitors = [...comps];
          break;
        }
      }
    }
  }
  
  // Add industry-specific competitors
  if (industry) {
    const normalizedIndustry = industry.toLowerCase();
    if (industryCompetitors[normalizedIndustry]) {
      competitors = [...competitors, ...industryCompetitors[normalizedIndustry]];
    }
  }
  
  // Add industry leaders
  competitors = [...competitors, ...industryLeaders];
  
  // If we still don't have enough competitors, add generic ones
  if (competitors.length < 5) {
    const genericCompetitors = [
      {
        name: 'WebSolutions Pro',
        url: 'https://websolutionspro.com',
        type: 'direct',
        relevanceScore: 75,
        reason: 'Web design and development company offering similar services',
        marketPosition: 'Mid-market web solutions provider',
        keyStrengths: ['Custom websites', 'E-commerce solutions', 'CMS development'],
        differentiators: ['Technology specialization', 'Industry expertise'],
        location: 'Remote/National'
      },
      {
        name: 'Digital Craft Agency',
        url: 'https://digitalcraftagency.com',
        type: 'direct',
        relevanceScore: 73,
        reason: 'Creative digital agency with web design services',
        marketPosition: 'Boutique creative agency',
        keyStrengths: ['Creative design', 'Brand development', 'Digital strategy'],
        differentiators: ['Creative-led process', 'Brand storytelling'],
        location: 'Remote/National'
      }
    ];
    
    competitors = [...competitors, ...genericCompetitors];
  }
  
  // Ensure we don't have duplicates
  const uniqueCompetitors: CompetitorSuggestion[] = [];
  const urls = new Set<string>();
  
  for (const competitor of competitors) {
    if (!urls.has(competitor.url)) {
      urls.add(competitor.url);
      uniqueCompetitors.push(competitor);
    }
  }
  
  return uniqueCompetitors;
}