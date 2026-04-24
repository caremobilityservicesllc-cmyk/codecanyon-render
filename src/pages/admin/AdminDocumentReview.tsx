import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Search,
  FileText,
  CheckCircle,
  XCircle,
  Eye,
  Clock,
  User,
  Calendar,
  Loader2,
  AlertTriangle,
  FileCheck,
} from 'lucide-react';

interface DocumentWithDriver {
  id: string;
  driver_id: string;
  document_type: string;
  document_url: string;
  status: string;
  expires_at: string | null;
  uploaded_at: string;
  rejection_reason: string | null;
  driver: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    avatar_url: string | null;
  };
}

const documentTypes: Record<string, string> = {
  license_front: 'Driver License (Front)',
  license_back: 'Driver License (Back)',
  insurance: 'Insurance Certificate',
  vehicle_registration: 'Vehicle Registration',
  background_check: 'Background Check',
  medical_certificate: 'Medical Certificate',
  profile_photo: 'Profile Photo',
  other: 'Other Document',
};

export default function AdminDocumentReview() {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<DocumentWithDriver | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const queryClient = useQueryClient();

  const { data: pendingDocuments = [], isLoading } = useQuery({
    queryKey: ['pending-documents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('driver_documents')
        .select(`
          *,
          driver:drivers(id, first_name, last_name, email, avatar_url)
        `)
        .eq('status', 'pending')
        .order('uploaded_at', { ascending: true });

      if (error) throw error;
      return data as DocumentWithDriver[];
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const { error } = await supabase
        .from('driver_documents')
        .update({
          status: 'approved',
          verified_at: new Date().toISOString(),
          rejection_reason: null,
        })
        .eq('id', documentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-documents'] });
      toast.success(t.admin.documentApproved);
    },
    onError: (error) => {
      toast.error(`${t.admin.failedToApproveDoc}: ${error.message}`);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ documentId, reason }: { documentId: string; reason: string }) => {
      const { error } = await supabase
        .from('driver_documents')
        .update({
          status: 'rejected',
          rejection_reason: reason,
        })
        .eq('id', documentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-documents'] });
      toast.success(t.admin.documentRejected);
      setRejectDialogOpen(false);
      setSelectedDocument(null);
      setRejectionReason('');
    },
    onError: (error) => {
      toast.error(`${t.admin.failedToRejectDoc}: ${error.message}`);
    },
  });

  const filteredDocuments = pendingDocuments.filter((doc) => {
    if (!searchQuery) return true;
    const driverName = `${doc.driver?.first_name} ${doc.driver?.last_name}`.toLowerCase();
    const docType = documentTypes[doc.document_type]?.toLowerCase() || doc.document_type.toLowerCase();
    return driverName.includes(searchQuery.toLowerCase()) || docType.includes(searchQuery.toLowerCase());
  });

  const handleReject = (doc: DocumentWithDriver) => {
    setSelectedDocument(doc);
    setRejectionReason('');
    setRejectDialogOpen(true);
  };

  const confirmReject = () => {
    if (selectedDocument && rejectionReason.trim()) {
      rejectMutation.mutate({ documentId: selectedDocument.id, reason: rejectionReason.trim() });
    }
  };

  const getDocumentTypeLabel = (type: string) => documentTypes[type] || type;

  return (
    <AdminLayout
      title={t.admin.documentReviewQueue}
      description={t.admin.documentReviewDesc}
    >
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.admin.pendingReviews}</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingDocuments.length}</div>
            <p className="text-xs text-muted-foreground">{t.admin.documentsAwaitingReview}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.admin.uniqueDrivers}</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(pendingDocuments.map((d) => d.driver_id)).size}
            </div>
            <p className="text-xs text-muted-foreground">{t.admin.driversWithPendingDocs}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.admin.oldestPending}</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {pendingDocuments.length > 0
                ? format(new Date(pendingDocuments[0].uploaded_at), 'MMM dd')
                : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              {pendingDocuments.length > 0
                ? `Uploaded ${format(new Date(pendingDocuments[0].uploaded_at), 'yyyy')}`
                : t.admin.noPendingDocuments}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-sm">
          <Search className="absolute inset-inline-start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t.admin.searchByDriverOrDoc}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="ps-10"
          />
        </div>
      </div>

      {/* Documents Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            {t.admin.pendingDocuments} ({filteredDocuments.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">{t.admin.noPendingDocuments}</p>
              <p className="text-sm">{t.admin.allDocumentsReviewed}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.admin.driver}</TableHead>
                  <TableHead>{t.admin.documentType}</TableHead>
                  <TableHead>{t.admin.uploaded}</TableHead>
                  <TableHead>{t.admin.expiry}</TableHead>
                  <TableHead className="text-right">{t.common.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocuments.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={doc.driver?.avatar_url || undefined} />
                          <AvatarFallback>
                            {doc.driver?.first_name?.[0]}
                            {doc.driver?.last_name?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">
                            {doc.driver?.first_name} {doc.driver?.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {doc.driver?.email || t.admin.noEmail}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{getDocumentTypeLabel(doc.document_type)}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {format(new Date(doc.uploaded_at), 'MMM dd, yyyy')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(doc.uploaded_at), 'HH:mm')}
                      </div>
                    </TableCell>
                    <TableCell>
                      {doc.expires_at ? (
                        <div className="flex items-center gap-1 text-sm">
                          {new Date(doc.expires_at) < new Date() ? (
                            <AlertTriangle className="h-3 w-3 text-destructive" />
                          ) : null}
                          {format(new Date(doc.expires_at), 'MMM dd, yyyy')}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">{t.admin.noExpiry}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setPreviewUrl(doc.document_url)}
                          title={t.admin.previewDocument}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                          onClick={() => approveMutation.mutate(doc.id)}
                          disabled={approveMutation.isPending}
                          title={t.admin.approveDocument}
                        >
                          {approveMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleReject(doc)}
                          title={t.admin.rejectDocumentBtn}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Rejection Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.admin.rejectDocument}</DialogTitle>
            <DialogDescription>
              {t.admin.rejectDocumentDesc}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedDocument && (
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={selectedDocument.driver?.avatar_url || undefined} />
                  <AvatarFallback>
                    {selectedDocument.driver?.first_name?.[0]}
                    {selectedDocument.driver?.last_name?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">
                    {selectedDocument.driver?.first_name} {selectedDocument.driver?.last_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {getDocumentTypeLabel(selectedDocument.document_type)}
                  </p>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">{t.admin.rejectionReasonDoc}</Label>
              <Textarea
                id="rejection-reason"
                placeholder={t.admin.rejectionPlaceholderDoc}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmReject}
              disabled={!rejectionReason.trim() || rejectMutation.isPending}
            >
              {rejectMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t.admin.rejectingDoc}
                </>
              ) : (
                t.admin.rejectDocument
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{t.admin.documentPreview}</DialogTitle>
          </DialogHeader>
          <div className="overflow-auto max-h-[70vh]">
            {previewUrl?.endsWith('.pdf') ? (
              <iframe src={previewUrl} className="w-full h-[600px] rounded-lg" title="PDF Preview" />
            ) : (
              <img
                src={previewUrl || ''}
                alt="Document preview"
                className="w-full h-auto rounded-lg object-contain"
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewUrl(null)}>
              {t.common.close}
            </Button>
            <Button onClick={() => window.open(previewUrl || '', '_blank')}>
              {t.admin.openInNewTab}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
