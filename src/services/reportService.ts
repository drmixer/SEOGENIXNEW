import { supabase } from '../lib/supabase';

export interface ReportOptions {
  format?: 'html' | 'csv' | 'json';
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
   * View a report in the browser (HTML) or download it
   */
  async viewReport(reportId: string, format: 'html' | 'csv' | 'json' = 'html', download: boolean = false): Promise<string> {
    try {
      // Get auth token for API calls
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Authentication required');
      }

      // Create the viewer URL with proper authentication
      const viewerUrl = `${API_URL}/report-viewer?reportId=${reportId}&format=${format}&download=${download}`;
      
      // For security, we'll create a server-side proxy request with proper auth
      const response = await fetch(viewerUrl, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to access report: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      
      if (download) {
        // For downloads, create a temporary link and click it
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = `report_${reportId.substring(0, 8)}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        // For viewing, open in a new tab
        window.open(objectUrl, '_blank');
      }
      
      // Clean up the object URL after a delay
      setTimeout(() => URL.revokeObjectURL(objectUrl), 100);
      
      return viewerUrl;
    } catch (error) {
      console.error('Report viewing error:', error);
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