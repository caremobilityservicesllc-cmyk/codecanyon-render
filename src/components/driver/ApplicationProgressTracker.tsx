import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  CheckCircle,
  Clock,
  XCircle,
  FileText,
  Upload,
  Car,
  Shield,
  AlertTriangle,
  ChevronRight,
  Sparkles,
  ClipboardCheck,
  UserCheck,
  FileCheck,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { OnboardingWizard, OnboardingWelcome } from './onboarding';
import { ReapplyDriverDialog } from './ReapplyDriverDialog';

interface ApplicationProgressTrackerProps {
  driverId: string;
  driverName: string;
  onboardingStatus: string;
  isActive: boolean;
  rejectionReason?: string | null;
  driverData?: {
    first_name: string;
    last_name: string;
    phone: string;
    email: string | null;
    license_number: string;
    license_expiry: string;
  };
}

interface DriverDocument {
  id: string;
  document_type: string;
  status: string;
  uploaded_at: string;
  expires_at: string | null;
  rejection_reason: string | null;
}

function useApplicationSteps() {
  const { t } = useLanguage();
  return {
    applicationSteps: [
      { id: 'application', title: t.applicationProgress.applicationSubmitted, description: t.applicationProgress.applicationOnFile, icon: ClipboardCheck },
      { id: 'documents', title: t.applicationProgress.documentsUploaded, description: t.applicationProgress.documentsForReview, icon: FileCheck },
      { id: 'verification', title: t.applicationProgress.underVerification, description: t.applicationProgress.teamReviewing, icon: Shield },
      { id: 'approval', title: t.applicationProgress.approvedToDrive, description: t.applicationProgress.canAcceptRides, icon: UserCheck },
    ],
    requiredDocuments: [
      { type: 'license_front', label: t.driverOnboarding.licenseFront },
      { type: 'license_back', label: t.driverOnboarding.licenseBack },
      { type: 'profile_photo', label: t.driverOnboarding.profilePhoto },
      { type: 'vehicle_registration', label: t.driverOnboarding.vehicleRegistration },
      { type: 'insurance', label: t.driverOnboarding.insuranceCertificate },
    ],
  };
}

export function ApplicationProgressTracker({
  driverId,
  driverName,
  onboardingStatus,
  isActive,
  rejectionReason,
  driverData,
}: ApplicationProgressTrackerProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const { applicationSteps, requiredDocuments } = useApplicationSteps();
  const [showOnboarding, setShowOnboarding] = useState<'welcome' | 'wizard' | null>(null);

  // Fetch driver documents
  const { data: documents = [] } = useQuery({
    queryKey: ['driver-documents', driverId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('driver_documents')
        .select('id, document_type, status, uploaded_at, expires_at, rejection_reason')
        .eq('driver_id', driverId)
        .order('uploaded_at', { ascending: false });
      if (error) throw error;
      return data as DriverDocument[];
    },
  });

  // Calculate document stats
  const uploadedDocs = requiredDocuments.filter(req =>
    documents.some(doc => doc.document_type === req.type && doc.status !== 'rejected')
  );
  const approvedDocs = requiredDocuments.filter(req =>
    documents.some(doc => doc.document_type === req.type && doc.status === 'approved')
  );
  const pendingDocs = requiredDocuments.filter(req =>
    documents.some(doc => doc.document_type === req.type && doc.status === 'pending')
  );
  const rejectedDocs = documents.filter(doc => doc.status === 'rejected');
  const missingDocs = requiredDocuments.filter(req =>
    !documents.some(doc => doc.document_type === req.type && doc.status !== 'rejected')
  );

  const documentProgress = Math.round((uploadedDocs.length / requiredDocuments.length) * 100);
  const verificationProgress = Math.round((approvedDocs.length / requiredDocuments.length) * 100);

  // Determine current step
  const getCurrentStep = (): number => {
    if (onboardingStatus === 'approved' || isActive) return 3;
    if (onboardingStatus === 'rejected') return -1;
    if (approvedDocs.length === requiredDocuments.length) return 3;
    if (uploadedDocs.length > 0) return 2;
    return 0;
  };

  const currentStep = getCurrentStep();

  // Show onboarding wizard
  if (showOnboarding === 'welcome') {
    return (
      <OnboardingWelcome
        driverName={driverName}
        onStart={() => setShowOnboarding('wizard')}
      />
    );
  }

  if (showOnboarding === 'wizard') {
    return (
      <OnboardingWizard
        driverId={driverId}
        driverName={driverName}
        onComplete={() => {
          setShowOnboarding(null);
          queryClient.invalidateQueries({ queryKey: ['driver-documents', driverId] });
          queryClient.invalidateQueries({ queryKey: ['driver-application-status'] });
        }}
      />
    );
  }

  const ap = (t as any).applicationTracker || {};
  // Rejected state
  if (onboardingStatus === 'rejected') {
    return (
      <Card className="border-destructive/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10">
              <XCircle className="h-6 w-6 text-destructive" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg">{ap.applicationNotApproved || 'Application Not Approved'}</CardTitle>
              <CardDescription>{ap.unableToApprove || 'We were unable to approve your driver application'}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {rejectionReason && (
            <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
              <p className="text-sm font-medium text-destructive">{ap.reason || 'Reason:'}</p>
              <p className="text-sm text-muted-foreground mt-1">{rejectionReason}</p>
            </div>
          )}
          
          <div className="p-4 rounded-lg bg-muted/50 border">
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-primary" />
              {ap.wantToTryAgain || 'Want to try again?'}
            </h4>
            <p className="text-sm text-muted-foreground mb-4">
              {ap.updateAndResubmit || 'You can update your information and submit a new application. Make sure to address the feedback above.'}
            </p>
            {driverData ? (
              <ReapplyDriverDialog
                driverId={driverId}
                driverData={{
                  id: driverId,
                  first_name: driverData.first_name,
                  last_name: driverData.last_name,
                  phone: driverData.phone,
                  email: driverData.email,
                  license_number: driverData.license_number,
                  license_expiry: driverData.license_expiry,
                  rejection_reason: rejectionReason || null,
                }}
                rejectionReason={rejectionReason}
              >
                <Button className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  {ap.reapplyNow || 'Reapply Now'}
                </Button>
              </ReapplyDriverDialog>
            ) : (
              <p className="text-sm text-muted-foreground">
                {ap.contactSupportReapply || 'Please contact support to reapply.'}
              </p>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            {ap.questionsAboutRejection || 'If you have questions about your rejection, please contact our support team.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  // Approved state
  if (onboardingStatus === 'approved' || isActive) {
    return (
      <Card className="border-green-200 dark:border-green-900/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
              <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg">{ap.youreApproved || "You're Approved!"}</CardTitle>
              <CardDescription>{ap.canAcceptRidesNow || 'You can now access the Driver Portal and accept rides'}</CardDescription>
            </div>
            <Button onClick={() => navigate('/driver')} className="gap-2">
              <Car className="h-4 w-4" />
              {ap.goToDriverPortal || 'Go to Driver Portal'}
            </Button>
          </div>
        </CardHeader>
      </Card>
    );
  }

  // Pending state with progress tracker
  return (
    <div className="space-y-4">
      {/* Application Timeline */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            {ap.applicationProgress || 'Application Progress'}
          </CardTitle>
          <CardDescription>
            {ap.trackStatus || 'Track your driver application status'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            {applicationSteps.map((step, index) => {
              const StepIcon = step.icon;
              const isCompleted = index < currentStep;
              const isCurrent = index === currentStep;
              const isLast = index === applicationSteps.length - 1;

              return (
                <div key={step.id} className="flex gap-4">
                  {/* Timeline connector */}
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors",
                        isCompleted
                          ? "bg-green-100 border-green-500 dark:bg-green-900/30"
                          : isCurrent
                          ? "bg-primary/10 border-primary"
                          : "bg-muted border-muted-foreground/30"
                      )}
                    >
                      {isCompleted ? (
                        <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                      ) : (
                        <StepIcon
                          className={cn(
                            "h-5 w-5",
                            isCurrent ? "text-primary" : "text-muted-foreground"
                          )}
                        />
                      )}
                    </div>
                    {!isLast && (
                      <div
                        className={cn(
                          "w-0.5 h-12 -my-1",
                          isCompleted ? "bg-green-500" : "bg-muted-foreground/30"
                        )}
                      />
                    )}
                  </div>

                  {/* Step content */}
                  <div className={cn("pb-8", isLast && "pb-0")}>
                    <p
                      className={cn(
                        "font-medium",
                        isCompleted && "text-green-600 dark:text-green-400",
                        isCurrent && "text-foreground",
                        !isCompleted && !isCurrent && "text-muted-foreground"
                      )}
                    >
                      {step.title}
                    </p>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                    {isCurrent && index === 1 && missingDocs.length > 0 && (
                      <div className="mt-2">
                        <Badge variant="outline" className="text-yellow-600 border-yellow-300">
                          {missingDocs.length} {ap.documentsRemaining || 'document(s) remaining'}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Document Upload Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                {ap.requiredDocuments || 'Required Documents'}
              </CardTitle>
              <CardDescription>
                {ap.uploadDocsDesc || 'Upload all required documents to complete your application'}
              </CardDescription>
            </div>
            <Badge variant={documentProgress === 100 ? 'default' : 'secondary'}>
              {uploadedDocs.length}/{requiredDocuments.length} {ap.uploaded || 'uploaded'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{ap.uploadProgress || 'Upload Progress'}</span>
              <span className="font-medium">{documentProgress}%</span>
            </div>
            <Progress value={documentProgress} className="h-2" />
          </div>

          <Separator />

          {/* Document checklist */}
          <div className="space-y-2">
            {requiredDocuments.map((req) => {
              const doc = documents.find(d => d.document_type === req.type);
              const isUploaded = doc && doc.status !== 'rejected';
              const isApproved = doc?.status === 'approved';
              const isPending = doc?.status === 'pending';
              const isRejected = doc?.status === 'rejected';

              return (
                <div
                  key={req.type}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border",
                    isApproved && "border-green-200 bg-green-50/50 dark:border-green-900/50 dark:bg-green-900/10",
                    isPending && "border-yellow-200 bg-yellow-50/50 dark:border-yellow-900/50 dark:bg-yellow-900/10",
                    isRejected && "border-red-200 bg-red-50/50 dark:border-red-900/50 dark:bg-red-900/10",
                    !isUploaded && !isRejected && "border-muted"
                  )}
                >
                  <div className="flex items-center gap-3">
                    {isApproved ? (
                      <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                    ) : isPending ? (
                      <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                    ) : isRejected ? (
                      <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{req.label}</p>
                      {isRejected && doc?.rejection_reason && (
                        <p className="text-xs text-red-600 dark:text-red-400">
                          {doc.rejection_reason}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge
                    variant="secondary"
                    className={cn(
                      isApproved && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                      isPending && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
                      isRejected && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    )}
                  >
                    {isApproved ? (ap.verified || 'Verified') : isPending ? (t.common?.pending || 'Pending') : isRejected ? (ap.rejected || 'Rejected') : (ap.required || 'Required')}
                  </Badge>
                </div>
              );
            })}
          </div>

          {/* Rejected documents alert */}
          {rejectedDocs.length > 0 && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive">
                  {rejectedDocs.length} {ap.documentsRejected || 'document(s) rejected'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {ap.reviewAndReupload || 'Please review the feedback and re-upload the affected documents.'}
                </p>
              </div>
            </div>
          )}

          {/* Upload CTA */}
          {(missingDocs.length > 0 || rejectedDocs.length > 0) && (
            <Button
              onClick={() => setShowOnboarding('wizard')}
              className="w-full gap-2"
            >
              <Upload className="h-4 w-4" />
              {documents.length === 0 ? (ap.startUploading || 'Start Uploading Documents') : (ap.continueUploading || 'Continue Uploading')}
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}

          {/* All documents uploaded message */}
          {missingDocs.length === 0 && rejectedDocs.length === 0 && pendingDocs.length > 0 && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <Sparkles className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-sm font-medium text-primary">{ap.allDocsSubmitted || 'All documents submitted!'}</p>
                <p className="text-sm text-muted-foreground">
                  {ap.teamReviewingDocs || "Our team is reviewing your documents. You'll be notified once verification is complete."}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
