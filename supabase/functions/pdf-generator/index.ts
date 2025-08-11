import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';
import puppeteer from "https://deno.land/x/puppeteer@16.2.0/mod.ts";
import chromium from "npm:@sparticuz/chromium@106.0.2";

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

    const browser = await puppeteer.launch({
        args: chromium.args,
        executablePath: await chromium.executablePath(),
        headless: true,
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: options.format || 'A4',
      landscape: options.landscape || false,
      margin: options.margin || { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' },
      printBackground: options.printBackground !== false,
      displayHeaderFooter: !!(options.headerTemplate || options.footerTemplate),
      headerTemplate: options.headerTemplate || '',
      footerTemplate: options.footerTemplate || ''
    });

    await browser.close();

    const pdfStoragePath = `reports/${report.user_id}/${reportId}.pdf`;
    const { error: uploadError } = await supabase.storage.from('reports').upload(pdfStoragePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
    });

    if (uploadError) {
        throw new Error(`Failed to upload PDF: ${uploadError.message}`);
    }

    const { data: urlData } = supabase.storage.from('reports').getPublicUrl(pdfStoragePath);
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
      message: 'PDF generated successfully',
      downloadUrl,
      reportId
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
