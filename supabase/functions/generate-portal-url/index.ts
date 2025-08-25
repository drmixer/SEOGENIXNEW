import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
};
// --- Database Logging Helpers ---
async function logToolRun(supabase, projectId, toolName, inputPayload) {
  if (!projectId) {
    throw new Error("logToolRun error: projectId is required.");
  }
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
    throw new Error(`Failed to log tool run. Supabase error: ${error.message}`);
  }
  if (!data || !data.id) {
    console.error("No data or data.id returned from tool_runs insert.");
    throw new Error("Failed to log tool run: No data returned after insert.");
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
  // CRITICAL FIX: Use the correct field name 'output_payload' not 'output'
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
const generatePortalUrlService = async (req, supabase)=>{
  let runId = null;
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');
    const projectId = url.searchParams.get('projectId'); // For logging
    if (!userId) {
      return new Response(JSON.stringify({
        success: false,
        error: {
          message: 'Missing userId parameter'
        }
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    if (!projectId) {
      return new Response(JSON.stringify({
        success: false,
        error: {
          message: 'Missing projectId parameter'
        }
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    runId = await logToolRun(supabase, projectId, 'generate-portal-url', {
      userId
    });
    console.log(`Fetching customer ID for user: ${userId}`);
    const { data: profile, error: profileError } = await supabase.from('user_profiles').select('lemonsqueezy_customer_id').eq('user_id', userId).single();
    if (profileError || !profile || !profile.lemonsqueezy_customer_id) {
      throw new Error('Lemon Squeezy customer ID not found for this user.');
    }
    const customerId = profile.lemonsqueezy_customer_id;
    const apiKey = Deno.env.get('LEMONSQUEEZY_API_KEY');
    if (!apiKey) throw new Error('Lemon Squeezy API key not configured');
    console.log(`Generating portal URL for customer: ${customerId}`);
    const lsResponse = await fetch(`https://api.lemonsqueezy.com/v1/customers/${customerId}/portal`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    });
    if (!lsResponse.ok) {
      const errorText = await lsResponse.text();
      throw new Error(`Lemon Squeezy API error: ${errorText}`);
    }
    const lsData = await lsResponse.json();
    const portalUrl = lsData.data.attributes.url;
    const output = {
      success: true,
      portalUrl
    };
    console.log('Portal URL generated successfully');
    await updateToolRun(supabase, runId, 'completed', output, null);
    return new Response(JSON.stringify({
      success: true,
      data: output,
      runId
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
    console.error('Generate portal URL error:', errorMessage);
    if (runId) {
      await updateToolRun(supabase, runId, 'error', null, errorMessage);
    }
    return new Response(JSON.stringify({
      success: false,
      error: {
        message: errorMessage
      },
      runId
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
};
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  return await generatePortalUrlService(req, supabase);
});
