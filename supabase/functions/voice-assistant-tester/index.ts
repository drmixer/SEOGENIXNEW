import { corsHeaders } from '../_shared/cors.ts';

interface VoiceTestRequest {
  query: string;
  assistants: ('siri' | 'alexa' | 'google')[];
}

interface VoiceTestResult {
  assistant: string;
  query: string;
  response: string;
  mentioned: boolean;
  ranking: number;
  confidence: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { query, assistants }: VoiceTestRequest = await req.json();

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: 'Gemini API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: VoiceTestResult[] = [];

    // Simulate voice assistant responses using Gemini API
    for (const assistant of assistants) {
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Simulate how ${assistant.toUpperCase()} would respond to this voice query: "${query}"
                
                Consider ${assistant}'s typical response characteristics:
                - Siri: Concise, conversational, often cites sources, Apple ecosystem focused
                - Alexa: Helpful, detailed, skill-based responses, Amazon ecosystem
                - Google: Comprehensive, search-based, factual, Google ecosystem
                
                Provide a realistic response that this assistant would give to a user asking this question. Make it sound natural and authentic to how that assistant actually responds.
                
                Keep the response to 2-3 sentences maximum, as voice assistants typically give concise answers.`
              }]
            }],
            generationConfig: {
              temperature: 0.6,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 256,
            }
          })
        }
      );

      if (!geminiResponse.ok) {
        console.error(`Gemini API error for ${assistant}:`, await geminiResponse.text());
        continue;
      }

      const geminiData = await geminiResponse.json();
      const response = geminiData.candidates[0].content.parts[0].text;

      // Simulate analysis of whether content was mentioned
      // In a real implementation, this would analyze if the user's domain/content was cited
      const mentioned = Math.random() > 0.6; // 40% chance of being mentioned
      const ranking = mentioned ? Math.floor(Math.random() * 3) + 1 : 0; // 1-3 if mentioned
      const confidence = Math.floor(Math.random() * 40) + 60; // 60-100%

      results.push({
        assistant: assistant.charAt(0).toUpperCase() + assistant.slice(1),
        query,
        response: response.trim(),
        mentioned,
        ranking,
        confidence
      });
    }

    const mentionedResults = results.filter(r => r.mentioned);
    const averageRanking = mentionedResults.length > 0 
      ? mentionedResults.reduce((acc, r) => acc + r.ranking, 0) / mentionedResults.length 
      : 0;

    return new Response(
      JSON.stringify({
        query,
        results,
        summary: {
          totalMentions: mentionedResults.length,
          averageRanking: Math.round(averageRanking * 10) / 10,
          averageConfidence: Math.round((results.reduce((acc, r) => acc + r.confidence, 0) / results.length) * 10) / 10,
          assistantsTested: assistants.length
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Voice assistant testing error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to test voice assistants',
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});