import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useServerPagination } from '@/hooks/useServerPagination';
import { TablePagination } from '@/components/admin/TablePagination';
import { format } from 'date-fns';
import { 
  UserPlus, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Mail, 
  Phone, 
  CreditCard,
  RefreshCw,
  Eye,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

interface DriverApplication {
  id: string;
  user_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string;
  license_number: string;
  license_expiry: string;
  onboarding_status: string | null;
  background_check_status: string | null;
  created_at: string;
  rejection_reason: string | null;
  verification_notes: string | null;
}

export default function AdminDriverApplications() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const pagination = useServerPagination({ defaultPageSize: 10 });
  const [selectedDriver, setSelectedDriver] = useState<DriverApplication | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showDetailsSheet, setShowDetailsSheet] = useState(false);

  // Fetch pending driver applications
  const { data: applications, isLoading, refetch } = useQuery({
    queryKey: ['driver-applications', pagination.page, pagination.pageSize],
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from('drivers')
        .select('*', { count: 'exact' })
        .in('onboarding_status', ['pending', 'rejected'])
        .order('created_at', { ascending: false })
        .range(pagination.rangeFrom, pagination.rangeTo);

      if (error) throw error;
      if (count !== null) pagination.setTotalCount(count);
      return data as DriverApplication[];
    },
  });

  // Approve application mutation
  const approveMutation = useMutation({
    mutationFn: async (driverId: string) => {
      const { error } = await supabase
        .from('drivers')
        .update({
          onboarding_status: 'approved',
          is_active: true,
          verified_at: new Date().toISOString(),
        })
        .eq('id', driverId);

      if (error) throw error;

      // Send approval notification email
      const driver = applications?.find(d => d.id === driverId);
      if (driver?.email) {
        await supabase.functions.invoke('send-document-notification', {
          body: {
            email: driver.email,
            driverName: `${driver.first_name} ${driver.last_name}`,
            type: 'application_approved',
            documentType: 'Driver Application',
          },
        }).catch(err => console.error('Failed to send notification:', err));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver-applications'] });
      toast.success(t.admin.applicationApproved);
      setSelectedDriver(null);
    },
    onError: (error: Error) => {
      toast.error(`${t.admin.failedToApprove}: ${error.message}`);
    },
  });

  // Reject application mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ driverId, reason }: { driverId: string; reason: string }) => {
      const { error } = await supabase
        .from('drivers')
        .update({
          onboarding_status: 'rejected',
          is_active: false,
          rejection_reason: reason,
        })
        .eq('id', driverId);

      if (error) throw error;

      // Send rejection notification email
      const driver = applications?.find(d => d.id === driverId);
      if (driver?.email) {
        await supabase.functions.invoke('send-document-notification', {
          body: {
            email: driver.email,
            driverName: `${driver.first_name} ${driver.last_name}`,
            type: 'application_rejected',
            documentType: 'Driver Application',
            rejectionReason: reason,
          },
        }).catch(err => console.error('Failed to send notification:', err));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver-applications'] });
      toast.success(t.admin.applicationRejected);
      setShowRejectDialog(false);
      setRejectionReason('');
      setSelectedDriver(null);
    },
    onError: (error: Error) => {
      toast.error(`${t.admin.failedToReject}: ${error.message}`);
    },
  });

  const pendingCount = applications?.filter(a => a.onboarding_status === 'pending').length || 0;
  const rejectedCount = applications?.filter(a => a.onboarding_status === 'rejected').length || 0;

  const handleApprove = (driver: DriverApplication) => {
    approveMutation.mutate(driver.id);
  };

  const handleRejectClick = (driver: DriverApplication) => {
    setSelectedDriver(driver);
    setShowRejectDialog(true);
  };

  const handleRejectConfirm = () => {
    if (!selectedDriver || !rejectionReason.trim()) {
      toast.error(t.admin.provideRejectionReason);
      return;
    }
    rejectMutation.mutate({ driverId: selectedDriver.id, reason: rejectionReason });
  };

  const handleViewDetails = (driver: DriverApplication) => {
    setSelectedDriver(driver);
    setShowDetailsSheet(true);
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"><Clock className="mr-1 h-3 w-3" />{t.status.pending}</Badge>;
      case 'approved':
        return <Badge className="bg-green-500/10 text-green-600 dark:text-green-400"><CheckCircle className="mr-1 h-3 w-3" />{t.admin.approved}</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500/10 text-red-600 dark:text-red-400"><XCircle className="mr-1 h-3 w-3" />{t.admin.rejected}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <AdminLayout
      title={t.admin.driverApplicationsTitle}
      description={t.admin.driverApplicationsDesc}
    >
      <div className="space-y-6">
        {/* Refresh Button */}
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => refetch()} className="w-full sm:w-auto">
            <RefreshCw className="mr-2 h-4 w-4" />
            {t.admin.refresh}
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t.admin.pendingReviewLabel}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-500" />
                <span className="text-2xl font-bold">{pendingCount}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t.admin.rejectedLabel}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                <span className="text-2xl font-bold">{rejectedCount}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t.admin.totalApplications}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{applications?.length || 0}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Applications Table */}
        <Card>
          <CardHeader>
            <CardTitle>{t.admin.driverApplicationsTitle}</CardTitle>
            <CardDescription>{t.admin.driverApplicationsDesc}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.admin.applicant}</TableHead>
                  <TableHead>{t.admin.contact}</TableHead>
                  <TableHead>{t.admin.license}</TableHead>
                  <TableHead>{t.admin.applied}</TableHead>
                  <TableHead>{t.common.status}</TableHead>
                  <TableHead className="text-right">{t.common.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      <RefreshCw className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : applications?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      {t.admin.noApplicationsToReview}
                    </TableCell>
                  </TableRow>
                ) : (
                  applications?.map((driver) => (
                    <TableRow key={driver.id}>
                      <TableCell>
                        <div className="font-medium">{driver.first_name} {driver.last_name}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {driver.email || 'N/A'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {driver.phone}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 text-sm">
                          <span className="flex items-center gap-1">
                            <CreditCard className="h-3 w-3 text-muted-foreground" />
                            {driver.license_number}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            Expires: {format(new Date(driver.license_expiry), 'MMM d, yyyy')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(driver.created_at), 'MMM d, yyyy')}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(driver.onboarding_status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(driver)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {driver.onboarding_status === 'pending' && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-green-600 hover:bg-green-500/10 hover:text-green-600"
                                onClick={() => handleApprove(driver)}
                                disabled={approveMutation.isPending}
                              >
                                <CheckCircle className="mr-1 h-4 w-4" />
                                {t.admin.approve}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-600 hover:bg-red-500/10 hover:text-red-600"
                                onClick={() => handleRejectClick(driver)}
                                disabled={rejectMutation.isPending}
                              >
                                <XCircle className="mr-1 h-4 w-4" />
                                {t.admin.reject}
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <TablePagination
              page={pagination.page}
              pageSize={pagination.pageSize}
              totalCount={pagination.totalCount}
              totalPages={pagination.totalPages}
              from={pagination.from}
              to={pagination.to}
              onPageChange={pagination.setPage}
              onPageSizeChange={pagination.setPageSize}
            />
          </CardContent>
        </Card>
      </div>

      {/* Rejection Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              {t.admin.rejectApplication}
            </DialogTitle>
            <DialogDescription>
              {t.admin.rejectApplicationDesc.replace('{name}', `${selectedDriver?.first_name} ${selectedDriver?.last_name}`)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">{t.admin.rejectionReason}</Label>
              <Textarea
                id="rejection-reason"
                placeholder={t.admin.rejectionPlaceholder}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              {t.common.cancel}
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectConfirm}
              disabled={rejectMutation.isPending || !rejectionReason.trim()}
            >
              {rejectMutation.isPending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  {t.admin.rejecting}
                </>
              ) : (
                t.admin.confirmRejection
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Sheet */}
      <Sheet open={showDetailsSheet} onOpenChange={setShowDetailsSheet}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{t.admin.applicationDetails}</SheetTitle>
            <SheetDescription>
              {selectedDriver?.first_name} {selectedDriver?.last_name}
            </SheetDescription>
          </SheetHeader>
          {selectedDriver && (
            <div className="mt-6 space-y-6">
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-foreground">{t.admin.personalInformation}</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">{t.admin.firstName}</span>
                    <p className="font-medium">{selectedDriver.first_name}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t.admin.lastName}</span>
                    <p className="font-medium">{selectedDriver.last_name}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">{t.common.email}</span>
                    <p className="font-medium">{selectedDriver.email || 'Not provided'}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">{t.common.phone}</span>
                    <p className="font-medium">{selectedDriver.phone}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-medium text-foreground">{t.admin.licenseInformation}</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="col-span-2">
                    <span className="text-muted-foreground">{t.admin.licenseNumber}</span>
                    <p className="font-medium">{selectedDriver.license_number}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">{t.admin.expiryDate}</span>
                    <p className="font-medium">{format(new Date(selectedDriver.license_expiry), 'MMMM d, yyyy')}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-medium text-foreground">{t.admin.applicationStatus}</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t.admin.onboardingStatus}</span>
                    {getStatusBadge(selectedDriver.onboarding_status)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t.admin.backgroundCheck}</span>
                    {getStatusBadge(selectedDriver.background_check_status)}
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t.admin.appliedOn}</span>
                    <p className="font-medium">{format(new Date(selectedDriver.created_at), 'MMMM d, yyyy h:mm a')}</p>
                  </div>
                </div>
              </div>

              {selectedDriver.rejection_reason && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-foreground">{t.admin.rejectionReason}</h4>
                  <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
                    {selectedDriver.rejection_reason}
                  </div>
                </div>
              )}

              {selectedDriver.onboarding_status === 'pending' && (
                <div className="flex gap-2 pt-4">
                  <Button
                    className="flex-1"
                    onClick={() => {
                      handleApprove(selectedDriver);
                      setShowDetailsSheet(false);
                    }}
                    disabled={approveMutation.isPending}
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    {t.admin.approve}
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => {
                      setShowDetailsSheet(false);
                      handleRejectClick(selectedDriver);
                    }}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    {t.admin.reject}
                  </Button>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </AdminLayout>
  );
}
