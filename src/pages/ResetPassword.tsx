import { useState, useEffect } from 'react';
import { Footer } from '@/components/Footer';
import { useNavigate } from 'react-router-dom';
import { Lock, ArrowLeft, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { z } from 'zod';

export default function ResetPassword() {
  const { t } = useLanguage();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const navigate = useNavigate();
  const { toast } = useToast();

  const passwordSchema = z.string().min(6, t.resetPassword.passwordMinLength);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: t.resetPassword.invalidLink,
          description: t.resetPassword.requestNewLink,
          variant: 'destructive',
        });
        navigate('/auth');
      }
    };
    checkSession();
  }, [navigate, toast]);

  const validatePassword = () => {
    const newErrors: Record<string, string> = {};
    try {
      passwordSchema.parse(password);
    } catch (error) {
      if (error instanceof z.ZodError) {
        newErrors.password = error.errors[0].message;
      }
    }
    if (password !== confirmPassword) {
      newErrors.confirmPassword = t.resetPassword.passwordsDoNotMatch;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePassword()) return;
    setIsLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setIsLoading(false);
    if (error) {
      toast({ title: t.resetPassword.resetFailed, description: error.message, variant: 'destructive' });
    } else {
      setIsSuccess(true);
      toast({ title: t.resetPassword.passwordUpdated, description: t.resetPassword.passwordUpdatedDesc });
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto flex min-h-screen flex-col items-center justify-center px-4 py-12">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-elevated text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-accent/20">
              <CheckCircle className="h-8 w-8 text-accent" />
            </div>
            <h1 className="font-display text-2xl font-bold text-foreground mb-2">{t.resetPassword.complete}</h1>
            <p className="text-muted-foreground mb-6">{t.resetPassword.completeDescription}</p>
            <Button variant="booking" className="w-full" onClick={() => navigate('/auth')}>
              {t.resetPassword.continueToSignIn}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto flex min-h-screen flex-col items-center justify-center px-4 py-12">
        <div className="mb-8 w-full max-w-md">
          <Button variant="ghost" onClick={() => navigate('/auth')} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            {t.resetPassword.backToSignIn}
          </Button>
        </div>
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-elevated">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl gradient-hero">
              <span className="text-2xl font-bold text-accent-foreground">R</span>
            </div>
            <h1 className="font-display text-2xl font-bold text-foreground">{t.resetPassword.title}</h1>
            <p className="mt-2 text-muted-foreground">{t.resetPassword.subtitle}</p>
          </div>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">{t.resetPassword.newPassword}</Label>
              <div className="relative">
                <Lock className="absolute inset-inline-start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input id="new-password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="ps-10 pe-10" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-inline-end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
              <p className="text-xs text-muted-foreground">{t.resetPassword.passwordMinLength}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">{t.resetPassword.confirmPassword}</Label>
              <div className="relative">
                <Lock className="absolute inset-inline-start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input id="confirm-password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="ps-10 pe-10" />
              </div>
              {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword}</p>}
            </div>
            <Button type="submit" variant="booking" className="w-full" disabled={isLoading}>
              {isLoading ? t.resetPassword.updating : t.resetPassword.resetButton}
            </Button>
          </form>
        </div>
      </div>
      <Footer />
    </div>
  );
}
