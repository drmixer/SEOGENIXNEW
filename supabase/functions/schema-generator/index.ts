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

    // Use Gemini API to generate appropriate schema markup
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${Deno.env.get('GEMINI_API_KEY')}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Generate Schema.org JSON-LD markup for a ${contentType} based on this URL: ${url}
              ${content ? `Content: ${content}` : ''}
              
              Create comprehensive, valid Schema.org markup that will help AI systems understand the content better.
              Include all relevant properties for the ${contentType} type.
              
              Return only the JSON-LD markup without any explanation.`
            }]
          }],
          generationConfig: {
            temperature: 0.2,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          }
        })
      }
    );

    const geminiData = await geminiResponse.json();
    const schemaMarkup = geminiData.candidates[0].content.parts[0].text;

    // Clean up the response to ensure it's valid JSON
    const cleanedSchema = schemaMarkup.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    return new Response(
      JSON.stringify({ 
        schema: cleanedSchema,
        instructions: 'Add this JSON-LD script tag to your page head section',
        implementation: `<script type="application/ld+json">\n${cleanedSchema}\n</script>`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Schema generation error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate schema markup' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});