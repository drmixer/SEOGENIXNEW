import { corsHeaders } from '../_shared/cors.ts';

interface SchemaRequest {
  url: string;
  contentType: 'article' | 'product' | 'organization' | 'person' | 'faq' | 'howto';
  content?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { url, contentType, content }: SchemaRequest = await req.json();

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: 'Gemini API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use Gemini 2.5 Flash Preview API to generate appropriate schema markup
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Generate comprehensive Schema.org JSON-LD markup for a ${contentType} based on this information:

              URL: ${url}
              ${content ? `Content: ${content}` : ''}
              
              Requirements:
              1. Create valid, comprehensive Schema.org JSON-LD markup
              2. Include all relevant properties for the ${contentType} type
              3. Use appropriate Schema.org vocabulary
              4. Ensure the markup will help AI systems understand the content better
              5. Include structured data that enhances AI visibility and citation likelihood
              
              For ${contentType} type, include relevant properties like:
              ${contentType === 'article' ? '- headline, author, datePublished, dateModified, publisher, mainEntityOfPage' : ''}
              ${contentType === 'product' ? '- name, description, brand, offers, aggregateRating, review' : ''}
              ${contentType === 'organization' ? '- name, url, logo, contactPoint, address, sameAs' : ''}
              ${contentType === 'person' ? '- name, jobTitle, worksFor, url, sameAs, knowsAbout' : ''}
              ${contentType === 'faq' ? '- mainEntity with Question and Answer types' : ''}
              ${contentType === 'howto' ? '- name, description, step, totalTime, tool, supply' : ''}

              Return ONLY the JSON-LD markup, properly formatted and valid.`
            }]
          }],
          generationConfig: {
            temperature: 0.2,
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
    const schemaMarkup = geminiData.candidates[0].content.parts[0].text;

    // Clean up the response to ensure it's valid JSON
    const cleanedSchema = schemaMarkup
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .replace(/^[^{]*/, '')
      .replace(/[^}]*$/, '')
      .trim();

    // Validate JSON
    try {
      JSON.parse(cleanedSchema);
    } catch (e) {
      console.error('Generated schema is not valid JSON:', cleanedSchema);
      throw new Error('Generated schema markup is not valid JSON');
    }

    return new Response(
      JSON.stringify({ 
        schema: cleanedSchema,
        instructions: 'Add this JSON-LD script tag to your page head section to improve AI understanding',
        implementation: `<script type="application/ld+json">\n${cleanedSchema}\n</script>`,
        contentType,
        url
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Schema generation error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate schema markup',
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});