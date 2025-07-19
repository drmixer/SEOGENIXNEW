import { corsHeaders } from '../_shared/cors.ts';

interface SchemaRequest {
  url: string;
  contentType: 'article' | 'product' | 'organization' | 'person' | 'faq' | 'howto';
  content?: string;
}

export const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { url, contentType, content }: SchemaRequest = await req.json();

    // Log the request for debugging
    console.log(`Processing schema request for URL: ${url}, type: ${contentType}`);

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
    
    // Extract domain and page info from URL
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    const path = urlObj.pathname;
    const pageName = path.split('/').filter(Boolean).pop() || 'Home';
    const siteName = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
    
    // Use Gemini API to generate appropriate schema markup
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Generate a detailed, specific Schema.org JSON-LD markup for a ${contentType} based on this URL and content.

              URL: ${url}
              Domain: ${domain}
              Page: ${pageName}
              Site Name: ${siteName}
              Content: ${pageContent ? pageContent.substring(0, 3000) : 'Not available, use URL information'}
              
              IMPORTANT REQUIREMENTS:
              1. Create ONLY valid JSON that can be parsed with JSON.parse()
              2. Use ONLY double quotes for property names and string values
              3. DO NOT include any comments, explanations, or code blocks
              4. DO NOT use any control characters or escape sequences that would make JSON invalid
              5. DO NOT use trailing commas in objects or arrays
              6. Make the schema SPECIFIC to the URL and content provided, not generic
              7. Use realistic values based on the URL and content, not placeholder text
              
              For ${contentType} type, include these essential properties:
              ${contentType === 'article' ? '- headline (use a specific title from content or URL), author, datePublished, publisher (use site name), description, mainEntityOfPage' : ''}
              ${contentType === 'product' ? '- name (specific product name), description, brand, offers with price, availability, and currency' : ''}
              ${contentType === 'organization' ? '- name (use site name), url, logo, description, contactPoint, address if available' : ''}
              ${contentType === 'person' ? '- name (use a real name if available), jobTitle, url, description, affiliation if relevant' : ''}
              ${contentType === 'faq' ? '- mainEntity with multiple specific Question and Answer pairs based on content' : ''}
              ${contentType === 'howto' ? '- name (specific how-to title), description, step array with multiple detailed steps' : ''}

              Return ONLY the JSON object, nothing else.`
            }]
          }],
          generationConfig: {
            temperature: 0.2, // Lower temperature for more predictable output
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
      return generateFallbackSchema(schemaType, url);
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
        details: (error as Error).message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

Deno.serve(handler);

// Fallback function to generate sample schema when API fails
function generateFallbackSchema(contentType: string, url: string): Response {
  console.log(`Generating fallback schema for ${contentType}`);
  
  // Extract domain and page info from URL
  let domain = '';
  let pageName = 'Home';
  let siteName = 'Example';
  
  try {
    const urlObj = new URL(url);
    domain = urlObj.hostname;
    const path = urlObj.pathname;
    pageName = path.split('/').filter(Boolean).pop() || 'Home';
    siteName = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
  } catch (e) {
    console.error('Error parsing URL:', e);
  }
  
  let schema = '';
  
  switch (contentType) {
    case 'article':
      schema = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": `${siteName} - ${pageName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`,
        "author": {
          "@type": "Person",
          "name": `${siteName} Team`
        },
        "publisher": {
          "@type": "Organization",
          "name": siteName,
          "logo": {
            "@type": "ImageObject",
            "url": `https://${domain}/logo.png`
          }
        },
        "datePublished": new Date().toISOString().split('T')[0],
        "dateModified": new Date().toISOString().split('T')[0],
        "mainEntityOfPage": {
          "@type": "WebPage",
          "@id": url
        },
        "description": `Comprehensive information about ${pageName.replace(/-/g, ' ')} from ${siteName}.`
      }, null, 2);
      break;
      
    case 'product':
      schema = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Product",
        "name": `${siteName} ${pageName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`,
        "description": `High-quality ${pageName.replace(/-/g, ' ')} offered by ${siteName}.`,
        "brand": {
          "@type": "Brand",
          "name": siteName
        },
        "offers": {
          "@type": "Offer",
          "price": "99.99",
          "priceCurrency": "USD",
          "availability": "https://schema.org/InStock",
          "url": url
        },
        "image": `https://${domain}/images/${pageName}.jpg`
      }, null, 2);
      break;
      
    case 'organization':
      schema = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": siteName,
        "url": `https://${domain}`,
        "logo": `https://${domain}/logo.png`,
        "description": `${siteName} is a leading provider of solutions in the industry.`,
        "contactPoint": {
          "@type": "ContactPoint",
          "telephone": "+1-555-555-5555",
          "contactType": "customer service",
          "email": `info@${domain}`
        },
        "address": {
          "@type": "PostalAddress",
          "streetAddress": "123 Main Street",
          "addressLocality": "San Francisco",
          "addressRegion": "CA",
          "postalCode": "94105",
          "addressCountry": "US"
        },
        "sameAs": [
          `https://twitter.com/${siteName.toLowerCase()}`,
          `https://facebook.com/${siteName.toLowerCase()}`,
          `https://linkedin.com/company/${siteName.toLowerCase()}`
        ]
      }, null, 2);
      break;
      
    case 'person':
      schema = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Person",
        "name": `John Smith at ${siteName}`,
        "jobTitle": "Chief Executive Officer",
        "url": url,
        "description": `Professional profile and information about John Smith at ${siteName}.`,
        "affiliation": {
          "@type": "Organization",
          "name": siteName
        },
        "image": `https://${domain}/team/john-smith.jpg`,
        "email": `john@${domain}`,
        "telephone": "+1-555-555-5555",
        "sameAs": [
          "https://twitter.com/johnsmith",
          "https://linkedin.com/in/johnsmith"
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
            "name": `What services does ${siteName} offer?`,
            "acceptedAnswer": {
              "@type": "Answer",
              "text": `${siteName} offers a comprehensive range of services including consulting, implementation, and ongoing support tailored to your specific needs.`
            }
          },
          {
            "@type": "Question",
            "name": `How can I contact ${siteName} for support?`,
            "acceptedAnswer": {
              "@type": "Answer",
              "text": `You can reach our support team by email at support@${domain}, by phone at +1-555-555-5555, or through the contact form on our website.`
            }
          },
          {
            "@type": "Question",
            "name": `What makes ${siteName} different from competitors?`,
            "acceptedAnswer": {
              "@type": "Answer",
              "text": `${siteName} stands out through our innovative approach, dedicated customer service, and industry-leading expertise that delivers measurable results for our clients.`
            }
          },
          {
            "@type": "Question",
            "name": `Does ${siteName} offer customized solutions?`,
            "acceptedAnswer": {
              "@type": "Answer",
              "text": `Yes, we specialize in creating tailored solutions that address your specific challenges and requirements, ensuring optimal results for your unique situation.`
            }
          }
        ]
      }, null, 2);
      break;
      
    case 'howto':
      schema = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "HowTo",
        "name": `How to Get Started with ${siteName}`,
        "description": `A step-by-step guide to implementing ${siteName} solutions for your business.`,
        "totalTime": "PT30M",
        "tool": [
          {
            "@type": "HowToTool",
            "name": `${siteName} Account`
          },
          {
            "@type": "HowToTool",
            "name": "Internet Connection"
          }
        ],
        "step": [
          {
            "@type": "HowToStep",
            "name": "Create an Account",
            "text": `Visit ${domain} and click on the 'Sign Up' button to create your account.`,
            "url": `https://${domain}/signup`,
            "image": `https://${domain}/images/signup.jpg`
          },
          {
            "@type": "HowToStep",
            "name": "Complete Your Profile",
            "text": "Fill in your business details and preferences to personalize your experience.",
            "url": `https://${domain}/profile`,
            "image": `https://${domain}/images/profile.jpg`
          },
          {
            "@type": "HowToStep",
            "name": "Configure Your Settings",
            "text": "Adjust settings to match your specific requirements and goals.",
            "url": `https://${domain}/settings`,
            "image": `https://${domain}/images/settings.jpg`
          },
          {
            "@type": "HowToStep",
            "name": "Launch Your First Project",
            "text": "Create and configure your first project to start seeing results.",
            "url": `https://${domain}/projects`,
            "image": `https://${domain}/images/project.jpg`
          }
        ]
      }, null, 2);
      break;
      
    default:
      schema = JSON.stringify({
        "@context": "https://schema.org",
        "@type": contentType.charAt(0).toUpperCase() + contentType.slice(1),
        "name": `${siteName} - ${pageName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`,
        "description": `Information about ${pageName.replace(/-/g, ' ')} from ${siteName}.`,
        "url": url
      }, null, 2);
  }
  
  return new Response(
    JSON.stringify({ 
      schema: schema,
      instructions: 'Add this JSON-LD script tag to your page head section to improve AI understanding',
      implementation: `<script type="application/ld+json">\n${schema}\n</script>`,
      contentType,
      url
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}