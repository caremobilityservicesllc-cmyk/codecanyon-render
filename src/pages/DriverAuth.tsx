import { useState, useEffect } from 'react';
import { Footer } from '@/components/Footer';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowLeft, Eye, EyeOff, Car, MapPin, Clock, DollarSign, CheckCircle, User, Apple, Twitter, Facebook } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { supabase } from '@/integrations/supabase/client';
import { showDemoQuickLogin } from '@/utils/demoMode';
import { z } from 'zod';
import { useBrandLogo } from '@/hooks/useBrandLogo';
import { BecomeDriverDialog } from '@/components/driver/BecomeDriverDialog';
import { useLanguage } from '@/contexts/LanguageContext';

function createAuthSchemas(v: any) {
  return {
    identifier: z.string().min(1, 'Please enter your username or email'),
    email: z.string().email(v?.emailRequired || 'Please enter a valid email address'),
    password: z.string().min(6, v?.passwordMinLength || 'Password must be at least 6 characters'),
    name: z.string().min(2, v?.nameMinLength || 'Name must be at least 2 characters'),
  };
}

function DriverSignInForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { t } = useLanguage();
  const { identifier: identifierSchema, email: emailSchema, password: passwordSchema, name: nameSchema } = createAuthSchemas((t as any).validation);

  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const validateField = (field: string, value: string) => {
    try {
      if (field === 'identifier') identifierSchema.parse(value.trim());
      if (field === 'email') emailSchema.parse(value);
      if (field === 'password') passwordSchema.parse(value);
      setErrors((prev) => ({ ...prev, [field]: '' }));
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        setErrors((prev) => ({ ...prev, [field]: error.errors[0].message }));
      }
      return false;
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const emailValid = validateField('identifier', email);
    const passwordValid = validateField('password', password);

    if (!emailValid || !passwordValid) return;

    setIsLoading(true);
    const { error } = await signIn(email, password);

    if (error) {
      setIsLoading(false);
      if (error.message.includes('Invalid login credentials')) {
        toast({
          title: t.driverAuth.invalidCredentials,
          description: t.driverAuth.invalidCredentialsDesc,
          variant: 'destructive',
        });
      } else {
        toast({
          title: t.driverAuth.signInFailed,
          description: error.message,
          variant: 'destructive',
        });
      }
      return;
    }

    const { data: { user: signedInUser } } = await supabase.auth.getUser();
    if (signedInUser) {
      const { data: driverData } = await supabase
        .from('drivers')
        .select('id, first_name')
        .eq('user_id', signedInUser.id)
        .maybeSingle();

      setIsLoading(false);

      if (driverData) {
        toast({
          title: t.driverAuth.welcomeBack.replace('{name}', driverData.first_name),
          description: t.driverAuth.redirectingToDashboard,
        });
        navigate('/driver');
      } else {
        toast({
          title: t.driverAuth.notRegisteredDriver,
          description: t.driverAuth.notRegisteredDriverDesc,
          variant: 'destructive',
        });
      }
    }
  };

  return (
    <form onSubmit={handleSignIn} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="driver-email">Username or Email</Label>
        <div className="relative">
          <Mail className="absolute inset-inline-start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="driver-email"
            type="text"
            placeholder="driver@example.com or username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => validateField('identifier', email)}
            className="ps-10"
          />
        </div>
        {errors.identifier && <p className="text-sm text-destructive">{errors.identifier}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="driver-password">{t.driverAuth.password}</Label>
        <div className="relative">
          <Lock className="absolute inset-inline-start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="driver-password"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => validateField('password', password)}
            className="ps-10 pe-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-inline-end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
        {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
      </div>

      {showDemoQuickLogin() && (
        <div className="p-3 rounded-lg bg-muted/50 border border-border">
          <p className="text-xs text-muted-foreground mb-2 text-center">{t.driverAuth.quickAccess}</p>
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2"
            disabled={isLoading}
            onClick={async () => {
              setEmail('driver@demo.com');
              setPassword('Driver123!');
              setIsLoading(true);
              const { error } = await signIn('driver@demo.com', 'Driver123!');
              if (error) {
                setIsLoading(false);
                return;
              }
              const { data: { user: signedInUser } } = await supabase.auth.getUser();
              if (signedInUser) {
                const { data: driverData } = await supabase
                  .from('drivers')
                  .select('id, first_name')
                  .eq('user_id', signedInUser.id)
                  .maybeSingle();
                setIsLoading(false);
                if (driverData) {
                  navigate('/driver');
                }
              }
            }}
          >
            <Car className="h-4 w-4" />
            {t.driverAuth.signInAsDemoDriver}
          </Button>
        </div>
      )}

      <Button type="submit" className="w-full h-12 text-base font-semibold gap-2" disabled={isLoading}>
        <Car className="h-5 w-5" />
        {isLoading ? t.driverAuth.signingIn : t.driverAuth.signInToDriverPortal}
      </Button>
    </form>
  );
}

function DriverSignUpForm() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [signUpComplete, setSignUpComplete] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { t } = useLanguage();
  const { email: emailSchema, password: passwordSchema, name: nameSchema } = createAuthSchemas((t as any).validation);

  const { signUp } = useAuth();
  const { toast } = useToast();

  const validateField = (field: string, value: string) => {
    try {
      if (field === 'email') emailSchema.parse(value);
      if (field === 'password') passwordSchema.parse(value);
      if (field === 'fullName') nameSchema.parse(value);
      setErrors((prev) => ({ ...prev, [field]: '' }));
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        setErrors((prev) => ({ ...prev, [field]: error.errors[0].message }));
      }
      return false;
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const nameValid = validateField('fullName', fullName);
    const emailValid = validateField('email', email);
    const passwordValid = validateField('password', password);

    if (!nameValid || !emailValid || !passwordValid) return;

    setIsLoading(true);
    const { error } = await signUp(email, password, fullName);
    setIsLoading(false);

    if (error) {
      toast({
        title: t.driverAuth.signUpFailed,
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    setSignUpComplete(true);
    toast({
      title: t.driverAuth.accountCreated,
      description: t.driverAuth.accountCreatedDesc,
    });
  };

  if (signUpComplete) {
    return (
      <div className="text-center py-6 space-y-4">
        <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
          <CheckCircle className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">{t.driverAuth.checkYourEmail}</h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          {t.driverAuth.checkYourEmailDesc.replace('{email}', email)}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSignUp} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="driver-name">{t.driverAuth.fullName}</Label>
        <div className="relative">
          <User className="absolute inset-inline-start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="driver-name"
            placeholder={(t as any).placeholders?.fullName || "John Doe"}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            onBlur={() => validateField('fullName', fullName)}
            className="ps-10"
          />
        </div>
        {errors.fullName && <p className="text-sm text-destructive">{errors.fullName}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="driver-signup-email">{t.driverAuth.email}</Label>
        <div className="relative">
          <Mail className="absolute inset-inline-start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="driver-signup-email"
            type="email"
            placeholder="driver@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => validateField('email', email)}
            className="ps-10"
          />
        </div>
        {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="driver-signup-password">{t.driverAuth.password}</Label>
        <div className="relative">
          <Lock className="absolute inset-inline-start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="driver-signup-password"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => validateField('password', password)}
            className="ps-10 pe-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-inline-end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
        {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
      </div>

      <Button type="submit" className="w-full h-12 text-base font-semibold gap-2" disabled={isLoading}>
        <Car className="h-5 w-5" />
        {isLoading ? t.driverAuth.creatingAccount : t.driverAuth.createDriverAccount}
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        {t.driverAuth.afterCreatingAccount}
      </p>
    </form>
  );
}

export default function DriverAuth() {
  const [activeTab, setActiveTab] = useState('signin');
  const { user, signInWithSocialProvider } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { businessInfo } = useSystemSettings();
  const { t } = useLanguage();
  const appName = businessInfo.companyName || 'RideFlow';
  const logoSrc = useBrandLogo();
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [authProviders, setAuthProviders] = useState<{ google: boolean; apple: boolean; twitter: boolean; facebook: boolean }>({ google: false, apple: false, twitter: false, facebook: false });
  const [socialLoading, setSocialLoading] = useState<string | null>(null);

  // Fetch configured auth providers
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const { data } = await supabase
          .from('system_settings')
          .select('key, value')
          .in('key', ['auth_provider_google', 'auth_provider_apple', 'auth_provider_twitter', 'auth_provider_facebook']);
        if (data) {
          const providers = { google: false, apple: false, twitter: false, facebook: false };
          for (const s of data) {
            const val = s.value as any;
            if (s.key === 'auth_provider_google' && val?.enabled) providers.google = true;
            if (s.key === 'auth_provider_apple' && val?.enabled) providers.apple = true;
            if (s.key === 'auth_provider_twitter' && val?.enabled) providers.twitter = true;
            if (s.key === 'auth_provider_facebook' && val?.enabled) providers.facebook = true;
          }
          setAuthProviders(providers);
        }
      } catch (err) {
        console.error('Failed to fetch auth providers:', err);
      }
    };
    fetchProviders();
  }, []);

  const handleSocialLogin = async (provider: 'google' | 'apple' | 'twitter' | 'facebook') => {
    setSocialLoading(provider);
    const { error } = await signInWithSocialProvider(provider);
    if (error) {
      const labels = { google: 'Google', apple: 'Apple', twitter: 'X', facebook: 'Facebook' };
      toast({ title: ((t as any).socialSignIn?.signInFailed || '{provider} sign-in failed').replace('{provider}', labels[provider]), description: error.message, variant: 'destructive' });
      setSocialLoading(null);
    }
  };

  const hasSocialProviders = authProviders.google || authProviders.apple || authProviders.twitter || authProviders.facebook;

  // If already logged in, check if driver and redirect or show apply dialog
  useEffect(() => {
    async function checkDriverStatus() {
      if (!user) return;

      const { data } = await supabase
        .from('drivers')
        .select('id, onboarding_status')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        navigate('/driver');
      } else {
        setShowApplyDialog(true);
      }
    }

    checkDriverStatus();
  }, [user, navigate]);

  const features = [
    { icon: MapPin, title: t.driverAuth.viewAssignedRides, description: t.driverAuth.viewAssignedRidesDesc },
    { icon: Clock, title: t.driverAuth.manageYourSchedule, description: t.driverAuth.manageYourScheduleDesc },
    { icon: DollarSign, title: t.driverAuth.trackEarnings, description: t.driverAuth.trackEarningsDesc },
    { icon: CheckCircle, title: t.driverAuth.updateAvailability, description: t.driverAuth.updateAvailabilityDesc },
  ];

  // If user is logged in but not a driver, show the apply dialog
  if (user && showApplyDialog) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-elevated text-center space-y-6">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-primary">
            <Car className="h-8 w-8 text-primary-foreground" />
          </div>
          <h2 className="text-xl font-bold text-foreground">{t.driverAuth.becomeADriver}</h2>
          <p className="text-muted-foreground text-sm">
            {t.driverAuth.becomeADriverDesc}
          </p>
          <BecomeDriverDialog onSuccess={() => navigate('/driver')}>
            <Button className="w-full h-12 text-base font-semibold gap-2">
              <Car className="h-5 w-5" />
              {t.driverAuth.applyToBecomeDriver}
            </Button>
          </BecomeDriverDialog>
          <Button variant="ghost" onClick={() => navigate('/')} className="w-full gap-2">
            <ArrowLeft className="h-4 w-4" />
            {t.driverAuth.backToMainSite}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <div className="container mx-auto flex min-h-screen">
        {/* Left Side - Branding & Features */}
        <div className="hidden lg:flex lg:w-1/2 flex-col justify-center px-12 py-12">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-6">
              <img
                src={logoSrc}
                alt={`${appName} Logo`}
                className="h-12 w-12 rounded-xl object-contain"
              />
              <div>
                <span className="font-display text-2xl font-bold text-foreground">
                  {appName}
                </span>
                <p className="text-sm text-muted-foreground">{t.driverAuth.driverPortal}</p>
              </div>
            </div>
            <h1 className="text-4xl font-bold text-foreground mb-4">
              {t.driverAuth.welcomeToDriverHub} <span className="text-primary">{t.driverAuth.driverHub}</span>
            </h1>
            <p className="text-lg text-muted-foreground">
              {t.driverAuth.driverHubDesc}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {features.map((feature, index) => (
              <div
                key={index}
                className="p-4 rounded-xl border border-border bg-card/50 backdrop-blur-sm"
              >
                <feature.icon className="h-8 w-8 text-primary mb-3" />
                <h3 className="font-semibold text-foreground mb-1">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right Side - Auth Forms */}
        <div className="w-full lg:w-1/2 flex flex-col items-center justify-center px-4 py-12">
          <div className="mb-8 w-full max-w-md">
            <Button variant="ghost" onClick={() => navigate('/')} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              {t.driverAuth.backToMainSite}
            </Button>
          </div>

          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-elevated">
            {/* Logo */}
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-primary">
                <Car className="h-8 w-8 text-primary-foreground" />
              </div>
              <h2 className="font-display text-xl font-bold text-foreground">
                {t.driverAuth.driverPortal}
              </h2>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="signin">{t.driverAuth.signIn}</TabsTrigger>
                <TabsTrigger value="signup">{t.driverAuth.register}</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <DriverSignInForm />
              </TabsContent>

              <TabsContent value="signup">
                <DriverSignUpForm />
              </TabsContent>
            </Tabs>

            {/* Social Login */}
            {hasSocialProviders && (
              <>
                <div className="relative my-6">
                  <Separator />
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                    {t.driverAuth.orContinueWith}
                  </span>
                </div>

                <div className="space-y-3">
                  {authProviders.google && (
                    <Button variant="outline" className="w-full gap-2" onClick={() => handleSocialLogin('google')} disabled={!!socialLoading}>
                      <svg className="h-4 w-4" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                      </svg>
                      {socialLoading === 'google' ? t.driverAuth.signingIn : t.driverAuth.continueWithGoogle}
                    </Button>
                  )}
                  {authProviders.apple && (
                    <Button variant="outline" className="w-full gap-2" onClick={() => handleSocialLogin('apple')} disabled={!!socialLoading}>
                      <Apple className="h-4 w-4" />
                      {socialLoading === 'apple' ? t.driverAuth.signingIn : t.driverAuth.continueWithApple}
                    </Button>
                  )}
                  {authProviders.twitter && (
                    <Button variant="outline" className="w-full gap-2" onClick={() => handleSocialLogin('twitter')} disabled={!!socialLoading}>
                      <Twitter className="h-4 w-4" />
                      {socialLoading === 'twitter' ? t.driverAuth.signingIn : t.driverAuth.continueWithX}
                    </Button>
                  )}
                  {authProviders.facebook && (
                    <Button variant="outline" className="w-full gap-2" onClick={() => handleSocialLogin('facebook')} disabled={!!socialLoading}>
                      <Facebook className="h-4 w-4" />
                      {socialLoading === 'facebook' ? t.driverAuth.signingIn : t.driverAuth.continueWithFacebook}
                    </Button>
                  )}
                </div>
              </>
            )}

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                {t.driverAuth.notADriver}{' '}
                <Button
                  variant="link"
                  className="p-0 h-auto font-medium"
                  onClick={() => navigate('/auth')}
                >
                  {t.driverAuth.signInAsCustomer}
                </Button>
              </p>
            </div>
          </div>

          <div className="mt-6 text-center max-w-md">
            <p className="text-xs text-muted-foreground">
              {t.driverAuth.havingTrouble}{' '}
              <span className="font-medium text-foreground">support@{appName.toLowerCase().replace(/\s+/g, '')}.com</span>
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}