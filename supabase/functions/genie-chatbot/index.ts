import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

interface ChatRequest {
  message: string;
  context: 'landing' | 'dashboard';
  userPlan?: 'free' | 'core' | 'pro' | 'agency';
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  userData?: {
    websites?: Array<{ url: string; name: string }>;
    industry?: string;
    recentActivity?: Array<{ activity_type: string; tool_id?: string; created_at: string }>;
    lastAuditScore?: number;
    lastAuditRecommendations?: string[];
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { 
      message, 
      context, 
      userPlan, 
      conversationHistory = [],
      userData 
    }: ChatRequest = await req.json();

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: 'Gemini API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user data from Supabase if available
    let enhancedUserData = userData;
    const authHeader = req.headers.get('Authorization');
    
    if (authHeader && context === 'dashboard') {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        
        if (supabaseUrl && supabaseServiceKey) {
          const supabase = createClient(supabaseUrl, supabaseServiceKey);
          
          // Get user from auth header
          const token = authHeader.replace('Bearer ', '');
          const { data: { user } } = await supabase.auth.getUser(token);
          
          if (user) {
            // Fetch user profile
            const { data: profile } = await supabase
              .from('user_profiles')
              .select('*')
              .eq('user_id', user.id)
              .single();

            // Fetch recent audit history
            const { data: auditHistory } = await supabase
              .from('audit_history')
              .select('*')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false })
              .limit(3);

            // Fetch recent activity
            const { data: recentActivity } = await supabase
              .from('user_activity')
              .select('*')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false })
              .limit(10);

            enhancedUserData = {
              websites: profile?.websites || [],
              industry: profile?.industry,
              recentActivity: recentActivity || [],
              lastAuditScore: auditHistory?.[0]?.overall_score,
              lastAuditRecommendations: auditHistory?.[0]?.recommendations || []
            };
          }
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    }

    // Build enhanced context for Genie
    let systemPrompt = '';
    
    if (context === 'landing') {
      systemPrompt = `You are Genie, the AI assistant for SEOGENIX - an AI-powered SEO platform. 
      You help potential customers understand:
      - SEOGENIX features and tools for AI visibility optimization
      - Pricing plans: Free (basic), Core ($29/mo), Pro ($79/mo), Agency ($199/mo)
      - AI visibility concepts and why they matter in 2025
      - How SEOGENIX differs from traditional SEO tools
      - The importance of optimizing for AI systems like ChatGPT, Claude, Gemini
      
      Be helpful, knowledgeable, and encourage users to try the platform. Keep responses concise but informative.`;
    } else {
      // Enhanced dashboard context with user data
      let userContext = `User plan: ${userPlan}\n`;
      
      if (enhancedUserData) {
        if (enhancedUserData.websites && enhancedUserData.websites.length > 0) {
          userContext += `User's websites: ${enhancedUserData.websites.map(w => `${w.name} (${w.url})`).join(', ')}\n`;
        }
        
        if (enhancedUserData.industry) {
          userContext += `Industry: ${enhancedUserData.industry}\n`;
        }
        
        if (enhancedUserData.lastAuditScore) {
          userContext += `Last audit score: ${enhancedUserData.lastAuditScore}/100\n`;
        }
        
        if (enhancedUserData.lastAuditRecommendations && enhancedUserData.lastAuditRecommendations.length > 0) {
          userContext += `Recent recommendations: ${enhancedUserData.lastAuditRecommendations.slice(0, 3).join(', ')}\n`;
        }
        
        if (enhancedUserData.recentActivity && enhancedUserData.recentActivity.length > 0) {
          const recentTools = enhancedUserData.recentActivity
            .filter(a => a.activity_type === 'tool_used' && a.tool_id)
            .slice(0, 3)
            .map(a => a.tool_id);
          
          if (recentTools.length > 0) {
            userContext += `Recently used tools: ${recentTools.join(', ')}\n`;
          }
        }
      }

      systemPrompt = `You are Genie, the AI assistant for SEOGENIX users. 
      
      ${userContext}
      
      You help users:
      - Understand their AI visibility audit results and scores
      - Navigate and use platform tools effectively
      - Interpret recommendations and implement improvements
      - Optimize their content for AI visibility and citations
      - Understand competitive analysis and benchmarking
      - Provide personalized advice based on their specific websites and industry
      
      ${userPlan === 'free' ? 'This user has limited access. Gently suggest upgrading for full features when relevant.' : ''}
      ${userPlan === 'core' ? 'This user has Core plan access. You can provide tool guidance and basic optimization advice.' : ''}
      ${['pro', 'agency'].includes(userPlan || '') ? 'This user has full access. Provide comprehensive support and proactive suggestions.' : ''}
      
      When giving advice, reference their specific websites, industry, and recent audit results when available.
      Be helpful, technical when needed, and focus on actionable advice. Keep responses conversational and concise.`;
    }

    // Prepare conversation for Gemini
    const conversationText = conversationHistory
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n') + `\nuser: ${message}`;

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `${systemPrompt}

              Conversation history:
              ${conversationText}
              
              Respond as Genie in a helpful, conversational tone. Keep responses concise but informative (2-3 sentences max unless more detail is specifically requested).
              
              ${enhancedUserData ? 'Use the user data provided to give personalized, relevant advice.' : ''}`
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 512,
          }
        })
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', errorText);
      throw new Error(`Gemini API failed: ${geminiResponse.status}`);
    }

    const geminiData = await geminiResponse.json();
    const response = geminiData.candidates[0].content.parts[0].text;

    // Generate proactive suggestions based on user data and plan
    let proactiveSuggestions = [];
    
    if (['pro', 'agency'].includes(userPlan || '') && context === 'dashboard' && enhancedUserData) {
      const suggestions = [];
      
      // Suggestions based on recent activity
      if (enhancedUserData.recentActivity) {
        const recentToolIds = enhancedUserData.recentActivity
          .filter(a => a.activity_type === 'tool_used')
          .map(a => a.tool_id);
        
        if (recentToolIds.includes('audit') && !recentToolIds.includes('optimizer')) {
          suggestions.push('Try the Content Optimizer to improve your audit scores');
        }
        
        if (recentToolIds.includes('competitive') && !recentToolIds.includes('entities')) {
          suggestions.push('Use Entity Coverage Analyzer to find gaps your competitors are covering');
        }
        
        if (!recentToolIds.includes('citations')) {
          suggestions.push('Check Citation Tracker for new mentions of your content');
        }
      }
      
      // Suggestions based on audit scores
      if (enhancedUserData.lastAuditScore) {
        if (enhancedUserData.lastAuditScore < 70) {
          suggestions.push('Your last audit score suggests focusing on content structure improvements');
        } else if (enhancedUserData.lastAuditScore > 85) {
          suggestions.push('Great audit score! Consider running competitive analysis to maintain your edge');
        }
      }
      
      // Industry-specific suggestions
      if (enhancedUserData.industry) {
        if (enhancedUserData.industry.toLowerCase().includes('tech')) {
          suggestions.push('Tech companies often benefit from technical FAQ generation');
        } else if (enhancedUserData.industry.toLowerCase().includes('healthcare')) {
          suggestions.push('Healthcare content should focus on entity coverage for medical terms');
        }
      }
      
      proactiveSuggestions = suggestions.slice(0, 1);
    }

    // Generate action suggestions for interactive elements
    let actionSuggestions = [];
    
    if (context === 'dashboard' && enhancedUserData) {
      // Suggest specific tools based on conversation context
      if (message.toLowerCase().includes('audit') || message.toLowerCase().includes('score')) {
        actionSuggestions.push({
          type: 'launchTool',
          toolId: 'audit',
          label: 'Run New Audit'
        });
      }
      
      if (message.toLowerCase().includes('schema') || message.toLowerCase().includes('markup')) {
        actionSuggestions.push({
          type: 'launchTool',
          toolId: 'schema',
          label: 'Generate Schema'
        });
      }
      
      if (message.toLowerCase().includes('competitor') || message.toLowerCase().includes('competition')) {
        actionSuggestions.push({
          type: 'launchTool',
          toolId: 'competitive',
          label: 'Analyze Competitors'
        });
      }
    }

    return new Response(
      JSON.stringify({
        response,
        proactiveSuggestions: Math.random() > 0.7 ? proactiveSuggestions : [],
        actionSuggestions: actionSuggestions.slice(0, 2),
        context,
        userPlan,
        personalized: !!enhancedUserData
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Genie chatbot error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to process chat message',
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});