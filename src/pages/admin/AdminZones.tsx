import { useState } from 'react';
import { useServerPagination } from '@/hooks/useServerPagination';
import { TablePagination } from '@/components/admin/TablePagination';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, MapPin } from 'lucide-react';
import {
  MobileDataCard, MobileDataRow, MobileDataHeader, MobileDataList,
} from '@/components/admin/MobileDataCard';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

interface Zone {
  id: string;
  name: string;
  description: string | null;
  multiplier: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

type ZoneFormData = Omit<Zone, 'id' | 'created_at' | 'updated_at'>;

const defaultFormData: ZoneFormData = {
  name: '',
  description: '',
  multiplier: 1.0,
  is_active: true,
};

export default function AdminZones() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const pagination = useServerPagination({ defaultPageSize: 10 });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [deletingZone, setDeletingZone] = useState<Zone | null>(null);
  const [formData, setFormData] = useState<ZoneFormData>(defaultFormData);

  const { data: zones, isLoading } = useQuery({
    queryKey: ['admin-zones', pagination.page, pagination.pageSize],
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from('zones')
        .select('*', { count: 'exact' })
        .order('name', { ascending: true })
        .range(pagination.rangeFrom, pagination.rangeTo);
      if (error) throw error;
      pagination.setTotalCount(count || 0);
      return data as Zone[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ZoneFormData) => {
      const { error } = await supabase.from('zones').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-zones'] });
      toast.success(t.admin.zoneCreated);
      closeForm();
    },
    onError: (error) => toast.error(t.admin.failedToCreateZone + ': ' + error.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ZoneFormData }) => {
      const { error } = await supabase.from('zones').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-zones'] });
      toast.success(t.admin.zoneUpdated);
      closeForm();
    },
    onError: (error) => toast.error(t.admin.failedToUpdateZone + ': ' + error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('zones').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-zones'] });
      toast.success(t.admin.zoneDeleted);
      setIsDeleteOpen(false);
      setDeletingZone(null);
    },
    onError: (error) => toast.error(t.admin.failedToDeleteZone + ': ' + error.message),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('zones').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-zones'] }),
    onError: (error) => toast.error(t.admin.failedToUpdateZone + ': ' + error.message),
  });

  const openCreateForm = () => {
    setEditingZone(null);
    setFormData(defaultFormData);
    setIsFormOpen(true);
  };

  const openEditForm = (zone: Zone) => {
    setEditingZone(zone);
    setFormData({
      name: zone.name,
      description: zone.description || '',
      multiplier: zone.multiplier,
      is_active: zone.is_active,
    });
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingZone(null);
    setFormData(defaultFormData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingZone) {
      updateMutation.mutate({ id: editingZone.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <AdminLayout
      title={t.admin.zones}
      description={t.admin.manageZones}
    >
      <div className="space-y-6">
        <div className="flex justify-end">
          <Button onClick={openCreateForm} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            {t.admin.addZone}
          </Button>
        </div>

        {/* Mobile Card View */}
        <div className="sm:hidden">
          <MobileDataList
            isLoading={isLoading}
            loadingText={t.admin.loadingZones}
            isEmpty={zones?.length === 0}
            emptyText={t.admin.noZonesFound}
          >
            {zones?.map((zone) => (
              <MobileDataCard key={zone.id}>
                <MobileDataHeader
                  title={
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      {zone.name}
                    </div>
                  }
                  actions={
                    <>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditForm(zone)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => { setDeletingZone(zone); setIsDeleteOpen(true); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  }
                />
                {zone.description && (
                  <p className="text-sm text-muted-foreground">{zone.description}</p>
                )}
                <MobileDataRow label={t.admin.multiplier}>
                  <Badge variant={zone.multiplier > 1 ? 'default' : 'secondary'}>
                    {zone.multiplier}x
                  </Badge>
                </MobileDataRow>
                <MobileDataRow label={t.admin.active}>
                  <Switch
                    checked={zone.is_active}
                    onCheckedChange={(checked) =>
                      toggleActiveMutation.mutate({ id: zone.id, is_active: checked })
                    }
                  />
                </MobileDataRow>
              </MobileDataCard>
            ))}
          </MobileDataList>
        </div>

        {/* Desktop Table View */}
        <div className="hidden sm:block rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.auth.fullName}</TableHead>
                <TableHead>{t.common.description}</TableHead>
                <TableHead className="text-right">{t.admin.multiplier}</TableHead>
                <TableHead className="text-center">{t.admin.active}</TableHead>
                <TableHead className="text-right">{t.common.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    {t.admin.loadingZones}
                  </TableCell>
                </TableRow>
              ) : zones?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    {t.admin.noZonesFound}
                  </TableCell>
                </TableRow>
              ) : (
                zones?.map((zone) => (
                  <TableRow key={zone.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary" />
                        {zone.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate">
                      {zone.description || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={zone.multiplier > 1 ? 'default' : 'secondary'}>
                        {zone.multiplier}x
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={zone.is_active}
                        onCheckedChange={(checked) =>
                          toggleActiveMutation.mutate({ id: zone.id, is_active: checked })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditForm(zone)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => { setDeletingZone(zone); setIsDeleteOpen(true); }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
        </div>

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingZone ? t.admin.editZone : t.admin.addNewZone}</DialogTitle>
              <DialogDescription>
                {editingZone ? t.admin.updateZoneDetails : t.admin.createNewZone}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t.auth.fullName}</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., City Center, Airport Area"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">{t.common.description}</Label>
                <Textarea
                  id="description"
                  value={formData.description || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder={t.common.description}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="multiplier">{t.admin.priceMultiplier}</Label>
                <Input
                  id="multiplier"
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="10"
                  value={formData.multiplier}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, multiplier: parseFloat(e.target.value) || 1 }))
                  }
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {t.admin.multiplierHint}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, is_active: checked }))}
                />
                <Label htmlFor="is_active">{t.admin.active}</Label>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeForm}>
                  {t.common.cancel}
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? t.common.saving : editingZone ? t.admin.updateZoneBtn : t.admin.createZoneBtn}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t.admin.deleteZone}</AlertDialogTitle>
              <AlertDialogDescription>
                {t.admin.deleteZoneConfirm.replace('{name}', deletingZone?.name || '')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deletingZone && deleteMutation.mutate(deletingZone.id)}
              >
                {t.common.delete}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout>
  );
}