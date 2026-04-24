import { useState, useEffect } from 'react';
import { useServerPagination } from '@/hooks/useServerPagination';
import { TablePagination } from '@/components/admin/TablePagination';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Pencil, Trash2, ArrowRight, Clock, Route as RouteIcon } from 'lucide-react';
import { toast } from 'sonner';
import {
  MobileDataCard,
  MobileDataRow,
  MobileDataHeader,
  MobileDataList,
} from '@/components/admin/MobileDataCard';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';

interface Zone {
  id: string;
  name: string;
}

interface Route {
  id: string;
  name: string;
  origin_zone_id: string | null;
  destination_zone_id: string | null;
  origin_name: string;
  destination_name: string;
  base_price: number;
  estimated_distance_km: number | null;
  estimated_duration_minutes: number | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

type RouteFormData = Omit<Route, 'id' | 'created_at' | 'updated_at'>;

const defaultFormData: RouteFormData = {
  name: '',
  origin_zone_id: null,
  destination_zone_id: null,
  origin_name: '',
  destination_name: '',
  base_price: 0,
  estimated_distance_km: null,
  estimated_duration_minutes: null,
  is_active: true,
  sort_order: 0,
};

export default function AdminRoutes() {
  const queryClient = useQueryClient();
  const { formatPrice } = useSystemSettings();
  const { t } = useLanguage();
  const pagination = useServerPagination({ defaultPageSize: 10 });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [deletingRoute, setDeletingRoute] = useState<Route | null>(null);
  const [formData, setFormData] = useState<RouteFormData>(defaultFormData);

  const { data: routes, isLoading } = useQuery({
    queryKey: ['admin-routes', pagination.page, pagination.pageSize],
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from('routes')
        .select('*', { count: 'exact' })
        .order('sort_order', { ascending: true })
        .range(pagination.rangeFrom, pagination.rangeTo);
      if (error) throw error;
      pagination.setTotalCount(count || 0);
      return data as Route[];
    },
  });

  const { data: zones } = useQuery({
    queryKey: ['admin-zones-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zones')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as Zone[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: RouteFormData) => {
      const { error } = await supabase.from('routes').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-routes'] });
      toast.success(t.admin.routeCreated);
      closeForm();
    },
    onError: (error) => toast.error(t.admin.failedToCreateRoute + ': ' + error.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: RouteFormData }) => {
      const { error } = await supabase.from('routes').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-routes'] });
      toast.success(t.admin.routeUpdated);
      closeForm();
    },
    onError: (error) => toast.error(t.admin.failedToUpdateRoute + ': ' + error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('routes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-routes'] });
      toast.success(t.admin.routeDeleted);
      setIsDeleteOpen(false);
      setDeletingRoute(null);
    },
    onError: (error) => toast.error(t.admin.failedToDeleteRoute + ': ' + error.message),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('routes').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-routes'] }),
    onError: (error) => toast.error(t.admin.failedToUpdateRoute + ': ' + error.message),
  });

  const openCreateForm = () => {
    setEditingRoute(null);
    setFormData(defaultFormData);
    setIsFormOpen(true);
  };

  const openEditForm = (route: Route) => {
    setEditingRoute(route);
    setFormData({
      name: route.name,
      origin_zone_id: route.origin_zone_id,
      destination_zone_id: route.destination_zone_id,
      origin_name: route.origin_name,
      destination_name: route.destination_name,
      base_price: route.base_price,
      estimated_distance_km: route.estimated_distance_km,
      estimated_duration_minutes: route.estimated_duration_minutes,
      is_active: route.is_active,
      sort_order: route.sort_order,
    });
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingRoute(null);
    setFormData(defaultFormData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRoute) {
      updateMutation.mutate({ id: editingRoute.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <AdminLayout
      title={t.admin.routes}
      description={t.admin.defineRoutes}
    >
      <div className="space-y-6">
        {/* Add Route Button */}
        <div className="flex justify-end">
          <Button onClick={openCreateForm} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            {t.admin.addRoute}
          </Button>
        </div>

        {/* Mobile Card View */}
        <div className="sm:hidden">
          <MobileDataList
            isLoading={isLoading}
            loadingText={t.admin.loadingRoutes}
            isEmpty={routes?.length === 0}
            emptyText={t.admin.noRoutesFound}
          >
            {routes?.map((route) => (
              <MobileDataCard key={route.id}>
                <MobileDataHeader
                  title={
                    <div className="flex items-center gap-2">
                      <RouteIcon className="h-4 w-4 text-primary" />
                      {route.name}
                    </div>
                  }
                  actions={
                    <>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditForm(route)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => {
                          setDeletingRoute(route);
                          setIsDeleteOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  }
                />
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="truncate">{route.origin_name}</span>
                  <ArrowRight className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{route.destination_name}</span>
                </div>
                <MobileDataRow label={t.common.price}>
                  <span className="font-medium">{formatPrice(Number(route.base_price))}</span>
                </MobileDataRow>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  {route.estimated_distance_km && (
                    <span>{route.estimated_distance_km} km</span>
                  )}
                  {route.estimated_duration_minutes && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {route.estimated_duration_minutes} min
                    </div>
                  )}
                </div>
                <MobileDataRow label={t.admin.active}>
                  <Switch
                    checked={route.is_active}
                    onCheckedChange={(checked) =>
                      toggleActiveMutation.mutate({ id: route.id, is_active: checked })
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
                <TableHead>{t.admin.routeName}</TableHead>
                <TableHead>{t.admin.originDestination}</TableHead>
                <TableHead className="text-right">{t.common.price}</TableHead>
                <TableHead className="text-center">{t.admin.distance}</TableHead>
                <TableHead className="text-center">{t.admin.duration}</TableHead>
                <TableHead className="text-center">{t.admin.active}</TableHead>
                <TableHead className="text-right">{t.common.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {t.admin.loadingRoutes}
                  </TableCell>
                </TableRow>
              ) : routes?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {t.admin.noRoutesFound}
                  </TableCell>
                </TableRow>
              ) : (
                routes?.map((route) => (
                  <TableRow key={route.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <RouteIcon className="h-4 w-4 text-primary" />
                        {route.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="truncate max-w-[100px]">{route.origin_name}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <span className="truncate max-w-[100px]">{route.destination_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatPrice(Number(route.base_price))}
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {route.estimated_distance_km ? `${route.estimated_distance_km} km` : '-'}
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {route.estimated_duration_minutes ? (
                        <div className="flex items-center justify-center gap-1">
                          <Clock className="h-3 w-3" />
                          {route.estimated_duration_minutes} min
                        </div>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={route.is_active}
                        onCheckedChange={(checked) =>
                          toggleActiveMutation.mutate({ id: route.id, is_active: checked })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditForm(route)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            setDeletingRoute(route);
                            setIsDeleteOpen(true);
                          }}
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
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingRoute ? t.admin.editRoute : t.admin.addNewRoute}</DialogTitle>
              <DialogDescription>
                {editingRoute ? t.admin.updateRouteDetails : t.admin.createNewRoute}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t.admin.routeName}</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Airport Transfer"
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="origin_name">{t.admin.origin}</Label>
                  <Input
                    id="origin_name"
                    value={formData.origin_name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, origin_name: e.target.value }))}
                    placeholder="e.g., JFK Airport"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="destination_name">{t.admin.destination}</Label>
                  <Input
                    id="destination_name"
                    value={formData.destination_name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, destination_name: e.target.value }))}
                    placeholder="e.g., Manhattan"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="origin_zone">{t.admin.originZone}</Label>
                  <Select
                    value={formData.origin_zone_id || 'none'}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, origin_zone_id: value === 'none' ? null : value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t.admin.selectZone} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t.admin.noZone}</SelectItem>
                      {zones?.map((zone) => (
                        <SelectItem key={zone.id} value={zone.id}>
                          {zone.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="destination_zone">{t.admin.destinationZone}</Label>
                  <Select
                    value={formData.destination_zone_id || 'none'}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, destination_zone_id: value === 'none' ? null : value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t.admin.selectZone} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t.admin.noZone}</SelectItem>
                      {zones?.map((zone) => (
                        <SelectItem key={zone.id} value={zone.id}>
                          {zone.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="base_price">{t.admin.basePrice} ($)</Label>
                  <Input
                    id="base_price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.base_price}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, base_price: parseFloat(e.target.value) || 0 }))
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="distance">{t.admin.distance} (km)</Label>
                  <Input
                    id="distance"
                    type="number"
                    step="0.1"
                    min="0"
                    value={formData.estimated_distance_km || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        estimated_distance_km: e.target.value ? parseFloat(e.target.value) : null,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duration">{t.admin.duration} (min)</Label>
                  <Input
                    id="duration"
                    type="number"
                    min="0"
                    value={formData.estimated_duration_minutes || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        estimated_duration_minutes: e.target.value ? parseInt(e.target.value) : null,
                      }))
                    }
                  />
                </div>
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
                  {isSubmitting ? t.common.saving : editingRoute ? t.admin.updateRoute : t.admin.createRoute}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t.admin.deleteRoute}</AlertDialogTitle>
              <AlertDialogDescription>
                {t.admin.deleteRouteConfirm.replace('{name}', deletingRoute?.name || '')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deletingRoute && deleteMutation.mutate(deletingRoute.id)}
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
