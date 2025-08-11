import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// Self-contained CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

const reportViewerService = async (req: Request, supabase: SupabaseClient): Promise<Response> => {
    try {
        let reportId, format = 'html', download = false;

        if (req.method === 'GET') {
            const url = new URL(req.url);
            reportId = url.searchParams.get('reportId') || '';
            format = url.searchParams.get('format') || 'html';
            download = url.searchParams.get('download') === 'true';
        } else {
            const data = await req.json();
            reportId = data.reportId;
            format = data.format || 'html';
            download = data.download || false;
        }

        if (!reportId) throw new Error('Report ID is required');

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('Missing authorization header');

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) throw new Error(`Invalid authentication: ${authError?.message}`);

        const { data: report, error: reportError } = await supabase.from('reports').select('*').eq('id', reportId).eq('user_id', user.id).single();
        if (reportError || !report) throw new Error(`Report not found: ${reportError?.message}`);
        if (!report.file_url) throw new Error('Report file URL not found');

        const fileResponse = await fetch(report.file_url);
        if (!fileResponse.ok) throw new Error(`Failed to fetch report file: ${fileResponse.statusText}`);

        const fileContent = await fileResponse.text();

        const contentTypes = { html: 'text/html; charset=utf-8', csv: 'text/csv; charset=utf-8', json: 'application/json; charset=utf-8' };
        const contentType = contentTypes[format] || 'text/plain; charset=utf-8';
        const disposition = download ? 'attachment' : 'inline';
        const filename = `${report.report_name.replace(/\s+/g, '_')}.${format}`;

        return new Response(fileContent, {
            headers: {
                'Content-Type': contentType,
                'Content-Disposition': `${disposition}; filename="${filename}"`,
                ...corsHeaders
            }
        });

    } catch (err) {
        console.error('Report viewer error:', err.message);
        return new Response(JSON.stringify({ error: 'Failed to retrieve report', details: err.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    return await reportViewerService(req, supabase);
});
