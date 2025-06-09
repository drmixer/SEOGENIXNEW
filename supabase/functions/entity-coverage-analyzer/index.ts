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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { url, content, industry, competitors = [] }: EntityAnalysisRequest = await req.json();

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: 'Gemini API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch content if URL provided and no content given
    let pageContent = content;
    if (url && !content) {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'SEOGENIX Entity Analyzer Bot 1.0'
          }
        });
        if (response.ok) {
          pageContent = await response.text();
        } else {
          pageContent = `Content from ${url}`;
        }
      } catch (error) {
        console.error('Failed to fetch URL:', error);
        pageContent = `Content from ${url}`;
      }
    }

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`,
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
      throw new Error(`Gemini API failed: ${geminiResponse.status}`);
    }

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
        .filter(line => line.trim().match(/^\d+\./))
        .map(line => line.trim().replace(/^\d+\.\s*/, ''))
        .slice(0, 5) : [];

    const priorityActions = actionsSection ?
      actionsSection[1].split('\n')
        .filter(line => line.trim().startsWith('-'))
        .map(line => line.trim().substring(1).trim())
        .slice(0, 6) : [];

    const allEntities = [...mentionedEntities, ...missingEntities];
    const coverageScore = mentionedEntities.length > 0 ? 
      Math.round((mentionedEntities.length / allEntities.length) * 100) : 0;

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
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});