import { corsHeaders } from '../_shared/cors.ts';

interface RealTimeAnalysisRequest {
  content: string;
  keywords: string[];
}

interface RealTimeSuggestion {
  type: 'grammar' | 'ai_clarity' | 'keyword' | 'structure' | 'entity';
  severity: 'error' | 'warning' | 'suggestion';
  message: string;
  suggestion: string;
  position: { start: number; end: number };
  replacement?: string;
}

interface ContentMetrics {
  aiReadabilityScore: number;
  keywordDensity: Record<string, number>;
  entityCoverage: number;
  structureScore: number;
  suggestions: RealTimeSuggestion[];
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { content, keywords }: RealTimeAnalysisRequest = await req.json();

    if (!content || content.length < 10) {
      return new Response(
        JSON.stringify({ error: 'Content too short for analysis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: 'Gemini API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Perform real-time content analysis for AI visibility optimization.

              Content: ${content}
              Target Keywords: ${keywords.join(', ')}

              Analyze the content and provide:

              1. AI READABILITY SCORE (0-100): How well AI systems can understand this content
              2. KEYWORD DENSITY: Calculate density for each target keyword
              3. ENTITY COVERAGE SCORE (0-100): How well the content covers relevant entities
              4. STRUCTURE SCORE (0-100): Quality of content organization for AI parsing
              5. REAL-TIME SUGGESTIONS: Specific improvements with exact positions

              For suggestions, identify:
              - Passive voice usage (suggest active voice)
              - Overly complex sentences (>25 words)
              - Missing question words for voice search
              - Keyword density issues (too high >3% or too low <0.5%)
              - Unclear entity references
              - Poor heading structure

              Format response as:
              AI_READABILITY: [score]
              ENTITY_COVERAGE: [score]
              STRUCTURE_SCORE: [score]

              KEYWORD_DENSITY:
              [keyword1]: [percentage]
              [keyword2]: [percentage]

              SUGGESTIONS:
              TYPE: [grammar/ai_clarity/keyword/structure/entity]
              SEVERITY: [error/warning/suggestion]
              MESSAGE: [brief description]
              SUGGESTION: [detailed improvement advice]
              POSITION: [start_char]-[end_char]
              REPLACEMENT: [optional replacement text]

              Provide 3-8 actionable suggestions with exact character positions where possible.`
            }]
          }],
          generationConfig: {
            temperature: 0.3,
            topK: 40,
            topP: 0.8,
            maxOutputTokens: 1024,
          }
        })
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', errorText);
      throw new Error(`Gemini API failed: ${geminiResponse.status}`);
    }

    const geminiData = await geminiResponse.json();
    const analysisText = geminiData.candidates[0].content.parts[0].text;

    // Parse the analysis
    const aiReadabilityMatch = analysisText.match(/AI_READABILITY:\s*(\d+)/i);
    const entityCoverageMatch = analysisText.match(/ENTITY_COVERAGE:\s*(\d+)/i);
    const structureScoreMatch = analysisText.match(/STRUCTURE_SCORE:\s*(\d+)/i);

    const aiReadabilityScore = aiReadabilityMatch ? parseInt(aiReadabilityMatch[1]) : 75;
    const entityCoverage = entityCoverageMatch ? parseInt(entityCoverageMatch[1]) : 70;
    const structureScore = structureScoreMatch ? parseInt(structureScoreMatch[1]) : 80;

    // Parse keyword density
    const keywordDensitySection = analysisText.match(/KEYWORD_DENSITY:\s*([\s\S]*?)(?=SUGGESTIONS:|$)/i);
    const keywordDensity: Record<string, number> = {};
    
    if (keywordDensitySection) {
      const densityLines = keywordDensitySection[1].split('\n').filter(line => line.includes(':'));
      densityLines.forEach(line => {
        const [keyword, percentage] = line.split(':').map(s => s.trim());
        if (keyword && percentage) {
          const numericValue = parseFloat(percentage.replace('%', ''));
          if (!isNaN(numericValue)) {
            keywordDensity[keyword] = numericValue;
          }
        }
      });
    }

    // Parse suggestions
    const suggestions: RealTimeSuggestion[] = [];
    const suggestionSections = analysisText.split('TYPE:').slice(1);

    for (const section of suggestionSections) {
      const typeMatch = section.match(/^([^\n]+)/);
      const severityMatch = section.match(/SEVERITY:\s*([^\n]+)/i);
      const messageMatch = section.match(/MESSAGE:\s*([^\n]+)/i);
      const suggestionMatch = section.match(/SUGGESTION:\s*([^\n]+)/i);
      const positionMatch = section.match(/POSITION:\s*(\d+)-(\d+)/i);
      const replacementMatch = section.match(/REPLACEMENT:\s*([^\n]+)/i);

      if (typeMatch && severityMatch && messageMatch && suggestionMatch) {
        suggestions.push({
          type: typeMatch[1].trim() as RealTimeSuggestion['type'],
          severity: severityMatch[1].trim() as RealTimeSuggestion['severity'],
          message: messageMatch[1].trim(),
          suggestion: suggestionMatch[1].trim(),
          position: positionMatch ? 
            { start: parseInt(positionMatch[1]), end: parseInt(positionMatch[2]) } :
            { start: 0, end: 0 },
          replacement: replacementMatch ? replacementMatch[1].trim() : undefined
        });
      }
    }

    // Add some basic suggestions if none were parsed
    if (suggestions.length === 0) {
      const words = content.split(/\s+/);
      const sentences = content.split(/[.!?]+/).filter(s => s.trim());
      
      // Check for long sentences
      sentences.forEach((sentence, index) => {
        if (sentence.split(/\s+/).length > 25) {
          const start = content.indexOf(sentence);
          suggestions.push({
            type: 'structure',
            severity: 'suggestion',
            message: 'Long sentence detected',
            suggestion: 'Consider breaking this sentence into shorter ones for better AI comprehension',
            position: { start, end: start + sentence.length }
          });
        }
      });

      // Check keyword density
      keywords.forEach(keyword => {
        const density = keywordDensity[keyword] || 0;
        if (density > 3) {
          suggestions.push({
            type: 'keyword',
            severity: 'warning',
            message: `Keyword "${keyword}" may be over-optimized`,
            suggestion: 'Reduce keyword density to avoid appearing spammy to AI systems',
            position: { start: 0, end: 0 }
          });
        } else if (density < 0.5) {
          suggestions.push({
            type: 'keyword',
            severity: 'suggestion',
            message: `Consider using "${keyword}" more frequently`,
            suggestion: 'Increase keyword presence for better topic relevance',
            position: { start: 0, end: 0 }
          });
        }
      });
    }

    const metrics: ContentMetrics = {
      aiReadabilityScore,
      keywordDensity,
      entityCoverage,
      structureScore,
      suggestions: suggestions.slice(0, 8) // Limit to 8 suggestions
    };

    return new Response(
      JSON.stringify(metrics),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Real-time content analysis error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to analyze content',
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});