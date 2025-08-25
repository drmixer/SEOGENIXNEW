import { createClient } from 'npm:@supabase/supabase-js@2';
import puppeteer from "https://deno.land/x/puppeteer@16.2.0/mod.ts";
import chromium from "npm:@sparticuz/chromium@106.0.2";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
// --- Database Logging Helpers ---
async function logToolRun(supabase, projectId, toolName, inputPayload) {
  if (!projectId) {
    throw new Error("logToolRun error: projectId is required.");
  }
  console.log(`Logging tool run: ${toolName} for project: ${projectId}`);
  const { data, error } = await supabase.from("tool_runs").insert({
    project_id: projectId,
    tool_name: toolName,
    input_payload: inputPayload,
    status: "running",
    created_at: new Date().toISOString()
  }).select("id").single();
  if (error) {
    console.error("Error logging tool run:", error);
    throw new Error(`Failed to log tool run. Supabase error: ${error.message}`);
  }
  if (!data || !data.id) {
    console.error("No data or data.id returned from tool_runs insert.");
    throw new Error("Failed to log tool run: No data returned after insert.");
  }
  console.log(`Tool run logged with ID: ${data.id}`);
  return data.id;
}
async function updateToolRun(supabase, runId, status, outputPayload, errorMessage) {
  if (!runId) {
    console.error("updateToolRun error: runId is required.");
    return;
  }
  console.log(`Updating tool run ${runId} with status: ${status}`);
  // CRITICAL FIX: Use the correct field name 'output_payload' not 'output'
  const update = {
    status,
    completed_at: new Date().toISOString(),
    output_payload: errorMessage ? {
      error: errorMessage
    } : outputPayload || null,
    error_message: errorMessage || null
  };
  const { error } = await supabase.from("tool_runs").update(update).eq("id", runId);
  if (error) {
    console.error(`Error updating tool run ID ${runId}:`, error);
  } else {
    console.log(`Tool run ${runId} updated successfully`);
  }
}
const pdfGeneratorService = async (req, supabase)=>{
  let runId = null;
  try {
    const { reportId, html, options = {}, projectId } = await req.json();
    if (!reportId) {
      return new Response(JSON.stringify({
        success: false,
        error: {
          message: 'Report ID is required'
        }
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Log tool run if projectId is provided
    if (projectId) {
      runId = await logToolRun(supabase, projectId, 'pdf-generator', {
        reportId,
        hasCustomHtml: !!html,
        options
      });
    }
    console.log(`Generating PDF for report: ${reportId}`);
    const { data: report, error: reportError } = await supabase.from('reports').select('*').eq('id', reportId).single();
    if (reportError || !report) {
      throw new Error(`Report not found: ${reportError?.message || 'Report does not exist'}`);
    }
    let htmlContent = html;
    if (!htmlContent) {
      console.log('Fetching HTML content from storage...');
      const storagePath = `reports/${report.user_id}/${reportId}.html`;
      const { data: fileData, error: fileError } = await supabase.storage.from('reports').download(storagePath);
      if (fileError) {
        throw new Error(`HTML report file not found: ${fileError.message}`);
      }
      htmlContent = new TextDecoder().decode(fileData);
    }
    if (!htmlContent || htmlContent.trim().length === 0) {
      throw new Error('No HTML content available for PDF generation');
    }
    console.log('Launching Puppeteer for PDF generation...');
    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true
    });
    const page = await browser.newPage();
    await page.setContent(htmlContent, {
      waitUntil: 'networkidle0'
    });
    console.log('Generating PDF...');
    const pdfBuffer = await page.pdf({
      format: options.format || 'A4',
      landscape: options.landscape || false,
      margin: options.margin || {
        top: '1cm',
        right: '1cm',
        bottom: '1cm',
        left: '1cm'
      },
      printBackground: options.printBackground !== false,
      displayHeaderFooter: !!(options.headerTemplate || options.footerTemplate),
      headerTemplate: options.headerTemplate || '',
      footerTemplate: options.footerTemplate || ''
    });
    await browser.close();
    console.log('PDF generated successfully, uploading to storage...');
    const pdfStoragePath = `reports/${report.user_id}/${reportId}.pdf`;
    const { error: uploadError } = await supabase.storage.from('reports').upload(pdfStoragePath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true
    });
    if (uploadError) {
      throw new Error(`Failed to upload PDF: ${uploadError.message}`);
    }
    const { data: urlData } = supabase.storage.from('reports').getPublicUrl(pdfStoragePath);
    const downloadUrl = urlData.publicUrl;
    console.log('Updating report metadata...');
    const { error: updateError } = await supabase.from('reports').update({
      file_url: downloadUrl,
      report_data: {
        ...report.report_data,
        pdfGenerated: true,
        pdfGeneratedAt: new Date().toISOString()
      }
    }).eq('id', reportId);
    if (updateError) {
      console.error('Error updating report metadata:', updateError);
    // Continue anyway, as the PDF was generated successfully
    }
    const output = {
      success: true,
      message: 'PDF generated successfully',
      downloadUrl,
      reportId,
      pdfSize: pdfBuffer.length,
      generatedAt: new Date().toISOString()
    };
    if (runId) {
      await updateToolRun(supabase, runId, 'completed', output, null);
    }
    console.log('PDF generation process completed successfully');
    return new Response(JSON.stringify({
      success: true,
      data: output,
      runId
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    console.error('PDF generation error:', errorMessage);
    if (runId) {
      await updateToolRun(supabase, runId, 'error', null, errorMessage);
    }
    return new Response(JSON.stringify({
      success: false,
      error: {
        message: errorMessage
      },
      runId
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
};
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }
  const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
  return await pdfGeneratorService(req, supabase);
});

