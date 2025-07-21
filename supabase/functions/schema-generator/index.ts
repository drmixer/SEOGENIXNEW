import { corsHeaders } from '../_shared/cors.ts';

interface SchemaRequest {
  url?: string;
  content?: string;
}

export interface SchemaValidationWarning {
  field: string;
  message: string;
}

export const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { url, content }: SchemaRequest = await req.json();

    if (!url && !content) {
      return new Response(
        JSON.stringify({ error: 'URL or content is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log the request for debugging
    console.log(`Processing schema request for URL: ${url || 'content provided'}`);

    // Fetch content if URL provided and no content given
    let pageContent = content;
    if (url && !content) {
      try {
        console.log(`Fetching content from URL: ${url}`);
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'SEOGENIX Schema Generator Bot 1.0'
          }
        });
        if (response.ok) {
          pageContent = await response.text();
          console.log(`Successfully fetched content, length: ${pageContent.length} characters`);
        } else {
          console.error(`Failed to fetch URL: ${url}, status: ${response.status}`);
        }
      } catch (error) {
        console.error('Failed to fetch URL:', error);
      }
    }

    // Use Gemini API for schema generation
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY') || 'AIzaSyDJC5a7zgGvBk58ojXPKkQJXu-fR3qHHHM'; // Fallback to demo key
    
    if (!geminiApiKey) {
      console.error('Gemini API key not configured');
      return new Response(
        JSON.stringify({ error: 'Gemini API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Calling Gemini API for schema generation...');
    
    // Use Gemini API to generate appropriate schema markup
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `
              You are an expert Schema.org generator. Analyze the provided URL and content to perform the following tasks:

              1.  **Suggest Schema Type:**
                  - Based on the content, suggest the most appropriate Schema.org type (e.g., 'Article', 'Product', 'Recipe', 'FAQPage', 'HowTo', 'Organization').

              2.  **Generate JSON-LD:**
                  - Create a detailed and specific Schema.org JSON-LD markup for the suggested type.
                  - Use realistic values based on the URL and content, not placeholder text.
                  - Ensure the JSON is valid and follows all best practices.

              3.  **Validate Schema:**
                  - Identify any missing required or recommended properties for the suggested schema type.
                  - Provide a list of warnings, where each warning is an object with 'field' and 'message'.

              **Content to Analyze:**
              - URL: ${url}
              - Content: """
              ${pageContent ? pageContent.substring(0, 4000) : 'No content provided, use URL for context.'}
              """

              **JSON Output Format:**

              Return a single, valid JSON object. Do not include any text or formatting outside of the JSON object.

              Example:
              {
                "suggestedType": "Article",
                "schema": {
                  "@context": "https://schema.org",
                  "@type": "Article",
                  "headline": "Example Headline",
                  "author": {
                    "@type": "Person",
                    "name": "John Doe"
                  },
                  "publisher": {
                    "@type": "Organization",
                    "name": "Example Publisher",
                    "logo": {
                      "@type": "ImageObject",
                      "url": "https://example.com/logo.png"
                    }
                  }
                },
                "validationWarnings": [
                  {
                    "field": "datePublished",
                    "message": "The 'datePublished' property is recommended for articles to provide publication context."
                  },
                  {
                    "field": "image",
                    "message": "Including an 'image' property is highly recommended for better visual representation in search results."
                  }
                ]
              }`
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
      
      // Fallback to sample data if API fails
      console.log('Using fallback schema data');
      return generateFallbackSchema('Article', url);
    }

    console.log('Received response from Gemini API');
    const geminiData = await geminiResponse.json();
    let schemaMarkup = geminiData.candidates[0].content.parts[0].text;

    console.log('Raw schema markup:', schemaMarkup);
    
    const jsonString = schemaMarkup.replace(/```json|```/g, '').trim();
    
    try {
      const { suggestedType, schema, validationWarnings } = JSON.parse(jsonString);
      const formattedSchema = JSON.stringify(schema, null, 2);

      return new Response(
        JSON.stringify({
          suggestedType,
          schema: formattedSchema,
          validationWarnings,
          instructions: 'Add this JSON-LD script tag to your page head section to improve AI understanding.',
          implementation: `<script type="application/ld+json">\n${formattedSchema}\n</script>`,
          url,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Invalid JSON:', jsonString);
      return generateFallbackSchema('Article', url); // Fallback to article type
    }
  } catch (error) {
    console.error('Schema generation error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate schema markup',
        details: (error as Error).message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

Deno.serve(handler);

// Fallback function to generate sample schema when API fails
function generateFallbackSchema(suggestedType: string, url: string): Response {
  console.log(`Generating fallback schema for ${suggestedType}`);
  
  const schemaData = {
    "@context": "https://schema.org",
    "@type": suggestedType,
    "name": "Example Title",
    "description": "This is a fallback schema description.",
    "url": url,
  };

  const formattedSchema = JSON.stringify(schemaData, null, 2);

  return new Response(
    JSON.stringify({
      suggestedType,
      schema: formattedSchema,
      validationWarnings: [
        {
          field: "review",
          message: "A 'review' or 'aggregateRating' is recommended for Products to build trust."
        },
        {
          field: "brand",
          message: "Adding a 'brand' property helps associate the product with its manufacturer."
        }
      ],
      instructions: 'Add this JSON-LD script tag to your page head section to improve AI understanding.',
      implementation: `<script type="application/ld+json">\n${formattedSchema}\n</script>`,
      url,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}