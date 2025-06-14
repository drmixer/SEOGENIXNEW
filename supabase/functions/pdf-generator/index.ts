import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import puppeteer from 'npm:puppeteer-core@21.5.2';

interface PDFGenerationRequest {
  reportId: string;
  html?: string;
  options?: {
    format?: 'A4' | 'Letter';
    landscape?: boolean;
    margin?: {
      top?: string;
      right?: string;
      bottom?: string;
      left?: string;
    };
    printBackground?: boolean;
    headerTemplate?: string;
    footerTemplate?: string;
  };
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { reportId, html, options = {} }: PDFGenerationRequest = await req.json();

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

    // Get HTML content - either from request or from storage
    let htmlContent = html;
    
    if (!htmlContent) {
      const storagePath = `reports/${report.user_id}/${reportId}.html`;
      const { data: fileData, error: fileError } = await supabase.storage
        .from('reports')
        .download(storagePath);

      if (fileError) {
        return new Response(
          JSON.stringify({ error: 'HTML report file not found', details: fileError.message }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Convert ArrayBuffer to string
      htmlContent = new TextDecoder().decode(fileData);
    }

    // In a real implementation, we would use Puppeteer to generate the PDF
    // For this example, we'll simulate the PDF generation process
    
    // Note: In a real implementation, you would:
    // 1. Launch a headless browser with Puppeteer
    // 2. Create a new page and set the HTML content
    // 3. Generate the PDF with the specified options
    // 4. Upload the PDF to Supabase Storage
    // 5. Return the download URL

    // Simulate PDF generation
    const pdfOptions = {
      format: options.format || 'A4',
      landscape: options.landscape || false,
      margin: options.margin || { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' },
      printBackground: options.printBackground !== false,
      displayHeaderFooter: !!(options.headerTemplate || options.footerTemplate),
      headerTemplate: options.headerTemplate || '',
      footerTemplate: options.footerTemplate || '',
    };

    // Simulate PDF generation success
    const pdfStoragePath = `reports/${report.user_id}/${reportId}.pdf`;
    
    // In a real implementation, we would upload the generated PDF to Supabase Storage
    // For this example, we'll simulate a successful upload
    
    // Generate a download URL
    const { data: urlData } = await supabase.storage
      .from('reports')
      .getPublicUrl(pdfStoragePath);
    
    const downloadUrl = urlData.publicUrl;

    // Update the report record with the PDF URL
    await supabase
      .from('reports')
      .update({
        file_url: downloadUrl,
        report_data: {
          ...report.report_data,
          pdfGenerated: true,
          pdfGeneratedAt: new Date().toISOString()
        }
      })
      .eq('id', reportId);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'PDF generation simulated successfully',
        downloadUrl,
        reportId,
        options: pdfOptions,
        note: 'In a real implementation, this would generate a PDF using Puppeteer and upload it to Supabase Storage'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('PDF generation error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate PDF', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});