import { useState } from 'react';
import { Mail, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { z } from 'zod';

const emailSchema = z.string().email();

export function ForgotPasswordDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState('');
  const { t } = useLanguage();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try { emailSchema.parse(email); } catch (err) {
      if (err instanceof z.ZodError) { setError(err.errors[0].message); return; }
    }
    setIsLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setIsLoading(false);
    if (resetError) {
      toast({ title: t.forgotPassword.errorTitle, description: resetError.message, variant: 'destructive' });
    } else {
      setIsSent(true);
      toast({ title: t.forgotPassword.emailSentTitle, description: t.forgotPassword.emailSentDesc });
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) { setEmail(''); setIsSent(false); setError(''); }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="link" className="h-auto p-0 text-sm text-muted-foreground hover:text-primary">
          {t.forgotPassword.trigger}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.forgotPassword.title}</DialogTitle>
          <DialogDescription>
            {isSent ? t.forgotPassword.sentDescription : t.forgotPassword.enterEmail}
          </DialogDescription>
        </DialogHeader>
        {isSent ? (
          <div className="space-y-4 py-4">
            <div className="rounded-lg border border-accent/30 bg-accent/5 p-4 text-center">
              <Mail className="mx-auto mb-2 h-8 w-8 text-accent" />
              <p className="text-sm text-muted-foreground">
                {t.forgotPassword.checkEmail} <span className="font-medium text-foreground">{email}</span>
              </p>
            </div>
            <div className="text-center">
              <Button variant="ghost" size="sm" onClick={() => setIsSent(false)} className="text-muted-foreground">
                {t.forgotPassword.tryAgain}
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">{t.forgotPassword.email}</Label>
              <div className="relative">
                <Mail className="absolute inset-inline-start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input id="reset-email" type="email" placeholder="you@example.com" value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); }} className="ps-10" autoFocus />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <Button type="submit" variant="booking" className="w-full gap-2" disabled={isLoading}>
              {isLoading ? t.forgotPassword.sending : t.forgotPassword.sendResetLink}
              {!isLoading && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
