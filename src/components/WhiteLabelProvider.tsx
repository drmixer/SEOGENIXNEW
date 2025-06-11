import React, { createContext, useContext, useEffect, useState } from 'react';
import { userDataService, type WhiteLabelSettings } from '../services/userDataService';
import { supabase } from '../lib/supabase';

interface WhiteLabelContextType {
  settings: WhiteLabelSettings | null;
  updateSettings: (settings: Partial<WhiteLabelSettings>) => Promise<void>;
  loading: boolean;
}

const WhiteLabelContext = createContext<WhiteLabelContextType | undefined>(undefined);

export const useWhiteLabel = () => {
  const context = useContext(WhiteLabelContext);
  if (context === undefined) {
    throw new Error('useWhiteLabel must be used within a WhiteLabelProvider');
  }
  return context;
};

interface WhiteLabelProviderProps {
  children: React.ReactNode;
  user: any;
}

export const WhiteLabelProvider: React.FC<WhiteLabelProviderProps> = ({ children, user }) => {
  const [settings, setSettings] = useState<WhiteLabelSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadWhiteLabelSettings();
    } else {
      setSettings(null);
      setLoading(false);
    }
  }, [user]);

  // Apply white-label settings to the document
  useEffect(() => {
    if (settings) {
      applyWhiteLabelStyles(settings);
    } else {
      resetToDefaultStyles();
    }
  }, [settings]);

  const loadWhiteLabelSettings = async () => {
    try {
      const whiteLabelSettings = await userDataService.getWhiteLabelSettings(user.id);
      setSettings(whiteLabelSettings);
    } catch (error) {
      console.error('Error loading white-label settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (newSettings: Partial<WhiteLabelSettings>) => {
    try {
      const updatedSettings = await userDataService.updateWhiteLabelSettings(user.id, newSettings);
      if (updatedSettings) {
        setSettings(updatedSettings);
      }
    } catch (error) {
      console.error('Error updating white-label settings:', error);
      throw error;
    }
  };

  const applyWhiteLabelStyles = (settings: WhiteLabelSettings) => {
    const root = document.documentElement;
    
    // Apply CSS custom properties
    root.style.setProperty('--primary-color', settings.primary_color_hex);
    root.style.setProperty('--secondary-color', settings.secondary_color_hex);
    root.style.setProperty('--accent-color', settings.accent_color_hex);
    
    // Update favicon if provided
    if (settings.favicon_url) {
      updateFavicon(settings.favicon_url);
    }
    
    // Update page title if company name is provided
    if (settings.company_name) {
      document.title = `${settings.company_name} - AI-Powered SEO Platform`;
    }
    
    // Apply custom CSS if provided
    if (settings.custom_css) {
      applyCustomCSS(settings.custom_css);
    }
  };

  const resetToDefaultStyles = () => {
    const root = document.documentElement;
    
    // Reset to default colors
    root.style.setProperty('--primary-color', '#8B5CF6');
    root.style.setProperty('--secondary-color', '#14B8A6');
    root.style.setProperty('--accent-color', '#F59E0B');
    
    // Reset title
    document.title = 'SEOGENIX - AI-Powered SEO Platform';
    
    // Remove custom CSS
    removeCustomCSS();
  };

  const updateFavicon = (faviconUrl: string) => {
    const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement || document.createElement('link');
    link.type = 'image/x-icon';
    link.rel = 'shortcut icon';
    link.href = faviconUrl;
    document.getElementsByTagName('head')[0].appendChild(link);
  };

  const applyCustomCSS = (customCSS: string) => {
    // Remove existing custom CSS
    removeCustomCSS();
    
    // Add new custom CSS
    const style = document.createElement('style');
    style.id = 'white-label-custom-css';
    style.textContent = customCSS;
    document.head.appendChild(style);
  };

  const removeCustomCSS = () => {
    const existingStyle = document.getElementById('white-label-custom-css');
    if (existingStyle) {
      existingStyle.remove();
    }
  };

  return (
    <WhiteLabelContext.Provider value={{ settings, updateSettings, loading }}>
      {children}
    </WhiteLabelContext.Provider>
  );
};