import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logToolRun, updateToolRun } from "shared/logging.ts";

// --- CORS Headers ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// --- Type Definitions ---
interface ChatRequest {
    projectId: string;
    userId?: string;
    message: string;
    conversationHistory?: { role: 'user' | 'assistant'; content: string }[];
}

// --- AI Prompt Engineering ---
const getChatPrompt = (request: ChatRequest, userDataSummary: any): string => {
    const { message, conversationHistory = [] } = request;
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
    - **User ID:** ${request.userId || 'Guest'}
    - **User Data Summary:** ${JSON.stringify(userDataSummary, null, 2)}
    - **Available Tools:** ai-visibility-audit, competitor-discovery, content-optimizer, schema-generator.

    **Conversation History:**
    ${conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}
    **User's New Message:** "${message}"

    **Your Task (Follow these steps):**
    1.  **Reasoning (`thought`):**
        a.  Analyze the user's message in the context of the conversation history and user data.
        b.  If the question is general (e.g., "What is SEO?"), decide to answer it directly. Set 'tool_used' to 'none'.
        c.  If the question requires a platform tool (e.g., "Can you check my site's score?" or "Find my competitors"), decide which of the available tools is best suited.
        d.  Formulate the exact input object (`tool_input`) needed to run that tool. Be smart about defaults (e.g., use the user's primary URL from their data if they just say "my site").
        e.  Formulate a user-facing response to let them know you're working on their request.
    2.  **Action (`tool_used`, `tool_input`):**
        a.  Set `tool_used` to the name of the tool you will use, or 'none'.
        b.  Set `tool_input` to the JSON object you formulated. If no tool is used, this can be an empty object.
    3.  **Response (`response_to_user`, `suggested_follow_ups`):**
        a.  Set `response_to_user` to the message you will show the user.
        b.  Provide 2-3 relevant `suggested_follow_ups`.

    **CRITICAL: You MUST provide your response in a single, valid JSON object enclosed in a \`\`\`json markdown block.**
    The JSON object must strictly adhere to this schema:
    \`\`\`json
    ${jsonSchema}
    \`\`\`
    Now, think and act as Genie.`;
};

// --- Main Service Handler ---
const chatbotService = async (req: Request, supabase: SupabaseClient): Promise<Response> => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    let runId: string | null = null;
    let requestBody: ChatRequest;
    try {
        requestBody = await req.json();
        const { projectId, userId, message } = requestBody;

        if (!projectId || !message) {
            return new Response(JSON.stringify({ success: false, error: { message: '`projectId` and `message` are required.' } }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        runId = await logToolRun(supabase, projectId, 'genie-chatbot-request', requestBody);

        let userDataSummary = { note: "User is not logged in." };
        if (userId) {
            try {
                const { data: profile } = await supabase.from('user_profiles').select('website_url, business_description, target_audience').eq('user_id', userId).single();
                userDataSummary = { ...profile };
            } catch (error) { console.error('Error fetching user data for chatbot:', error.message); }
        }

        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
        if (!geminiApiKey) throw new Error('GEMINI_API_KEY is not configured.');

        const prompt = getChatPrompt(requestBody, userDataSummary);

        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.4, maxOutputTokens: 4096 }
            })
        });

        if (!geminiResponse.ok) throw new Error(`Gemini API failed: ${await geminiResponse.text()}`);

        const geminiData = await geminiResponse.json();
        const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!responseText) throw new Error("No response text from Gemini.");

        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
        if (!jsonMatch || !jsonMatch[1]) throw new Error('Could not extract JSON from AI response.');

        const output = JSON.parse(jsonMatch[1]);
        if (!output.thought || !output.response_to_user) {
            throw new Error('Generated chat response missing required fields.');
        }

        await updateToolRun(supabase, runId, 'completed', output, null);

        return new Response(JSON.stringify({ success: true, data: output, runId }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        console.error('Chatbot Error:', errorMessage);

        const fallbackResponse = {
            thought: "Error occurred. Sending a friendly fallback message.",
            tool_used: "none",
            tool_input: {},
            response_to_user: "I'm having a little trouble connecting to my systems right now. Please try again in a moment.",
            suggested_follow_ups: ["What is SEO?", "How can you help me?"]
        };

        if (runId) {
            await updateToolRun(supabase, runId, 'error', { ...fallbackResponse, error: errorMessage }, errorMessage);
        }

        return new Response(JSON.stringify({ success: true, data: fallbackResponse, runId }), {
            status: 200, // Return 200 with a friendly error so the frontend can display it
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
};

// --- Server ---
Deno.serve(async (req) => {
    const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    return await chatbotService(req, supabase);
});
