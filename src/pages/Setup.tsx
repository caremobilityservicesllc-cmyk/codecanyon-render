import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { 
  Shield, CheckCircle2, XCircle, Database, User, Building2, 
  Settings, Mail, Lock, Rocket, ArrowRight, ArrowLeft, Loader2,
  AlertTriangle, SkipForward
} from 'lucide-react';
import { toast } from 'sonner';

interface StepStatus {
  completed: boolean;
  error?: string;
}

const STEPS_META = [
  { id: 'environment', icon: Database, required: true },
  { id: 'admin', icon: Shield, required: true },
  { id: 'launch', icon: Rocket, required: true },
];

export default function Setup() {
  const navigate = useNavigate();
  const { businessInfo } = useSystemSettings();
  const { t } = useLanguage();
  const appName = businessInfo.companyName || 'RideFlow';

  const STEPS = STEPS_META.map(s => ({
    ...s,
    label: s.id === 'environment' ? t.setup.environmentCheck : s.id === 'admin' ? t.setup.superAdmin : t.setup.launch,
    description: s.id === 'environment' ? t.setup.environmentCheckDesc : s.id === 'admin' ? t.setup.superAdminDesc : t.setup.launchDesc,
  }));
  const [currentStep, setCurrentStep] = useState(0);
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);

  // Environment check state
  const [envChecks, setEnvChecks] = useState<Record<string, boolean | null>>({
    database: null,
    auth: null,
    settings: null,
  });

  // Admin form state
  const [adminForm, setAdminForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
  });

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  // Auto-run environment check on mount
  useEffect(() => {
    runEnvironmentCheck();
  }, []);

  // Step 1: Environment check
  const runEnvironmentCheck = async () => {
    setIsProcessing(true);
    const checks: Record<string, boolean | null> = { database: null, auth: null, settings: null };

    // Check database connectivity
    try {
      const { error } = await supabase.from('system_settings').select('id').limit(1);
      checks.database = !error;
    } catch { checks.database = false; }
    setEnvChecks({ ...checks });

    // Check auth service
    try {
      const { error } = await supabase.auth.getSession();
      checks.auth = !error;
    } catch { checks.auth = false; }
    setEnvChecks({ ...checks });

    // Check system_settings table is accessible
    try {
      const { data } = await supabase.from('system_settings').select('key').limit(1);
      checks.settings = data !== null;
    } catch { checks.settings = false; }
    setEnvChecks({ ...checks });

    const allPassed = Object.values(checks).every(v => v === true);
    setStepStatuses(prev => ({ ...prev, environment: { completed: allPassed, error: allPassed ? undefined : 'Some checks failed' } }));
    setIsProcessing(false);

    // Auto-advance if all passed
    if (allPassed) {
      setTimeout(() => setCurrentStep(1), 500);
    }
  };

  // Step 2: Create Super Admin
  const createSuperAdmin = async () => {
    if (adminForm.password !== adminForm.confirmPassword) {
      toast.error(t.setup.passwordsDoNotMatch);
      return;
    }
    if (adminForm.password.length < 8) {
      toast.error(t.setup.passwordMinLength);
      return;
    }
    if (!adminForm.email || !adminForm.fullName) {
      toast.error(t.setup.allFieldsRequired);
      return;
    }

    setIsProcessing(true);
    try {
      // Sign up the admin user
      const { error: signUpError } = await supabase.auth.signUp({
        email: adminForm.email,
        password: adminForm.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: { full_name: adminForm.fullName },
        },
      });

      if (signUpError) throw signUpError;

      // Try signing in
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: adminForm.email,
        password: adminForm.password,
      });

      if (signInError) {
        // If auto-confirm is off, inform user
        toast.warning(t.setup.emailVerificationRequired);
        setStepStatuses(prev => ({ ...prev, admin: { completed: false, error: t.setup.emailVerificationError } }));
        setIsProcessing(false);
        return;
      }

      // User is now signed in — assign admin role
      const { error: adminError } = await supabase.rpc('make_user_admin', {
        user_email: adminForm.email,
      });

      if (adminError) throw adminError;

      setIsSignedIn(true);
      setStepStatuses(prev => ({ ...prev, admin: { completed: true } }));
      toast.success(t.setup.superAdminCreated);
    } catch (err: any) {
      const msg = err.message || t.setup.failedToCreateAdmin;
      toast.error(msg);
      setStepStatuses(prev => ({ ...prev, admin: { completed: false, error: msg } }));
    }
    setIsProcessing(false);
  };

  // Check if user is already signed in (e.g. after email verification redirect)
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setIsSignedIn(true);
        setAdminForm(prev => ({
          ...prev,
          email: session.user.email || prev.email,
          fullName: session.user.user_metadata?.full_name || prev.fullName,
        }));

        // Check if this user is already admin
        const { data: roles } = await supabase.rpc('get_user_roles', { _user_id: session.user.id });
        if (roles && roles.includes('admin')) {
          setStepStatuses(prev => ({ ...prev, admin: { completed: true } }));
        }
      }
    };
    checkAuth();
  }, []);

  useEffect(() => {
    if (currentStep === 1 && stepStatuses.admin?.completed) {
      setCurrentStep(2);
    }
  }, [currentStep, stepStatuses.admin?.completed]);

  // Step 3: Finalize setup
  const finalizeSetup = async () => {
    if (!isSignedIn) {
      toast.error(t.setup.mustBeSignedIn);
      return;
    }

    setIsProcessing(true);
    try {
      const { error } = await supabase.from('system_settings').upsert({
        key: 'setup_completed',
        value: true as any,
        category: 'system',
        description: 'Whether the initial setup wizard has been completed',
      }, { onConflict: 'key' });

      if (error) throw error;

      toast.success(t.setup.setupComplete);
      setTimeout(() => navigate('/admin'), 1500);
    } catch (err: any) {
      toast.error(err.message || t.setup.failedToFinalize);
    }
    setIsProcessing(false);
  };

  const canProceed = () => {
    const stepId = STEPS[currentStep].id;
    if (stepId === 'environment') return stepStatuses.environment?.completed === true;
    if (stepId === 'admin') return stepStatuses.admin?.completed === true;
    return true;
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const CheckIcon = ({ status }: { status: boolean | null }) => {
    if (status === null) return <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />;
    if (status) return <CheckCircle2 className="h-5 w-5 text-primary" />;
    return <XCircle className="h-5 w-5 text-destructive" />;
  };

  const renderStepContent = () => {
    const stepId = STEPS[currentStep].id;

    switch (stepId) {
      case 'environment':
        return (
          <div className="space-y-6">
            <p className="text-muted-foreground">
              {t.setup.verifyEnvironment}
            </p>
            <div className="space-y-3">
              {Object.entries(envChecks).map(([key, status]) => (
                <div key={key} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                  <div className="flex items-center gap-3">
                    <CheckIcon status={status} />
                    <span className="font-medium capitalize">{key}</span>
                  </div>
                  <Badge variant={status === true ? 'default' : status === false ? 'destructive' : 'secondary'}>
                    {status === null ? t.setup.checking : status ? t.setup.connected : t.setup.failed}
                  </Badge>
                </div>
              ))}
            </div>
            {stepStatuses.environment?.error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{t.setup.environmentIssues}</AlertTitle>
                <AlertDescription>
                  {t.setup.someServicesNotResponding}
                </AlertDescription>
              </Alert>
            )}
            {stepStatuses.environment?.completed && (
              <Alert>
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <AlertTitle>{t.setup.allChecksPassed}</AlertTitle>
                <AlertDescription>{t.setup.environmentReady}</AlertDescription>
              </Alert>
            )}
            <Button onClick={runEnvironmentCheck} disabled={isProcessing} variant="outline" className="w-full">
              {isProcessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Database className="h-4 w-4 mr-2" />}
              {isProcessing ? t.setup.runningChecks : t.setup.reRunCheck}
            </Button>
          </div>
        );

      case 'admin':
        return (
          <div className="space-y-6">
            <p className="text-muted-foreground">
              {t.setup.createSuperAdminDesc}
            </p>
            {stepStatuses.admin?.completed ? (
              <Alert>
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <AlertTitle>{t.setup.superAdminReady}</AlertTitle>
                <AlertDescription>
                  {t.setup.adminAccountActive.replace('{email}', adminForm.email)}
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="admin-name">{t.setup.fullName}</Label>
                  <Input id="admin-name" placeholder={(t as any).placeholders?.fullName || "John Doe"} value={adminForm.fullName} onChange={(e) => setAdminForm(prev => ({ ...prev, fullName: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-email">{t.setup.emailAddress}</Label>
                  <Input id="admin-email" type="email" placeholder={(t as any).placeholders?.adminEmail || "admin@yourdomain.com"} value={adminForm.email} onChange={(e) => setAdminForm(prev => ({ ...prev, email: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-password">{t.setup.password}</Label>
                  <Input id="admin-password" type="password" placeholder={t.setup.minimumChars} value={adminForm.password} onChange={(e) => setAdminForm(prev => ({ ...prev, password: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-confirm">{t.setup.confirmPassword}</Label>
                  <Input id="admin-confirm" type="password" placeholder={t.setup.repeatPassword} value={adminForm.confirmPassword} onChange={(e) => setAdminForm(prev => ({ ...prev, confirmPassword: e.target.value }))} />
                </div>
                {stepStatuses.admin?.error && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{stepStatuses.admin.error}</AlertDescription>
                  </Alert>
                )}
                <Button onClick={createSuperAdmin} disabled={isProcessing} className="w-full">
                  {isProcessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Shield className="h-4 w-4 mr-2" />}
                  {isProcessing ? t.setup.creatingAccount : t.setup.createSuperAdmin}
                </Button>
              </div>
            )}
          </div>
        );

      case 'launch':
        return (
          <div className="space-y-6">
            <p className="text-muted-foreground">
              {t.setup.reviewAndLaunch}
            </p>
            <div className="space-y-3">
              {STEPS.slice(0, -1).map((step) => {
                const status = stepStatuses[step.id];
                const StepIcon = step.icon;
                return (
                  <div key={step.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                    <div className="flex items-center gap-3">
                      <StepIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{step.label}</span>
                    </div>
                    <Badge variant={status?.completed ? 'default' : 'destructive'}>
                      {status?.completed ? t.setup.completed : t.setup.required}
                    </Badge>
                  </div>
                );
              })}
            </div>
            {!isSignedIn && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{t.setup.notSignedIn}</AlertTitle>
                <AlertDescription>{t.setup.mustBeSignedInToFinalize}</AlertDescription>
              </Alert>
            )}
            {(!stepStatuses.environment?.completed || !stepStatuses.admin?.completed) && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{t.setup.requiredStepsIncomplete}</AlertTitle>
                <AlertDescription>{t.setup.completeAllSteps}</AlertDescription>
              </Alert>
            )}
            <Alert>
              <Settings className="h-4 w-4" />
              <AlertTitle>{t.setup.whatsNext}</AlertTitle>
              <AlertDescription>{t.setup.whatsNextDesc}</AlertDescription>
            </Alert>
            <Button 
              onClick={finalizeSetup} 
              disabled={isProcessing || !stepStatuses.environment?.completed || !stepStatuses.admin?.completed || !isSignedIn}
              className="w-full"
              size="lg"
            >
              {isProcessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Rocket className="h-4 w-4 mr-2" />}
              {isProcessing ? t.setup.launching : t.setup.launchApplication}
            </Button>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">{t.setup.title.replace('{appName}', appName)}</h1>
          </div>
          <p className="text-muted-foreground">{t.setup.subtitle}</p>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{t.setup.stepOf.replace('{current}', String(currentStep + 1)).replace('{total}', String(STEPS.length))}</span>
            <span>{t.setup.percentComplete.replace('{percent}', String(Math.round(progress)))}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Step Navigation */}
        <div className="flex gap-2 justify-center">
          {STEPS.map((step, index) => {
            const StepIcon = step.icon;
            const isActive = index === currentStep;
            const isCompleted = stepStatuses[step.id]?.completed;
            return (
              <button
                key={step.id}
                onClick={() => setCurrentStep(index)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors
                  ${isActive ? 'bg-primary text-primary-foreground' : 
                    isCompleted ? 'bg-primary/20 text-primary border border-primary/30' : 
                    'bg-muted text-muted-foreground hover:bg-muted/80'}`}
              >
                {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : <StepIcon className="h-4 w-4" />}
                {step.label}
              </button>
            );
          })}
        </div>

        {/* Step Content */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {(() => { const Icon = STEPS[currentStep].icon; return <Icon className="h-5 w-5 text-primary" />; })()}
              {STEPS[currentStep].label}
            </CardTitle>
            <CardDescription className="mt-1.5">{STEPS[currentStep].description}</CardDescription>
          </CardHeader>
          <CardContent>
            {renderStepContent()}
          </CardContent>
        </Card>

        {/* Navigation Buttons */}
        <div className="flex justify-between">
          <Button variant="outline" onClick={handleBack} disabled={currentStep === 0}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t.setup.back}
          </Button>
          {currentStep < STEPS.length - 1 && (
            <Button onClick={handleNext} disabled={!canProceed()}>
              {t.setup.next}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
