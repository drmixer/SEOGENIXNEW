import { LemonSqueezy } from '@lemonsqueezy/lemonsqueezy.js';
import { supabase } from '../lib/supabase';

// Get API key and validate it exists
const apiKey = import.meta.env.VITE_LEMONSQUEEZY_API_KEY;

// Check if API key is properly configured (not placeholder or empty)
const isApiKeyConfigured = apiKey && apiKey !== 'your_lemonsqueezy_api_key_here' && apiKey.trim() !== '';

if (!isApiKeyConfigured) {
  console.warn('VITE_LEMONSQUEEZY_API_KEY is not properly configured. Payment processing will be unavailable.');
}

// Initialize LemonSqueezy with your API key - only if API key is properly configured
const lemonSqueezy = isApiKeyConfigured ? new LemonSqueezy(apiKey) : null;

// Plan IDs from LemonSqueezy
export const PLAN_IDS = {
  free: 'free', // Not a real LemonSqueezy plan, just for reference
  core: import.meta.env.VITE_LEMONSQUEEZY_CORE_PLAN_ID || '',
  pro: import.meta.env.VITE_LEMONSQUEEZY_PRO_PLAN_ID || '',
  agency: import.meta.env.VITE_LEMONSQUEEZY_AGENCY_PLAN_ID || ''
};

// Store IDs from LemonSqueezy
export const STORE_ID = import.meta.env.VITE_LEMONSQUEEZY_STORE_ID || '';

// Checkout options
export interface CheckoutOptions {
  name?: string;
  email?: string;
  planId: string;
  variantId: string;
  successUrl?: string;
  cancelUrl?: string;
}

// Helper function to check if LemonSqueezy is properly configured
const validateLemonSqueezyConfig = () => {
  if (!lemonSqueezy) {
    throw new Error('LemonSqueezy is not properly configured. Please ensure VITE_LEMONSQUEEZY_API_KEY is set to your actual API key in your .env file, then restart the development server.');
  }
  
  if (!STORE_ID || STORE_ID === 'your_lemonsqueezy_store_id_here') {
    throw new Error('LemonSqueezy Store ID is not properly configured. Please set VITE_LEMONSQUEEZY_STORE_ID in your .env file.');
  }
};

export const lemonsqueezyService = {
  /**
   * Check if LemonSqueezy is properly configured
   */
  isConfigured() {
    return isApiKeyConfigured && lemonSqueezy !== null;
  },

  /**
   * Get the current user's subscription
   */
  async getUserSubscription(userId: string) {
    try {
      validateLemonSqueezyConfig();

      // Get user's customer ID from Supabase
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('lemonsqueezy_customer_id, plan')
        .eq('user_id', userId)
        .single();
      
      if (!profile?.lemonsqueezy_customer_id) {
        return null;
      }
      
      // Get subscriptions for this customer
      const { data: subscriptions } = await lemonSqueezy!.subscriptions.list({
        filter: {
          customerId: profile.lemonsqueezy_customer_id
        }
      });
      
      return subscriptions?.data?.[0] || null;
    } catch (error) {
      console.error('Error getting user subscription:', error);
      throw error;
    }
  },
  
  /**
   * Create a checkout for a specific plan
   */
  async createCheckout(options: CheckoutOptions) {
    try {
      validateLemonSqueezyConfig();

      const { name, email, planId, variantId, successUrl, cancelUrl } = options;
      
      if (!variantId || variantId.includes('your_') || variantId.includes('_here')) {
        throw new Error(`Product variant ID is not properly configured for plan: ${planId}. Please configure the variant IDs in your .env file.`);
      }
      
      // Create a checkout
      const { data: checkout } = await lemonSqueezy!.checkouts.create({
        storeId: STORE_ID,
        variantId,
        checkoutData: {
          name,
          email,
          custom: {
            plan: planId
          },
          successUrl,
          cancelUrl
        }
      });
      
      return checkout;
    } catch (error) {
      console.error('Error creating checkout:', error);
      throw error;
    }
  },
  
  /**
   * Update a user's plan in Supabase based on subscription data
   */
  async updateUserPlan(userId: string, subscriptionData: any) {
    try {
      const planId = subscriptionData.attributes?.custom_data?.plan || 'free';
      const customerId = subscriptionData.attributes?.customer_id;
      const subscriptionId = subscriptionData.id;
      
      // Update user profile with subscription info
      await supabase
        .from('user_profiles')
        .update({
          plan: planId,
          lemonsqueezy_customer_id: customerId,
          lemonsqueezy_subscription_id: subscriptionId,
          subscription_status: subscriptionData.attributes?.status || 'active',
          subscription_updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);
      
      // Also update user metadata
      await supabase.auth.updateUser({
        data: {
          plan: planId
        }
      });
      
      return true;
    } catch (error) {
      console.error('Error updating user plan:', error);
      return false;
    }
  },
  
  /**
   * Cancel a subscription
   */
  async cancelSubscription(subscriptionId: string) {
    try {
      validateLemonSqueezyConfig();

      await lemonSqueezy!.subscriptions.update(subscriptionId, {
        cancelled: true
      });
      
      return true;
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      return false;
    }
  },
  
  /**
   * Get checkout URL for a specific plan
   */
  async getCheckoutUrl(plan: 'core' | 'pro' | 'agency', user: any, billingCycle: 'monthly' | 'annual' = 'monthly') {
    try {
      // Check if LemonSqueezy is configured before proceeding
      if (!this.isConfigured()) {
        throw new Error('Payment processing is not available. LemonSqueezy integration is not properly configured.');
      }

      validateLemonSqueezyConfig();

      // Map plans to variant IDs based on billing cycle
      const variantMap: Record<string, Record<string, string>> = {
        monthly: {
          core: import.meta.env.VITE_LEMONSQUEEZY_CORE_MONTHLY_VARIANT_ID || '',
          pro: import.meta.env.VITE_LEMONSQUEEZY_PRO_MONTHLY_VARIANT_ID || '',
          agency: import.meta.env.VITE_LEMONSQUEEZY_AGENCY_MONTHLY_VARIANT_ID || ''
        },
        annual: {
          core: import.meta.env.VITE_LEMONSQUEEZY_CORE_ANNUAL_VARIANT_ID || '',
          pro: import.meta.env.VITE_LEMONSQUEEZY_PRO_ANNUAL_VARIANT_ID || '',
          agency: import.meta.env.VITE_LEMONSQUEEZY_AGENCY_ANNUAL_VARIANT_ID || ''
        }
      };
      
      const variantId = variantMap[billingCycle][plan];
      if (!variantId) {
        throw new Error(`No variant ID found for plan: ${plan} (${billingCycle}). Please configure VITE_LEMONSQUEEZY_${plan.toUpperCase()}_${billingCycle.toUpperCase()}_VARIANT_ID in your .env file.`);
      }
      
      // Create checkout
      const checkout = await this.createCheckout({
        name: user?.user_metadata?.full_name,
        email: user?.email,
        planId: plan,
        variantId,
        successUrl: `${window.location.origin}/dashboard?checkout_success=true&plan=${plan}`,
        cancelUrl: `${window.location.origin}/?checkout_cancelled=true`
      });
      
      return checkout?.data?.attributes?.url;
    } catch (error) {
      console.error('Error getting checkout URL:', error);
      throw error;
    }
  },
  
  /**
   * Process webhook from LemonSqueezy
   */
  async processWebhook(payload: any) {
    try {
      validateLemonSqueezyConfig();

      const eventName = payload.meta?.event_name;
      const eventData = payload.data;
      
      if (!eventName || !eventData) {
        throw new Error('Invalid webhook payload');
      }
      
      console.log(`Processing LemonSqueezy webhook: ${eventName}`);
      
      switch (eventName) {
        case 'subscription_created':
        case 'subscription_updated':
          // Find user by customer ID
          const customerId = eventData.attributes?.customer_id;
          if (!customerId) break;
          
          const { data: profiles } = await supabase
            .from('user_profiles')
            .select('user_id')
            .eq('lemonsqueezy_customer_id', customerId);
          
          if (profiles && profiles.length > 0) {
            await this.updateUserPlan(profiles[0].user_id, eventData);
          } else {
            console.log('No user found for customer ID:', customerId);
          }
          break;
          
        case 'subscription_cancelled':
          // Update subscription status
          const subscriptionId = eventData.id;
          if (!subscriptionId) break;
          
          const { data: subProfiles } = await supabase
            .from('user_profiles')
            .select('user_id')
            .eq('lemonsqueezy_subscription_id', subscriptionId);
          
          if (subProfiles && subProfiles.length > 0) {
            await supabase
              .from('user_profiles')
              .update({
                subscription_status: 'cancelled',
                subscription_updated_at: new Date().toISOString()
              })
              .eq('lemonsqueezy_subscription_id', subscriptionId);
              
            // Don't downgrade plan immediately - it will happen when subscription actually ends
          }
          break;
          
        case 'subscription_expired':
          // Downgrade to free plan
          const expiredSubId = eventData.id;
          if (!expiredSubId) break;
          
          const { data: expiredProfiles } = await supabase
            .from('user_profiles')
            .select('user_id')
            .eq('lemonsqueezy_subscription_id', expiredSubId);
          
          if (expiredProfiles && expiredProfiles.length > 0) {
            for (const profile of expiredProfiles) {
              await this.updateUserPlan(profile.user_id, {
                id: expiredSubId,
                attributes: {
                  custom_data: { plan: 'free' },
                  status: 'expired'
                }
              });
            }
          }
          break;
      }
      
      return true;
    } catch (error) {
      console.error('Error processing webhook:', error);
      return false;
    }
  }
};