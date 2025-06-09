import { corsHeaders } from '../_shared/cors.ts';

interface ChatRequest {
  message: string;
  context: 'landing' | 'dashboard';
  userPlan?: 'free' | 'core' | 'pro' | 'agency';
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { message, context, userPlan, conversationHistory = [] }: ChatRequest = await req.json();

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: 'Gemini API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build context for Genie
    let systemPrompt = '';
    
    if (context === 'landing') {
      systemPrompt = `You are Genie, the AI assistant for SEOGENIX - an AI-powered SEO platform. 
      You help potential customers understand:
      - SEOGENIX features and tools for AI visibility optimization
      - Pricing plans: Free (basic), Core ($29/mo), Pro ($79/mo), Agency ($199/mo)
      - AI visibility concepts and why they matter in 2025
      - How SEOGENIX differs from traditional SEO tools
      - The importance of optimizing for AI systems like ChatGPT, Claude, Gemini
      
      Be helpful, knowledgeable, and encourage users to try the platform. Keep responses concise but informative.`;
    } else {
      systemPrompt = `You are Genie, the AI assistant for SEOGENIX users. 
      User plan: ${userPlan}
      
      You help users:
      - Understand their AI visibility audit results and scores
      - Navigate and use platform tools effectively
      - Interpret recommendations and implement improvements
      - Optimize their content for AI visibility and citations
      - Understand competitive analysis and benchmarking
      
      ${userPlan === 'free' ? 'This user has limited access. Gently suggest upgrading for full features when relevant.' : ''}
      ${userPlan === 'core' ? 'This user has Core plan access. You can provide tool guidance and basic optimization advice.' : ''}
      ${['pro', 'agency'].includes(userPlan || '') ? 'This user has full access. Provide comprehensive support and proactive suggestions.' : ''}
      
      Be helpful, technical when needed, and focus on actionable advice. Keep responses conversational and concise.`;
    }

    // Prepare conversation for Gemini
    const conversationText = conversationHistory
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n') + `\nuser: ${message}`;

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `${systemPrompt}

              Conversation history:
              ${conversationText}
              
              Respond as Genie in a helpful, conversational tone. Keep responses concise but informative (2-3 sentences max unless more detail is specifically requested).`
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 512,
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
    const response = geminiData.candidates[0].content.parts[0].text;

    // Add proactive suggestions for Pro/Agency users
    let proactiveSuggestions = [];
    if (['pro', 'agency'].includes(userPlan || '') && context === 'dashboard') {
      proactiveSuggestions = [
        'Have you tried the Entity Coverage Analyzer for content gaps?',
        'Your Citation Tracker shows new mentions - want to review them?',
        'Consider running a competitive analysis to benchmark your progress.',
        'The AI Content Generator can help create optimized FAQ sections.',
        'Try the Prompt Match Suggestions tool for better voice search optimization.'
      ];
    }

    return new Response(
      JSON.stringify({
        response,
        proactiveSuggestions: Math.random() > 0.7 ? proactiveSuggestions.slice(0, 1) : [],
        context,
        userPlan
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Genie chatbot error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to process chat message',
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});