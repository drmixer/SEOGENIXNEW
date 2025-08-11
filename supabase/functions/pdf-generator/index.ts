import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const pdfGeneratorService = async (req: Request, supabase: SupabaseClient): Promise<Response> => {
  try {
    const { reportId, html, options = {} } = await req.json();
    if (!reportId) {
      return new Response(JSON.stringify({ error: 'Report ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: report, error: reportError } = await supabase.from('reports').select('*').eq('id', reportId).single();
    if (reportError || !report) {
      return new Response(JSON.stringify({ error: 'Report not found', details: reportError?.message }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let htmlContent = html;
    if (!htmlContent) {
      const storagePath = `reports/${report.user_id}/${reportId}.html`;
      const { data: fileData, error: fileError } = await supabase.storage.from('reports').download(storagePath);
      if (fileError) {
        return new Response(JSON.stringify({ error: 'HTML report file not found', details: fileError.message }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      htmlContent = new TextDecoder().decode(fileData);
    }

    const pdfOptions = {
      format: options.format || 'A4',
      landscape: options.landscape || false,
      margin: options.margin || { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' },
      printBackground: options.printBackground !== false,
      displayHeaderFooter: !!(options.headerTemplate || options.footerTemplate),
      headerTemplate: options.headerTemplate || '',
      footerTemplate: options.footerTemplate || ''
    };

    const pdfStoragePath = `reports/${report.user_id}/${reportId}.pdf`;
    const { data: urlData } = await supabase.storage.from('reports').getPublicUrl(pdfStoragePath);
    const downloadUrl = urlData.publicUrl;

    await supabase.from('reports').update({
      file_url: downloadUrl,
      report_data: {
        ...report.report_data,
        pdfGenerated: true,
        pdfGeneratedAt: new Date().toISOString()
      }
    }).eq('id', reportId);

    return new Response(JSON.stringify({
      success: true,
      message: 'PDF generation simulated successfully',
      downloadUrl,
      reportId,
      options: pdfOptions,
      note: 'In a real implementation, this would generate a PDF using Puppeteer and upload it to Supabase Storage'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    return new Response(JSON.stringify({ error: 'Failed to generate PDF', details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  return await pdfGeneratorService(req, supabase);
});
