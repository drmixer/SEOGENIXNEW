import { supabase } from '../lib/supabase';

export interface ReportOptions {
  format?: 'html' | 'csv' | 'json' | 'pdf';
  includeRecommendations?: boolean;
  includeCharts?: boolean;
  includeHistory?: boolean;
  includeROI?: boolean;
  includeCompetitorBenchmarks?: boolean;
  brandingOptions?: {
    includeLogo?: boolean;
    customColors?: boolean;
    companyName?: string;
    footerText?: string;
  };
}

export interface GeneratedReport {
  id: string;
  name: string;
  type: string;
  format: string;
  downloadUrl: string;
  createdAt: string;
}

const API_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export const reportService = {
  /**
   * Generate a report with the specified options
   */
  async generateReport(
    reportType: string,
    reportName: string,
    data: any,
    options: ReportOptions
  ): Promise<GeneratedReport> {
    try {
      // Get auth token for API calls
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Authentication required');
      }

      // Call the generate-report function
      const response = await fetch(`${API_URL}/generate-report`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reportType,
          reportName,
          reportData: data,
          format: options.format || 'html',
          config: options
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate report');
      }

      const result = await response.json();
      return {
        id: result.reportId,
        name: reportName,
        type: reportType,
        format: options.format || 'html',
        downloadUrl: result.downloadUrl,
        createdAt: result.generatedAt
      };
    } catch (error) {
      console.error('Report generation error:', error);
      throw error;
    }
  },

  /**
   * View a report in the browser (HTML) or download it (PDF)
   */
  async viewReport(reportId: string, format: 'html' | 'pdf' = 'html', download: boolean = false): Promise<string> {
    try {
      // Get auth token for API calls
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Authentication required');
      }

      // Generate a URL to the report-viewer function
      const viewerUrl = `${API_URL}/report-viewer?reportId=${reportId}&format=${format}&download=${download}`;
      
      // For HTML viewing in the browser, we can just return the URL
      if (format === 'html' && !download) {
        // Open in a new tab
        window.open(viewerUrl, '_blank');
        return viewerUrl;
      }
      
      // For PDF or downloads, we need to handle it differently
      // Redirect to the URL which will trigger the download
      window.location.href = viewerUrl;
      return viewerUrl;
    } catch (error) {
      console.error('Report viewing error:', error);
      throw error;
    }
  },

  /**
   * Generate a PDF from an HTML report
   */
  async generatePDF(reportId: string, options?: any): Promise<string> {
    try {
      // Get auth token for API calls
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Authentication required');
      }

      // Call the pdf-generator function
      const response = await fetch(`${API_URL}/pdf-generator`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reportId,
          options: options || {
            format: 'A4',
            landscape: false,
            margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' },
            printBackground: true
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate PDF');
      }

      const result = await response.json();
      return result.downloadUrl;
    } catch (error) {
      console.error('PDF generation error:', error);
      throw error;
    }
  },

  /**
   * Get all reports for the current user
   */
  async getUserReports(): Promise<GeneratedReport[]> {
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(report => ({
        id: report.id,
        name: report.report_name,
        type: report.report_type,
        format: report.report_data?.format || 'html',
        downloadUrl: report.file_url || '',
        createdAt: report.created_at
      }));
    } catch (error) {
      console.error('Error fetching user reports:', error);
      throw error;
    }
  },

  /**
   * Delete a report
   */
  async deleteReport(reportId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('reports')
        .delete()
        .eq('id', reportId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting report:', error);
      throw error;
    }
  }
};