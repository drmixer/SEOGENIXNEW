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

// Enhanced cache for user profiles to reduce database calls
const profileCache = new Map<string, {profile: UserProfile, timestamp: number}>();
const auditHistoryCache = new Map<string, {data: AuditHistoryEntry[], timestamp: number}>();
const activityCache = new Map<string, {data: UserActivity[], timestamp: number}>();
const reportsCache = new Map<string, {data: Report[], timestamp: number}>();

// Longer cache TTL to reduce database calls
const CACHE_TTL = 300000; // 5 minutes cache TTL

// Activity tracking throttling
const activityThrottleMap = new Map<string, number>();
const ACTIVITY_THROTTLE_MS = 10000; // 10 seconds between identical activities

// Request in progress tracking to prevent duplicate calls
const pendingRequests = new Map<string, Promise<any>>();

export const userDataService = {
  // User Profile Management
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    if (!userId) {
      console.error('getUserProfile called with empty userId');
      return null;
    }
    
    try {
      // Generate a unique request key
      const requestKey = `profile:${userId}`;
      
      // Check if there's already a pending request for this profile
      if (pendingRequests.has(requestKey)) {
        console.log('Request already in progress for profile, returning existing promise');
        return pendingRequests.get(requestKey);
      }
      
      console.log('Fetching user profile for userId:', userId);
      
      // Check cache first
      const cachedData = profileCache.get(userId);
      if (cachedData && (Date.now() - cachedData.timestamp < CACHE_TTL)) {
        console.log('Returning cached profile for user:', userId);
        return cachedData.profile;
      }
      
      // Create a promise for this request
      const profilePromise = (async () => {
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

        console.log('Successfully fetched user profile:', data[0].id);
        
        // Cache the result
        profileCache.set(userId, {
          profile: data[0],
          timestamp: Date.now()
        });
        
        return data[0];
      })();
      
      // Store the promise in the pending requests map
      pendingRequests.set(requestKey, profilePromise);
      
      // Clean up the pending request after it completes
      profilePromise.finally(() => {
        pendingRequests.delete(requestKey);
      });
      
      return profilePromise;
    } catch (error) {
      console.error('Error in getUserProfile:', error);
      throw error; // Re-throw to allow caller to handle
    }
  },

  async createUserProfile(profile: Partial<UserProfile>): Promise<UserProfile | null> {
    if (!profile.user_id) {
      console.error('createUserProfile called with empty user_id');
      return null;
    }
    
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
    if (!userId) {
      console.error('updateUserProfile called with empty userId');
      return null;
    }
    
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
    if (!userId) {
      console.error('getWhiteLabelSettings called with empty userId');
      return null;
    }
    
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
    if (!userId) {
      console.error('updateWhiteLabelSettings called with empty userId');
      return null;
    }
    
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
    if (!userId) {
      console.error('getCMSIntegrations called with empty userId');
      return [];
    }
    
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
    if (!integration.user_id) {
      console.error('createCMSIntegration called with empty user_id');
      return null;
    }
    
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
    if (!integrationId) {
      console.error('updateCMSIntegration called with empty integrationId');
      return null;
    }
    
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
    if (!integrationId) {
      console.error('deleteCMSIntegration called with empty integrationId');
      return false;
    }
    
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
    if (!userId) {
      console.error('getSavedCitationPrompts called with empty userId');
      return [];
    }
    
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
    if (!prompt.user_id) {
      console.error('saveCitationPrompt called with empty user_id');
      return null;
    }
    
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
    if (!promptId) {
      console.error('deleteSavedCitationPrompt called with empty promptId');
      return false;
    }
    
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
    if (!userId) {
      console.error('getFingerprintPhrases called with empty userId');
      return [];
    }
    
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
    if (!phrase.user_id) {
      console.error('saveFingerprintPhrase called with empty user_id');
      return null;
    }
    
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
    if (!phraseId) {
      console.error('updateFingerprintPhrase called with empty phraseId');
      return null;
    }
    
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
    if (!phraseId) {
      console.error('deleteFingerprintPhrase called with empty phraseId');
      return false;
    }
    
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
    if (!auditResult.user_id) {
      console.error('saveAuditResult called with empty user_id');
      return null;
    }
    
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
      
      // Invalidate audit history cache for this user
      const cacheKey = `audit:${auditResult.user_id}`;
      auditHistoryCache.delete(cacheKey);
      
      // Also invalidate website-specific cache if applicable
      if (auditResult.website_url) {
        const websiteCacheKey = `audit:${auditResult.user_id}:${auditResult.website_url}`;
        auditHistoryCache.delete(websiteCacheKey);
      }
      
      return data;
    } catch (error) {
      console.error('Error in saveAuditResult:', error);
      throw error;
    }
  },

  async getAuditHistory(userId: string, limit = 50): Promise<AuditHistoryEntry[]> {
    if (!userId) {
      console.error('getAuditHistory called with empty userId');
      return [];
    }
    
    try {
      // Generate a unique request key
      const requestKey = `audit:${userId}:${limit}`;
      
      // Check if there's already a pending request for this audit history
      if (pendingRequests.has(requestKey)) {
        console.log('Request already in progress for audit history, returning existing promise');
        return pendingRequests.get(requestKey);
      }
      
      // Check cache first
      const cacheKey = `audit:${userId}`;
      const cachedData = auditHistoryCache.get(cacheKey);
      if (cachedData && (Date.now() - cachedData.timestamp < CACHE_TTL)) {
        console.log('Returning cached audit history for user:', userId);
        // Return a slice of the cached data based on the requested limit
        return cachedData.data.slice(0, limit);
      }
      
      console.log('Fetching audit history for userId:', userId, 'limit:', limit);
      
      // Create a promise for this request
      const auditPromise = (async () => {
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
        
        // Cache the full result
        auditHistoryCache.set(cacheKey, {
          data: data || [],
          timestamp: Date.now()
        });
        
        return data || [];
      })();
      
      // Store the promise in the pending requests map
      pendingRequests.set(requestKey, auditPromise);
      
      // Clean up the pending request after it completes
      auditPromise.finally(() => {
        pendingRequests.delete(requestKey);
      });
      
      return auditPromise;
    } catch (error) {
      console.error('Error in getAuditHistory:', error);
      return [];
    }
  },

  async getAuditHistoryForWebsite(userId: string, websiteUrl: string, limit = 20): Promise<AuditHistoryEntry[]> {
    if (!userId || !websiteUrl) {
      console.error('getAuditHistoryForWebsite called with empty userId or websiteUrl');
      return [];
    }
    
    try {
      // Generate a unique request key
      const requestKey = `audit:${userId}:${websiteUrl}:${limit}`;
      
      // Check if there's already a pending request for this website audit history
      if (pendingRequests.has(requestKey)) {
        console.log('Request already in progress for website audit history, returning existing promise');
        return pendingRequests.get(requestKey);
      }
      
      // Check cache first
      const cacheKey = `audit:${userId}:${websiteUrl}`;
      const cachedData = auditHistoryCache.get(cacheKey);
      if (cachedData && (Date.now() - cachedData.timestamp < CACHE_TTL)) {
        console.log('Returning cached website audit history for user:', userId, 'website:', websiteUrl);
        // Return a slice of the cached data based on the requested limit
        return cachedData.data.slice(0, limit);
      }
      
      console.log('Fetching audit history for userId:', userId, 'website:', websiteUrl, 'limit:', limit);
      
      // Create a promise for this request
      const websiteAuditPromise = (async () => {
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
        
        // Cache the full result
        auditHistoryCache.set(cacheKey, {
          data: data || [],
          timestamp: Date.now()
        });
        
        return data || [];
      })();
      
      // Store the promise in the pending requests map
      pendingRequests.set(requestKey, websiteAuditPromise);
      
      // Clean up the pending request after it completes
      websiteAuditPromise.finally(() => {
        pendingRequests.delete(requestKey);
      });
      
      return websiteAuditPromise;
    } catch (error) {
      console.error('Error in getAuditHistoryForWebsite:', error);
      return [];
    }
  },

  // User Activity Tracking with throttling and debouncing
  async trackActivity(activity: Partial<UserActivity>): Promise<void> {
    if (!activity.user_id) {
      console.error('trackActivity called with empty user_id');
      return;
    }
    
    try {
      // Create a throttle key based on user_id, activity_type, and tool_id
      const throttleKey = `${activity.user_id}:${activity.activity_type}:${activity.tool_id || ''}:${activity.website_url || ''}`;
      const now = Date.now();
      
      // Check if we've recently tracked this exact activity
      const lastTracked = activityThrottleMap.get(throttleKey);
      if (lastTracked && (now - lastTracked < ACTIVITY_THROTTLE_MS)) {
        // Skip tracking if too recent
        console.log('Throttling activity tracking:', throttleKey);
        return;
      }
      
      console.log('Tracking activity:', activity);
      
      // Update throttle map
      activityThrottleMap.set(throttleKey, now);
      
      // Use a try-catch block specifically for the database operation
      try {
        const { error } = await supabase
          .from('user_activity')
          .insert(activity);

        if (error) {
          console.error('Error tracking user activity:', error);
        } else {
          console.log('Successfully tracked activity');
          
          // Invalidate activity cache for this user
          const cacheKey = `activity:${activity.user_id}`;
          activityCache.delete(cacheKey);
        }
      } catch (dbError) {
        console.error('Database error in trackActivity:', dbError);
        // Don't rethrow - we want to fail silently for activity tracking
      }
    } catch (error) {
      console.error('Error in trackActivity:', error);
      // Don't rethrow - we want to fail silently for activity tracking
    }
  },

  async getRecentActivity(userId: string, limit = 20): Promise<UserActivity[]> {
    if (!userId) {
      console.error('getRecentActivity called with empty userId');
      return [];
    }
    
    try {
      // Generate a unique request key
      const requestKey = `activity:${userId}:${limit}`;
      
      // Check if there's already a pending request for this activity
      if (pendingRequests.has(requestKey)) {
        console.log('Request already in progress for recent activity, returning existing promise');
        return pendingRequests.get(requestKey);
      }
      
      // Check cache first
      const cacheKey = `activity:${userId}`;
      const cachedData = activityCache.get(cacheKey);
      if (cachedData && (Date.now() - cachedData.timestamp < CACHE_TTL)) {
        console.log('Returning cached recent activity for user:', userId);
        // Return a slice of the cached data based on the requested limit
        return cachedData.data.slice(0, limit);
      }
      
      console.log('Fetching recent activity for userId:', userId, 'limit:', limit);
      
      // Create a promise for this request
      const activityPromise = (async () => {
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
        
        // Cache the full result
        activityCache.set(cacheKey, {
          data: data || [],
          timestamp: Date.now()
        });
        
        return data || [];
      })();
      
      // Store the promise in the pending requests map
      pendingRequests.set(requestKey, activityPromise);
      
      // Clean up the pending request after it completes
      activityPromise.finally(() => {
        pendingRequests.delete(requestKey);
      });
      
      return activityPromise;
    } catch (error) {
      console.error('Error in getRecentActivity:', error);
      return [];
    }
  },

  // Reports Management
  async saveReport(report: Partial<Report>): Promise<Report | null> {
    if (!report.user_id) {
      console.error('saveReport called with empty user_id');
      return null;
    }
    
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
      
      // Invalidate reports cache for this user
      const cacheKey = `reports:${report.user_id}`;
      reportsCache.delete(cacheKey);
      
      return data;
    } catch (error) {
      console.error('Error in saveReport:', error);
      return null;
    }
  },

  async getUserReports(userId: string): Promise<Report[]> {
    if (!userId) {
      console.error('getUserReports called with empty userId');
      return [];
    }
    
    try {
      // Generate a unique request key
      const requestKey = `reports:${userId}`;
      
      // Check if there's already a pending request for this user's reports
      if (pendingRequests.has(requestKey)) {
        console.log('Request already in progress for user reports, returning existing promise');
        return pendingRequests.get(requestKey);
      }
      
      // Check cache first
      const cacheKey = `reports:${userId}`;
      const cachedData = reportsCache.get(cacheKey);
      if (cachedData && (Date.now() - cachedData.timestamp < CACHE_TTL)) {
        console.log('Returning cached reports for user:', userId);
        return cachedData.data;
      }
      
      console.log('Fetching user reports for userId:', userId);
      
      // Create a promise for this request
      const reportsPromise = (async () => {
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
        
        // Cache the result
        reportsCache.set(cacheKey, {
          data: data || [],
          timestamp: Date.now()
        });
        
        return data || [];
      })();
      
      // Store the promise in the pending requests map
      pendingRequests.set(requestKey, reportsPromise);
      
      // Clean up the pending request after it completes
      reportsPromise.finally(() => {
        pendingRequests.delete(requestKey);
      });
      
      return reportsPromise;
    } catch (error) {
      console.error('Error in getUserReports:', error);
      return [];
    }
  },

  async deleteReport(reportId: string): Promise<boolean> {
    if (!reportId) {
      console.error('deleteReport called with empty reportId');
      return false;
    }
    
    try {
      console.log('Deleting report:', reportId);
      
      // First get the report to know which user it belongs to (for cache invalidation)
      const { data: reportData } = await supabase
        .from('reports')
        .select('user_id')
        .eq('id', reportId)
        .single();
      
      const { error } = await supabase
        .from('reports')
        .delete()
        .eq('id', reportId);

      if (error) {
        console.error('Error deleting report:', error);
        throw error;
      }

      console.log('Successfully deleted report');
      
      // Invalidate reports cache for this user if we found the user_id
      if (reportData?.user_id) {
        const cacheKey = `reports:${reportData.user_id}`;
        reportsCache.delete(cacheKey);
      }
      
      return true;
    } catch (error) {
      console.error('Error in deleteReport:', error);
      return false;
    }
  },
  
  // Cache management utilities
  clearCache(userId?: string): void {
    if (userId) {
      // Clear cache for specific user
      profileCache.delete(userId);
      auditHistoryCache.delete(`audit:${userId}`);
      activityCache.delete(`activity:${userId}`);
      reportsCache.delete(`reports:${userId}`);
      
      // Clear any throttle entries for this user
      for (const key of activityThrottleMap.keys()) {
        if (key.startsWith(`${userId}:`)) {
          activityThrottleMap.delete(key);
        }
      }
      
      console.log(`Cleared cache for user: ${userId}`);
    } else {
      // Clear all caches
      profileCache.clear();
      auditHistoryCache.clear();
      activityCache.clear();
      reportsCache.clear();
      activityThrottleMap.clear();
      pendingRequests.clear();
      console.log('Cleared all caches');
    }
  }
};