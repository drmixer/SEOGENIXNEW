function generateFallbackEntityAnalysis(url: string, industry: string) {
  console.log(`Generating fallback entity analysis for ${url}`);
  const brandName = new URL(url).hostname.split('.')[0];
  const mentionedEntities = [{ name: brandName, type: 'organization', relevance: 100, mentioned: true, importance: 'high', description: 'The main organization' }];
  const missingEntities = [{ name: 'Artificial Intelligence', type: 'concept', relevance: 90, mentioned: false, importance: 'high', description: 'Core technology concept' }];
  const allEntities = [...mentionedEntities, ...missingEntities];
  const coverageScore = Math.round(mentionedEntities.length / allEntities.length * 100);
  return {
    url,
    industry,
    coverageScore,
    totalEntities: allEntities.length,
    mentionedCount: mentionedEntities.length,
    missingCount: missingEntities.length,
    mentionedEntities,
    missingEntities,
    recommendations: [`Add more information about ${missingEntities[0].name}`],
    priorityActions: [`Add a section about ${missingEntities[0].name}`],
    analyzedAt: new Date().toISOString(),
    note: 'This is fallback entity analysis data as the API request failed'
  };
}

export async function entityCoverageAnalyzerHandler(input: any) {
  const { url, content, industry, competitors = [] } = input;

  let pageContent = content;
  if (url && !content) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': 'SEOGENIX Entity Analyzer Bot 1.0' } });
      if (response.ok) {
        pageContent = await response.text();
      }
    } catch (error) {
      console.error('Failed to fetch URL:', error);
    }
  }

  const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
  if (!geminiApiKey) {
    console.error('Gemini API key not configured, using fallback.');
    return generateFallbackEntityAnalysis(url, industry);
  }

  const prompt = `Analyze the entity coverage for this website.
Website URL: ${url}
Industry: ${industry || 'Not specified'}
Content: ${pageContent?.substring(0, 4000) || 'No content provided'}
1. MENTIONED ENTITIES: List key entities mentioned.
2. MISSING ENTITIES: Identify important entities that are missing.
For each entity, provide: Name | Type | Relevance (1-100) | Importance (high/medium/low) | Description
Format your response as:
MENTIONED ENTITIES:
- [Entity Name] | [Type] | [Relevance] | [Importance] | [Description]
MISSING ENTITIES:
- [Entity Name] | [Type] | [Relevance] | [Importance] | [Description]`;

  const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, topK: 40, topP: 0.8, maxOutputTokens: 2048 }
    })
  });

  if (!geminiResponse.ok) {
    console.error('Gemini API error:', await geminiResponse.text());
    return generateFallbackEntityAnalysis(url, industry);
  }

  const geminiData = await geminiResponse.json();
  const responseText = geminiData.candidates[0].content.parts[0].text;

  const parseEntities = (section: string, mentioned: boolean) => {
    if (!section) return [];
    return section.split('\n').filter(line => line.trim().startsWith('-')).map(line => {
      const parts = line.substring(1).split('|').map(p => p.trim());
      if (parts.length >= 5) {
        return { name: parts[0], type: parts[1], relevance: parseInt(parts[2]) || 50, mentioned, importance: parts[3], description: parts[4] };
      }
      return null;
    }).filter(Boolean);
  };

  const mentionedSection = responseText.match(/MENTIONED ENTITIES:\s*([\s\S]*?)(?=MISSING ENTITIES:|$)/i)?.[1];
  const missingSection = responseText.match(/MISSING ENTITIES:\s*([\s\S]*?)$/i)?.[1];

  const mentionedEntities = parseEntities(mentionedSection, true);
  const missingEntities = parseEntities(missingSection, false);
  const allEntities = [...mentionedEntities, ...missingEntities];
  const coverageScore = allEntities.length > 0 ? Math.round(mentionedEntities.length / allEntities.length * 100) : 0;

  return {
    url,
    industry,
    coverageScore,
    totalEntities: allEntities.length,
    mentionedCount: mentionedEntities.length,
    missingCount: missingEntities.length,
    mentionedEntities,
    missingEntities,
    analyzedAt: new Date().toISOString()
  };
}
