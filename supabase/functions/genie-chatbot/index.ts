import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serviceHandler, createSuccessResponse, createErrorResponse } from "shared/service-handler.ts";

// --- Type Definitions ---
interface ChatRequest {
    projectId?: string;
    message: string;
    context: 'dashboard' | 'landing';
    userPlan?: string;
    conversationHistory?: { role: 'user' | 'assistant'; content: string }[];
    userData?: Record<string, any>;
}

interface ChatResponse {
    responseText: string;
    suggestedFollowUps: string[];
}

// --- AI Prompt Engineering ---
const getChatPrompt = (message: string, context: string, userPlan: string, conversationHistory: any[], enhancedUserData: any): string => {
    const jsonSchema = `
    {
      "responseText": "string (Your helpful, conversational response as Genie. Use markdown for formatting if needed.)",
      "suggestedFollowUps": [
        "string (A relevant, engaging follow-up question the user might ask.)"
      ]
    }
    `;

    const fewShotExample = `
    {
      "responseText": "SEOGENIX helps you optimize your website's content to rank higher in AI-driven search engines like Google's SGE. It's like SEO, but specifically for the new generation of AI!",
      "suggestedFollowUps": [
        "How is it different from traditional SEO?",
        "What kind of tools do you offer?",
        "Can I see a demo?"
      ]
    }
    `;

    const systemPrompt = `You are Genie, an expert, friendly, and helpful AI assistant for SEOGENIX. Your goal is to answer user questions accurately and encourage them to explore the platform.
    - **Current Context:** The user is on the '${context}' page.
    - **User's Subscription Plan:** ${userPlan || 'Not logged in'}.
    - **User's Data:** ${JSON.stringify(enhancedUserData, null, 2)}.
    - **Conversation History:**
      ${conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}
      user: ${message}
    `;

    return `
    ${systemPrompt}

    **Your Instructions:**
    Based on the full context provided above, generate a helpful and concise response to the user's message. Also, provide a few relevant follow-up questions a user might have.

    **Output Format:**
    You MUST provide a response in a single, valid JSON object. Do not include any text, markdown, or formatting outside of the JSON object. The JSON object must strictly adhere to the following schema:
    \`\`\`json
    ${jsonSchema}
    \`\`\`

    **Example of Ideal Output:**
    \`\`\`json
    ${fewShotExample}
    \`\`\`

    Now, generate your response as Genie.
    `;
};


// --- Main Service ---
const chatbotToolLogic = async (req: Request, supabase: SupabaseClient): Promise<Response> => {
    try {
        const { message, context, userPlan, conversationHistory = [], userData }: ChatRequest = await req.json();

        if (!message || !context) {
            return createErrorResponse('`message` and `context` are required.', 400);
        }

        // 1. Enhance user data if logged in
        let enhancedUserData = userData;
        const authHeader = req.headers.get('Authorization');
        if (authHeader && context === 'dashboard') {
            try {
                const token = authHeader.replace('Bearer ', '');
                const { data: { user } } = await supabase.auth.getUser(token);
                if (user) {
                    const { data: profile } = await supabase.from('user_profiles').select('*').eq('user_id', user.id).single();
                    const { data: auditHistory } = await supabase.from('audit_history').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1);
                    enhancedUserData = { ...profile, lastAudit: auditHistory?.[0] };
                }
            } catch (error) { console.error('Error fetching user data:', error); }
        }

        // 2. Get AI Response
        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
        if (!geminiApiKey) throw new Error('Gemini API key not configured');

        const prompt = getChatPrompt(message, context, userPlan || 'none', conversationHistory, enhancedUserData);

        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    response_mime_type: "application/json",
                    temperature: 0.7,
                    maxOutputTokens: 1024
                }
            })
        });

        if (!geminiResponse.ok) {
            throw new Error(`The AI model failed to process the request. Status: ${geminiResponse.status}`);
        }

        const geminiData = await geminiResponse.json();
        const analysisJson: ChatResponse = JSON.parse(geminiData.candidates[0].content.parts[0].text);

        const output = { ...analysisJson, personalized: !!enhancedUserData };

        return createSuccessResponse(output);

    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        return createErrorResponse(errorMessage);
    }
};

Deno.serve((req) => serviceHandler(req, chatbotToolLogic));
