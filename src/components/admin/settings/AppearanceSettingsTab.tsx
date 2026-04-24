import { Palette, Image, Eye, Sun, Moon, Smartphone } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { BrandingUpload } from '@/components/admin/settings/BrandingUpload';
import { PRIMARY_COLORS } from './constants';
import { useLanguage } from '@/contexts/LanguageContext';
import type { AppearanceSettings } from './types';

interface AppearanceSettingsTabProps {
  appearanceSettings: AppearanceSettings;
  setAppearanceSettings: React.Dispatch<React.SetStateAction<AppearanceSettings>>;
}

export function AppearanceSettingsTab({
  appearanceSettings,
  setAppearanceSettings,
}: AppearanceSettingsTabProps) {
  const { t } = useLanguage();
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            {t.adminSettings.brandColors}
          </CardTitle>
          <CardDescription>{t.adminSettings.customizeBrandColors}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label>{t.adminSettings.primaryColor}</Label>
            <div className="flex flex-wrap gap-3">
              {PRIMARY_COLORS.map((color) => (
                <button key={color.value} type="button" onClick={() => setAppearanceSettings(prev => ({ ...prev, primaryColor: color.value }))} className={`h-10 w-10 rounded-lg border-2 transition-all ${appearanceSettings.primaryColor === color.value ? 'border-foreground scale-110 ring-2 ring-offset-2 ring-foreground' : 'border-transparent hover:scale-105'}`} style={{ backgroundColor: color.value }} title={color.name} />
              ))}
              <div className="space-y-1">
                <Input type="color" value={appearanceSettings.primaryColor} onChange={(e) => setAppearanceSettings(prev => ({ ...prev, primaryColor: e.target.value }))} className="h-10 w-10 cursor-pointer p-1" />
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <Label>{t.adminSettings.accentColor}</Label>
            <div className="flex flex-wrap gap-3">
              {PRIMARY_COLORS.map((color) => (
                <button key={color.value} type="button" onClick={() => setAppearanceSettings(prev => ({ ...prev, accentColor: color.value }))} className={`h-10 w-10 rounded-lg border-2 transition-all ${appearanceSettings.accentColor === color.value ? 'border-foreground scale-110 ring-2 ring-offset-2 ring-foreground' : 'border-transparent hover:scale-105'}`} style={{ backgroundColor: color.value }} title={color.name} />
              ))}
              <div className="space-y-1">
                <Input type="color" value={appearanceSettings.accentColor} onChange={(e) => setAppearanceSettings(prev => ({ ...prev, accentColor: e.target.value }))} className="h-10 w-10 cursor-pointer p-1" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image className="h-5 w-5 text-primary" />
            {t.adminSettings.brandingAssets}
          </CardTitle>
          <CardDescription>{t.adminSettings.brandingAssetsDesc}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <BrandingUpload label={<span className="flex items-center gap-1.5"><Sun className="h-4 w-4" /> {t.adminSettings.logoLightMode}</span>} description={t.adminSettings.logoLightModeDesc} currentUrl={appearanceSettings.logoLightUrl} onUpload={(url) => setAppearanceSettings(prev => ({ ...prev, logoLightUrl: url }))} onRemove={() => setAppearanceSettings(prev => ({ ...prev, logoLightUrl: '' }))} uploadPath="logo-light" previewSize="large" />
          <BrandingUpload label={<span className="flex items-center gap-1.5"><Moon className="h-4 w-4" /> {t.adminSettings.logoDarkMode}</span>} description={t.adminSettings.logoDarkModeDesc} currentUrl={appearanceSettings.logoDarkUrl} onUpload={(url) => setAppearanceSettings(prev => ({ ...prev, logoDarkUrl: url }))} onRemove={() => setAppearanceSettings(prev => ({ ...prev, logoDarkUrl: '' }))} uploadPath="logo-dark" previewSize="large" />
          <BrandingUpload label={t.adminSettings.favicon} description={t.adminSettings.faviconDesc} currentUrl={appearanceSettings.faviconUrl} onUpload={(url) => setAppearanceSettings(prev => ({ ...prev, faviconUrl: url }))} onRemove={() => setAppearanceSettings(prev => ({ ...prev, faviconUrl: '' }))} uploadPath="favicon" previewSize="small" />
          <BrandingUpload label={<span className="flex items-center gap-1.5"><Smartphone className="h-4 w-4" /> {t.adminSettings.pwaAppIcon}</span>} description={t.adminSettings.pwaAppIconDesc} currentUrl={appearanceSettings.pwaIconUrl} onUpload={(url) => setAppearanceSettings(prev => ({ ...prev, pwaIconUrl: url }))} onRemove={() => setAppearanceSettings(prev => ({ ...prev, pwaIconUrl: '' }))} uploadPath="pwa-icon" previewSize="large" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            {t.adminSettings.displayPreferences}
          </CardTitle>
          <CardDescription>{t.adminSettings.displayPreferencesDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t.adminSettings.darkModeDefault}</Label>
              <p className="text-xs text-muted-foreground">{t.adminSettings.darkModeDefaultHint}</p>
            </div>
            <Switch checked={appearanceSettings.darkModeDefault} onCheckedChange={(checked) => setAppearanceSettings(prev => ({ ...prev, darkModeDefault: checked }))} />
          </div>
          <div className="mt-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t.adminSettings.showPreloader}</Label>
              <p className="text-xs text-muted-foreground">{t.adminSettings.showPreloaderHint}</p>
            </div>
            <Switch checked={appearanceSettings.showPreloader ?? true} onCheckedChange={(checked) => setAppearanceSettings(prev => ({ ...prev, showPreloader: checked }))} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}