import { serve } from "https://deno.land/std@0.200.0/http/server.ts";
import cronParser from "https://esm.sh/cron-parser@4.1.0";
import { logToolRun } from 'shared/logToolRun.ts';
import { updateToolRun } from 'shared/updateToolRun.ts';

serve(async (_req: Request) => {
  const { data: dueSchedules, error } = await supabase
    .from('schedules')
    .select('*')
    .eq('enabled', true)
    .lte('next_run_at', new Date().toISOString());

  if (error) {
    console.error('Error fetching schedules:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const results = [];
  for (const sch of dueSchedules) {
    const url = `${Deno.env.get('SUPABASE_FUNCTIONS_URL')}/${sch.tool_name}`;
    let invoked = false;
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: sch.project_id, input: {} }),
      });
      invoked = true;
    } catch (e) {
      console.error(`Failed to invoke ${sch.tool_name}:`, e);
    }
    const interval = cronParser.parseExpression(sch.cron_expression, { currentDate: new Date() });
    const next = interval.next().toISOString();

    await supabase
      .from('schedules')
      .update({ last_run_at: new Date().toISOString(), next_run_at: next })
      .eq('id', sch.id);

    results.push({ scheduleId: sch.id, invoked, nextRunAt: next });
  }

  return new Response(JSON.stringify({ results }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
