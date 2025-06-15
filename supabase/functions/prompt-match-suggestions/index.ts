import { corsHeaders } from '../_shared/cors.ts';

interface PromptMatchRequest {
  topic: string;
  industry?: string;
  targetAudience?: string;
  contentType?: 'article' | 'product' | 'service' | 'faq' | 'guide';
  userIntent?: 'informational' | 'transactional' | 'navigational' | 'commercial';
  websiteUrl?: string; // Added to provide context about the site
}

interface PromptSuggestion {
  prompt: string;
  category: string;
  intent: string;
  aiSystem: string;
  likelihood: number;
  optimization: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { 
      topic, 
      industry, 
      targetAudience, 
      contentType = 'article',
      userIntent = 'informational',
      websiteUrl
    }: PromptMatchRequest = await req.json();
    
    console.log(`Processing prompt match suggestions for topic: ${topic}`);
    console.log(`Industry: ${industry || 'not specified'}, Content type: ${contentType}, User intent: ${userIntent}`);
    console.log(`Website URL: ${websiteUrl || 'not provided'}`);

    // Ensure we have a valid topic
    if (!topic || topic.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Topic is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch website content if URL is provided to use as context
    let websiteContent = '';
    if (websiteUrl) {
      try {
        console.log(`Fetching content from ${websiteUrl} for context`);
        const response = await fetch(websiteUrl, {
          headers: {
            'User-Agent': 'SEOGENIX Prompt Suggestions Bot 1.0'
          }
        });
        if (response.ok) {
          websiteContent = await response.text();
          console.log(`Successfully fetched website content, length: ${websiteContent.length} characters`);
        } else {
          console.error(`Failed to fetch website: ${response.status}`);
        }
      } catch (error) {
        console.error('Failed to fetch website:', error);
      }
    }

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY') || 'AIzaSyDJC5a7zgGvBk58ojXPKkQJXu-fR3qHHHM'; // Fallback to demo key
    
    if (!geminiApiKey) {
      console.error('Gemini API key not configured');
      return new Response(
        JSON.stringify({ error: 'Gemini API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Calling Gemini API for prompt suggestions...');
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Generate specific, realistic prompt suggestions that users might ask AI systems (ChatGPT, Claude, Bard, voice assistants) related to this topic. These prompts should align with how people naturally ask questions to AI.

              Topic: ${topic}
              Industry: ${industry || 'General'}
              Target Audience: ${targetAudience || 'General audience'}
              Content Type: ${contentType}
              User Intent: ${userIntent}
              
              ${websiteContent ? `Website Context (use this to make prompts specific to this website):
              ${websiteContent.substring(0, 3000)}` : ''}

              Generate prompts across these categories:
              1. DIRECT QUESTIONS - Simple, direct questions about the topic
              2. COMPARISON QUERIES - Questions comparing options or alternatives
              3. HOW-TO REQUESTS - Step-by-step guidance requests
              4. PROBLEM-SOLVING - Questions about solving specific problems
              5. VOICE SEARCH - Natural language voice queries
              6. CONVERSATIONAL - Casual, conversational questions
              7. TECHNICAL - More detailed, technical questions
              8. COMMERCIAL - Purchase or decision-related questions

              For each prompt, consider:
              - How people naturally speak to AI assistants
              - Voice search patterns
              - Conversational AI interactions
              - Mobile voice queries
              - Different AI system preferences
              
              If website context is provided, make prompts SPECIFIC to that website's services, products, or content.

              Format each suggestion as:
              PROMPT: [The actual prompt/question users might ask]
              CATEGORY: [Category from above]
              INTENT: [informational/transactional/navigational/commercial]
              AI_SYSTEM: [Which AI system this works best with]
              LIKELIHOOD: [1-100 score of how likely this prompt is]
              OPTIMIZATION: [How to optimize content for this prompt]

              Generate 20-25 diverse prompt suggestions that cover different angles and user needs.
              
              IMPORTANT: Make all prompts SPECIFIC to the topic "${topic}" - do not use generic placeholders.
              If website context is provided, ensure prompts are relevant to that specific business or website.`
            }]
          }],
          generationConfig: {
            temperature: 0.7,
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
      console.log('Using fallback prompt suggestions data');
      return generateFallbackPromptSuggestions(topic, industry, contentType, userIntent, websiteUrl);
    }

    console.log('Received response from Gemini API');
    const geminiData = await geminiResponse.json();
    const responseText = geminiData.candidates[0].content.parts[0].text;

    // Parse prompt suggestions
    const promptSuggestions: PromptSuggestion[] = [];
    const sections = responseText.split('PROMPT:').slice(1);

    for (const section of sections) {
      const lines = section.split('\n').map(line => line.trim()).filter(line => line);
      if (lines.length >= 5) {
        const prompt = lines[0];
        const categoryMatch = section.match(/CATEGORY:\s*(.*)/i);
        const intentMatch = section.match(/INTENT:\s*(.*)/i);
        const aiSystemMatch = section.match(/AI_SYSTEM:\s*(.*)/i);
        const likelihoodMatch = section.match(/LIKELIHOOD:\s*(\d+)/i);
        const optimizationMatch = section.match(/OPTIMIZATION:\s*(.*)/i);

        if (prompt && categoryMatch && intentMatch) {
          promptSuggestions.push({
            prompt: prompt.trim(),
            category: categoryMatch[1].trim(),
            intent: intentMatch[1].trim(),
            aiSystem: aiSystemMatch ? aiSystemMatch[1].trim() : 'General',
            likelihood: likelihoodMatch ? parseInt(likelihoodMatch[1]) : 50,
            optimization: optimizationMatch ? optimizationMatch[1].trim() : ''
          });
        }
      }
    }

    // Group prompts by category
    const promptsByCategory = promptSuggestions.reduce((acc, prompt) => {
      if (!acc[prompt.category]) {
        acc[prompt.category] = [];
      }
      acc[prompt.category].push(prompt);
      return acc;
    }, {} as Record<string, PromptSuggestion[]>);

    // Calculate statistics
    const avgLikelihood = promptSuggestions.length > 0 ? 
      Math.round(promptSuggestions.reduce((sum, p) => sum + p.likelihood, 0) / promptSuggestions.length) : 0;

    const intentDistribution = promptSuggestions.reduce((acc, prompt) => {
      acc[prompt.intent] = (acc[prompt.intent] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const aiSystemDistribution = promptSuggestions.reduce((acc, prompt) => {
      acc[prompt.aiSystem] = (acc[prompt.aiSystem] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log(`Generated ${promptSuggestions.length} prompt suggestions across ${Object.keys(promptsByCategory).length} categories`);
    return new Response(
      JSON.stringify({
        topic,
        industry,
        targetAudience,
        contentType,
        userIntent,
        websiteUrl,
        totalPrompts: promptSuggestions.length,
        averageLikelihood: avgLikelihood,
        promptSuggestions,
        promptsByCategory,
        statistics: {
          intentDistribution,
          aiSystemDistribution,
          categoryCount: Object.keys(promptsByCategory).length,
          highLikelihoodPrompts: promptSuggestions.filter(p => p.likelihood >= 80).length
        },
        optimizationRecommendations: [
          'Create content that directly answers these common prompts',
          'Use natural language that matches how people ask AI systems',
          'Structure content for easy AI extraction and citation',
          'Include conversational elements for voice search optimization',
          'Optimize for featured snippets and quick answers'
        ],
        generatedAt: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Prompt match suggestions error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate prompt match suggestions',
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Fallback function to generate sample prompt suggestions when API fails
function generateFallbackPromptSuggestions(
  topic: string, 
  industry?: string, 
  contentType: string = 'article',
  userIntent: string = 'informational',
  websiteUrl?: string
): Response {
  console.log(`Generating fallback prompt suggestions for ${topic}`);
  
  // Make sure we have a valid topic
  const validTopic = topic && topic.trim().length > 0 ? topic : 'AI visibility';
  
  // Extract domain name if website URL is provided
  let domainName = '';
  let brandName = '';
  
  if (websiteUrl) {
    try {
      const url = new URL(websiteUrl);
      domainName = url.hostname;
      brandName = domainName.split('.')[0].charAt(0).toUpperCase() + domainName.split('.')[0].slice(1);
    } catch (error) {
      console.error('Error parsing website URL:', error);
    }
  }
  
  // Use brand name in prompts if available
  const contextualizedTopic = brandName ? `${brandName}'s ${validTopic}` : validTopic;
  
  const promptSuggestions: PromptSuggestion[] = [
    {
      prompt: `What is ${contextualizedTopic}?`,
      category: 'DIRECT QUESTIONS',
      intent: 'informational',
      aiSystem: 'General',
      likelihood: 95,
      optimization: 'Include a clear definition section with comprehensive explanation'
    },
    {
      prompt: `How does ${contextualizedTopic} work?`,
      category: 'DIRECT QUESTIONS',
      intent: 'informational',
      aiSystem: 'ChatGPT',
      likelihood: 90,
      optimization: 'Provide a step-by-step explanation with visual aids if possible'
    },
    {
      prompt: `What are the benefits of ${contextualizedTopic}?`,
      category: 'DIRECT QUESTIONS',
      intent: 'informational',
      aiSystem: 'General',
      likelihood: 88,
      optimization: 'List clear benefits with supporting evidence or examples'
    },
    {
      prompt: `${contextualizedTopic} vs traditional approaches`,
      category: 'COMPARISON QUERIES',
      intent: 'informational',
      aiSystem: 'Claude',
      likelihood: 85,
      optimization: 'Create a comparison table with clear advantages and disadvantages'
    },
    {
      prompt: `What's better, ${contextualizedTopic} or alternative solutions?`,
      category: 'COMPARISON QUERIES',
      intent: 'commercial',
      aiSystem: 'ChatGPT',
      likelihood: 82,
      optimization: 'Provide balanced comparison with specific use cases for each option'
    },
    {
      prompt: `How to implement ${contextualizedTopic} for best results`,
      category: 'HOW-TO REQUESTS',
      intent: 'informational',
      aiSystem: 'General',
      likelihood: 87,
      optimization: 'Create a numbered list with clear implementation steps'
    },
    {
      prompt: `Step by step guide to ${contextualizedTopic}`,
      category: 'HOW-TO REQUESTS',
      intent: 'informational',
      aiSystem: 'Google',
      likelihood: 84,
      optimization: 'Structure content as a clear tutorial with headings for each step'
    },
    {
      prompt: `Common problems with ${contextualizedTopic} and how to solve them`,
      category: 'PROBLEM-SOLVING',
      intent: 'informational',
      aiSystem: 'Claude',
      likelihood: 80,
      optimization: 'Create a troubleshooting section with problem-solution format'
    },
    {
      prompt: `Why isn't my ${contextualizedTopic} working?`,
      category: 'PROBLEM-SOLVING',
      intent: 'informational',
      aiSystem: 'General',
      likelihood: 78,
      optimization: 'Include a FAQ section addressing common issues and solutions'
    },
    {
      prompt: `Hey Siri, tell me about ${contextualizedTopic}`,
      category: 'VOICE SEARCH',
      intent: 'informational',
      aiSystem: 'Siri',
      likelihood: 83,
      optimization: 'Create concise, conversational content optimized for voice responses'
    },
    {
      prompt: `Alexa, what should I know about ${contextualizedTopic}?`,
      category: 'VOICE SEARCH',
      intent: 'informational',
      aiSystem: 'Alexa',
      likelihood: 79,
      optimization: 'Structure content to answer direct questions in 1-2 sentences'
    },
    {
      prompt: `Can you explain ${contextualizedTopic} in simple terms?`,
      category: 'CONVERSATIONAL',
      intent: 'informational',
      aiSystem: 'General',
      likelihood: 86,
      optimization: 'Include a simplified explanation section using analogies'
    },
    {
      prompt: `I'm new to ${contextualizedTopic}, where should I start?`,
      category: 'CONVERSATIONAL',
      intent: 'informational',
      aiSystem: 'ChatGPT',
      likelihood: 81,
      optimization: 'Create a beginner\'s guide section with clear starting points'
    },
    {
      prompt: `Technical specifications for ${contextualizedTopic} implementation`,
      category: 'TECHNICAL',
      intent: 'informational',
      aiSystem: 'Claude',
      likelihood: 75,
      optimization: 'Include detailed technical documentation with code examples if applicable'
    },
    {
      prompt: `Advanced ${contextualizedTopic} strategies for professionals`,
      category: 'TECHNICAL',
      intent: 'informational',
      aiSystem: 'ChatGPT',
      likelihood: 72,
      optimization: 'Provide in-depth technical content with industry-specific terminology'
    },
    {
      prompt: `Best ${contextualizedTopic} tools to buy`,
      category: 'COMMERCIAL',
      intent: 'commercial',
      aiSystem: 'General',
      likelihood: 77,
      optimization: 'Include product comparisons with clear features and benefits'
    },
    {
      prompt: `Is ${contextualizedTopic} worth the investment?`,
      category: 'COMMERCIAL',
      intent: 'commercial',
      aiSystem: 'Claude',
      likelihood: 74,
      optimization: 'Provide ROI analysis and case studies demonstrating value'
    }
  ];
  
  // Add website-specific prompts if website URL is provided
  if (brandName) {
    promptSuggestions.push(
      {
        prompt: `How does ${brandName} approach ${validTopic}?`,
        category: 'DIRECT QUESTIONS',
        intent: 'informational',
        aiSystem: 'General',
        likelihood: 92,
        optimization: 'Include a clear explanation of your company\'s unique approach'
      },
      {
        prompt: `What makes ${brandName}'s ${validTopic} services different?`,
        category: 'COMPARISON QUERIES',
        intent: 'commercial',
        aiSystem: 'ChatGPT',
        likelihood: 89,
        optimization: 'Highlight your unique selling propositions and differentiators'
      },
      {
        prompt: `How much does ${brandName} charge for ${validTopic} services?`,
        category: 'COMMERCIAL',
        intent: 'commercial',
        aiSystem: 'General',
        likelihood: 86,
        optimization: 'Include transparent pricing information or pricing factors'
      },
      {
        prompt: `Is ${brandName} good for ${validTopic}?`,
        category: 'CONVERSATIONAL',
        intent: 'commercial',
        aiSystem: 'Claude',
        likelihood: 84,
        optimization: 'Include testimonials and evidence of your expertise'
      }
    );
  }
  
  // Group prompts by category
  const promptsByCategory = promptSuggestions.reduce((acc, prompt) => {
    if (!acc[prompt.category]) {
      acc[prompt.category] = [];
    }
    acc[prompt.category].push(prompt);
    return acc;
  }, {} as Record<string, PromptSuggestion[]>);

  // Calculate statistics
  const avgLikelihood = promptSuggestions.length > 0 ? 
    Math.round(promptSuggestions.reduce((sum, p) => sum + p.likelihood, 0) / promptSuggestions.length) : 0;

  const intentDistribution = promptSuggestions.reduce((acc, prompt) => {
    acc[prompt.intent] = (acc[prompt.intent] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const aiSystemDistribution = promptSuggestions.reduce((acc, prompt) => {
    acc[prompt.aiSystem] = (acc[prompt.aiSystem] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  return new Response(
    JSON.stringify({
      topic: validTopic,
      industry,
      targetAudience: 'General audience',
      contentType,
      userIntent,
      websiteUrl,
      totalPrompts: promptSuggestions.length,
      averageLikelihood: avgLikelihood,
      promptSuggestions,
      promptsByCategory,
      statistics: {
        intentDistribution,
        aiSystemDistribution,
        categoryCount: Object.keys(promptsByCategory).length,
        highLikelihoodPrompts: promptSuggestions.filter(p => p.likelihood >= 80).length
      },
      optimizationRecommendations: [
        'Create content that directly answers these common prompts',
        'Use natural language that matches how people ask AI systems',
        'Structure content for easy AI extraction and citation',
        'Include conversational elements for voice search optimization',
        'Optimize for featured snippets and quick answers'
      ],
      generatedAt: new Date().toISOString(),
      note: 'This is fallback prompt suggestion data as the API request failed'
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}