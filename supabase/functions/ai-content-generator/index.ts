import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Self-contained CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Helper function to log the start of a tool run
async function logToolRun({ projectId, toolName, inputPayload }) {
  const { data, error } = await supabase
    .from('tool_runs')
    .insert({
      project_id: projectId,
      tool_name: toolName,
      input_payload: inputPayload,
      status: 'running',
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error logging tool run:', error);
    return null;
  }
  return data.id;
}

// Helper function to update a tool run's status
async function updateToolRun({ runId, status, outputPayload, errorMessage }) {
  const update: {
    status: string;
    output_payload?: any;
    error_message?: string;
    completed_at: string;
  } = {
    status: status,
    completed_at: new Date().toISOString(),
  };

  if (outputPayload) {
    update.output_payload = outputPayload;
  }
  if (errorMessage) {
    update.error_message = errorMessage;
  }

  const { error } = await supabase
    .from('tool_runs')
    .update(update)
    .eq('id', runId);

  if (error) {
    console.error('Error updating tool run:', error);
  }
}

// Fallback function from the original gist
function generateFallbackContent(contentType, topic, targetKeywords, tone, websiteUrl) {
    console.log(`Generating fallback ${contentType} content for ${topic}`);
    const validTopic = topic && topic.trim().length > 0 ? topic : 'AI visibility';
    let parsedContent = { raw: '' };
    let domainName = '';
    let brandName = '';
    if (websiteUrl) {
        try {
            const url = new URL(websiteUrl);
            domainName = url.hostname;
            brandName = domainName.split('.')[0].charAt(0).toUpperCase() + domainName.split('.')[0].slice(1);
        } catch (error) {
            console.error('Error parsing website URL:', error);
        }
    }
    const contextualizedTopic = brandName ? `${brandName}'s ${validTopic}` : validTopic;
    switch(contentType){
        case 'faq':
            const faqs = [
                { question: `What is ${contextualizedTopic}?`, answer: `${contextualizedTopic} refers to the strategic approach to optimizing digital content for better visibility and performance in modern search environments. It encompasses various techniques and best practices designed to help businesses and individuals achieve their goals.` },
                { question: `Why is ${contextualizedTopic} important?`, answer: `${contextualizedTopic} is crucial because it directly impacts your ability to reach and engage your target audience effectively. In today's digital landscape, having a strong ${contextualizedTopic} strategy can significantly improve your visibility, credibility, and overall performance.` },
                { question: `How can I improve my ${contextualizedTopic} strategy?`, answer: `To enhance your ${contextualizedTopic} strategy, focus on creating high-quality, structured content that addresses user needs and questions directly. Implement proper technical optimizations, maintain consistency across platforms, and regularly analyze performance metrics to make data-driven improvements.` },
                { question: `What are the best tools for ${contextualizedTopic}?`, answer: `The best tools for ${contextualizedTopic} include comprehensive analytics platforms, content optimization software, technical audit tools, and competitive intelligence solutions. The ideal toolset depends on your specific goals, industry, and resources.` },
                { question: `How long does it take to see results from ${contextualizedTopic} efforts?`, answer: `Results from ${contextualizedTopic} efforts typically begin to appear within 2-4 weeks, with more significant improvements visible after 2-3 months of consistent implementation. However, this timeline can vary based on your starting point, industry competition, and the scope of your optimization efforts.` }
            ];
            parsedContent = { raw: faqs.map((faq) => `Q: ${faq.question}\nA: ${faq.answer}`).join('\n\n'), faqs };
            break;
        case 'meta-tags':
            parsedContent = {
                raw: `TITLE: Complete Guide to ${contextualizedTopic}: Strategies, Tips & Best Practices\nDESCRIPTION: Discover expert insights on ${contextualizedTopic} including ${targetKeywords.join(', ')}. Learn proven strategies to improve your results and stay ahead of the competition.\nKEYWORDS: ${contextualizedTopic}, ${targetKeywords.join(', ')}, guide, strategies, best practices\nOG_TITLE: Ultimate ${contextualizedTopic} Guide: Expert Strategies & Tips\nOG_DESCRIPTION: Comprehensive resource on ${contextualizedTopic} with actionable insights and proven techniques for better results.`,
                metaTags: {
                    title: `Complete Guide to ${contextualizedTopic}: Strategies, Tips & Best Practices`,
                    description: `Discover expert insights on ${contextualizedTopic} including ${targetKeywords.join(', ')}. Learn proven strategies to improve your results and stay ahead of the competition.`,
                    keywords: `${contextualizedTopic}, ${targetKeywords.join(', ')}, guide, strategies, best practices`,
                    ogTitle: `Ultimate ${contextualizedTopic} Guide: Expert Strategies & Tips`,
                    ogDescription: `Comprehensive resource on ${contextualizedTopic} with actionable insights and proven techniques for better results.`
                }
            };
            break;
    }
    return new Response(JSON.stringify({
        contentType,
        topic: validTopic,
        targetKeywords,
        tone,
        generatedContent: parsedContent,
        note: 'This is fallback content data as the API request failed'
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let runId;
  try {
    const { projectId, contentType, topic, targetKeywords, tone = 'professional', industry, targetAudience, contentLength = 'medium', websiteUrl } = await req.json();

    runId = await logToolRun({
      projectId: projectId,
      toolName: 'ai-content-generator',
      inputPayload: { contentType, topic, targetKeywords, tone, industry, targetAudience, contentLength, websiteUrl }
    });

    if (!topic || topic.trim().length === 0) {
      throw new Error('Topic is required');
    }

    let websiteContent = '';
    if (websiteUrl) {
      try {
        const response = await fetch(websiteUrl, { headers: { 'User-Agent': 'SEOGENIX Content Generator Bot 1.0' } });
        if (response.ok) {
          websiteContent = await response.text();
        }
      } catch (error) {
        console.error('Failed to fetch website:', error);
      }
    }

    const contentPrompts = {
      faq: `Generate a comprehensive FAQ section optimized for AI visibility and voice search. Create questions that people commonly ask about ${topic} and provide clear, concise answers that AI systems can easily understand and cite.`,
      'meta-tags': `Generate optimized meta tags (title, description, keywords) for a page about ${topic}. Ensure they are optimized for both traditional search engines and AI systems.`,
      snippets: `Create featured snippet-optimized content pieces about ${topic}. Format them to be easily extracted by AI systems and voice assistants.`,
      headings: `Generate a comprehensive heading structure (H1, H2, H3) for content about ${topic}. Ensure the headings are optimized for AI understanding and semantic structure.`,
      descriptions: `Create various types of descriptions (short, medium, long) about ${topic} that are optimized for AI comprehension and citation likelihood.`
    };
    const lengthGuidelines = {
      short: contentType === 'faq' ? '5-8 Q&As' : '50-100 words each',
      medium: contentType === 'faq' ? '8-12 Q&As' : '100-200 words each',
      long: contentType === 'faq' ? '12-20 Q&As' : '200-300 words each'
    };
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('Gemini API key not configured');
    }

    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${contentPrompts[contentType]}
Topic: ${topic}
Target Keywords: ${targetKeywords.join(', ')}
Tone: ${tone}
Industry: ${industry || 'General'}
Target Audience: ${targetAudience || 'General audience'}
Content Length: ${contentLength} (${lengthGuidelines[contentLength]})
${websiteContent ? `Website Context (use this to make content specific to this website):\n${websiteContent.substring(0, 3000)}` : ''}
` }] }],
        generationConfig: { temperature: 0.6, topK: 40, topP: 0.9, maxOutputTokens: 2048 }
      })
    });

    if (!geminiResponse.ok) {
        const errorText = await geminiResponse.text();
        console.error('Gemini API error:', errorText);
        return generateFallbackContent(contentType, topic, targetKeywords, tone, websiteUrl);
    }

    const geminiData = await geminiResponse.json();
    const generatedContent = geminiData.candidates[0].content.parts[0].text;

    let parsedContent = { raw: generatedContent };
    if (contentType === 'faq') {
        const qaPairs = [];
        const lines = generatedContent.split('\n');
        let currentQ = '';
        let currentA = '';
        for (const line of lines) {
            if (line.trim().startsWith('Q:')) {
                if (currentQ && currentA) qaPairs.push({ question: currentQ, answer: currentA.trim() });
                currentQ = line.substring(2).trim();
                currentA = '';
            } else if (line.trim().startsWith('A:')) {
                currentA = line.substring(2).trim();
            } else if (currentA && line.trim()) {
                currentA += ' ' + line.trim();
            }
        }
        if (currentQ && currentA) qaPairs.push({ question: currentQ, answer: currentA.trim() });
        parsedContent.faqs = qaPairs;
    } else if (contentType === 'meta-tags') {
        const titleMatch = generatedContent.match(/TITLE:\s*(.*)/i);
        const descMatch = generatedContent.match(/DESCRIPTION:\s*(.*)/i);
        const keywordsMatch = generatedContent.match(/KEYWORDS:\s*(.*)/i);
        parsedContent.metaTags = {
            title: titleMatch ? titleMatch[1].trim() : '',
            description: descMatch ? descMatch[1].trim() : '',
            keywords: keywordsMatch ? keywordsMatch[1].trim() : '',
        };
    }

    const output = {
        contentType,
        topic,
        generatedContent: parsedContent,
        wordCount: generatedContent.split(' ').length
    };

    await updateToolRun({
      runId,
      status: 'completed',
      outputPayload: output
    });

    return new Response(JSON.stringify({ runId, output }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error(err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';

    if (runId) {
      await updateToolRun({
        runId,
        status: 'error',
        errorMessage: errorMessage,
      });
    }

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
