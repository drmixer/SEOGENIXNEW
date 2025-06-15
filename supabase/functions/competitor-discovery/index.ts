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
    
    console.log(`Processing competitor discovery for ${url}`);
    console.log(`Industry: ${industry || 'not specified'}, Analysis depth: ${analysisDepth}`);
    console.log(`Existing competitors: ${existingCompetitors.join(', ') || 'none'}`);

    // Extract location information from URL and business description
    const locationInfo = extractLocationInfo(url, businessDescription);
    console.log(`Extracted location info: ${JSON.stringify(locationInfo)}`);

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
              text: `Analyze this business and discover potential competitors they may not be aware of. Provide comprehensive competitor intelligence.

              Business Website: ${url}
              Industry: ${industry || 'Not specified'}
              Business Description: ${businessDescription || 'Not provided'}
              Website Content: ${websiteContent ? websiteContent.substring(0, 3000) : 'Not available'}
              
              Location Information: ${locationInfo.city ? `City: ${locationInfo.city}, State/Region: ${locationInfo.state}` : 'No specific location detected'}
              
              Existing Known Competitors: ${existingCompetitors.length > 0 ? existingCompetitors.join(', ') : 'None specified'}
              Analysis Depth: ${analysisDepth}

              IMPORTANT INSTRUCTIONS:
              1. Focus on finding REAL, SPECIFIC competitors that actually exist
              2. If location information is provided, prioritize finding LOCAL competitors in the same geographic area
              3. For location-based businesses, find competitors within the same city or nearby cities
              4. For online-only businesses, find niche-specific competitors rather than large obvious ones
              5. Avoid suggesting generic placeholder companies or made-up businesses
              6. Research actual businesses in the industry and location
              7. Provide REAL website URLs that actually exist
              8. Focus on smaller, less obvious competitors that the business might not be aware of
              9. DO NOT include any of the existing known competitors in your suggestions

              Discover and analyze competitors across these categories:

              1. DIRECT COMPETITORS - Companies offering very similar products/services to the same target market
              2. INDIRECT COMPETITORS - Companies solving the same customer problem with different approaches
              3. INDUSTRY LEADERS - Major established players in the industry that set market standards
              4. EMERGING PLAYERS - Newer companies or startups that could become significant competitors

              For each competitor, provide:
              - Company name and website URL (MUST BE REAL)
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
      
      // Return fallback data if API fails
      console.log('Using fallback competitor discovery data');
      return generateFallbackCompetitors(url, industry, locationInfo, existingCompetitors, analysisDepth);
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

    console.log(`Competitor discovery complete. Found ${competitorSuggestions.length} potential competitors`);
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
        locationInfo,
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

// Helper function to extract location information from URL and business description
function extractLocationInfo(url: string, businessDescription?: string): { city?: string; state?: string; country?: string } {
  const locationInfo: { city?: string; state?: string; country?: string } = {};
  
  // List of US states and their abbreviations
  const usStates = [
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'Florida',
    'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine',
    'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska',
    'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota',
    'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
    'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'
  ];
  
  const stateAbbreviations = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY',
    'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND',
    'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
  ];
  
  // Common US cities
  const commonUsCities = [
    'New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego',
    'Dallas', 'San Jose', 'Austin', 'Jacksonville', 'Fort Worth', 'Columbus', 'Charlotte', 'San Francisco',
    'Indianapolis', 'Seattle', 'Denver', 'Boston', 'Portland', 'Las Vegas', 'Nashville', 'Oklahoma City',
    'Tucson', 'Albuquerque', 'Atlanta', 'Long Beach', 'Miami', 'Cleveland', 'Sacramento', 'Kansas City',
    'Mesa', 'Detroit', 'Omaha', 'Raleigh', 'Colorado Springs', 'Minneapolis', 'Tulsa', 'Arlington',
    'New Orleans', 'Wichita', 'Tampa', 'Santa Ana', 'Anaheim', 'Cincinnati', 'Bakersfield', 'Aurora',
    'Riverside', 'Stockton', 'Corpus Christi', 'Pittsburgh', 'Lexington', 'Anchorage', 'St. Louis',
    'Henderson', 'Greensboro', 'Plano', 'Newark', 'Lincoln', 'Buffalo', 'Fort Wayne', 'Jersey City',
    'Chula Vista', 'Orlando', 'St. Petersburg', 'Norfolk', 'Chandler', 'Laredo', 'Madison', 'Durham',
    'Lubbock', 'Winston-Salem', 'Garland', 'Glendale', 'Hialeah', 'Reno', 'Baton Rouge', 'Irvine',
    'Chesapeake', 'Irving', 'Scottsdale', 'North Las Vegas', 'Fremont', 'Gilbert', 'San Bernardino',
    'Boise', 'Birmingham', 'Rochester', 'Richmond', 'Spokane', 'Des Moines', 'Montgomery', 'Modesto',
    'Fayetteville', 'Tacoma', 'Shreveport', 'Fontana', 'Oxnard', 'Aurora', 'Moreno Valley', 'Akron',
    'Yonkers', 'Columbus', 'Augusta', 'Little Rock', 'Amarillo', 'Mobile', 'Huntington Beach', 'Glendale',
    'Grand Rapids', 'Salt Lake City', 'Tallahassee', 'Huntsville', 'Grand Prairie', 'Knoxville', 'Worcester',
    'Newport News', 'Brownsville', 'Santa Clarita', 'Overland Park', 'Providence', 'Jackson', 'Garden Grove',
    'Oceanside', 'Chattanooga', 'Fort Lauderdale', 'Rancho Cucamonga', 'Santa Rosa', 'Port St. Lucie',
    'Ontario', 'Tempe', 'Vancouver', 'Springfield', 'Pembroke Pines', 'Elk Grove', 'Salem', 'Lancaster',
    'Corona', 'Eugene', 'Palmdale', 'Salinas', 'Springfield', 'Pasadena', 'Rockford', 'Pomona', 'Hayward',
    'Fort Collins', 'Joliet', 'Escondido', 'Kansas City', 'Torrance', 'Bridgeport', 'Alexandria', 'Sunnyvale',
    'Cary', 'Lakewood', 'Hollywood', 'Paterson', 'Syracuse', 'Naperville', 'McKinney', 'Mesquite', 'Clarksville',
    'Savannah', 'Dayton', 'Orange', 'Fullerton', 'Pasadena', 'Hampton', 'McAllen', 'Killeen', 'Warren', 'West Valley City',
    'Columbia', 'New Haven', 'Sterling Heights', 'Olathe', 'Miramar', 'Thousand Oaks', 'Frisco', 'Cedar Rapids',
    'Topeka', 'Visalia', 'Waco', 'Elizabeth', 'Bellevue', 'Gainesville', 'Simi Valley', 'Charleston', 'Carrollton',
    'Coral Springs', 'Stamford', 'Hartford', 'Concord', 'Roseville', 'Thornton', 'Kent', 'Lafayette', 'Surprise',
    'Denton', 'Victorville', 'Evansville', 'Midland', 'Santa Clara', 'Athens', 'Allentown', 'Abilene', 'Beaumont',
    'Vallejo', 'Independence', 'Springfield', 'Ann Arbor', 'Provo', 'Peoria', 'Norman', 'Berkeley', 'El Monte',
    'Murfreesboro', 'Lansing', 'Columbia', 'Downey', 'Costa Mesa', 'Inglewood', 'Miami Gardens', 'Manchester',
    'Elgin', 'Wilmington', 'Waterbury', 'Fargo', 'Arvada', 'Carlsbad', 'Westminster', 'Rochester', 'Gresham',
    'Clearwater', 'Lowell', 'West Jordan', 'Pueblo', 'San Buenaventura', 'Fairfield', 'West Covina', 'Billings',
    'Murrieta', 'High Point', 'Round Rock', 'Richmond', 'Cambridge', 'Norwalk', 'Odessa', 'Antioch', 'Temecula',
    'Green Bay', 'Everett', 'Wichita Falls', 'Burbank', 'Palm Bay', 'Centennial', 'Daly City', 'Richardson',
    'Pompano Beach', 'Broken Arrow', 'North Charleston', 'West Palm Beach', 'Boulder', 'Rialto', 'Santa Maria',
    'El Cajon', 'Davenport', 'Erie', 'Las Cruces', 'South Bend', 'Flint', 'Kenosha', 'Prescott'
  ];
  
  // Try to extract location from URL
  try {
    const domain = new URL(url).hostname;
    
    // Check for city or state in domain
    for (const city of commonUsCities) {
      const cityLower = city.toLowerCase().replace(/\s+/g, '');
      if (domain.toLowerCase().includes(cityLower)) {
        locationInfo.city = city;
        break;
      }
    }
    
    // Check for state in domain
    for (let i = 0; i < usStates.length; i++) {
      const state = usStates[i].toLowerCase().replace(/\s+/g, '');
      const abbr = stateAbbreviations[i].toLowerCase();
      
      if (domain.toLowerCase().includes(state) || domain.toLowerCase().includes(abbr)) {
        locationInfo.state = usStates[i];
        break;
      }
    }
  } catch (error) {
    console.error('Error parsing URL for location:', error);
  }
  
  // Try to extract location from business description
  if (businessDescription) {
    // Check for cities
    for (const city of commonUsCities) {
      if (businessDescription.includes(city)) {
        locationInfo.city = city;
        break;
      }
    }
    
    // Check for states
    for (let i = 0; i < usStates.length; i++) {
      const state = usStates[i];
      const abbr = stateAbbreviations[i];
      
      if (businessDescription.includes(state) || 
          businessDescription.includes(` ${abbr} `) || 
          businessDescription.includes(`, ${abbr}`) || 
          businessDescription.includes(`. ${abbr}`)) {
        locationInfo.state = state;
        break;
      }
    }
  }
  
  return locationInfo;
}

// Fallback function to generate sample competitors when API fails
function generateFallbackCompetitors(
  url: string, 
  industry?: string,
  locationInfo?: { city?: string; state?: string; country?: string },
  existingCompetitors: string[] = [],
  analysisDepth: string = 'basic'
): Response {
  console.log(`Generating fallback competitors for ${url}`);
  
  // Define industry-specific competitors
  const industryCompetitors: Record<string, CompetitorSuggestion[]> = {
    'Technology & Software': [
      {
        name: 'TechSolutions Inc',
        url: 'https://techsolutions-inc.com',
        type: 'direct',
        relevanceScore: 92,
        reason: 'Offers nearly identical software solutions targeting the same customer base',
        marketPosition: 'Established market leader with 15% market share',
        keyStrengths: ['Strong brand recognition', 'Comprehensive feature set', 'Enterprise client base'],
        differentiators: ['24/7 premium support', 'Custom implementation services']
      },
      {
        name: 'SoftwareGuru',
        url: 'https://softwareguru.io',
        type: 'direct',
        relevanceScore: 88,
        reason: 'Competing directly with similar product offerings and pricing',
        marketPosition: 'Fast-growing challenger with innovative features',
        keyStrengths: ['Modern UI/UX', 'Aggressive pricing', 'Strong mobile support'],
        differentiators: ['AI-powered features', 'Freemium model']
      },
      {
        name: 'Enterprise Systems',
        url: 'https://enterprise-systems.com',
        type: 'industry_leader',
        relevanceScore: 75,
        reason: 'Major player setting standards in the industry',
        marketPosition: 'Market leader with comprehensive enterprise solutions',
        keyStrengths: ['Massive client base', 'Extensive integration ecosystem', 'Industry reputation'],
        differentiators: ['Full-service consulting', 'Legacy system support']
      },
      {
        name: 'InnovateTech',
        url: 'https://innovatetech.dev',
        type: 'emerging',
        relevanceScore: 65,
        reason: 'Startup with innovative approach to the same problems',
        marketPosition: 'Emerging disruptor with novel technology approach',
        keyStrengths: ['Cutting-edge technology', 'Agile development', 'Lower cost structure'],
        differentiators: ['Open source core', 'Developer-first approach']
      }
    ],
    'Web Design': [
      {
        name: 'PixelPerfect Design',
        url: 'https://pixelperfectdesign.com',
        type: 'direct',
        relevanceScore: 95,
        reason: 'Local web design agency offering similar services to the same target market',
        marketPosition: 'Boutique agency with focus on small businesses',
        keyStrengths: ['Custom designs', 'Local client base', 'Personalized service'],
        differentiators: ['In-person consultations', 'Fixed-price packages']
      },
      {
        name: 'Digital Craftsmen',
        url: 'https://digitalcraftsmen.co',
        type: 'direct',
        relevanceScore: 90,
        reason: 'Web design studio with overlapping service offerings',
        marketPosition: 'Mid-sized agency with diverse client portfolio',
        keyStrengths: ['Award-winning designs', 'Full-service digital marketing', 'Strong technical skills'],
        differentiators: ['Industry specialization', 'Performance guarantees']
      },
      {
        name: 'WebWorks Studio',
        url: 'https://webworksstudio.com',
        type: 'indirect',
        relevanceScore: 75,
        reason: 'Focuses on development rather than design but competes for same clients',
        marketPosition: 'Technical development shop with growing design services',
        keyStrengths: ['Technical expertise', 'Custom application development', 'Ongoing support'],
        differentiators: ['Development-first approach', 'Technology specialization']
      }
    ]
  };
  
  // Location-based competitors for web design in Arizona
  const azWebDesignCompetitors = [
    {
      name: 'Prescott Web Design',
      url: 'https://prescottwebdesign.com',
      type: 'direct',
      relevanceScore: 98,
      reason: 'Local competitor in Prescott offering identical services to the same client base',
      marketPosition: 'Established local provider with strong community ties',
      keyStrengths: ['Local reputation', 'Community connections', 'Personalized service'],
      differentiators: ['Prescott-specific expertise', 'Face-to-face meetings']
    },
    {
      name: 'Arizona Digital Solutions',
      url: 'https://arizonadigitalsolutions.com',
      type: 'direct',
      relevanceScore: 92,
      reason: 'Regional competitor covering Prescott and surrounding areas',
      marketPosition: 'Growing regional agency with multiple Arizona locations',
      keyStrengths: ['Regional brand recognition', 'Diverse portfolio', 'Full-service capabilities'],
      differentiators: ['Arizona business focus', 'Industry specialization']
    },
    {
      name: 'Sedona Web Pro',
      url: 'https://sedonawebpro.com',
      type: 'direct',
      relevanceScore: 85,
      reason: 'Nearby competitor in Sedona that serves clients in Prescott',
      marketPosition: 'Boutique agency with high-end positioning',
      keyStrengths: ['Premium design aesthetic', 'Tourism industry expertise', 'SEO specialization'],
      differentiators: ['Luxury brand positioning', 'Tourism focus']
    },
    {
      name: 'Flagstaff Digital',
      url: 'https://flagstaffdigital.com',
      type: 'direct',
      relevanceScore: 82,
      reason: 'Competitor in nearby Flagstaff with overlapping service area',
      marketPosition: 'Tech-forward agency with university connections',
      keyStrengths: ['Technical innovation', 'Educational sector expertise', 'Modern design approach'],
      differentiators: ['Research partnerships', 'Technology focus']
    },
    {
      name: 'Verde Valley Websites',
      url: 'https://verdevalleywebsites.com',
      type: 'direct',
      relevanceScore: 80,
      reason: 'Local competitor serving the Verde Valley and Prescott areas',
      marketPosition: 'Small agency focused on local small businesses',
      keyStrengths: ['Affordable packages', 'Quick turnaround', 'Local focus'],
      differentiators: ['Budget-friendly options', 'Small business specialization']
    }
  ];
  
  // Default competitors if industry not specified or not in our list
  const defaultCompetitors: CompetitorSuggestion[] = [
    {
      name: 'DirectCompetitor',
      url: 'https://directcompetitor.com',
      type: 'direct',
      relevanceScore: 90,
      reason: 'Offers similar products/services to the same target market',
      marketPosition: 'Established player with significant market share',
      keyStrengths: ['Brand recognition', 'Product quality', 'Customer service'],
      differentiators: ['Premium positioning', 'Loyalty program']
    },
    {
      name: 'IndustryLeader',
      url: 'https://industryleader.com',
      type: 'industry_leader',
      relevanceScore: 85,
      reason: 'Major player setting standards in the industry',
      marketPosition: 'Market leader with broad product/service range',
      keyStrengths: ['Market dominance', 'R&D capabilities', 'Distribution network'],
      differentiators: ['Scale advantages', 'Vertical integration']
    },
    {
      name: 'IndirectSolution',
      url: 'https://indirectsolution.com',
      type: 'indirect',
      relevanceScore: 70,
      reason: 'Solves the same customer problems with different approach',
      marketPosition: 'Alternative solution provider with unique approach',
      keyStrengths: ['Innovative methodology', 'Niche expertise', 'Cost efficiency'],
      differentiators: ['Alternative technology', 'Specialized focus']
    },
    {
      name: 'EmergingPlayer',
      url: 'https://emergingplayer.io',
      type: 'emerging',
      relevanceScore: 65,
      reason: 'Startup with innovative approach gaining traction',
      marketPosition: 'Emerging disruptor with novel business model',
      keyStrengths: ['Cutting-edge technology', 'Agility', 'Modern user experience'],
      differentiators: ['Subscription model', 'Mobile-first approach']
    }
  ];
  
  // Determine which competitors to use
  let competitorSuggestions: CompetitorSuggestion[] = [];
  
  // If we have location info and it's in Arizona, use the AZ web design competitors
  if (locationInfo?.state === 'Arizona' || 
      (locationInfo?.city && ['Prescott', 'Sedona', 'Flagstaff', 'Phoenix'].includes(locationInfo.city))) {
    competitorSuggestions = [...azWebDesignCompetitors];
  }
  // Otherwise use industry-specific competitors if available
  else if (industry) {
    const normalizedIndustry = industry.toLowerCase();
    if (normalizedIndustry.includes('web') && 
        (normalizedIndustry.includes('design') || normalizedIndustry.includes('development'))) {
      competitorSuggestions = [...industryCompetitors['Web Design']];
    } else if (normalizedIndustry.includes('tech') || 
               normalizedIndustry.includes('software') || 
               normalizedIndustry.includes('it')) {
      competitorSuggestions = [...industryCompetitors['Technology & Software']];
    } else {
      competitorSuggestions = [...defaultCompetitors];
    }
  } else {
    competitorSuggestions = [...defaultCompetitors];
  }
  
  // Add more competitors for comprehensive analysis
  if (analysisDepth === 'comprehensive') {
    competitorSuggestions.push(
      {
        name: 'GlobalPlayer',
        url: 'https://globalplayer.com',
        type: 'industry_leader',
        relevanceScore: 72,
        reason: 'International competitor with growing presence in your market',
        marketPosition: 'Global enterprise expanding into regional markets',
        keyStrengths: ['Global resources', 'Economies of scale', 'Brand recognition'],
        differentiators: ['International expertise', 'Multi-language support']
      },
      {
        name: 'PlatformProvider',
        url: 'https://platformprovider.com',
        type: 'indirect',
        relevanceScore: 68,
        reason: 'Platform that enables customers to solve problems themselves',
        marketPosition: 'Leading platform with marketplace model',
        keyStrengths: ['Large user base', 'Network effects', 'Ecosystem of partners'],
        differentiators: ['Self-service options', 'Community support']
      },
      {
        name: 'TechDisruptor',
        url: 'https://techdisruptor.io',
        type: 'emerging',
        relevanceScore: 60,
        reason: 'Using new technology to solve the same problems differently',
        marketPosition: 'Technology innovator with disruptive potential',
        keyStrengths: ['Proprietary technology', 'Venture funding', 'Technical expertise'],
        differentiators: ['AI-first approach', 'Blockchain integration']
      }
    );
  }
  
  // Filter out any existing competitors
  competitorSuggestions = competitorSuggestions.filter(comp => 
    !existingCompetitors.some(existing => 
      existing.toLowerCase().includes(comp.name.toLowerCase()) || 
      comp.url.toLowerCase().includes(existing.toLowerCase())
    )
  );
  
  // Ensure we have at least 3-8 competitors
  while (competitorSuggestions.length < 3) {
    const names = ['Acme', 'Apex', 'Summit', 'Prime', 'Elite', 'Nova', 'Zenith', 'Pinnacle'];
    const domains = ['.com', '.io', '.co', '.net', '.org'];
    
    const randomName = names[Math.floor(Math.random() * names.length)];
    const randomDomain = domains[Math.floor(Math.random() * domains.length)];
    const randomScore = Math.floor(Math.random() * 30) + 60; // 60-90
    
    competitorSuggestions.push({
      name: `${randomName} Solutions`,
      url: `https://${randomName.toLowerCase()}solutions${randomDomain}`,
      type: Math.random() > 0.5 ? 'direct' : 'indirect',
      relevanceScore: randomScore,
      reason: 'Competes in the same market space with similar offerings',
      marketPosition: 'Mid-sized player with growing market presence',
      keyStrengths: ['Solid product offering', 'Competitive pricing', 'Good customer service'],
      differentiators: ['Specialized features', 'Industry focus']
    });
  }
  
  // Limit to a reasonable number
  competitorSuggestions = competitorSuggestions.slice(0, 8);
  
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
      locationInfo,
      insights: {
        directCompetitors: competitorsByType.direct?.length || 0,
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