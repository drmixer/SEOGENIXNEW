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

export const handler = async (req: Request): Promise<Response> => {
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
    
    console.log(`Processing chat request in ${context} context: "${message.substring(0, 50)}..."`);
    console.log(`User plan: ${userPlan || 'not specified'}`);

    // Get user data from Supabase if available
    let enhancedUserData = userData;
    const authHeader = req.headers.get('Authorization');
    
    if (authHeader && context === 'dashboard') {
      try {
        console.log('Attempting to fetch user data from Supabase');
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        
        if (supabaseUrl && supabaseServiceKey) {
          const supabase = createClient(supabaseUrl, supabaseServiceKey);
          
          // Get user from auth header
          const token = authHeader.replace('Bearer ', '');
          const { data: { user } } = await supabase.auth.getUser(token);
          
          if (user) {
            console.log(`User authenticated: ${user.id}`);
            
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
            
            console.log('Enhanced user data fetched successfully');
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

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY') || 'AIzaSyDJC5a7zgGvBk58ojXPKkQJXu-fR3qHHHM'; // Fallback to demo key
    
    if (!geminiApiKey) {
      console.error('Gemini API key not configured');
      return new Response(
        JSON.stringify({ error: 'Gemini API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Calling Gemini API for chatbot response...');
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
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
      
      // Return fallback response if API fails
      console.log('Using fallback chatbot response');
      return generateFallbackResponse(message, context, userPlan, enhancedUserData);
    }

    console.log('Received response from Gemini API');
    const geminiData = await geminiResponse.json();
    const response = geminiData.candidates[0].content.parts[0].text;

    // Generate proactive suggestions based on user data and plan
    let proactiveSuggestions: string[] = [];
    
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

    console.log('Returning chatbot response with suggestions');
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
        details: (error as Error).message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

Deno.serve(handler);

// Fallback function to generate sample response when API fails
function generateFallbackResponse(
  message: string, 
  context: 'landing' | 'dashboard', 
  userPlan?: string,
  userData?: any
): Response {
  console.log(`Generating fallback response for ${context} context`);
  
  let response = '';
  let proactiveSuggestions: string[] = [];
  let actionSuggestions: any[] = [];
  
  if (context === 'landing') {
    // Landing page responses
    if (message.toLowerCase().includes('price') || message.toLowerCase().includes('cost') || message.toLowerCase().includes('plan')) {
      response = "SEOGENIX offers four plans: Free (basic features), Core ($29/month with essential tools), Pro ($79/month with advanced features), and Agency ($199/month for team collaboration). Each plan includes progressively more powerful AI visibility tools and higher usage limits.";
    } else if (message.toLowerCase().includes('ai visibility') || message.toLowerCase().includes('what is ai')) {
      response = "AI visibility refers to how well your content is structured and optimized for AI systems like ChatGPT, Google Bard, and voice assistants. As more people use AI to find information, traditional SEO isn't enough - your content needs to be easily understood and cited by AI systems.";
    } else if (message.toLowerCase().includes('different') || message.toLowerCase().includes('traditional seo')) {
      response = "Unlike traditional SEO tools that focus only on search engines, SEOGENIX is built for the AI era. We analyze how AI systems understand your content, track AI citations, optimize for voice assistants, and provide tools specifically designed for AI-driven search and discovery.";
    } else if (message.toLowerCase().includes('feature') || message.toLowerCase().includes('tool')) {
      response = "SEOGENIX offers tools like AI Visibility Audit, Schema Generator, Citation Tracker, Voice Assistant Tester, Content Optimizer, and Competitive Analysis. Our platform helps you understand how AI systems view your content and provides actionable ways to improve.";
    } else {
      response = "Welcome to SEOGENIX! We're an AI-powered SEO platform that helps you optimize your content for AI systems like ChatGPT, Claude, and voice assistants. How can I help you understand our platform better?";
    }
  } else {
    // Dashboard responses
    if (message.toLowerCase().includes('audit') || message.toLowerCase().includes('score')) {
      response = "The AI Visibility Audit analyzes how well your content is structured for AI systems. It provides an overall score plus subscores for AI Understanding, Citation Likelihood, Conversational Readiness, and Content Structure. Run an audit to get personalized recommendations.";
      actionSuggestions.push({
        type: 'launchTool',
        toolId: 'audit',
        label: 'Run New Audit'
      });
    } else if (message.toLowerCase().includes('schema') || message.toLowerCase().includes('markup')) {
      response = "Our Schema Generator creates structured data markup that helps AI systems better understand your content. This improves your chances of being cited and featured in AI responses. Simply enter your URL and content type to generate optimized Schema.org JSON-LD.";
      actionSuggestions.push({
        type: 'launchTool',
        toolId: 'schema',
        label: 'Generate Schema'
      });
    } else if (message.toLowerCase().includes('competitor') || message.toLowerCase().includes('competition')) {
      response = "The Competitive Analysis tool compares your AI visibility against competitors. It shows where you lead or lag in specific areas and provides strategic recommendations to gain competitive advantage.";
      actionSuggestions.push({
        type: 'launchTool',
        toolId: 'competitive',
        label: 'Analyze Competitors'
      });
    } else if (message.toLowerCase().includes('optimize') || message.toLowerCase().includes('improve')) {
      response = "To improve your AI visibility, start with an audit, then use the Content Optimizer to enhance your content structure and clarity. Adding Schema markup and FAQ sections also significantly improves how AI systems understand and cite your content.";
    } else {
      response = "I'm Genie, your AI assistant for SEOGENIX. I can help you understand your AI visibility scores, use our tools effectively, and implement optimization strategies. What would you like help with today?";
    }
    
    // Add personalized elements if user data is available
    if (userData) {
      if (userData.lastAuditScore) {
        proactiveSuggestions.push(`Your last audit score was ${userData.lastAuditScore}/100. ${userData.lastAuditScore < 70 ? 'Consider using the Content Optimizer to improve this score.' : 'Great job! Consider running a competitive analysis to maintain your edge.'}`);
      }
      
      if (userData.websites && userData.websites.length > 0) {
        actionSuggestions.push({
          type: 'launchTool',
          toolId: 'audit',
          label: `Audit ${userData.websites[0].name}`
        });
      }
    }
  }
  
  return new Response(
    JSON.stringify({
      response,
      proactiveSuggestions: Math.random() > 0.7 ? proactiveSuggestions : [],
      actionSuggestions: actionSuggestions.slice(0, 2),
      context,
      userPlan,
      personalized: !!userData,
      note: 'This is a fallback response as the API request failed'
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}