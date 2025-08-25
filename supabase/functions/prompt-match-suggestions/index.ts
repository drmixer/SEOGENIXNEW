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
const getSuggestionPrompt = (topic, industry, targetAudience, userIntent)=>{
  const jsonSchema = `{
    "suggestions": [
      {
        "category": "string ('Top of Funnel' | 'Middle of Funnel' | 'Bottom of Funnel')",
        "prompt": "string (The suggested search prompt or content title)",
        "rationale": "string (A brief explanation of why this is a good suggestion for the specified user intent and audience)"
      }
    ]
  }`;
  return `You are an Expert SEO Strategist and Content Ideator. Your task is to brainstorm a list of 10-15 highly relevant content ideas or search prompts based on a user's topic and context.

**Brainstorming Context:**
- **Core Topic:** ${topic}
- **Industry:** ${industry || 'General'}
- **Target Audience:** ${targetAudience || 'General Audience'}
- **Primary User Intent to Target:** ${userIntent || 'Informational'}

**Instructions:**
1. Generate 10-15 diverse and creative prompt suggestions related to the core topic.
2. For each suggestion, determine which part of the marketing funnel it targets ('Top of Funnel', 'Middle of Funnel', 'Bottom of Funnel').
3. For each suggestion, provide a brief 'rationale' explaining why it's a valuable prompt for the user's context.

**CRITICAL: You MUST provide your response in a single, valid JSON object enclosed in a \`\`\`json markdown block.**
The JSON object must strictly adhere to the following schema:
\`\`\`json
${jsonSchema}
\`\`\`
Now, perform your expert brainstorming.`;
};
// --- Fallback Suggestions Generator ---
function generateFallbackSuggestions(topic, message) {
  const fallbackSuggestions = [
    {
      category: "Top of Funnel",
      prompt: `What is ${topic}?`,
      rationale: "Basic informational content helps establish topical authority and captures early-stage search traffic."
    },
    {
      category: "Top of Funnel",
      prompt: `${topic} explained for beginners`,
      rationale: "Educational content targeting newcomers has high search volume and builds trust with potential customers."
    },
    {
      category: "Middle of Funnel",
      prompt: `Best practices for ${topic}`,
      rationale: "How-to content demonstrates expertise and helps users evaluate solutions, moving them down the funnel."
    },
    {
      category: "Middle of Funnel",
      prompt: `Common ${topic} mistakes to avoid`,
      rationale: "Problem-focused content shows understanding of user pain points and positions you as a helpful resource."
    },
    {
      category: "Bottom of Funnel",
      prompt: `${topic} tools and services comparison`,
      rationale: "Comparison content targets users ready to make purchasing decisions and can drive conversions."
    }
  ];
  return {
    suggestions: fallbackSuggestions,
    topic,
    generatedAt: new Date().toISOString(),
    note: `AI suggestion generation failed: ${message}. Fallback suggestions provided.`
  };
}
// --- Main Service Handler ---
const suggestionService = async (req, supabase)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  let runId = null;
  try {
    const requestBody = await req.json();
    const { projectId, topic, industry, targetAudience, userIntent } = requestBody;
    if (!projectId || !topic?.trim()) {
      throw new Error('`projectId` and `topic` are required.');
    }
    // Log tool run
    runId = await logToolRun(supabase, projectId, 'prompt-match-suggestions', {
      topic,
      industry,
      targetAudience,
      userIntent,
      topicLength: topic.length
    });
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      console.warn('Gemini API key not configured, using fallback suggestions');
      const fallbackSuggestions = generateFallbackSuggestions(topic, 'API key not configured');
      if (runId) {
        await updateToolRun(supabase, runId, 'completed', fallbackSuggestions, null);
      }
      return new Response(JSON.stringify({
        success: true,
        data: fallbackSuggestions,
        runId,
        note: 'Fallback suggestions used due to missing API configuration'
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Generate AI suggestions
    const prompt = getSuggestionPrompt(topic, industry, targetAudience, userIntent);
    console.log('Sending prompt suggestions request to Gemini...');
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
          temperature: 0.8,
          maxOutputTokens: 4096,
          topP: 0.8,
          topK: 40
        }
      })
    });
    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', geminiResponse.status, errorText);
      // Use fallback suggestions on API failure
      const fallbackSuggestions = generateFallbackSuggestions(topic, 'API error');
      if (runId) {
        await updateToolRun(supabase, runId, 'completed', fallbackSuggestions, null);
      }
      return new Response(JSON.stringify({
        success: true,
        data: fallbackSuggestions,
        runId,
        note: 'Fallback suggestions used due to API error'
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
      const fallbackSuggestions = generateFallbackSuggestions(topic, 'No AI response candidates');
      if (runId) {
        await updateToolRun(supabase, runId, 'completed', fallbackSuggestions, null);
      }
      return new Response(JSON.stringify({
        success: true,
        data: fallbackSuggestions,
        runId,
        note: 'Fallback suggestions used - no AI response candidates'
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
      const fallbackSuggestions = generateFallbackSuggestions(topic, 'Failed to parse AI response');
      if (runId) {
        await updateToolRun(supabase, runId, 'completed', fallbackSuggestions, null);
      }
      return new Response(JSON.stringify({
        success: true,
        data: fallbackSuggestions,
        runId,
        note: 'Fallback suggestions used - failed to parse AI response'
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    let suggestionsResult;
    try {
      suggestionsResult = JSON.parse(jsonMatch[1]);
    } catch (parseError) {
      console.error('Failed to parse suggestions JSON:', parseError);
      const fallbackSuggestions = generateFallbackSuggestions(topic, 'JSON parse error');
      if (runId) {
        await updateToolRun(supabase, runId, 'completed', fallbackSuggestions, null);
      }
      return new Response(JSON.stringify({
        success: true,
        data: fallbackSuggestions,
        runId,
        note: 'Fallback suggestions used - JSON parse error'
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Validate suggestions result structure
    if (!suggestionsResult.suggestions || !Array.isArray(suggestionsResult.suggestions)) {
      console.error('Invalid suggestions result structure');
      const fallbackSuggestions = generateFallbackSuggestions(topic, 'Invalid suggestions structure');
      if (runId) {
        await updateToolRun(supabase, runId, 'completed', fallbackSuggestions, null);
      }
      return new Response(JSON.stringify({
        success: true,
        data: fallbackSuggestions,
        runId,
        note: 'Fallback suggestions used - invalid suggestions structure'
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Validate each suggestion has required fields
    const validSuggestions = suggestionsResult.suggestions.filter((suggestion)=>suggestion.category && suggestion.prompt && suggestion.rationale);
    if (validSuggestions.length === 0) {
      console.error('No valid suggestions found in AI response');
      const fallbackSuggestions = generateFallbackSuggestions(topic, 'No valid suggestions found');
      if (runId) {
        await updateToolRun(supabase, runId, 'completed', fallbackSuggestions, null);
      }
      return new Response(JSON.stringify({
        success: true,
        data: fallbackSuggestions,
        runId,
        note: 'Fallback suggestions used - no valid suggestions found'
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Add metadata
    const finalResult = {
      suggestions: validSuggestions,
      topic,
      industry,
      targetAudience,
      userIntent,
      generatedAt: new Date().toISOString(),
      totalSuggestions: validSuggestions.length
    };
    console.log('Prompt suggestions completed successfully');
    if (runId) {
      await updateToolRun(supabase, runId, 'completed', finalResult, null);
    }
    return new Response(JSON.stringify({
      success: true,
      data: finalResult,
      runId
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
    console.error('Prompt Match Suggestions error:', errorMessage);
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
  return await suggestionService(req, supabase);
});

