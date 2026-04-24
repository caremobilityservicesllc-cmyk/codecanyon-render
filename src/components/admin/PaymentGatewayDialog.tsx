import { useState, useEffect } from 'react';
import { CreditCard, DollarSign, Check, AlertCircle, Loader2, Eye, EyeOff, Building2, Copy, ExternalLink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import type { StripeSettings, PayPalSettings, BankTransferSettings } from './settings/types';

// ============ STRIPE DIALOG ============
interface StripeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: StripeSettings;
  onSave: (settings: StripeSettings) => Promise<void>;
}

export function StripeConfigDialog({ open, onOpenChange, settings, onSave }: StripeDialogProps) {
  const { t } = useLanguage();
  const pg = (t as any).paymentGateway || {};
  const [localSettings, setLocalSettings] = useState<StripeSettings>(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [copiedEndpoint, setCopiedEndpoint] = useState(false);

  // Construct webhook endpoint URL
  const webhookEndpoint = `https://dwsybrgccdwfknbewzdp.supabase.co/functions/v1/stripe-webhook`;

  const copyWebhookEndpoint = async () => {
    await navigator.clipboard.writeText(webhookEndpoint);
    setCopiedEndpoint(true);
    toast.success(t.paymentGatewayDialog.webhookCopied);
    setTimeout(() => setCopiedEndpoint(false), 2000);
  };

  useEffect(() => {
    if (open) setLocalSettings(settings);
  }, [open, settings]);

  const handleSave = async () => {
    if (localSettings.enabled && (!localSettings.publicKey || !localSettings.secretKey)) {
      toast.error(t.adminDrivers.fillRequiredFields);
      return;
    }
    setIsSaving(true);
    try {
      await onSave(localSettings);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#635BFF]/10">
              <CreditCard className="h-4 w-4 text-[#635BFF]" />
            </div>
            {pg.stripeConfiguration || 'Stripe Configuration'}
          </DialogTitle>
          <DialogDescription>{pg.configureStripe || 'Configure Stripe for credit card payments'}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">{pg.enableStripe || 'Enable Stripe'}</Label>
              <p className="text-sm text-muted-foreground">{pg.acceptCreditCard || 'Accept credit card payments'}</p>
            </div>
            <Switch
              checked={localSettings.enabled}
              onCheckedChange={(checked) => setLocalSettings(prev => ({ ...prev, enabled: checked }))}
            />
          </div>

          {localSettings.enabled && (
            <>
              <div className="space-y-2">
                <Label>{pg.environment || 'Environment'}</Label>
                <Select
                  value={localSettings.mode}
                  onValueChange={(v: 'test' | 'live') => setLocalSettings(prev => ({ ...prev, mode: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="test">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-yellow-500" />
                        {pg.testMode || 'Test Mode'}
                      </span>
                    </SelectItem>
                    <SelectItem value="live">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-green-500" />
                        {pg.liveMode || 'Live Mode'}
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {localSettings.mode === 'test' && (
                <Alert className="border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-700 dark:text-yellow-300">
                    {pg.testModeWarning || 'Test mode - no real charges will be made.'}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label>{pg.publishableKey || 'Publishable Key'}</Label>
                <Input
                  placeholder="pk_test_..."
                  value={localSettings.publicKey}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, publicKey: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>{pg.secretKey || 'Secret Key'}</Label>
                <div className="relative">
                  <Input
                    type={showSecretKey ? 'text' : 'password'}
                    placeholder="sk_test_..."
                    value={localSettings.secretKey}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, secretKey: e.target.value }))}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowSecretKey(!showSecretKey)}
                  >
                    {showSecretKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* Webhook Configuration Section */}
              <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">{pg.webhookConfiguration || 'Webhook Configuration'}</Label>
                  <a 
                    href="https://dashboard.stripe.com/webhooks" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    {pg.openStripeDashboard || 'Open Stripe Dashboard'} <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">{pg.webhookEndpointUrl || 'Webhook Endpoint URL'}</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={webhookEndpoint}
                      className="font-mono text-xs bg-background"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={copyWebhookEndpoint}
                      className="shrink-0"
                    >
                      {copiedEndpoint ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {pg.addWebhookHint || 'Add this URL in your Stripe Dashboard → Developers → Webhooks'}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">{pg.webhookSecret || 'Webhook Secret'}</Label>
                  <div className="relative">
                    <Input
                      type={showWebhookSecret ? 'text' : 'password'}
                      placeholder="whsec_..."
                      value={localSettings.webhookSecret}
                      onChange={(e) => setLocalSettings(prev => ({ ...prev, webhookSecret: e.target.value }))}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                    >
                      {showWebhookSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {pg.copyFromStripe || 'Copy from Stripe Dashboard after creating the webhook endpoint'}
                  </p>
                </div>

                <Alert className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-700 dark:text-blue-300 text-xs">
                    <strong>{pg.requiredEvents || 'Required events:'}</strong> payment_intent.succeeded, payment_intent.payment_failed, charge.refunded
                  </AlertDescription>
                </Alert>
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>{t.common.cancel}</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              {pg.saveConfiguration || 'Save Configuration'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============ PAYPAL DIALOG ============
interface PayPalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: PayPalSettings;
  onSave: (settings: PayPalSettings) => Promise<void>;
}

export function PayPalConfigDialog({ open, onOpenChange, settings, onSave }: PayPalDialogProps) {
  const { t } = useLanguage();
  const pg = (t as any).paymentGateway || {};
  const [localSettings, setLocalSettings] = useState(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [copiedEndpoint, setCopiedEndpoint] = useState(false);

  // PayPal IPN webhook endpoint
  const ipnEndpoint = `https://dwsybrgccdwfknbewzdp.supabase.co/functions/v1/paypal-webhook`;

  const copyIPNEndpoint = async () => {
    await navigator.clipboard.writeText(ipnEndpoint);
    setCopiedEndpoint(true);
    toast.success(t.paymentGatewayDialog.ipnCopied);
    setTimeout(() => setCopiedEndpoint(false), 2000);
  };

  useEffect(() => {
    if (open) setLocalSettings(settings);
  }, [open, settings]);

  const handleSave = async () => {
    if (localSettings.enabled && (!localSettings.clientId || !localSettings.secretKey)) {
      toast.error(t.adminDrivers.fillRequiredFields);
      return;
    }
    setIsSaving(true);
    try {
      await onSave(localSettings);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#003087]/10">
              <DollarSign className="h-4 w-4 text-[#003087]" />
            </div>
            {pg.paypalConfiguration || 'PayPal Configuration'}
          </DialogTitle>
          <DialogDescription>{pg.configurePaypal || 'Configure PayPal for digital wallet payments'}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">{pg.enablePaypal || 'Enable PayPal'}</Label>
              <p className="text-sm text-muted-foreground">{pg.acceptPaypal || 'Accept PayPal payments'}</p>
            </div>
            <Switch
              checked={localSettings.enabled}
              onCheckedChange={(checked) => setLocalSettings(prev => ({ ...prev, enabled: checked }))}
            />
          </div>

          {localSettings.enabled && (
            <>
              <div className="space-y-2">
                <Label>{pg.environment || 'Environment'}</Label>
                <Select
                  value={localSettings.mode}
                  onValueChange={(v: 'test' | 'live') => setLocalSettings(prev => ({ ...prev, mode: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="test">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-yellow-500" />
                        {pg.sandboxTest || 'Sandbox (Test)'}
                      </span>
                    </SelectItem>
                    <SelectItem value="live">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-green-500" />
                        {pg.productionLive || 'Production (Live)'}
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {localSettings.mode === 'test' && (
                <Alert className="border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-700 dark:text-yellow-300">
                    {pg.sandboxWarning || 'Sandbox mode - no real charges will be made. Use sandbox.paypal.com for testing.'}
                  </AlertDescription>
                </Alert>
              )}

              {localSettings.mode === 'live' && (
                <Alert className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
                  <Check className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-700 dark:text-green-300">
                    {pg.productionWarning || 'Production mode - real payments will be processed.'}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label>{pg.clientId || 'Client ID'}</Label>
                <Input
                  placeholder={localSettings.mode === 'test' ? 'AXy...' : 'Your live Client ID'}
                  value={localSettings.clientId}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, clientId: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  {pg.findInPaypal || 'Find this in PayPal Developer Dashboard → My Apps & Credentials'}
                </p>
              </div>

              <div className="space-y-2">
                <Label>{pg.clientSecret || 'Client Secret'}</Label>
                <div className="relative">
                  <Input
                    type={showSecretKey ? 'text' : 'password'}
                    placeholder={localSettings.mode === 'test' ? 'EBW...' : 'Your live Client Secret'}
                    value={localSettings.secretKey}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, secretKey: e.target.value }))}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowSecretKey(!showSecretKey)}
                  >
                    {showSecretKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* IPN Webhook Configuration Section */}
              <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">{pg.ipnWebhookConfiguration || 'IPN Webhook Configuration'}</Label>
                  <a 
                    href={localSettings.mode === 'test' 
                      ? 'https://www.sandbox.paypal.com/merchantnotification/ipn/preference' 
                      : 'https://www.paypal.com/merchantnotification/ipn/preference'
                    }
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    {pg.openPaypalIpn || 'Open PayPal IPN Settings'} <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">{pg.ipnNotificationUrl || 'IPN Notification URL'}</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={ipnEndpoint}
                      className="font-mono text-xs bg-background"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={copyIPNEndpoint}
                      className="shrink-0"
                    >
                      {copiedEndpoint ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {pg.addIpnHint || 'Add this URL in PayPal → Account Settings → Notifications → Instant Payment Notifications'}
                  </p>
                </div>

                <Alert className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-700 dark:text-blue-300 text-xs">
                    <strong>{pg.handledStatuses || 'Handled payment statuses:'}</strong> Completed, Pending, Failed, Denied, Refunded, Reversed
                  </AlertDescription>
                </Alert>

                <div className="text-xs text-muted-foreground space-y-1">
                  <p className="font-medium">{pg.setupSteps || 'Setup Steps:'}</p>
                  <ol className="list-decimal list-inside space-y-1 ml-1">
                    <li>{pg.setupStep1 || 'Go to PayPal → Account Settings → Notifications'}</li>
                    <li>{pg.setupStep2 || 'Click "Instant Payment Notifications"'}</li>
                    <li>{pg.setupStep3 || 'Click "Update" or "Choose IPN Settings"'}</li>
                    <li>{pg.setupStep4 || 'Paste the IPN URL above and enable IPN messages'}</li>
                  </ol>
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>{t.common.cancel}</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              {pg.saveConfiguration || 'Save Configuration'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============ BANK TRANSFER DIALOG ============
interface BankTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: BankTransferSettings;
  onSave: (settings: BankTransferSettings) => Promise<void>;
}

export function BankTransferConfigDialog({ open, onOpenChange, settings, onSave }: BankTransferDialogProps) {
  const { t } = useLanguage();
  const pg = (t as any).paymentGateway || {};
  const [localSettings, setLocalSettings] = useState(settings);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) setLocalSettings(settings);
  }, [open, settings]);

  const handleSave = async () => {
    if (localSettings.enabled && !localSettings.bankName) {
      toast.error(t.paymentGatewayDialog.fillBankDetails);
      return;
    }
    setIsSaving(true);
    try {
      await onSave(localSettings);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
              <Building2 className="h-4 w-4 text-emerald-500" />
            </div>
            {pg.bankTransferConfiguration || 'Bank Transfer Configuration'}
          </DialogTitle>
          <DialogDescription>{pg.configureBankDetails || 'Configure bank details for direct transfers'}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">{pg.enableBankTransfer || 'Enable Bank Transfer'}</Label>
              <p className="text-sm text-muted-foreground">{pg.acceptDirectBank || 'Accept direct bank payments'}</p>
            </div>
            <Switch
              checked={localSettings.enabled}
              onCheckedChange={(checked) => setLocalSettings(prev => ({ ...prev, enabled: checked }))}
            />
          </div>

          {localSettings.enabled && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{pg.bankNameLabel || 'Bank Name'}</Label>
                  <Input
                    placeholder={(t as any).placeholders?.bankName || "Chase Bank"}
                    value={localSettings.bankName}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, bankName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{pg.accountNameLabel || 'Account Name'}</Label>
                  <Input
                    placeholder={(t as any).placeholders?.accountName || "RideFlow Ltd"}
                    value={localSettings.accountName}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, accountName: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{pg.ibanLabel || 'IBAN'}</Label>
                <Input
                  placeholder="e.g. CH93 0076 2011 6238 5295 7"
                  value={localSettings.iban}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, iban: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  {pg.ibanHint || 'International Bank Account Number — used worldwide for transfers'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{pg.swiftBicCode || 'SWIFT / BIC Code'}</Label>
                  <Input
                    placeholder={(t as any).placeholders?.swiftCode || "CHASUS33"}
                    value={localSettings.swiftCode}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, swiftCode: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{pg.accountNumberOptional || 'Account Number (Optional)'}</Label>
                  <Input
                    placeholder={(t as any).placeholders?.accountNumber || "123456789"}
                    value={localSettings.accountNumber}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, accountNumber: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{pg.routingNumberOptional || 'Routing Number (Optional)'}</Label>
                <Input
                  placeholder="021000021"
                  value={localSettings.routingNumber}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, routingNumber: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>{pg.paymentInstructions || 'Payment Instructions'}</Label>
                <Textarea
                  placeholder={pg.paymentInstructionsPlaceholder || 'Please include your booking reference in the payment description...'}
                  value={localSettings.instructions}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, instructions: e.target.value }))}
                  rows={3}
                />
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>{t.common.cancel}</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              {pg.saveConfiguration || 'Save Configuration'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

