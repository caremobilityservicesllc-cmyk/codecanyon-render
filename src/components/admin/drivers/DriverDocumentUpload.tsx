import { useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Trash2,
  Plus,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

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

interface DriverDocumentUploadProps {
  driverId: string;
  driverName: string;
}

export function DriverDocumentUpload({ driverId, driverName }: DriverDocumentUploadProps) {
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedType, setSelectedType] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const du = (t as any).driverDocUpload || {};

  const documentTypes = [
    { value: 'license_front', label: du.licenseFront || 'Driver License (Front)' },
    { value: 'license_back', label: du.licenseBack || 'Driver License (Back)' },
    { value: 'insurance', label: du.insurance || 'Insurance Certificate' },
    { value: 'vehicle_registration', label: du.vehicleRegistration || 'Vehicle Registration' },
    { value: 'background_check', label: du.backgroundCheck || 'Background Check' },
    { value: 'medical_certificate', label: du.medicalCertificate || 'Medical Certificate' },
    { value: 'other', label: du.otherDocument || 'Other Document' },
  ];

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
      const fileExt = file.name.split('.').pop();
      const fileName = `${driverId}/${selectedType}_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('driver-documents').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('driver-documents').getPublicUrl(fileName);
      const { error: insertError } = await supabase.from('driver_documents').insert({
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
      toast.success(t.driverDocuments.uploadedSuccessfully);
      setIsUploadOpen(false);
      setFile(null);
      setSelectedType('');
      setExpiryDate('');
    },
    onError: (error) => {
      toast.error(`Upload failed: ${error.message}`);
    },
    onSettled: () => {
      setUploading(false);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, reason }: { id: string; status: string; reason?: string }) => {
      const { error } = await supabase
        .from('driver_documents')
        .update({
          status,
          rejection_reason: reason || null,
          verified_at: status === 'approved' ? new Date().toISOString() : null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver-documents', driverId] });
      toast.success(t.driverDocuments.statusUpdated);
    },
    onError: (error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('driver_documents').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver-documents', driverId] });
      toast.success(t.driverDocuments.deleted);
    },
    onError: (error) => {
      toast.error(`Delete failed: ${error.message}`);
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle className="h-3 w-3 mr-1" />
            {du.approved || 'Approved'}
          </Badge>
        );
      case 'rejected':
        return (
          <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
            <XCircle className="h-3 w-3 mr-1" />
            {du.rejected || 'Rejected'}
          </Badge>
        );
      default:
        return (
          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
            <Clock className="h-3 w-3 mr-1" />
            {du.pending || 'Pending'}
          </Badge>
        );
    }
  };

  const getDocumentTypeLabel = (type: string) => {
    return documentTypes.find(d => d.value === type)?.label || type;
  };

  const isExpiringSoon = (expiryDate: string | null) => {
    if (!expiryDate) return false;
    const daysUntilExpiry = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  };

  const isExpired = (expiryDate: string | null) => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-5 w-5" />
          {du.documents || 'Documents'}
        </CardTitle>
        <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1">
              <Plus className="h-4 w-4" />
              {t.common.upload}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{du.uploadDocument || 'Upload Document'}</DialogTitle>
              <DialogDescription>
                {(du.uploadDocFor || 'Upload a verification document for {name}').replace('{name}', driverName)}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{du.documentType || 'Document Type'}</Label>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger>
                    <SelectValue placeholder={du.selectDocumentType || 'Select document type'} />
                  </SelectTrigger>
                  <SelectContent>
                    {documentTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{du.expiryDateOptional || 'Expiry Date (Optional)'}</Label>
                <Input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{du.file || 'File'}</Label>
                <Input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                <p className="text-xs text-muted-foreground">
                  {du.acceptedFormats || 'Accepted formats: Images (JPG, PNG) or PDF. Max 10MB.'}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsUploadOpen(false)}>
                {t.common.cancel}
              </Button>
              <Button
                onClick={() => uploadMutation.mutate()}
                disabled={!file || !selectedType || uploading}
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {du.uploading || 'Uploading...'}
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    {t.common.upload}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>{du.noDocsYet || 'No documents uploaded yet'}</p>
            <p className="text-sm">{du.clickUploadHint || 'Click "Upload" to add verification documents'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm truncate">
                      {getDocumentTypeLabel(doc.document_type)}
                    </span>
                    {getStatusBadge(doc.status)}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{du.uploaded || 'Uploaded'} {format(new Date(doc.uploaded_at), 'MMM dd, yyyy')}</span>
                    {doc.expires_at && (
                      <span className={`flex items-center gap-1 ${isExpired(doc.expires_at) ? 'text-red-500' : isExpiringSoon(doc.expires_at) ? 'text-yellow-500' : ''}`}>
                        {isExpired(doc.expires_at) ? (
                          <AlertTriangle className="h-3 w-3" />
                        ) : isExpiringSoon(doc.expires_at) ? (
                          <Clock className="h-3 w-3" />
                        ) : null}
                        {du.expires || 'Expires'} {format(new Date(doc.expires_at), 'MMM dd, yyyy')}
                      </span>
                    )}
                  </div>
                  {doc.rejection_reason && (
                    <p className="text-xs text-red-500 mt-1">{doc.rejection_reason}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => window.open(doc.document_url, '_blank')}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  {doc.status === 'pending' && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-green-600 hover:text-green-700"
                        onClick={() => updateStatusMutation.mutate({ id: doc.id, status: 'approved' })}
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600 hover:text-red-700"
                        onClick={() => {
                          const reason = prompt(du.rejectionReason || 'Rejection reason:');
                          if (reason) {
                            updateStatusMutation.mutate({ id: doc.id, status: 'rejected', reason });
                          }
                        }}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => {
                      if (confirm(du.deleteDocument || 'Delete this document?')) {
                        deleteMutation.mutate(doc.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
