import { corsHeaders } from '../_shared/cors.ts';

interface PromptMatchRequest {
  topic: string;
  industry?: string;
  targetAudience?: string;
  contentType?: 'article' | 'product' | 'service' | 'faq' | 'guide';
  userIntent?: 'informational' | 'transactional' | 'navigational' | 'commercial';
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
      userIntent = 'informational'
    }: PromptMatchRequest = await req.json();

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: 'Gemini API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Generate comprehensive prompt suggestions that users might ask AI systems (ChatGPT, Claude, Bard, voice assistants) related to this topic. These prompts should align with how people naturally ask questions to AI.

              Topic: ${topic}
              Industry: ${industry || 'General'}
              Target Audience: ${targetAudience || 'General audience'}
              Content Type: ${contentType}
              User Intent: ${userIntent}

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

              Format each suggestion as:
              PROMPT: [The actual prompt/question users might ask]
              CATEGORY: [Category from above]
              INTENT: [informational/transactional/navigational/commercial]
              AI_SYSTEM: [Which AI system this works best with]
              LIKELIHOOD: [1-100 score of how likely this prompt is]
              OPTIMIZATION: [How to optimize content for this prompt]

              Generate 20-25 diverse prompt suggestions that cover different angles and user needs.`
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
      throw new Error(`Gemini API failed: ${geminiResponse.status}`);
    }

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

    return new Response(
      JSON.stringify({
        topic,
        industry,
        targetAudience,
        contentType,
        userIntent,
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