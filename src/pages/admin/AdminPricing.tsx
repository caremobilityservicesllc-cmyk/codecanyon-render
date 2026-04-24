import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Plus, Pencil, Trash2, Clock, MapPin, Car, Ruler, Calculator } from 'lucide-react';
import { toast } from 'sonner';
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

type RuleType = 'time' | 'distance' | 'zone' | 'vehicle';
type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

interface PricingRule {
  id: string;
  name: string;
  description: string | null;
  rule_type: RuleType;
  start_time: string | null;
  end_time: string | null;
  days_of_week: DayOfWeek[] | null;
  min_distance_km: number | null;
  max_distance_km: number | null;
  zone_id: string | null;
  vehicle_id: string | null;
  vehicle_category: string | null;
  multiplier: number;
  flat_fee: number;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Zone {
  id: string;
  name: string;
}

interface Vehicle {
  id: string;
  name: string;
  category: string;
}

type PricingRuleFormData = Omit<PricingRule, 'id' | 'created_at' | 'updated_at'>;

const defaultFormData: PricingRuleFormData = {
  name: '',
  description: '',
  rule_type: 'time',
  start_time: null,
  end_time: null,
  days_of_week: null,
  min_distance_km: null,
  max_distance_km: null,
  zone_id: null,
  vehicle_id: null,
  vehicle_category: null,
  multiplier: 1.0,
  flat_fee: 0,
  priority: 0,
  is_active: true,
};

const daysOfWeek: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const vehicleCategories = ['Luxury', 'Van', 'SUV', 'Business', 'Comfort', 'Economy'];

const ruleTypeIcons: Record<RuleType, typeof Clock> = {
  time: Clock,
  distance: Ruler,
  zone: MapPin,
  vehicle: Car,
};

const getRuleTypeLabel = (type: RuleType, t: any) => {
  const labels: Record<RuleType, string> = {
    time: t.admin.timeBased,
    distance: t.admin.distanceBased,
    zone: t.admin.zoneBased,
    vehicle: t.admin.vehicleBased,
  };
  return labels[type];
};

export default function AdminPricing() {
  const { formatPrice } = useSystemSettings();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<PricingRule | null>(null);
  const [deletingRule, setDeletingRule] = useState<PricingRule | null>(null);
  const [formData, setFormData] = useState<PricingRuleFormData>(defaultFormData);
  const pagination = useServerPagination({ defaultPageSize: 10 });

  const { data: rules, isLoading } = useQuery({
    queryKey: ['admin-pricing-rules', pagination.page, pagination.pageSize],
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from('pricing_rules')
        .select('*', { count: 'exact' })
        .order('priority', { ascending: false })
        .range(pagination.rangeFrom, pagination.rangeTo);
      if (error) throw error;
      if (count !== null) pagination.setTotalCount(count);
      return data as PricingRule[];
    },
  });

  const { data: zones } = useQuery({
    queryKey: ['admin-zones-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('zones').select('id, name').eq('is_active', true);
      if (error) throw error;
      return data as Zone[];
    },
  });

  const { data: vehicles } = useQuery({
    queryKey: ['admin-vehicles-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vehicles').select('id, name, category').eq('is_active', true);
      if (error) throw error;
      return data as Vehicle[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: PricingRuleFormData) => {
      const { error } = await supabase.from('pricing_rules').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pricing-rules'] });
      toast.success(t.adminPricingToasts.ruleCreated);
      closeForm();
    },
    onError: (error) => toast.error(t.adminPricingToasts.failedToCreateRule + ': ' + error.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: PricingRuleFormData }) => {
      const { error } = await supabase.from('pricing_rules').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pricing-rules'] });
      toast.success(t.adminPricingToasts.ruleUpdated);
      closeForm();
    },
    onError: (error) => toast.error(t.adminPricingToasts.failedToUpdateRule + ': ' + error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('pricing_rules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pricing-rules'] });
      toast.success(t.adminPricingToasts.ruleDeleted);
      setIsDeleteOpen(false);
      setDeletingRule(null);
    },
    onError: (error) => toast.error(t.adminPricingToasts.failedToDeleteRule + ': ' + error.message),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('pricing_rules').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-pricing-rules'] }),
    onError: (error) => toast.error(t.adminPricingToasts.failedToUpdateRule + ': ' + error.message),
  });

  const openCreateForm = () => {
    setEditingRule(null);
    setFormData(defaultFormData);
    setIsFormOpen(true);
  };

  const openEditForm = (rule: PricingRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      description: rule.description || '',
      rule_type: rule.rule_type,
      start_time: rule.start_time,
      end_time: rule.end_time,
      days_of_week: rule.days_of_week,
      min_distance_km: rule.min_distance_km,
      max_distance_km: rule.max_distance_km,
      zone_id: rule.zone_id,
      vehicle_id: rule.vehicle_id,
      vehicle_category: rule.vehicle_category,
      multiplier: rule.multiplier,
      flat_fee: rule.flat_fee,
      priority: rule.priority,
      is_active: rule.is_active,
    });
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingRule(null);
    setFormData(defaultFormData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRule) {
      updateMutation.mutate({ id: editingRule.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const toggleDay = (day: DayOfWeek) => {
    const current = formData.days_of_week || [];
    if (current.includes(day)) {
      setFormData((prev) => ({ ...prev, days_of_week: current.filter((d) => d !== day) }));
    } else {
      setFormData((prev) => ({ ...prev, days_of_week: [...current, day] }));
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const getRuleDescription = (rule: PricingRule) => {
    switch (rule.rule_type) {
      case 'time':
        const days = rule.days_of_week?.map((d) => d.slice(0, 3)).join(', ') || 'All days';
        return `${rule.start_time || '00:00'} - ${rule.end_time || '23:59'} (${days})`;
      case 'distance':
        return `${rule.min_distance_km || 0} - ${rule.max_distance_km || '∞'} km`;
      case 'zone':
        const zone = zones?.find((z) => z.id === rule.zone_id);
        return zone?.name || 'Unknown zone';
      case 'vehicle':
        const vehicle = vehicles?.find((v) => v.id === rule.vehicle_id);
        return vehicle?.name || rule.vehicle_category || 'All vehicles';
      default:
        return '-';
    }
  };

  return (
    <AdminLayout
      title={t.admin.pricingRules}
      description={t.admin.configurePricing}
    >
      <div className="space-y-6">
        {/* Add Rule Button */}
        <div className="flex justify-end">
          <Button onClick={openCreateForm} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            {t.admin.addRule}
          </Button>
        </div>

        {/* Mobile Card View */}
        <div className="sm:hidden">
          <MobileDataList
            isLoading={isLoading}
            loadingText={t.admin.loadingPricingRules}
            isEmpty={rules?.length === 0}
            emptyText={t.admin.noPricingRulesFound}
          >
            {rules?.map((rule) => {
              const Icon = ruleTypeIcons[rule.rule_type];
              return (
                <MobileDataCard key={rule.id}>
                  <MobileDataHeader
                    title={
                      <div className="flex items-center gap-2">
                        <Calculator className="h-4 w-4 text-primary" />
                        {rule.name}
                      </div>
                    }
                    actions={
                      <>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditForm(rule)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => {
                            setDeletingRule(rule);
                            setIsDeleteOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    }
                  />
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="flex items-center gap-1 w-fit">
                      <Icon className="h-3 w-3" />
                      {getRuleTypeLabel(rule.rule_type, t)}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{getRuleDescription(rule)}</p>
                  <div className="flex items-center gap-3">
                    <MobileDataRow label={t.admin.multiplier}>
                      <Badge variant={rule.multiplier > 1 ? 'default' : rule.multiplier < 1 ? 'secondary' : 'outline'}>
                        {rule.multiplier}x
                      </Badge>
                    </MobileDataRow>
                    {rule.flat_fee > 0 && (
                      <MobileDataRow label={t.admin.flatFee}>
                        +{formatPrice(Number(rule.flat_fee))}
                      </MobileDataRow>
                    )}
                  </div>
                  <MobileDataRow label={t.admin.priority}>
                    <Badge variant="outline">{rule.priority}</Badge>
                  </MobileDataRow>
                  <MobileDataRow label={t.status.active}>
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={(checked) =>
                        toggleActiveMutation.mutate({ id: rule.id, is_active: checked })
                      }
                    />
                  </MobileDataRow>
                </MobileDataCard>
              );
            })}
          </MobileDataList>
        </div>

        {/* Desktop Table View */}
        <div className="hidden sm:block rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.admin.ruleName}</TableHead>
                <TableHead>{t.admin.ruleType}</TableHead>
                <TableHead>{t.admin.condition}</TableHead>
                <TableHead className="text-right">{t.admin.multiplier}</TableHead>
                <TableHead className="text-right">{t.admin.flatFee}</TableHead>
                <TableHead className="text-center">{t.admin.priority}</TableHead>
                <TableHead className="text-center">{t.status.active}</TableHead>
                <TableHead className="text-right">{t.common.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    {t.admin.loadingPricingRules}
                  </TableCell>
                </TableRow>
              ) : rules?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    {t.admin.noPricingRulesFound}
                  </TableCell>
                </TableRow>
              ) : (
                rules?.map((rule) => {
                  const Icon = ruleTypeIcons[rule.rule_type];
                  return (
                    <TableRow key={rule.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Calculator className="h-4 w-4 text-primary" />
                          {rule.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="flex items-center gap-1 w-fit">
                          <Icon className="h-3 w-3" />
                          {getRuleTypeLabel(rule.rule_type, t)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {getRuleDescription(rule)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={rule.multiplier > 1 ? 'default' : rule.multiplier < 1 ? 'secondary' : 'outline'}>
                          {rule.multiplier}x
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {rule.flat_fee > 0 ? `+${formatPrice(Number(rule.flat_fee))}` : '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{rule.priority}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={rule.is_active}
                          onCheckedChange={(checked) =>
                            toggleActiveMutation.mutate({ id: rule.id, is_active: checked })
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openEditForm(rule)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              setDeletingRule(rule);
                              setIsDeleteOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
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

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingRule ? t.admin.editPricingRule : t.admin.addNewPricingRule}</DialogTitle>
              <DialogDescription>
                {editingRule ? t.admin.updatePricingRuleDetails : t.admin.createNewPricingRule}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t.admin.ruleName}</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Peak Hour Surcharge"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{t.common.description}</Label>
                <Textarea
                  id="description"
                  value={formData.description || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder={(t as any).placeholders?.optionalDescription || "Optional description"}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>{t.admin.ruleType}</Label>
                <Select
                  value={formData.rule_type}
                  onValueChange={(value: RuleType) => setFormData((prev) => ({ ...prev, rule_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="time">{t.admin.timeBasedDesc}</SelectItem>
                    <SelectItem value="distance">{t.admin.distanceBasedDesc}</SelectItem>
                    <SelectItem value="zone">{t.admin.zoneBasedDesc}</SelectItem>
                    <SelectItem value="vehicle">{t.admin.vehicleBasedDesc}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Time-based fields */}
              {formData.rule_type === 'time' && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="start_time">{t.admin.startTime}</Label>
                      <Input
                        id="start_time"
                        type="time"
                        value={formData.start_time || ''}
                        onChange={(e) => setFormData((prev) => ({ ...prev, start_time: e.target.value || null }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="end_time">{t.admin.endTime}</Label>
                      <Input
                        id="end_time"
                        type="time"
                        value={formData.end_time || ''}
                        onChange={(e) => setFormData((prev) => ({ ...prev, end_time: e.target.value || null }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>{t.admin.daysOfWeek}</Label>
                    <div className="flex flex-wrap gap-2">
                      {daysOfWeek.map((day) => (
                        <Badge
                          key={day}
                          variant={formData.days_of_week?.includes(day) ? 'default' : 'outline'}
                          className="cursor-pointer capitalize"
                          onClick={() => toggleDay(day)}
                        >
                          {day.slice(0, 3)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Distance-based fields */}
              {formData.rule_type === 'distance' && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="min_distance">{t.admin.minDistance}</Label>
                    <Input
                      id="min_distance"
                      type="number"
                      step="0.1"
                      min="0"
                      value={formData.min_distance_km ?? ''}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          min_distance_km: e.target.value ? parseFloat(e.target.value) : null,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max_distance">{t.admin.maxDistance}</Label>
                    <Input
                      id="max_distance"
                      type="number"
                      step="0.1"
                      min="0"
                      value={formData.max_distance_km ?? ''}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          max_distance_km: e.target.value ? parseFloat(e.target.value) : null,
                        }))
                      }
                    />
                  </div>
                </div>
              )}

              {/* Zone-based fields */}
              {formData.rule_type === 'zone' && (
                <div className="space-y-2">
                  <Label>{t.admin.zone}</Label>
                  <Select
                    value={formData.zone_id || 'none'}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, zone_id: value === 'none' ? null : value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t.admin.selectAZone} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t.admin.selectAZone}</SelectItem>
                      {zones?.map((zone) => (
                        <SelectItem key={zone.id} value={zone.id}>
                          {zone.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Vehicle-based fields */}
              {formData.rule_type === 'vehicle' && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t.admin.specificVehicle}</Label>
                    <Select
                      value={formData.vehicle_id || 'none'}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, vehicle_id: value === 'none' ? null : value }))
                      }
                    >
                      <SelectTrigger>
                      <SelectValue placeholder={t.admin.anyVehicle} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t.admin.anyVehicle}</SelectItem>
                        {vehicles?.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t.admin.orCategory}</Label>
                    <Select
                      value={formData.vehicle_category || 'none'}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, vehicle_category: value === 'none' ? null : value }))
                      }
                    >
                      <SelectTrigger>
                      <SelectValue placeholder={t.admin.anyCategory} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t.admin.anyCategory}</SelectItem>
                        {vehicleCategories.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="multiplier">{t.admin.multiplier}</Label>
                  <Input
                    id="multiplier"
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={formData.multiplier}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, multiplier: parseFloat(e.target.value) || 1 }))
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="flat_fee">{t.admin.flatFeeDollar}</Label>
                  <Input
                    id="flat_fee"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.flat_fee}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, flat_fee: parseFloat(e.target.value) || 0 }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority">{t.admin.priority}</Label>
                  <Input
                    id="priority"
                    type="number"
                    min="0"
                    value={formData.priority}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, priority: parseInt(e.target.value) || 0 }))
                    }
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {t.admin.priorityHint}
              </p>

              <div className="flex items-center gap-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, is_active: checked }))}
                />
                <Label htmlFor="is_active">{t.status.active}</Label>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeForm}>
                  {t.common.cancel}
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? t.admin.savingRule : editingRule ? t.admin.updateRule : t.admin.createRule}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t.admin.deletePricingRule}</AlertDialogTitle>
              <AlertDialogDescription>
                {t.admin.deletePricingRuleConfirm.replace('{name}', deletingRule?.name || '')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deletingRule && deleteMutation.mutate(deletingRule.id)}
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
