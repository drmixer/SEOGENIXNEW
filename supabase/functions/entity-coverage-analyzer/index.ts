import { corsHeaders } from '../_shared/cors.ts';

interface EntityAnalysisRequest {
  url: string;
  content?: string;
  industry?: string;
  competitors?: string[];
}

interface Entity {
  name: string;
  type: 'person' | 'organization' | 'location' | 'concept' | 'product' | 'event';
  relevance: number;
  mentioned: boolean;
  importance: 'high' | 'medium' | 'low';
  description?: string;
}

export const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { url, content, industry, competitors = [] }: EntityAnalysisRequest = await req.json();
    
    console.log(`Processing entity analysis for URL: ${url}, industry: ${industry || 'not specified'}`);
    console.log(`Competitors: ${competitors.join(', ') || 'none'}`);

    // Fetch content if URL provided and no content given
    let pageContent = content;
    if (url && !content) {
      try {
        console.log(`Fetching content from ${url}`);
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'SEOGENIX Entity Analyzer Bot 1.0'
          }
};

Deno.serve(handler);
        if (response.ok) {
          pageContent = await response.text();
          console.log(`Successfully fetched content, length: ${pageContent.length} characters`);
        } else {
          console.error(`Failed to fetch URL: ${url}, status: ${response.status}`);
          pageContent = `Content from ${url}`;
        }
      } catch (error) {
        console.error('Failed to fetch URL:', error);
        pageContent = `Content from ${url}`;
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

    console.log('Calling Gemini API for entity analysis...');
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Analyze the entity coverage for this website and identify missing important entities that should be mentioned for better AI visibility.

              Website URL: ${url}
              Industry: ${industry || 'Not specified'}
              Competitors: ${competitors.join(', ') || 'None specified'}
              Content: ${pageContent?.substring(0, 4000) || 'No content provided'}

              Perform a comprehensive entity analysis:

              1. MENTIONED ENTITIES: List key entities (people, organizations, locations, concepts, products, events) that ARE mentioned in the content
              2. MISSING ENTITIES: Identify important entities that SHOULD be mentioned but are missing
              3. COMPETITOR ENTITIES: Entities mentioned by competitors that this site should consider
              4. INDUSTRY ENTITIES: Key industry figures, organizations, and concepts that are relevant

              For each entity, provide:
              - Name
              - Type (person/organization/location/concept/product/event)
              - Relevance score (1-100)
              - Importance (high/medium/low)
              - Brief description of why it's important

              Format your response as:

              MENTIONED ENTITIES:
              - [Entity Name] | [Type] | [Relevance] | [Importance] | [Description]

              MISSING ENTITIES:
              - [Entity Name] | [Type] | [Relevance] | [Importance] | [Description]

              RECOMMENDATIONS:
              1. [Specific recommendation]
              2. [Specific recommendation]
              3. [Specific recommendation]

              PRIORITY ACTIONS:
              - [High priority action]
              - [Medium priority action]
              - [Low priority action]`
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
      console.log('Using fallback entity analysis data');
      return generateFallbackEntityAnalysis(url, industry);
    }

    console.log('Received response from Gemini API');
    const geminiData = await geminiResponse.json();
    const responseText = geminiData.candidates[0].content.parts[0].text;

    // Parse entities from response
    const parseEntities = (section: string, mentioned: boolean): Entity[] => {
      const lines = section.split('\n').filter(line => line.trim().startsWith('-'));
      return lines.map(line => {
        const parts = line.substring(1).split('|').map(p => p.trim());
        if (parts.length >= 4) {
          return {
            name: parts[0],
            type: parts[1].toLowerCase() as Entity['type'],
            relevance: parseInt(parts[2]) || 50,
            mentioned,
            importance: parts[3].toLowerCase() as Entity['importance'],
            description: parts[4] || ''
          };
        }
        return null;
      }).filter(Boolean) as Entity[];
    };

    const mentionedSection = responseText.match(/MENTIONED ENTITIES:\s*([\s\S]*?)(?=MISSING ENTITIES:|$)/i);
    const missingSection = responseText.match(/MISSING ENTITIES:\s*([\s\S]*?)(?=RECOMMENDATIONS:|$)/i);
    const recommendationsSection = responseText.match(/RECOMMENDATIONS:\s*([\s\S]*?)(?=PRIORITY ACTIONS:|$)/i);
    const actionsSection = responseText.match(/PRIORITY ACTIONS:\s*([\s\S]*?)$/i);

    const mentionedEntities = mentionedSection ? parseEntities(mentionedSection[1], true) : [];
    const missingEntities = missingSection ? parseEntities(missingSection[1], false) : [];

    const recommendations = recommendationsSection ?
      recommendationsSection[1].split('\n')
        .filter((line: string) => line.trim().match(/^\d+\./))
        .map((line: string) => line.trim().replace(/^\d+\.\s*/, ''))
        .slice(0, 5) : [];

    const priorityActions = actionsSection ?
      actionsSection[1].split('\n')
        .filter((line: string) => line.trim().startsWith('-'))
        .map((line: string) => line.trim().substring(1).trim())
        .slice(0, 6) : [];

    const allEntities = [...mentionedEntities, ...missingEntities];
    const coverageScore = mentionedEntities.length > 0 ? 
      Math.round((mentionedEntities.length / allEntities.length) * 100) : 0;

    console.log(`Entity analysis complete. Found ${mentionedEntities.length} mentioned entities and ${missingEntities.length} missing entities`);
    return new Response(
      JSON.stringify({
        url,
        industry,
        coverageScore,
        totalEntities: allEntities.length,
        mentionedCount: mentionedEntities.length,
        missingCount: missingEntities.length,
        mentionedEntities,
        missingEntities,
        recommendations,
        priorityActions,
        entityBreakdown: {
          people: allEntities.filter(e => e.type === 'person').length,
          organizations: allEntities.filter(e => e.type === 'organization').length,
          locations: allEntities.filter(e => e.type === 'location').length,
          concepts: allEntities.filter(e => e.type === 'concept').length,
          products: allEntities.filter(e => e.type === 'product').length,
          events: allEntities.filter(e => e.type === 'event').length
        },
        analyzedAt: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Entity coverage analysis error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to analyze entity coverage',
        details: (error as Error).message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
          });

// Fallback function to generate sample entity analysis when API fails
function generateFallbackEntityAnalysis(url: string, industry?: string): Response {
  console.log(`Generating fallback entity analysis for ${url}`);
  
  const domain = url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  const brandName = domain.split('.')[0];
  
  // Generate industry-specific entities if industry is provided
  const industryEntities: Record<string, Entity[]> = {
    'Technology & Software': [
      { name: 'Artificial Intelligence', type: 'concept', relevance: 95, mentioned: false, importance: 'high', description: 'Core technology relevant to the industry' },
      { name: 'Machine Learning', type: 'concept', relevance: 90, mentioned: false, importance: 'high', description: 'Key technical concept in modern software' },
      { name: 'Cloud Computing', type: 'concept', relevance: 85, mentioned: false, importance: 'medium', description: 'Important infrastructure concept' },
      { name: 'Microsoft', type: 'organization', relevance: 75, mentioned: false, importance: 'medium', description: 'Major industry player' },
      { name: 'Google', type: 'organization', relevance: 80, mentioned: false, importance: 'medium', description: 'Key technology company' }
    ],
    'E-commerce & Retail': [
      { name: 'Customer Experience', type: 'concept', relevance: 95, mentioned: false, importance: 'high', description: 'Critical concept for retail success' },
      { name: 'Supply Chain', type: 'concept', relevance: 90, mentioned: false, importance: 'high', description: 'Essential business operation' },
      { name: 'Amazon', type: 'organization', relevance: 85, mentioned: false, importance: 'medium', description: 'Major industry competitor' },
      { name: 'Shopify', type: 'organization', relevance: 80, mentioned: false, importance: 'medium', description: 'Important e-commerce platform' },
      { name: 'Omnichannel', type: 'concept', relevance: 75, mentioned: false, importance: 'medium', description: 'Key retail strategy' }
    ],
    'Marketing & Advertising': [
      { name: 'Digital Marketing', type: 'concept', relevance: 95, mentioned: false, importance: 'high', description: 'Core industry concept' },
      { name: 'Social Media', type: 'concept', relevance: 90, mentioned: false, importance: 'high', description: 'Essential marketing channel' },
      { name: 'Content Strategy', type: 'concept', relevance: 85, mentioned: false, importance: 'high', description: 'Key marketing approach' },
      { name: 'Google Ads', type: 'product', relevance: 80, mentioned: false, importance: 'medium', description: 'Major advertising platform' },
      { name: 'Meta', type: 'organization', relevance: 75, mentioned: false, importance: 'medium', description: 'Important social media company' }
    ]
  };
  
  // Default entities if industry not specified or not in our list
  const defaultMissingEntities: Entity[] = [
    { name: 'Artificial Intelligence', type: 'concept', relevance: 90, mentioned: false, importance: 'high', description: 'Core technology concept' },
    { name: 'Digital Transformation', type: 'concept', relevance: 85, mentioned: false, importance: 'high', description: 'Important business strategy' },
    { name: 'User Experience', type: 'concept', relevance: 80, mentioned: false, importance: 'medium', description: 'Critical for customer satisfaction' },
    { name: 'Data Analytics', type: 'concept', relevance: 75, mentioned: false, importance: 'medium', description: 'Essential for business insights' },
    { name: 'Industry Standards', type: 'concept', relevance: 70, mentioned: false, importance: 'medium', description: 'Important for credibility' }
  ];
  
  // Generate mentioned entities
  const mentionedEntities: Entity[] = [
    { name: brandName.charAt(0).toUpperCase() + brandName.slice(1), type: 'organization', relevance: 100, mentioned: true, importance: 'high', description: 'The main organization' },
    { name: 'Website', type: 'concept', relevance: 85, mentioned: true, importance: 'medium', description: 'Core digital property' },
    { name: 'Online Presence', type: 'concept', relevance: 80, mentioned: true, importance: 'medium', description: 'Digital visibility concept' },
    { name: 'Services', type: 'concept', relevance: 75, mentioned: true, importance: 'medium', description: 'Offerings provided to customers' }
  ];
  
  // Use industry-specific missing entities if available, otherwise use default
  const missingEntities = industry && industryEntities[industry] ? 
    industryEntities[industry] : defaultMissingEntities;
  
  const allEntities = [...mentionedEntities, ...missingEntities];
  const coverageScore = Math.round((mentionedEntities.length / allEntities.length) * 100);
  
  const recommendations = [
    `Add more information about ${missingEntities[0].name} to improve industry relevance`,
    `Include mentions of ${missingEntities[1].name} to enhance content comprehensiveness`,
    `Add references to ${missingEntities[2].name} to improve topical coverage`,
    `Consider discussing ${missingEntities[3].name} to address important industry concepts`,
    `Incorporate ${missingEntities[4].name} to strengthen content authority`
  ];
  
  const priorityActions = [
    `Add a section about ${missingEntities[0].name}`,
    `Include ${missingEntities[1].name} in your main content`,
    `Reference ${missingEntities[2].name} in context`
  ];
  
  return new Response(
    JSON.stringify({
      url,
      industry,
      coverageScore,
      totalEntities: allEntities.length,
      mentionedCount: mentionedEntities.length,
      missingCount: missingEntities.length,
      mentionedEntities,
      missingEntities,
      recommendations,
      priorityActions,
      entityBreakdown: {
        people: allEntities.filter(e => e.type === 'person').length,
        organizations: allEntities.filter(e => e.type === 'organization').length,
        locations: allEntities.filter(e => e.type === 'location').length,
        concepts: allEntities.filter(e => e.type === 'concept').length,
        products: allEntities.filter(e => e.type === 'product').length,
        events: allEntities.filter(e => e.type === 'event').length
      },
      analyzedAt: new Date().toISOString(),
      note: 'This is fallback entity analysis data as the API request failed'
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}