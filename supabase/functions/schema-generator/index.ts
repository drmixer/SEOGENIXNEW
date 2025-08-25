import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// --- CORS Headers ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE'
};
// --- Inline Logging Functions (to avoid import issues) ---
async function logToolRun(supabase, projectId, toolName, inputPayload) {
  if (!projectId) {
    throw new Error("logToolRun error: projectId is required.");
  }
  console.log(`Logging tool run: ${toolName} for project: ${projectId}`);
  const { data, error } = await supabase.from("tool_runs").insert({
    project_id: projectId,
    tool_name: toolName,
    input_payload: inputPayload,
    status: "running",
    created_at: new Date().toISOString()
  }).select("id").single();
  if (error) {
    console.error("Error logging tool run:", error);
    throw new Error(`Failed to log tool run. Supabase error: ${error.message}`);
  }
  if (!data || !data.id) {
    console.error("No data or data.id returned from tool_runs insert.");
    throw new Error("Failed to log tool run: No data returned after insert.");
  }
  console.log(`Tool run logged with ID: ${data.id}`);
  return data.id;
}
async function updateToolRun(supabase, runId, status, outputPayload, errorMessage) {
  if (!runId) {
    console.error("updateToolRun error: runId is required.");
    return;
  }
  console.log(`Updating tool run ${runId} with status: ${status}`);
  const update = {
    status,
    completed_at: new Date().toISOString(),
    output_payload: errorMessage ? {
      error: errorMessage
    } : outputPayload || null,
    error_message: errorMessage || null
  };
  const { error } = await supabase.from("tool_runs").update(update).eq("id", runId);
  if (error) {
    console.error(`Error updating tool run ID ${runId}:`, error);
  } else {
    console.log(`Tool run ${runId} updated successfully`);
  }
}
// --- AI Prompt Engineering ---
const getSchemaPrompt = (url, contentType, content)=>{
  const schemas = {
    Article: `{
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": "string (The main headline of the article)",
      "author": { "@type": "Person", "name": "string (Author's name)" },
      "datePublished": "string (ISO 8601 format, e.g., '2025-08-23T12:00:00Z')",
      "image": "string (URL of the main image, if available)",
      "publisher": { "@type": "Organization", "name": "string (Publisher's name)", "logo": { "@type": "ImageObject", "url": "string (URL to logo)" } }
    }`,
    FAQPage: `{
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "string (The full text of the question)",
          "acceptedAnswer": { "@type": "Answer", "text": "string (The full text of the answer)" }
        }
      ]
    }`,
    HowTo: `{
      "@context": "https://schema.org",
      "@type": "HowTo",
      "name": "string (The goal of the how-to, e.g., 'How to Change a Tire')",
      "totalTime": "string (ISO 8601 duration, e.g., 'PT1H30M')",
      "step": [
        {
          "@type": "HowToStep",
          "text": "string (Description of the first step)",
          "name": "string (A short name for the step)"
        }
      ]
    }`
  };
  return `You are an expert in SEO and structured data. Your task is to generate a valid Schema.org JSON-LD markup object based on the provided content.

**Analysis Context:**
- **URL:** ${url}
- **Requested Schema Type:** ${contentType}
- **Content Snippet (first 8,000 characters):**
---
${content ? content.substring(0, 8000) : 'Content not provided, analyze the URL.'}
---

**Instructions:**
1. Analyze the content to extract the necessary information for the ${contentType} schema.
2. If key information is missing (e.g., author name, publish date), make a reasonable inference or use placeholder values like "Not available".
3. Construct a complete and valid JSON-LD object.

**CRITICAL: You MUST provide your response in a single, valid JSON object enclosed in a \`\`\`json markdown block.**
The JSON object must follow the specified schema structure.

The JSON object must follow this exact schema:
\`\`\`json
${schemas[contentType] || schemas['Article']}
\`\`\``;
};
// --- Content Fetcher with Better Error Handling ---
async function fetchPageContent(url) {
  try {
    console.log(`Fetching content from URL: ${url}`);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SEOGENIX-Bot/1.0; Schema Generator)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive'
      },
      // Add timeout
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const content = await response.text();
    console.log(`Successfully fetched content (${content.length} characters)`);
    return content;
  } catch (error) {
    console.error('Error fetching URL:', error);
    throw new Error(`Failed to fetch URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
// --- Fallback Schema Generator ---
function generateFallbackSchema(contentType, url, message) {
  console.warn(`Generating fallback schema for ${contentType}: ${message}`);
  const fallbackSchemas = {
    Article: {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": `Article from ${new URL(url).hostname}`,
      "author": {
        "@type": "Person",
        "name": "Not available"
      },
      "datePublished": new Date().toISOString(),
      "url": url,
      "description": "Schema generation failed - fallback schema provided"
    },
    FAQPage: {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Schema generation failed",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Unable to generate schema from content"
          }
        }
      ]
    },
    HowTo: {
      "@context": "https://schema.org",
      "@type": "HowTo",
      "name": `How-to guide from ${new URL(url).hostname}`,
      "description": "Schema generation failed - fallback schema provided",
      "step": [
        {
          "@type": "HowToStep",
          "text": "Unable to extract steps from content",
          "name": "Step 1"
        }
      ]
    }
  };
  const schema = fallbackSchemas[contentType] || fallbackSchemas['Article'];
  const formattedSchema = JSON.stringify(schema, null, 2);
  return {
    schema: formattedSchema,
    implementation: `<script type="application/ld+json">${formattedSchema}</script>`,
    url,
    contentType,
    generatedAt: new Date().toISOString(),
    note: `AI schema generation failed: ${message}. A basic fallback schema was generated.`
  };
}
// --- Main Service Handler ---
const schemaGeneratorService = async (req, supabase)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  let runId = null;
  try {
    const requestBody = await req.json();
    const { projectId, url, contentType, content } = requestBody;
    if (!projectId || !url || !contentType) {
      throw new Error('`projectId`, `url`, and `contentType` are required.');
    }
    // Validate contentType
    const validTypes = [
      'Article',
      'FAQPage',
      'HowTo'
    ];
    if (!validTypes.includes(contentType)) {
      throw new Error(`Invalid contentType. Must be one of: ${validTypes.join(', ')}`);
    }
    // Log tool run
    runId = await logToolRun(supabase, projectId, 'schema-generator', {
      url,
      contentType,
      hasContent: !!content,
      contentLength: content?.length
    });
    let pageContent = content;
    // Fetch content if not provided
    if (!pageContent) {
      try {
        pageContent = await fetchPageContent(url);
      } catch (fetchError) {
        console.warn('Failed to fetch URL content, proceeding with fallback schema:', fetchError);
      // Continue with fallback schema instead of failing completely
      }
    }
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      console.warn('Gemini API key not configured, using fallback schema');
      const fallbackSchema = generateFallbackSchema(contentType, url, 'API key not configured');
      if (runId) {
        await updateToolRun(supabase, runId, 'completed', fallbackSchema, null);
      }
      return new Response(JSON.stringify({
        success: true,
        data: fallbackSchema,
        runId,
        note: 'Fallback schema used due to missing API configuration'
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    if (!pageContent || pageContent.length < 100) {
      console.warn('Insufficient content for detailed schema generation, using fallback');
      const fallbackSchema = generateFallbackSchema(contentType, url, 'Insufficient content available');
      if (runId) {
        await updateToolRun(supabase, runId, 'completed', fallbackSchema, null);
      }
      return new Response(JSON.stringify({
        success: true,
        data: fallbackSchema,
        runId,
        note: 'Fallback schema used due to insufficient content'
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Generate AI schema
    const prompt = getSchemaPrompt(url, contentType, pageContent);
    console.log('Sending schema generation request to Gemini...');
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 4096,
          topP: 0.8,
          topK: 40
        }
      })
    });
    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', geminiResponse.status, errorText);
      // Use fallback schema on API failure
      const fallbackSchema = generateFallbackSchema(contentType, url, 'API error');
      if (runId) {
        await updateToolRun(supabase, runId, 'completed', fallbackSchema, null);
      }
      return new Response(JSON.stringify({
        success: true,
        data: fallbackSchema,
        runId,
        note: 'Fallback schema used due to API error'
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const geminiData = await geminiResponse.json();
    console.log('Gemini response received');
    if (!geminiData.candidates || geminiData.candidates.length === 0) {
      console.error('No candidates in Gemini response');
      const fallbackSchema = generateFallbackSchema(contentType, url, 'No AI response candidates');
      if (runId) {
        await updateToolRun(supabase, runId, 'completed', fallbackSchema, null);
      }
      return new Response(JSON.stringify({
        success: true,
        data: fallbackSchema,
        runId,
        note: 'Fallback schema used - no AI response candidates'
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const responseText = geminiData.candidates[0].content.parts[0].text;
    console.log('Processing AI response...');
    // Extract and parse JSON
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
    if (!jsonMatch || !jsonMatch[1]) {
      console.error('Failed to extract JSON from AI response');
      const fallbackSchema = generateFallbackSchema(contentType, url, 'Failed to parse AI response');
      if (runId) {
        await updateToolRun(supabase, runId, 'completed', fallbackSchema, null);
      }
      return new Response(JSON.stringify({
        success: true,
        data: fallbackSchema,
        runId,
        note: 'Fallback schema used - failed to parse AI response'
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    let parsedSchema;
    try {
      parsedSchema = JSON.parse(jsonMatch[1]);
    } catch (parseError) {
      console.error('Failed to parse schema JSON:', parseError);
      const fallbackSchema = generateFallbackSchema(contentType, url, 'JSON parse error');
      if (runId) {
        await updateToolRun(supabase, runId, 'completed', fallbackSchema, null);
      }
      return new Response(JSON.stringify({
        success: true,
        data: fallbackSchema,
        runId,
        note: 'Fallback schema used - JSON parse error'
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Validate schema structure
    if (!parsedSchema['@context'] || !parsedSchema['@type']) {
      console.error('Invalid schema structure');
      const fallbackSchema = generateFallbackSchema(contentType, url, 'Invalid schema structure');
      if (runId) {
        await updateToolRun(supabase, runId, 'completed', fallbackSchema, null);
      }
      return new Response(JSON.stringify({
        success: true,
        data: fallbackSchema,
        runId,
        note: 'Fallback schema used - invalid schema structure'
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Format and prepare final schema
    const formattedSchema = JSON.stringify(parsedSchema, null, 2);
    const schemaResult = {
      schema: formattedSchema,
      implementation: `<script type="application/ld+json">${formattedSchema}</script>`,
      url,
      contentType,
      generatedAt: new Date().toISOString(),
      contentLength: pageContent.length
    };
    console.log('Schema generation completed successfully');
    if (runId) {
      await updateToolRun(supabase, runId, 'completed', schemaResult, null);
    }
    return new Response(JSON.stringify({
      success: true,
      data: schemaResult,
      runId
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
    console.error('Schema Generator error:', errorMessage);
    if (runId) {
      await updateToolRun(supabase, runId, 'error', null, errorMessage);
    }
    return new Response(JSON.stringify({
      success: false,
      error: {
        message: errorMessage
      },
      runId
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
};
// --- Server ---
Deno.serve(async (req)=>{
  const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  return await schemaGeneratorService(req, supabase);
});

