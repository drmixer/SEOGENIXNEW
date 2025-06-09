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

    const results: VoiceTestResult[] = [];

    // Simulate voice assistant responses using Gemini API
    for (const assistant of assistants) {
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${Deno.env.get('GEMINI_API_KEY')}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Simulate how ${assistant.toUpperCase()} would respond to this voice query: "${query}"
                
                Consider ${assistant}'s typical response style:
                - Siri: Concise, conversational, often cites sources
                - Alexa: Helpful, detailed, skill-based responses
                - Google: Comprehensive, search-based, factual
                
                Provide a realistic response that this assistant would give.`
              }]
            }],
            generationConfig: {
              temperature: 0.6,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 512,
            }
          })
        }
      );

      const geminiData = await geminiResponse.json();
      const response = geminiData.candidates[0].content.parts[0].text;

      // Simulate analysis of whether content was mentioned
      const mentioned = Math.random() > 0.6; // 40% chance of being mentioned
      const ranking = mentioned ? Math.floor(Math.random() * 3) + 1 : 0; // 1-3 if mentioned
      const confidence = Math.floor(Math.random() * 40) + 60; // 60-100%

      results.push({
        assistant: assistant.charAt(0).toUpperCase() + assistant.slice(1),
        query,
        response,
        mentioned,
        ranking,
        confidence
      });
    }

    return new Response(
      JSON.stringify({
        query,
        results,
        summary: {
          totalMentions: results.filter(r => r.mentioned).length,
          averageRanking: results.filter(r => r.mentioned).reduce((acc, r) => acc + r.ranking, 0) / results.filter(r => r.mentioned).length || 0,
          averageConfidence: results.reduce((acc, r) => acc + r.confidence, 0) / results.length
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Voice assistant testing error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to test voice assistants' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});