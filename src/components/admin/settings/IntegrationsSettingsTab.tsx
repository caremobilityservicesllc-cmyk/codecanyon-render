import { useState, useEffect } from 'react';
import { CreditCard, DollarSign, Mail, Check, Building2, Brain, Activity, ExternalLink, Key, Trash2, Loader2, CheckCircle2, Power, Shield, Apple, Twitter, Facebook } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ApiQuotaAlertBanner } from '@/components/admin/ApiQuotaAlertBanner';
import { EmailProviderConfig } from '@/components/admin/settings/EmailProviderConfig';
import { EmailDeliveryLogs } from '@/components/admin/settings/EmailDeliveryLogs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { useLanguage } from '@/contexts/LanguageContext';
import type { StripeSettings, PayPalSettings, BankTransferSettings } from './types';

interface IntegrationsSettingsTabProps {
  stripeSettings: StripeSettings;
  paypalSettings: PayPalSettings;
  bankSettings: BankTransferSettings;
  onOpenStripeDialog: () => void;
  onOpenPaypalDialog: () => void;
  onOpenBankDialog: () => void;
}

export function IntegrationsSettingsTab({
  stripeSettings,
  paypalSettings,
  bankSettings,
  onOpenStripeDialog,
  onOpenPaypalDialog,
  onOpenBankDialog,
}: IntegrationsSettingsTabProps) {
  const { t } = useLanguage();
  const [aiUsageStats, setAiUsageStats] = useState<{ total_requests: number; last_used: string | null }>({ total_requests: 0, last_used: null });
  const [aiKeyStatus, setAiKeyStatus] = useState<{ google_gemini: { configured: boolean; preview: string }; openai: { configured: boolean; preview: string } }>({
    google_gemini: { configured: false, preview: '' },
    openai: { configured: false, preview: '' },
  });
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiEnabledLoading, setAiEnabledLoading] = useState(false);
  const [geminiDialogOpen, setGeminiDialogOpen] = useState(false);
  const [openaiDialogOpen, setOpenaiDialogOpen] = useState(false);
  const [geminiKey, setGeminiKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [savingProvider, setSavingProvider] = useState<string | null>(null);
  const [socialLoginEnabled, setSocialLoginEnabled] = useState<{ google: boolean; apple: boolean; twitter: boolean; facebook: boolean }>({ google: false, apple: false, twitter: false, facebook: false });
  const [savingAuthProvider, setSavingAuthProvider] = useState<string | null>(null);

  const fetchAiKeyStatus = async () => {
    try {
      const { data } = await supabase.from('system_settings').select('key, value').in('key', ['ai_key_google_gemini', 'ai_key_openai', 'ai_assistant_enabled']);
      if (data) {
        const status = { ...aiKeyStatus };
        for (const s of data) {
          const val = s.value as any;
          if (s.key === 'ai_key_google_gemini' && val?.apiKey) status.google_gemini = { configured: true, preview: val.preview || '' };
          if (s.key === 'ai_key_openai' && val?.apiKey) status.openai = { configured: true, preview: val.preview || '' };
          if (s.key === 'ai_assistant_enabled') setAiEnabled(val?.enabled === true);
        }
        setAiKeyStatus(status);
      }
    } catch (err) { console.error('Failed to fetch AI key status:', err); }
  };

  const handleToggleAiAssistant = async (enabled: boolean) => {
    // Built-in AI gateway is always available, so no need to block enabling
    setAiEnabledLoading(true);
    try {
      const { error } = await supabase.from('system_settings').upsert({ key: 'ai_assistant_enabled', value: { enabled }, category: 'integrations', description: 'Enable or disable AI assistant features across the app', updated_at: new Date().toISOString() }, { onConflict: 'key' });
      if (error) throw error;
      setAiEnabled(enabled);
      toast.success(enabled ? t.adminSettings.aiAssistantEnabled : t.adminSettings.aiAssistantDisabled);
    } catch (err) { toast.error(t.integrationsSettings.failedToUpdateAi); }
    finally { setAiEnabledLoading(false); }
  };

  const handleSaveAiKey = async (provider: 'google_gemini' | 'openai', apiKey: string) => {
    if (!apiKey.trim()) return;
    setSavingProvider(provider);
    try {
      const { data, error } = await supabase.functions.invoke('update-ai-secret', { body: { provider, apiKey: apiKey.trim() } });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast.success(data?.message || t.integrationsSettings.apiKeySaved);
      if (provider === 'google_gemini') { setGeminiKey(''); setGeminiDialogOpen(false); }
      else { setOpenaiKey(''); setOpenaiDialogOpen(false); }
      fetchAiKeyStatus();
    } catch (err) { toast.error(err instanceof Error ? err.message : t.integrationsSettings.failedToSaveKey); }
    finally { setSavingProvider(null); }
  };

  const handleClearAiKey = async (provider: 'google_gemini' | 'openai') => {
    setSavingProvider(provider);
    try {
      const { data, error } = await supabase.functions.invoke('update-ai-secret', { body: { provider, action: 'clear' } });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast.success(t.adminSettings.keyRemovedSuccess);
      fetchAiKeyStatus();
    } catch (err) { toast.error(t.adminSettings.failedToRemoveKey); }
    finally { setSavingProvider(null); }
  };

  const fetchAuthProviderStatus = async () => {
    try {
      const { data } = await supabase.from('system_settings').select('key, value').in('key', ['auth_provider_google', 'auth_provider_apple', 'auth_provider_twitter', 'auth_provider_facebook']);
      if (data) {
        const status = { google: false, apple: false, twitter: false, facebook: false };
        for (const s of data) {
          const val = s.value as any;
          if (s.key === 'auth_provider_google' && val?.enabled) status.google = true;
          if (s.key === 'auth_provider_apple' && val?.enabled) status.apple = true;
          if (s.key === 'auth_provider_twitter' && val?.enabled) status.twitter = true;
          if (s.key === 'auth_provider_facebook' && val?.enabled) status.facebook = true;
        }
        setSocialLoginEnabled(status);
      }
    } catch (err) { console.error('Failed to fetch auth provider status:', err); }
  };

  const handleToggleAuthProvider = async (provider: 'google' | 'apple' | 'twitter' | 'facebook', enabled: boolean) => {
    setSavingAuthProvider(provider);
    try {
      const { error } = await supabase.from('system_settings').upsert({ key: `auth_provider_${provider}`, value: { enabled }, category: 'auth', description: `Toggle ${provider} social sign-in visibility`, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      if (error) throw error;
      setSocialLoginEnabled(prev => ({ ...prev, [provider]: enabled }));
      const labels: Record<string, string> = { google: 'Google', apple: 'Apple', twitter: 'X / Twitter', facebook: 'Facebook' };
      const ie = (t as any).integrationsExtra || {};
      const msg = enabled
        ? (ie.signInEnabled || '{provider} Sign-In enabled').replace('{provider}', labels[provider])
        : (ie.signInDisabled || '{provider} Sign-In disabled').replace('{provider}', labels[provider]);
      toast.success(msg);
    } catch (err) { toast.error(t.adminSettings.failedToUpdateProvider); }
    finally { setSavingAuthProvider(null); }
  };

  useEffect(() => {
    fetchAiKeyStatus();
    fetchAuthProviderStatus();
    const fetchAiStats = async () => {
      try {
        const { data } = await supabase.from('map_api_usage').select('request_count, recorded_at').in('provider', ['lovable_ai', 'gemini', 'openai']).order('recorded_at', { ascending: false });
        if (data && data.length > 0) {
          const total = data.reduce((sum, r) => sum + r.request_count, 0);
          setAiUsageStats({ total_requests: total, last_used: data[0].recorded_at });
        }
      } catch (err) { console.error('Failed to fetch AI stats:', err); }
    };
    fetchAiStats();
  }, []);

  return (
    <div className="space-y-6">
      <ApiQuotaAlertBanner />

      {/* Authentication Providers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            {t.adminSettings.authenticationProviders}
          </CardTitle>
          <CardDescription>{t.adminSettings.authProvidersDesc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Google */}
          <div className="flex items-center justify-between rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <svg className="h-5 w-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
              </div>
              <div>
                <p className="font-medium">{t.adminSettings.googleSignIn}</p>
                <p className="text-sm text-muted-foreground">{t.adminSettings.googleSignInDesc}</p>
              </div>
            </div>
            <Switch checked={socialLoginEnabled.google} onCheckedChange={(checked) => handleToggleAuthProvider('google', checked)} disabled={savingAuthProvider === 'google'} />
          </div>

          {/* Apple */}
          <div className="flex items-center justify-between rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted"><Apple className="h-5 w-5 text-foreground" /></div>
              <div>
                <p className="font-medium">{t.adminSettings.appleSignIn}</p>
                <p className="text-sm text-muted-foreground">{t.adminSettings.appleSignInDesc}</p>
              </div>
            </div>
            <Switch checked={socialLoginEnabled.apple} onCheckedChange={(checked) => handleToggleAuthProvider('apple', checked)} disabled={savingAuthProvider === 'apple'} />
          </div>

          {/* X / Twitter */}
          <div className="flex items-center justify-between rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted"><Twitter className="h-5 w-5 text-foreground" /></div>
              <div>
                <p className="font-medium">{t.adminSettings.xTwitterSignIn}</p>
                <p className="text-sm text-muted-foreground">{t.adminSettings.xTwitterSignInDesc}</p>
              </div>
            </div>
            <Switch checked={socialLoginEnabled.twitter} onCheckedChange={(checked) => handleToggleAuthProvider('twitter', checked)} disabled={savingAuthProvider === 'twitter'} />
          </div>

          {/* Facebook */}
          <div className="flex items-center justify-between rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><Facebook className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="font-medium">{t.adminSettings.facebookSignIn}</p>
                <p className="text-sm text-muted-foreground">{t.adminSettings.facebookSignInDesc}</p>
              </div>
            </div>
            <Switch checked={socialLoginEnabled.facebook} onCheckedChange={(checked) => handleToggleAuthProvider('facebook', checked)} disabled={savingAuthProvider === 'facebook'} />
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
            <p className="text-xs text-muted-foreground">{t.adminSettings.toggleProviderHint}</p>
            <p className="text-xs text-muted-foreground">{t.adminSettings.configureProviderHint}</p>
          </div>
        </CardContent>
      </Card>

      {/* AI Services */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            {t.adminSettings.aiServices}
          </CardTitle>
          <CardDescription>{t.adminSettings.aiServicesDesc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* AI Toggle */}
          <div className="flex items-center justify-between rounded-lg border border-border p-4 bg-muted/30">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><Power className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="font-medium">{t.adminSettings.aiAssistant}</p>
                <p className="text-sm text-muted-foreground">{t.adminSettings.aiAssistantDesc}</p>
              </div>
            </div>
            <Switch checked={aiEnabled} onCheckedChange={handleToggleAiAssistant} disabled={aiEnabledLoading} />
          </div>

          {!aiKeyStatus.google_gemini.configured && !aiKeyStatus.openai.configured && (
            <div className="rounded-lg border border-blue-300 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 p-4 space-y-1">
              <p className="text-sm font-medium text-blue-700 dark:text-blue-400">
                {(t.adminSettings as any).builtInAiActive || 'Built-in AI is active — no API key required for AI features like translations.'}
              </p>
              <p className="text-xs text-blue-600/80 dark:text-blue-400/70">
                {(t.adminSettings as any).customKeyOptional || 'Optionally add your own Google Gemini or OpenAI key below for higher rate limits or self-hosted deployments.'}
              </p>
            </div>
          )}

          {/* Google Gemini */}
          <div className="flex items-center justify-between rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                <svg className="h-5 w-5 text-blue-500" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 19.5h20L12 2zm0 4l6.9 11.5H5.1L12 6z" /></svg>
              </div>
              <div>
                <p className="font-medium">{t.adminSettings.googleGeminiApi}</p>
                <p className="text-sm text-muted-foreground">
                  {aiKeyStatus.google_gemini.configured ? `${t.adminSettings.keyConfigured} (${aiKeyStatus.google_gemini.preview})` : t.adminSettings.addGeminiKey}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {aiKeyStatus.google_gemini.configured ? (
                <>
                  <Badge className="bg-accent/20 text-accent border-accent/30">{t.adminSettings.customKey}</Badge>
                  <Button variant="ghost" size="sm" onClick={() => handleClearAiKey('google_gemini')} disabled={savingProvider === 'google_gemini'}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">{t.adminSettings.notSet}</Badge>
              )}
              <Dialog open={geminiDialogOpen} onOpenChange={setGeminiDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1"><Key className="h-3.5 w-3.5" />{aiKeyStatus.google_gemini.configured ? t.common.edit : t.adminSettings.addKey}</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>{t.adminSettings.googleGeminiApi}</DialogTitle>
                    <DialogDescription>{t.adminSettings.enterApiKey}</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 py-3">
                    <Label htmlFor="gemini-key">{t.adminSettings.apiKey}</Label>
                    <Input id="gemini-key" type="password" placeholder="AIza..." value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} className="font-mono text-sm" autoComplete="off" />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => { setGeminiKey(''); setGeminiDialogOpen(false); }}>{t.common.cancel}</Button>
                    <Button onClick={() => handleSaveAiKey('google_gemini', geminiKey)} disabled={!geminiKey.trim() || savingProvider === 'google_gemini'}>
                      {savingProvider === 'google_gemini' ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t.common.saving}</> : t.common.save}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* OpenAI */}
          <div className="flex items-center justify-between rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                <svg className="h-5 w-5 text-emerald-500" viewBox="0 0 24 24" fill="currentColor"><path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.998 5.998 0 0 0-3.998 2.9 6.042 6.042 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" /></svg>
              </div>
              <div>
                <p className="font-medium">{t.adminSettings.openAiApi}</p>
                <p className="text-sm text-muted-foreground">
                  {aiKeyStatus.openai.configured ? `${t.adminSettings.keyConfigured} (${aiKeyStatus.openai.preview})` : t.adminSettings.addOpenAiKey}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {aiKeyStatus.openai.configured ? (
                <>
                  <Badge className="bg-accent/20 text-accent border-accent/30">{t.adminSettings.customKey}</Badge>
                  <Button variant="ghost" size="sm" onClick={() => handleClearAiKey('openai')} disabled={savingProvider === 'openai'}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">{(t as any).integrationsExtra?.viaGateway || 'Via Gateway'}</Badge>
              )}
              <Dialog open={openaiDialogOpen} onOpenChange={setOpenaiDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1"><Key className="h-3.5 w-3.5" />{aiKeyStatus.openai.configured ? t.common.edit : t.adminSettings.addKey}</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>{t.adminSettings.openAiApi}</DialogTitle>
                    <DialogDescription>{t.adminSettings.enterApiKey}</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 py-3">
                    <Label htmlFor="openai-key">{t.adminSettings.apiKey}</Label>
                    <Input id="openai-key" type="password" placeholder="sk-..." value={openaiKey} onChange={(e) => setOpenaiKey(e.target.value)} className="font-mono text-sm" autoComplete="off" />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => { setOpenaiKey(''); setOpenaiDialogOpen(false); }}>{t.common.cancel}</Button>
                    <Button onClick={() => handleSaveAiKey('openai', openaiKey)} disabled={!openaiKey.trim() || savingProvider === 'openai'}>
                      {savingProvider === 'openai' ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t.common.saving}</> : t.common.save}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Usage Stats */}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">{(t as any).integrationsExtra?.aiApiUsage || 'AI API Usage'}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-2xl font-bold">{aiUsageStats.total_requests.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{(t as any).integrationsExtra?.totalRequests || 'Total requests'}</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{aiUsageStats.last_used ? new Date(aiUsageStats.last_used).toLocaleDateString() : '—'}</p>
                <p className="text-xs text-muted-foreground">{(t as any).integrationsExtra?.lastActive || 'Last active'}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            {t.adminSettings.paymentGateways}
          </CardTitle>
          <CardDescription>{t.adminSettings.paymentGatewaysDesc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stripe */}
          <div className="flex items-center justify-between rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stripeSettings.enabled ? 'bg-primary/10' : 'bg-muted'}`}>
                <CreditCard className={`h-5 w-5 ${stripeSettings.enabled ? 'text-primary' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <p className="font-medium">Stripe</p>
                <p className="text-sm text-muted-foreground">
                  {stripeSettings.enabled ? `${stripeSettings.mode === 'test' ? ((t as any).integrationsExtra?.testMode || 'Test') : ((t as any).integrationsExtra?.liveMode || 'Live')} mode enabled` : t.adminSettings.stripeDesc}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {stripeSettings.enabled && (
                <Badge variant={stripeSettings.mode === 'live' ? 'default' : 'secondary'} className={stripeSettings.mode === 'live' ? 'bg-accent/20 text-accent border-accent/30' : 'bg-warning/20 text-warning border-warning/30'}>
                  {stripeSettings.mode === 'live' ? ((t as any).integrationsExtra?.liveMode || 'Live') : ((t as any).integrationsExtra?.testMode || 'Test')}
                </Badge>
              )}
              <Button variant="outline" size="sm" onClick={onOpenStripeDialog}>{t.adminSettings.configure}</Button>
            </div>
          </div>
          
          {/* PayPal */}
          <div className="flex items-center justify-between rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${paypalSettings.enabled ? 'bg-primary/10' : 'bg-muted'}`}>
                <DollarSign className={`h-5 w-5 ${paypalSettings.enabled ? 'text-primary' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <p className="font-medium">PayPal</p>
                <p className="text-sm text-muted-foreground">
                  {paypalSettings.enabled ? `${paypalSettings.mode === 'test' ? ((t as any).integrationsExtra?.sandboxMode || 'Sandbox') : ((t as any).adminScheduling?.productionMode || 'Production')} mode enabled` : t.adminSettings.paypalDesc}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {paypalSettings.enabled && (
                <Badge variant={paypalSettings.mode === 'live' ? 'default' : 'secondary'} className={paypalSettings.mode === 'live' ? 'bg-accent/20 text-accent border-accent/30' : 'bg-warning/20 text-warning border-warning/30'}>
                  {paypalSettings.mode === 'live' ? ((t as any).integrationsExtra?.liveMode || 'Live') : ((t as any).integrationsExtra?.sandboxMode || 'Sandbox')}
                </Badge>
              )}
              <Button variant="outline" size="sm" onClick={onOpenPaypalDialog}>{t.adminSettings.configure}</Button>
            </div>
          </div>

          {/* Bank Transfer */}
          <div className="flex items-center justify-between rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${bankSettings.enabled ? 'bg-primary/10' : 'bg-muted'}`}>
                <Building2 className={`h-5 w-5 ${bankSettings.enabled ? 'text-primary' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <p className="font-medium">{t.adminSettings.bankTransferPayments}</p>
                <p className="text-sm text-muted-foreground">
                  {bankSettings.enabled ? `${bankSettings.bankName || ((t as any).integrationsExtra?.configured || 'Configured')}` : t.adminSettings.bankTransferPaymentsDesc}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {bankSettings.enabled && <Badge className="bg-accent/20 text-accent border-accent/30">{(t as any).integrationsExtra?.active || 'Active'}</Badge>}
              <Button variant="outline" size="sm" onClick={onOpenBankDialog}>{t.adminSettings.configure}</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <EmailProviderConfig />
      <EmailDeliveryLogs />
    </div>
  );
}