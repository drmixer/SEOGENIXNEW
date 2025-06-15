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
  contentOverlap?: {
    topics: string[];
    keywords: string[];
    percentage: number;
  };
  socialProfiles?: string[];
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

    // Fetch content from the user's website for deeper analysis
    let websiteContent = '';
    let metaKeywords = '';
    let metaDescription = '';
    let pageTitle = '';
    
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
        
        // Extract meta information
        const titleMatch = websiteContent.match(/<title>(.*?)<\/title>/i);
        if (titleMatch) pageTitle = titleMatch[1];
        
        const descriptionMatch = websiteContent.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i);
        if (descriptionMatch) metaDescription = descriptionMatch[1];
        
        const keywordsMatch = websiteContent.match(/<meta\s+name=["']keywords["']\s+content=["'](.*?)["']/i);
        if (keywordsMatch) metaKeywords = keywordsMatch[1];
      } else {
        console.error(`Failed to fetch website: ${response.status}`);
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
              text: `Analyze this business and discover highly relevant potential competitors they may not be aware of. Provide comprehensive competitor intelligence.

              Business Website: ${url}
              Industry: ${industry || 'Not specified'}
              Business Description: ${businessDescription || 'Not provided'}
              Website Content: ${websiteContent ? websiteContent.substring(0, 3000) : 'Not available'}
              Page Title: ${pageTitle || 'Not available'}
              Meta Description: ${metaDescription || 'Not available'}
              Meta Keywords: ${metaKeywords || 'Not available'}
              
              Existing Known Competitors: ${existingCompetitors.length > 0 ? existingCompetitors.join(', ') : 'None specified'}
              Analysis Depth: ${analysisDepth}

              IMPORTANT: Be extremely specific and accurate. Provide REAL competitors that actually exist, with REAL websites and accurate information. Do NOT make up fictional companies.

              Discover and analyze competitors across these categories:

              1. DIRECT COMPETITORS - Companies offering very similar products/services to the same target market
              2. INDIRECT COMPETITORS - Companies solving the same customer problem with different approaches
              3. INDUSTRY LEADERS - Major established players in the industry that set market standards
              4. EMERGING PLAYERS - Newer companies or startups that could become significant competitors

              For each competitor, provide:
              - Company name and website URL (MUST be real, existing companies with accurate URLs)
              - Competitor type (direct/indirect/industry_leader/emerging)
              - Relevance score (1-100) based on how directly they compete
              - Detailed reason why they're a competitor
              - Market position analysis
              - 3-5 key strengths
              - 2-3 key differentiators
              - Content overlap analysis (topics and keywords that overlap with the user's site)
              - Social media profiles if available

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
              CONTENT_OVERLAP: [Topic 1], [Topic 2], [Keyword 1], [Keyword 2] | [Overlap percentage]
              SOCIAL_PROFILES: [Profile URLs separated by commas]

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
      return generateFallbackCompetitors(url, industry, existingCompetitors, analysisDepth);
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
      const contentOverlapMatch = section.match(/CONTENT_OVERLAP:\s*(.*)/i);
      const socialProfilesMatch = section.match(/SOCIAL_PROFILES:\s*(.*)/i);

      if (nameMatch && urlMatch && typeMatch && relevanceMatch && reasonMatch) {
        const strengths = strengthsMatch ? 
          strengthsMatch[1].split('|').map(s => s.trim()).filter(s => s) : [];
        const differentiators = diffMatch ? 
          diffMatch[1].split('|').map(d => d.trim()).filter(d => d) : [];
        
        // Parse content overlap
        let contentOverlap;
        if (contentOverlapMatch) {
          const parts = contentOverlapMatch[1].split('|').map(p => p.trim());
          if (parts.length >= 2) {
            const topicsAndKeywords = parts[0].split(',').map(t => t.trim());
            const percentageMatch = parts[1].match(/(\d+)/);
            const percentage = percentageMatch ? parseInt(percentageMatch[1]) : 0;
            
            contentOverlap = {
              topics: topicsAndKeywords.slice(0, Math.ceil(topicsAndKeywords.length / 2)),
              keywords: topicsAndKeywords.slice(Math.ceil(topicsAndKeywords.length / 2)),
              percentage
            };
          }
        }
        
        // Parse social profiles
        const socialProfiles = socialProfilesMatch ? 
          socialProfilesMatch[1].split(',').map(p => p.trim()).filter(p => p) : undefined;

        competitorSuggestions.push({
          name: nameMatch[1].trim(),
          url: urlMatch[1].trim(),
          type: typeMatch[1].trim() as CompetitorSuggestion['type'],
          relevanceScore: parseInt(relevanceMatch[1]),
          reason: reasonMatch[1].trim(),
          marketPosition: positionMatch ? positionMatch[1].trim() : 'Market position analysis not available',
          keyStrengths: strengths.slice(0, 5),
          differentiators: differentiators.slice(0, 3),
          contentOverlap,
          socialProfiles
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
    
    // Extract common topics and keywords across competitors
    const allTopics = new Set<string>();
    const allKeywords = new Set<string>();
    const topicFrequency: Record<string, number> = {};
    const keywordFrequency: Record<string, number> = {};
    
    competitorSuggestions.forEach(comp => {
      if (comp.contentOverlap) {
        comp.contentOverlap.topics.forEach(topic => {
          allTopics.add(topic);
          topicFrequency[topic] = (topicFrequency[topic] || 0) + 1;
        });
        comp.contentOverlap.keywords.forEach(keyword => {
          allKeywords.add(keyword);
          keywordFrequency[keyword] = (keywordFrequency[keyword] || 0) + 1;
        });
      }
    });
    
    // Find top topics and keywords
    const topTopics = Object.entries(topicFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic]) => topic);
      
    const topKeywords = Object.entries(keywordFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([keyword]) => keyword);

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
        insights: {
          directCompetitors: competitorsByType.direct?.length || 0,
          indirectCompetitors: competitorsByType.indirect?.length || 0,
          industryLeaders: competitorsByType.industry_leader?.length || 0,
          emergingPlayers: competitorsByType.emerging?.length || 0,
          highRelevanceCompetitors: competitorSuggestions.filter(c => c.relevanceScore >= 80).length,
          marketGaps: competitorSuggestions.length < 5 ? 'Low competitive density - potential market opportunity' : 
                     competitorSuggestions.length > 12 ? 'High competitive density - crowded market' : 
                     'Moderate competitive density - balanced market',
          topTopics,
          topKeywords,
          contentOverlapAverage: competitorSuggestions
            .filter(c => c.contentOverlap?.percentage)
            .reduce((sum, c) => sum + (c.contentOverlap?.percentage || 0), 0) / 
            competitorSuggestions.filter(c => c.contentOverlap?.percentage).length || 0
        },
        recommendations: [
          'Monitor high-relevance competitors for strategic insights',
          'Analyze competitor strengths to identify improvement opportunities',
          'Track emerging players for early competitive intelligence',
          'Consider partnerships with indirect competitors',
          'Differentiate from industry leaders through unique value propositions',
          `Focus on content gaps in ${topTopics.slice(0, 2).join(' and ')} topics`,
          `Optimize for ${topKeywords.slice(0, 2).join(' and ')} keywords to compete effectively`
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

// Fallback function to generate sample competitors when API fails
function generateFallbackCompetitors(
  url: string, 
  industry?: string, 
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
        differentiators: ['24/7 premium support', 'Custom implementation services'],
        contentOverlap: {
          topics: ['Software Development', 'Cloud Solutions', 'Enterprise Technology'],
          keywords: ['software', 'cloud', 'enterprise', 'solutions'],
          percentage: 78
        },
        socialProfiles: [
          'https://twitter.com/techsolutions',
          'https://linkedin.com/company/techsolutions-inc'
        ]
      },
      {
        name: 'SoftwareGuru',
        url: 'https://softwareguru.io',
        type: 'direct',
        relevanceScore: 88,
        reason: 'Competing directly with similar product offerings and pricing',
        marketPosition: 'Fast-growing challenger with innovative features',
        keyStrengths: ['Modern UI/UX', 'Aggressive pricing', 'Strong mobile support'],
        differentiators: ['AI-powered features', 'Freemium model'],
        contentOverlap: {
          topics: ['Software Solutions', 'Mobile Development', 'SaaS'],
          keywords: ['software', 'mobile', 'cloud', 'platform'],
          percentage: 65
        },
        socialProfiles: [
          'https://twitter.com/softwareguru',
          'https://linkedin.com/company/softwareguru'
        ]
      },
      {
        name: 'Enterprise Systems',
        url: 'https://enterprise-systems.com',
        type: 'industry_leader',
        relevanceScore: 75,
        reason: 'Major player setting standards in the industry',
        marketPosition: 'Market leader with comprehensive enterprise solutions',
        keyStrengths: ['Massive client base', 'Extensive integration ecosystem', 'Industry reputation'],
        differentiators: ['Full-service consulting', 'Legacy system support'],
        contentOverlap: {
          topics: ['Enterprise Software', 'Business Solutions', 'Digital Transformation'],
          keywords: ['enterprise', 'business', 'digital', 'transformation'],
          percentage: 55
        }
      },
      {
        name: 'InnovateTech',
        url: 'https://innovatetech.dev',
        type: 'emerging',
        relevanceScore: 65,
        reason: 'Startup with innovative approach to the same problems',
        marketPosition: 'Emerging disruptor with novel technology approach',
        keyStrengths: ['Cutting-edge technology', 'Agile development', 'Lower cost structure'],
        differentiators: ['Open source core', 'Developer-first approach'],
        contentOverlap: {
          topics: ['Innovation', 'Developer Tools', 'Open Source'],
          keywords: ['innovative', 'developer', 'open source', 'tools'],
          percentage: 40
        }
      }
    ],
    'E-commerce & Retail': [
      {
        name: 'ShopMaster',
        url: 'https://shopmaster.store',
        type: 'direct',
        relevanceScore: 90,
        reason: 'Direct competitor in the same product categories and price points',
        marketPosition: 'Established online retailer with broad product selection',
        keyStrengths: ['Large product catalog', 'Competitive pricing', 'Fast shipping'],
        differentiators: ['Loyalty program', 'Price matching guarantee'],
        contentOverlap: {
          topics: ['Online Shopping', 'Product Categories', 'Customer Service'],
          keywords: ['shop', 'products', 'online', 'shipping'],
          percentage: 82
        },
        socialProfiles: [
          'https://facebook.com/shopmaster',
          'https://instagram.com/shopmaster_store'
        ]
      },
      {
        name: 'RetailGiants',
        url: 'https://retailgiants.com',
        type: 'industry_leader',
        relevanceScore: 82,
        reason: 'Major market player with overlapping product lines',
        marketPosition: 'Industry leader with massive market presence',
        keyStrengths: ['Brand recognition', 'Supply chain efficiency', 'Omnichannel presence'],
        differentiators: ['Private label products', 'Physical store network'],
        contentOverlap: {
          topics: ['Retail', 'Products', 'Shopping Experience'],
          keywords: ['retail', 'shop', 'products', 'stores'],
          percentage: 68
        }
      },
      {
        name: 'SpecialtyGoods',
        url: 'https://specialtygoods.shop',
        type: 'indirect',
        relevanceScore: 70,
        reason: 'Focuses on premium segment of the same market',
        marketPosition: 'Premium niche retailer with dedicated customer base',
        keyStrengths: ['High-quality products', 'Expert customer service', 'Curated selection'],
        differentiators: ['Artisanal products', 'Sustainability focus'],
        contentOverlap: {
          topics: ['Quality Products', 'Premium Shopping', 'Curation'],
          keywords: ['premium', 'quality', 'curated', 'specialty'],
          percentage: 45
        }
      }
    ],
    'Marketing & Advertising': [
      {
        name: 'MarketingPros',
        url: 'https://marketingpros.agency',
        type: 'direct',
        relevanceScore: 95,
        reason: 'Offers identical services to the same client profile',
        marketPosition: 'Established agency with strong client portfolio',
        keyStrengths: ['Industry expertise', 'Award-winning campaigns', 'Full-service capabilities'],
        differentiators: ['Performance-based pricing', 'Proprietary analytics'],
        contentOverlap: {
          topics: ['Digital Marketing', 'Advertising Campaigns', 'Marketing Strategy'],
          keywords: ['marketing', 'advertising', 'campaigns', 'strategy'],
          percentage: 88
        },
        socialProfiles: [
          'https://twitter.com/marketingpros',
          'https://linkedin.com/company/marketing-pros'
        ]
      },
      {
        name: 'DigitalEdge',
        url: 'https://digitaledge.marketing',
        type: 'direct',
        relevanceScore: 88,
        reason: 'Specializes in the same digital marketing services',
        marketPosition: 'Digital-first agency with technology focus',
        keyStrengths: ['Technical expertise', 'Data-driven approach', 'Innovative tactics'],
        differentiators: ['AI-powered campaign optimization', 'Transparent reporting'],
        contentOverlap: {
          topics: ['Digital Marketing', 'Data Analytics', 'Campaign Optimization'],
          keywords: ['digital', 'data-driven', 'campaigns', 'analytics'],
          percentage: 75
        }
      },
      {
        name: 'GlobalAd',
        url: 'https://globalad.com',
        type: 'industry_leader',
        relevanceScore: 78,
        reason: 'Major agency network competing for enterprise clients',
        marketPosition: 'Global leader with presence in all major markets',
        keyStrengths: ['Global reach', 'Integrated services', 'Blue-chip client roster'],
        differentiators: ['Media buying power', 'Research capabilities'],
        contentOverlap: {
          topics: ['Global Marketing', 'Integrated Campaigns', 'Media Buying'],
          keywords: ['global', 'integrated', 'media', 'enterprise'],
          percentage: 60
        }
      }
    ]
  };
  
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
      differentiators: ['Premium positioning', 'Loyalty program'],
      contentOverlap: {
        topics: ['Products', 'Services', 'Solutions'],
        keywords: ['quality', 'service', 'solutions', 'professional'],
        percentage: 75
      }
    },
    {
      name: 'IndustryLeader',
      url: 'https://industryleader.com',
      type: 'industry_leader',
      relevanceScore: 85,
      reason: 'Major player setting standards in the industry',
      marketPosition: 'Market leader with broad product/service range',
      keyStrengths: ['Market dominance', 'R&D capabilities', 'Distribution network'],
      differentiators: ['Scale advantages', 'Vertical integration'],
      contentOverlap: {
        topics: ['Industry Trends', 'Market Leadership', 'Innovation'],
        keywords: ['leader', 'industry', 'innovation', 'solutions'],
        percentage: 65
      }
    },
    {
      name: 'IndirectSolution',
      url: 'https://indirectsolution.com',
      type: 'indirect',
      relevanceScore: 70,
      reason: 'Solves the same customer problems with different approach',
      marketPosition: 'Alternative solution provider with unique approach',
      keyStrengths: ['Innovative methodology', 'Niche expertise', 'Cost efficiency'],
      differentiators: ['Alternative technology', 'Specialized focus'],
      contentOverlap: {
        topics: ['Problem Solving', 'Alternative Solutions', 'Efficiency'],
        keywords: ['alternative', 'efficient', 'specialized', 'innovative'],
        percentage: 45
      }
    },
    {
      name: 'EmergingPlayer',
      url: 'https://emergingplayer.io',
      type: 'emerging',
      relevanceScore: 65,
      reason: 'Startup with innovative approach gaining traction',
      marketPosition: 'Emerging disruptor with novel business model',
      keyStrengths: ['Cutting-edge technology', 'Agility', 'Modern user experience'],
      differentiators: ['Subscription model', 'Mobile-first approach'],
      contentOverlap: {
        topics: ['Innovation', 'Modern Approach', 'User Experience'],
        keywords: ['innovative', 'modern', 'experience', 'subscription'],
        percentage: 35
      }
    }
  ];
  
  // Use industry-specific competitors if available, otherwise use default
  let competitorSuggestions = industry && industryCompetitors[industry] ? 
    [...industryCompetitors[industry]] : [...defaultCompetitors];
  
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
        differentiators: ['International expertise', 'Multi-language support'],
        contentOverlap: {
          topics: ['Global Presence', 'International Markets', 'Enterprise Solutions'],
          keywords: ['global', 'international', 'enterprise', 'worldwide'],
          percentage: 50
        }
      },
      {
        name: 'PlatformProvider',
        url: 'https://platformprovider.com',
        type: 'indirect',
        relevanceScore: 68,
        reason: 'Platform that enables customers to solve problems themselves',
        marketPosition: 'Leading platform with marketplace model',
        keyStrengths: ['Large user base', 'Network effects', 'Ecosystem of partners'],
        differentiators: ['Self-service options', 'Community support'],
        contentOverlap: {
          topics: ['Platform Solutions', 'Marketplace', 'Self-Service'],
          keywords: ['platform', 'marketplace', 'community', 'ecosystem'],
          percentage: 40
        }
      },
      {
        name: 'TechDisruptor',
        url: 'https://techdisruptor.io',
        type: 'emerging',
        relevanceScore: 60,
        reason: 'Using new technology to solve the same problems differently',
        marketPosition: 'Technology innovator with disruptive potential',
        keyStrengths: ['Proprietary technology', 'Venture funding', 'Technical expertise'],
        differentiators: ['AI-first approach', 'Blockchain integration'],
        contentOverlap: {
          topics: ['Technology Innovation', 'AI Solutions', 'Disruption'],
          keywords: ['ai', 'blockchain', 'disruptive', 'innovative'],
          percentage: 30
        }
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
      differentiators: ['Specialized features', 'Industry focus'],
      contentOverlap: {
        topics: ['Business Solutions', 'Products', 'Services'],
        keywords: ['solutions', 'quality', 'service', 'professional'],
        percentage: Math.floor(Math.random() * 40) + 30
      }
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
  
  // Extract common topics and keywords
  const allTopics = new Set<string>();
  const allKeywords = new Set<string>();
  
  competitorSuggestions.forEach(comp => {
    if (comp.contentOverlap) {
      comp.contentOverlap.topics.forEach(topic => allTopics.add(topic));
      comp.contentOverlap.keywords.forEach(keyword => allKeywords.add(keyword));
    }
  });
  
  const topTopics = Array.from(allTopics).slice(0, 5);
  const topKeywords = Array.from(allKeywords).slice(0, 5);
  
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
                   competitorSuggestions.length > 7 ? 'High competitive density - crowded market' : 
                   'Moderate competitive density - balanced market',
        topTopics,
        topKeywords,
        contentOverlapAverage: competitorSuggestions
          .filter(c => c.contentOverlap?.percentage)
          .reduce((sum, c) => sum + (c.contentOverlap?.percentage || 0), 0) / 
          competitorSuggestions.filter(c => c.contentOverlap?.percentage).length || 0
      },
      recommendations: [
        'Monitor high-relevance competitors for strategic insights',
        'Analyze competitor strengths to identify improvement opportunities',
        'Track emerging players for early competitive intelligence',
        'Consider partnerships with indirect competitors',
        'Differentiate from industry leaders through unique value propositions',
        `Focus on content gaps in ${topTopics.slice(0, 2).join(' and ')} topics`,
        `Optimize for ${topKeywords.slice(0, 2).join(' and ')} keywords to compete effectively`
      ],
      analyzedAt: new Date().toISOString(),
      note: 'This is fallback competitor data as the API request failed'
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}