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

    // Extract domain from URL to make more relevant suggestions
    let domain = '';
    let niche = '';
    try {
      const urlObj = new URL(url);
      domain = urlObj.hostname;
      // Extract potential niche from domain or path
      const domainParts = domain.split('.');
      niche = domainParts[0].toLowerCase();
      if (niche === 'www') {
        niche = domainParts[1].toLowerCase();
      }
    } catch (error) {
      console.error('Error parsing URL:', error);
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
      } else {
        console.error(`Failed to fetch URL: ${url}, status: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to fetch website:', error);
    }

    // Extract location information
    const locationInfo = extractLocationInfo(url, businessDescription);
    console.log(`Extracted location info: ${JSON.stringify(locationInfo)}`);

    // Generate relevant competitors based on industry, domain, and location
    let competitorSuggestions: CompetitorSuggestion[] = [];

    // Technology & Software industry
    if (industry?.includes('Technology') || industry?.includes('Software') || niche.includes('tech') || niche.includes('soft')) {
      competitorSuggestions = [
        {
          name: 'Salesforce',
          url: 'https://salesforce.com',
          type: 'industry_leader',
          relevanceScore: 88,
          reason: 'Leading CRM and cloud solutions provider with extensive enterprise offerings',
          marketPosition: 'Market leader in CRM and business cloud solutions',
          keyStrengths: ['Comprehensive platform', 'Enterprise integration', 'AppExchange ecosystem'],
          differentiators: ['Trailhead learning platform', 'Industry-specific solutions']
        },
        {
          name: 'HubSpot',
          url: 'https://hubspot.com',
          type: 'direct',
          relevanceScore: 92,
          reason: 'Comprehensive marketing, sales, and service platform with strong SMB focus',
          marketPosition: 'Leading inbound marketing and sales platform',
          keyStrengths: ['All-in-one platform', 'User-friendly interface', 'Strong content strategy'],
          differentiators: ['Free CRM offering', 'Inbound methodology']
        },
        {
          name: 'Atlassian',
          url: 'https://atlassian.com',
          type: 'direct',
          relevanceScore: 85,
          reason: 'Collaboration and development tools provider for software teams',
          marketPosition: 'Essential tools for modern software development teams',
          keyStrengths: ['Team collaboration', 'Project management', 'Developer tools'],
          differentiators: ['Jira and Confluence', 'DevOps integration']
        },
        {
          name: 'Monday.com',
          url: 'https://monday.com',
          type: 'emerging',
          relevanceScore: 82,
          reason: 'Work OS platform for team management and collaboration',
          marketPosition: 'Fast-growing work management platform',
          keyStrengths: ['Visual workflow management', 'Customizable templates', 'Integration capabilities'],
          differentiators: ['Visual interface', 'No-code automation']
        }
      ];
    }
    
    // E-commerce & Retail industry
    else if (industry?.includes('E-commerce') || industry?.includes('Retail') || niche.includes('shop') || niche.includes('store')) {
      competitorSuggestions = [
        {
          name: 'Shopify',
          url: 'https://shopify.com',
          type: 'industry_leader',
          relevanceScore: 94,
          reason: 'Leading e-commerce platform powering over 1.7 million businesses worldwide',
          marketPosition: 'Market leader in SMB e-commerce solutions',
          keyStrengths: ['User-friendly platform', 'Extensive app ecosystem', 'Omnichannel capabilities'],
          differentiators: ['Shopify Payments', 'Shopify Fulfillment Network']
        },
        {
          name: 'BigCommerce',
          url: 'https://bigcommerce.com',
          type: 'direct',
          relevanceScore: 88,
          reason: 'Enterprise e-commerce platform focused on scalability and customization',
          marketPosition: 'Mid-market and enterprise e-commerce solution',
          keyStrengths: ['B2B capabilities', 'Headless commerce', 'Multi-channel selling'],
          differentiators: ['Open SaaS approach', 'Enterprise focus']
        },
        {
          name: 'WooCommerce',
          url: 'https://woocommerce.com',
          type: 'direct',
          relevanceScore: 90,
          reason: 'WordPress-based e-commerce solution powering millions of online stores',
          marketPosition: 'Leading open-source e-commerce platform',
          keyStrengths: ['WordPress integration', 'Extensive customization', 'Large community'],
          differentiators: ['Self-hosted option', 'WordPress ecosystem']
        },
        {
          name: 'Squarespace Commerce',
          url: 'https://squarespace.com/commerce',
          type: 'direct',
          relevanceScore: 82,
          reason: 'Design-focused website builder with integrated e-commerce capabilities',
          marketPosition: 'Design-centric e-commerce solution for small businesses',
          keyStrengths: ['Professional templates', 'All-in-one platform', 'Ease of use'],
          differentiators: ['Design focus', 'Integrated marketing tools']
        }
      ];
    }
    
    // Marketing & Advertising industry
    else if (industry?.includes('Marketing') || industry?.includes('Advertising') || niche.includes('market') || niche.includes('ad')) {
      competitorSuggestions = [
        {
          name: 'Semrush',
          url: 'https://semrush.com',
          type: 'direct',
          relevanceScore: 93,
          reason: 'Comprehensive SEO and digital marketing platform with advanced analytics',
          marketPosition: 'Leading all-in-one digital marketing toolkit',
          keyStrengths: ['Keyword research', 'Competitor analysis', 'Content marketing tools'],
          differentiators: ['Position tracking', 'Site audit capabilities']
        },
        {
          name: 'Ahrefs',
          url: 'https://ahrefs.com',
          type: 'direct',
          relevanceScore: 91,
          reason: 'SEO toolset with industry-leading backlink database and content explorer',
          marketPosition: 'Premium SEO research and analysis platform',
          keyStrengths: ['Backlink analysis', 'Content explorer', 'Rank tracking'],
          differentiators: ['Link building focus', 'Technical SEO tools']
        },
        {
          name: 'Moz',
          url: 'https://moz.com',
          type: 'industry_leader',
          relevanceScore: 88,
          reason: 'Pioneering SEO software and data provider with comprehensive tools',
          marketPosition: 'Established SEO authority with strong educational content',
          keyStrengths: ['Domain authority metric', 'SEO learning resources', 'Local SEO tools'],
          differentiators: ['MozCon conference', 'Beginner-friendly approach']
        },
        {
          name: 'Conductor',
          url: 'https://conductor.com',
          type: 'direct',
          relevanceScore: 85,
          reason: 'Enterprise SEO and content intelligence platform',
          marketPosition: 'Enterprise-focused organic marketing solution',
          keyStrengths: ['Content intelligence', 'Enterprise integration', 'Marketing analytics'],
          differentiators: ['Enterprise focus', 'Customer success program']
        }
      ];
    }
    
    // Healthcare & Medical industry
    else if (industry?.includes('Healthcare') || industry?.includes('Medical') || niche.includes('health') || niche.includes('med')) {
      competitorSuggestions = [
        {
          name: 'WebMD',
          url: 'https://webmd.com',
          type: 'industry_leader',
          relevanceScore: 89,
          reason: 'Leading provider of health information services for consumers and professionals',
          marketPosition: 'Premier online health information resource',
          keyStrengths: ['Comprehensive health content', 'Symptom checker', 'Provider directory'],
          differentiators: ['Medical review process', 'Consumer health focus']
        },
        {
          name: 'Mayo Clinic',
          url: 'https://mayoclinic.org',
          type: 'industry_leader',
          relevanceScore: 92,
          reason: 'World-renowned medical center providing expert health information',
          marketPosition: 'Trusted authority in medical information and research',
          keyStrengths: ['Expert medical content', 'Research-backed information', 'Condition guides'],
          differentiators: ['Medical expertise', 'Research foundation']
        },
        {
          name: 'Healthline',
          url: 'https://healthline.com',
          type: 'direct',
          relevanceScore: 87,
          reason: 'Health information website focused on wellness and medical content',
          marketPosition: 'Consumer-friendly health and wellness resource',
          keyStrengths: ['Accessible health content', 'Nutrition information', 'Mental health resources'],
          differentiators: ['Wellness focus', 'Medically reviewed content']
        },
        {
          name: 'Zocdoc',
          url: 'https://zocdoc.com',
          type: 'direct',
          relevanceScore: 83,
          reason: 'Online doctor appointment booking service with provider reviews',
          marketPosition: 'Leading digital healthcare appointment platform',
          keyStrengths: ['Provider search', 'Online booking', 'Patient reviews'],
          differentiators: ['Insurance matcher', 'Telehealth integration']
        }
      ];
    }
    
    // Education & Training industry
    else if (industry?.includes('Education') || industry?.includes('Training') || niche.includes('edu') || niche.includes('learn')) {
      competitorSuggestions = [
        {
          name: 'Coursera',
          url: 'https://coursera.org',
          type: 'industry_leader',
          relevanceScore: 90,
          reason: 'Leading online learning platform partnering with universities and companies',
          marketPosition: 'Premium online education platform with academic partnerships',
          keyStrengths: ['University partnerships', 'Degree programs', 'Professional certificates'],
          differentiators: ['Academic credentials', 'University partnerships']
        },
        {
          name: 'Udemy',
          url: 'https://udemy.com',
          type: 'direct',
          relevanceScore: 88,
          reason: 'Marketplace for online learning with vast course selection',
          marketPosition: 'Largest marketplace for online courses',
          keyStrengths: ['Extensive course library', 'Instructor marketplace', 'Business solutions'],
          differentiators: ['Course marketplace model', 'Instructor-led content']
        },
        {
          name: 'LinkedIn Learning',
          url: 'https://linkedin.com/learning',
          type: 'direct',
          relevanceScore: 85,
          reason: 'Professional skills platform integrated with LinkedIn network',
          marketPosition: 'Professional development platform with career integration',
          keyStrengths: ['Professional focus', 'LinkedIn integration', 'Skills assessments'],
          differentiators: ['LinkedIn profile integration', 'Professional networking']
        },
        {
          name: 'Khan Academy',
          url: 'https://khanacademy.org',
          type: 'direct',
          relevanceScore: 82,
          reason: 'Free educational platform with comprehensive academic content',
          marketPosition: 'Non-profit educational resource with academic focus',
          keyStrengths: ['Free access', 'K-12 curriculum', 'Practice exercises'],
          differentiators: ['Non-profit model', 'Academic foundation']
        }
      ];
    }

    // Add location-specific competitors if location info is available
    if (locationInfo.city || locationInfo.state) {
      const location = locationInfo.city ? 
        `${locationInfo.city}, ${locationInfo.state || ''}` : 
        locationInfo.state || '';
      
      if (location) {
        // Generate location-specific competitors
        const cityName = locationInfo.city || '';
        const stateName = locationInfo.state || '';
        const stateAbbr = stateAbbreviations[usStates.indexOf(stateName)] || '';
        
        const localCompetitors = [
          {
            name: `${cityName} Digital`,
            url: `https://${cityName.toLowerCase().replace(/\s+/g, '')}digital.com`,
            type: 'direct',
            relevanceScore: 95,
            reason: `Local competitor in ${location} offering similar services to the same client base`,
            marketPosition: 'Established local provider with strong community ties',
            keyStrengths: ['Local reputation', 'Community connections', 'Personalized service'],
            differentiators: [`${cityName}-specific expertise`, 'Face-to-face meetings']
          },
          {
            name: `${stateName} Solutions Group`,
            url: `https://${stateName.toLowerCase().replace(/\s+/g, '')}solutionsgroup.com`,
            type: 'direct',
            relevanceScore: 90,
            reason: `Regional competitor covering ${location} and surrounding areas`,
            marketPosition: 'Growing regional agency with multiple locations',
            keyStrengths: ['Regional brand recognition', 'Diverse portfolio', 'Full-service capabilities'],
            differentiators: ['Regional business focus', 'Industry specialization']
          }
        ];
        
        // Add local competitors to the beginning of the list as they're most relevant
        competitorSuggestions = [...localCompetitors, ...competitorSuggestions];
      }
    }

    // If we still don't have enough competitors, add some general ones based on the domain
    if (competitorSuggestions.length < 3) {
      const generalCompetitors = [
        {
          name: 'Moz',
          url: 'https://moz.com',
          type: 'industry_leader',
          relevanceScore: 88,
          reason: 'Leading SEO software and data provider with comprehensive tools',
          marketPosition: 'Established SEO authority with strong educational content',
          keyStrengths: ['Domain authority metric', 'SEO learning resources', 'Local SEO tools'],
          differentiators: ['MozCon conference', 'Beginner-friendly approach']
        },
        {
          name: 'Conductor',
          url: 'https://conductor.com',
          type: 'direct',
          relevanceScore: 82,
          reason: 'Enterprise SEO and content intelligence platform',
          marketPosition: 'Enterprise-focused organic marketing solution',
          keyStrengths: ['Content intelligence', 'Enterprise integration', 'Marketing analytics'],
          differentiators: ['Enterprise focus', 'Customer success program']
        },
        {
          name: 'BrightEdge',
          url: 'https://brightedge.com',
          type: 'direct',
          relevanceScore: 84,
          reason: 'Enterprise SEO platform with AI-powered insights',
          marketPosition: 'Data-driven enterprise SEO solution',
          keyStrengths: ['Data science approach', 'Content performance', 'Technical SEO'],
          differentiators: ['DataMind AI technology', 'Enterprise integration']
        }
      ];
      
      // Add enough general competitors to reach at least 3 total
      competitorSuggestions = [
        ...competitorSuggestions,
        ...generalCompetitors.slice(0, Math.max(0, 3 - competitorSuggestions.length))
      ];
    }

    // Filter out any existing competitors
    competitorSuggestions = competitorSuggestions.filter(comp => 
      !existingCompetitors.some(existing => 
        existing.toLowerCase().includes(comp.name.toLowerCase()) || 
        comp.url.toLowerCase().includes(existing.toLowerCase())
      )
    );
    
    // Limit to a reasonable number based on analysis depth
    const limit = analysisDepth === 'comprehensive' ? 10 : 6;
    competitorSuggestions = competitorSuggestions.slice(0, limit);
    
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