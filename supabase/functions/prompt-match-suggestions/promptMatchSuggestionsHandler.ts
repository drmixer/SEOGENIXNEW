export async function promptMatchSuggestionsHandler(input: any) {
  const { topic, industry, targetAudience, contentType = 'article', userIntent = 'informational', websiteUrl } = input;

  if (!topic || topic.trim().length === 0) {
    throw new Error('Topic is required');
  }

  const promptSuggestions: any[] = [];

  // Direct Questions
  promptSuggestions.push({ prompt: `What is ${topic}?`, category: 'DIRECT QUESTIONS', likelihood: 95 });
  promptSuggestions.push({ prompt: `How does ${topic} work?`, category: 'DIRECT QUESTIONS', likelihood: 90 });

  // Comparison Queries
  promptSuggestions.push({ prompt: `${topic} vs traditional approaches`, category: 'COMPARISON QUERIES', likelihood: 85 });

  // How-To Requests
  promptSuggestions.push({ prompt: `How to implement ${topic} for best results`, category: 'HOW-TO REQUESTS', likelihood: 87 });

  // Voice Search
  promptSuggestions.push({ prompt: `Hey Siri, tell me about ${topic}`, category: 'VOICE SEARCH', likelihood: 83 });

  if (industry) {
    const normalizedIndustry = industry.toLowerCase();
    if (normalizedIndustry.includes('tech')) {
      promptSuggestions.push({ prompt: `How does ${topic} integrate with existing tech stacks?`, category: 'TECHNICAL', likelihood: 82 });
    }
  }

  if (websiteUrl) {
    try {
      const url = new URL(websiteUrl);
      const domain = url.hostname.replace('www.', '');
      const brandName = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
      promptSuggestions.push({ prompt: `How does ${brandName} approach ${topic}?`, category: 'DIRECT QUESTIONS', likelihood: 92 });
    } catch (e) { /* ignore */ }
  }

  const promptsByCategory = promptSuggestions.reduce((acc, prompt) => {
    acc[prompt.category] = acc[prompt.category] || [];
    acc[prompt.category].push(prompt);
    return acc;
  }, {});

  return {
    topic,
    industry,
    totalPrompts: promptSuggestions.length,
    promptSuggestions,
    promptsByCategory,
    generatedAt: new Date().toISOString()
  };
}
