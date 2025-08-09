export async function enhancedAuditInsightsHandler(input: any) {
  const { url, content, previousScore } = input;

  const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
  if (!geminiApiKey) {
    throw new Error('Gemini API key not configured');
  }

  const sentenceAnalysisPrompt = `Perform granular sentence-level analysis of this content for AI visibility issues.
Content: ${content.substring(0, 4000)}
For each problematic sentence, identify:
1. Specific AI comprehension issues
2. Ambiguous references or unclear context
Format each analysis as:
SENTENCE: [exact sentence text]
ISSUES: [issue1] | [issue2]
CONFUSION_SCORE: [1-100]
POSITION: [start]-[end]`;

  const scoreExplanationPrompt = `Provide detailed explanations for each AI visibility score component.
Content: ${content.substring(0, 4000)}
${previousScore ? `Previous Score: ${previousScore}` : ''}
Components to analyze: AI Understanding, Citation Likelihood, Conversational Readiness, Content Structure.
Format as:
COMPONENT: [component name]
SCORE: [0-100]
REASONING: [detailed explanation]`;

  const [sentenceAnalysisResponse, scoreExplanationResponse] = await Promise.all([
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: sentenceAnalysisPrompt }] }] })
    }),
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: scoreExplanationPrompt }] }] })
    })
  ]);

  if (!sentenceAnalysisResponse.ok || !scoreExplanationResponse.ok) {
    throw new Error('Failed to get enhanced analysis from Gemini API');
  }

  const sentenceData = await sentenceAnalysisResponse.json();
  const scoreData = await scoreExplanationResponse.json();
  const sentenceAnalysisText = sentenceData.candidates[0].content.parts[0].text;
  const scoreExplanationText = scoreData.candidates[0].content.parts[0].text;

  const sentenceAnalyses: any[] = [];
  const sentenceSections = sentenceAnalysisText.split('SENTENCE:').slice(1);
  for (const section of sentenceSections) {
    sentenceAnalyses.push({
      sentence: section.match(/^([^\n]+)/)?.[1].trim(),
      issues: section.match(/ISSUES:\s*(.*)/i)?.[1].split('|').map(i => i.trim()),
      aiConfusionScore: parseInt(section.match(/CONFUSION_SCORE:\s*(\d+)/i)?.[1] || '50'),
    });
  }

  const scoreExplanations: any[] = [];
  const scoreSections = scoreExplanationText.split('COMPONENT:').slice(1);
  for (const section of scoreSections) {
    scoreExplanations.push({
      component: section.match(/^([^\n]+)/)?.[1].trim(),
      score: parseInt(section.match(/SCORE:\s*(\d+)/i)?.[1] || '0'),
      reasoning: section.match(/REASONING:\s*(.*)/is)?.[1].trim(),
    });
  }

  return {
    url,
    enhancedInsights: {
      sentenceAnalyses,
      scoreExplanations,
    },
    analyzedAt: new Date().toISOString()
  };
}
