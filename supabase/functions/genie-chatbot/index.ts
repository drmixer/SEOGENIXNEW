import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// --- CORS Headers ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE'
};
// --- Inline Logging Functions (to avoid import issues) ---
async function logToolRun(supabase, projectId, toolName, inputPayload) {
  if (!projectId) return null;
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
    return null;
  }
  if (!data || !data.id) {
    console.error("No data or data.id returned from tool_runs insert.");
    return null;
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
const getChatPrompt = (message, conversationHistory, userDataSummary)=>{
  const jsonSchema = `{
    "thought": "string (Your reasoning process. First, assess if you can answer directly. If not, determine which tool is needed. Then, formulate the exact parameters for that tool. Finally, explain what you will say to the user while the tool runs.)",
    "tool_used": "string ('none' | 'ai-visibility-audit' | 'competitor-discovery' | 'content-optimizer' | 'schema-generator')",
    "tool_input": {
      "key1": "value1",
      "key2": "value2"
    },
    "response_to_user": "string (The response to show the user. This could be the final answer, or a message like 'Sure, I can help with that. Analyzing the URL now...')",
    "suggested_follow_ups": ["string (Suggest 2-3 relevant follow-up questions the user might ask)"]
  }`;
  return `You are Genie, an expert, friendly, and helpful AI assistant for the SEOGENIX platform. You are a "ReAct" agent: you Reason, then you Act. Your goal is to help users by answering their questions or by using the platform's tools on their behalf.

**Current User & Context:**
- **User Data Summary:** ${JSON.stringify(userDataSummary, null, 2)}
- **Available Tools:** ai-visibility-audit, competitor-discovery, content-optimizer, schema-generator.

**Conversation History:**
${conversationHistory?.map((msg)=>`${msg.role}: ${msg.content}`).join('\n') || 'No previous conversation history.'}

**User's New Message:** "${message}"

**Your Task (Follow these steps):**
1. **Reasoning (\`thought\`):**
   a. Analyze the user's message in the context of the conversation history and user data.
   b. If the question is general (e.g., "What is SEO?"), decide to answer it directly. Set 'tool_used' to 'none'.
   c. If the question requires a platform tool (e.g., "Can you check my site's score?" or "Find my competitors"), decide which of the available tools is best suited.
   d. Formulate the exact input object (\`tool_input\`) needed to run that tool. Be smart about defaults (e.g., use the user's primary URL from their data if they just say "my site").
   e. Formulate a user-facing response to let them know you're working on their request.
2. **Action (\`tool_used\`, \`tool_input\`):**
   a. Set \`tool_used\` to the name of the tool you will use, or 'none'.
   b. Set \`tool_input\` to the JSON object you formulated. If no tool is used, this can be an empty object.
3. **Response (\`response_to_user\`, \`suggested_follow_ups\`):**
   a. Set \`response_to_user\` to the message you will show the user.
   b. Provide 2-3 relevant \`suggested_follow_ups\`.

**CRITICAL: You MUST provide your response in a single, valid JSON object enclosed in a \`\`\`json markdown block.**
The JSON object must strictly adhere to this schema:
\`\`\`json
${jsonSchema}
\`\`\`
Now, think and act as Genie.`;
};
// --- Fallback Chat Response Generator ---
function generateFallbackResponse(message) {
  return {
    thought: "Error occurred while processing the user's request. Providing a helpful fallback response.",
    tool_used: "none",
    tool_input: {},
    response_to_user: "I'm having a little trouble connecting to my systems right now. Could you please try rephrasing your question or try again in a moment?",
    suggested_follow_ups: [
      "What is SEO and how can it help my business?",
      "How can you help me optimize my website?",
      "What tools do you have available?"
    ],
    note: "Fallback response due to processing error"
  };
}
// --- Main Service Handler ---
const chatbotService = async (req, supabase)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  let runId = null;
  try {
    const requestBody = await req.json();
    const { projectId, userId, message, conversationHistory } = requestBody;
    if (!message) {
      return new Response(JSON.stringify({
        success: false,
        error: {
          message: '`message` is required.'
        }
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Log tool run (if projectId provided)
    runId = await logToolRun(supabase, projectId, 'genie-chatbot-request', {
      userId,
      messageLength: message.length,
      hasConversationHistory: !!conversationHistory?.length
    });
    // Fetch user context data
    let userDataSummary = {
      note: "User is not logged in."
    };
    if (userId) {
      try {
        const { data: profile } = await supabase.from('user_profiles').select('website_url, business_description, target_audience').eq('user_id', userId).single();
        if (profile) {
          userDataSummary = profile;
        }
      } catch (error) {
        console.error('Error fetching user data for chatbot:', error);
      }
    }
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      console.warn('Gemini API key not configured, using fallback response');
      const fallbackResponse = generateFallbackResponse(message);
      if (runId) {
        await updateToolRun(supabase, runId, 'completed', fallbackResponse, null);
      }
      return new Response(JSON.stringify({
        success: true,
        data: fallbackResponse,
        runId,
        note: 'Fallback response used due to missing API configuration'
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Generate AI response
    const prompt = getChatPrompt(message, conversationHistory, userDataSummary);
    console.log('Sending chat request to Gemini...');
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
          temperature: 0.4,
          maxOutputTokens: 4096,
          topP: 0.8,
          topK: 40
        }
      })
    });
    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', geminiResponse.status, errorText);
      const fallbackResponse = generateFallbackResponse(message);
      if (runId) {
        await updateToolRun(supabase, runId, 'completed', fallbackResponse, null);
      }
      return new Response(JSON.stringify({
        success: true,
        data: fallbackResponse,
        runId,
        note: 'Fallback response used due to API error'
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
      const fallbackResponse = generateFallbackResponse(message);
      if (runId) {
        await updateToolRun(supabase, runId, 'completed', fallbackResponse, null);
      }
      return new Response(JSON.stringify({
        success: true,
        data: fallbackResponse,
        runId,
        note: 'Fallback response used - no AI response candidates'
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
      const fallbackResponse = generateFallbackResponse(message);
      if (runId) {
        await updateToolRun(supabase, runId, 'completed', fallbackResponse, null);
      }
      return new Response(JSON.stringify({
        success: true,
        data: fallbackResponse,
        runId,
        note: 'Fallback response used - failed to parse AI response'
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    let chatResult;
    try {
      chatResult = JSON.parse(jsonMatch[1]);
    } catch (parseError) {
      console.error('Failed to parse chat JSON:', parseError);
      const fallbackResponse = generateFallbackResponse(message);
      if (runId) {
        await updateToolRun(supabase, runId, 'completed', fallbackResponse, null);
      }
      return new Response(JSON.stringify({
        success: true,
        data: fallbackResponse,
        runId,
        note: 'Fallback response used - JSON parse error'
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Validate chat result structure
    if (!chatResult.thought || !chatResult.response_to_user) {
      console.error('Invalid chat result structure');
      const fallbackResponse = generateFallbackResponse(message);
      if (runId) {
        await updateToolRun(supabase, runId, 'completed', fallbackResponse, null);
      }
      return new Response(JSON.stringify({
        success: true,
        data: fallbackResponse,
        runId,
        note: 'Fallback response used - invalid response structure'
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Ensure arrays exist
    chatResult.suggested_follow_ups = chatResult.suggested_follow_ups || [];
    chatResult.tool_input = chatResult.tool_input || {};
    chatResult.tool_used = chatResult.tool_used || 'none';
    // Add metadata
    chatResult.processedAt = new Date().toISOString();
    chatResult.userId = userId;
    console.log('Chat response generated successfully');
    if (runId) {
      await updateToolRun(supabase, runId, 'completed', chatResult, null);
    }
    return new Response(JSON.stringify({
      success: true,
      data: chatResult,
      runId
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
    console.error('Genie Chatbot error:', errorMessage);
    // Always return a friendly fallback response instead of erroring
    const fallbackResponse = generateFallbackResponse("I encountered an error");
    if (runId) {
      await updateToolRun(supabase, runId, 'error', fallbackResponse, errorMessage);
    }
    return new Response(JSON.stringify({
      success: true,
      data: fallbackResponse,
      runId,
      note: 'Fallback response used due to system error'
    }), {
      status: 200,
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
  return await chatbotService(req, supabase);
});
