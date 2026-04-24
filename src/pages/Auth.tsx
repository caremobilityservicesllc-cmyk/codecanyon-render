import { useState, useEffect } from 'react';
import { Footer } from '@/components/Footer';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Lock, User, ArrowLeft, Eye, EyeOff, Shield, UserCircle, Car, Apple, Twitter, Facebook } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ForgotPasswordDialog } from '@/components/auth/ForgotPasswordDialog';
import { isDemoMode, showDemoQuickLogin, DEMO_CREDENTIALS, shouldSeedDemoData } from '@/utils/demoMode';
import { z } from 'zod';

async function getPostLoginPath(user: { id?: string; user_metadata?: Record<string, unknown> } | null, fallback: string) {
  if (user?.id) {
    try {
      const { data: roles, error } = await supabase.rpc('get_user_roles', { _user_id: user.id });
      if (!error && Array.isArray(roles)) {
        if (roles.includes('admin') || roles.includes('moderator')) {
          return '/admin';
        }
      }
    } catch {
      // Fall back to metadata-based routing below.
    }
  }

  const role = String(user?.user_metadata?.role || '').toLowerCase();
  const source = String(user?.user_metadata?.source || '').toLowerCase();

  if (role.includes('admin') || role.includes('moderator')) {
    return '/admin';
  }

  if (source === 'legacy_driver' || role.includes('driver')) {
    return '/driver';
  }

  return fallback;
}

function createAuthSchemas(v: any) {
  return {
    identifier: z.string().min(1, 'Please enter your username or email'),
    email: z.string().email(v?.emailRequired || 'Please enter a valid email address'),
    password: z.string().min(6, v?.passwordMinLength || 'Password must be at least 6 characters'),
    name: z.string().min(2, v?.nameMinLength || 'Name must be at least 2 characters'),
  };
}

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [isTwitterLoading, setIsTwitterLoading] = useState(false);
  const [isFacebookLoading, setIsFacebookLoading] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState<'user' | 'admin' | 'driver' | null>(null);
  const [rememberMe, setRememberMe] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [authProviders, setAuthProviders] = useState<{ google: boolean; apple: boolean; twitter: boolean; facebook: boolean }>({ google: false, apple: false, twitter: false, facebook: false });
  const settings = useSystemSettings();
  
  const { signIn, signUp, signInWithSocialProvider } = useAuth();
  const { t } = useTranslation();
  const v = (t as any).validation || {};
  const { identifier: identifierSchema, email: emailSchema, password: passwordSchema, name: nameSchema } = createAuthSchemas(v);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  const redirectPath = searchParams.get('redirect') || '/';

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

  // Handle social auth error from URL params
  useEffect(() => {
    const socialError = searchParams.get('social_error');
    if (socialError) {
      toast({ title: t.auth.socialSignInFailed, description: socialError, variant: 'destructive' });
    }
  }, [searchParams]);
  

  const validateField = (field: string, value: string) => {
    try {
      if (field === 'identifier') identifierSchema.parse(value.trim());
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

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    const { error } = await signInWithSocialProvider('google');
    if (error) {
      toast({
        title: t.authExtra.googleSignInFailed,
        description: error.message,
        variant: 'destructive',
      });
      setIsGoogleLoading(false);
    }
  };

  const handleDemoLogin = async (type: 'user' | 'admin' | 'driver') => {
    setIsDemoLoading(type);
    
    try {
      // Seed demo data if enabled (idempotent)
      if (shouldSeedDemoData()) {
        await supabase.functions.invoke('setup-demo-users');
      }
      
      // Then sign in with demo credentials
      const creds = DEMO_CREDENTIALS[type];
      const { error } = await signIn(creds.email, creds.password);
      
      if (error) {
        toast({
          title: t.authExtra.demoLoginFailed,
          description: t.authExtra.demoLoginFailedDesc,
          variant: 'destructive',
        });
      } else {
        const messages = {
          user: { title: t.authExtra.welcomeDemoUser, desc: t.authExtra.welcomeDemoUserDesc },
          admin: { title: t.authExtra.welcomeDemoAdmin, desc: t.authExtra.welcomeDemoAdminDesc },
          driver: { title: t.authExtra.welcomeDemoDriver, desc: t.authExtra.welcomeDemoDriverDesc },
        };
        toast({
          title: messages[type].title,
          description: messages[type].desc,
        });
        
        const redirects = {
          user: redirectPath,
          admin: '/admin',
          driver: '/driver',
        };
        navigate(redirects[type]);
      }
    } catch (error) {
      console.error('Demo login error:', error);
      toast({
        title: t.authExtra.demoLoginFailed,
        description: t.authExtra.demoLoginError,
        variant: 'destructive',
      });
    } finally {
      setIsDemoLoading(null);
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
    setIsLoading(false);

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        toast({
          title: t.auth.invalidCredentials,
          description: t.auth.checkEmailPassword,
          variant: 'destructive',
        });
      } else {
        toast({
          title: t.auth.signInFailed,
          description: error.message,
          variant: 'destructive',
        });
      }
    } else {
      if (!rememberMe) {
        sessionStorage.setItem('rideflow_temp_session', 'true');
      } else {
        sessionStorage.removeItem('rideflow_temp_session');
      }
      const { data: { user } } = await supabase.auth.getUser();
      toast({
        title: t.auth.welcomeBack,
        description: t.auth.signInSuccess,
      });
      navigate(await getPostLoginPath(user, redirectPath));
    }
  };

  // Handle session cleanup when browser closes (if "Remember me" was not checked)
  useEffect(() => {
    const handleBeforeUnload = () => {
      const isTempSession = sessionStorage.getItem('rideflow_temp_session');
      if (isTempSession) {
        // Note: This won't actually work reliably in beforeunload,
        // but we use sessionStorage which auto-clears on browser close
        supabase.auth.signOut();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Check for temp session on mount and clear if needed
  useEffect(() => {
    const isTempSession = sessionStorage.getItem('rideflow_temp_session');
    // If we have a temp session marker but page reloaded (not closed), 
    // we keep the session. The marker clears on browser close automatically.
  }, []);

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
      if (error.message.includes('User already registered')) {
        toast({
          title: t.auth.accountExists,
          description: t.auth.emailAlreadyRegistered,
          variant: 'destructive',
        });
      } else {
        toast({
          title: t.auth.signUpFailed,
          description: error.message,
          variant: 'destructive',
        });
      }
    } else {
      toast({
        title: t.auth.accountCreated,
        description: `${t.auth.welcomeTo} ${settings.businessInfo.companyName || 'RideFlow'}.`,
      });
      navigate(redirectPath);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto flex min-h-screen flex-col items-center justify-center px-4 py-12">
        {/* Back Button */}
        <div className="mb-8 w-full max-w-md">
          <Button variant="ghost" onClick={() => navigate('/')} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            {t.nav.backToBooking}
          </Button>
        </div>

        {/* Auth Card */}
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-elevated">
          {/* Logo */}
          <div className="mb-8 text-center">
            <Link to="/" className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl gradient-hero transition-opacity hover:opacity-90" aria-label="Go to home">
              <span className="text-2xl font-bold text-accent-foreground">{(settings.businessInfo.companyName || 'R')[0]}</span>
            </Link>
            <h1 className="font-display text-2xl font-bold text-foreground">
              {t.auth.welcomeTo} {settings.businessInfo.companyName || 'RideFlow'}
            </h1>
            <p className="mt-2 text-muted-foreground">
              {t.auth.signInToAccess}
            </p>
          </div>

          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="mb-6 grid w-full grid-cols-2">
              <TabsTrigger value="signin">{t.auth.signIn}</TabsTrigger>
              <TabsTrigger value="signup">{t.auth.signUp}</TabsTrigger>
            </TabsList>

            {/* Sign In Tab */}
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Username or Email</Label>
                  <div className="relative">
                    <Mail className="absolute inset-inline-start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="signin-email"
                      type="text"
                      placeholder="you@example.com or username"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onBlur={() => validateField('identifier', email)}
                      className="ps-10"
                    />
                  </div>
                  {errors.identifier && (
                    <p className="text-sm text-destructive">{errors.identifier}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="signin-password">{t.auth.password}</Label>
                    <ForgotPasswordDialog />
                  </div>
                  <div className="relative">
                    <Lock className="absolute inset-inline-start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="signin-password"
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
                  {errors.password && (
                    <p className="text-sm text-destructive">{errors.password}</p>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="remember-me"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked === true)}
                  />
                  <Label 
                    htmlFor="remember-me" 
                    className="text-sm font-normal text-muted-foreground cursor-pointer"
                  >
                     {t.auth.rememberMe}
                  </Label>
                </div>

                <Button type="submit" variant="booking" className="w-full" disabled={isLoading}>
                  {isLoading ? t.auth.signingIn : t.auth.signIn}
                </Button>
              </form>
            </TabsContent>

            {/* Sign Up Tab */}
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">{t.auth.fullName}</Label>
                  <div className="relative">
                    <User className="absolute inset-inline-start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder={(t as any).placeholders?.fullName || "John Doe"}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      onBlur={() => validateField('fullName', fullName)}
                      className="ps-10"
                    />
                  </div>
                  {errors.fullName && (
                    <p className="text-sm text-destructive">{errors.fullName}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-email">{t.auth.email}</Label>
                  <div className="relative">
                    <Mail className="absolute inset-inline-start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onBlur={() => validateField('email', email)}
                      className="ps-10"
                    />
                  </div>
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-password">{t.auth.password}</Label>
                  <div className="relative">
                    <Lock className="absolute inset-inline-start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="signup-password"
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
                  {errors.password && (
                    <p className="text-sm text-destructive">{errors.password}</p>
                  )}
                   <p className="text-xs text-muted-foreground">
                    {t.auth.passwordMinLength}
                  </p>
                </div>

                <Button type="submit" variant="booking" className="w-full" disabled={isLoading}>
                  {isLoading ? t.auth.creatingAccount : t.auth.createAccount}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          {/* Social Login - only show if at least one provider is enabled */}
          {(authProviders.google || authProviders.apple || authProviders.twitter || authProviders.facebook) && (
            <>
              <div className="relative my-6">
                <Separator />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                  {t.auth.orContinueWith}
                </span>
              </div>

              <div className="space-y-3">
                {authProviders.google && (
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={handleGoogleLogin}
                    disabled={isGoogleLoading}
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    {isGoogleLoading ? t.auth.signingIn : t.auth.continueWithGoogle}
                  </Button>
                )}

                {authProviders.apple && (
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={async () => {
                      setIsAppleLoading(true);
                      const { error } = await signInWithSocialProvider('apple');
                      if (error) {
                        toast({ title: t.authExtra.appleSignInFailed, description: error.message, variant: 'destructive' });
                        setIsAppleLoading(false);
                      }
                    }}
                    disabled={isAppleLoading}
                  >
                    <Apple className="h-4 w-4" />
                    {isAppleLoading ? t.auth.signingIn : t.auth.continueWithApple}
                  </Button>
                )}

                {authProviders.twitter && (
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={async () => {
                      setIsTwitterLoading(true);
                      const { error } = await signInWithSocialProvider('twitter');
                      if (error) {
                        toast({ title: t.authExtra.xSignInFailed, description: error.message, variant: 'destructive' });
                        setIsTwitterLoading(false);
                      }
                    }}
                    disabled={isTwitterLoading}
                  >
                    <Twitter className="h-4 w-4" />
                    {isTwitterLoading ? t.auth.signingIn : t.auth.continueWithX}
                  </Button>
                )}

                {authProviders.facebook && (
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={async () => {
                      setIsFacebookLoading(true);
                      const { error } = await signInWithSocialProvider('facebook');
                      if (error) {
                        toast({ title: t.authExtra.facebookSignInFailed, description: error.message, variant: 'destructive' });
                        setIsFacebookLoading(false);
                      }
                    }}
                    disabled={isFacebookLoading}
                  >
                    <Facebook className="h-4 w-4" />
                    {isFacebookLoading ? t.auth.signingIn : t.auth.continueWithFacebook}
                  </Button>
                )}
              </div>
            </>
          )}

          {/* Demo Login Buttons - Only shown when VITE_DEMO_MODE=true */}
          {showDemoQuickLogin() && (
            <div className="mt-6 space-y-3">
              <p className="text-center text-xs font-medium text-muted-foreground">
                {t.auth.quickDemoAccess}
              </p>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex flex-col items-center gap-0.5 h-auto py-2 px-1"
                  onClick={() => handleDemoLogin('user')}
                  disabled={isDemoLoading !== null}
                >
                  <UserCircle className="h-4 w-4 shrink-0" />
                  <span className="text-[10px] font-medium leading-tight">
                    {isDemoLoading === 'user' ? '...' : 'User'}
                  </span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex flex-col items-center gap-0.5 h-auto py-2 px-1"
                  onClick={() => handleDemoLogin('admin')}
                  disabled={isDemoLoading !== null}
                >
                  <Shield className="h-4 w-4 shrink-0" />
                  <span className="text-[10px] font-medium leading-tight">
                    {isDemoLoading === 'admin' ? '...' : 'Admin'}
                  </span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex flex-col items-center gap-0.5 h-auto py-2 px-1"
                  onClick={() => handleDemoLogin('driver')}
                  disabled={isDemoLoading !== null}
                >
                  <Car className="h-4 w-4 shrink-0" />
                  <span className="text-[10px] font-medium leading-tight">
                    {isDemoLoading === 'driver' ? '...' : 'Driver'}
                  </span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
