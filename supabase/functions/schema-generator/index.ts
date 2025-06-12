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
              text: `Generate valid Schema.org JSON-LD markup for a ${contentType} based on this information:

              URL: ${url}
              ${content ? `Content: ${content}` : ''}
              
              Requirements:
              1. Create valid, comprehensive Schema.org JSON-LD markup
              2. Include all relevant properties for the ${contentType} type
              3. Use appropriate Schema.org vocabulary
              4. Ensure the markup will help AI systems understand the content better
              5. Include structured data that enhances AI visibility and citation likelihood
              6. DO NOT include any comments in the JSON
              7. Make sure the JSON is valid and can be parsed with JSON.parse()
              8. Use double quotes for all property names and string values
              9. Do not use any control characters or escape sequences that would make the JSON invalid
              
              For ${contentType} type, include relevant properties like:
              ${contentType === 'article' ? '- headline, author, datePublished, dateModified, publisher, mainEntityOfPage' : ''}
              ${contentType === 'product' ? '- name, description, brand, offers, aggregateRating, review' : ''}
              ${contentType === 'organization' ? '- name, url, logo, contactPoint, address, sameAs' : ''}
              ${contentType === 'person' ? '- name, jobTitle, worksFor, url, sameAs, knowsAbout' : ''}
              ${contentType === 'faq' ? '- mainEntity with Question and Answer types' : ''}
              ${contentType === 'howto' ? '- name, description, step, totalTime, tool, supply' : ''}

              Return ONLY the JSON-LD markup, properly formatted and valid. Do not include any comments or explanations.`
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
      return generateFallbackSchema(contentType, url);
    }

    console.log('Received response from Gemini API');
    const geminiData = await geminiResponse.json();
    const schemaMarkup = geminiData.candidates[0].content.parts[0].text;

    // Clean up the response to ensure it's valid JSON
    let cleanedSchema = schemaMarkup
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .replace(/^[^{]*/, '')
      .replace(/[^}]*$/, '')
      .replace(/\/\/.*$/gm, '')  // Remove any single-line comments
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
      .trim();

    // Validate JSON
    let validatedSchema;
    try {
      // Try to parse the JSON
      validatedSchema = JSON.parse(cleanedSchema);
      console.log('Generated valid JSON schema');
      
      // Convert back to string with proper formatting
      const formattedSchema = JSON.stringify(validatedSchema, null, 2);
      
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
    } catch (e) {
      console.error('Generated schema is not valid JSON:', cleanedSchema);
      console.error('Error:', e);
      
      // Try to fix common JSON issues
      try {
        // Fix missing quotes around property names
        const fixedSchema = cleanedSchema
          .replace(/([{,]\s*)([a-zA-Z0-9_]+)(\s*:)/g, '$1"$2"$3')
          // Fix single quotes to double quotes
          .replace(/'/g, '"')
          // Fix trailing commas
          .replace(/,\s*}/g, '}')
          .replace(/,\s*]/g, ']');
          
        validatedSchema = JSON.parse(fixedSchema);
        console.log('Fixed and validated JSON schema');
        
        const formattedSchema = JSON.stringify(validatedSchema, null, 2);
        
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
      } catch (fixError) {
        console.error('Failed to fix JSON:', fixError);
        return generateFallbackSchema(contentType, url);
      }
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
        "datePublished": new Date().toISOString(),
        "dateModified": new Date().toISOString(),
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
        },
        "aggregateRating": {
          "@type": "AggregateRating",
          "ratingValue": "4.5",
          "reviewCount": "89"
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
          "contactType": "customer service",
          "email": "contact@example.com"
        },
        "address": {
          "@type": "PostalAddress",
          "streetAddress": "123 Main St",
          "addressLocality": "Anytown",
          "addressRegion": "CA",
          "postalCode": "12345",
          "addressCountry": "US"
        },
        "sameAs": [
          "https://www.facebook.com/example",
          "https://www.twitter.com/example",
          "https://www.linkedin.com/company/example"
        ]
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
          },
          {
            "@type": "Question",
            "name": "How can I improve my AI visibility?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "You can improve AI visibility by implementing proper schema markup, creating well-structured content, optimizing for voice search, and ensuring your content provides clear, factual information that AI systems can easily parse and cite."
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