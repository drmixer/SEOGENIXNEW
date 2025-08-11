import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Hono } from 'npm:hono'

// --- CORS Headers ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// --- Hono Environment Typing ---
type Env = {
    Variables: {
        supabase: SupabaseClient;
    };
};

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


// --- Hono App & Main Logic ---
export const app = new Hono<Env>();

app.post('/', async (c) => {
    const supabase = c.get('supabase');

    try {
        const { message, context, userPlan, conversationHistory = [], userData }: ChatRequest = await c.req.json();

        if (!message || !context) {
            throw new Error('`message` and `context` are required.');
        }

        // 1. Enhance user data if logged in
        let enhancedUserData = userData;
        const authHeader = c.req.header('Authorization');
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

        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
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

        return c.json({ success: true, data: output }, 200, corsHeaders);

    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        const errorCode = err instanceof Error ? err.name : 'UNKNOWN_ERROR';
        return c.json({ success: false, error: { message: errorMessage, code: errorCode } }, 500, corsHeaders);
    }
});


// --- Server ---
if (import.meta.main) {
    const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    // Middleware to inject Supabase client
    app.use('*', async (c, next) => {
        c.set('supabase', supabase)
        await next()
    })
    Deno.serve(app.fetch);
}
