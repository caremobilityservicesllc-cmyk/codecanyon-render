import { useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Upload,
  Loader2,
  FileText,
  Camera,
  Car,
  Shield,
  CreditCard,
  PartyPopper,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface OnboardingStepMeta {
  id: string;
  documentType: string;
  icon: React.ReactNode;
  required: boolean;
  acceptTypes: string;
  hasExpiry: boolean;
}

interface OnboardingStep extends OnboardingStepMeta {
  title: string;
  description: string;
  tips: string[];
}

const onboardingStepsMeta: OnboardingStepMeta[] = [
  { id: 'license_front', documentType: 'license_front', icon: <CreditCard className="h-8 w-8" />, required: true, acceptTypes: 'image/*', hasExpiry: true },
  { id: 'license_back', documentType: 'license_back', icon: <CreditCard className="h-8 w-8" />, required: true, acceptTypes: 'image/*', hasExpiry: false },
  { id: 'profile_photo', documentType: 'profile_photo', icon: <Camera className="h-8 w-8" />, required: true, acceptTypes: 'image/*', hasExpiry: false },
  { id: 'vehicle_registration', documentType: 'vehicle_registration', icon: <Car className="h-8 w-8" />, required: true, acceptTypes: 'image/*,.pdf', hasExpiry: true },
  { id: 'insurance', documentType: 'insurance', icon: <Shield className="h-8 w-8" />, required: true, acceptTypes: 'image/*,.pdf', hasExpiry: true },
];

interface OnboardingWizardProps {
  driverId: string;
  driverName: string;
  onComplete: () => void;
}

export function OnboardingWizard({ driverId, driverName, onComplete }: OnboardingWizardProps) {
  const { t } = useLanguage();
  const [currentStep, setCurrentStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [expiryDate, setExpiryDate] = useState('');
  const [uploading, setUploading] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const stepTitles: Record<string, string> = {
    license_front: t.driverOnboarding.licenseFront,
    license_back: t.driverOnboarding.licenseBack,
    profile_photo: t.driverOnboarding.profilePhoto,
    vehicle_registration: t.driverOnboarding.vehicleRegistration,
    insurance: t.driverOnboarding.insuranceCertificate,
  };
  const stepDescs: Record<string, string> = {
    license_front: t.driverOnboarding.licenseFrontDesc,
    license_back: t.driverOnboarding.licenseBackDesc,
    profile_photo: t.driverOnboarding.profilePhotoDesc,
    vehicle_registration: t.driverOnboarding.vehicleRegistrationDesc,
    insurance: t.driverOnboarding.insuranceCertificateDesc,
  };
  const stepTips: Record<string, string[]> = {
    license_front: [t.driverOnboarding.ensureTextReadable, t.driverOnboarding.avoidGlare, t.driverOnboarding.includeAllCorners],
    license_back: [t.driverOnboarding.includeBarcodeIfPresent, t.driverOnboarding.makeNotBlurry, t.driverOnboarding.captureEntireBack],
    profile_photo: [t.driverOnboarding.recentPhoto, t.driverOnboarding.faceCamera, t.driverOnboarding.goodLighting],
    vehicle_registration: [t.driverOnboarding.docNotExpired, t.driverOnboarding.includeAllPages, t.driverOnboarding.vinAndPlateVisible],
    insurance: [t.driverOnboarding.showActiveDates, t.driverOnboarding.includePolicyNumber, t.driverOnboarding.commercialPreferred],
  };

  const onboardingSteps: OnboardingStep[] = onboardingStepsMeta.map(m => ({
    ...m,
    title: stepTitles[m.id] || m.id,
    description: stepDescs[m.id] || '',
    tips: stepTips[m.id] || [],
  }));

  const step = onboardingSteps[currentStep];
  const isLastStep = currentStep === onboardingSteps.length - 1;
  const isComplete = completedSteps.size === onboardingSteps.length;

  // Check existing documents
  const { data: existingDocs = [] } = useQuery({
    queryKey: ['driver-documents-onboarding', driverId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('driver_documents')
        .select('document_type, status')
        .eq('driver_id', driverId);
      if (error) throw error;
      return data;
    },
    staleTime: 0,
  });

  // Initialize completed steps from existing docs
  useState(() => {
    const uploaded = new Set<string>();
    existingDocs.forEach(doc => {
      if (doc.status !== 'rejected') {
        uploaded.add(doc.document_type);
      }
    });
    if (uploaded.size > 0) {
      setCompletedSteps(uploaded);
    }
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Please select a file');

      setUploading(true);

      const fileExt = file.name.split('.').pop();
      const fileName = `${driverId}/${step.documentType}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('driver-documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('driver-documents')
        .getPublicUrl(fileName);

      const { error: insertError } = await supabase
        .from('driver_documents')
        .insert({
          driver_id: driverId,
          document_type: step.documentType,
          document_url: urlData.publicUrl,
          expires_at: expiryDate || null,
          status: 'pending',
        });

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver-documents', driverId] });
      queryClient.invalidateQueries({ queryKey: ['driver-documents-onboarding', driverId] });
      
      const newCompleted = new Set(completedSteps);
      newCompleted.add(step.documentType);
      setCompletedSteps(newCompleted);
      
      toast.success(`${step.title} uploaded successfully!`);
      setFile(null);
      setExpiryDate('');

      if (!isLastStep) {
        setTimeout(() => setCurrentStep(prev => prev + 1), 500);
      }
    },
    onError: (error) => {
      toast.error(`Upload failed: ${error.message}`);
    },
    onSettled: () => {
      setUploading(false);
    },
  });

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast.error(t.driverOnboarding.fileTooLarge);
        return;
      }
      setFile(selectedFile);
    }
  }, []);

  const handleSkip = useCallback(() => {
    if (!isLastStep) {
      setCurrentStep(prev => prev + 1);
      setFile(null);
      setExpiryDate('');
    }
  }, [isLastStep]);

  const handlePrevious = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
      setFile(null);
      setExpiryDate('');
    }
  }, [currentStep]);

  const handleComplete = useCallback(async () => {
    // Update driver onboarding status
    await supabase
      .from('drivers')
      .update({ onboarding_status: 'documents_submitted' })
      .eq('id', driverId);

    queryClient.invalidateQueries({ queryKey: ['driver-profile'] });
    onComplete();
  }, [driverId, queryClient, onComplete]);

  const progress = ((completedSteps.size) / onboardingSteps.length) * 100;
  const isCurrentStepCompleted = completedSteps.has(step?.documentType);

  if (isComplete) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="pt-8 pb-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center"
          >
            <div className="mx-auto w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mb-6">
              <PartyPopper className="h-10 w-10 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold mb-2">{t.onboardingWizard.allDocumentsUploaded}</h2>
            <p className="text-muted-foreground mb-6">
              {(t.onboardingWizard.docsUnderReview || '').replace('{name}', driverName.split(' ')[0])}
            </p>
            <Button onClick={handleComplete} size="lg" className="gap-2">
              <CheckCircle className="h-5 w-5" />
              {t.onboardingWizard.completeOnboarding}
            </Button>
          </motion.div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress Header */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">{t.onboardingWizard.onboardingProgress}</span>
            <span className="text-sm text-muted-foreground">
              {(t.onboardingWizard.documentsCount || '').replace('{completed}', String(completedSteps.size)).replace('{total}', String(onboardingSteps.length))}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
          
          {/* Step indicators */}
          <div className="flex justify-between mt-4">
            {onboardingSteps.map((s, index) => {
              const isCompleted = completedSteps.has(s.documentType);
              const isCurrent = index === currentStep;
              
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    setCurrentStep(index);
                    setFile(null);
                    setExpiryDate('');
                  }}
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all",
                    isCompleted
                      ? "bg-green-500 text-white"
                      : isCurrent
                      ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    index + 1
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Current Step Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className={cn(
                  "p-3 rounded-xl",
                  isCurrentStepCompleted
                    ? "bg-green-500/20 text-green-500"
                    : "bg-primary/10 text-primary"
                )}>
                  {step.icon}
                </div>
                <div className="flex-1">
                  <CardTitle className="flex items-center gap-2">
                    {step.title}
                    {step.required && (
                      <span className="text-xs font-normal text-red-500">{t.onboardingWizard.required}</span>
                    )}
                  </CardTitle>
                  <CardDescription>{step.description}</CardDescription>
                </div>
                {isCurrentStepCompleted && (
                  <div className="flex items-center gap-1 text-green-500 text-sm">
                    <CheckCircle className="h-4 w-4" />
                    {(t as any).onboardingWizardExt?.uploadedLabel || 'Uploaded'}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Tips */}
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm font-medium mb-2">{(t as any).onboardingWizardExt?.tipsForUpload || 'Tips for a successful upload:'}</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {step.tips.map((tip, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Upload Area */}
              <div className="space-y-4">
                <div
                  className={cn(
                    "border-2 border-dashed rounded-xl p-8 text-center transition-colors",
                    file
                      ? "border-green-500 bg-green-500/5"
                      : "border-muted-foreground/25 hover:border-primary/50"
                  )}
                >
                  <input
                    type="file"
                    id="file-upload"
                    accept={step.acceptTypes}
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer flex flex-col items-center gap-3"
                  >
                    {file ? (
                      <>
                        <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                          <FileText className="h-6 w-6 text-green-500" />
                        </div>
                        <div>
                          <p className="font-medium text-green-600 dark:text-green-400">
                            {file.name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <Button variant="outline" size="sm" type="button">
                          {t.onboardingWizard.changeFile || 'Change File'}
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                          <Upload className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">{t.onboardingWizard.clickToUpload}</p>
                          <p className="text-sm text-muted-foreground">
                            {step.acceptTypes.includes('pdf')
                              ? (t.onboardingWizard.pngJpgPdf || 'PNG, JPG, or PDF up to 10MB')
                              : (t.onboardingWizard.pngJpg || 'PNG or JPG up to 10MB')}
                          </p>
                        </div>
                      </>
                    )}
                  </label>
                </div>

                {/* Expiry Date */}
                {step.hasExpiry && (
                  <div className="space-y-2">
                    <Label htmlFor="expiry">{t.onboardingWizard.expiryDate}</Label>
                    <Input
                      id="expiry"
                      type="date"
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                    />
                  </div>
                )}
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between pt-4 border-t">
                <Button
                  variant="ghost"
                  onClick={handlePrevious}
                  disabled={currentStep === 0}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  {t.onboardingWizard.previous}
                </Button>

                <div className="flex gap-2">
                  {!step.required && !isCurrentStepCompleted && (
                    <Button variant="ghost" onClick={handleSkip}>
                      {t.onboardingWizard.skip}
                    </Button>
                  )}
                  
                  {isCurrentStepCompleted ? (
                    <Button onClick={() => !isLastStep && setCurrentStep(prev => prev + 1)}>
                      {isLastStep ? t.onboardingWizard.review : t.common.next}
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  ) : (
                    <Button
                      onClick={() => uploadMutation.mutate()}
                      disabled={!file || uploading}
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {t.onboardingWizard.uploading}
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          {t.onboardingWizard.uploadAndContinue}
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
