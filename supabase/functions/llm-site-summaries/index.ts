import { corsHeaders } from '../_shared/cors.ts';

interface SummaryRequest {
  url: string;
  content?: string;
  summaryType: 'overview' | 'technical' | 'business' | 'audience';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { url, content, summaryType }: SummaryRequest = await req.json();

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
            'User-Agent': 'SEOGENIX LLM Summary Bot 1.0'
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

    const summaryPrompts = {
      overview: `Create a comprehensive overview summary of this website that helps AI systems understand its purpose, main topics, and value proposition.`,
      technical: `Generate a technical summary focusing on the website's functionality, features, and technical aspects for AI systems.`,
      business: `Create a business-focused summary highlighting the company's services, target market, and competitive advantages.`,
      audience: `Generate an audience-focused summary describing who this website serves and what problems it solves for users.`
    };

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`,
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
      throw new Error(`Gemini API failed: ${geminiResponse.status}`);
    }

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
        .filter(line => line.trim().startsWith('-'))
        .map(line => line.trim().substring(1).trim())
        .slice(0, 10) : [];

    const topics = topicsMatch ?
      topicsMatch[1].split('\n')
        .filter(line => line.trim().startsWith('-'))
        .map(line => line.trim().substring(1).trim())
        .slice(0, 8) : [];

    const optimizationNotes = notesMatch ? notesMatch[1].trim() : '';

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
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});