function addBasicSuggestions(suggestions: any[], content: string, keywords: string[], keywordDensity: any) {
    if (content.split(/\s+/).length > 200) {
        suggestions.push({ type: 'structure', severity: 'suggestion', message: 'Content is long, consider adding more headings.' });
    }
}

function generateFallbackAnalysis(content: string, keywords: string[]) {
  const keywordDensity = {};
  keywords.forEach((keyword) => {
    const regex = new RegExp(keyword, 'gi');
    const matches = content.match(regex) || [];
    keywordDensity[keyword] = content.length > 0 ? (matches.length / content.split(/\s+/).length) * 100 : 0;
  });
  const suggestions: any[] = [];
  addBasicSuggestions(suggestions, content, keywords, keywordDensity);
  return {
    aiReadabilityScore: 75,
    keywordDensity,
    entityCoverage: 70,
    structureScore: 80,
    suggestions,
    note: 'This is fallback analysis data as the API request failed'
  };
}

export async function realTimeContentAnalysisHandler(input: any) {
  const { content, keywords } = input;
  if (!content || content.length < 10) {
    throw new Error('Content too short for analysis');
  }

  const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
  if (!geminiApiKey) {
    console.error('Gemini API key not configured, using fallback.');
    return generateFallbackAnalysis(content, keywords);
  }

  const prompt = `Perform real-time content analysis for AI visibility.
Content: ${content}
Target Keywords: ${keywords.join(', ')}
Analyze and provide:
1. AI READABILITY SCORE (0-100)
2. KEYWORD DENSITY: for each target keyword.
3. REAL-TIME SUGGESTIONS: 3-5 specific improvements.
Format response as:
AI_READABILITY: [score]
KEYWORD_DENSITY:
[keyword1]: [percentage]
SUGGESTIONS:
TYPE: [grammar/clarity/keyword] | SEVERITY: [error/warning/suggestion] | MESSAGE: [description] | SUGGESTION: [advice]`;

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
    return generateFallbackAnalysis(content, keywords);
  }

  const geminiData = await geminiResponse.json();
  const analysisText = geminiData.candidates[0].content.parts[0].text;

  const aiReadabilityScore = parseInt(analysisText.match(/AI_READABILITY:\s*(\d+)/i)?.[1] || '75');

  const keywordDensity = {};
  const densitySection = analysisText.match(/KEYWORD_DENSITY:\s*([\s\S]*?)(?=SUGGESTIONS:|$)/i)?.[1] || '';
  densitySection.split('\n').forEach(line => {
      const parts = line.split(':');
      if (parts.length === 2) {
          keywordDensity[parts[0].trim()] = parseFloat(parts[1].trim().replace('%',''));
      }
  });

  const suggestions: any[] = [];
  const suggestionsSection = analysisText.match(/SUGGESTIONS:\s*([\s\S]*)/i)?.[1] || '';
  suggestionsSection.split('TYPE:').slice(1).forEach(section => {
      const severityMatch = section.match(/SEVERITY:\s*([^|]+)/i);
      const messageMatch = section.match(/MESSAGE:\s*([^|]+)/i);
      suggestions.push({
          type: section.split('|')[0].trim(),
          severity: severityMatch ? severityMatch[1].trim() : 'suggestion',
          message: messageMatch ? messageMatch[1].trim() : 'Consider this improvement.'
      });
  });

  return {
    aiReadabilityScore,
    keywordDensity,
    suggestions
  };
}
