/**
 * Opens external navigation app with directions to a destination
 * Supports Google Maps, Apple Maps, and Waze
 */

import { toast } from 'sonner';
import { translations, TranslationKeys } from '@/i18n/translations';

// Helper to get current translations (utility files can't use hooks)
function getT(): TranslationKeys {
  const lang = localStorage.getItem('language_preference') || 'en';
  return (translations[lang as keyof typeof translations] || translations.en) as TranslationKeys;
}

interface NavigationOptions {
  destination: string;
  origin?: { lat: number; lng: number } | null;
  travelMode?: 'driving' | 'walking' | 'transit';
}

type NavigationApp = 'google' | 'apple' | 'waze';

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isAndroid(): boolean {
  return /Android/.test(navigator.userAgent);
}

export async function copyAddressToClipboard(address: string): Promise<boolean> {
  const t = getT();
  try {
    await navigator.clipboard.writeText(address);
    toast.success(t.navigationUtils.addressCopied);
    return true;
  } catch (err) {
    const textArea = document.createElement('textarea');
    textArea.value = address;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      toast.success(t.navigationUtils.addressCopied);
      return true;
    } catch {
      toast.error(t.navigationUtils.failedToCopy);
      return false;
    } finally {
      document.body.removeChild(textArea);
    }
  }
}

function showNavigationFallback(destination: string, appName: string): void {
  const t = getT();
  toast.error(t.navigationUtils.couldNotOpen.replace('{appName}', appName), {
    description: t.navigationUtils.tapToCopy,
    action: {
      label: t.navigationUtils.copyAddress,
      onClick: () => copyAddressToClipboard(destination),
    },
    duration: 8000,
  });
}

export function getPreferredNavigationApp(): NavigationApp {
  if (isIOS()) return 'apple';
  return 'google';
}

export function buildNavigationUrl(
  app: NavigationApp,
  options: NavigationOptions
): string {
  const { destination, origin, travelMode = 'driving' } = options;
  const encodedDestination = encodeURIComponent(destination);

  switch (app) {
    case 'google': {
      let url = `https://www.google.com/maps/dir/?api=1&destination=${encodedDestination}&travelmode=${travelMode}`;
      if (origin) {
        url += `&origin=${origin.lat},${origin.lng}`;
      }
      return url;
    }

    case 'apple': {
      let url = `https://maps.apple.com/?daddr=${encodedDestination}&dirflg=d`;
      if (origin) {
        url += `&saddr=${origin.lat},${origin.lng}`;
      }
      return url;
    }

    case 'waze': {
      return `https://waze.com/ul?q=${encodedDestination}&navigate=yes`;
    }

    default:
      return `https://www.google.com/maps/dir/?api=1&destination=${encodedDestination}`;
  }
}

function openLink(url: string, useSelf = false): boolean {
  try {
    const a = document.createElement('a');
    a.href = url;
    if (!useSelf) {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    }
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  } catch {
    return false;
  }
}

export function openNavigation(
  destination: string,
  currentLocation?: { lat: number; lng: number } | null,
  preferredApp?: NavigationApp
): void {
  const app = preferredApp || getPreferredNavigationApp();
  const appName = getNavigationAppName(app);
  
  const url = buildNavigationUrl(app, {
    destination,
    origin: currentLocation,
    travelMode: 'driving',
  });

  try {
    if (isAndroid() && app === 'google') {
      const geoUrl = `geo:0,0?q=${encodeURIComponent(destination)}`;
      if (!openLink(geoUrl, true)) {
        if (!openLink(url)) {
          showNavigationFallback(destination, appName);
        }
      }
      return;
    }

    if (isIOS() && app === 'apple') {
      const mapsUrl = `maps://?daddr=${encodeURIComponent(destination)}&dirflg=d`;
      if (!openLink(mapsUrl)) {
        if (!openLink(url)) {
          showNavigationFallback(destination, appName);
        }
      }
      return;
    }

    if (!openLink(url)) {
      showNavigationFallback(destination, appName);
    }
  } catch (error) {
    console.error('Navigation error:', error);
    showNavigationFallback(destination, appName);
  }
}

export function hasNativeNavigation(): boolean {
  return isIOS() || isAndroid();
}

export function getNavigationAppName(app: NavigationApp): string {
  switch (app) {
    case 'google':
      return 'Google Maps';
    case 'apple':
      return 'Apple Maps';
    case 'waze':
      return 'Waze';
    default:
      return 'Maps';
  }
}
