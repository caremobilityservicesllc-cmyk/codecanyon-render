import { Shield, Eye } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useLanguage } from '@/contexts/LanguageContext';
import type { SecuritySettings } from './types';

interface SecuritySettingsTabProps {
  securitySettings: SecuritySettings;
  setSecuritySettings: React.Dispatch<React.SetStateAction<SecuritySettings>>;
}

export function SecuritySettingsTab({
  securitySettings,
  setSecuritySettings,
}: SecuritySettingsTabProps) {
  const { t } = useLanguage();
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            {t.adminSettings.authenticationSettings}
          </CardTitle>
          <CardDescription>{t.adminSettings.authSettingsDesc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t.adminSettings.requireEmailVerification}</Label>
              <p className="text-xs text-muted-foreground">{t.adminSettings.requireEmailVerificationHint}</p>
            </div>
            <Switch checked={securitySettings.requireEmailVerification} onCheckedChange={(checked) => setSecuritySettings(prev => ({ ...prev, requireEmailVerification: checked }))} />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                {t.adminSettings.twoFactorAuth}
                <Badge variant="outline" className="text-xs">{t.adminSettings.twoFactorAuthLabel}</Badge>
              </Label>
              <p className="text-xs text-muted-foreground">{t.adminSettings.twoFactorAuthHint}</p>
            </div>
            <Switch checked={securitySettings.twoFactorEnabled} onCheckedChange={(checked) => setSecuritySettings(prev => ({ ...prev, twoFactorEnabled: checked }))} />
          </div>

          <Separator />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sessionTimeout">{t.adminSettings.sessionTimeout}</Label>
              <Input id="sessionTimeout" type="number" min={5} max={1440} value={securitySettings.sessionTimeout} onChange={(e) => setSecuritySettings(prev => ({ ...prev, sessionTimeout: parseInt(e.target.value) || 60 }))} />
              <p className="text-xs text-muted-foreground">{t.adminSettings.sessionTimeoutHint}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxLoginAttempts">{t.adminSettings.maxLoginAttempts}</Label>
              <Input id="maxLoginAttempts" type="number" min={3} max={10} value={securitySettings.maxLoginAttempts} onChange={(e) => setSecuritySettings(prev => ({ ...prev, maxLoginAttempts: parseInt(e.target.value) || 5 }))} />
              <p className="text-xs text-muted-foreground">{t.adminSettings.maxLoginAttemptsHint}</p>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="ipWhitelist">{t.adminSettings.ipWhitelist}</Label>
            <Input id="ipWhitelist" value={securitySettings.ipWhitelist} onChange={(e) => setSecuritySettings(prev => ({ ...prev, ipWhitelist: e.target.value }))} placeholder={t.adminSettings.ipWhitelistPlaceholder} />
            <p className="text-xs text-muted-foreground">{t.adminSettings.ipWhitelistHint}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            {t.adminSettings.privacyData}
          </CardTitle>
          <CardDescription>{t.adminSettings.privacyDataDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>{t.adminSettings.dataRetentionNote}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}