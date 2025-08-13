import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- SHARED: CORS Headers ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- SHARED: Response Helpers ---
function createErrorResponse(message: string, status = 500, details?: any) {
  return new Response(JSON.stringify({
    success: false,
    error: {
      message,
      details: details || undefined,
    }
  }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function createSuccessResponse(data: object, status = 200) {
  return new Response(JSON.stringify({
    success: true,
    data,
  }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// --- SHARED: Service Handler ---
async function serviceHandler(req: Request, toolLogic: Function) {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    const supabaseAdminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return createErrorResponse('Missing Authorization header', 401);
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
        return createErrorResponse('Invalid or expired token', 401);
    }

    return await toolLogic(req, { user, supabaseClient, supabaseAdminClient });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unknown server error occurred.';
    console.error(`[ServiceHandler Error]`, err);
    return createErrorResponse(errorMessage, 500, err instanceof Error ? err.stack : undefined);
  }
}

// --- SHARED: Database Logging Helpers ---
async function logToolRun(supabase: SupabaseClient, projectId: string, toolName: string, inputPayload: object) {
  if (!projectId) throw new Error("logToolRun error: projectId is required.");
  const { data, error } = await supabase.from("tool_runs").insert({ project_id: projectId, tool_name: toolName, input_payload: inputPayload, status: "running" }).select("id").single();
  if (error) {
    console.error("Error logging tool run:", error);
    throw new Error(`Failed to log tool run. Supabase error: ${error.message}`);
  }
  if (!data || !data.id) {
    console.error("No data or data.id returned from tool_runs insert.");
    throw new Error("Failed to log tool run: No data returned after insert.");
  }
  return data.id;
}

async function updateToolRun(supabase: SupabaseClient, runId: string, status: string, outputPayload: object | null, errorMessage: string | null) {
  if (!runId) {
    console.error("updateToolRun error: runId is required.");
    return;
  }
  const update = { status, completed_at: new Date().toISOString(), output_payload: errorMessage ? { error: errorMessage } : outputPayload || null, error_message: errorMessage || null };
  const { error } = await supabase.from("tool_runs").update(update).eq("id", runId);
  if (error) console.error(`Error updating tool run ID ${runId}:`, error);
}

// --- TOOL-SPECIFIC: Type Definitions ---
interface AnomalyRequest {
    projectId: string;
    sensitivity?: 'low' | 'medium' | 'high';
    timeframe?: '7d' | '30d' | '90d';
}

// --- TOOL-SPECIFIC: Main Logic ---
const anomalyDetectionToolLogic = async (req: Request, { user, supabaseClient, supabaseAdminClient }: { user: any, supabaseClient: SupabaseClient, supabaseAdminClient: SupabaseClient }) => {
  let runId: string | null = null;
  try {
    const { projectId, sensitivity = 'medium' }: AnomalyRequest = await req.json();

    if (!projectId) {
      throw new Error('`projectId` is required.');
    }
    console.log(`Anomaly detection request for project ${projectId}`);

    const { data: project, error: projectError } = await supabaseClient.from('projects').select('id').eq('id', projectId).single();
    if (projectError || !project) {
        throw new Error(`Access denied or project not found for id: ${projectId}`);
    }

    runId = await logToolRun(supabaseAdminClient, projectId, 'anomaly-detection', { sensitivity });
    console.log(`Tool run logged with ID: ${runId}`);

    const { data: auditHistory, error: auditError } = await supabaseClient
      .from('audit_history')
      .select('overall_score, created_at')
      .eq('user_id', user.id)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(10); // Limit to last 10 audits for performance

    if (auditError) throw new Error(`Failed to fetch audit history: ${auditError.message}`);

    const { data: userActivity, error: activityError } = await supabaseClient
      .from('user_activity')
      .select('activity_type, created_at')
      .eq('user_id', user.id)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(1); // Only need the last activity

    if (activityError) throw new Error(`Failed to fetch user activity: ${activityError.message}`);

    const thresholds = {
        scoreDrop: sensitivity === 'low' ? 20 : (sensitivity === 'medium' ? 15 : 10),
        activityGap: sensitivity === 'low' ? 14 : (sensitivity === 'medium' ? 7 : 3),
    };

    const anomalies: object[] = [];

    // Check for significant score drops
    if (auditHistory && auditHistory.length >= 2) {
        const latestScore = auditHistory[0].overall_score;
        const previousScore = auditHistory[1].overall_score;
        const scoreDiff = latestScore - previousScore;

        if (scoreDiff <= -thresholds.scoreDrop) {
            anomalies.push({
                id: `score_drop_${new Date(auditHistory[0].created_at).toISOString().split('T')[0]}`,
                type: 'score_drop',
                title: 'Significant Score Drop Detected',
                description: `Your AI visibility score dropped by ${Math.abs(scoreDiff)} points between your last two audits.`,
                severity: 'high',
                data: { current: latestScore, previous: previousScore }
            });
        }
    }

    // Check for user inactivity
    if (userActivity && userActivity.length > 0) {
        const lastActivityDate = new Date(userActivity[0].created_at);
        const daysSinceLastActivity = (Date.now() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24);

        if (daysSinceLastActivity > thresholds.activityGap) {
            anomalies.push({
                id: `inactivity_${new Date().toISOString().split('T')[0]}`,
                type: 'inactivity',
                title: 'Unusual Inactivity Detected',
                description: `You haven't used any optimization tools in over ${Math.floor(daysSinceLastActivity)} days.`,
                severity: 'medium',
                data: { days: Math.floor(daysSinceLastActivity) }
            });
        }
    }

    if (anomalies.length === 0) {
        anomalies.push({
            id: `no_anomalies_${new Date().toISOString().split('T')[0]}`,
            type: 'no_anomalies',
            title: 'All Clear!',
            description: 'We haven\'t detected any significant anomalies in your project recently. Keep up the great work!',
            severity: 'low'
        });
    }

    const output = { anomalies };

    await updateToolRun(supabaseAdminClient, runId, 'completed', output, null);
    console.log('Anomaly detection complete.');
    return createSuccessResponse({ runId, ...output });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
    console.error('Anomaly detection error:', err);
    if (runId) {
      await updateToolRun(supabaseAdminClient, runId, 'error', null, errorMessage);
    }
    return createErrorResponse(errorMessage, 500, err instanceof Error ? err.stack : undefined);
  }
};

// --- Server ---
Deno.serve((req) => serviceHandler(req, anomalyDetectionToolLogic));
