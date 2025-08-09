function generateFallbackSchema(contentType: string, url: string) {
  const siteName = new URL(url).hostname.split('.')[0];
  const schema = {
    "@context": "https://schema.org",
    "@type": contentType.charAt(0).toUpperCase() + contentType.slice(1),
    "name": `Fallback ${contentType} for ${siteName}`,
    "description": "This is fallback schema generated due to an API error.",
    "url": url
  };
  const formattedSchema = JSON.stringify(schema, null, 2);
  return {
    schema: formattedSchema,
    implementation: `<script type="application/ld+json">\n${formattedSchema}\n</script>`,
    contentType,
    url,
    note: "This is fallback schema data as the API request failed"
  };
}

export async function schemaGeneratorHandler(input: any) {
  const { url, contentType, content } = input;

  let pageContent = content;
  if (url && !content) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': 'SEOGENIX Schema Generator Bot 1.0' } });
      if (response.ok) pageContent = await response.text();
    } catch (e) { console.error("URL fetch failed:", e); }
  }

  const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
  if (!geminiApiKey) {
    console.error('Gemini API key not configured, using fallback.');
    return generateFallbackSchema(contentType, url);
  }

  const prompt = `Generate a detailed, specific Schema.org JSON-LD markup for a ${contentType} based on this URL and content.
URL: ${url}
Content: ${pageContent ? pageContent.substring(0, 3000) : 'Not available, use URL information'}
Return ONLY the valid JSON object, nothing else. Use realistic values.`;

  const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, topK: 40, topP: 0.8, maxOutputTokens: 1024 }
    })
  });

  if (!geminiResponse.ok) {
    console.error('Gemini API error:', await geminiResponse.text());
    return generateFallbackSchema(contentType, url);
  }

  const geminiData = await geminiResponse.json();
  let schemaMarkup = geminiData.candidates[0].content.parts[0].text;

  // Clean the response to get valid JSON
  schemaMarkup = schemaMarkup.replace(/```json\s*/g, '').replace(/```\s*/g, '');
  const startIndex = schemaMarkup.indexOf('{');
  const endIndex = schemaMarkup.lastIndexOf('}');
  if (startIndex === -1 || endIndex === -1) return generateFallbackSchema(contentType, url);
  schemaMarkup = schemaMarkup.substring(startIndex, endIndex + 1);

  try {
    const parsedSchema = JSON.parse(schemaMarkup);
    const formattedSchema = JSON.stringify(parsedSchema, null, 2);
    return {
      schema: formattedSchema,
      implementation: `<script type="application/ld+json">\n${formattedSchema}\n</script>`,
      contentType,
      url
    };
  } catch (parseError) {
    console.error("JSON parse error:", parseError);
    return generateFallbackSchema(contentType, url);
  }
}
