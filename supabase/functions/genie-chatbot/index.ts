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

    // Build context for Genie
    let systemPrompt = '';
    
    if (context === 'landing') {
      systemPrompt = `You are Genie, the AI assistant for SEOGENIX - an AI-powered SEO platform. 
      You help potential customers understand:
      - SEOGENIX features and tools
      - Pricing plans (Free, Core $29/mo, Pro $79/mo, Agency $199/mo)
      - AI visibility concepts
      - How SEOGENIX differs from traditional SEO tools
      
      Be helpful, knowledgeable, and encourage users to try the platform.`;
    } else {
      systemPrompt = `You are Genie, the AI assistant for SEOGENIX users. 
      User plan: ${userPlan}
      
      You help users:
      - Understand their AI visibility audit results
      - Navigate and use platform tools
      - Interpret scores and recommendations
      - Optimize their content for AI visibility
      
      ${userPlan === 'free' ? 'This user has limited access. Gently suggest upgrading for full features.' : ''}
      ${userPlan === 'core' ? 'This user has Core plan access. You can provide tool guidance.' : ''}
      ${['pro', 'agency'].includes(userPlan || '') ? 'This user has full access. Provide comprehensive support and proactive suggestions.' : ''}
      
      Be helpful, technical when needed, and focus on actionable advice.`;
    }

    // Prepare conversation for Gemini
    const conversationText = conversationHistory
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n') + `\nuser: ${message}`;

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${Deno.env.get('GEMINI_API_KEY')}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `${systemPrompt}

              Conversation:
              ${conversationText}
              
              Respond as Genie in a helpful, conversational tone. Keep responses concise but informative.`
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

    const geminiData = await geminiResponse.json();
    const response = geminiData.candidates[0].content.parts[0].text;

    // Add proactive suggestions for Pro/Agency users
    let proactiveSuggestions = [];
    if (['pro', 'agency'].includes(userPlan || '') && context === 'dashboard') {
      proactiveSuggestions = [
        'Have you tried the Entity Coverage Analyzer for content gaps?',
        'Your Citation Tracker shows new mentions - want to review them?',
        'Consider running a competitive analysis to benchmark your progress.'
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
      JSON.stringify({ error: 'Failed to process chat message' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});