import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

function generateFallbackResponse(message: string, context: string, userPlan: string, userData: any) {
  let response = "I'm sorry, I'm having trouble connecting right now. Please try again in a moment.";
  if (context === 'landing') {
    if (message.toLowerCase().includes('price')) {
      response = "SEOGENIX offers several plans to fit your needs, from a free plan to get started to agency-level plans for power users.";
    } else {
      response = "Welcome to SEOGENIX! We help you optimize your content for AI search. How can I help you today?";
    }
  }
  return { response, proactiveSuggestions: [], actionSuggestions: [], context, userPlan, personalized: !!userData, note: 'This is a fallback response' };
}

export async function genieChatbotHandler(
  supabase: SupabaseClient,
  req: Request,
  input: any
) {
  const { message, context, userPlan, conversationHistory = [], userData } = input;

  let enhancedUserData = userData;
  const authHeader = req.headers.get('Authorization');
  if (authHeader && context === 'dashboard') {
    try {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        const { data: profile } = await supabase.from('user_profiles').select('*').eq('user_id', user.id).single();
        const { data: auditHistory } = await supabase.from('audit_history').select('overall_score, recommendations').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1);
        enhancedUserData = {
          websites: profile?.websites || [],
          industry: profile?.industry,
          lastAuditScore: auditHistory?.[0]?.overall_score,
        };
      }
    } catch (error) {
      console.error('Error fetching user data for chatbot:', error);
    }
  }

  let systemPrompt = 'You are Genie, the AI assistant for SEOGENIX. Be helpful and concise.';
  if (context === 'landing') {
    systemPrompt = `You are Genie, the AI assistant for SEOGENIX. You help potential customers understand our features and pricing. Encourage them to sign up.`;
  } else if (context === 'dashboard') {
    let userContext = `User plan: ${userPlan}.`;
    if (enhancedUserData?.lastAuditScore) {
        userContext += ` Their last audit score was ${enhancedUserData.lastAuditScore}.`;
    }
    systemPrompt = `You are Genie, the AI assistant for SEOGENIX users. Help them use the platform and understand their data. ${userContext}`;
  }

  const conversationText = conversationHistory.map((msg: any) => `${msg.role}: ${msg.content}`).join('\n') + `\nuser: ${message}`;

  const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
  if (!geminiApiKey) {
    console.error('Gemini API key not configured, using fallback.');
    return generateFallbackResponse(message, context, userPlan, enhancedUserData);
  }

  const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${systemPrompt}\n\nConversation:\n${conversationText}` }] }],
      generationConfig: { temperature: 0.7, topK: 40, topP: 0.95, maxOutputTokens: 512 }
    })
  });

  if (!geminiResponse.ok) {
    console.error('Gemini API error:', await geminiResponse.text());
    return generateFallbackResponse(message, context, userPlan, enhancedUserData);
  }

  const geminiData = await geminiResponse.json();
  const response = geminiData.candidates[0].content.parts[0].text;

  return {
    response,
    proactiveSuggestions: [],
    actionSuggestions: [],
    context,
    userPlan,
    personalized: !!enhancedUserData
  };
}
