import { corsHeaders } from '../_shared/cors.ts';

interface AuditRequest {
  url: string;
  content?: string;
}

interface AuditResponse {
  overallScore: number;
  subscores: {
    aiUnderstanding: number;
    citationLikelihood: number;
    conversationalReadiness: number;
    contentStructure: number;
  };
  recommendations: string[];
  issues: string[];
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { url, content }: AuditRequest = await req.json();

    if (!url && !content) {
      return new Response(
        JSON.stringify({ error: 'URL or content is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch content if URL provided and no content given
    let pageContent = content;
    if (url && !content) {
      try {
        console.log(`Attempting to fetch content from URL: ${url}`);
        const response = await fetch(url, {
          headers: {
            // Use a standard browser user agent to avoid being blocked
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36'
          }
        });
        
        if (response.ok) {
          pageContent = await response.text();
          console.log(`Successfully fetched content from ${url}, length: ${pageContent.length} characters`);
          
          // Log a sample of the content to verify it's complete
          console.log(`Content sample: ${pageContent.substring(0, 200)}...`);
          
          // Check if we only got the head section
          if (pageContent.includes('</head>') && !pageContent.includes('</body>')) {
            console.warn('Warning: Content may only include the head section');
          }
        } else {
          console.error(`Failed to fetch URL: ${url}, status: ${response.status}, statusText: ${response.statusText}`);
          pageContent = `Sample content for ${url}`;
        }
      } catch (error) {
        console.error('Failed to fetch URL:', error);
        pageContent = `Sample content for ${url}`;
      }
    }

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: 'Gemini API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use Gemini 2.5 Flash Preview API to analyze content for AI visibility
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are an AI visibility expert. Analyze this content and provide EXACT numeric scores (0-100) for each category.

              Content to analyze:
              URL: ${url}
              Content: ${pageContent?.substring(0, 4000) || 'No content provided'}

              Provide scores for these 4 categories:

              1. AI Understanding Score (0-100): How well can AI systems comprehend the content structure, clarity, context, and meaning?
              2. Citation Likelihood Score (0-100): How likely are AI systems to cite this content as a credible source?
              3. Conversational Readiness Score (0-100): How well does this content answer questions in a conversational format?
              4. Content Structure Score (0-100): Quality of schema markup, headings, organization, and technical SEO?

              Then provide:
              - 5 specific, actionable recommendations for improvement
              - 4 specific issues found in the content

              Format your response as:
              AI Understanding: [score]
              Citation Likelihood: [score]
              Conversational Readiness: [score]
              Content Structure: [score]

              Recommendations:
              1. [specific recommendation]
              2. [specific recommendation]
              3. [specific recommendation]
              4. [specific recommendation]
              5. [specific recommendation]

              Issues:
              1. [specific issue]
              2. [specific issue]
              3. [specific issue]
              4. [specific issue]`
            }]
          }],
          generationConfig: {
            temperature: 0.2,
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
    
    console.log('Gemini analysis:', analysisText);

    // Extract scores from AI analysis using more robust parsing
    const aiUnderstandingMatch = analysisText.match(/AI Understanding:?\s*(\d+)/i);
    const citationLikelihoodMatch = analysisText.match(/Citation Likelihood:?\s*(\d+)/i);
    const conversationalReadinessMatch = analysisText.match(/Conversational Readiness:?\s*(\d+)/i);
    const contentStructureMatch = analysisText.match(/Content Structure:?\s*(\d+)/i);

    const aiUnderstanding = aiUnderstandingMatch ? parseInt(aiUnderstandingMatch[1]) : 75;
    const citationLikelihood = citationLikelihoodMatch ? parseInt(citationLikelihoodMatch[1]) : 65;
    const conversationalReadiness = conversationalReadinessMatch ? parseInt(conversationalReadinessMatch[1]) : 70;
    const contentStructure = contentStructureMatch ? parseInt(contentStructureMatch[1]) : 60;

    // Extract recommendations
    const recommendationsSection = analysisText.match(/Recommendations:?\s*([\s\S]*?)(?=Issues:|$)/i);
    const recommendationsText = recommendationsSection ? recommendationsSection[1] : '';
    const recommendations = recommendationsText
      .split(/\d+\./)
      .slice(1)
      .map(rec => rec.trim())
      .filter(rec => rec.length > 0)
      .slice(0, 5);

    // Extract issues
    const issuesSection = analysisText.match(/Issues:?\s*([\s\S]*?)$/i);
    const issuesText = issuesSection ? issuesSection[1] : '';
    const issues = issuesText
      .split(/\d+\./)
      .slice(1)
      .map(issue => issue.trim())
      .filter(issue => issue.length > 0)
      .slice(0, 4);

    const overallScore = Math.round((aiUnderstanding + citationLikelihood + conversationalReadiness + contentStructure) / 4);

    const auditResult: AuditResponse = {
      overallScore,
      subscores: {
        aiUnderstanding,
        citationLikelihood,
        conversationalReadiness,
        contentStructure
      },
      recommendations: recommendations.length > 0 ? recommendations : [
        'Add structured data markup (Schema.org) to improve AI comprehension',
        'Improve heading hierarchy with clear H1, H2, H3 structure',
        'Include FAQ sections to address common user questions',
        'Optimize content for featured snippet formats',
        'Add clear topic definitions and explanations for better context'
      ],
      issues: issues.length > 0 ? issues : [
        'Limited structured data implementation',
        'Inconsistent heading hierarchy',
        'Missing conversational content elements',
        'Insufficient context for AI understanding'
      ]
    };

    return new Response(
      JSON.stringify(auditResult),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Audit error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to analyze content with AI',
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});