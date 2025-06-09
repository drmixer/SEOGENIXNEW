import { corsHeaders } from '../_shared/cors.ts';

interface ContentGenerationRequest {
  contentType: 'faq' | 'meta-tags' | 'snippets' | 'headings' | 'descriptions';
  topic: string;
  targetKeywords: string[];
  tone?: 'professional' | 'casual' | 'technical' | 'friendly';
  industry?: string;
  targetAudience?: string;
  contentLength?: 'short' | 'medium' | 'long';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { 
      contentType, 
      topic, 
      targetKeywords, 
      tone = 'professional',
      industry,
      targetAudience,
      contentLength = 'medium'
    }: ContentGenerationRequest = await req.json();

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: 'Gemini API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const contentPrompts = {
      faq: `Generate a comprehensive FAQ section optimized for AI visibility and voice search. Create questions that people commonly ask about ${topic} and provide clear, concise answers that AI systems can easily understand and cite.`,
      
      'meta-tags': `Generate optimized meta tags (title, description, keywords) for a page about ${topic}. Ensure they are optimized for both traditional search engines and AI systems.`,
      
      snippets: `Create featured snippet-optimized content pieces about ${topic}. Format them to be easily extracted by AI systems and voice assistants.`,
      
      headings: `Generate a comprehensive heading structure (H1, H2, H3) for content about ${topic}. Ensure the headings are optimized for AI understanding and semantic structure.`,
      
      descriptions: `Create various types of descriptions (short, medium, long) about ${topic} that are optimized for AI comprehension and citation likelihood.`
    };

    const lengthGuidelines = {
      short: contentType === 'faq' ? '5-8 Q&As' : '50-100 words each',
      medium: contentType === 'faq' ? '8-12 Q&As' : '100-200 words each',
      long: contentType === 'faq' ? '12-20 Q&As' : '200-300 words each'
    };

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `${contentPrompts[contentType]}

              Topic: ${topic}
              Target Keywords: ${targetKeywords.join(', ')}
              Tone: ${tone}
              Industry: ${industry || 'General'}
              Target Audience: ${targetAudience || 'General audience'}
              Content Length: ${contentLength} (${lengthGuidelines[contentLength]})

              Requirements:
              1. Optimize for AI systems (ChatGPT, Claude, Bard, voice assistants)
              2. Use natural language that AI can easily parse and cite
              3. Include target keywords naturally
              4. Structure content for maximum AI visibility
              5. Ensure content is factual and helpful
              6. Use clear, concise language
              7. Include relevant entities and context

              ${contentType === 'faq' ? `
              Format as:
              Q: [Question optimized for voice search]
              A: [Clear, concise answer that AI can easily cite]
              
              Include questions like:
              - What is [topic]?
              - How does [topic] work?
              - Why is [topic] important?
              - When should you use [topic]?
              - Where can you find [topic]?
              - Who benefits from [topic]?
              ` : ''}

              ${contentType === 'meta-tags' ? `
              Format as:
              TITLE: [SEO and AI optimized title tag]
              DESCRIPTION: [Meta description optimized for AI understanding]
              KEYWORDS: [Relevant keywords for AI systems]
              OG_TITLE: [Open Graph title]
              OG_DESCRIPTION: [Open Graph description]
              ` : ''}

              ${contentType === 'snippets' ? `
              Create multiple snippet formats:
              - Definition snippet
              - How-to snippet  
              - List snippet
              - Table snippet
              - FAQ snippet
              ` : ''}

              ${contentType === 'headings' ? `
              Format as:
              H1: [Main heading]
              H2: [Section headings]
              H3: [Subsection headings]
              
              Ensure semantic hierarchy and AI-friendly structure.
              ` : ''}

              ${contentType === 'descriptions' ? `
              Provide:
              SHORT: [50-100 word description]
              MEDIUM: [100-200 word description]  
              LONG: [200-300 word description]
              ELEVATOR_PITCH: [30-second explanation]
              ` : ''}`
            }]
          }],
          generationConfig: {
            temperature: 0.6,
            topK: 40,
            topP: 0.9,
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
    const generatedContent = geminiData.candidates[0].content.parts[0].text;

    // Parse content based on type
    let parsedContent: any = { raw: generatedContent };

    if (contentType === 'faq') {
      const qaPairs = [];
      const lines = generatedContent.split('\n');
      let currentQ = '';
      let currentA = '';
      
      for (const line of lines) {
        if (line.trim().startsWith('Q:')) {
          if (currentQ && currentA) {
            qaPairs.push({ question: currentQ, answer: currentA.trim() });
          }
          currentQ = line.substring(2).trim();
          currentA = '';
        } else if (line.trim().startsWith('A:')) {
          currentA = line.substring(2).trim();
        } else if (currentA && line.trim()) {
          currentA += ' ' + line.trim();
        }
      }
      
      if (currentQ && currentA) {
        qaPairs.push({ question: currentQ, answer: currentA.trim() });
      }
      
      parsedContent.faqs = qaPairs;
    } else if (contentType === 'meta-tags') {
      const titleMatch = generatedContent.match(/TITLE:\s*(.*)/i);
      const descMatch = generatedContent.match(/DESCRIPTION:\s*(.*)/i);
      const keywordsMatch = generatedContent.match(/KEYWORDS:\s*(.*)/i);
      const ogTitleMatch = generatedContent.match(/OG_TITLE:\s*(.*)/i);
      const ogDescMatch = generatedContent.match(/OG_DESCRIPTION:\s*(.*)/i);
      
      parsedContent.metaTags = {
        title: titleMatch ? titleMatch[1].trim() : '',
        description: descMatch ? descMatch[1].trim() : '',
        keywords: keywordsMatch ? keywordsMatch[1].trim() : '',
        ogTitle: ogTitleMatch ? ogTitleMatch[1].trim() : '',
        ogDescription: ogDescMatch ? ogDescMatch[1].trim() : ''
      };
    }

    return new Response(
      JSON.stringify({
        contentType,
        topic,
        targetKeywords,
        tone,
        industry,
        targetAudience,
        contentLength,
        generatedContent: parsedContent,
        wordCount: generatedContent.split(' ').length,
        generatedAt: new Date().toISOString(),
        optimizationTips: [
          'Content is structured for AI understanding',
          'Natural keyword integration for voice search',
          'Clear, citable format for AI systems',
          'Semantic structure for better comprehension'
        ]
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('AI content generation error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate AI-optimized content',
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});