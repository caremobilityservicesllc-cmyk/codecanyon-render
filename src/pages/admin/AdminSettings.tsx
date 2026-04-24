import { useState, useEffect } from 'react';
import { 
  Building2, 
  Calendar, 
  Bell, 
  Globe, 
  Shield, 
  Palette, 
  History, 
  Save, 
  Loader2, 
  AlertCircle, 
  CheckCircle2,
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { StripeConfigDialog, PayPalConfigDialog, BankTransferConfigDialog } from '@/components/admin/PaymentGatewayDialog';
import { SettingsAuditLog } from '@/components/admin/settings/SettingsAuditLog';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

import {
  GeneralSettingsTab,
  BookingSettingsTab,
  NotificationSettingsTab,
  IntegrationsSettingsTab,
  SecuritySettingsTab,
  AppearanceSettingsTab,
  type BusinessInfo,
  type SocialLinks,
  type BusinessHours,
  type BookingPolicies,
  type CurrencySettings,
  type TaxSettings,
  type EmailSettings,
  type SmsSettings,
  type SecuritySettings,
  type AppearanceSettings,
  type StripeSettings,
  type PayPalSettings,
  type FieldErrors,
} from '@/components/admin/settings';
import type { Language } from '@/i18n/translations';

// Validation schema factories
function createBusinessInfoSchema(v: any) {
  return z.object({
    companyName: z.string().min(1, v?.companyNameRequired || 'Company name is required').max(100, v?.companyNameTooLong || 'Company name too long'),
    email: z.string().email(v?.invalidEmail || 'Invalid email address'),
    phone: z.string().min(1, v?.phoneRequired || 'Phone number is required'),
    address: z.string().optional(),
    timezone: z.string().min(1, v?.timezoneRequired || 'Timezone is required'),
    website: z.string().url(v?.invalidUrl || 'Invalid URL').optional().or(z.literal('')),
    taxId: z.string().optional(),
  });
}

function createSocialLinksSchema(v: any) {
  return z.object({
    facebook: z.string().url(v?.invalidUrl || 'Invalid URL').optional().or(z.literal('')),
    twitter: z.string().url(v?.invalidUrl || 'Invalid URL').optional().or(z.literal('')),
    instagram: z.string().url(v?.invalidUrl || 'Invalid URL').optional().or(z.literal('')),
    linkedin: z.string().url(v?.invalidUrl || 'Invalid URL').optional().or(z.literal('')),
  });
}

export default function AdminSettings() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const v = (t as any).validation || {};
  const businessInfoSchema = createBusinessInfoSchema(v);
  const socialLinksSchema = createSocialLinksSchema(v);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [previousSettings, setPreviousSettings] = useState<Record<string, object>>({});
  
  // Settings state
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo>({
    companyName: 'RideFlow',
    email: 'support@rideflow.com',
    phone: '+1 (555) 000-0000',
    address: '',
    timezone: 'UTC',
    website: '',
    taxId: '',
    registrationNumber: '',
    tagline: '',
  });

  const [socialLinks, setSocialLinks] = useState<SocialLinks>({
    facebook: '',
    twitter: '',
    instagram: '',
    linkedin: '',
    tiktok: '',
    youtube: '',
  });
  
  const [businessHours, setBusinessHours] = useState<BusinessHours>({
    start: '06:00',
    end: '22:00',
    daysOfWeek: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
  });
  
  const [bookingPolicies, setBookingPolicies] = useState<BookingPolicies>({
    depositPercentage: 30,
    cancellationHours: 24,
    minAdvanceBookingHours: 2,
    maxAdvanceBookingDays: 30,
    pickupTimeInterval: 15,
    commissionPercentage: 15,
    bookingFee: 0,
    cancellationFee: 10,
    enableTollCharges: true,
    enableAirportCharges: true,
    loyaltyPointsPerDollar: 10,
    loyaltyRedemptionRate: 100,
    driverMilestoneBonus: 50,
    driverMilestoneRides: 100,
  });
  
  const [currency, setCurrency] = useState<CurrencySettings>({
    code: 'USD',
    symbol: '$',
    position: 'before',
  });

  const [taxSettings, setTaxSettings] = useState<TaxSettings>({
    enabled: false,
    rate: 0,
    label: 'VAT',
    includeInPrice: false,
  });
  
  const [emailSettings, setEmailSettings] = useState<EmailSettings>({
    senderName: 'RideFlow',
    senderEmail: 'noreply@rideflow.com',
    sendConfirmations: true,
    sendReminders: true,
    reminderHoursBefore: 24,
  });
  
  const [smsSettings, setSmsSettings] = useState<SmsSettings>({
    enabled: false,
    provider: '',
    providerConfig: {},
    sendDriverArriving: true,
    sendRideUpdates: true,
  });

  const [securitySettings, setSecuritySettings] = useState<SecuritySettings>({
    requireEmailVerification: true,
    sessionTimeout: 60,
    maxLoginAttempts: 5,
    twoFactorEnabled: false,
    ipWhitelist: '',
  });

  const [appearanceSettings, setAppearanceSettings] = useState<AppearanceSettings>({
    primaryColor: '#22c55e',
    accentColor: '#14b8a6',
    logoUrl: '',
    logoLightUrl: '',
    logoDarkUrl: '',
    faviconUrl: '',
    darkModeDefault: false,
    pwaIconUrl: '',
    showPreloader: true,
  });

  const [distanceUnit, setDistanceUnit] = useState<import('@/components/admin/settings/types').DistanceUnitSettings>({
    unit: 'km',
  });

  const [defaultLanguage, setDefaultLanguage] = useState<Language>('en');
  const [enabledLanguages, setEnabledLanguages] = useState<Language[]>(['en']);

  const [mapLocation, setMapLocation] = useState<import('@/components/admin/settings/types').MapLocationSettings>({
    defaultLat: 46.6863,
    defaultLng: 7.8632,
  });

  // Payment gateway states
  const [stripeDialogOpen, setStripeDialogOpen] = useState(false);
  const [paypalDialogOpen, setPaypalDialogOpen] = useState(false);
  const [bankDialogOpen, setBankDialogOpen] = useState(false);
  
  const [stripeSettings, setStripeSettings] = useState<StripeSettings>({
    enabled: false,
    mode: 'test',
    publicKey: '',
    secretKey: '',
    webhookSecret: '',
  });
  const [paypalSettings, setPaypalSettings] = useState<PayPalSettings>({
    enabled: false,
    mode: 'test',
    publicKey: '',
    secretKey: '',
    clientId: '',
  });
  const [bankSettings, setBankSettings] = useState<import('@/components/admin/settings/types').BankTransferSettings>({
    enabled: false,
    bankName: '',
    accountName: '',
    accountNumber: '',
    routingNumber: '',
    swiftCode: '',
    iban: '',
    instructions: '',
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  // Track unsaved changes
  useEffect(() => {
    setHasUnsavedChanges(true);
    setSaveSuccess(false);
  }, [businessInfo, businessHours, bookingPolicies, currency, taxSettings, emailSettings, smsSettings, socialLinks, securitySettings, appearanceSettings, distanceUnit, mapLocation, defaultLanguage, enabledLanguages]);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('key, value');

      if (error) throw error;

      const settingsMap: Record<string, object> = {};

      if (data) {
        data.forEach((setting) => {
          const value = setting.value as Record<string, unknown>;
          settingsMap[setting.key] = value;
          switch (setting.key) {
            case 'business_info':
              setBusinessInfo(prev => ({ ...prev, ...(value as unknown as Partial<BusinessInfo>) }));
              break;
            case 'social_links':
              setSocialLinks(value as unknown as SocialLinks);
              break;
            case 'business_hours':
              setBusinessHours(value as unknown as BusinessHours);
              break;
            case 'booking_policies':
              setBookingPolicies(value as unknown as BookingPolicies);
              break;
            case 'currency':
              setCurrency(value as unknown as CurrencySettings);
              break;
            case 'tax_settings':
              setTaxSettings(value as unknown as TaxSettings);
              break;
            case 'email_settings':
              setEmailSettings(value as unknown as EmailSettings);
              break;
            case 'sms_settings':
              setSmsSettings(value as unknown as SmsSettings);
              break;
            case 'security_settings':
              setSecuritySettings(value as unknown as SecuritySettings);
              break;
            case 'appearance_settings':
              setAppearanceSettings(value as unknown as AppearanceSettings);
              break;
            case 'stripe_settings':
              setStripeSettings(value as unknown as StripeSettings);
              break;
            case 'paypal_settings':
              setPaypalSettings(value as unknown as PayPalSettings);
              break;
            case 'bank_settings':
              setBankSettings(value as unknown as import('@/components/admin/settings/types').BankTransferSettings);
              break;
            case 'default_language':
              setDefaultLanguage((value as any)?.language || 'en');
              break;
            case 'enabled_languages':
              setEnabledLanguages((value as any)?.languages || ['en']);
              break;
            case 'distance_unit':
              setDistanceUnit(value as unknown as import('@/components/admin/settings/types').DistanceUnitSettings);
              break;
            case 'map_location':
              setMapLocation(value as unknown as import('@/components/admin/settings/types').MapLocationSettings);
              break;
          }
        });
      }
      setPreviousSettings(settingsMap);
      setHasUnsavedChanges(false);
    } catch (err) {
      console.error('Error fetching settings:', err);
      toast.error(t.admin.failedToSaveSettings);
    } finally {
      setIsLoading(false);
    }
  };

  const validateFields = (): boolean => {
    const newErrors: FieldErrors = {};
    
    try {
      businessInfoSchema.parse(businessInfo);
    } catch (err) {
      if (err instanceof z.ZodError) {
        err.errors.forEach((e) => {
          newErrors[`businessInfo.${e.path[0]}`] = e.message;
        });
      }
    }

    try {
      socialLinksSchema.parse(socialLinks);
    } catch (err) {
      if (err instanceof z.ZodError) {
        err.errors.forEach((e) => {
          newErrors[`socialLinks.${e.path[0]}`] = e.message;
        });
      }
    }

    // Validate booking policies
    if (bookingPolicies.depositPercentage < 0 || bookingPolicies.depositPercentage > 100) {
      newErrors['bookingPolicies.depositPercentage'] = 'Deposit must be between 0 and 100%';
    }
    if (bookingPolicies.minAdvanceBookingHours < 0) {
      newErrors['bookingPolicies.minAdvanceBookingHours'] = 'Must be positive';
    }

    // Validate tax rate
    if (taxSettings.enabled && (taxSettings.rate < 0 || taxSettings.rate > 100)) {
      newErrors['taxSettings.rate'] = 'Tax rate must be between 0 and 100%';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const logSettingChange = async (key: string, oldValue: object | null, newValue: object) => {
    if (JSON.stringify(oldValue) === JSON.stringify(newValue)) return;

    try {
      await supabase
        .from('settings_audit_log')
        .insert({
          user_id: user?.id,
          user_email: user?.email,
          setting_key: key,
          old_value: oldValue as import('@/integrations/supabase/types').Json,
          new_value: newValue as import('@/integrations/supabase/types').Json,
          action: oldValue ? 'update' : 'create',
        });
    } catch (err) {
      console.error('Failed to log setting change:', err);
    }
  };

  const saveSetting = async (key: string, value: object) => {
    const { error } = await supabase
      .from('system_settings')
      .upsert({
        key,
        value: value as unknown as import('@/integrations/supabase/types').Json,
        category: key.includes('stripe') || key.includes('paypal') || key.includes('security') ? 'integrations' : 'general',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'key'
      });

    if (error) throw error;
    await logSettingChange(key, previousSettings[key] || null, value);
  };

  const handleSaveAll = async () => {
    if (!validateFields()) {
      toast.error(t.admin.fixValidationErrors);
      return;
    }

    setIsSaving(true);
    try {
      await Promise.all([
        saveSetting('business_info', businessInfo),
        saveSetting('social_links', socialLinks),
        saveSetting('business_hours', businessHours),
        saveSetting('booking_policies', bookingPolicies),
        saveSetting('currency', currency),
        saveSetting('tax_settings', taxSettings),
        saveSetting('email_settings', emailSettings),
        saveSetting('sms_settings', {
          enabled: smsSettings.enabled,
          provider: smsSettings.provider,
          sendDriverArriving: smsSettings.sendDriverArriving,
          sendRideUpdates: smsSettings.sendRideUpdates,
        }),
        saveSetting('security_settings', securitySettings),
        saveSetting('appearance_settings', appearanceSettings),
        saveSetting('distance_unit', distanceUnit),
        saveSetting('map_location', mapLocation),
        saveSetting('default_language', { language: defaultLanguage }),
        saveSetting('enabled_languages', { languages: enabledLanguages }),
      ]);

      setPreviousSettings({
        business_info: businessInfo,
        social_links: socialLinks,
        business_hours: businessHours,
        booking_policies: bookingPolicies,
        currency: currency,
        tax_settings: taxSettings,
        email_settings: emailSettings,
        sms_settings: smsSettings,
        security_settings: securitySettings,
        appearance_settings: appearanceSettings,
        distance_unit: distanceUnit,
        map_location: mapLocation,
        default_language: { language: defaultLanguage },
        enabled_languages: { languages: enabledLanguages },
      });

      toast.success(t.admin.settingsSaved);
      setSaveSuccess(true);
      setHasUnsavedChanges(false);
    } catch (err) {
      console.error('Error saving settings:', err);
      toast.error(t.admin.failedToSaveSettings);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveStripeSettings = async (settings: StripeSettings) => {
    try {
      await saveSetting('stripe_settings', settings);
      setStripeSettings(settings);
      toast.success(t.adminPaymentGateways.stripeSaved);
    } catch (err) {
      console.error('Error saving Stripe settings:', err);
      toast.error(t.adminPaymentGateways.stripeFailedToSave);
    }
  };

  const handleSavePaypalSettings = async (settings: PayPalSettings) => {
    try {
      await saveSetting('paypal_settings', settings);
      setPaypalSettings(settings);
      toast.success(t.adminPaymentGateways.paypalSaved);
    } catch (err) {
      console.error('Error saving PayPal settings:', err);
      toast.error(t.adminPaymentGateways.paypalFailedToSave);
    }
  };

  const handleSaveBankSettings = async (settings: import('@/components/admin/settings/types').BankTransferSettings) => {
    try {
      await saveSetting('bank_settings', settings);
      setBankSettings(settings);
      toast.success(t.adminPaymentGateways.bankSaved);
    } catch (err) {
      console.error('Error saving bank settings:', err);
      toast.error(t.adminPaymentGateways.bankFailedToSave);
    }
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground">{t.admin.loadingSettings}</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title={t.admin.settings}
      description={t.admin.configureSettings}
    >
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {hasUnsavedChanges && (
            <Badge variant="secondary" className="border border-orange-300 bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400">
              {t.admin.unsavedChanges}
            </Badge>
          )}
          {saveSuccess && !hasUnsavedChanges && (
            <Badge variant="outline" className="text-accent border-accent/30 bg-accent/10">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              {t.admin.savedLabel}
            </Badge>
          )}
          <Button 
            onClick={handleSaveAll} 
            disabled={isSaving || (!hasUnsavedChanges && saveSuccess)}
            className="gap-2"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isSaving ? t.common.saving : t.admin.saveAllChanges}
          </Button>
        </div>

        {/* Validation Error Alert */}
        {Object.keys(errors).length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {t.admin.validationErrorCount.replace('{count}', String(Object.keys(errors).length))}
            </AlertDescription>
          </Alert>
        )}

        {/* Settings Tabs */}
        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-7">
            <TabsTrigger value="general" className="gap-2">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">{t.admin.general}</span>
            </TabsTrigger>
            <TabsTrigger value="booking" className="gap-2">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">{t.admin.booking}</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">{t.admin.notifications}</span>
            </TabsTrigger>
            <TabsTrigger value="integrations" className="gap-2">
              <Globe className="h-4 w-4" />
              <span className="hidden sm:inline">{t.admin.integrations}</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">{t.admin.security}</span>
            </TabsTrigger>
            <TabsTrigger value="appearance" className="gap-2">
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">{t.admin.appearance}</span>
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-2">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">{t.admin.auditLog}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <GeneralSettingsTab
              businessInfo={businessInfo}
              setBusinessInfo={setBusinessInfo}
              socialLinks={socialLinks}
              setSocialLinks={setSocialLinks}
              businessHours={businessHours}
              setBusinessHours={setBusinessHours}
              currency={currency}
              setCurrency={setCurrency}
              taxSettings={taxSettings}
              setTaxSettings={setTaxSettings}
              distanceUnit={distanceUnit}
              setDistanceUnit={setDistanceUnit}
              mapLocation={mapLocation}
              setMapLocation={setMapLocation}
              defaultLanguage={defaultLanguage}
              setDefaultLanguage={setDefaultLanguage}
              enabledLanguages={enabledLanguages}
              setEnabledLanguages={setEnabledLanguages}
              errors={errors}
            />
          </TabsContent>

          <TabsContent value="booking">
            <BookingSettingsTab
              bookingPolicies={bookingPolicies}
              setBookingPolicies={setBookingPolicies}
              errors={errors}
            />
          </TabsContent>

          <TabsContent value="notifications">
            <NotificationSettingsTab
              emailSettings={emailSettings}
              setEmailSettings={setEmailSettings}
              smsSettings={smsSettings}
              setSmsSettings={setSmsSettings}
            />
          </TabsContent>

          <TabsContent value="integrations">
            <IntegrationsSettingsTab
              stripeSettings={stripeSettings}
              paypalSettings={paypalSettings}
              bankSettings={bankSettings}
              
              onOpenStripeDialog={() => setStripeDialogOpen(true)}
              onOpenPaypalDialog={() => setPaypalDialogOpen(true)}
              onOpenBankDialog={() => setBankDialogOpen(true)}
              
            />
          </TabsContent>

          <TabsContent value="security">
            <SecuritySettingsTab
              securitySettings={securitySettings}
              setSecuritySettings={setSecuritySettings}
            />
          </TabsContent>

          <TabsContent value="appearance">
            <AppearanceSettingsTab
              appearanceSettings={appearanceSettings}
              setAppearanceSettings={setAppearanceSettings}
            />
          </TabsContent>

          <TabsContent value="audit">
            <SettingsAuditLog />
          </TabsContent>
        </Tabs>
      </div>

      {/* Payment Gateway Dialogs */}
      <StripeConfigDialog
        open={stripeDialogOpen}
        onOpenChange={setStripeDialogOpen}
        settings={stripeSettings}
        onSave={handleSaveStripeSettings}
      />
      <PayPalConfigDialog
        open={paypalDialogOpen}
        onOpenChange={setPaypalDialogOpen}
        settings={paypalSettings}
        onSave={handleSavePaypalSettings}
      />
      <BankTransferConfigDialog
        open={bankDialogOpen}
        onOpenChange={setBankDialogOpen}
        settings={bankSettings}
        onSave={handleSaveBankSettings}
      />
    </AdminLayout>
  );
}
