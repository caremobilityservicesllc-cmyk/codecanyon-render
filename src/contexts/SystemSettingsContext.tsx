import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { translations, type Language } from '@/i18n/translations';

interface BusinessInfo {
  companyName: string;
  email: string;
  phone: string;
  address: string;
  timezone: string;
  website: string;
  taxId: string;
  registrationNumber: string;
  tagline: string;
}

interface BusinessHours {
  start: string;
  end: string;
  daysOfWeek: string[];
}

interface CurrencySettings {
  code: string;
  symbol: string;
  position: 'before' | 'after';
}

type DistanceUnit = 'km' | 'miles';

interface DistanceUnitSettings {
  unit: DistanceUnit;
}

interface MapLocationSettings {
  defaultLat: number;
  defaultLng: number;
}


interface TaxSettings {
  enabled: boolean;
  rate: number;
  label: string;
  includeInPrice: boolean;
}

interface BookingPolicies {
  depositPercentage: number;
  cancellationHours: number;
  minAdvanceBookingHours: number;
  maxAdvanceBookingDays: number;
  pickupTimeInterval: number;
}

interface SocialLinks {
  facebook: string;
  twitter: string;
  instagram: string;
  linkedin: string;
  tiktok: string;
  youtube: string;
}

interface AppearanceSettings {
  primaryColor: string;
  accentColor: string;
  logoUrl: string;
  logoLightUrl: string;
  logoDarkUrl: string;
  faviconUrl: string;
  darkModeDefault: boolean;
  pwaIconUrl: string;
  showPreloader: boolean;
}

export interface SystemSettings {
  businessInfo: BusinessInfo;
  businessHours: BusinessHours;
  currency: CurrencySettings;
  taxSettings: TaxSettings;
  bookingPolicies: BookingPolicies;
  socialLinks: SocialLinks;
  appearanceSettings: AppearanceSettings;
  distanceUnit: DistanceUnitSettings;
  mapLocation: MapLocationSettings;
  defaultLanguage: Language;
  enabledLanguages: Language[];
  aiAssistantEnabled: boolean;
  isLoading: boolean;
  formatPrice: (amount: number) => string;
  formatDistance: (km: number) => string;
  convertDistance: (km: number) => number;
  distanceLabel: string;
  distanceAbbr: string;
}

const defaultSettings: SystemSettings = {
  businessInfo: {
    companyName: 'RideFlow',
    email: 'support@rideflow.com',
    phone: '+1 (555) 000-0000',
    address: '',
    timezone: 'UTC',
    website: '',
    taxId: '',
    registrationNumber: '',
    tagline: '',
  },
  businessHours: {
    start: '06:00',
    end: '22:00',
    daysOfWeek: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
  },
  currency: {
    code: 'USD',
    symbol: '$',
    position: 'before',
  },
  taxSettings: {
    enabled: false,
    rate: 0,
    label: 'VAT',
    includeInPrice: false,
  },
  bookingPolicies: {
    depositPercentage: 30,
    cancellationHours: 24,
    minAdvanceBookingHours: 2,
    maxAdvanceBookingDays: 30,
    pickupTimeInterval: 15,
  },
  socialLinks: {
    facebook: '',
    twitter: '',
    instagram: '',
    linkedin: '',
    tiktok: '',
    youtube: '',
  },
  appearanceSettings: {
    primaryColor: '#22c55e',
    accentColor: '#14b8a6',
    logoUrl: '',
    logoLightUrl: '',
    logoDarkUrl: '',
    faviconUrl: '',
    darkModeDefault: false,
    pwaIconUrl: '',
    showPreloader: true,
  },
  distanceUnit: {
    unit: 'km',
  },
  mapLocation: {
    defaultLat: 40.7128,
    defaultLng: -74.0060,
  },
  defaultLanguage: 'en',
  enabledLanguages: ['en'],
  aiAssistantEnabled: false,
  isLoading: true,
  formatPrice: (amount: number) => `$${amount.toFixed(2)}`,
  formatDistance: (km: number) => `${km.toFixed(1)} km`,
  convertDistance: (km: number) => km,
  distanceLabel: 'Kilometers',
  distanceAbbr: 'km',
};

const SystemSettingsContext = createContext<SystemSettings>(defaultSettings);

export function SystemSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);

  useEffect(() => {
    fetchSettings();

    // Subscribe to real-time changes on system_settings
    const channel = supabase
      .channel('system-settings-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'system_settings' },
        () => {
          fetchSettings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('key, value');

      if (error) {
        console.error('Error fetching system settings:', error);
        setSettings(prev => ({ ...prev, isLoading: false }));
        return;
      }

      const updates: Partial<SystemSettings> = {};

      data?.forEach((setting) => {
        const value = setting.value as Record<string, unknown>;
        switch (setting.key) {
          case 'business_info':
            updates.businessInfo = { ...defaultSettings.businessInfo, ...(value as unknown as Partial<BusinessInfo>) };
            break;
          case 'business_hours':
            updates.businessHours = value as unknown as BusinessHours;
            break;
          case 'currency':
            updates.currency = value as unknown as CurrencySettings;
            break;
          case 'tax_settings':
            updates.taxSettings = value as unknown as TaxSettings;
            break;
          case 'booking_policies':
            updates.bookingPolicies = value as unknown as BookingPolicies;
            break;
          case 'social_links':
            updates.socialLinks = value as unknown as SocialLinks;
            break;
          case 'appearance_settings':
            updates.appearanceSettings = value as unknown as AppearanceSettings;
            break;
          case 'distance_unit':
            updates.distanceUnit = value as unknown as DistanceUnitSettings;
            break;
          case 'map_location':
            updates.mapLocation = value as unknown as MapLocationSettings;
            break;
          case 'default_language':
            updates.defaultLanguage = (value as any)?.language || 'en';
            break;
          case 'enabled_languages':
            updates.enabledLanguages = (value as any)?.languages || ['en'];
            break;
          case 'ai_assistant_enabled':
            updates.aiAssistantEnabled = (value as any)?.enabled === true;
            break;
        }
      });

      const currency = updates.currency || defaultSettings.currency;
      const formatPrice = (amount: number) => {
        const formatted = amount.toFixed(2);
        return currency.position === 'before'
          ? `${currency.symbol}${formatted}`
          : `${formatted}${currency.symbol}`;
      };

      const companyName = updates.businessInfo?.companyName || defaultSettings.businessInfo.companyName;
      const tagline = updates.businessInfo?.tagline || '';
      const bizEmail = updates.businessInfo?.email || '';
      const bizWebsite = updates.businessInfo?.website || '';
      const lang = (localStorage.getItem('language_preference') || 'en') as Language;
      const currentT = (translations[lang] || translations.en) as any;
      const bookYourRide = currentT?.pageTitle?.bookYourRide || 'Book Your Ride';
      document.title = `${companyName} — ${bookYourRide}`;

      // Update OG and meta tags dynamically
      const ogTitle = tagline ? `${companyName} — ${tagline}` : `${companyName} — ${bookYourRide}`;
      const ogDesc = tagline
        ? `${tagline}. Book your premium ride with ${companyName}.`
        : `Book your premium ride with ${companyName}. Professional chauffeur services for airport transfers, hourly bookings, and more.`;
      const updateMeta = (selector: string, attr: string, value: string) => {
        const el = document.querySelector(selector);
        if (el) el.setAttribute(attr, value);
      };
      updateMeta('meta[property="og:title"]', 'content', ogTitle);
      updateMeta('meta[property="og:description"]', 'content', ogDesc);
      updateMeta('meta[name="description"]', 'content', ogDesc);
      updateMeta('meta[name="author"]', 'content', companyName);
      updateMeta('meta[name="apple-mobile-web-app-title"]', 'content', companyName);
      updateMeta('meta[name="twitter:site"]', 'content', bizWebsite ? `@${companyName}` : '');

      const distUnit = updates.distanceUnit?.unit || defaultSettings.distanceUnit.unit;
      const KM_TO_MILES = 0.621371;
      const convertDistance = (km: number) => distUnit === 'miles' ? km * KM_TO_MILES : km;
      const formatDistance = (km: number) => {
        const val = convertDistance(km);
        return `${val.toFixed(1)} ${distUnit === 'miles' ? 'mi' : 'km'}`;
      };

      setSettings(prev => {
        const finalSettings = {
          ...prev,
          ...updates,
          formatPrice,
          formatDistance,
          convertDistance,
          distanceLabel: distUnit === 'miles' ? 'Miles' : 'Kilometers',
          distanceAbbr: distUnit === 'miles' ? 'mi' : 'km',
          isLoading: false,
        };

        // Cache branding for instant preloader display on next visit
        try {
          const brandCache = {
            companyName: finalSettings.businessInfo.companyName,
            logoUrl: finalSettings.appearanceSettings.logoUrl,
            logoLightUrl: finalSettings.appearanceSettings.logoLightUrl,
            logoDarkUrl: finalSettings.appearanceSettings.logoDarkUrl,
          };
          localStorage.setItem('brand_cache', JSON.stringify(brandCache));
        } catch {}

        return finalSettings;
      });
    } catch (err) {
      console.error('Error fetching system settings:', err);
      setSettings(prev => ({ ...prev, isLoading: false }));
    }
  };

  // Track dark mode changes so we can re-apply brand colors
  const [isDarkMode, setIsDarkMode] = useState(() =>
    document.documentElement.classList.contains('dark')
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Apply appearance settings (brand colors, favicon) to the DOM
  const appliedRef = useRef<string>('');
  useEffect(() => {
    const { appearanceSettings } = settings;
    const key = JSON.stringify(appearanceSettings) + (isDarkMode ? ':dark' : ':light');
    if (appliedRef.current === key || settings.isLoading) return;
    appliedRef.current = key;

    // Helper: ensure a color is visible on the current background
    // In dark mode (bg ~7% lightness): colors below ~35% lightness are invisible
    // In light mode (bg ~98% lightness): colors above ~85% lightness are invisible
    const ensureContrast = (hsl: { h: number; s: number; l: number }) => {
      if (isDarkMode) {
        // In dark mode, ensure lightness is at least 50% for visibility
        return { ...hsl, l: Math.max(hsl.l, 50) };
      } else {
        // In light mode, ensure lightness is at most 45% for visibility
        return { ...hsl, l: Math.min(hsl.l, 45) };
      }
    };

    if (appearanceSettings.primaryColor) {
      const hsl = hexToHSL(appearanceSettings.primaryColor);
      if (hsl) {
        const adjusted = ensureContrast(hsl);
        const hslStr = `${adjusted.h} ${adjusted.s}% ${adjusted.l}%`;
        const rawHslStr = `${hsl.h} ${hsl.s}% ${hsl.l}%`;
        document.documentElement.style.setProperty('--brand-primary', rawHslStr);
        document.documentElement.style.setProperty('--brand-primary-hex', appearanceSettings.primaryColor);

        // Derive a contrasting foreground (white or black) based on adjusted luminance
        const fgColor = adjusted.l > 55 ? '0 0% 7%' : '0 0% 98%';

        // Apply to core theme tokens so all components pick up the brand color
        document.documentElement.style.setProperty('--primary', hslStr);
        document.documentElement.style.setProperty('--primary-foreground', fgColor);
        document.documentElement.style.setProperty('--ring', hslStr);

        // Step & vehicle selection states
        document.documentElement.style.setProperty('--step-active', hslStr);
        document.documentElement.style.setProperty('--step-complete', hslStr);
        document.documentElement.style.setProperty('--vehicle-selected', hslStr);

        // Sidebar primary
        document.documentElement.style.setProperty('--sidebar-primary', hslStr);
        document.documentElement.style.setProperty('--sidebar-primary-foreground', fgColor);
        document.documentElement.style.setProperty('--sidebar-ring', hslStr);
      }
    }
    if (appearanceSettings.accentColor) {
      const hsl = hexToHSL(appearanceSettings.accentColor);
      if (hsl) {
        const adjusted = ensureContrast(hsl);
        const hslStr = `${adjusted.h} ${adjusted.s}% ${adjusted.l}%`;
        const rawHslStr = `${hsl.h} ${hsl.s}% ${hsl.l}%`;
        const fgColor = adjusted.l > 55 ? '0 0% 7%' : '0 0% 98%';
        document.documentElement.style.setProperty('--brand-accent', rawHslStr);
        document.documentElement.style.setProperty('--brand-accent-hex', appearanceSettings.accentColor);

        // Apply accent to the accent token
        document.documentElement.style.setProperty('--accent', hslStr);
        document.documentElement.style.setProperty('--accent-foreground', fgColor);
      }
    }

    // Apply favicon
    if (appearanceSettings.faviconUrl) {
      const existingLink = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (existingLink) {
        existingLink.href = appearanceSettings.faviconUrl;
      } else {
        const link = document.createElement('link');
        link.rel = 'icon';
        link.href = appearanceSettings.faviconUrl;
        document.head.appendChild(link);
      }
    }

    // Apply apple-touch-icon
    if (appearanceSettings.pwaIconUrl) {
      const existingApple = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement;
      if (existingApple) {
        existingApple.href = appearanceSettings.pwaIconUrl;
      }
    }

    // Dynamic PWA manifest with admin icons
    if (appearanceSettings.pwaIconUrl) {
      const companyName = settings.businessInfo?.companyName || 'RideFlow';
      const tagline = settings.businessInfo?.tagline || 'Premium Ride Booking';
      const manifest = {
        name: `${companyName} — ${tagline}`,
        short_name: companyName,
        description: `Book your premium ride with ${companyName}. ${tagline}`,
        theme_color: appearanceSettings.primaryColor || '#149073',
        background_color: '#121212',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: appearanceSettings.pwaIconUrl, sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: appearanceSettings.pwaIconUrl, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      };
      const blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
      const manifestUrl = URL.createObjectURL(blob);
      let manifestLink = document.querySelector("link[rel='manifest']") as HTMLLinkElement;
      if (manifestLink) {
        manifestLink.href = manifestUrl;
      } else {
        manifestLink = document.createElement('link');
        manifestLink.rel = 'manifest';
        manifestLink.href = manifestUrl;
        document.head.appendChild(manifestLink);
      }
    }
  }, [settings.appearanceSettings, settings.isLoading, isDarkMode]);

  return (
    <SystemSettingsContext.Provider value={settings}>
      {children}
    </SystemSettingsContext.Provider>
  );
}

// Convert hex color to HSL
function hexToHSL(hex: string): { h: number; s: number; l: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function useSystemSettings() {
  return useContext(SystemSettingsContext);
}
