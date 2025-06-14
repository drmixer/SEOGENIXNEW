import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

interface ReportViewRequest {
  reportId: string;
  format?: 'html' | 'pdf';
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
    let format: 'html' | 'pdf' = 'html';
    let download = false;

    // Parse request based on method
    if (req.method === 'GET') {
      const url = new URL(req.url);
      reportId = url.searchParams.get('reportId') || '';
      format = (url.searchParams.get('format') || 'html') as 'html' | 'pdf';
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

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get report metadata from database
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .single();

    if (reportError || !report) {
      return new Response(
        JSON.stringify({ error: 'Report not found', details: reportError?.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the file from storage
    const storagePath = `reports/${report.user_id}/${reportId}.${format}`;
    
    // Check if the file exists
    const { data: fileData, error: fileError } = await supabase.storage
      .from('reports')
      .download(storagePath);

    if (fileError) {
      // If PDF is requested but doesn't exist, try to generate it from HTML
      if (format === 'pdf') {
        // Try to get the HTML version
        const htmlPath = `reports/${report.user_id}/${reportId}.html`;
        const { data: htmlData, error: htmlError } = await supabase.storage
          .from('reports')
          .download(htmlPath);

        if (htmlError) {
          return new Response(
            JSON.stringify({ error: 'Report file not found', details: htmlError.message }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Generate PDF from HTML (in a real implementation, this would use Puppeteer or similar)
        // For this example, we'll return a message about PDF generation
        return new Response(
          JSON.stringify({ 
            message: 'PDF generation would happen here', 
            note: 'In a real implementation, this would convert the HTML to PDF using Puppeteer or a similar tool'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Report file not found', details: fileError.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Set appropriate content type and disposition headers
    const contentType = format === 'html' ? 'text/html' : 'application/pdf';
    const disposition = download ? 'attachment' : 'inline';
    const filename = `${report.report_name.replace(/\s+/g, '_')}.${format}`;

    // Return the file with proper headers
    return new Response(fileData, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `${disposition}; filename="${filename}"`,
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