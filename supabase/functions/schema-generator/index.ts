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

    // Log the request for debugging
    console.log(`Processing schema request for URL: ${url}, type: ${contentType}`);

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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Generate a simple, valid Schema.org JSON-LD markup for a ${contentType}.

              URL: ${url}
              ${content ? `Content: ${content.substring(0, 500)}...` : ''}
              
              IMPORTANT REQUIREMENTS:
              1. Create ONLY valid JSON that can be parsed with JSON.parse()
              2. Use ONLY double quotes for property names and string values
              3. DO NOT include any comments, explanations, or code blocks
              4. DO NOT use any control characters or escape sequences that would make JSON invalid
              5. DO NOT use trailing commas in objects or arrays
              6. Keep the schema simple and focused on essential properties
              
              For ${contentType} type, include these essential properties:
              ${contentType === 'article' ? '- headline, author, datePublished, publisher' : ''}
              ${contentType === 'product' ? '- name, description, brand, offers' : ''}
              ${contentType === 'organization' ? '- name, url, logo' : ''}
              ${contentType === 'person' ? '- name, jobTitle, url' : ''}
              ${contentType === 'faq' ? '- mainEntity with Question and Answer types' : ''}
              ${contentType === 'howto' ? '- name, description, step' : ''}

              Return ONLY the JSON object, nothing else.`
            }]
          }],
          generationConfig: {
            temperature: 0.1, // Lower temperature for more predictable output
            topK: 40,
            topP: 0.8,
            maxOutputTokens: 1024,
          }
        })
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', errorText);
      
      // Fallback to sample data if API fails
      console.log('Using fallback schema data');
      return generateFallbackSchema(contentType, url);
    }

    console.log('Received response from Gemini API');
    const geminiData = await geminiResponse.json();
    let schemaMarkup = geminiData.candidates[0].content.parts[0].text;

    // Extremely thorough cleaning to ensure valid JSON
    console.log('Raw schema markup:', schemaMarkup);
    
    // Step 1: Remove any markdown code blocks
    schemaMarkup = schemaMarkup.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    
    // Step 2: Find the first { and last } to extract just the JSON object
    const startIndex = schemaMarkup.indexOf('{');
    const endIndex = schemaMarkup.lastIndexOf('}');
    
    if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
      console.error('Could not find valid JSON object in response');
      return generateFallbackSchema(contentType, url);
    }
    
    schemaMarkup = schemaMarkup.substring(startIndex, endIndex + 1);
    
    // Step 3: Remove any control characters
    schemaMarkup = schemaMarkup.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
    
    // Step 4: Try to parse the JSON
    try {
      const parsedSchema = JSON.parse(schemaMarkup);
      const formattedSchema = JSON.stringify(parsedSchema, null, 2);
      
      console.log('Successfully parsed and formatted schema');
      
      return new Response(
        JSON.stringify({ 
          schema: formattedSchema,
          instructions: 'Add this JSON-LD script tag to your page head section to improve AI understanding',
          implementation: `<script type="application/ld+json">\n${formattedSchema}\n</script>`,
          contentType,
          url
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Invalid JSON:', schemaMarkup);
      
      // If we can't parse it, use the fallback
      return generateFallbackSchema(contentType, url);
    }
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

// Fallback function to generate sample schema when API fails
function generateFallbackSchema(contentType: string, url: string): Response {
  console.log(`Generating fallback schema for ${contentType}`);
  
  let schema = '';
  
  switch (contentType) {
    case 'article':
      schema = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": "Sample Article Title",
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
        },
        "datePublished": new Date().toISOString().split('T')[0],
        "dateModified": new Date().toISOString().split('T')[0],
        "mainEntityOfPage": {
          "@type": "WebPage",
          "@id": url
        },
        "description": "This is a sample article schema generated as a fallback."
      }, null, 2);
      break;
      
    case 'product':
      schema = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Product",
        "name": "Sample Product",
        "description": "This is a sample product description.",
        "brand": {
          "@type": "Brand",
          "name": "Sample Brand"
        },
        "offers": {
          "@type": "Offer",
          "price": "99.99",
          "priceCurrency": "USD",
          "availability": "https://schema.org/InStock"
        }
      }, null, 2);
      break;
      
    case 'organization':
      schema = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "Sample Organization",
        "url": url,
        "logo": "https://example.com/logo.png",
        "contactPoint": {
          "@type": "ContactPoint",
          "telephone": "+1-555-555-5555",
          "contactType": "customer service"
        }
      }, null, 2);
      break;
      
    case 'faq':
      schema = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "What is AI visibility?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "AI visibility refers to how well your content is structured and optimized for AI systems like ChatGPT, Google Bard, and voice assistants."
            }
          },
          {
            "@type": "Question",
            "name": "Why is AI visibility important?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "As more people use AI to find information, traditional SEO isn't enough. Your content needs to be easily understood and cited by AI systems."
            }
          }
        ]
      }, null, 2);
      break;
      
    default:
      schema = JSON.stringify({
        "@context": "https://schema.org",
        "@type": contentType.charAt(0).toUpperCase() + contentType.slice(1),
        "name": `Sample ${contentType}`,
        "description": `This is a sample ${contentType} schema generated as a fallback.`,
        "url": url
      }, null, 2);
  }
  
  return new Response(
    JSON.stringify({ 
      schema: schema,
      instructions: 'Add this JSON-LD script tag to your page head section to improve AI understanding',
      implementation: `<script type="application/ld+json">\n${schema}\n</script>`,
      contentType,
      url,
      note: 'This is fallback schema data as the API request failed'
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}