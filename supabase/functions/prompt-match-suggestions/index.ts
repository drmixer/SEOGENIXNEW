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

    // Generate relevant prompt suggestions based on topic and industry
    const promptSuggestions: PromptSuggestion[] = [];
    
    // Direct Questions
    promptSuggestions.push(
      {
        prompt: `What is ${topic}?`,
        category: 'DIRECT QUESTIONS',
        intent: 'informational',
        aiSystem: 'General',
        likelihood: 95,
        optimization: 'Include a clear definition section with comprehensive explanation'
      },
      {
        prompt: `How does ${topic} work?`,
        category: 'DIRECT QUESTIONS',
        intent: 'informational',
        aiSystem: 'ChatGPT',
        likelihood: 90,
        optimization: 'Provide a step-by-step explanation with visual aids if possible'
      },
      {
        prompt: `What are the benefits of ${topic}?`,
        category: 'DIRECT QUESTIONS',
        intent: 'informational',
        aiSystem: 'General',
        likelihood: 88,
        optimization: 'List clear benefits with supporting evidence or examples'
      }
    );
    
    // Comparison Queries
    promptSuggestions.push(
      {
        prompt: `${topic} vs traditional approaches`,
        category: 'COMPARISON QUERIES',
        intent: 'informational',
        aiSystem: 'Claude',
        likelihood: 85,
        optimization: 'Create a comparison table with clear advantages and disadvantages'
      },
      {
        prompt: `What's better, ${topic} or alternative solutions?`,
        category: 'COMPARISON QUERIES',
        intent: 'commercial',
        aiSystem: 'ChatGPT',
        likelihood: 82,
        optimization: 'Provide balanced comparison with specific use cases for each option'
      }
    );
    
    // How-To Requests
    promptSuggestions.push(
      {
        prompt: `How to implement ${topic} for best results`,
        category: 'HOW-TO REQUESTS',
        intent: 'informational',
        aiSystem: 'General',
        likelihood: 87,
        optimization: 'Create a numbered list with clear implementation steps'
      },
      {
        prompt: `Step by step guide to ${topic}`,
        category: 'HOW-TO REQUESTS',
        intent: 'informational',
        aiSystem: 'Google',
        likelihood: 84,
        optimization: 'Structure content as a clear tutorial with headings for each step'
      }
    );
    
    // Problem-Solving
    promptSuggestions.push(
      {
        prompt: `Common problems with ${topic} and how to solve them`,
        category: 'PROBLEM-SOLVING',
        intent: 'informational',
        aiSystem: 'Claude',
        likelihood: 80,
        optimization: 'Create a troubleshooting section with problem-solution format'
      },
      {
        prompt: `Why isn't my ${topic} working?`,
        category: 'PROBLEM-SOLVING',
        intent: 'informational',
        aiSystem: 'General',
        likelihood: 78,
        optimization: 'Include a FAQ section addressing common issues and solutions'
      }
    );
    
    // Voice Search
    promptSuggestions.push(
      {
        prompt: `Hey Siri, tell me about ${topic}`,
        category: 'VOICE SEARCH',
        intent: 'informational',
        aiSystem: 'Siri',
        likelihood: 83,
        optimization: 'Create concise, conversational content optimized for voice responses'
      },
      {
        prompt: `Alexa, what should I know about ${topic}?`,
        category: 'VOICE SEARCH',
        intent: 'informational',
        aiSystem: 'Alexa',
        likelihood: 79,
        optimization: 'Structure content to answer direct questions in 1-2 sentences'
      }
    );
    
    // Conversational
    promptSuggestions.push(
      {
        prompt: `Can you explain ${topic} in simple terms?`,
        category: 'CONVERSATIONAL',
        intent: 'informational',
        aiSystem: 'General',
        likelihood: 86,
        optimization: 'Include a simplified explanation section using analogies'
      },
      {
        prompt: `I'm new to ${topic}, where should I start?`,
        category: 'CONVERSATIONAL',
        intent: 'informational',
        aiSystem: 'ChatGPT',
        likelihood: 81,
        optimization: 'Create a beginner\'s guide section with clear starting points'
      }
    );
    
    // Technical
    promptSuggestions.push(
      {
        prompt: `Technical specifications for ${topic} implementation`,
        category: 'TECHNICAL',
        intent: 'informational',
        aiSystem: 'Claude',
        likelihood: 75,
        optimization: 'Include detailed technical documentation with code examples if applicable'
      },
      {
        prompt: `Advanced ${topic} strategies for professionals`,
        category: 'TECHNICAL',
        intent: 'informational',
        aiSystem: 'ChatGPT',
        likelihood: 72,
        optimization: 'Provide in-depth technical content with industry-specific terminology'
      }
    );
    
    // Commercial
    promptSuggestions.push(
      {
        prompt: `Best ${topic} tools to buy`,
        category: 'COMMERCIAL',
        intent: 'commercial',
        aiSystem: 'General',
        likelihood: 77,
        optimization: 'Include product comparisons with clear features and benefits'
      },
      {
        prompt: `Is ${topic} worth the investment?`,
        category: 'COMMERCIAL',
        intent: 'commercial',
        aiSystem: 'Claude',
        likelihood: 74,
        optimization: 'Provide ROI analysis and case studies demonstrating value'
      }
    );
    
    // Add industry-specific prompts if industry is provided
    if (industry) {
      const normalizedIndustry = industry.toLowerCase();
      
      if (normalizedIndustry.includes('tech') || normalizedIndustry.includes('software')) {
        promptSuggestions.push(
          {
            prompt: `How does ${topic} integrate with existing tech stacks?`,
            category: 'TECHNICAL',
            intent: 'informational',
            aiSystem: 'ChatGPT',
            likelihood: 82,
            optimization: 'Include integration guides and API documentation'
          },
          {
            prompt: `${topic} for software development teams`,
            category: 'DIRECT QUESTIONS',
            intent: 'informational',
            aiSystem: 'General',
            likelihood: 79,
            optimization: 'Focus on developer-specific use cases and implementation details'
          }
        );
      } else if (normalizedIndustry.includes('ecommerce') || normalizedIndustry.includes('retail')) {
        promptSuggestions.push(
          {
            prompt: `How can ${topic} increase online sales?`,
            category: 'COMMERCIAL',
            intent: 'commercial',
            aiSystem: 'General',
            likelihood: 88,
            optimization: 'Include e-commerce case studies and conversion metrics'
          },
          {
            prompt: `${topic} for product pages optimization`,
            category: 'HOW-TO REQUESTS',
            intent: 'informational',
            aiSystem: 'ChatGPT',
            likelihood: 85,
            optimization: 'Provide specific guidance for product page implementation'
          }
        );
      } else if (normalizedIndustry.includes('market') || normalizedIndustry.includes('advertis')) {
        promptSuggestions.push(
          {
            prompt: `How to measure ${topic} ROI for marketing campaigns`,
            category: 'HOW-TO REQUESTS',
            intent: 'informational',
            aiSystem: 'Claude',
            likelihood: 86,
            optimization: 'Include marketing-specific metrics and measurement frameworks'
          },
          {
            prompt: `${topic} best practices for digital marketers`,
            category: 'DIRECT QUESTIONS',
            intent: 'informational',
            aiSystem: 'General',
            likelihood: 83,
            optimization: 'Focus on marketing use cases and implementation strategies'
          }
        );
      }
    }
    
    // Add website-specific prompts if website URL is provided
    if (websiteUrl) {
      try {
        const url = new URL(websiteUrl);
        const domain = url.hostname.replace('www.', '');
        const brandName = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
        
        promptSuggestions.push(
          {
            prompt: `How does ${brandName} approach ${topic}?`,
            category: 'DIRECT QUESTIONS',
            intent: 'informational',
            aiSystem: 'General',
            likelihood: 92,
            optimization: 'Include a clear explanation of your company\'s unique approach'
          },
          {
            prompt: `What makes ${brandName}'s ${topic} services different?`,
            category: 'COMPARISON QUERIES',
            intent: 'commercial',
            aiSystem: 'ChatGPT',
            likelihood: 89,
            optimization: 'Highlight your unique selling propositions and differentiators'
          },
          {
            prompt: `Is ${brandName} good for ${topic}?`,
            category: 'CONVERSATIONAL',
            intent: 'commercial',
            aiSystem: 'Claude',
            likelihood: 84,
            optimization: 'Include testimonials and evidence of your expertise'
          }
        );
      } catch (error) {
        console.error('Error parsing website URL:', error);
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