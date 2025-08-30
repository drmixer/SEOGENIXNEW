import { supabase } from '../lib/supabase';

export interface UserProfile {
  id: string;
  user_id: string;
  websites: Array<{ id: string; url: string; name: string }>; 
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
  async getUserProfile(userId: string, forceRefresh = false): Promise<UserProfile | null> {
    if (!userId) {
      console.error('getUserProfile called with empty userId');
      return null;
    }
    
    const requestKey = `profile:${userId}`;
    
    if (pendingRequests.has(requestKey) && !forceRefresh) {
      console.log('Request already in progress for profile, returning existing promise');
      return pendingRequests.get(requestKey);
    }
    
    const cachedData = profileCache.get(userId);
    if (!forceRefresh && cachedData && (Date.now() - cachedData.timestamp < CACHE_TTL)) {
      console.log('Returning cached profile for user:', userId);
      return cachedData.profile;
    }
    
    if (forceRefresh) {
      console.log('Forcing profile refresh for user:', userId);
    }

    const profilePromise = (async () => {
      // Step 1: Fetch the core user profile from 'user_profiles'
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (profileError) {
        console.error('Error fetching user profile:', profileError);
        throw profileError;
      }

      if (!profileData) {
        console.log('No profile found for user:', userId);
        return null;
      }

      // Step 2: Fetch the user's websites from the 'projects' table using 'owner_id'
      const { data: websites, error: websitesError } = await supabase
        .from('projects')
        .select('id, name, url')
        .eq('owner_id', userId);

      if (websitesError) {
        console.error('Error fetching user websites from projects:', websitesError);
        throw websitesError;
      }
      
      // Step 3: Combine the profile and websites into a single, complete object
      const completeProfile = {
        ...profileData,
        websites: websites || []
      };

      console.log('Successfully fetched complete user profile:', completeProfile.id);
      
      // Cache the combined result
      profileCache.set(userId, {
        profile: completeProfile as UserProfile,
        timestamp: Date.now()
      });
      
      return completeProfile as UserProfile;
    })();
    
    pendingRequests.set(requestKey, profilePromise);
    
    profilePromise.finally(() => {
      pendingRequests.delete(requestKey);
    });
    
    return profilePromise;
  },

  // Entities draft persistence using user_activity (no new tables)
  async saveEntitiesDraft(params: { userId: string; projectId: string; websiteUrl: string; draft: { suggested?: any[]; missing?: any[]; accepted?: string[] } }): Promise<void> {
    const { userId, projectId, websiteUrl, draft } = params;
    if (!userId || !projectId || !websiteUrl) {
      console.error('saveEntitiesDraft called with missing identifiers');
      return;
    }
    try {
      await supabase.from('user_activity').insert({
        user_id: userId,
        activity_type: 'entities_draft',
        website_url: websiteUrl,
        tool_id: projectId, // reuse tool_id to hold project id
        activity_data: { ...draft, updatedAt: new Date().toISOString() },
        created_at: new Date().toISOString()
      });
    } catch (e) {
      console.warn('Failed to save entities draft:', e);
    }
  },

  async getEntitiesDraft(userId: string, projectId: string, websiteUrl: string): Promise<{ suggested?: any[]; missing?: any[]; accepted?: string[]; updatedAt?: string } | null> {
    if (!userId || !projectId || !websiteUrl) {
      console.error('getEntitiesDraft called with missing identifiers');
      return null;
    }
    try {
      const { data, error } = await supabase
        .from('user_activity')
        .select('activity_data, created_at')
        .eq('user_id', userId)
        .eq('activity_type', 'entities_draft')
        .eq('website_url', websiteUrl)
        .eq('tool_id', projectId)
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      if (data && data.length > 0) {
        return data[0].activity_data || null;
      }
      return null;
    } catch (e) {
      console.warn('Failed to fetch entities draft:', e);
      return null;
    }
  },

  // Schema draft persistence using user_activity
  async saveSchemaDraft(params: { userId: string; projectId: string; websiteUrl: string; draft: { schema?: any; valid?: boolean; issues?: Array<{ path?: string; message: string }>; applied?: boolean; cms_type?: 'wordpress' | 'shopify'; cms_item_id?: string | number } }): Promise<void> {
    const { userId, projectId, websiteUrl, draft } = params;
    if (!userId || !projectId || !websiteUrl) {
      console.error('saveSchemaDraft called with missing identifiers');
      return;
    }
    try {
      await supabase.from('user_activity').insert({
        user_id: userId,
        activity_type: 'schema_draft',
        website_url: websiteUrl,
        tool_id: projectId,
        activity_data: { ...draft, updatedAt: new Date().toISOString() },
        created_at: new Date().toISOString()
      });
    } catch (e) {
      console.warn('Failed to save schema draft:', e);
    }
  },

  async getSchemaDraft(
    userId: string,
    projectId: string,
    websiteUrl: string,
    opts?: { cms_type?: 'wordpress' | 'shopify'; cms_item_id?: string | number }
  ): Promise<{ schema?: any; valid?: boolean; issues?: Array<{ path?: string; message: string }>; applied?: boolean; updatedAt?: string; cms_type?: 'wordpress' | 'shopify'; cms_item_id?: string | number } | null> {
    if (!userId || !projectId || !websiteUrl) {
      console.error('getSchemaDraft called with missing identifiers');
      return null;
    }
    try {
      const { data, error } = await supabase
        .from('user_activity')
        .select('activity_data, website_url, created_at')
        .eq('user_id', userId)
        .eq('activity_type', 'schema_draft')
        .eq('tool_id', projectId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      const rows = data || [];
      // Prefer exact CMS item match
      const byItem = opts?.cms_item_id
        ? rows.find(r => r?.activity_data?.cms_item_id == opts.cms_item_id && r?.activity_data?.applied && r?.activity_data?.schema)
        : null;
      if (byItem) return byItem.activity_data || null;
      // Else prefer website URL match
      const byUrl = rows.find(r => r?.website_url === websiteUrl && r?.activity_data?.applied && r?.activity_data?.schema);
      if (byUrl) return byUrl.activity_data || null;
      // Else return latest draft if any
      return rows[0]?.activity_data || null;
    } catch (e) {
      console.warn('Failed to fetch schema draft:', e);
      return null;
    }
  },

  async createUserProfile(profile: Partial<UserProfile>): Promise<UserProfile | null> {
    if (!profile.user_id) {
      console.error('createUserProfile called with empty user_id');
      return null;
    }
    
    try {
      console.log('Creating user profile:', profile);
      
      const { data: existingProfiles } = await supabase
        .from('user_profiles')
        .select('user_id')
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
      
      this.clearCache(profile.user_id);
      
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
      
      const { websites, ...profileUpdates } = updates;

      const { data, error } = await supabase
        .from('user_profiles')
        .update({ ...profileUpdates, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        console.error('Error updating user profile:', error);
        throw error;
      }

      console.log('Successfully updated user profile:', data);

      // If websites were provided, create/update corresponding project records
      if (websites && Array.isArray(websites)) {
        const sanitized = websites
          .filter((w: any) => w && typeof w.url === 'string' && typeof w.name === 'string')
          .map((w: any) => ({ url: w.url.trim(), name: w.name.trim(), id: (w as any).id || null }))
          .filter((w) => w.url && w.name);

        for (const w of sanitized) {
          try {
            if (w.id) {
              // Update existing project name/url if needed
              const { error: updateErr } = await supabase
                .from('projects')
                .update({ name: w.name, url: w.url })
                .eq('id', w.id)
                .eq('owner_id', userId);
              if (updateErr) {
                console.warn('Failed updating existing project', w.id, updateErr.message);
              }
            } else {
              // Check for existing project with same URL for this owner
              const { data: existing, error: existingErr } = await supabase
                .from('projects')
                .select('id')
                .eq('owner_id', userId)
                .eq('url', w.url)
                .maybeSingle();

              if (!existingErr && existing) {
                // Update name if it differs
                const { error: nameUpdateErr } = await supabase
                  .from('projects')
                  .update({ name: w.name })
                  .eq('id', existing.id);
                if (nameUpdateErr) {
                  console.warn('Failed updating project name for', existing.id, nameUpdateErr.message);
                }
              } else {
                // Insert new project. Include org_id placeholder if present in schema.
                const insertPayload: Record<string, any> = {
                  name: w.name,
                  owner_id: userId,
                  url: w.url,
                  // Matches SettingsModal convention; harmless if column exists, ignored otherwise by DB
                  org_id: '00000000-0000-0000-0000-000000000000'
                };
                const { error: insertErr } = await supabase
                  .from('projects')
                  .insert(insertPayload);
                if (insertErr) {
                  console.warn('Failed inserting new project for', w.url, insertErr.message);
                }
              }
            }
          } catch (projectErr: any) {
            console.warn('Project sync error for website', w.url, projectErr?.message || projectErr);
          }
        }
      }

      // Refresh cached profile (includes projects as websites)
      await this.getUserProfile(userId, true);
      
      return data;
    } catch (error) {
      console.error('Error in updateUserProfile:', error);
      throw error;
    }
  },

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
      
      const cacheKey = `audit:${auditResult.user_id}`;
      auditHistoryCache.delete(cacheKey);
      
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
      const requestKey = `audit:${userId}:${limit}`;
      
      if (pendingRequests.has(requestKey)) {
        console.log('Request already in progress for audit history, returning existing promise');
        return pendingRequests.get(requestKey);
      }
      
      const cacheKey = `audit:${userId}`;
      const cachedData = auditHistoryCache.get(cacheKey);
      if (cachedData && (Date.now() - cachedData.timestamp < CACHE_TTL)) {
        console.log('Returning cached audit history for user:', userId);
        return cachedData.data.slice(0, limit);
      }
      
      console.log('Fetching audit history for userId:', userId, 'limit:', limit);
      
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
        
        auditHistoryCache.set(cacheKey, {
          data: data || [],
          timestamp: Date.now()
        });
        
        return data || [];
      })();
      
      pendingRequests.set(requestKey, auditPromise);
      
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
      const requestKey = `audit:${userId}:${websiteUrl}:${limit}`;
      
      if (pendingRequests.has(requestKey)) {
        console.log('Request already in progress for website audit history, returning existing promise');
        return pendingRequests.get(requestKey);
      }
      
      const cacheKey = `audit:${userId}:${websiteUrl}`;
      const cachedData = auditHistoryCache.get(cacheKey);
      if (cachedData && (Date.now() - cachedData.timestamp < CACHE_TTL)) {
        console.log('Returning cached website audit history for user:', userId, 'website:', websiteUrl);
        return cachedData.data.slice(0, limit);
      }
      
      console.log('Fetching audit history for userId:', userId, 'website:', websiteUrl, 'limit:', limit);
      
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
        
        auditHistoryCache.set(cacheKey, {
          data: data || [],
          timestamp: Date.now()
        });
        
        return data || [];
      })();
      
      pendingRequests.set(requestKey, websiteAuditPromise);
      
      websiteAuditPromise.finally(() => {
        pendingRequests.delete(requestKey);
      });
      
      return websiteAuditPromise;
    } catch (error) {
      console.error('Error in getAuditHistoryForWebsite:', error);
      return [];
    }
  },

  async trackActivity(activity: Partial<UserActivity>): Promise<void> {
    if (!activity.user_id) {
      console.error('trackActivity called with empty user_id');
      return;
    }
    
    try {
      const throttleKey = `${activity.user_id}:${activity.activity_type}:${activity.tool_id || ''}:${activity.website_url || ''}`;
      const now = Date.now();
      
      const lastTracked = activityThrottleMap.get(throttleKey);
      if (lastTracked && (now - lastTracked < ACTIVITY_THROTTLE_MS)) {
        console.log('Throttling activity tracking:', throttleKey);
        return;
      }
      
      console.log('Tracking activity:', activity);
      
      activityThrottleMap.set(throttleKey, now);
      
      try {
        const { error } = await supabase
          .from('user_activity')
          .insert(activity);

        if (error) {
          console.error('Error tracking user activity:', error);
        } else {
          console.log('Successfully tracked activity');
          
          const cacheKey = `activity:${activity.user_id}`;
          activityCache.delete(cacheKey);
        }
      } catch (dbError) {
        console.error('Database error in trackActivity:', dbError);
      }
    } catch (error) {
      console.error('Error in trackActivity:', error);
    }
  },

  async getRecentActivity(userId: string, limit = 20): Promise<UserActivity[]> {
    if (!userId) {
      console.error('getRecentActivity called with empty userId');
      return [];
    }
    
    try {
      const requestKey = `activity:${userId}:${limit}`;
      
      if (pendingRequests.has(requestKey)) {
        console.log('Request already in progress for recent activity, returning existing promise');
        return pendingRequests.get(requestKey);
      }
      
      const cacheKey = `activity:${userId}`;
      const cachedData = activityCache.get(cacheKey);
      if (cachedData && (Date.now() - cachedData.timestamp < CACHE_TTL)) {
        console.log('Returning cached recent activity for user:', userId);
        return cachedData.data.slice(0, limit);
      }
      
      console.log('Fetching recent activity for userId:', userId, 'limit:', limit);
      
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
        
        activityCache.set(cacheKey, {
          data: data || [],
          timestamp: Date.now()
        });
        
        return data || [];
      })();
      
      pendingRequests.set(requestKey, activityPromise);
      
      activityPromise.finally(() => {
        pendingRequests.delete(requestKey);
      });
      
      return activityPromise;
    } catch (error) {
      console.error('Error in getRecentActivity:', error);
      return [];
    }
  },

  // Persist simple per-website Fixes Playlist progress using user_activity to avoid new tables
  async saveFixesPlaylistProgress(params: { userId: string; websiteUrl: string; index: number; total: number; note?: string }): Promise<void> {
    const { userId, websiteUrl, index, total, note } = params;
    if (!userId || !websiteUrl) {
      console.error('saveFixesPlaylistProgress called with empty userId or websiteUrl');
      return;
    }
    try {
      await supabase.from('user_activity').insert({
        user_id: userId,
        activity_type: 'fixes_playlist_progress',
        website_url: websiteUrl,
        activity_data: { index, total, note },
        created_at: new Date().toISOString()
      });
    } catch (e) {
      console.warn('Failed to save Fixes Playlist progress:', e);
    }
  },

  async getFixesPlaylistProgress(userId: string, websiteUrl: string): Promise<{ index: number; total?: number } | null> {
    if (!userId || !websiteUrl) {
      console.error('getFixesPlaylistProgress called with empty userId or websiteUrl');
      return null;
    }
    try {
      const { data, error } = await supabase
        .from('user_activity')
        .select('activity_data, created_at')
        .eq('user_id', userId)
        .eq('activity_type', 'fixes_playlist_progress')
        .eq('website_url', websiteUrl)
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      if (data && data.length > 0) {
        const ad = data[0].activity_data || {};
        if (typeof ad.index === 'number') {
          return { index: ad.index, total: ad.total };
        }
      }
      return null;
    } catch (e) {
      console.warn('Failed to fetch Fixes Playlist progress:', e);
      return null;
    }
  },

  // Remember last-used CMS publish target without new tables
  async saveLastCmsTarget(userId: string, target: 'wordpress' | 'shopify'): Promise<void> {
    if (!userId) return;
    try {
      await supabase.from('user_activity').insert({
        user_id: userId,
        activity_type: 'last_cms_target',
        activity_data: { target },
        created_at: new Date().toISOString()
      });
    } catch (e) {
      console.warn('Failed to save last CMS target:', e);
    }
  },

  async getLastCmsTarget(userId: string): Promise<'wordpress' | 'shopify' | null> {
    if (!userId) return null;
    try {
      const { data, error } = await supabase
        .from('user_activity')
        .select('activity_data, created_at')
        .eq('user_id', userId)
        .eq('activity_type', 'last_cms_target')
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      const target = data?.[0]?.activity_data?.target;
      if (target === 'wordpress' || target === 'shopify') return target;
      return null;
    } catch (e) {
      console.warn('Failed to fetch last CMS target:', e);
      return null;
    }
  },

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
      const requestKey = `reports:${userId}`;
      
      if (pendingRequests.has(requestKey)) {
        console.log('Request already in progress for user reports, returning existing promise');
        return pendingRequests.get(requestKey);
      }
      
      const cacheKey = `reports:${userId}`;
      const cachedData = reportsCache.get(cacheKey);
      if (cachedData && (Date.now() - cachedData.timestamp < CACHE_TTL)) {
        console.log('Returning cached reports for user:', userId);
        return cachedData.data;
      }
      
      console.log('Fetching user reports for userId:', userId);
      
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
        
        reportsCache.set(cacheKey, {
          data: data || [],
          timestamp: Date.now()
        });
        
        return data || [];
      })();
      
      pendingRequests.set(requestKey, reportsPromise);
      
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
  
  clearCache(userId?: string): void {
    if (userId) {
      profileCache.delete(userId);
      auditHistoryCache.delete(`audit:${userId}`);
      activityCache.delete(`activity:${userId}`);
      reportsCache.delete(`reports:${userId}`);
      
      for (const key of activityThrottleMap.keys()) {
        if (key.startsWith(`${userId}:`)) {
          activityThrottleMap.delete(key);
        }
      }
      
      console.log(`Cleared cache for user: ${userId}`);
    } else {
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
