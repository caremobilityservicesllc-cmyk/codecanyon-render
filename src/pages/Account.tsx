import { useState, useEffect, useRef, useMemo } from 'react';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from 'next-themes';
import { 
  User, 
  Bell, 
  CreditCard, 
  Settings, 
  ChevronRight,
  Loader2,
  Save,
  Phone,
  Mail,
  Car,
  Briefcase,
  Shield,
  Trash2,
  Key,
  Check,
  Camera,
  Upload,
  Sun,
  Moon,
  Monitor,
  
  Smartphone,
  BellRing,
  Gift
} from 'lucide-react';
import { Navbar } from '@/components/booking/Navbar';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { SavedPaymentMethods } from '@/components/account/SavedPaymentMethods';
import { DefaultPaymentMethodSelector } from '@/components/account/DefaultPaymentMethodSelector';
import { LoyaltyPointsSection } from '@/components/account/LoyaltyPointsSection';
import { BecomeDriverDialog } from '@/components/driver/BecomeDriverDialog';
import { ApplicationProgressTracker } from '@/components/driver/ApplicationProgressTracker';
import { LoadingScreen } from '@/components/LoadingScreen';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useVerificationNotifications } from '@/hooks/useVerificationNotifications';

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  preferred_vehicle: string | null;
  avatar_url: string | null;
  theme_preference: string | null;
}


interface Vehicle {
  id: string;
  name: string;
  category: string;
}

export default function Account() {
  const { user, signOut, loading: authLoading } = useAuth();
  const { businessInfo } = useSystemSettings();
  const appName = businessInfo.companyName || 'RideFlow';
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { t, language, setLanguage } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isSupported: pushSupported, isEnabled: pushEnabled, permission: pushPermission, isLoading: pushLoading, requestPermission, unsubscribe: unsubscribePush, testNotification } = usePushNotifications();
  
  // Subscribe to verification notifications when enabled
  useVerificationNotifications();
  
  // Get initial tab from URL or default to 'profile'
  const tabFromUrl = searchParams.get('tab');
  const validTabs = ['profile', 'notifications', 'payments', 'rewards', 'settings'];
  const initialTab = tabFromUrl && validTabs.includes(tabFromUrl) ? tabFromUrl : 'profile';
  
  const [activeTab, setActiveTab] = useState(initialTab);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  
  // Profile form state
  const [profileForm, setProfileForm] = useState({
    full_name: '',
    phone: '',
    preferred_vehicle: '',
  });

  // Notification preferences
  const [notifications, setNotifications] = useState({
    emailBookingConfirmation: true,
    emailBookingReminder: true,
    emailPromotions: false,
    smsBookingReminder: false,
    smsDriverUpdates: true,
  });

  // Fetch profile
  const { data: profile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data as Profile | null;
    },
    enabled: !!user?.id,
  });

  // Check if user has a driver application/profile
  const { data: driverStatus } = useQuery({
    queryKey: ['driver-application-status', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('drivers')
        .select('id, onboarding_status, is_active, first_name, last_name, rejection_reason, phone, email, license_number, license_expiry')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) return null;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch vehicles for preferred vehicle selector
  const { data: vehicles } = useQuery({
    queryKey: ['vehicles-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicles')
        .select('id, name, category')
        .eq('is_active', true)
        .order('sort_order');
      
      if (error) throw error;
      return data as Vehicle[];
    },
  });

  // Update profile form and theme when data loads
  useEffect(() => {
    if (profile) {
      setProfileForm({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        preferred_vehicle: profile.preferred_vehicle || '',
      });
      // Apply persisted theme preference
      if (profile.theme_preference) {
        setTheme(profile.theme_preference);
      }
    }
  }, [profile, setTheme]);

  // Save theme preference to database
  const saveThemePreference = async (newTheme: string) => {
    setTheme(newTheme);
    if (!user?.id) return;
    
    try {
      await supabase
        .from('profiles')
        .update({ theme_preference: newTheme })
        .eq('id', user.id);
    } catch (error) {
      console.error('Failed to save theme preference:', error);
    }
  };


  // Save profile mutation
  const saveProfile = useMutation({
    mutationFn: async (data: Partial<Profile>) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('profiles')
        .update(data)
        .eq('id', user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      toast({
        title: t.account.profileUpdated,
        description: t.account.profileUpdatedDescription,
      });
    },
    onError: (error) => {
      toast({
        title: t.common.error,
        description: t.account.profileUpdateFailed,
        variant: 'destructive',
      });
    },
  });

  const handleSaveProfile = async () => {
    setIsSaving(true);
    await saveProfile.mutateAsync({
      full_name: profileForm.full_name || null,
      phone: profileForm.phone || null,
      preferred_vehicle: profileForm.preferred_vehicle || null,
    });
    setIsSaving(false);
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user?.id) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: t.account.invalidFileType,
        description: t.account.invalidFileTypeDescription,
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: t.account.fileTooLarge,
        description: t.account.fileTooLargeDescription,
        variant: 'destructive',
      });
      return;
    }

    setIsUploadingAvatar(true);

    try {
      // Create unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Update profile with avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: urlData.publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      // Refresh profile data
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });

      toast({
        title: t.account.avatarUpdated,
        description: t.account.avatarUpdatedDescription,
      });
    } catch (error: any) {
      console.error('Avatar upload error:', error);
      toast({
        title: t.account.uploadFailed,
        description: error.message || t.account.profileUpdateFailed,
        variant: 'destructive',
      });
    }

    setIsUploadingAvatar(false);
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user?.id) return;

    setIsUploadingAvatar(true);

    try {
      // Remove from storage (try to delete, ignore if not exists)
      await supabase.storage
        .from('avatars')
        .remove([`${user.id}/avatar.jpg`, `${user.id}/avatar.png`, `${user.id}/avatar.webp`]);

      // Update profile to remove avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', user.id);

      if (updateError) throw updateError;

      queryClient.invalidateQueries({ queryKey: ['user-profile'] });

      toast({
        title: t.account.avatarRemoved,
        description: t.account.avatarRemovedDescription,
      });
    } catch (error: any) {
      toast({
        title: t.common.error,
        description: t.account.profileUpdateFailed,
        variant: 'destructive',
      });
    }

    setIsUploadingAvatar(false);
  };

  // Get user initials for avatar fallback
  const getUserInitials = () => {
    if (profile?.full_name) {
      return profile.full_name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    if (user?.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return 'U';
  };

  const handleChangePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({
        title: t.account.passwordsDoNotMatch,
        description: t.account.passwordsDoNotMatchDescription,
        variant: 'destructive',
      });
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast({
        title: t.account.passwordTooShort,
        description: t.account.passwordTooShortDescription,
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    const { error } = await supabase.auth.updateUser({
      password: passwordForm.newPassword,
    });

    if (error) {
      toast({
        title: t.common.error,
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: t.account.passwordUpdated,
        description: t.account.passwordUpdatedDescription,
      });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    }
    setIsSaving(false);
  };

  const handleDeleteAccount = async () => {
    // Note: Full account deletion requires admin/service role
    // This signs out and shows confirmation
    toast({
      title: t.account.accountDeletionRequested,
      description: t.account.accountDeletionDescription,
    });
    await signOut();
    navigate('/');
  };

  if (authLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">{t.account.title}</h1>
          <p className="text-muted-foreground">
            {t.account.subtitle}
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
            <TabsTrigger value="profile" className="gap-2">
              <User className="h-4 w-4 hidden sm:inline" />
              {t.account.profileTab}
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="h-4 w-4 hidden sm:inline" />
              {t.account.notificationsTab}
            </TabsTrigger>
            <TabsTrigger value="payments" className="gap-2">
              <CreditCard className="h-4 w-4 hidden sm:inline" />
              {t.account.paymentsTab}
            </TabsTrigger>
            <TabsTrigger value="rewards" className="gap-2">
              <Gift className="h-4 w-4 hidden sm:inline" />
              {t.account.rewardsTab}
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4 hidden sm:inline" />
              {t.account.settingsTab}
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  {t.account.personalInfo}
                </CardTitle>
                <CardDescription>
                  {t.account.updateDetails}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {isLoadingProfile ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    {/* Avatar Upload */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      <div className="relative group">
                        <Avatar className="h-24 w-24 border-2 border-border">
                          <AvatarImage src={profile?.avatar_url || undefined} alt="Profile picture" />
                          <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                            {getUserInitials()}
                          </AvatarFallback>
                        </Avatar>
                        {isUploadingAvatar && (
                          <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-full">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                          </div>
                        )}
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploadingAvatar}
                          className="absolute bottom-0 right-0 p-2 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
                        >
                          <Camera className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-foreground">{t.account.profilePicture}</h4>
                        <p className="text-xs text-muted-foreground">
                          {t.account.profilePictureFormats}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploadingAvatar}
                          >
                            <Upload className="mr-2 h-3 w-3" />
                            {t.account.uploadPhoto}
                          </Button>
                          {profile?.avatar_url && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleRemoveAvatar}
                              disabled={isUploadingAvatar}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="mr-2 h-3 w-3" />
                              {t.account.removePhoto}
                            </Button>
                          )}
                        </div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarUpload}
                          className="hidden"
                        />
                      </div>
                    </div>

                    <Separator />

                    {/* Email (read-only) */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        {t.account.emailAddress}
                      </Label>
                      <Input 
                        value={user.email || ''} 
                        disabled 
                        className="bg-muted"
                      />
                      <p className="text-xs text-muted-foreground">
                        {t.account.emailCannotChange}
                      </p>
                    </div>

                    {/* Full Name */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {t.account.fullName}
                      </Label>
                      <Input
                        value={profileForm.full_name}
                        onChange={(e) => setProfileForm(prev => ({ ...prev, full_name: e.target.value }))}
                        placeholder={t.account.enterFullName}
                      />
                    </div>

                    {/* Phone */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        {t.account.phone}
                      </Label>
                      <Input
                        type="tel"
                        value={profileForm.phone}
                        onChange={(e) => setProfileForm(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder={t.account.phonePlaceholder}
                      />
                    </div>

                    {/* Preferred Vehicle */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Car className="h-4 w-4" />
                        {t.account.preferredVehicle}
                      </Label>
                      <Select
                        value={profileForm.preferred_vehicle}
                        onValueChange={(value) => setProfileForm(prev => ({ ...prev, preferred_vehicle: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t.account.selectPreferredVehicle} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t.account.noPreference}</SelectItem>
                          {vehicles?.map(v => (
                            <SelectItem key={v.id} value={v.id}>
                              {v.name} ({v.category})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {t.account.preferredVehicleHint}
                      </p>
                    </div>

                    <Button 
                      onClick={handleSaveProfile} 
                      disabled={isSaving}
                      className="w-full sm:w-auto"
                    >
                      {isSaving ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      {t.common.saveChanges}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  {t.account.notificationPreferences}
                </CardTitle>
                <CardDescription>
                  {t.account.notificationPreferencesDescription}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Email Notifications */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    {t.account.emailNotifications}
                  </h4>
                  
                  <div className="space-y-4 pl-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{t.account.bookingConfirmations}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.account.bookingConfirmationsDesc}
                        </p>
                      </div>
                      <Switch
                        checked={notifications.emailBookingConfirmation}
                        onCheckedChange={(checked) => 
                          setNotifications(prev => ({ ...prev, emailBookingConfirmation: checked }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{t.account.bookingReminders}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.account.bookingRemindersDesc}
                        </p>
                      </div>
                      <Switch
                        checked={notifications.emailBookingReminder}
                        onCheckedChange={(checked) => 
                          setNotifications(prev => ({ ...prev, emailBookingReminder: checked }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{t.account.promotionsOffers}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.account.promotionsOffersDesc}
                        </p>
                      </div>
                      <Switch
                        checked={notifications.emailPromotions}
                        onCheckedChange={(checked) => 
                          setNotifications(prev => ({ ...prev, emailPromotions: checked }))
                        }
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Push Notifications */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Smartphone className="h-4 w-4" />
                    {t.account.pushNotifications}
                    {!pushSupported && (
                      <Badge variant="secondary" className="text-xs">{t.account.pushNotSupported}</Badge>
                    )}
                  </h4>
                  
                  <div className="space-y-4 pl-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{t.account.enablePushNotifications}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.account.enablePushDesc}
                        </p>
                      </div>
                      <Switch
                        checked={pushEnabled}
                        onCheckedChange={async (checked) => {
                          if (checked) {
                            await requestPermission();
                          } else {
                            await unsubscribePush();
                          }
                        }}
                        disabled={!pushSupported || pushPermission === 'denied'}
                      />
                    </div>

                    {pushPermission === 'denied' && (
                      <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                        <p className="font-medium">{t.account.permissionDenied}</p>
                        <p className="text-xs mt-1">
                          {t.account.permissionDeniedDesc}
                        </p>
                      </div>
                    )}

                    {pushEnabled && (
                      <div className="space-y-3">
                        <div className="rounded-lg bg-accent/10 p-3 text-sm">
                          <div className="flex items-center gap-2 text-accent">
                            <BellRing className="h-4 w-4" />
                            <p className="font-medium">{t.account.pushActive}</p>
                          </div>
                          <p className="text-xs mt-1 text-muted-foreground">
                            {t.account.pushActiveDesc}
                          </p>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={testNotification}
                          disabled={pushLoading}
                          className="gap-2"
                        >
                          <Bell className="h-4 w-4" />
                          {t.account.sendTestNotification}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* SMS Notifications */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    {t.account.smsNotifications}
                    <Badge variant="secondary" className="text-xs">{t.account.requiresPhoneNumber}</Badge>
                  </h4>
                  
                  <div className="space-y-4 pl-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{t.account.smsBookingReminders}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.account.smsBookingRemindersDesc}
                        </p>
                      </div>
                      <Switch
                        checked={notifications.smsBookingReminder}
                        onCheckedChange={(checked) => 
                          setNotifications(prev => ({ ...prev, smsBookingReminder: checked }))
                        }
                        disabled={!profileForm.phone}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{t.account.driverUpdates}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.account.driverUpdatesDesc}
                        </p>
                      </div>
                      <Switch
                        checked={notifications.smsDriverUpdates}
                        onCheckedChange={(checked) => 
                          setNotifications(prev => ({ ...prev, smsDriverUpdates: checked }))
                        }
                        disabled={!profileForm.phone}
                      />
                    </div>
                  </div>
                </div>

                <Button className="w-full sm:w-auto">
                  <Save className="mr-2 h-4 w-4" />
                  {t.account.savePreferences}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments" className="space-y-6">
            <SavedPaymentMethods />

            {/* Default Payment Method Selector */}
            <DefaultPaymentMethodSelector />

            {/* Payment Preferences */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  {t.account.paymentPreferences}
                </CardTitle>
                <CardDescription>
                  {t.account.configurePayments}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{t.account.saveCardsForFuture}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.account.saveCardsDesc}
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{t.account.autoPayBalance}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.account.autoPayDesc}
                    </p>
                  </div>
                  <Switch />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Rewards Tab */}
          <TabsContent value="rewards">
            <LoyaltyPointsSection />
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <div className="space-y-6">
              {/* Appearance */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sun className="h-5 w-5" />
                    {t.settings.appearance}
                  </CardTitle>
                  <CardDescription>
                    {t.settings.appearanceDesc.replace('{appName}', appName)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <Label>{t.settings.theme}</Label>
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        onClick={() => saveThemePreference('light')}
                        className={cn(
                          "flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all",
                          theme === 'light' 
                            ? "border-accent bg-accent/10" 
                            : "border-border hover:border-accent/50"
                        )}
                      >
                        <Sun className="h-6 w-6" />
                        <span className="text-sm font-medium">{t.settings.light}</span>
                        {theme === 'light' && (
                          <Check className="h-4 w-4 text-accent" />
                        )}
                      </button>
                      <button
                        onClick={() => saveThemePreference('dark')}
                        className={cn(
                          "flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all",
                          theme === 'dark' 
                            ? "border-accent bg-accent/10" 
                            : "border-border hover:border-accent/50"
                        )}
                      >
                        <Moon className="h-6 w-6" />
                        <span className="text-sm font-medium">{t.settings.dark}</span>
                        {theme === 'dark' && (
                          <Check className="h-4 w-4 text-accent" />
                        )}
                      </button>
                      <button
                        onClick={() => saveThemePreference('system')}
                        className={cn(
                          "flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all",
                          theme === 'system' 
                            ? "border-accent bg-accent/10" 
                            : "border-border hover:border-accent/50"
                        )}
                      >
                        <Monitor className="h-6 w-6" />
                        <span className="text-sm font-medium">{t.settings.system}</span>
                        {theme === 'system' && (
                          <Check className="h-4 w-4 text-accent" />
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t.settings.themeSaved}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Language removed — managed via footer selector and admin default */}

              {/* Change Password */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    {t.account.changePassword}
                  </CardTitle>
                  <CardDescription>
                    {t.account.changePasswordDescription}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t.account.newPassword}</Label>
                    <Input
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                      placeholder={t.account.enterNewPassword}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t.account.confirmNewPassword}</Label>
                    <Input
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      placeholder={t.account.confirmNewPasswordPlaceholder}
                    />
                  </div>
                  <Button 
                    onClick={handleChangePassword}
                    disabled={!passwordForm.newPassword || !passwordForm.confirmPassword || isSaving}
                  >
                    {isSaving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Key className="mr-2 h-4 w-4" />
                    )}
                    {t.account.updatePassword}
                  </Button>
                </CardContent>
              </Card>

              {/* Become a Driver / Application Progress */}
              {driverStatus ? (
                <ApplicationProgressTracker
                  driverId={driverStatus.id}
                  driverName={`${driverStatus.first_name} ${driverStatus.last_name}`}
                  onboardingStatus={driverStatus.onboarding_status || 'pending'}
                  isActive={driverStatus.is_active || false}
                  rejectionReason={driverStatus.rejection_reason}
                  driverData={{
                    first_name: driverStatus.first_name,
                    last_name: driverStatus.last_name,
                    phone: driverStatus.phone,
                    email: driverStatus.email,
                    license_number: driverStatus.license_number,
                    license_expiry: driverStatus.license_expiry,
                  }}
                />
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Briefcase className="h-5 w-5" />
                      {t.account.becomeDriverTitle}
                    </CardTitle>
                    <CardDescription>
                      {t.account.becomeDriverDescription.replace('{appName}', appName)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-start gap-4">
                        <div className="h-12 w-12 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                          <Car className="h-6 w-6 text-accent" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">
                            {t.account.becomeDriverDetails.replace(/\{appName\}/g, appName)}
                          </p>
                        </div>
                      </div>
                      <BecomeDriverDialog>
                        <Button className="w-full sm:w-auto">
                          <Briefcase className="mr-2 h-4 w-4" />
                          {t.account.applyNow}
                        </Button>
                      </BecomeDriverDialog>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Security */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    {t.account.security}
                  </CardTitle>
                  <CardDescription>
                    {t.account.securityDescription}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{t.account.twoFactor}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.account.twoFactorDesc}
                      </p>
                    </div>
                    <Badge variant="secondary">{t.common.comingSoon}</Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{t.account.loginSessions}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.account.loginSessionsDesc}
                      </p>
                    </div>
                    <Button variant="outline" size="sm">
                      {t.account.viewSessions}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Danger Zone */}
              <Card className="border-destructive/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-destructive">
                    <Trash2 className="h-5 w-5" />
                    {t.account.dangerZone}
                  </CardTitle>
                  <CardDescription>
                    {t.account.dangerZoneDescription}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive">
                        <Trash2 className="mr-2 h-4 w-4" />
                        {t.account.deleteAccount}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t.account.deleteAccountTitle}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t.account.deleteAccountWarning}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeleteAccount}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {t.account.deleteAccount}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
}
