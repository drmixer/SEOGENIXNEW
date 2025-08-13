import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- CORS Headers ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

// --- Database Logging Helpers ---
async function logToolRun(supabase: SupabaseClient, projectId: string, toolName: string, inputPayload: object) {
  if (!projectId) {
    throw new Error("logToolRun error: projectId is required.");
  }
  const { data, error } = await supabase
    .from("tool_runs")
    .insert({
      project_id: projectId,
      tool_name: toolName,
      input_payload: inputPayload,
      status: "running",
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error logging tool run:", error);
    throw new Error(`Failed to log tool run. Supabase error: ${error.message}`);
  }
  if (!data || !data.id) {
    console.error("No data or data.id returned from tool_runs insert.");
    throw new Error("Failed to log tool run: No data returned after insert.");
  }
  return data.id;
}

async function updateToolRun(supabase: SupabaseClient, runId: string, status: string, outputPayload: object | null, errorMessage: string | null) {
  if (!runId) {
    console.error("updateToolRun error: runId is required.");
    return;
  }
  const update = {
    status,
    completed_at: new Date().toISOString(),
    output_payload: errorMessage ? { error: errorMessage } : outputPayload || null,
    error_message: errorMessage || null,
  };
  const { error } = await supabase.from("tool_runs").update(update).eq("id", runId);
  if (error) {
    console.error(`Error updating tool run ID ${runId}:`, error);
  }
}

interface ContentGenerationRequest {
    contentType: 'faq' | 'meta-tags' | 'snippets' | 'headings' | 'descriptions';
    topic: string;
    targetKeywords: string[];
    tone?: 'professional' | 'casual' | 'technical' | 'friendly';
    entitiesToInclude?: string[];
}

// --- AI Prompt Engineering ---
const getContentGenerationPrompt = (request: ContentGenerationRequest) => {
  const { contentType, topic, targetKeywords, tone, entitiesToInclude } = request;
  
  const baseInstructions = {
    'faq': 'Generate 5-7 comprehensive FAQ pairs. Create questions that people commonly ask and provide clear, detailed answers. Format as an array of objects with "question" and "answer" fields.',
    'meta-tags': 'Generate optimized meta tags including title (60 chars max), description (160 chars max), and keywords.',
    'snippets': 'Create featured snippet-optimized content that directly answers common questions. Format as a concise, well-structured response.',
    'headings': 'Generate a comprehensive and logical heading structure with H1, H2s, and H3s that follows SEO best practices.',
    'descriptions': 'Write compelling, SEO-optimized descriptions that clearly explain the topic and include target keywords naturally.'
  };

  const entityInstruction = entitiesToInclude && entitiesToInclude.length > 0 
    ? `**Important: You must naturally integrate these entities into the content:** ${entitiesToInclude.join(', ')}.` 
    : '';

  let specificFormat = '';
  switch (contentType) {
    case 'faq':
      specificFormat = `
      "generatedContent": {
        "faqs": [
          {"question": "Question text here", "answer": "Detailed answer here"},
          {"question": "Another question", "answer": "Another detailed answer"}
        ]
      }`;
      break;
    case 'meta-tags':
      specificFormat = `
      "generatedContent": {
        "metaTags": {
          "title": "SEO optimized title (60 chars max)",
          "description": "Meta description (160 chars max)",
          "keywords": "keyword1, keyword2, keyword3"
        }
      }`;
      break;
    case 'snippets':
      specificFormat = `
      "generatedContent": {
        "snippet": "Direct, well-structured answer optimized for featured snippets",
        "raw": "The same content as snippet"
      }`;
      break;
    case 'headings':
      specificFormat = `
      "generatedContent": {
        "headingStructure": {
          "h1": "Main heading",
          "sections": [
            {"h2": "Section heading", "h3s": ["Subsection 1", "Subsection 2"]},
            {"h2": "Another section", "h3s": ["Subsection A", "Subsection B"]}
          ]
        },
        "raw": "H1: Main heading\\nH2: Section heading\\nH3: Subsection 1\\n..."
      }`;
      break;
    case 'descriptions':
      specificFormat = `
      "generatedContent": {
        "description": "Compelling, SEO-optimized description",
        "raw": "The same content as description"
      }`;
      break;
  }

  return `You are an Expert Content Strategist and SEO Copywriter.

**Content Generation Task:**
- **Content Type:** ${contentType}
- **Primary Topic:** ${topic}
- **Target Keywords:** ${targetKeywords.join(', ')}
- **Tone:** ${tone || 'professional'}
${entityInstruction}

**Instructions:**
${baseInstructions[contentType]}

- Ensure all content is high-quality, accurate, and ready for publication
- Naturally incorporate ALL target keywords where appropriate
- Use the specified tone throughout
- Make content optimized for AI systems and search engines

**Required JSON Response Format:**
\`\`\`json
{
  "generatedTitle": "Engaging title for the content",
  ${specificFormat},
  "optimizationTips": [
    "Tip 1 about how to use this content effectively",
    "Tip 2 about SEO best practices",
    "Tip 3 about AI optimization"
  ],
  "supportingDetails": {
    "wordCount": number,
    "keywordsUsed": ["array", "of", "keywords", "included"],
    "aiOptimizationScore": number_between_1_and_100
  }
}
\`\`\`

Generate the content now:`;
};

// --- Main Service Handler ---
export const contentGeneratorService = async (req: Request, supabase: SupabaseClient) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let runId = null;
  try {
    const requestBody = await req.json();
    const { projectId, ...inputPayload } = requestBody;
    
    console.log('Content generator request:', requestBody);
    
    if (!projectId) throw new Error("projectId is required for logging.");
    if (!requestBody.topic || !requestBody.contentType) {
      throw new Error('`topic` and `contentType` are required fields.');
    }

    // Validate contentType
    const validContentTypes = ['faq', 'meta-tags', 'snippets', 'headings', 'descriptions'];
    if (!validContentTypes.includes(requestBody.contentType)) {
      throw new Error(`Invalid contentType. Must be one of: ${validContentTypes.join(', ')}`);
    }

    runId = await logToolRun(supabase, projectId, 'ai-content-generator', inputPayload);

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('Gemini API key not configured');
    }

    const prompt = getContentGenerationPrompt(requestBody);
    console.log('Generated prompt:', prompt.substring(0, 200) + '...');

    // Gemini API call with latest stable model
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4096,
            topP: 0.8,
            topK: 40
          }
        })
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', geminiResponse.status, errorText);
      throw new Error(`Gemini API failed with status ${geminiResponse.status}: ${errorText}`);
    }

    const geminiData = await geminiResponse.json();
    console.log('Gemini response structure:', JSON.stringify(geminiData, null, 2));

    if (!geminiData.candidates || geminiData.candidates.length === 0) {
      console.error('No candidates in Gemini response:', geminiData);
      throw new Error('No content generated by Gemini API');
    }

    const candidate = geminiData.candidates[0];
    if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
      console.error('No content parts in Gemini response:', candidate);
      throw new Error('Invalid response structure from Gemini API');
    }

    const responseText = candidate.content.parts[0].text;
    console.log('Raw Gemini response text:', responseText);

    // Parse JSON response
    let generatedJson;
    try {
      // Clean the response text to extract JSON
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || responseText.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : responseText;

      console.log('Extracted JSON string:', jsonString);
      generatedJson = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('Failed to parse Gemini JSON response:', parseError);
      console.error('Response text was:', responseText);
      throw new Error('Failed to parse AI response as JSON');
    }

    // Validate the generated content structure
    if (!generatedJson.generatedTitle || !generatedJson.generatedContent) {
      console.error('Invalid generated JSON structure:', generatedJson);
      throw new Error('Generated content missing required fields');
    }

    // Add metadata
    generatedJson.generatedAt = new Date().toISOString();
    generatedJson.contentType = requestBody.contentType;

    console.log('Final generated content:', JSON.stringify(generatedJson, null, 2));

    if (runId) {
      await updateToolRun(supabase, runId, 'completed', generatedJson, null);
    }

    return new Response(JSON.stringify({
      success: true,
      data: generatedJson
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
    console.error('Content generator error:', err);
    
    if (runId) {
      await updateToolRun(supabase, runId, 'error', null, errorMessage);
    }

    return new Response(JSON.stringify({
      success: false,
      error: {
        message: errorMessage,
        details: err instanceof Error ? err.stack : undefined
      }
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
Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  return await contentGeneratorService(req, supabase);
});
