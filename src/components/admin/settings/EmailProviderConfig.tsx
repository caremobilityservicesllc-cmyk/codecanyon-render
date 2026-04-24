import { useState, useEffect } from 'react';
import { Mail, Key, Trash2, Loader2, CheckCircle2, Send, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

interface EmailProviderSettings {
  provider: 'resend' | 'sendgrid' | 'smtp';
  configured: boolean;
  preview: string;
  fromEmail: string;
  fromName: string;
  smtpHost?: string;
  smtpPort?: number;
}

const defaultSettings: EmailProviderSettings = {
  provider: 'resend',
  configured: false,
  preview: '',
  fromEmail: '',
  fromName: '',
};

export function EmailProviderConfig() {
  const { t } = useLanguage();
  const ep2 = (t as any).emailProvider2 || {};
  const [settings, setSettings] = useState<EmailProviderSettings>(defaultSettings);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState('');

  // Form state
  const [formProvider, setFormProvider] = useState<'resend' | 'sendgrid' | 'smtp'>('resend');
  const [formApiKey, setFormApiKey] = useState('');
  const [formFromEmail, setFormFromEmail] = useState('');
  const [formFromName, setFormFromName] = useState('');
  const [formSmtpHost, setFormSmtpHost] = useState('');
  const [formSmtpPort, setFormSmtpPort] = useState('587');

  const fetchSettings = async () => {
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'email_provider')
        .single();

      if (data?.value && typeof data.value === 'object') {
        const val = data.value as any;
        setSettings({
          provider: val.provider || 'resend',
          configured: val.configured || false,
          preview: val.preview || '',
          fromEmail: val.fromEmail || '',
          fromName: val.fromName || '',
          smtpHost: val.smtpHost,
          smtpPort: val.smtpPort,
        });
      }
    } catch {
      // Settings don't exist yet, use defaults
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleOpenDialog = () => {
    setFormProvider(settings.provider);
    setFormFromEmail(settings.fromEmail);
    setFormFromName(settings.fromName);
    setFormSmtpHost(settings.smtpHost || '');
    setFormSmtpPort(String(settings.smtpPort || 587));
    setFormApiKey('');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formApiKey.trim()) {
      toast.error(t.emailProvider.enterApiKey);
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('update-email-provider', {
        body: {
          provider: formProvider,
          apiKey: formApiKey.trim(),
          fromEmail: formFromEmail.trim(),
          fromName: formFromName.trim(),
          ...(formProvider === 'smtp' && {
            smtpHost: formSmtpHost.trim(),
            smtpPort: parseInt(formSmtpPort),
          }),
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast.success(data?.message || t.emailProvider.configuredSuccessfully);
      setDialogOpen(false);
      setFormApiKey('');
      fetchSettings();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.emailProvider.failedToSave);
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('update-email-provider', {
        body: { action: 'clear' },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast.success(t.emailProvider.settingsCleared);
      fetchSettings();
    } catch (err) {
      toast.error(t.emailProvider.failedToClear);
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async () => {
    if (!testEmail.trim()) {
      toast.error(t.emailProvider.enterTestEmail);
      return;
    }
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-booking-email', {
        body: {
          type: 'created',
          email: testEmail.trim(),
          bookingReference: 'TEST-001',
          pickupLocation: 'Test Pickup Location',
          dropoffLocation: 'Test Dropoff Location',
          pickupDate: new Date().toLocaleDateString(),
          pickupTime: '10:00 AM',
          vehicleName: 'Test Vehicle',
          passengers: 1,
        },
      });
      if (error) throw new Error(error.message);
      toast.success((ep2.testEmailSent || 'Test email sent to {email}').replace('{email}', testEmail));
      setTestDialogOpen(false);
      setTestEmail('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : (ep2.failedToSendTest || 'Failed to send test email'));
    } finally {
      setTesting(false);
    }
  };

  const providerLabels: Record<string, string> = {
    resend: 'Resend',
    sendgrid: 'SendGrid',
    smtp: ep2.customSmtp || 'Custom SMTP',
  };

  const providerDescriptions: Record<string, string> = {
    resend: ep2.resendDesc || 'Modern email API for developers',
    sendgrid: ep2.sendgridDesc || 'Twilio SendGrid email delivery',
    smtp: ep2.smtpDesc || 'Custom SMTP server connection',
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          {ep2.emailService || 'Email Service'}
        </CardTitle>
        <CardDescription>
          {ep2.emailServiceDesc || 'Configure your email delivery provider for booking confirmations, notifications, and more'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current provider status */}
        <div className={`flex items-center justify-between rounded-lg border p-4 ${settings.configured ? 'border-primary/20 bg-primary/5' : 'border-warning/20 bg-warning/5'}`}>
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${settings.configured ? 'bg-primary/10' : 'bg-warning/10'}`}>
              {settings.configured ? (
                <CheckCircle2 className="h-5 w-5 text-primary" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-warning" />
              )}
            </div>
            <div>
              <p className={`font-medium ${settings.configured ? 'text-primary' : 'text-warning'}`}>
                {settings.configured ? (ep2.connected || '{provider} Connected').replace('{provider}', providerLabels[settings.provider]) : (ep2.notConfigured || 'Email Provider Not Configured')}
              </p>
              <p className="text-sm text-muted-foreground">
                {settings.configured
                  ? `${(ep2.apiKeyLabel || 'API Key: {preview}').replace('{preview}', settings.preview)}${settings.fromEmail ? ` • ${(ep2.fromLabel || 'From: {email}').replace('{email}', settings.fromEmail)}` : ''}`
                  : (ep2.configureNotifications || 'Configure an email provider to send booking notifications')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {settings.configured && (
              <>
                <Badge className="bg-accent/20 text-accent border-accent/30">{ep2.active || 'Active'}</Badge>
                <Button variant="ghost" size="sm" onClick={handleClear} disabled={saving}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleOpenDialog}>
            <Key className="h-3.5 w-3.5" />
            {settings.configured ? (ep2.updateProvider || 'Update Provider') : (ep2.configureProvider || 'Configure Provider')}
          </Button>
          {settings.configured && (
            <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Send className="h-3.5 w-3.5" />
                  {ep2.sendTestEmail || 'Send Test Email'}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>{ep2.sendTestEmailTitle || 'Send Test Email'}</DialogTitle>
                  <DialogDescription>{ep2.sendTestEmailDesc || 'Send a test booking confirmation email to verify your email provider is working correctly.'}</DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-3">
                  <Label htmlFor="test-email">{ep2.recipientEmail || 'Recipient Email'}</Label>
                  <Input
                    id="test-email"
                    type="email"
                    placeholder="test@example.com"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setTestDialogOpen(false)}>{t.common.cancel}</Button>
                  <Button onClick={handleSendTest} disabled={!testEmail.trim() || testing}>
                    {testing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{ep2.sending || 'Sending...'}</> : (ep2.sendTest || 'Send Test')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Configure dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{ep2.configureEmailProvider || 'Configure Email Provider'}</DialogTitle>
              <DialogDescription>{ep2.configureEmailProviderDesc || 'Set up your email delivery service for sending booking notifications and confirmations.'}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-3">
              <div className="space-y-2">
                <Label>{ep2.emailProviderLabel || 'Email Provider'}</Label>
                <Select value={formProvider} onValueChange={(v) => setFormProvider(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="resend">Resend</SelectItem>
                    <SelectItem value="sendgrid">SendGrid</SelectItem>
                    <SelectItem value="smtp">{ep2.customSmtp || 'Custom SMTP'}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{providerDescriptions[formProvider]}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email-api-key">
                  {formProvider === 'smtp' ? (ep2.smtpPasswordApiKey || 'SMTP Password / API Key') : (ep2.apiKey || 'API Key')}
                </Label>
                <Input
                  id="email-api-key"
                  type="password"
                  placeholder={formProvider === 'resend' ? 're_...' : formProvider === 'sendgrid' ? 'SG...' : 'Password'}
                  value={formApiKey}
                  onChange={(e) => setFormApiKey(e.target.value)}
                  className="font-mono text-sm"
                  autoComplete="off"
                />
                {settings.configured && settings.provider === formProvider && (
                  <div className="flex items-center gap-2 rounded-md bg-primary/10 p-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    <span>{ep2.keyAlreadyConfigured || 'A key is already configured. Submitting will replace it.'}</span>
                  </div>
                )}
              </div>

              {formProvider === 'smtp' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="smtp-host">{ep2.smtpHost || 'SMTP Host'}</Label>
                    <Input id="smtp-host" placeholder="smtp.example.com" value={formSmtpHost} onChange={(e) => setFormSmtpHost(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtp-port">{ep2.port || 'Port'}</Label>
                    <Input id="smtp-port" type="number" placeholder="587" value={formSmtpPort} onChange={(e) => setFormSmtpPort(e.target.value)} />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="from-name">{ep2.fromName || 'From Name'}</Label>
                  <Input id="from-name" placeholder={(t as any).placeholders?.companyName || "My Company"} value={formFromName} onChange={(e) => setFormFromName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="from-email">{ep2.fromEmail || 'From Email'}</Label>
                  <Input id="from-email" type="email" placeholder="noreply@example.com" value={formFromEmail} onChange={(e) => setFormFromEmail(e.target.value)} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>{t.common.cancel}</Button>
              <Button onClick={handleSave} disabled={!formApiKey.trim() || saving}>
                {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t.common.saving}</> : (ep2.saveConfiguration || 'Save Configuration')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
