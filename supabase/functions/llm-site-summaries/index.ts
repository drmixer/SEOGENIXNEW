import { corsHeaders } from '../_shared/cors.ts';

interface SummaryRequest {
  url: string;
  content?: string;
  summaryType: 'overview' | 'technical' | 'business' | 'audience';
}

export const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { url, content, summaryType }: SummaryRequest = await req.json();
    
    console.log(`Processing ${summaryType} summary for URL: ${url}`);

    // Fetch content if URL provided and no content given
    let pageContent = content;
    if (url && !content) {
      try {
        console.log(`Fetching content from ${url}`);
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'SEOGENIX LLM Summary Bot 1.0'
          }
        });
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

    const summaryPrompts = {
      overview: `Create a comprehensive overview summary of this website that helps AI systems understand its purpose, main topics, and value proposition.`,
      technical: `Generate a technical summary focusing on the website's functionality, features, and technical aspects for AI systems.`,
      business: `Create a business-focused summary highlighting the company's services, target market, and competitive advantages.`,
      audience: `Generate an audience-focused summary describing who this website serves and what problems it solves for users.`
    };

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY') || 'AIzaSyDJC5a7zgGvBk58ojXPKkQJXu-fR3qHHHM'; // Fallback to demo key
    
    if (!geminiApiKey) {
      console.error('Gemini API key not configured');
      return new Response(
        JSON.stringify({ error: 'Gemini API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Calling Gemini API for site summary generation...');
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `${summaryPrompts[summaryType]}

              Website URL: ${url}
              Content: ${pageContent?.substring(0, 4000) || 'No content provided'}

              Create a summary that:
              1. Is optimized for AI language model understanding
              2. Uses clear, structured language
              3. Includes key entities (people, places, organizations, concepts)
              4. Highlights main topics and themes
              5. Is 150-300 words long
              6. Uses natural language that AI systems can easily parse and cite

              Format the response as:
              SUMMARY:
              [Your optimized summary here]

              KEY ENTITIES:
              - [Entity 1]: [Brief description]
              - [Entity 2]: [Brief description]
              - [Entity 3]: [Brief description]

              MAIN TOPICS:
              - [Topic 1]
              - [Topic 2]
              - [Topic 3]

              AI OPTIMIZATION NOTES:
              [Brief notes on how this summary helps AI understanding]`
            }]
          }],
          generationConfig: {
            temperature: 0.3,
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
      
      // Return fallback summary if API fails
      console.log('Using fallback summary data');
      return generateFallbackSummary(url, summaryType);
    }

    console.log('Received response from Gemini API');
    const geminiData = await geminiResponse.json();
    const responseText = geminiData.candidates[0].content.parts[0].text;

    // Parse the response
    const summaryMatch = responseText.match(/SUMMARY:\s*([\s\S]*?)(?=KEY ENTITIES:|$)/i);
    const entitiesMatch = responseText.match(/KEY ENTITIES:\s*([\s\S]*?)(?=MAIN TOPICS:|$)/i);
    const topicsMatch = responseText.match(/MAIN TOPICS:\s*([\s\S]*?)(?=AI OPTIMIZATION NOTES:|$)/i);
    const notesMatch = responseText.match(/AI OPTIMIZATION NOTES:\s*([\s\S]*?)$/i);

    const summary = summaryMatch ? summaryMatch[1].trim() : responseText;
    
    const entities = entitiesMatch ? 
      entitiesMatch[1].split('\n')
        .filter((line: string) => line.trim().startsWith('-'))
        .map((line: string) => line.trim().substring(1).trim())
        .slice(0, 10) : [];

    const topics = topicsMatch ?
      topicsMatch[1].split('\n')
        .filter((line: string) => line.trim().startsWith('-'))
        .map((line: string) => line.trim().substring(1).trim())
        .slice(0, 8) : [];

    const optimizationNotes = notesMatch ? notesMatch[1].trim() : '';

    console.log(`Returning ${summaryType} summary with ${entities.length} entities and ${topics.length} topics`);
    return new Response(
      JSON.stringify({
        url,
        summaryType,
        summary,
        entities,
        topics,
        optimizationNotes,
        wordCount: summary.split(' ').length,
        generatedAt: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('LLM summary generation error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate LLM summary',
        details: (error as Error).message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

Deno.serve(handler);

// Fallback function to generate sample summary when API fails
function generateFallbackSummary(url: string, summaryType: string): Response {
  console.log(`Generating fallback ${summaryType} summary for ${url}`);
  
  const domain = url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  const brandName = domain.split('.')[0];
  
  let summary = '';
  let entities: string[] = [];
  let topics: string[] = [];
  let optimizationNotes = '';
  
  switch (summaryType) {
    case 'overview':
      summary = `${brandName.charAt(0).toUpperCase() + brandName.slice(1)} is a comprehensive platform that provides solutions for digital optimization and AI visibility. The website offers tools and services designed to help businesses improve their online presence and performance in AI-driven search environments. Users can access various features including analytics, optimization recommendations, and performance tracking. The platform emphasizes data-driven approaches to digital strategy and aims to deliver measurable results for clients across different industries.`;
      
      entities = [
        'AI Visibility: A measure of how well content is optimized for AI systems',
        'Digital Optimization: Process of improving online presence and performance',
        `${brandName.charAt(0).toUpperCase() + brandName.slice(1)}: The company providing the platform and services`
      ];
      
      topics = [
        'AI-driven search optimization',
        'Digital performance analytics',
        'Content optimization strategies',
        'Business growth through AI visibility'
      ];
      
      optimizationNotes = 'This summary provides clear context about the platform purpose, key offerings, and value proposition in a format that AI systems can easily parse and reference.';
      break;
      
    case 'technical':
      summary = `${brandName.charAt(0).toUpperCase() + brandName.slice(1)} is built on a modern tech stack featuring React for the frontend and a robust API backend. The platform implements advanced algorithms for content analysis and optimization recommendations. Technical features include real-time analytics dashboards, automated content scanning, schema markup generation, and integration capabilities with popular CMS platforms. The system architecture prioritizes scalability and performance, with cloud-based processing for handling large datasets efficiently.`;
      
      entities = [
        'React: Frontend JavaScript library used for the user interface',
        'API: Application Programming Interface for data exchange',
        'Schema Markup: Structured data format for improved AI understanding'
      ];
      
      topics = [
        'Technical architecture',
        'Performance optimization',
        'Integration capabilities',
        'Data processing systems'
      ];
      
      optimizationNotes = 'This technical summary provides specific implementation details and architectural information that technical AI queries would seek to reference.';
      break;
      
    case 'business':
      summary = `${brandName.charAt(0).toUpperCase() + brandName.slice(1)} offers a SaaS solution for businesses seeking to optimize their digital presence for AI-driven search and discovery. The company provides tiered subscription plans targeting different market segments from small businesses to enterprise clients. Their competitive advantage lies in specialized AI visibility metrics and proprietary optimization algorithms. The business model focuses on delivering measurable ROI through improved digital performance and increased visibility in AI systems like ChatGPT, Claude, and voice assistants.`;
      
      entities = [
        'SaaS: Software as a Service business model',
        'ROI: Return on Investment measurement',
        'Market Segments: Different customer groups targeted by the business'
      ];
      
      topics = [
        'Business model',
        'Value proposition',
        'Competitive advantages',
        'Target markets'
      ];
      
      optimizationNotes = 'This business summary clearly articulates the company\'s market position, business model, and value proposition for business-focused AI queries.';
      break;
      
    case 'audience':
      summary = `${brandName.charAt(0).toUpperCase() + brandName.slice(1)} serves digital marketers, SEO professionals, content strategists, and business owners who need to adapt to the AI-driven search landscape. The platform addresses key pain points including declining traditional search visibility, difficulty getting content cited by AI systems, and challenges in measuring AI optimization effectiveness. Users benefit from actionable insights, simplified technical implementation, and competitive intelligence. The solution is particularly valuable for businesses in competitive industries where AI visibility can provide a significant advantage.`;
      
      entities = [
        'Digital Marketers: Primary user persona focused on online marketing strategies',
        'SEO Professionals: Specialists in search engine optimization',
        'Content Strategists: Professionals who plan and manage content creation'
      ];
      
      topics = [
        'User personas',
        'Pain points addressed',
        'Benefits for different user types',
        'Industry applications'
      ];
      
      optimizationNotes = 'This audience-focused summary clearly identifies who the platform serves and what problems it solves, making it ideal for AI systems to match with relevant user queries.';
      break;
  }

  return new Response(
    JSON.stringify({
      url,
      summaryType,
      summary,
      entities,
      topics,
      optimizationNotes,
      wordCount: summary.split(' ').length,
      generatedAt: new Date().toISOString(),
      note: 'This is fallback summary data as the API request failed'
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}