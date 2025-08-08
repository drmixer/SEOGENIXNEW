import { serve } from 'std/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

async function logToolRun({
  projectId,
  toolName,
  params,
  createdBy
}: {
  projectId: string
  toolName: string
  params: any
  createdBy: string
}) {
  // Insert pending tool run
  const { data, error } = await supabase
    .from('tool_runs')
    .insert({
      project_id: projectId,
      tool_name: toolName,
      params,
      status: 'pending',
      created_by: createdBy,
      started_at: new Date().toISOString()
    })
    .select('id')
    .single()
  if (error || !data) throw new Error('Failed to log tool run: ' + (error?.message ?? ''))
  return data.id
}

async function updateToolRun({
  runId,
  output,
  provenance,
  status
}: {
  runId: string
  output: any
  provenance: any
  status: string
}) {
  await supabase
    .from('tool_runs')
    .update({
      output,
      provenance,
      status,
      completed_at: new Date().toISOString()
    })
    .eq('id', runId)
}

async function handler(req: Request) {
  try {
    // Auth context
    const authHeader = req.headers.get('Authorization') || ''
    const jwt = authHeader.replace('Bearer ', '')
    const supabaseUser = createClient(supabaseUrl, supabaseServiceRoleKey, { global: { headers: { Authorization: authHeader } } })
    const { data: { user } } = await supabaseUser.auth.getUser(jwt)
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

    // Parse payload
    const payload = await req.json()
    const {
      projectId,
      outputFormats = ['json'],
      ...auditParams // domain, depth, etc.
    } = payload

    if (!projectId) return new Response(JSON.stringify({ error: 'Missing projectId' }), { status: 400 })

    // 1. Insert tool_runs row (status: pending)
    const runId = await logToolRun({
      projectId,
      toolName: 'ai-visibility-audit',
      params: payload,
      createdBy: user.id
    })

    // 2. Run the existing audit logic (placeholder)
    // --- BEGIN AUDIT LOGIC ---
    // Simulate audit result, replace with your real logic
    const auditResult = {
      overall_score: 78,
      issues: [{ page: '/about', issue: 'Missing schema.org' }],
      details: { paramEcho: auditParams }
    }
    // (You can expand this audit logic with real crawling, API calls, etc.)
    // --- END AUDIT LOGIC ---

    // 3. Create provenance object (list data sources, timestamps, kind)
    const provenance = [
      { type: 'serp_snapshot', source: 'Google SERP API', timestamp: new Date().toISOString() }
      // Add more provenance items as needed (e.g., GSC, PageSpeed, etc.)
    ]

    // 4. Prepare output formats (for now: always JSON and, if requested, CSV)
    let csv = ''
    if (outputFormats.includes('csv')) {
      // Simple CSV conversion for demo; real version should handle all fields
      csv = 'page,issue\n' + auditResult.issues.map(i => `${i.page},${i.issue}`).join('\n')
    }

    const output = {
      ...auditResult,
      csv: csv || undefined
    }

    // 5. Update tool_runs row (status: completed, output, provenance)
    await updateToolRun({
      runId,
      output,
      provenance,
      status: 'completed'
    })

    // 6. Return result
    return new Response(JSON.stringify({ runId, output, provenance }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    })
  } catch (err: any) {
    // Update tool_runs row if possible
    if (typeof err?.runId === 'string') {
      await updateToolRun({
        runId: err.runId,
        output: { error: err?.message },
        provenance: [],
        status: 'failed'
      })
    }
    return new Response(JSON.stringify({ error: err?.message || 'Internal error' }), { status: 500 })
  }
}

serve(handler)