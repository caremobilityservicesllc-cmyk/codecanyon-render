import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useServerPagination } from '@/hooks/useServerPagination';
import { TablePagination } from '@/components/admin/TablePagination';
import { format } from 'date-fns';
import { 
  Plus, 
  Search, 
  UserCheck, 
  UserX, 
  Star, 
  Car, 
  DollarSign,
  FileCheck,
  AlertTriangle,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  Shield,
  Clock
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { AddDriverDialog } from '@/components/admin/drivers/AddDriverDialog';
import { EditDriverDialog } from '@/components/admin/drivers/EditDriverDialog';
import { DriverDetailsSheet } from '@/components/admin/drivers/DriverDetailsSheet';
import { DriverPerformanceCard } from '@/components/admin/drivers/DriverPerformanceCard';
import { ExpiringDocumentsWidget } from '@/components/admin/drivers/ExpiringDocumentsWidget';
import {
  MobileDataCard,
  MobileDataRow,
  MobileDataHeader,
  MobileDataList,
} from '@/components/admin/MobileDataCard';
import { useLanguage } from '@/contexts/LanguageContext';

interface Driver {
  id: string;
  user_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string;
  license_number: string;
  license_expiry: string;
  insurance_expiry: string | null;
  avatar_url: string | null;
  is_active: boolean;
  is_available: boolean;
  average_rating: number;
  total_rides: number;
  documents_verified: boolean;
  onboarding_status: string;
  background_check_status: string;
  earnings_total: number;
  earnings_this_month: number;
  verification_notes: string | null;
  rejection_reason: string | null;
  completed_rides_this_month: number;
  created_at: string;
}

export default function AdminDrivers() {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [onboardingFilter, setOnboardingFilter] = useState<string>('all');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [detailsSheetOpen, setDetailsSheetOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const queryClient = useQueryClient();
  const pagination = useServerPagination({ defaultPageSize: 10 });

  useEffect(() => {
    pagination.resetPage();
  }, [searchQuery, statusFilter, onboardingFilter]);

  const { data: driversData, isLoading } = useQuery({
    queryKey: ['admin-drivers', statusFilter, onboardingFilter, searchQuery, pagination.page, pagination.pageSize],
    queryFn: async () => {
      let query = supabase
        .from('drivers')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (statusFilter === 'active') {
        query = query.eq('is_active', true);
      } else if (statusFilter === 'inactive') {
        query = query.eq('is_active', false);
      }

      if (onboardingFilter !== 'all') {
        query = query.eq('onboarding_status', onboardingFilter);
      }

      if (searchQuery.trim()) {
        query = query.or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`);
      }

      query = query.range(pagination.rangeFrom, pagination.rangeTo);

      const { data, error, count } = await query;
      if (error) throw error;
      pagination.setTotalCount(count || 0);
      return data as Driver[];
    },
  });

  const drivers = driversData || [];

  const deleteMutation = useMutation({
    mutationFn: async (driverId: string) => {
      const { error } = await supabase
        .from('drivers')
        .delete()
        .eq('id', driverId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-drivers'] });
      toast.success(t.admin.driverDeleted);
      setDeleteDialogOpen(false);
      setSelectedDriver(null);
    },
    onError: (error) => {
      console.error('Error deleting driver:', error);
      toast.error(t.admin.failedToDeleteDriver);
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ driverId, isActive }: { driverId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('drivers')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('id', driverId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-drivers'] });
      toast.success(t.admin.driverStatusUpdated);
    },
    onError: (error) => {
      console.error('Error updating driver status:', error);
      toast.error(t.admin.failedToUpdateStatus);
    },
  });

  const filteredDrivers = drivers;

  const stats = {
    total: pagination.totalCount,
    active: drivers.filter(d => d.is_active).length,
    verified: drivers.filter(d => d.documents_verified).length,
    pending: drivers.filter(d => d.onboarding_status === 'pending' || d.onboarding_status === 'under_review').length,
  };

  const getOnboardingBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">{t.admin.approved}</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">{t.status.pending}</Badge>;
      case 'documents_submitted':
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">{t.admin.docsSubmitted}</Badge>;
      case 'under_review':
        return <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">{t.admin.underReview}</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">{t.admin.rejected}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getLicenseStatus = (expiryDate: string) => {
    const expiry = new Date(expiryDate);
    const today = new Date();
    const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry < 0) {
      return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">{t.admin.expired}</Badge>;
    } else if (daysUntilExpiry < 30) {
      return <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">{t.admin.expiringSoon}</Badge>;
    }
    return null;
  };

  return (
    <AdminLayout
      title={t.admin.driver}
      description={t.admin.manageDrivers}
    >
      <div className="space-y-6">
        {/* Add Driver Button */}
        <div className="flex justify-end">
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t.admin.addDriver2}
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Car className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-sm text-muted-foreground">{t.admin.totalDrivers}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-green-500/10 p-2">
                  <UserCheck className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.active}</p>
                  <p className="text-sm text-muted-foreground">{t.admin.activeDrivers}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-500/10 p-2">
                  <FileCheck className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.verified}</p>
                  <p className="text-sm text-muted-foreground">{t.admin.verified}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-yellow-500/10 p-2">
                  <Clock className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                  <p className="text-sm text-muted-foreground">{t.admin.pendingReview}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Expiring Documents Widget */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ExpiringDocumentsWidget drivers={drivers} />
          </div>
        </div>

        <Tabs defaultValue="list" className="space-y-4">
          <TabsList>
            <TabsTrigger value="list">{t.admin.driverList}</TabsTrigger>
            <TabsTrigger value="performance">{t.admin.performance}</TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="space-y-4">
            {/* Filters */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col gap-4 sm:flex-row">
                  <div className="relative flex-1">
                    <Search className="absolute inset-inline-start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder={t.admin.searchDrivers}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="ps-9"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder={t.common.status} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t.admin.allStatus}</SelectItem>
                      <SelectItem value="active">{t.admin.active}</SelectItem>
                      <SelectItem value="inactive">{t.admin.inactive}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={onboardingFilter} onValueChange={setOnboardingFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder={t.admin.onboarding} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t.admin.allOnboarding}</SelectItem>
                      <SelectItem value="pending">{t.status.pending}</SelectItem>
                      <SelectItem value="documents_submitted">{t.admin.docsSubmitted}</SelectItem>
                      <SelectItem value="under_review">{t.admin.underReview}</SelectItem>
                      <SelectItem value="approved">{t.admin.approved}</SelectItem>
                      <SelectItem value="rejected">{t.admin.rejected}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Mobile Card View */}
            <div className="sm:hidden">
              <MobileDataList
                isLoading={isLoading}
                loadingText={t.admin.loadingDrivers}
                isEmpty={filteredDrivers.length === 0}
                emptyText={`${t.admin.noDriversFound}. ${t.admin.noDriversHint}`}
              >
                {filteredDrivers.map((driver) => (
                  <MobileDataCard key={driver.id}>
                    <MobileDataHeader
                      title={
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={driver.avatar_url || undefined} />
                            <AvatarFallback>
                              {driver.first_name[0]}{driver.last_name[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">
                              {driver.first_name} {driver.last_name}
                            </p>
                            {driver.documents_verified && (
                              <div className="flex items-center gap-1 text-xs text-green-600">
                                <Shield className="h-3 w-3" />
                                {t.admin.verified}
                              </div>
                            )}
                          </div>
                        </div>
                      }
                      actions={
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedDriver(driver);
                                setDetailsSheetOpen(true);
                              }}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              {t.admin.viewDetails}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedDriver(driver);
                                setEditDialogOpen(true);
                              }}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              {t.common.edit}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => toggleStatusMutation.mutate({
                                driverId: driver.id,
                                isActive: !driver.is_active,
                              })}
                            >
                              {driver.is_active ? (
                                <>
                                  <UserX className="mr-2 h-4 w-4" />
                                  {t.admin.deactivate}
                                </>
                              ) : (
                                <>
                                  <UserCheck className="mr-2 h-4 w-4" />
                                  {t.admin.activate}
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => {
                                setSelectedDriver(driver);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              {t.common.delete}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      }
                    />
                    <MobileDataRow label={t.common.phone}>{driver.phone}</MobileDataRow>
                    {driver.email && (
                      <MobileDataRow label={t.auth.email}>
                        <span className="truncate max-w-[180px]">{driver.email}</span>
                      </MobileDataRow>
                    )}
                    <MobileDataRow label={t.admin.rating}>
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span className="font-medium">{driver.average_rating?.toFixed(1) || '5.0'}</span>
                      </div>
                    </MobileDataRow>
                    <MobileDataRow label={t.admin.rides}>
                      <span className="font-medium">{driver.total_rides || 0}</span>
                      <span className="text-muted-foreground ml-1">({driver.completed_rides_this_month || 0} {t.admin.thisMonth})</span>
                    </MobileDataRow>
                    <MobileDataRow label={t.admin.license}>
                      <div className="flex items-center gap-2">
                        <span>{driver.license_number}</span>
                        {getLicenseStatus(driver.license_expiry)}
                      </div>
                    </MobileDataRow>
                    <MobileDataRow label={t.admin.onboarding}>
                      {getOnboardingBadge(driver.onboarding_status)}
                    </MobileDataRow>
                    <MobileDataRow label={t.common.status}>
                      {driver.is_active ? (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                          {t.admin.active}
                        </Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400">
                          {t.admin.inactive}
                        </Badge>
                      )}
                    </MobileDataRow>
                  </MobileDataCard>
                ))}
              </MobileDataList>

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
            </div>

            {/* Desktop Table View */}
            <Card className="hidden sm:block">
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div>
                ) : filteredDrivers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Car className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium text-muted-foreground">{t.admin.noDriversFound}</p>
                    <p className="text-sm text-muted-foreground">{t.admin.noDriversHint}</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t.admin.driver}</TableHead>
                        <TableHead>{t.admin.contact}</TableHead>
                        <TableHead>{t.admin.rating}</TableHead>
                        <TableHead>{t.admin.rides}</TableHead>
                        <TableHead>{t.admin.license}</TableHead>
                        <TableHead>{t.admin.onboarding}</TableHead>
                        <TableHead>{t.common.status}</TableHead>
                        <TableHead className="text-right">{t.common.actions}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDrivers.map((driver) => (
                        <TableRow key={driver.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={driver.avatar_url || undefined} />
                                <AvatarFallback>
                                  {driver.first_name[0]}{driver.last_name[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">
                                  {driver.first_name} {driver.last_name}
                                </p>
                                {driver.documents_verified && (
                                  <div className="flex items-center gap-1 text-xs text-green-600">
                                    <Shield className="h-3 w-3" />
                                    {t.admin.verified}
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="text-sm">{driver.phone}</p>
                              {driver.email && (
                                <p className="text-xs text-muted-foreground">{driver.email}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                              <span className="font-medium">{driver.average_rating?.toFixed(1) || '5.0'}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{driver.total_rides || 0}</p>
                              <p className="text-xs text-muted-foreground">
                                {driver.completed_rides_this_month || 0} {t.admin.thisMonth}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="text-sm">{driver.license_number}</p>
                              <div className="flex items-center gap-2">
                                <p className="text-xs text-muted-foreground">
                                  Exp: {format(new Date(driver.license_expiry), 'MMM yyyy')}
                                </p>
                                {getLicenseStatus(driver.license_expiry)}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {getOnboardingBadge(driver.onboarding_status)}
                          </TableCell>
                          <TableCell>
                            {driver.is_active ? (
                              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                {t.admin.active}
                              </Badge>
                            ) : (
                              <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400">
                                {t.admin.inactive}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedDriver(driver);
                                    setDetailsSheetOpen(true);
                                  }}
                                >
                                  <Eye className="mr-2 h-4 w-4" />
                                  {t.admin.viewDetails}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedDriver(driver);
                                    setEditDialogOpen(true);
                                  }}
                                >
                                  <Edit className="mr-2 h-4 w-4" />
                                  {t.common.edit}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => toggleStatusMutation.mutate({
                                    driverId: driver.id,
                                    isActive: !driver.is_active,
                                  })}
                                >
                                  {driver.is_active ? (
                                    <>
                                      <UserX className="mr-2 h-4 w-4" />
                                      {t.admin.deactivate}
                                    </>
                                  ) : (
                                    <>
                                      <UserCheck className="mr-2 h-4 w-4" />
                                      {t.admin.activate}
                                    </>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => {
                                    setSelectedDriver(driver);
                                    setDeleteDialogOpen(true);
                                  }}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  {t.common.delete}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

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
          </TabsContent>

          <TabsContent value="performance">
            <DriverPerformanceCard drivers={drivers} />
          </TabsContent>
        </Tabs>

        {/* Dialogs */}
        <AddDriverDialog 
          open={addDialogOpen} 
          onOpenChange={setAddDialogOpen} 
        />

        {selectedDriver && (
          <>
            <EditDriverDialog
              open={editDialogOpen}
              onOpenChange={setEditDialogOpen}
              driver={selectedDriver}
            />
            <DriverDetailsSheet
              open={detailsSheetOpen}
              onOpenChange={setDetailsSheetOpen}
              driver={selectedDriver}
            />
          </>
        )}

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t.admin.deleteDriver}</DialogTitle>
              <DialogDescription>
                {t.admin.deleteDriverConfirm.replace('{name}', selectedDriver ? `${selectedDriver.first_name} ${selectedDriver.last_name}` : '')}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                {t.common.cancel}
              </Button>
              <Button
                variant="destructive"
                onClick={() => selectedDriver && deleteMutation.mutate(selectedDriver.id)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? t.admin.deleting : t.common.delete}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
