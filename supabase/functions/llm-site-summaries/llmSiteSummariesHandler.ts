function generateFallbackSummary(url: string, summaryType: string) {
  const brandName = new URL(url).hostname.split('.')[0];
  let summary = `This is a fallback ${summaryType} summary for ${brandName}.`;
  let entities = [`${brandName}`];
  let topics = [`${summaryType} summary`];
  return {
    url,
    summaryType,
    summary,
    entities,
    topics,
    optimizationNotes: "Generated due to API failure.",
    wordCount: summary.split(' ').length,
    generatedAt: new Date().toISOString(),
    note: 'This is fallback summary data as the API request failed'
  };
}

export async function llmSiteSummariesHandler(input: any) {
  const { url, content, summaryType } = input;

  let pageContent = content;
  if (url && !content) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': 'SEOGENIX LLM Summary Bot 1.0' } });
      if (response.ok) {
        pageContent = await response.text();
      }
    } catch (error) {
      console.error('Failed to fetch URL:', error);
    }
  }

  const summaryPrompts = {
    overview: `Create a comprehensive overview summary of this website.`,
    technical: `Generate a technical summary of this website.`,
    business: `Create a business-focused summary of this website.`,
    audience: `Generate an audience-focused summary of this website.`
  };

  const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
  if (!geminiApiKey) {
    console.error('Gemini API key not configured, using fallback.');
    return generateFallbackSummary(url, summaryType);
  }

  const prompt = `${summaryPrompts[summaryType]}
Website URL: ${url}
Content: ${pageContent?.substring(0, 4000) || 'No content provided'}
Format the response as:
SUMMARY: [Your optimized summary here]
KEY ENTITIES: - [Entity 1] - [Entity 2]
MAIN TOPICS: - [Topic 1] - [Topic 2]`;

  const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, topK: 40, topP: 0.8, maxOutputTokens: 1024 }
    })
  });

  if (!geminiResponse.ok) {
    console.error('Gemini API error:', await geminiResponse.text());
    return generateFallbackSummary(url, summaryType);
  }

  const geminiData = await geminiResponse.json();
  const responseText = geminiData.candidates[0].content.parts[0].text;

  const summaryMatch = responseText.match(/SUMMARY:\s*([\s\S]*?)(?=KEY ENTITIES:|$)/i);
  const entitiesMatch = responseText.match(/KEY ENTITIES:\s*([\s\S]*?)(?=MAIN TOPICS:|$)/i);
  const topicsMatch = responseText.match(/MAIN TOPICS:\s*([\s\S]*?)$/i);

  const summary = summaryMatch ? summaryMatch[1].trim() : responseText;
  const entities = entitiesMatch ? entitiesMatch[1].split('-').slice(1).map(e => e.trim()) : [];
  const topics = topicsMatch ? topicsMatch[1].split('-').slice(1).map(t => t.trim()) : [];

  return {
    url,
    summaryType,
    summary,
    entities,
    topics,
    wordCount: summary.split(' ').length,
    generatedAt: new Date().toISOString()
  };
}
