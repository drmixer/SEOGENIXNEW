import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
// Note: Intentionally not using shared logging for this high-frequency tool to avoid noise.

// --- CORS Headers ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

// --- AI Prompt Engineering ---
const getChatPrompt = (request: ChatRequest, enhancedUserData: any): string => {
    const { message, context, userPlan, conversationHistory = [] } = request;
    const jsonSchema = `{ "responseText": "string", "suggestedFollowUps": ["string"] }`;

    return `You are Genie, an expert, friendly, and helpful AI assistant for SEOGENIX.
- **Current Context:** The user is on the '${context}' page.
- **User's Subscription Plan:** ${userPlan || (enhancedUserData ? 'Logged In' : 'Not logged in')}.
- **User's Data:** ${JSON.stringify(enhancedUserData, null, 2)}
- **Conversation History:**
  ${conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}
  user: ${message}

**Instructions:**
Based on the full context, generate a helpful and concise response to the user's message. Provide a few relevant follow-up questions.

**CRITICAL: You MUST provide your response in a single, valid JSON object enclosed in a \`\`\`json markdown block.**
The JSON object must strictly adhere to this schema:
\`\`\`json
${jsonSchema}
\`\`\`
Generate your response as Genie.`;
};


// --- Main Service Handler ---
const chatbotService = async (req: Request, supabase: SupabaseClient): Promise<Response> => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const requestBody: ChatRequest = await req.json();
        const { message, context } = requestBody;

        if (!message || !context) {
            return new Response(JSON.stringify({ success: false, error: { message: '`message` and `context` are required.' } }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        let enhancedUserData = requestBody.userData;
        const authHeader = req.headers.get('Authorization');
        if (authHeader && context === 'dashboard') {
            try {
                // Create a new client with the user's token to get their data
                const userSupabase = createClient(
                    Deno.env.get("SUPABASE_URL")!,
                    Deno.env.get("SUPABASE_ANON_KEY")!,
                    { global: { headers: { Authorization: authHeader } } }
                );
                const { data: { user } } = await userSupabase.auth.getUser();
                if (user) {
                    const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', user.id).single();
                    const { data: auditHistory } = await supabase.from('audit_history').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1);
                    enhancedUserData = { ...profile, lastAudit: auditHistory?.[0] };
                }
            } catch (error) { console.error('Error fetching user data for chatbot:', error); }
        }

        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
        if (!geminiApiKey) throw new Error('Gemini API key not configured');

        const prompt = getChatPrompt(requestBody, enhancedUserData);

        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 1024
                }
            })
        });

        if (!geminiResponse.ok) {
            const errorBody = await geminiResponse.text();
            throw new Error(`The AI model failed to process the request. Status: ${geminiResponse.status}. Body: ${errorBody}`);
        }

        const geminiData = await geminiResponse.json();
        const responseText = geminiData.candidates[0].content.parts[0].text;

        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
        if (!jsonMatch || !jsonMatch[1]) {
            // Fallback for cases where the model might forget the markdown
            if (responseText.trim().startsWith("{")) {
                const analysisJson = JSON.parse(responseText.trim());
                 return new Response(JSON.stringify({ success: true, data: { ...analysisJson, personalized: !!enhancedUserData } }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }
            throw new Error('Failed to extract JSON from AI response.');
        }
        const analysisJson = JSON.parse(jsonMatch[1]);

        if (!analysisJson.responseText || !analysisJson.suggestedFollowUps) {
            throw new Error('Generated chat response missing required fields.');
        }

        const output = { ...analysisJson, personalized: !!enhancedUserData };

        return new Response(JSON.stringify({ success: true, data: output }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        console.error('Chatbot error:', errorMessage);
        return new Response(JSON.stringify({ success: false, error: { message: errorMessage } }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
};

// --- Server ---
Deno.serve(async (req) => {
    // The chatbot uses the service role key to perform actions on behalf of the user,
    // but fetches user-specific data using the user's auth token if available.
    const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    return await chatbotService(req, supabase);
});
