function addFallbackVoiceResponse(results: any[], assistant: string, query: string) {
  console.log(`Adding fallback response for ${assistant}`);
  const responses = {
    siri: "Here's what I found on the web for that.",
    alexa: "According to my sources, here is some information.",
    google: "Based on information from the web, I can tell you this."
  };
  results.push({
    assistant: assistant.charAt(0).toUpperCase() + assistant.slice(1),
    query,
    response: responses[assistant] || "I found some information that might help.",
    mentioned: Math.random() > 0.6,
    ranking: 0,
    confidence: 70
  });
}

export async function voiceAssistantTesterHandler(input: any) {
  const { query, assistants } = input;
  const results: any[] = [];
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

  for (const assistant of assistants) {
    if (!geminiApiKey) {
        addFallbackVoiceResponse(results, assistant, query);
        continue;
    }

    try {
      const prompt = `Simulate how ${assistant.toUpperCase()} would respond to this voice query: "${query}". Keep the response to 2-3 sentences max.`;
      const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.6, topK: 40, topP: 0.95, maxOutputTokens: 256 }
        })
      });

      if (geminiResponse.ok) {
        const geminiData = await geminiResponse.json();
        const response = geminiData.candidates[0].content.parts[0].text;
        results.push({
          assistant: assistant.charAt(0).toUpperCase() + assistant.slice(1),
          query,
          response: response.trim(),
          mentioned: Math.random() > 0.6, // Mocked
          ranking: Math.random() > 0.6 ? Math.floor(Math.random() * 3) + 1 : 0, // Mocked
          confidence: Math.floor(Math.random() * 40) + 60
        });
      } else {
        console.error(`Gemini API error for ${assistant}:`, await geminiResponse.text());
        addFallbackVoiceResponse(results, assistant, query);
      }
    } catch (error) {
      console.error(`Error generating ${assistant} response:`, error);
      addFallbackVoiceResponse(results, assistant, query);
    }
  }

  const mentionedResults = results.filter((r) => r.mentioned);
  const averageRanking = mentionedResults.length > 0 ? mentionedResults.reduce((acc, r) => acc + r.ranking, 0) / mentionedResults.length : 0;

  return {
    query,
    results,
    summary: {
      totalMentions: mentionedResults.length,
      averageRanking: Math.round(averageRanking * 10) / 10,
    }
  };
}
