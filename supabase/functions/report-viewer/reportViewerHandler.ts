import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

export async function reportViewerHandler(
  supabase: SupabaseClient,
  req: Request
) {
  let reportId: string | null = null;
  let format = 'html';
  let download = false;

  if (req.method === 'GET') {
    const url = new URL(req.url);
    reportId = url.searchParams.get('reportId');
    format = url.searchParams.get('format') || 'html';
    download = url.searchParams.get('download') === 'true';
  } else {
    const data = await req.json();
    reportId = data.reportId;
    format = data.format || 'html';
    download = data.download || false;
  }

  if (!reportId) {
    return new Response(JSON.stringify({ error: 'Report ID is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid authentication' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const { data: report, error: reportError } = await supabase.from('reports').select('*').eq('id', reportId).eq('user_id', user.id).single();
  if (reportError || !report) {
    return new Response(JSON.stringify({ error: 'Report not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  if (!report.file_url) {
    return new Response(JSON.stringify({ error: 'Report file URL not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const fileResponse = await fetch(report.file_url);
  if (!fileResponse.ok) {
    throw new Error(`Failed to fetch report file: ${fileResponse.statusText}`);
  }

  const fileContent = await fileResponse.text();

  let contentType;
  switch (format) {
    case 'html': contentType = 'text/html; charset=utf-8'; break;
    case 'csv': contentType = 'text/csv; charset=utf-8'; break;
    case 'json': contentType = 'application/json; charset=utf-8'; break;
    default: contentType = 'text/plain; charset=utf-8';
  }

  const disposition = download ? 'attachment' : 'inline';
  const filename = `${report.report_name.replace(/\s+/g, '_')}.${format}`;

  return new Response(fileContent, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `${disposition}; filename="${filename}"`,
      ...corsHeaders
    }
  });
}
