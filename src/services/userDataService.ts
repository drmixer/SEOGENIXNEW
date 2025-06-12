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

export interface WhiteLabelSettings {
  id: string;
  user_id: string;
  custom_logo_url?: string;
  primary_color_hex: string;
  secondary_color_hex: string;
  accent_color_hex: string;
  custom_domain?: string;
  company_name?: string;
  favicon_url?: string;
  custom_css?: string;
  footer_text?: string;
  created_at: string;
  updated_at: string;
}

export interface CMSIntegration {
  id: string;
  user_id: string;
  cms_type: string;
  cms_name: string;
  site_url: string;
  status: 'connected' | 'disconnected' | 'error';
  credentials: any;
  settings: any;
  last_sync_at?: string;
  created_at: string;
  updated_at: string;
}

export interface SavedCitationPrompt {
  id: string;
  user_id: string;
  domain: string;
  keywords: string[];
  prompt_text?: string;
  created_at: string;
}

export interface FingerprintPhrase {
  id: string;
  user_id: string;
  phrase: string;
  description?: string;
  created_at: string;
}

// Cache for user profiles to reduce database calls
const profileCache = new Map<string, {profile: UserProfile, timestamp: number}>();
const CACHE_TTL = 60000; // 1 minute cache TTL

export const userDataService = {
  // User Profile Management
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      console.log('Fetching user profile for userId:', userId);
      
      // Check cache first
      const cachedData = profileCache.get(userId);
      if (cachedData && (Date.now() - cachedData.timestamp < CACHE_TTL)) {
        console.log('Returning cached profile for user:', userId);
        return cachedData.profile;
      }
      
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error fetching user profile:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        console.log('No profile found for user:', userId);
        return null;
      }

      console.log('Successfully fetched user profile:', data[0]);
      
      // Cache the result
      profileCache.set(userId, {
        profile: data[0],
        timestamp: Date.now()
      });
      
      return data[0];
    } catch (error) {
      console.error('Error in getUserProfile:', error);
      throw error; // Re-throw to allow caller to handle
    }
  },

  async createUserProfile(profile: Partial<UserProfile>): Promise<UserProfile | null> {
    try {
      console.log('Creating user profile:', profile);
      
      // First check if a profile already exists
      const { data: existingProfiles } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', profile.user_id as string);
        
      if (existingProfiles && existingProfiles.length > 0) {
        console.log('Profile already exists, updating instead of creating');
        return this.updateUserProfile(profile.user_id as string, profile);
      }
      
      const { data, error } = await supabase
        .from('user_profiles')
        .insert(profile)
        .select()
        .single();

      if (error) {
        console.error('Error creating user profile:', error);
        throw error;
      }

      console.log('Successfully created user profile:', data);
      
      // Update cache
      profileCache.set(profile.user_id as string, {
        profile: data,
        timestamp: Date.now()
      });
      
      return data;
    } catch (error) {
      console.error('Error in createUserProfile:', error);
      throw error;
    }
  },

  async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile | null> {
    try {
      console.log('Updating user profile for userId:', userId, 'with updates:', updates);
      
      // Get the profile ID first
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);
        
      if (!profiles || profiles.length === 0) {
        console.log('No profile found to update, creating new one');
        return this.createUserProfile({ user_id: userId, ...updates });
      }
      
      const profileId = profiles[0].id;
      
      const { data, error } = await supabase
        .from('user_profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', profileId)
        .select()
        .single();

      if (error) {
        console.error('Error updating user profile:', error);
        throw error;
      }

      console.log('Successfully updated user profile:', data);
      
      // Update cache
      profileCache.set(userId, {
        profile: data,
        timestamp: Date.now()
      });
      
      return data;
    } catch (error) {
      console.error('Error in updateUserProfile:', error);
      throw error;
    }
  },

  // White-label Settings
  async getWhiteLabelSettings(userId: string): Promise<WhiteLabelSettings | null> {
    try {
      const { data, error } = await supabase
        .from('white_label_settings')
        .select('*')
        .eq('user_id', userId)
        .limit(1);

      if (error) {
        throw error;
      }

      // Return null if no settings found, otherwise return the first result
      return data && data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error('Error fetching white-label settings:', error);
      return null;
    }
  },

  async updateWhiteLabelSettings(userId: string, settings: Partial<WhiteLabelSettings>): Promise<WhiteLabelSettings | null> {
    try {
      const { data, error } = await supabase
        .from('white_label_settings')
        .upsert({
          user_id: userId,
          ...settings,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating white-label settings:', error);
      return null;
    }
  },

  // CMS Integrations
  async getCMSIntegrations(userId: string): Promise<CMSIntegration[]> {
    try {
      const { data, error } = await supabase
        .from('cms_integrations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching CMS integrations:', error);
      return [];
    }
  },

  async createCMSIntegration(integration: Partial<CMSIntegration>): Promise<CMSIntegration | null> {
    try {
      const { data, error } = await supabase
        .from('cms_integrations')
        .insert(integration)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating CMS integration:', error);
      return null;
    }
  },

  async updateCMSIntegration(integrationId: string, updates: Partial<CMSIntegration>): Promise<CMSIntegration | null> {
    try {
      const { data, error } = await supabase
        .from('cms_integrations')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', integrationId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating CMS integration:', error);
      return null;
    }
  },

  async deleteCMSIntegration(integrationId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('cms_integrations')
        .delete()
        .eq('id', integrationId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting CMS integration:', error);
      return false;
    }
  },

  // Saved Citation Prompts
  async getSavedCitationPrompts(userId: string): Promise<SavedCitationPrompt[]> {
    try {
      const { data, error } = await supabase
        .from('saved_citation_prompts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching saved citation prompts:', error);
      return [];
    }
  },

  async saveCitationPrompt(prompt: Partial<SavedCitationPrompt>): Promise<SavedCitationPrompt | null> {
    try {
      const { data, error } = await supabase
        .from('saved_citation_prompts')
        .insert(prompt)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error saving citation prompt:', error);
      return null;
    }
  },

  async deleteSavedCitationPrompt(promptId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('saved_citation_prompts')
        .delete()
        .eq('id', promptId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting saved citation prompt:', error);
      return false;
    }
  },

  // Fingerprint Phrases
  async getFingerprintPhrases(userId: string): Promise<FingerprintPhrase[]> {
    try {
      const { data, error } = await supabase
        .from('fingerprint_phrases')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching fingerprint phrases:', error);
      return [];
    }
  },

  async saveFingerprintPhrase(phrase: Partial<FingerprintPhrase>): Promise<FingerprintPhrase | null> {
    try {
      const { data, error } = await supabase
        .from('fingerprint_phrases')
        .insert(phrase)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error saving fingerprint phrase:', error);
      return null;
    }
  },

  async updateFingerprintPhrase(phraseId: string, updates: Partial<FingerprintPhrase>): Promise<FingerprintPhrase | null> {
    try {
      const { data, error } = await supabase
        .from('fingerprint_phrases')
        .update(updates)
        .eq('id', phraseId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating fingerprint phrase:', error);
      return null;
    }
  },

  async deleteFingerprintPhrase(phraseId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('fingerprint_phrases')
        .delete()
        .eq('id', phraseId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting fingerprint phrase:', error);
      return false;
    }
  },

  // Audit History Management
  async saveAuditResult(auditResult: Partial<AuditHistoryEntry>): Promise<AuditHistoryEntry | null> {
    try {
      console.log('Saving audit result:', auditResult);
      
      const { data, error } = await supabase
        .from('audit_history')
        .insert(auditResult)
        .select()
        .single();

      if (error) {
        console.error('Error saving audit result:', error);
        throw error;
      }

      console.log('Successfully saved audit result:', data);
      return data;
    } catch (error) {
      console.error('Error in saveAuditResult:', error);
      throw error;
    }
  },

  async getAuditHistory(userId: string, limit = 50): Promise<AuditHistoryEntry[]> {
    try {
      console.log('Fetching audit history for userId:', userId, 'limit:', limit);
      
      const { data, error } = await supabase
        .from('audit_history')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching audit history:', error);
        throw error;
      }

      console.log('Successfully fetched audit history:', data?.length || 0, 'entries');
      return data || [];
    } catch (error) {
      console.error('Error in getAuditHistory:', error);
      return [];
    }
  },

  async getAuditHistoryForWebsite(userId: string, websiteUrl: string, limit = 20): Promise<AuditHistoryEntry[]> {
    try {
      console.log('Fetching audit history for userId:', userId, 'website:', websiteUrl, 'limit:', limit);
      
      const { data, error } = await supabase
        .from('audit_history')
        .select('*')
        .eq('user_id', userId)
        .eq('website_url', websiteUrl)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching website audit history:', error);
        throw error;
      }

      console.log('Successfully fetched website audit history:', data?.length || 0, 'entries');
      return data || [];
    } catch (error) {
      console.error('Error in getAuditHistoryForWebsite:', error);
      return [];
    }
  },

  // User Activity Tracking
  async trackActivity(activity: Partial<UserActivity>): Promise<void> {
    try {
      console.log('Tracking activity:', activity);
      
      const { error } = await supabase
        .from('user_activity')
        .insert(activity);

      if (error) {
        console.error('Error tracking user activity:', error);
        throw error;
      }

      console.log('Successfully tracked activity');
    } catch (error) {
      console.error('Error in trackActivity:', error);
    }
  },

  async getRecentActivity(userId: string, limit = 20): Promise<UserActivity[]> {
    try {
      console.log('Fetching recent activity for userId:', userId, 'limit:', limit);
      
      const { data, error } = await supabase
        .from('user_activity')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching user activity:', error);
        throw error;
      }

      console.log('Successfully fetched recent activity:', data?.length || 0, 'entries');
      return data || [];
    } catch (error) {
      console.error('Error in getRecentActivity:', error);
      return [];
    }
  },

  // Reports Management
  async saveReport(report: Partial<Report>): Promise<Report | null> {
    try {
      console.log('Saving report:', report);
      
      const { data, error } = await supabase
        .from('reports')
        .insert(report)
        .select()
        .single();

      if (error) {
        console.error('Error saving report:', error);
        throw error;
      }

      console.log('Successfully saved report:', data);
      return data;
    } catch (error) {
      console.error('Error in saveReport:', error);
      return null;
    }
  },

  async getUserReports(userId: string): Promise<Report[]> {
    try {
      console.log('Fetching user reports for userId:', userId);
      
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching user reports:', error);
        throw error;
      }

      console.log('Successfully fetched user reports:', data?.length || 0, 'reports');
      return data || [];
    } catch (error) {
      console.error('Error in getUserReports:', error);
      return [];
    }
  },

  async deleteReport(reportId: string): Promise<boolean> {
    try {
      console.log('Deleting report:', reportId);
      
      const { error } = await supabase
        .from('reports')
        .delete()
        .eq('id', reportId);

      if (error) {
        console.error('Error deleting report:', error);
        throw error;
      }

      console.log('Successfully deleted report');
      return true;
    } catch (error) {
      console.error('Error in deleteReport:', error);
      return false;
    }
  }
};