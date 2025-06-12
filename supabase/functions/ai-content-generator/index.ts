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
    
    console.log(`Processing content generation request for ${contentType} about ${topic}`);
    console.log(`Keywords: ${targetKeywords.join(', ')}, Tone: ${tone}, Length: ${contentLength}`);

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

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY') || 'AIzaSyDJC5a7zgGvBk58ojXPKkQJXu-fR3qHHHM'; // Fallback to demo key
    
    if (!geminiApiKey) {
      console.error('Gemini API key not configured');
      return new Response(
        JSON.stringify({ error: 'Gemini API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Calling Gemini API for content generation...');
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
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
      
      // Return fallback data if API fails
      console.log('Using fallback content generation data');
      return generateFallbackContent(contentType, topic, targetKeywords, tone);
    }

    console.log('Received response from Gemini API');
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

    console.log(`Content generation complete. Generated ${contentType} content`);
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

// Fallback function to generate sample content when API fails
function generateFallbackContent(contentType: string, topic: string, targetKeywords: string[], tone: string): Response {
  console.log(`Generating fallback ${contentType} content for ${topic}`);
  
  let parsedContent: any = { raw: '' };
  
  switch (contentType) {
    case 'faq':
      const faqs = [
        {
          question: `What is ${topic}?`,
          answer: `${topic} refers to the strategic approach to optimizing digital content for better visibility and performance in modern search environments. It encompasses various techniques and best practices designed to help businesses and individuals achieve their goals.`
        },
        {
          question: `Why is ${topic} important?`,
          answer: `${topic} is crucial because it directly impacts your ability to reach and engage your target audience effectively. In today's digital landscape, having a strong ${topic} strategy can significantly improve your visibility, credibility, and overall performance.`
        },
        {
          question: `How can I improve my ${topic} strategy?`,
          answer: `To enhance your ${topic} strategy, focus on creating high-quality, structured content that addresses user needs and questions directly. Implement proper technical optimizations, maintain consistency across platforms, and regularly analyze performance metrics to make data-driven improvements.`
        },
        {
          question: `What are the best tools for ${topic}?`,
          answer: `The best tools for ${topic} include comprehensive analytics platforms, content optimization software, technical audit tools, and competitive intelligence solutions. The ideal toolset depends on your specific goals, industry, and resources.`
        },
        {
          question: `How long does it take to see results from ${topic} efforts?`,
          answer: `Results from ${topic} efforts typically begin to appear within 2-4 weeks, with more significant improvements visible after 2-3 months of consistent implementation. However, this timeline can vary based on your starting point, industry competition, and the scope of your optimization efforts.`
        }
      ];
      
      parsedContent = {
        raw: faqs.map(faq => `Q: ${faq.question}\nA: ${faq.answer}`).join('\n\n'),
        faqs
      };
      break;
      
    case 'meta-tags':
      parsedContent = {
        raw: `TITLE: Complete Guide to ${topic}: Strategies, Tips & Best Practices\nDESCRIPTION: Discover expert insights on ${topic} including ${targetKeywords.join(', ')}. Learn proven strategies to improve your results and stay ahead of the competition.\nKEYWORDS: ${topic}, ${targetKeywords.join(', ')}, guide, strategies, best practices\nOG_TITLE: Ultimate ${topic} Guide: Expert Strategies & Tips\nOG_DESCRIPTION: Comprehensive resource on ${topic} with actionable insights and proven techniques for better results.`,
        metaTags: {
          title: `Complete Guide to ${topic}: Strategies, Tips & Best Practices`,
          description: `Discover expert insights on ${topic} including ${targetKeywords.join(', ')}. Learn proven strategies to improve your results and stay ahead of the competition.`,
          keywords: `${topic}, ${targetKeywords.join(', ')}, guide, strategies, best practices`,
          ogTitle: `Ultimate ${topic} Guide: Expert Strategies & Tips`,
          ogDescription: `Comprehensive resource on ${topic} with actionable insights and proven techniques for better results.`
        }
      };
      break;
      
    case 'snippets':
      parsedContent.raw = `Definition Snippet:
${topic} refers to the strategic approach to optimizing digital content and presence for better visibility and performance in modern search and discovery environments.

How-to Snippet:
How to Improve Your ${topic}:
1. Conduct a comprehensive audit of your current performance
2. Identify key areas for improvement based on data
3. Implement strategic optimizations in priority order
4. Monitor results and adjust your approach as needed
5. Stay updated on industry trends and best practices

List Snippet:
Top 5 ${topic} Strategies:
• Create high-quality, structured content
• Implement proper technical optimizations
• Focus on user experience and engagement
• Maintain consistent cross-platform presence
• Regularly analyze performance metrics

Table Snippet:
| ${topic} Component | Importance | Implementation Difficulty |
|-------------------|------------|---------------------------|
| Content Quality   | High       | Medium                    |
| Technical Setup   | High       | High                      |
| User Experience   | Medium     | Medium                    |
| Analytics         | Medium     | Low                       |
| Ongoing Maintenance | Medium   | Low                       |

FAQ Snippet:
Q: What is the most important aspect of ${topic}?
A: The most critical component of ${topic} is creating high-quality, well-structured content that addresses user needs while being easily understood by both humans and AI systems.`;
      break;
      
    case 'headings':
      parsedContent.raw = `H1: Complete Guide to ${topic}: Strategies for Success in ${new Date().getFullYear()}

H2: Understanding ${topic} Fundamentals
H3: Key Components of Effective ${topic}
H3: How ${topic} Has Evolved
H3: Why ${topic} Matters in Today's Digital Landscape

H2: Essential ${topic} Strategies
H3: Establishing Your ${topic} Foundation
H3: Advanced Techniques for ${targetKeywords[0] || 'Optimization'}
H3: Measuring ${topic} Success

H2: Implementing ${topic} Best Practices
H3: Step-by-Step Implementation Guide
H3: Common ${topic} Mistakes to Avoid
H3: Tools to Enhance Your ${topic} Efforts

H2: ${topic} Case Studies and Examples
H3: Success Stories from Industry Leaders
H3: Before and After: ${topic} Transformations
H3: Lessons Learned from Failed ${topic} Attempts

H2: Frequently Asked Questions About ${topic}
H3: Basic ${topic} Questions
H3: Advanced ${topic} Considerations
H3: Troubleshooting ${topic} Issues`;
      break;
      
    case 'descriptions':
      parsedContent.raw = `SHORT:
${topic} encompasses strategic approaches to optimizing digital content for better visibility and performance in modern search environments, focusing on ${targetKeywords.slice(0, 2).join(' and ')}.

MEDIUM:
${topic} refers to the comprehensive strategy of optimizing digital content and presence for maximum visibility and effectiveness in today's AI-driven search landscape. By focusing on ${targetKeywords.join(', ')}, organizations can improve their discoverability, citation rates, and overall digital performance across various platforms and interfaces.

LONG:
${topic} represents a holistic approach to digital optimization designed specifically for the era of AI-driven search and discovery. Unlike traditional methods, ${topic} focuses on how content is structured, contextualized, and presented to ensure maximum comprehension by artificial intelligence systems including large language models, voice assistants, and other AI interfaces. By implementing best practices around ${targetKeywords.join(', ')}, organizations can significantly improve their visibility in AI-generated answers, voice search results, and featured snippets. This approach recognizes the fundamental shift in how information is discovered and consumed in the modern digital ecosystem, where AI increasingly mediates between content and users.

ELEVATOR_PITCH:
${topic} is our specialized approach to optimizing your digital presence for today's AI-driven search landscape. We help you structure content so it's easily understood by systems like ChatGPT and voice assistants, dramatically increasing your visibility when people ask questions in your industry. Unlike traditional SEO, we focus on citation likelihood, conversational readiness, and AI understanding to ensure your content gets featured in the places that matter most.`;
      break;
  }
  
  return new Response(
    JSON.stringify({
      contentType,
      topic,
      targetKeywords,
      tone,
      industry: industry || 'General',
      targetAudience: targetAudience || 'General audience',
      contentLength: 'medium',
      generatedContent: parsedContent,
      wordCount: parsedContent.raw.split(' ').length,
      generatedAt: new Date().toISOString(),
      optimizationTips: [
        'Content is structured for AI understanding',
        'Natural keyword integration for voice search',
        'Clear, citable format for AI systems',
        'Semantic structure for better comprehension'
      ],
      note: 'This is fallback content data as the API request failed'
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}