import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { useBrandLogo } from '@/hooks/useBrandLogo';
import { useLanguage } from '@/contexts/LanguageContext';
import { useMemo } from 'react';

/** Read cached branding from localStorage for instant display before settings load */
function getCachedBrand() {
  try {
    const raw = localStorage.getItem('brand_cache');
    if (raw) return JSON.parse(raw) as {
      companyName?: string;
      logoUrl?: string;
      logoLightUrl?: string;
      logoDarkUrl?: string;
    };
  } catch {}
  return null;
}

export function LoadingScreen() {
  const { businessInfo, appearanceSettings, isLoading } = useSystemSettings();
  const { t } = useLanguage();
  const logoFromHook = useBrandLogo();

  const cached = useMemo(() => getCachedBrand(), []);

  // Use live settings when available, otherwise fall back to cache
  const appName = (!isLoading && businessInfo.companyName) || cached?.companyName || 'RideFlow';

  const logoSrc = useMemo(() => {
    if (!isLoading) return logoFromHook;
    // While loading, try cached logo matching current theme
    if (cached) {
      const isDark = document.documentElement.classList.contains('dark');
      return isDark
        ? (cached.logoDarkUrl || cached.logoUrl || logoFromHook)
        : (cached.logoLightUrl || cached.logoUrl || logoFromHook);
    }
    return logoFromHook;
  }, [isLoading, logoFromHook, cached]);

  if (appearanceSettings.showPreloader === false && !isLoading) {
    return null;
  }
  
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
      <div className="relative mb-8 animate-pulse">
        <img 
          src={logoSrc} 
          alt={`${appName} Logo`}
          className="h-20 w-20 rounded-2xl object-contain"
        />
        <div className="absolute inset-0 -z-10 rounded-2xl bg-primary/20 blur-xl" />
      </div>
      
      <h1 className="mb-6 font-display text-2xl font-bold text-foreground">
        {appName}
      </h1>
      
      <div className="relative h-10 w-10">
        <div className="absolute inset-0 rounded-full border-2 border-muted" />
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-primary" 
          style={{ animationDuration: '1s' }} 
        />
      </div>
      
      <p className="mt-4 text-sm text-muted-foreground">{(t as any).loadingScreen?.loadingExperience || 'Loading your experience...'}</p>
    </div>
  );
}
