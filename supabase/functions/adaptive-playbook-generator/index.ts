import { serve } from "https://deno.land/std@0.200.0/http/server.ts";
import { logToolRun } from 'shared/logToolRun.ts';
import { updateToolRun } from 'shared/updateToolRun.ts';

interface PlaybookRequest {
  userId: string;
  goal?: string;
  targetScore?: number;
  focusArea?: 'ai_understanding' | 'citation_likelihood' | 'conversational_readiness' | 'content_structure' | 'overall';
  timeframe?: 'quick' | 'standard' | 'comprehensive';
  previousResults?: any;
}

interface PlaybookStep {
  id: string;
  title: string;
  description: string;
  toolId: string;
  estimatedTime: string;
  priority: number;
  dependsOn?: string[];
}

interface AdaptivePlaybook {
  id: string;
  title: string;
  description: string;
  steps: PlaybookStep[];
  estimatedTimeMinutes: number;
  targetScore: number;
  focusArea: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { 
      userId, 
      goal, 
      targetScore, 
      focusArea = 'overall',
      timeframe = 'standard',
      previousResults
    }: PlaybookRequest = await req.json();

    // Validate auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    
    if (!user) {
      throw new Error('Invalid authentication');
    }

    // Fetch user data for personalization
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    // Fetch audit history
    const { data: auditHistory } = await supabase
      .from('audit_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    // Fetch user activity
    const { data: userActivity } = await supabase
      .from('user_activity')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    // Determine current scores and areas for improvement
    const currentScores = auditHistory && auditHistory.length > 0 ? {
      overall: auditHistory[0].overall_score,
      ai_understanding: auditHistory[0].ai_understanding,
      citation_likelihood: auditHistory[0].citation_likelihood,
      conversational_readiness: auditHistory[0].conversational_readiness,
      content_structure: auditHistory[0].content_structure
    } : {
      overall: 50,
      ai_understanding: 50,
      citation_likelihood: 50,
      conversational_readiness: 50,
      content_structure: 50
    };

    // Determine weakest areas
    const scoreEntries = Object.entries(currentScores).filter(([key]) => key !== 'overall');
    scoreEntries.sort((a, b) => a[1] - b[1]);
    const weakestAreas = scoreEntries.slice(0, 2).map(([key]) => key);

    // Determine tools already used
    const usedToolIds = new Set(
      userActivity
        ?.filter(a => a.activity_type === 'tool_used' && a.tool_id)
        .map(a => a.tool_id)
    );

    // Calculate target score
    const calculatedTargetScore = targetScore || Math.min(currentScores.overall + 15, 95);

    // Generate playbook steps based on focus area and current scores
    const steps: PlaybookStep[] = [];
    
    // Always start with an audit if not done recently
    if (!usedToolIds.has('audit') || !auditHistory || auditHistory.length === 0) {
      steps.push({
        id: 'initial-audit',
        title: 'Run Initial AI Visibility Audit',
        description: 'Establish your baseline scores and identify key improvement areas',
        toolId: 'audit',
        estimatedTime: '10 minutes',
        priority: 1
      });
    }

    // Add steps based on focus area
    if (focusArea === 'ai_understanding' || focusArea === 'overall') {
      steps.push({
        id: 'entity-analysis',
        title: 'Analyze Entity Coverage',
        description: 'Identify missing entities that should be mentioned in your content',
        toolId: 'entities',
        estimatedTime: '20 minutes',
        priority: weakestAreas.includes('ai_understanding') ? 2 : 3
      });
      
      steps.push({
        id: 'content-optimization',
        title: 'Optimize Content for AI Understanding',
        description: 'Improve content clarity and structure for better AI comprehension',
        toolId: 'optimizer',
        estimatedTime: '45 minutes',
        priority: weakestAreas.includes('ai_understanding') ? 2 : 4,
        dependsOn: ['entity-analysis']
      });
    }

    if (focusArea === 'citation_likelihood' || focusArea === 'overall') {
      steps.push({
        id: 'citation-tracking',
        title: 'Set Up Citation Tracking',
        description: 'Monitor when AI systems mention your content',
        toolId: 'citations',
        estimatedTime: '15 minutes',
        priority: 3
      });
      
      steps.push({
        id: 'generate-citable-content',
        title: 'Generate Highly Citable Content',
        description: 'Create content specifically designed for AI citation',
        toolId: 'generator',
        estimatedTime: '30 minutes',
        priority: weakestAreas.includes('citation_likelihood') ? 2 : 4
      });
    }

    if (focusArea === 'conversational_readiness' || focusArea === 'overall') {
      steps.push({
        id: 'voice-testing',
        title: 'Test Voice Assistant Responses',
        description: 'See how voice assistants respond to queries about your business',
        toolId: 'voice',
        estimatedTime: '20 minutes',
        priority: weakestAreas.includes('conversational_readiness') ? 2 : 3
      });
      
      steps.push({
        id: 'prompt-matching',
        title: 'Optimize for Prompt Patterns',
        description: 'Align content with how users ask AI systems questions',
        toolId: 'prompts',
        estimatedTime: '25 minutes',
        priority: weakestAreas.includes('conversational_readiness') ? 2 : 4
      });
    }

    if (focusArea === 'content_structure' || focusArea === 'overall') {
      steps.push({
        id: 'schema-generation',
        title: 'Generate Schema Markup',
        description: 'Add structured data to help AI systems understand your content',
        toolId: 'schema',
        estimatedTime: '30 minutes',
        priority: weakestAreas.includes('content_structure') ? 2 : 3
      });
      
      steps.push({
        id: 'site-summaries',
        title: 'Create LLM Site Summaries',
        description: 'Generate summaries that help AI systems understand your site',
        toolId: 'summaries',
        estimatedTime: '25 minutes',
        priority: weakestAreas.includes('content_structure') ? 2 : 4
      });
    }

    // Add competitive analysis for comprehensive playbooks
    if (timeframe === 'comprehensive' || (profile?.competitors && profile.competitors.length > 0)) {
      steps.push({
        id: 'competitive-analysis',
        title: 'Analyze Competitor AI Visibility',
        description: 'Compare your AI visibility against key competitors',
        toolId: 'competitive',
        estimatedTime: '35 minutes',
        priority: 5
      });
    }

    // Add final audit to verify improvements
    steps.push({
      id: 'verification-audit',
      title: 'Run Verification Audit',
      description: 'Confirm improvements and measure progress toward your goal',
      toolId: 'audit',
      estimatedTime: '10 minutes',
      priority: 10,
      dependsOn: steps.map(step => step.id).filter(id => id !== 'initial-audit')
    });

    // Adjust steps based on timeframe
    let filteredSteps = [...steps];
    if (timeframe === 'quick') {
      // For quick playbooks, only include highest priority steps
      filteredSteps = steps
        .filter(step => step.priority <= 3 || step.id === 'verification-audit')
        .slice(0, 4); // Limit to 4 steps including verification
      
      // Always include verification audit
      if (!filteredSteps.some(step => step.id === 'verification-audit')) {
        filteredSteps.push(steps.find(step => step.id === 'verification-audit')!);
      }
    }

    // Sort steps by priority
    filteredSteps.sort((a, b) => a.priority - b.priority);

    // Calculate total estimated time
    const totalMinutes = filteredSteps.reduce((total, step) => {
      const timeString = step.estimatedTime;
      const minutes = parseInt(timeString.match(/\d+/)?.[0] || '0');
      return total + minutes;
    }, 0);

    // Generate playbook title and description based on focus area
    const focusAreaReadable = focusArea.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const playbookTitle = focusArea === 'overall' 
      ? `Comprehensive AI Visibility Optimization` 
      : `${focusAreaReadable} Optimization Playbook`;
    
    const playbookDescription = focusArea === 'overall'
      ? `A personalized playbook to improve your overall AI visibility score to ${calculatedTargetScore}+`
      : `Focused optimization to improve your ${focusAreaReadable} score and overall AI visibility`;

    // Determine difficulty level
    const difficulty = timeframe === 'comprehensive' ? 'advanced' : 
                      timeframe === 'standard' ? 'intermediate' : 'beginner';

    const adaptivePlaybook: AdaptivePlaybook = {
      id: `${focusArea}-${timeframe}-${Date.now()}`,
      title: playbookTitle,
      description: playbookDescription,
      steps: filteredSteps,
      estimatedTimeMinutes: totalMinutes,
      targetScore: calculatedTargetScore,
      focusArea: focusAreaReadable,
      difficulty
    };

    return new Response(
      JSON.stringify({
        playbook: adaptivePlaybook,
        metadata: {
          userId,
          currentScores,
          weakestAreas,
          usedTools: Array.from(usedToolIds),
          generatedAt: new Date().toISOString()
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Adaptive playbook generation error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate adaptive playbook',
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});