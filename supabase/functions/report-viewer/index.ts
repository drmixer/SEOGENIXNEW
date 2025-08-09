import { serve } from "https://deno.land/std@0.200.0/http/server.ts";
import { logToolRun } from 'shared/logToolRun.ts';
import { updateToolRun } from 'shared/updateToolRun.ts';

interface ReportViewRequest {
  reportId: string;
  format?: 'html' | 'csv' | 'json';
  download?: boolean;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Get report ID from URL or request body
    let reportId: string;
    let format: 'html' | 'csv' | 'json' = 'html';
    let download = false;

    // Parse request based on method
    if (req.method === 'GET') {
      const url = new URL(req.url);
      reportId = url.searchParams.get('reportId') || '';
      format = (url.searchParams.get('format') || 'html') as 'html' | 'csv' | 'json';
      download = url.searchParams.get('download') === 'true';
    } else {
      const data: ReportViewRequest = await req.json();
      reportId = data.reportId;
      format = data.format || 'html';
      download = data.download || false;
    }

    if (!reportId) {
      return new Response(
        JSON.stringify({ error: 'Report ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get auth token from request header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verify the user's token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication', details: authError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get report metadata from database
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .eq('user_id', user.id) // Ensure the report belongs to the authenticated user
      .single();

    if (reportError || !report) {
      return new Response(
        JSON.stringify({ error: 'Report not found', details: reportError?.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the file URL from the report record
    if (!report.file_url) {
      return new Response(
        JSON.stringify({ error: 'Report file URL not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the file content directly
    const fileResponse = await fetch(report.file_url);
    
    if (!fileResponse.ok) {
      throw new Error(`Failed to fetch report file: ${fileResponse.statusText}`);
    }
    
    const fileContent = await fileResponse.text();
    
    // Set appropriate content type and disposition headers
    let contentType;
    switch (format) {
      case 'html':
        contentType = 'text/html; charset=utf-8';
        break;
      case 'csv':
        contentType = 'text/csv; charset=utf-8';
        break;
      case 'json':
        contentType = 'application/json; charset=utf-8';
        break;
      default:
        contentType = 'text/plain; charset=utf-8';
    }
    
    const disposition = download ? 'attachment' : 'inline';
    const filename = `${report.report_name.replace(/\s+/g, '_')}.${format}`;
    
    // Return the file with proper headers
    return new Response(fileContent, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `${disposition}; filename="${filename}"`,
        'Cache-Control': 'no-cache',
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error('Report viewer error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to retrieve report', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});