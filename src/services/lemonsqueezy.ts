import { LemonSqueezy } from '@lemonsqueezy/lemonsqueezy.js';
import { supabase } from '../lib/supabase';

// Initialize LemonSqueezy with your API key
const lemonSqueezy = new LemonSqueezy(import.meta.env.VITE_LEMONSQUEEZY_API_KEY || '');

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

export const lemonsqueezyService = {
  /**
   * Get the current user's subscription
   */
  async getUserSubscription(userId: string) {
    try {
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
      const { data: subscriptions } = await lemonSqueezy.subscriptions.list({
        filter: {
          customerId: profile.lemonsqueezy_customer_id
        }
      });
      
      return subscriptions?.data?.[0] || null;
    } catch (error) {
      console.error('Error getting user subscription:', error);
      return null;
    }
  },
  
  /**
   * Create a checkout for a specific plan
   */
  async createCheckout(options: CheckoutOptions) {
    try {
      const { name, email, planId, variantId, successUrl, cancelUrl } = options;
      
      // Create a checkout
      const { data: checkout } = await lemonSqueezy.checkouts.create({
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
      await lemonSqueezy.subscriptions.update(subscriptionId, {
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
  async getCheckoutUrl(plan: 'core' | 'pro' | 'agency', user: any) {
    try {
      // Map plans to variant IDs (you'll need to replace these with your actual variant IDs)
      const variantMap: Record<string, string> = {
        core: import.meta.env.VITE_LEMONSQUEEZY_CORE_VARIANT_ID || '',
        pro: import.meta.env.VITE_LEMONSQUEEZY_PRO_VARIANT_ID || '',
        agency: import.meta.env.VITE_LEMONSQUEEZY_AGENCY_VARIANT_ID || ''
      };
      
      const variantId = variantMap[plan];
      if (!variantId) {
        throw new Error(`No variant ID found for plan: ${plan}`);
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