import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Pencil, Tag, Calendar, Users, Loader2, ToggleLeft, ToggleRight } from 'lucide-react';
import { format } from 'date-fns';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  MobileDataCard,
  MobileDataRow,
  MobileDataHeader,
  MobileDataList,
} from '@/components/admin/MobileDataCard';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { TablePagination } from '@/components/admin/TablePagination';
import { useServerPagination } from '@/hooks/useServerPagination';

interface PromoCode {
  id: string;
  code: string;
  description: string | null;
  discount_percentage: number;
  max_uses: number | null;
  max_uses_per_user: number | null;
  current_uses: number;
  min_booking_amount: number;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
}

interface PromoCodeFormData {
  code: string;
  description: string;
  discount_percentage: number;
  max_uses: number | null;
  max_uses_per_user: number | null;
  min_booking_amount: number;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
}

const initialFormData: PromoCodeFormData = {
  code: '',
  description: '',
  discount_percentage: 10,
  max_uses: null,
  max_uses_per_user: 1,
  min_booking_amount: 0,
  valid_from: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  valid_until: '',
  is_active: true,
};

export default function AdminPromoCodes() {
  const { t } = useLanguage();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedPromoCode, setSelectedPromoCode] = useState<PromoCode | null>(null);
  const [formData, setFormData] = useState<PromoCodeFormData>(initialFormData);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const pagination = useServerPagination({ defaultPageSize: 10 });

  // Fetch promo codes
  const { data: promoCodes, isLoading } = useQuery({
    queryKey: ['promo-codes', pagination.page, pagination.pageSize],
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from('promo_codes')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(pagination.rangeFrom, pagination.rangeTo);
      
      if (error) throw error;
      if (count !== null) pagination.setTotalCount(count);
      return data as PromoCode[];
    },
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: PromoCodeFormData) => {
      const payload = {
        code: data.code.toUpperCase(),
        description: data.description || null,
        discount_percentage: data.discount_percentage,
        max_uses: data.max_uses || null,
        max_uses_per_user: data.max_uses_per_user,
        min_booking_amount: data.min_booking_amount,
        valid_from: data.valid_from,
        valid_until: data.valid_until || null,
        is_active: data.is_active,
      };

      if (selectedPromoCode) {
        const { error } = await supabase
          .from('promo_codes')
          .update(payload)
          .eq('id', selectedPromoCode.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('promo_codes')
          .insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promo-codes'] });
      setIsDialogOpen(false);
      setFormData(initialFormData);
      setSelectedPromoCode(null);
      toast({
        title: selectedPromoCode ? ((t as any).adminPromoCodesExtra?.promoCodeUpdated || 'Promo code updated') : ((t as any).adminPromoCodesExtra?.promoCodeCreated || 'Promo code created'),
        description: (t as any).adminPromoCodesExtra?.promoCodeSavedDesc || 'The promo code has been saved successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: t.common.error,
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('promo_codes')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promo-codes'] });
      setIsDeleteDialogOpen(false);
      setSelectedPromoCode(null);
      toast({
        title: t.adminPromoCodes.promoCodeDeleted,
        description: t.adminPromoCodes.promoCodeDeletedDesc,
      });
    },
    onError: (error: Error) => {
      toast({
        title: t.common.error,
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('promo_codes')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promo-codes'] });
    },
    onError: (error: Error) => {
      toast({
        title: t.common.error,
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleEdit = (promoCode: PromoCode) => {
    setSelectedPromoCode(promoCode);
    setFormData({
      code: promoCode.code,
      description: promoCode.description || '',
      discount_percentage: promoCode.discount_percentage,
      max_uses: promoCode.max_uses,
      max_uses_per_user: promoCode.max_uses_per_user,
      min_booking_amount: promoCode.min_booking_amount,
      valid_from: promoCode.valid_from ? format(new Date(promoCode.valid_from), "yyyy-MM-dd'T'HH:mm") : '',
      valid_until: promoCode.valid_until ? format(new Date(promoCode.valid_until), "yyyy-MM-dd'T'HH:mm") : '',
      is_active: promoCode.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (promoCode: PromoCode) => {
    setSelectedPromoCode(promoCode);
    setIsDeleteDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  const getStatusBadge = (promoCode: PromoCode) => {
    if (!promoCode.is_active) {
      return <Badge variant="secondary">{t.status.pending}</Badge>;
    }
    
    const now = new Date();
    const validFrom = new Date(promoCode.valid_from);
    const validUntil = promoCode.valid_until ? new Date(promoCode.valid_until) : null;
    
    if (validFrom > now) {
      return <Badge variant="outline" className="border-amber-500 text-amber-500">{t.admin.scheduled}</Badge>;
    }
    
    if (validUntil && validUntil < now) {
      return <Badge variant="destructive">{t.admin.expired || 'Expired'}</Badge>;
    }
    
    if (promoCode.max_uses && promoCode.current_uses >= promoCode.max_uses) {
      return <Badge className="bg-red-500/10 text-red-600 dark:text-red-400">{t.admin.exhausted}</Badge>;
    }
    
    return <Badge className="bg-green-500 hover:bg-green-600">{t.status.active}</Badge>;
  };

  return (
    <AdminLayout
      title={t.admin.promoCodes}
      description={t.admin.managePromoCodes}
    >
      <div className="space-y-6">
        {/* Add Promo Code Button */}
        <div className="flex justify-end">
          <Button className="w-full sm:w-auto" onClick={() => {
            setSelectedPromoCode(null);
            setFormData(initialFormData);
            setIsDialogOpen(true);
          }}>
            <Plus className="mr-2 h-4 w-4" />
            {t.admin.addPromoCode}
          </Button>
        </div>

        {/* Mobile Card View */}
        <div className="sm:hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : promoCodes && promoCodes.length > 0 ? (
            <MobileDataList>
              {promoCodes.map((promoCode) => (
                <MobileDataCard key={promoCode.id}>
                  <MobileDataHeader
                    title={
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-accent" />
                        <span className="font-mono font-semibold">{promoCode.code}</span>
                        {getStatusBadge(promoCode)}
                      </div>
                    }
                    actions={
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => toggleActiveMutation.mutate({ 
                            id: promoCode.id, 
                            is_active: !promoCode.is_active 
                          })}
                        >
                          {promoCode.is_active ? (
                            <ToggleRight className="h-4 w-4 text-green-500" />
                          ) : (
                            <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(promoCode)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(promoCode)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    }
                  />
                  {promoCode.description && (
                    <p className="text-sm text-muted-foreground">{promoCode.description}</p>
                  )}
                  <MobileDataRow label={t.admin.discountPercent}>
                    <span className="font-semibold text-green-600 dark:text-green-400">
                      {promoCode.discount_percentage}% off
                    </span>
                  </MobileDataRow>
                  <MobileDataRow label={t.admin.usage}>
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      {promoCode.current_uses}
                      {promoCode.max_uses ? ` / ${promoCode.max_uses}` : ''}
                    </div>
                  </MobileDataRow>
                  <MobileDataRow label={t.admin.validPeriod}>
                    <div className="flex items-center gap-1 text-sm">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      {format(new Date(promoCode.valid_from), 'MMM d')}
                      {promoCode.valid_until && (
                        <> - {format(new Date(promoCode.valid_until), 'MMM d')}</>
                      )}
                    </div>
                  </MobileDataRow>
                </MobileDataCard>
              ))}
            </MobileDataList>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Tag className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">{t.admin.noPromoCodesYet}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t.admin.createFirstPromo}
              </p>
              <Button 
                className="mt-4"
                onClick={() => {
                  setSelectedPromoCode(null);
                  setFormData(initialFormData);
                  setIsDialogOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                {t.admin.addPromoCode}
              </Button>
            </div>
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden sm:block rounded-lg border border-border bg-card">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : promoCodes && promoCodes.length > 0 ? (
            <Table>
              <TableHeader>
              <TableRow>
                  <TableHead>{t.admin.code}</TableHead>
                  <TableHead>{t.admin.discountPercent}</TableHead>
                  <TableHead>{t.admin.usage}</TableHead>
                  <TableHead>{t.admin.validPeriod}</TableHead>
                  <TableHead>{t.common.status}</TableHead>
                  <TableHead className="text-right">{t.common.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {promoCodes.map((promoCode) => (
                  <TableRow key={promoCode.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-accent" />
                        <span className="font-mono font-semibold">{promoCode.code}</span>
                      </div>
                      {promoCode.description && (
                        <p className="mt-1 text-xs text-muted-foreground">{promoCode.description}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold text-green-600 dark:text-green-400">
                        {promoCode.discount_percentage}% off
                      </span>
                      {promoCode.min_booking_amount > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Min: ${promoCode.min_booking_amount}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {promoCode.current_uses}
                          {promoCode.max_uses ? ` / ${promoCode.max_uses}` : ''}
                        </span>
                      </div>
                      {promoCode.max_uses_per_user && (
                        <p className="text-xs text-muted-foreground">
                          {promoCode.max_uses_per_user === 1 
                            ? '1 use per user' 
                            : `${promoCode.max_uses_per_user} uses per user`}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {format(new Date(promoCode.valid_from), 'MMM d, yyyy')}
                          {promoCode.valid_until && (
                            <> - {format(new Date(promoCode.valid_until), 'MMM d, yyyy')}</>
                          )}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(promoCode)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleActiveMutation.mutate({ 
                            id: promoCode.id, 
                            is_active: !promoCode.is_active 
                          })}
                           title={promoCode.is_active ? t.admin.deactivate : t.admin.activate}
                        >
                          {promoCode.is_active ? (
                            <ToggleRight className="h-4 w-4 text-green-500" />
                          ) : (
                            <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(promoCode)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(promoCode)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Tag className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">{t.admin.noPromoCodesYet}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t.admin.createFirstPromoDesktop}
              </p>
              <Button
                className="mt-4"
                onClick={() => {
                  setSelectedPromoCode(null);
                  setFormData(initialFormData);
                  setIsDialogOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                {t.admin.addPromoCode}
              </Button>
            </div>
          )}
        </div>

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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedPromoCode ? t.admin.editPromoCode : t.admin.createPromoCode}
            </DialogTitle>
            <DialogDescription>
              {selectedPromoCode 
                ? t.admin.updatePromoCodeDetails
                : t.admin.fillPromoDetails}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">{t.admin.code} *</Label>
              <Input
                id="code"
                placeholder="e.g., SUMMER20"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                className="uppercase"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t.common.description}</Label>
              <Input
                id="description"
                placeholder="e.g., Summer sale discount"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="discount">{t.admin.discountPercent} *</Label>
                <Input
                  id="discount"
                  type="number"
                  min="1"
                  max="100"
                  value={formData.discount_percentage}
                  onChange={(e) => setFormData({ ...formData, discount_percentage: Number(e.target.value) })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxUses">{t.admin.totalMaxUses}</Label>
                <Input
                  id="maxUses"
                  type="number"
                  min="1"
                  placeholder={t.admin.unlimited}
                  value={formData.max_uses ?? ''}
                  onChange={(e) => setFormData({ ...formData, max_uses: e.target.value ? Number(e.target.value) : null })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxUsesPerUser">{t.admin.usesPerUser}</Label>
              <Input
                id="maxUsesPerUser"
                type="number"
                min="1"
                max="10"
                placeholder={t.admin.unlimited}
                value={formData.max_uses_per_user ?? ''}
                onChange={(e) => setFormData({ ...formData, max_uses_per_user: e.target.value ? Number(e.target.value) : null })}
              />
              <p className="text-xs text-muted-foreground">
                {t.admin.usesPerUserHint}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="minAmount">{t.admin.minBookingAmount} ($)</Label>
              <Input
                id="minAmount"
                type="number"
                min="0"
                step="0.01"
                value={formData.min_booking_amount}
                onChange={(e) => setFormData({ ...formData, min_booking_amount: Number(e.target.value) })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="validFrom">{t.admin.validFrom} *</Label>
                <Input
                  id="validFrom"
                  type="datetime-local"
                  value={formData.valid_from}
                  onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="validUntil">{t.admin.validUntil}</Label>
                <Input
                  id="validUntil"
                  type="datetime-local"
                  value={formData.valid_until}
                  onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                {t.common.cancel}
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {selectedPromoCode ? t.admin.update : t.admin.create}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.admin.deletePromoCode}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.admin.deletePromoConfirm.replace('{code}', selectedPromoCode?.code || '')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedPromoCode && deleteMutation.mutate(selectedPromoCode.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}