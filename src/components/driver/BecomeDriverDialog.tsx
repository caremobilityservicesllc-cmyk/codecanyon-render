import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Car, FileText, User, Phone, Mail, CreditCard, CheckCircle2, Loader2, ArrowRight, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { cn } from '@/lib/utils';

function createApplicationSchema(v: any) {
  return z.object({
    firstName: z.string().min(2, v?.firstNameMinLength || 'First name must be at least 2 characters').max(50),
    lastName: z.string().min(2, v?.lastNameMinLength || 'Last name must be at least 2 characters').max(50),
    phone: z.string().min(10, v?.phoneInvalid || 'Please enter a valid phone number').max(20),
    email: z.string().email(v?.emailInvalid || 'Please enter a valid email'),
    licenseNumber: z.string().min(5, v?.licenseNumberInvalid || 'Please enter a valid license number').max(30),
    licenseExpiry: z.string().min(1, v?.licenseExpiryRequired || 'Please enter your license expiry date'),
    hasVehicle: z.boolean().default(false),
    agreeTerms: z.boolean().refine(val => val === true, v?.agreeTermsRequired || 'You must agree to the terms'),
    agreeBackgroundCheck: z.boolean().refine(val => val === true, v?.agreeBackgroundCheckRequired || 'You must consent to background check'),
  });
}

type ApplicationFormData = z.infer<ReturnType<typeof createApplicationSchema>>;

interface BecomeDriverDialogProps {
  children: React.ReactNode;
  onSuccess?: () => void;
}

const STEPS = [
  { id: 1, titleKey: 'personalInfo' as const, icon: User },
  { id: 2, titleKey: 'licenseDetails' as const, icon: CreditCard },
  { id: 3, titleKey: 'agreement' as const, icon: FileText },
];

export function BecomeDriverDialog({ children, onSuccess }: BecomeDriverDialogProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const applicationSchema = createApplicationSchema((t as any).validation);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const form = useForm<ApplicationFormData>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      phone: '',
      email: user?.email || '',
      licenseNumber: '',
      licenseExpiry: '',
      hasVehicle: false,
      agreeTerms: false,
      agreeBackgroundCheck: false,
    },
  });

  const submitApplication = useMutation({
    mutationFn: async (data: ApplicationFormData) => {
      if (!user?.id) throw new Error('Not authenticated');

      // Create driver record with pending status
      const { error } = await supabase
        .from('drivers')
        .insert({
          user_id: user.id,
          first_name: data.firstName,
          last_name: data.lastName,
          phone: data.phone,
          email: data.email,
          license_number: data.licenseNumber,
          license_expiry: data.licenseExpiry,
          is_active: false,
          is_available: false,
          documents_verified: false,
          onboarding_status: 'pending',
          background_check_status: 'pending',
        });

      if (error) {
        if (error.code === '23505') {
          throw new Error(t.becomeDriverDialog.alreadyApplied);
        }
        throw error;
      }

      // Notify admins about the new application (fire and forget)
      supabase.functions.invoke('notify-admin-driver-application', {
        body: {
          applicantName: `${data.firstName} ${data.lastName}`,
          applicantEmail: data.email,
          applicantPhone: data.phone,
          licenseNumber: data.licenseNumber,
          submittedAt: new Date().toISOString(),
        },
      }).catch(err => {
        console.error('Failed to notify admins:', err);
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['is-driver'] });
      queryClient.invalidateQueries({ queryKey: ['driver-application-status'] });
      setIsSubmitted(true);
      toast.success(t.becomeDriverDialog.applicationSubmittedToast);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error(error.message || t.becomeDriverDialog.failedToSubmit);
    },
  });

  const handleSubmit = (data: ApplicationFormData) => {
    submitApplication.mutate(data);
  };

  const nextStep = async () => {
    let fieldsToValidate: (keyof ApplicationFormData)[] = [];
    
    if (step === 1) {
      fieldsToValidate = ['firstName', 'lastName', 'phone', 'email'];
    } else if (step === 2) {
      fieldsToValidate = ['licenseNumber', 'licenseExpiry'];
    }
    
    const isValid = await form.trigger(fieldsToValidate);
    if (isValid) {
      setStep(s => Math.min(s + 1, 3));
    }
  };

  const prevStep = () => {
    setStep(s => Math.max(s - 1, 1));
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      // Reset form when closing
      setTimeout(() => {
        setStep(1);
        setIsSubmitted(false);
        form.reset();
      }, 200);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        {isSubmitted ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-8 text-center"
          >
            <div className="h-16 w-16 rounded-full bg-accent/20 flex items-center justify-center mb-4">
              <CheckCircle2 className="h-8 w-8 text-accent" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">{t.becomeDriverDialog.applicationSubmitted}</h2>
            <p className="text-muted-foreground mb-6 max-w-sm">
              {t.becomeDriverDialog.applicationSubmittedDesc}
            </p>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>✓ {t.becomeDriverDialog.applicationReceived}</p>
              <p>○ {t.becomeDriverDialog.docVerificationPending}</p>
              <p>○ {t.becomeDriverDialog.backgroundCheckPending}</p>
              <p>○ {t.becomeDriverDialog.finalApproval}</p>
            </div>
            <Button onClick={() => setOpen(false)} className="mt-6">
              {t.common.close}
            </Button>
          </motion.div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Car className="h-5 w-5 text-accent" />
                {t.becomeDriverDialog.title}
              </DialogTitle>
              <DialogDescription>
                {t.becomeDriverDialog.description}
              </DialogDescription>
            </DialogHeader>

            {/* Step Indicator */}
            <div className="flex items-center justify-between mb-6">
              {STEPS.map((s, index) => {
                const Icon = s.icon;
                const isActive = step === s.id;
                const isComplete = step > s.id;
                
                return (
                  <div key={s.id} className="flex items-center flex-1">
                    <div className="flex flex-col items-center flex-1">
                      <div
                        className={cn(
                          'h-10 w-10 rounded-full flex items-center justify-center border-2 transition-colors',
                          isActive && 'border-accent bg-accent text-accent-foreground',
                          isComplete && 'border-accent bg-accent text-accent-foreground',
                          !isActive && !isComplete && 'border-muted-foreground/30 text-muted-foreground'
                        )}
                      >
                        {isComplete ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : (
                          <Icon className="h-5 w-5" />
                        )}
                      </div>
                      <span className={cn(
                        'text-xs mt-1',
                        isActive ? 'text-foreground font-medium' : 'text-muted-foreground'
                      )}>
                        {t.becomeDriverDialog[s.titleKey]}
                      </span>
                    </div>
                    {index < STEPS.length - 1 && (
                      <div
                        className={cn(
                          'h-0.5 flex-1 mx-2 -mt-5',
                          isComplete ? 'bg-accent' : 'bg-muted'
                        )}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <AnimatePresence mode="wait">
                  {step === 1 && (
                    <motion.div
                      key="step1"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-4"
                    >
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="firstName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t.becomeDriverDialog.firstName}</FormLabel>
                              <FormControl>
                                <Input placeholder={(t as any).placeholders?.firstName || "John"} {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="lastName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t.becomeDriverDialog.lastName}</FormLabel>
                              <FormControl>
                                <Input placeholder={(t as any).placeholders?.lastName || "Doe"} {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t.becomeDriverDialog.phoneNumber}</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Phone className="absolute inset-inline-start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input placeholder={(t as any).placeholders?.phone || "+1 (555) 123-4567"} className="ps-10" {...field} />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t.becomeDriverDialog.emailAddress}</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Mail className="absolute inset-inline-start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input placeholder={(t as any).placeholders?.email || "john@example.com"} className="ps-10" {...field} />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </motion.div>
                  )}

                  {step === 2 && (
                    <motion.div
                      key="step2"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-4"
                    >
                      <FormField
                        control={form.control}
                        name="licenseNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t.becomeDriverDialog.driversLicenseNumber}</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <CreditCard className="absolute inset-inline-start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="DL-123456789" className="ps-10" {...field} />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="licenseExpiry"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t.becomeDriverDialog.licenseExpiryDate}</FormLabel>
                            <FormControl>
                              <Input type="date" min={new Date().toISOString().split('T')[0]} {...field} />
                            </FormControl>
                            <FormDescription>
                              {t.becomeDriverDialog.mustBeValid6Months}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="hasVehicle"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                             <div className="space-y-1 leading-none">
                              <FormLabel>{t.becomeDriverDialog.hasOwnVehicle}</FormLabel>
                              <FormDescription>
                                {t.becomeDriverDialog.hasOwnVehicleDesc}
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />
                    </motion.div>
                  )}

                  {step === 3 && (
                    <motion.div
                      key="step3"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-4"
                    >
                      <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
                       <h4 className="font-medium text-foreground mb-2">{t.becomeDriverDialog.whatHappensNext}</h4>
                        <ol className="list-decimal list-inside space-y-1">
                          <li>{t.becomeDriverDialog.step1Review}</li>
                          <li>{t.becomeDriverDialog.step2Upload}</li>
                          <li>{t.becomeDriverDialog.step3Background}</li>
                          <li>{t.becomeDriverDialog.step4Approved}</li>
                        </ol>
                      </div>
                      <FormField
                        control={form.control}
                        name="agreeTerms"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>
                                {t.becomeDriverDialog.agreeTerms} <a href="/terms" className="text-accent hover:underline">{t.becomeDriverDialog.driverTerms}</a> {t.becomeDriverDialog.and} <a href="/privacy" className="text-accent hover:underline">{t.becomeDriverDialog.privacyPolicy}</a>
                              </FormLabel>
                              <FormMessage />
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="agreeBackgroundCheck"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>
                                {t.becomeDriverDialog.consentBackgroundCheck}
                              </FormLabel>
                              <FormMessage />
                            </div>
                          </FormItem>
                        )}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Navigation Buttons */}
                <div className="flex justify-between pt-4">
                  {step > 1 ? (
                    <Button type="button" variant="outline" onClick={prevStep}>
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back
                    </Button>
                  ) : (
                    <div />
                  )}
                  
                  {step < 3 ? (
                    <Button type="button" onClick={nextStep}>
                      Next
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  ) : (
                    <Button 
                      type="submit" 
                      disabled={submitApplication.isPending}
                      className="bg-accent hover:bg-accent/90"
                    >
                      {submitApplication.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {t.becomeDriverDialog.submitting}
                        </>
                      ) : (
                        <>
                          {t.becomeDriverDialog.submitApplication}
                          <CheckCircle2 className="h-4 w-4 ml-2" />
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
