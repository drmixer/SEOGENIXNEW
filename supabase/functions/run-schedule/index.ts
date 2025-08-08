import { serve } from 'std/server';
import { supabase } from '../../utils/supabaseClient';
import cronParser from 'cron-parser';

const SUPABASE_FUNCTIONS_URL = process.env.SUPABASE_FUNCTIONS_URL;

serve(async (req) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // 1. Fetch schedules that are enabled and due to run
  const { data: schedules, error } = await supabase
    .from('schedules')
    .select('*')
    .eq('enabled', true)
    .lte('next_run_at', new Date().toISOString());

  if (error) {
    console.error('Error fetching schedules:', error);
    return new Response('Internal Server Error', { status: 500 });
  }

  const results: any[] = [];

  for (const schedule of schedules || []) {
    const { id, project_id, tool_name, cron_expression } = schedule;

    try {
      // 2. Call internal function endpoint for this tool
      const functionUrl = `${SUPABASE_FUNCTIONS_URL}/${tool_name}`;
      const resp = await fetch(functionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project_id, input: {} }),
      });

      const output = await resp.json();

      // 3. Calculate next_run_at using cron expression
      let nextRunAt: string | null = null;
      try {
        const interval = cronParser.parseExpression(cron_expression, { currentDate: new Date() });
        nextRunAt = interval.next().toISOString();
      } catch (cronErr) {
        console.error('Failed to parse cron expression:', cronErr);
        nextRunAt = null;
      }

      // 4. Update schedule row with last_run_at and next_run_at
      await supabase
        .from('schedules')
        .update({
          last_run_at: new Date().toISOString(),
          next_run_at: nextRunAt,
        })
        .eq('id', id);

      results.push({ scheduleId: id, runInvoked: true, nextRunAt });
    } catch (err: any) {
      console.error('Error running scheduled tool:', err);
      results.push({ scheduleId: id, runInvoked: false, error: err.message ?? String(err) });
    }
  }

  return Response.json({ results });
});