import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

interface ReportViewRequest {
  reportId: string;
  format?: 'html' | 'csv' | 'json' | 'pdf';
  download?: boolean;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Get parameters from query string
    const url = new URL(req.url);
    const reportId = url.searchParams.get('reportId');
    const format = (url.searchParams.get('format') || 'html') as 'html' | 'csv' | 'json' | 'pdf';
    const download = url.searchParams.get('download') === 'true';
    
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

    // Initialize Supabase client using environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase environment variables:', {
        url: !!supabaseUrl,
        key: !!supabaseServiceKey,
        availableEnvVars: Object.keys(Deno.env.toObject())
      });
      return new Response(
        JSON.stringify({ 
          error: 'Supabase configuration missing',
          details: 'Environment variables not properly configured'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verify the user's token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid authentication', 
          details: authError?.message 
        }),
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
        JSON.stringify({ 
          error: 'Report not found', 
          details: reportError?.message 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Found report:', {
      id: report.id,
      type: report.report_type,
      name: report.report_name,
      storage_path: report.storage_path,
      file_url: report.file_url
    });

    // Use storage_path if available, otherwise fall back to file_url
    let fileContent: string | Uint8Array;
    
    if (report.storage_path) {
      console.log('Using storage path to download report:', report.storage_path);
      // Use Supabase's internal download method for better reliability
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('reports')
        .download(report.storage_path);
      
      if (downloadError) {
        console.error('Storage download error:', downloadError);
        throw new Error(`Failed to download report file: ${downloadError.message}`);
      }
      
      // Keep as blob/arrayBuffer for binary formats like PDF
      if (format === 'pdf') {
        fileContent = new Uint8Array(await fileData.arrayBuffer());
      } else {
        // Convert the blob to text for text-based formats
        fileContent = await fileData.text();
      }
    } else if (report.file_url) {
      console.log('Using public URL to fetch report:', report.file_url);
      // Fallback to public URL fetch
      const fileResponse = await fetch(report.file_url);
      
      if (!fileResponse.ok) {
        throw new Error(`Failed to fetch report file: ${fileResponse.statusText}`);
      }
      
      if (format === 'pdf') {
        fileContent = new Uint8Array(await fileResponse.arrayBuffer());
      } else {
        fileContent = await fileResponse.text();
      }
    } else {
      throw new Error('No file path or URL found for report');
    }
    
    // Set appropriate content type and disposition headers
    let contentType: string;
    let fileName: string;
    
    switch (format) {
      case 'html':
        contentType = 'text/html; charset=utf-8';
        fileName = `${report.report_name.replace(/\s+/g, '_')}.html`;
        break;
      case 'csv':
        contentType = 'text/csv; charset=utf-8';
        fileName = `${report.report_name.replace(/\s+/g, '_')}.csv`;
        break;
      case 'json':
        contentType = 'application/json; charset=utf-8';
        fileName = `${report.report_name.replace(/\s+/g, '_')}.json`;
        break;
      case 'pdf':
        contentType = 'application/pdf';
        fileName = `${report.report_name.replace(/\s+/g, '_')}.pdf`;
        break;
      default:
        contentType = 'text/plain; charset=utf-8';
        fileName = `${report.report_name.replace(/\s+/g, '_')}.txt`;
    }
    
    console.log('Serving report with content type:', contentType);
    
    // Return the file with proper headers
    const headers = {
      ...corsHeaders,
      'Content-Type': contentType,
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${fileName}"`,
      'Cache-Control': 'no-cache'
    };
    
    return new Response(fileContent, { headers });

  } catch (error) {
    console.error('Report viewer error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to retrieve report', 
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});