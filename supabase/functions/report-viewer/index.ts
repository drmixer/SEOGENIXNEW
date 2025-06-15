import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { serve } from 'npm:@hono/node-server';
import { Hono } from 'npm:hono';
import puppeteer from 'npm:puppeteer-core';
import chromium from 'npm:@sparticuz/chromium';

interface ReportViewRequest {
  reportId: string;
  format?: 'html' | 'csv' | 'json' | 'pdf';
  download?: boolean;
}

const app = new Hono();

// CORS middleware
app.use('*', async (c, next) => {
  if (c.req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  await next();
  Object.entries(corsHeaders).forEach(([key, value]) => {
    c.header(key, value);
  });
});

// Main report viewer endpoint
app.get('/', async (c) => {
  try {
    // Get parameters from query string
    const reportId = c.req.query('reportId');
    const format = (c.req.query('format') || 'html') as 'html' | 'csv' | 'json' | 'pdf';
    const download = c.req.query('download') === 'true';
    
    if (!reportId) {
      return c.json({ error: 'Report ID is required' }, 400);
    }

    // Get auth token from request header
    const authHeader = c.req.header('Authorization');
    if (!authHeader) {
      return c.json({ error: 'Missing authorization header' }, 401);
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
      return c.json({ 
        error: 'Invalid authentication', 
        details: authError?.message 
      }, 401);
    }

    // Get report metadata from database
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .eq('user_id', user.id) // Ensure the report belongs to the authenticated user
      .single();

    if (reportError || !report) {
      return c.json({ 
        error: 'Report not found', 
        details: reportError?.message 
      }, 404);
    }

    // Get the file URL from the report record
    if (!report.file_url) {
      return c.json({ error: 'Report file URL not found' }, 404);
    }

    // Fetch the file content directly
    const fileResponse = await fetch(report.file_url);
    
    if (!fileResponse.ok) {
      throw new Error(`Failed to fetch report file: ${fileResponse.statusText}`);
    }
    
    // Get the file content
    let fileContent = await fileResponse.text();
    
    // Set appropriate content type and disposition headers
    let contentType;
    let fileName;
    
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
        
        // Convert HTML to PDF using Puppeteer
        try {
          // Set up browser
          chromium.setHeadlessMode = true;
          const browser = await puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
          });
          
          const page = await browser.newPage();
          
          // Set content and wait for rendering
          await page.setContent(fileContent, { waitUntil: 'networkidle0' });
          
          // Generate PDF
          const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
              top: '1cm',
              right: '1cm',
              bottom: '1cm',
              left: '1cm'
            }
          });
          
          await browser.close();
          
          // Return PDF content
          c.header('Content-Type', contentType);
          c.header('Content-Disposition', `${download ? 'attachment' : 'inline'}; filename="${fileName}"`);
          c.header('Cache-Control', 'no-cache');
          
          return new Response(pdfBuffer);
        } catch (pdfError) {
          console.error('PDF generation error:', pdfError);
          return c.json({ 
            error: 'Failed to generate PDF', 
            details: pdfError.message 
          }, 500);
        }
        break;
      default:
        contentType = 'text/plain; charset=utf-8';
        fileName = `${report.report_name.replace(/\s+/g, '_')}.txt`;
    }
    
    // Return the file with proper headers
    c.header('Content-Type', contentType);
    c.header('Content-Disposition', `${download ? 'attachment' : 'inline'}; filename="${fileName}"`);
    c.header('Cache-Control', 'no-cache');
    
    return new Response(fileContent);
  } catch (error) {
    console.error('Report viewer error:', error);
    return c.json({ 
      error: 'Failed to retrieve report', 
      details: error.message 
    }, 500);
  }
});

Deno.serve(app.fetch);