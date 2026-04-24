import { useTheme } from 'next-themes';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import logoLight from '@/assets/rideflow-logo-light.png';
import logoDark from '@/assets/rideflow-logo-dark.png';

/**
 * Returns the appropriate brand logo URL based on the current theme and admin settings.
 * Priority: theme-specific admin logo > generic admin logo > default bundled logo
 */
export function useBrandLogo() {
  const { resolvedTheme } = useTheme();
  const { appearanceSettings } = useSystemSettings();

  const isDark = resolvedTheme === 'dark';

  // Theme-specific logos first, then generic logoUrl fallback, then bundled defaults
  const logoSrc = isDark
    ? (appearanceSettings.logoDarkUrl || appearanceSettings.logoUrl || logoDark)
    : (appearanceSettings.logoLightUrl || appearanceSettings.logoUrl || logoLight);

  return logoSrc;
}
