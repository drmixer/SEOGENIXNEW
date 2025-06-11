import { corsHeaders } from '../_shared/cors.ts';

interface EnhancedAuditRequest {
  url: string;
  content: string;
  previousScore?: number;
}

interface SentenceAnalysis {
  sentence: string;
  issues: string[];
  suggestions: string[];
  aiConfusionScore: number;
  position: { start: number; end: number };
}

interface ScoreExplanation {
  component: string;
  score: number;
  reasoning: string;
  specificIssues: string[];
  improvementActions: string[];
  examples: string[];
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { url, content, previousScore }: EnhancedAuditRequest = await req.json();

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: 'Gemini API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Analyze content at sentence level
    const sentenceAnalysisResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Perform granular sentence-level analysis of this content for AI visibility issues.

              Content: ${content.substring(0, 4000)}

              For each problematic sentence, identify:
              1. Specific AI comprehension issues
              2. Ambiguous references or unclear context
              3. Complex sentence structures that confuse AI
              4. Missing entity definitions
              5. Unclear relationships between concepts

              Format each analysis as:
              SENTENCE: [exact sentence text]
              ISSUES: [issue1] | [issue2] | [issue3]
              SUGGESTIONS: [suggestion1] | [suggestion2]
              CONFUSION_SCORE: [1-100 how confusing this is to AI]
              POSITION: [character start]-[character end]

              Focus on sentences that would be difficult for AI systems to parse, understand, or cite accurately.`
            }]
          }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1024,
          }
        })
      }
    );

    // Get detailed score explanations
    const scoreExplanationResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Provide detailed explanations for each AI visibility score component.

              Content: ${content.substring(0, 4000)}
              ${previousScore ? `Previous Score: ${previousScore}` : ''}

              For each component, explain:
              1. WHY the score is what it is
              2. SPECIFIC issues found in the content
              3. EXACT actions to improve the score
              4. EXAMPLES of better alternatives

              Components to analyze:
              - AI Understanding (how well AI comprehends the content)
              - Citation Likelihood (how likely AI is to cite this content)
              - Conversational Readiness (how well it answers voice queries)
              - Content Structure (technical organization and markup)

              Format as:
              COMPONENT: [component name]
              SCORE: [0-100]
              REASONING: [detailed explanation of why this score]
              ISSUES: [specific issue1] | [specific issue2] | [specific issue3]
              ACTIONS: [action1] | [action2] | [action3]
              EXAMPLES: [example1] | [example2]`
            }]
          }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1536,
          }
        })
      }
    );

    if (!sentenceAnalysisResponse.ok || !scoreExplanationResponse.ok) {
      throw new Error('Failed to get enhanced analysis');
    }

    const sentenceData = await sentenceAnalysisResponse.json();
    const scoreData = await scoreExplanationResponse.json();

    const sentenceAnalysisText = sentenceData.candidates[0].content.parts[0].text;
    const scoreExplanationText = scoreData.candidates[0].content.parts[0].text;

    // Parse sentence analysis
    const sentenceAnalyses: SentenceAnalysis[] = [];
    const sentenceSections = sentenceAnalysisText.split('SENTENCE:').slice(1);

    for (const section of sentenceSections) {
      const sentenceMatch = section.match(/^([^\n]+)/);
      const issuesMatch = section.match(/ISSUES:\s*(.*)/i);
      const suggestionsMatch = section.match(/SUGGESTIONS:\s*(.*)/i);
      const confusionMatch = section.match(/CONFUSION_SCORE:\s*(\d+)/i);
      const positionMatch = section.match(/POSITION:\s*(\d+)-(\d+)/i);

      if (sentenceMatch && issuesMatch && suggestionsMatch) {
        sentenceAnalyses.push({
          sentence: sentenceMatch[1].trim(),
          issues: issuesMatch[1].split('|').map(i => i.trim()),
          suggestions: suggestionsMatch[1].split('|').map(s => s.trim()),
          aiConfusionScore: confusionMatch ? parseInt(confusionMatch[1]) : 50,
          position: positionMatch ? 
            { start: parseInt(positionMatch[1]), end: parseInt(positionMatch[2]) } :
            { start: 0, end: 0 }
        });
      }
    }

    // Parse score explanations
    const scoreExplanations: ScoreExplanation[] = [];
    const scoreSections = scoreExplanationText.split('COMPONENT:').slice(1);

    for (const section of scoreSections) {
      const componentMatch = section.match(/^([^\n]+)/);
      const scoreMatch = section.match(/SCORE:\s*(\d+)/i);
      const reasoningMatch = section.match(/REASONING:\s*(.*?)(?=ISSUES:|$)/is);
      const issuesMatch = section.match(/ISSUES:\s*(.*?)(?=ACTIONS:|$)/is);
      const actionsMatch = section.match(/ACTIONS:\s*(.*?)(?=EXAMPLES:|$)/is);
      const examplesMatch = section.match(/EXAMPLES:\s*(.*?)(?=COMPONENT:|$)/is);

      if (componentMatch && scoreMatch && reasoningMatch) {
        scoreExplanations.push({
          component: componentMatch[1].trim(),
          score: parseInt(scoreMatch[1]),
          reasoning: reasoningMatch[1].trim(),
          specificIssues: issuesMatch ? issuesMatch[1].split('|').map(i => i.trim()) : [],
          improvementActions: actionsMatch ? actionsMatch[1].split('|').map(a => a.trim()) : [],
          examples: examplesMatch ? examplesMatch[1].split('|').map(e => e.trim()) : []
        });
      }
    }

    return new Response(
      JSON.stringify({
        url,
        enhancedInsights: {
          sentenceAnalyses: sentenceAnalyses.slice(0, 10), // Limit to top 10 problematic sentences
          scoreExplanations,
          overallAssessment: {
            totalProblematicSentences: sentenceAnalyses.length,
            averageConfusionScore: sentenceAnalyses.length > 0 ? 
              Math.round(sentenceAnalyses.reduce((sum, s) => sum + s.aiConfusionScore, 0) / sentenceAnalyses.length) : 0,
            primaryIssueCategories: [
              ...new Set(sentenceAnalyses.flatMap(s => s.issues))
            ].slice(0, 5),
            improvementPriority: sentenceAnalyses
              .sort((a, b) => b.aiConfusionScore - a.aiConfusionScore)
              .slice(0, 3)
              .map(s => ({ sentence: s.sentence.substring(0, 100) + '...', priority: s.aiConfusionScore }))
          }
        },
        analyzedAt: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Enhanced audit insights error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate enhanced audit insights',
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});