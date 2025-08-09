import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Self-contained CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Helper functions for logging
async function logToolRun({ projectId, toolName, inputPayload }: { projectId: string, toolName: string, inputPayload: Record<string, any> }) {
  const { data, error } = await supabase.from('tool_runs').insert({ project_id: projectId, tool_name: toolName, input_payload: inputPayload, status: 'running' }).select('id').single();
  if (error) { console.error('Error logging tool run:', error); return null; }
  return data.id;
}

async function updateToolRun({ runId, status, outputPayload, errorMessage }: { runId: string, status: string, outputPayload?: Record<string, any>, errorMessage?: string }) {
    const update: { status: string, completed_at: string, output_payload?: any, error_message?: string } = { status, completed_at: new Date().toISOString() };
    if (outputPayload) update.output_payload = outputPayload;
    if (errorMessage) update.error_message = errorMessage;

    const { error } = await supabase.from('tool_runs').update(update).eq('id', runId);
    if (error) { console.error('Error updating tool run:', error); }
}

function generateFallbackResponse(message: string, context: string, userPlan: string) {
    let response = "I'm sorry, I'm having trouble connecting right now. Please try again in a moment.";
    if (context === 'landing') {
        if (message.toLowerCase().includes('price')) {
            response = "SEOGENIX offers several plans, including a free tier to get you started. You can find all the details on our pricing page.";
        } else {
            response = "Welcome to SEOGENIX! We help you optimize your content for AI search. How can I help you today?";
        }
    }
    return new Response(JSON.stringify({ response, note: 'This is a fallback response.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

export async function app(req: Request): Promise<Response> {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    let runId: string | null = null;
    try {
        const { projectId, message, context, userPlan, conversationHistory = [], userData } = await req.json();

        runId = await logToolRun({
            projectId: projectId,
            toolName: 'genie-chatbot',
            inputPayload: { message, context, userPlan, historyLength: conversationHistory.length }
        });

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

        const systemPrompt = `You are Genie, an AI assistant for SEOGENIX. Context: ${context}. User Plan: ${userPlan}. User Data: ${JSON.stringify(enhancedUserData || {})}`;
        const conversationText = conversationHistory.map((msg: {role: string, content: string}) => `${msg.role}: ${msg.content}`).join('\n') + `\nuser: ${message}`;

        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
        if (!geminiApiKey) throw new Error('Gemini API key not configured');

        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: `${systemPrompt}\n${conversationText}\nRespond as Genie.` }] }],
                generationConfig: { temperature: 0.7, maxOutputTokens: 512 }
            })
        });

        if (!geminiResponse.ok) {
            console.error('Gemini API error:', await geminiResponse.text());
            return generateFallbackResponse(message, context, userPlan);
        }

        const geminiData = await geminiResponse.json();
        const response = geminiData.candidates[0].content.parts[0].text;

        const output = { response, personalized: !!enhancedUserData };

        if (runId) {
            await updateToolRun({
                runId,
                status: 'completed',
                outputPayload: output
            });
        }

        return new Response(JSON.stringify({ runId, output }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err) {
        console.error(err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        if (runId) {
            await updateToolRun({ runId, status: 'error', errorMessage: errorMessage });
        }
        return new Response(JSON.stringify({ error: errorMessage }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
}

if (import.meta.main) {
    Deno.serve(app);
}
