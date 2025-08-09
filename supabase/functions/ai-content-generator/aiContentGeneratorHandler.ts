// Fallback function to generate sample content when API fails
function generateFallbackContent(contentType: string, topic: string, targetKeywords: string[], tone: string, websiteUrl: string) {
  console.log(`Generating fallback ${contentType} content for ${topic}`);
  const validTopic = topic && topic.trim().length > 0 ? topic : 'AI visibility';
  let parsedContent: { raw: string, faqs?: any[], metaTags?: any } = { raw: '' };
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
        { question: `What is ${contextualizedTopic}?`, answer: `${contextualizedTopic} refers to the strategic approach to optimizing digital content for better visibility and performance in modern search environments.` },
        { question: `Why is ${contextualizedTopic} important?`, answer: `${contextualizedTopic} is crucial because it directly impacts your ability to reach and engage your target audience effectively.` },
      ];
      parsedContent = { raw: faqs.map((faq)=>`Q: ${faq.question}\nA: ${faq.answer}`).join('\n\n'), faqs };
      break;
    case 'meta-tags':
      parsedContent = {
        raw: `TITLE: Complete Guide to ${contextualizedTopic}\nDESCRIPTION: Discover expert insights on ${contextualizedTopic}.\nKEYWORDS: ${contextualizedTopic}, ${targetKeywords.join(', ')}`,
        metaTags: {
          title: `Complete Guide to ${contextualizedTopic}`,
          description: `Discover expert insights on ${contextualizedTopic}.`,
          keywords: `${contextualizedTopic}, ${targetKeywords.join(', ')}`,
        }
      };
      break;
    default:
        parsedContent.raw = `This is fallback content for ${contentType} about ${contextualizedTopic}.`;
  }
  return {
    contentType,
    topic: validTopic,
    targetKeywords,
    tone,
    contentLength: 'medium',
    websiteUrl,
    generatedContent: parsedContent,
    wordCount: parsedContent.raw.split(' ').length,
    generatedAt: new Date().toISOString(),
    note: 'This is fallback content data as the API request failed'
  };
}


export async function aiContentGeneratorHandler(input: any) {
    const { contentType, topic, targetKeywords, tone = 'professional', industry: industry1, targetAudience: targetAudience1, contentLength = 'medium', websiteUrl } = input;

    if (!topic || topic.trim().length === 0) {
      throw new Error('Topic is required');
    }

    let websiteContent = '';
    if (websiteUrl) {
      try {
        const response = await fetch(websiteUrl, { headers: { 'User-Agent': 'SEOGENIX Content Generator Bot 1.0' } });
        if (response.ok) {
          websiteContent = await response.text();
        } else {
          console.error(`Failed to fetch website: ${response.status}`);
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
      console.error('Gemini API key not configured, using fallback.');
      return generateFallbackContent(contentType, topic, targetKeywords, tone, websiteUrl);
    }

    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${contentPrompts[contentType]}
Topic: ${topic}
Target Keywords: ${targetKeywords.join(', ')}
Tone: ${tone}
Industry: ${industry1 || 'General'}
Target Audience: ${targetAudience1 || 'General audience'}
Content Length: ${contentLength} (${lengthGuidelines[contentLength]})
${websiteContent ? `Website Context (use this to make content specific to this website):\n${websiteContent.substring(0, 3000)}` : ''}
` }] }],
        generationConfig: { temperature: 0.6, topK: 40, topP: 0.9, maxOutputTokens: 2048 }
      })
    });

    if (!geminiResponse.ok) {
      console.error('Gemini API error:', await geminiResponse.text());
      return generateFallbackContent(contentType, topic, targetKeywords, tone, websiteUrl);
    }

    const geminiData = await geminiResponse.json();
    const generatedContent = geminiData.candidates[0].content.parts[0].text;

    let parsedContent: {raw: string, faqs?: any[], metaTags?: any} = { raw: generatedContent };
    if (contentType === 'faq') {
        const qaPairs: {question: string, answer: string}[] = [];
        const lines = generatedContent.split('\n');
        let currentQ = '';
        let currentA = '';
        for (const line of lines){
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

    return {
      contentType,
      topic,
      targetKeywords,
      tone,
      industry: industry1,
      targetAudience: targetAudience1,
      contentLength,
      websiteUrl,
      generatedContent: parsedContent,
      wordCount: generatedContent.split(' ').length,
      generatedAt: new Date().toISOString(),
      optimizationTips: [
        'Content is structured for AI understanding',
        'Natural keyword integration for voice search',
        'Clear, citable format for AI systems',
        'Semantic structure for better comprehension'
      ]
    };
}
