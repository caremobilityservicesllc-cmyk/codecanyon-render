import { useState, useEffect } from 'react';
import { Mail, MessageSquare, Key, Phone, Loader2, CheckCircle2, ShieldCheck, Send } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import type { EmailSettings, SmsSettings } from './types';

interface SmsSecretsConfig {
  provider: string;
  secrets: Record<string, { configured: boolean; preview: string }>;
  lastUpdated?: string;
}

interface NotificationSettingsTabProps {
  emailSettings: EmailSettings;
  setEmailSettings: React.Dispatch<React.SetStateAction<EmailSettings>>;
  smsSettings: SmsSettings;
  setSmsSettings: React.Dispatch<React.SetStateAction<SmsSettings>>;
}

function getProviderFields(ne: any): Record<string, { key: string; label: string; placeholder: string; sensitive: boolean }[]> {
  return {
    twilio: [
      { key: 'SMS_TWILIO_ACCOUNT_SID', label: ne?.accountSid || 'Account SID', placeholder: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', sensitive: true },
      { key: 'SMS_TWILIO_AUTH_TOKEN', label: ne?.authToken || 'Auth Token', placeholder: 'Your auth token', sensitive: true },
      { key: 'SMS_TWILIO_FROM_NUMBER', label: ne?.fromNumber || 'From Number', placeholder: '+1234567890', sensitive: false },
    ],
    nexmo: [
      { key: 'SMS_NEXMO_API_KEY', label: ne?.apiKey || 'API Key', placeholder: 'Your API key', sensitive: true },
      { key: 'SMS_NEXMO_API_SECRET', label: ne?.apiSecret || 'API Secret', placeholder: 'Your API secret', sensitive: true },
      { key: 'SMS_NEXMO_FROM_NUMBER', label: ne?.fromNumber || 'From Number', placeholder: '+1234567890', sensitive: false },
    ],
    messagebird: [
      { key: 'SMS_MESSAGEBIRD_API_KEY', label: ne?.apiKey || 'API Key', placeholder: 'Your API key', sensitive: true },
      { key: 'SMS_MESSAGEBIRD_ORIGINATOR', label: ne?.originator || 'Originator', placeholder: 'YourCompany or +1234567890', sensitive: false },
    ],
  };
}

export function NotificationSettingsTab({
  emailSettings,
  setEmailSettings,
  smsSettings,
  setSmsSettings,
}: NotificationSettingsTabProps) {
  const [secretValues, setSecretValues] = useState<Record<string, string>>({});
  const [secretsConfig, setSecretsConfig] = useState<SmsSecretsConfig | null>(null);
  const [savingSecrets, setSavingSecrets] = useState(false);
  const [testSmsDialogOpen, setTestSmsDialogOpen] = useState(false);
  const [testPhoneNumber, setTestPhoneNumber] = useState('');
  const [sendingTestSms, setSendingTestSms] = useState(false);
  const [testSmsResult, setTestSmsResult] = useState<{ success: boolean; message: string; preview?: string } | null>(null);
  const { t } = useLanguage();
  const ne = (t as any).notificationExtra || {};
  const PROVIDER_FIELDS = getProviderFields(ne);

  useEffect(() => {
    async function loadSecretsConfig() {
      const { data } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'sms_secrets_config')
        .maybeSingle();
      if (data?.value) {
        setSecretsConfig(data.value as unknown as SmsSecretsConfig);
      }
    }
    loadSecretsConfig();
  }, []);

  const handleSaveSecrets = async () => {
    if (!smsSettings.provider) return;
    const fields = PROVIDER_FIELDS[smsSettings.provider];
    if (!fields) return;
    const hasValues = fields.some(f => secretValues[f.key]?.trim());
    if (!hasValues) {
      toast.error(t.adminSettings.enterCredential);
      return;
    }
    setSavingSecrets(true);
    try {
      const secrets: Record<string, string> = {};
      fields.forEach(f => { if (secretValues[f.key]?.trim()) secrets[f.key] = secretValues[f.key].trim(); });
      const { data, error } = await supabase.functions.invoke('update-sms-secret', { body: { provider: smsSettings.provider, secrets } });
      if (error) throw error;
      setSecretsConfig({ provider: smsSettings.provider, secrets: data.configuredSecrets, lastUpdated: new Date().toISOString() });
      setSecretValues({});
      toast.success(t.adminSettings.smsSavedSecurely);
    } catch (err) {
      console.error('Error saving SMS secrets:', err);
      toast.error(t.adminSettings.failedToSaveSms);
    } finally {
      setSavingSecrets(false);
    }
  };

  const isSecretConfigured = (key: string) => secretsConfig?.provider === smsSettings.provider && secretsConfig?.secrets?.[key]?.configured;
  const getSecretPreview = (key: string) => {
    if (secretsConfig?.provider === smsSettings.provider && secretsConfig?.secrets?.[key]) return secretsConfig.secrets[key].preview;
    return null;
  };

  const handleSendTestSms = async () => {
    if (!testPhoneNumber.trim()) { toast.error(t.adminSettings.enterPhoneNumber); return; }
    setSendingTestSms(true);
    setTestSmsResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('send-sms', {
        body: { phoneNumber: testPhoneNumber.trim(), type: 'booking_confirmed', data: { bookingReference: 'TEST-SMS-001', pickupTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }, provider: smsSettings.provider || 'twilio' },
      });
      if (error) throw error;
      setTestSmsResult({ success: true, message: data?.message || t.adminSettings.testSmsSentSuccess, preview: data?.preview });
      toast.success(t.adminSettings.testSmsSentSuccess);
    } catch (err) {
      const msg = err instanceof Error ? err.message : (ne.failedToSendTestSms || 'Failed to send test SMS');
      setTestSmsResult({ success: false, message: msg });
      toast.error(msg);
    } finally {
      setSendingTestSms(false);
    }
  };

  const providerLabel = smsSettings.provider === 'nexmo' ? (ne.nexmoVonage || 'Nexmo (Vonage)') : smsSettings.provider === 'messagebird' ? (ne.messageBird || 'MessageBird') : (ne.twilio || 'Twilio');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            {t.adminSettings.emailNotifications}
          </CardTitle>
          <CardDescription>{t.adminSettings.configureEmailNotifications}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="senderName">{t.adminSettings.senderName}</Label>
              <Input id="senderName" value={emailSettings.senderName} onChange={(e) => setEmailSettings(prev => ({ ...prev, senderName: e.target.value }))} placeholder={ne.senderNamePlaceholder || 'Your Company'} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="senderEmail">{t.adminSettings.senderEmail}</Label>
              <Input id="senderEmail" type="email" value={emailSettings.senderEmail} onChange={(e) => setEmailSettings(prev => ({ ...prev, senderEmail: e.target.value }))} placeholder={ne.senderEmailPlaceholder || 'noreply@example.com'} />
            </div>
          </div>
          <Separator />
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t.adminSettings.bookingConfirmations}</Label>
                <p className="text-xs text-muted-foreground">{t.adminSettings.sendEmailOnConfirm}</p>
              </div>
              <Switch checked={emailSettings.sendConfirmations} onCheckedChange={(checked) => setEmailSettings(prev => ({ ...prev, sendConfirmations: checked }))} />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t.adminSettings.bookingReminders}</Label>
                <p className="text-xs text-muted-foreground">{t.adminSettings.sendReminderBeforePickup}</p>
              </div>
              <Switch checked={emailSettings.sendReminders} onCheckedChange={(checked) => setEmailSettings(prev => ({ ...prev, sendReminders: checked }))} />
            </div>
            {emailSettings.sendReminders && (
              <div className="ml-4 space-y-2">
                <Label htmlFor="reminderHours">{t.adminSettings.sendReminderHours}</Label>
                <Input id="reminderHours" type="number" min={1} className="w-32" value={emailSettings.reminderHoursBefore} onChange={(e) => setEmailSettings(prev => ({ ...prev, reminderHoursBefore: parseInt(e.target.value) || 24 }))} />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            {t.adminSettings.smsNotifications}
          </CardTitle>
          <CardDescription>{t.adminSettings.configureSmsNotifications}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t.adminSettings.enableSmsNotifications}</Label>
              <p className="text-xs text-muted-foreground">{t.adminSettings.sendSmsUpdates}</p>
            </div>
            <Switch checked={smsSettings.enabled} onCheckedChange={(checked) => setSmsSettings(prev => ({ ...prev, enabled: checked }))} />
          </div>
          
          {smsSettings.enabled && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label>{t.adminSettings.smsProvider}</Label>
                <Select value={smsSettings.provider} onValueChange={(v) => { setSmsSettings(prev => ({ ...prev, provider: v })); setSecretValues({}); }}>
                  <SelectTrigger><SelectValue placeholder={t.adminSettings.selectProvider} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="twilio">{ne.twilio || 'Twilio'}</SelectItem>
                    <SelectItem value="nexmo">{ne.nexmoVonage || 'Nexmo (Vonage)'}</SelectItem>
                    <SelectItem value="messagebird">{ne.messageBird || 'MessageBird'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {smsSettings.provider && PROVIDER_FIELDS[smsSettings.provider] && (
                <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      {providerLabel} {t.adminSettings.credentials}
                    </div>
                    {secretsConfig?.provider === smsSettings.provider && secretsConfig.lastUpdated && (
                      <Badge variant="outline" className="gap-1 text-xs"><CheckCircle2 className="h-3 w-3" />{t.adminSettings.configured}</Badge>
                    )}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {PROVIDER_FIELDS[smsSettings.provider].map((field) => {
                      const configured = isSecretConfigured(field.key);
                      const preview = getSecretPreview(field.key);
                      return (
                        <div key={field.key} className={`space-y-2 ${PROVIDER_FIELDS[smsSettings.provider].length % 2 !== 0 && field === PROVIDER_FIELDS[smsSettings.provider][PROVIDER_FIELDS[smsSettings.provider].length - 1] ? 'sm:col-span-2' : ''}`}>
                          <div className="flex items-center gap-2">
                            <Label htmlFor={field.key}>{field.label}</Label>
                            {configured && <Badge variant="secondary" className="h-5 text-[10px] px-1.5">{preview}</Badge>}
                          </div>
                          <Input id={field.key} type={field.sensitive ? 'password' : 'text'} value={secretValues[field.key] || ''} onChange={(e) => setSecretValues(prev => ({ ...prev, [field.key]: e.target.value }))} placeholder={configured ? `${ne.currentLabel || 'Current'}: ${preview}` : field.placeholder} />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <p className="text-xs text-muted-foreground">{t.adminSettings.credentialsStoredSecurely}</p>
                    <Button size="sm" onClick={handleSaveSecrets} disabled={savingSecrets} className="gap-1.5">
                      {savingSecrets ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Key className="h-3.5 w-3.5" />}
                      {t.adminSettings.saveCredentials}
                    </Button>
                  </div>

                  {/* Send Test SMS */}
                  <div className="flex items-center justify-between rounded-lg border border-dashed border-border p-3 bg-background">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">{t.adminSettings.testSms}</p>
                      <p className="text-xs text-muted-foreground">{t.adminSettings.testSmsDesc}</p>
                    </div>
                    <Dialog open={testSmsDialogOpen} onOpenChange={(open) => { setTestSmsDialogOpen(open); if (!open) setTestSmsResult(null); }}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-1.5"><Send className="h-3.5 w-3.5" />{t.adminSettings.sendTestSms}</Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>{t.adminSettings.sendTestSmsTitle}</DialogTitle>
                          <DialogDescription>{t.adminSettings.sendTestSmsDesc.replace('{provider}', providerLabel)}</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-3">
                          <div className="space-y-2">
                            <Label htmlFor="test-phone">{t.adminSettings.phoneNumberLabel}</Label>
                            <Input id="test-phone" type="tel" value={testPhoneNumber} onChange={(e) => setTestPhoneNumber(e.target.value)} placeholder={ne.phoneNumberPlaceholder || '+1234567890'} className="font-mono text-sm" />
                            <p className="text-xs text-muted-foreground">{t.adminSettings.includeCountryCode}</p>
                          </div>
                          {testSmsResult && (
                            <div className={`rounded-lg border p-3 space-y-2 ${testSmsResult.success ? 'border-accent/30 bg-accent/5' : 'border-destructive/30 bg-destructive/5'}`}>
                              <div className="flex items-center gap-2">
                                {testSmsResult.success ? <CheckCircle2 className="h-4 w-4 text-accent shrink-0" /> : <Phone className="h-4 w-4 text-destructive shrink-0" />}
                                <p className={`text-sm font-medium ${testSmsResult.success ? 'text-accent' : 'text-destructive'}`}>{testSmsResult.success ? t.adminSettings.testSmsSent : t.adminSettings.failed}</p>
                              </div>
                              <p className="text-xs text-muted-foreground">{testSmsResult.message}</p>
                              {testSmsResult.preview && (
                                <div className="rounded-md bg-muted p-2 mt-1"><p className="text-xs font-mono text-foreground">{testSmsResult.preview}</p></div>
                              )}
                            </div>
                          )}
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => { setTestSmsDialogOpen(false); setTestSmsResult(null); }}>{t.common.close}</Button>
                          <Button onClick={handleSendTestSms} disabled={sendingTestSms || !testPhoneNumber.trim()} className="gap-1.5">
                            {sendingTestSms ? <><Loader2 className="h-4 w-4 animate-spin" />{t.adminSettings.sending}</> : <><Send className="h-4 w-4" />{t.adminSettings.sendTest}</>}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              )}
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t.adminSettings.driverArrivingAlert}</Label>
                    <p className="text-xs text-muted-foreground">{t.adminSettings.driverArrivingAlertHint}</p>
                  </div>
                  <Switch checked={smsSettings.sendDriverArriving} onCheckedChange={(checked) => setSmsSettings(prev => ({ ...prev, sendDriverArriving: checked }))} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t.adminSettings.rideUpdates}</Label>
                    <p className="text-xs text-muted-foreground">{t.adminSettings.rideUpdatesHint}</p>
                  </div>
                  <Switch checked={smsSettings.sendRideUpdates} onCheckedChange={(checked) => setSmsSettings(prev => ({ ...prev, sendRideUpdates: checked }))} />
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}