import { supabase } from '../lib/supabase';

export interface UserProfile {
  id: string;
  user_id: string;
  websites: Array<{ url: string; name: string }>;
  competitors: Array<{ url: string; name: string }>;
  industry?: string;
  business_description?: string;
  plan: 'free' | 'core' | 'pro' | 'agency';
  onboarding_completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface AuditHistoryEntry {
  id: string;
  user_id: string;
  website_url: string;
  overall_score: number;
  ai_understanding: number;
  citation_likelihood: number;
  conversational_readiness: number;
  content_structure: number;
  recommendations: string[];
  issues: string[];
  audit_data: any;
  created_at: string;
}

export interface UserActivity {
  id: string;
  user_id: string;
  activity_type: string;
  activity_data: any;
  tool_id?: string;
  website_url?: string;
  created_at: string;
}

export interface Report {
  id: string;
  user_id: string;
  report_type: string;
  report_name: string;
  report_data: any;
  file_url?: string;
  created_at: string;
}

export const userDataService = {
  // User Profile Management
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching user profile:', error);
      return null;
    }

    return data;
  },

  async createUserProfile(profile: Partial<UserProfile>): Promise<UserProfile | null> {
    const { data, error } = await supabase
      .from('user_profiles')
      .insert(profile)
      .select()
      .single();

    if (error) {
      console.error('Error creating user profile:', error);
      return null;
    }

    return data;
  },

  async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile | null> {
    const { data, error } = await supabase
      .from('user_profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating user profile:', error);
      return null;
    }

    return data;
  },

  // Audit History Management
  async saveAuditResult(auditResult: Partial<AuditHistoryEntry>): Promise<AuditHistoryEntry | null> {
    const { data, error } = await supabase
      .from('audit_history')
      .insert(auditResult)
      .select()
      .single();

    if (error) {
      console.error('Error saving audit result:', error);
      return null;
    }

    return data;
  },

  async getAuditHistory(userId: string, limit = 50): Promise<AuditHistoryEntry[]> {
    const { data, error } = await supabase
      .from('audit_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching audit history:', error);
      return [];
    }

    return data || [];
  },

  async getAuditHistoryForWebsite(userId: string, websiteUrl: string, limit = 20): Promise<AuditHistoryEntry[]> {
    const { data, error } = await supabase
      .from('audit_history')
      .select('*')
      .eq('user_id', userId)
      .eq('website_url', websiteUrl)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching website audit history:', error);
      return [];
    }

    return data || [];
  },

  // User Activity Tracking
  async trackActivity(activity: Partial<UserActivity>): Promise<void> {
    const { error } = await supabase
      .from('user_activity')
      .insert(activity);

    if (error) {
      console.error('Error tracking user activity:', error);
    }
  },

  async getRecentActivity(userId: string, limit = 20): Promise<UserActivity[]> {
    const { data, error } = await supabase
      .from('user_activity')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching user activity:', error);
      return [];
    }

    return data || [];
  },

  // Reports Management
  async saveReport(report: Partial<Report>): Promise<Report | null> {
    const { data, error } = await supabase
      .from('reports')
      .insert(report)
      .select()
      .single();

    if (error) {
      console.error('Error saving report:', error);
      return null;
    }

    return data;
  },

  async getUserReports(userId: string): Promise<Report[]> {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user reports:', error);
      return [];
    }

    return data || [];
  },

  async deleteReport(reportId: string): Promise<boolean> {
    const { error } = await supabase
      .from('reports')
      .delete()
      .eq('id', reportId);

    if (error) {
      console.error('Error deleting report:', error);
      return false;
    }

    return true;
  }
};