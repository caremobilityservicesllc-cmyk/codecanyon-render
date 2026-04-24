import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, differenceInDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Plus,
  AlertTriangle,
  Loader2,
  Shield,
  RefreshCw,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { OnboardingWizard, OnboardingWelcome } from './onboarding';

interface DriverDocument {
  id: string;
  driver_id: string;
  document_type: string;
  document_url: string;
  status: string;
  expires_at: string | null;
  uploaded_at: string;
  verified_at: string | null;
  rejection_reason: string | null;
}

interface DriverDocumentPortalProps {
  driverId: string;
  driverName: string;
}

function useDocumentTypes() {
  const { t } = useLanguage();
  const dl = (t as any).documentTypeLabels || {};
  return [
    { value: 'license_front', label: dl.license_front || 'Driver License (Front)', required: true },
    { value: 'license_back', label: dl.license_back || 'Driver License (Back)', required: true },
    { value: 'insurance', label: dl.insurance || 'Insurance Certificate', required: true },
    { value: 'vehicle_registration', label: dl.vehicle_registration || 'Vehicle Registration', required: true },
    { value: 'background_check', label: dl.background_check || 'Background Check', required: false },
    { value: 'medical_certificate', label: dl.medical_certificate || 'Medical Certificate', required: false },
    { value: 'profile_photo', label: dl.profile_photo || 'Profile Photo', required: true },
  ];
}

export function DriverDocumentPortal({ driverId, driverName }: DriverDocumentPortalProps) {
  const { t } = useLanguage();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedType, setSelectedType] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState<'welcome' | 'wizard' | null>(null);
  const queryClient = useQueryClient();
  const documentTypes = useDocumentTypes();
  const dp = (t as any).driverDocumentPortalExt || {};

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['driver-documents', driverId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('driver_documents')
        .select('*')
        .eq('driver_id', driverId)
        .order('uploaded_at', { ascending: false });
      if (error) throw error;
      return data as DriverDocument[];
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file || !selectedType) throw new Error('Please select a file and document type');

      setUploading(true);

      // Upload file to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${driverId}/${selectedType}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('driver-documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get the URL
      const { data: urlData } = supabase.storage
        .from('driver-documents')
        .getPublicUrl(fileName);

      // Create document record
      const { error: insertError } = await supabase
        .from('driver_documents')
        .insert({
          driver_id: driverId,
          document_type: selectedType,
          document_url: urlData.publicUrl,
          expires_at: expiryDate || null,
          status: 'pending',
        });

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver-documents', driverId] });
      toast.success(t.driverDocuments.uploadSuccess);
      setIsUploadOpen(false);
      setFile(null);
      setSelectedType('');
      setExpiryDate('');
    },
    onError: (error) => {
      toast.error(`${t.driverDocuments.uploadFailed}: ${error.message}`);
    },
    onSettled: () => {
      setUploading(false);
    },
  });

  // Calculate verification progress
  const requiredDocs = documentTypes.filter(d => d.required);
  const approvedRequiredDocs = requiredDocs.filter(reqDoc => 
    documents.some(doc => doc.document_type === reqDoc.value && doc.status === 'approved')
  );
  const verificationProgress = Math.round((approvedRequiredDocs.length / requiredDocs.length) * 100);

  // Stats
  const stats = {
    total: documents.length,
    approved: documents.filter(d => d.status === 'approved').length,
    pending: documents.filter(d => d.status === 'pending').length,
    rejected: documents.filter(d => d.status === 'rejected').length,
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle className="h-3 w-3 mr-1" />
            {t.driverDocuments.verified}
          </Badge>
        );
      case 'rejected':
        return (
          <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
            <XCircle className="h-3 w-3 mr-1" />
            {t.driverDocuments.rejectedLabel}
          </Badge>
        );
      default:
        return (
          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
            <Clock className="h-3 w-3 mr-1" />
            {t.driverDocuments.underReview}
          </Badge>
        );
    }
  };

  const getDocumentTypeLabel = (type: string) => {
    return documentTypes.find(d => d.value === type)?.label || type;
  };

  const isExpiringSoon = (expiryDate: string | null) => {
    if (!expiryDate) return false;
    const days = differenceInDays(new Date(expiryDate), new Date());
    return days <= 30 && days > 0;
  };

  const isExpired = (expiryDate: string | null) => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };

  const getDaysRemaining = (expiryDate: string | null) => {
    if (!expiryDate) return null;
    return differenceInDays(new Date(expiryDate), new Date());
  };

  // Get missing required documents
  const missingDocs = requiredDocs.filter(reqDoc => 
    !documents.some(doc => doc.document_type === reqDoc.value && doc.status !== 'rejected')
  );

  // Get documents needing attention (rejected or expiring)
  const attentionDocs = documents.filter(doc => 
    doc.status === 'rejected' || isExpiringSoon(doc.expires_at) || isExpired(doc.expires_at)
  );

  // Check if driver needs onboarding (no documents uploaded yet)
  const needsOnboarding = documents.length === 0;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Show onboarding welcome screen
  if (showOnboarding === 'welcome') {
    return (
      <OnboardingWelcome
        driverName={driverName}
        onStart={() => setShowOnboarding('wizard')}
      />
    );
  }

  // Show onboarding wizard
  if (showOnboarding === 'wizard') {
    return (
      <OnboardingWizard
        driverId={driverId}
        driverName={driverName}
        onComplete={() => {
          setShowOnboarding(null);
          queryClient.invalidateQueries({ queryKey: ['driver-documents', driverId] });
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Onboarding CTA for new drivers */}
      {needsOnboarding && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">{t.driverDocuments.newDriverStartHere}</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  {t.driverDocuments.guidedOnboarding}
                </p>
                <Button onClick={() => setShowOnboarding('welcome')} className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  {t.driverDocuments.startOnboardingWizard}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      {/* Verification Progress Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">{t.driverDocuments.verificationProgress}</CardTitle>
            </div>
            <Badge variant={verificationProgress === 100 ? 'default' : 'secondary'}>
              {verificationProgress}%
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Progress value={verificationProgress} className="h-2 mb-3" />
          <p className="text-sm text-muted-foreground">
            {t.driverDocuments.requiredDocsVerified.replace('{approved}', String(approvedRequiredDocs.length)).replace('{total}', String(requiredDocs.length))}
          </p>
          
          {verificationProgress === 100 ? (
            <div className="flex items-center gap-2 mt-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium text-green-700 dark:text-green-400">
                {t.driverDocuments.allDocsVerified}
              </span>
            </div>
          ) : missingDocs.length > 0 ? (
            <div className="mt-3 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
              <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400 mb-2">
                {t.driverDocuments.missingDocuments}:
              </p>
              <ul className="text-sm text-yellow-600 dark:text-yellow-400/80 space-y-1">
                {missingDocs.map(doc => (
                  <li key={doc.value} className="flex items-center gap-2">
                    <AlertTriangle className="h-3 w-3" />
                    {doc.label}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Attention Required */}
      {attentionDocs.length > 0 && (
        <Card className="border-orange-200 dark:border-orange-900/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <CardTitle className="text-base">{t.driverDocuments.attentionRequired}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {attentionDocs.map(doc => (
                <div 
                  key={doc.id}
                  className="flex items-center justify-between p-2 rounded bg-orange-50 dark:bg-orange-900/20"
                >
                  <div>
                    <p className="text-sm font-medium">{getDocumentTypeLabel(doc.document_type)}</p>
                    <p className="text-xs text-muted-foreground">
                      {doc.status === 'rejected' 
                        ? doc.rejection_reason || t.driverDocuments.rejectedResubmit
                        : isExpired(doc.expires_at)
                        ? t.driverDocuments.expiredUploadNew
                        : t.driverDocuments.expiresInDays.replace('{days}', String(getDaysRemaining(doc.expires_at)))}
                    </p>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => {
                      setSelectedType(doc.document_type);
                      setIsUploadOpen(true);
                    }}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    {t.driverDocuments.update}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documents List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
             <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t.driverDocuments.myDocuments}
            </CardTitle>
            <CardDescription className="mt-1">
              {stats.approved} {t.driverDocuments.verified} • {stats.pending} {t.driverDocuments.pendingLabel} • {stats.rejected} {t.driverDocuments.rejectedLabel}
            </CardDescription>
          </div>
          <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1">
                <Plus className="h-4 w-4" />
                {dp.upload || 'Upload'}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t.driverDocuments.uploadDocument}</DialogTitle>
                <DialogDescription>
                  {t.driverDocuments.uploadDocDescription}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>{t.driverDocuments.documentType}</Label>
                  <Select value={selectedType} onValueChange={setSelectedType}>
                    <SelectTrigger>
                      <SelectValue placeholder={t.driverDocuments.selectDocType} />
                    </SelectTrigger>
                    <SelectContent>
                      {documentTypes.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                          {type.required && <span className="text-red-500 ml-1">*</span>}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t.driverDocuments.expiryDate}</Label>
                  <Input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t.driverDocuments.file}</Label>
                  <Input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t.driverDocuments.acceptedFormats}
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsUploadOpen(false)}>
                  {dp.cancel || 'Cancel'}
                </Button>
                <Button
                  onClick={() => uploadMutation.mutate()}
                  disabled={!file || !selectedType || uploading}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t.driverDocuments.uploading}
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      {dp.upload || 'Upload'}
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="pt-0">
          {documents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>{t.driverDocuments.noDocumentsYet}</p>
              <p className="text-sm">{t.driverDocuments.uploadToGetVerified}</p>
            </div>
          ) : (
            <ScrollArea className="h-[300px] pr-2">
              <div className="space-y-3">
                {documents.map((doc) => {
                  const daysRemaining = getDaysRemaining(doc.expires_at);
                  const expired = isExpired(doc.expires_at);
                  const expiringSoon = isExpiringSoon(doc.expires_at);
                  
                  return (
                    <div
                      key={doc.id}
                      className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                        doc.status === 'rejected' 
                          ? 'border-red-200 bg-red-50/50 dark:border-red-900/50 dark:bg-red-900/10'
                          : expired
                          ? 'border-red-200 bg-red-50/50 dark:border-red-900/50 dark:bg-red-900/10'
                          : expiringSoon
                          ? 'border-yellow-200 bg-yellow-50/50 dark:border-yellow-900/50 dark:bg-yellow-900/10'
                          : 'border-border bg-card'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm truncate">
                            {getDocumentTypeLabel(doc.document_type)}
                          </span>
                          {getStatusBadge(doc.status)}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{t.driverDocuments.uploaded} {format(new Date(doc.uploaded_at), 'MMM dd, yyyy')}</span>
                          {doc.expires_at && (
                            <span className={`flex items-center gap-1 ${
                              expired 
                                ? 'text-red-500' 
                                : expiringSoon 
                                ? 'text-yellow-500' 
                                : ''
                            }`}>
                              <Calendar className="h-3 w-3" />
                              {expired 
                                ? t.driverDocuments.expired
                                : expiringSoon
                                ? `${t.driverDocuments.expiresIn} ${daysRemaining} ${t.driverDocuments.days}`
                                : `${t.driverDocuments.expires} ${format(new Date(doc.expires_at), 'MMM dd, yyyy')}`
                              }
                            </span>
                          )}
                        </div>
                        {doc.status === 'approved' && doc.verified_at && (
                          <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                            {t.driverDocuments.verifiedOn} {format(new Date(doc.verified_at), 'MMM dd, yyyy')}
                          </p>
                        )}
                        {doc.rejection_reason && (
                          <p className="text-xs text-red-500 mt-1">
                            {t.driverDocuments.reason}: {doc.rejection_reason}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => window.open(doc.document_url, '_blank')}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Document Requirements Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t.driverDocuments.documentRequirements}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid gap-2">
            {documentTypes.map(type => {
              const doc = documents.find(d => d.document_type === type.value);
              const hasApproved = doc?.status === 'approved';
              const hasPending = doc?.status === 'pending';
              
              return (
                <div 
                  key={type.value}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex items-center gap-2">
                    {hasApproved ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : hasPending ? (
                      <Clock className="h-4 w-4 text-yellow-500" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
                    )}
                    <span className="text-sm">{type.label}</span>
                    {type.required && (
                      <Badge variant="outline" className="text-xs py-0 h-5">{t.driverDocuments.required}</Badge>
                    )}
                  </div>
                  {!doc && (
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => {
                        setSelectedType(type.value);
                        setIsUploadOpen(true);
                      }}
                    >
                      <Upload className="h-3 w-3 mr-1" />
                       {dp.upload || 'Upload'}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
