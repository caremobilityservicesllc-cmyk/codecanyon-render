import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useServerPagination } from '@/hooks/useServerPagination';
import { TablePagination } from '@/components/admin/TablePagination';
import { supabase } from '@/integrations/supabase/client';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { AdminLayout } from '@/components/admin/AdminLayout';
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
import { Plus, Pencil, Trash2, Users, Briefcase, Car, Upload, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  MobileDataCard,
  MobileDataRow,
  MobileDataHeader,
  MobileDataList,
} from '@/components/admin/MobileDataCard';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';

interface Vehicle {
  id: string;
  name: string;
  category: string;
  passengers: number;
  luggage: number;
  image: string | null;
  features: string[];
  price_per_km: number;
  base_price: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

type VehicleFormData = Omit<Vehicle, 'id' | 'created_at' | 'updated_at'> & {
  hourly_rate: number;
  min_hours: number;
  max_hours: number;
};

const categories = ['Ambulance', 'Luxury', 'Van', 'SUV', 'Business', 'Comfort', 'Economy'];

const defaultFormData: VehicleFormData = {
  name: '',
  category: 'Comfort',
  passengers: 4,
  luggage: 2,
  image: '',
  features: [],
  price_per_km: 0,
  base_price: 0,
  hourly_rate: 0,
  min_hours: 2,
  max_hours: 12,
  is_active: true,
  sort_order: 0,
};

export default function AdminVehicles() {
  const queryClient = useQueryClient();
  const { formatPrice, currency } = useSystemSettings();
  const { t } = useLanguage();
  const sym = currency.symbol;
  const pagination = useServerPagination({ defaultPageSize: 10 });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [deletingVehicle, setDeletingVehicle] = useState<Vehicle | null>(null);
  const [formData, setFormData] = useState<VehicleFormData>(defaultFormData);
  const [featureInput, setFeatureInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload image to storage
  const uploadImage = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `vehicles/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('vehicle-images')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from('vehicle-images')
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error(t.admin.selectImageFile);
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t.admin.imageTooLarge);
      return;
    }

    setIsUploading(true);
    try {
      const url = await uploadImage(file);
      setFormData((prev) => ({ ...prev, image: url }));
      setImagePreview(url);
      toast.success(t.admin.imageUploaded);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(t.admin.failedToUpload);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeImage = () => {
    setFormData((prev) => ({ ...prev, image: '' }));
    setImagePreview(null);
  };
  // Fetch vehicles
  const { data: vehiclesData, isLoading } = useQuery({
    queryKey: ['admin-vehicles', pagination.page, pagination.pageSize],
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from('vehicles')
        .select('*', { count: 'exact' })
        .order('sort_order', { ascending: true })
        .range(pagination.rangeFrom, pagination.rangeTo);
      
      if (error) throw error;
      pagination.setTotalCount(count || 0);
      return data as Vehicle[];
    },
  });

  const vehicles = vehiclesData;

  // Create vehicle mutation
  const createMutation = useMutation({
    mutationFn: async (data: VehicleFormData) => {
      const { error } = await supabase.from('vehicles').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-vehicles'] });
      toast.success(t.admin.vehicleCreated);
      closeForm();
    },
    onError: (error) => {
      toast.error(t.admin.failedToCreateVehicle + ': ' + error.message);
    },
  });

  // Update vehicle mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: VehicleFormData }) => {
      const { error } = await supabase.from('vehicles').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-vehicles'] });
      toast.success(t.admin.vehicleUpdated);
      closeForm();
    },
    onError: (error) => {
      toast.error(t.admin.failedToUpdateVehicle + ': ' + error.message);
    },
  });

  // Delete vehicle mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('vehicles').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-vehicles'] });
      toast.success(t.admin.vehicleDeleted);
      setIsDeleteOpen(false);
      setDeletingVehicle(null);
    },
    onError: (error) => {
      toast.error(t.admin.failedToDeleteVehicle + ': ' + error.message);
    },
  });

  // Toggle active status
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('vehicles').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-vehicles'] });
    },
    onError: (error) => {
      toast.error(t.admin.failedToUpdateVehicle + ': ' + error.message);
    },
  });

  const openCreateForm = () => {
    setEditingVehicle(null);
    setFormData(defaultFormData);
    setFeatureInput('');
    setImagePreview(null);
    setIsFormOpen(true);
  };

  const openEditForm = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setFormData({
      name: vehicle.name,
      category: vehicle.category,
      passengers: vehicle.passengers,
      luggage: vehicle.luggage,
      image: vehicle.image || '',
      features: vehicle.features || [],
      price_per_km: vehicle.price_per_km,
      base_price: vehicle.base_price,
      hourly_rate: (vehicle as any).hourly_rate || 0,
      min_hours: (vehicle as any).min_hours || 2,
      max_hours: (vehicle as any).max_hours || 12,
      is_active: vehicle.is_active,
      sort_order: vehicle.sort_order,
    });
    setFeatureInput('');
    setImagePreview(vehicle.image || null);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingVehicle(null);
    setFormData(defaultFormData);
    setFeatureInput('');
    setImagePreview(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingVehicle) {
      updateMutation.mutate({ id: editingVehicle.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const addFeature = () => {
    if (featureInput.trim() && !formData.features.includes(featureInput.trim())) {
      setFormData((prev) => ({
        ...prev,
        features: [...prev.features, featureInput.trim()],
      }));
      setFeatureInput('');
    }
  };

  const removeFeature = (feature: string) => {
    setFormData((prev) => ({
      ...prev,
      features: prev.features.filter((f) => f !== feature),
    }));
  };

  const confirmDelete = (vehicle: Vehicle) => {
    setDeletingVehicle(vehicle);
    setIsDeleteOpen(true);
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <AdminLayout
      title={t.admin.vehicles}
      description={t.admin.manageVehicles}
    >
      <div className="space-y-6">
        {/* Add Vehicle Button */}
        <div className="flex justify-end">
          <Button onClick={openCreateForm} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            {t.admin.addVehicle}
          </Button>
        </div>

        {/* Mobile Card View */}
        <div className="sm:hidden">
          <MobileDataList
            isLoading={isLoading}
            loadingText={t.admin.loadingVehicles}
            isEmpty={vehicles?.length === 0}
            emptyText={t.admin.noVehiclesFound}
          >
            {vehicles?.map((vehicle) => (
              <MobileDataCard key={vehicle.id}>
                <MobileDataHeader
                  title={
                    <div className="flex items-center gap-3">
                      {vehicle.image ? (
                        <img
                          src={vehicle.image}
                          alt={vehicle.name}
                          className="h-10 w-14 rounded object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-14 items-center justify-center rounded bg-muted">
                          <Car className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <div className="font-medium">{vehicle.name}</div>
                        <Badge variant="outline" className="text-xs">{vehicle.category}</Badge>
                      </div>
                    </div>
                  }
                  actions={
                    <>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditForm(vehicle)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => confirmDelete(vehicle)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  }
                />
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {vehicle.passengers}
                  </div>
                  <div className="flex items-center gap-1">
                    <Briefcase className="h-4 w-4" />
                    {vehicle.luggage}
                  </div>
                </div>
                <MobileDataRow label={t.admin.basePrice}>
                  {formatPrice(Number(vehicle.base_price))}
                </MobileDataRow>
                <MobileDataRow label={t.admin.perKm}>
                  {formatPrice(Number(vehicle.price_per_km))}
                </MobileDataRow>
                <MobileDataRow label={t.admin.active}>
                  <Switch
                    checked={vehicle.is_active}
                    onCheckedChange={(checked) =>
                      toggleActiveMutation.mutate({ id: vehicle.id, is_active: checked })
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
                <TableHead className="w-[80px]">{t.admin.image}</TableHead>
                <TableHead>{t.common.name}</TableHead>
                <TableHead>{t.admin.category}</TableHead>
                <TableHead className="text-center">{t.booking.passengers}</TableHead>
                <TableHead className="text-center">{t.booking.luggage}</TableHead>
                <TableHead className="text-right">{t.admin.basePrice}</TableHead>
                <TableHead className="text-right">{t.admin.perKm}</TableHead>
                <TableHead className="text-center">{t.admin.active}</TableHead>
                <TableHead className="text-right">{t.common.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    {t.admin.loadingVehicles}
                  </TableCell>
                </TableRow>
              ) : vehicles?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    {t.admin.noVehiclesFound}
                  </TableCell>
                </TableRow>
              ) : (
                vehicles?.map((vehicle) => (
                  <TableRow key={vehicle.id}>
                    <TableCell>
                      {vehicle.image ? (
                        <img
                          src={vehicle.image}
                          alt={vehicle.name}
                          className="h-12 w-16 rounded object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-16 items-center justify-center rounded bg-muted">
                          <Car className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{vehicle.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{vehicle.category}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {vehicle.passengers}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                        {vehicle.luggage}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatPrice(Number(vehicle.base_price))}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatPrice(Number(vehicle.price_per_km))}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={vehicle.is_active}
                        onCheckedChange={(checked) =>
                          toggleActiveMutation.mutate({ id: vehicle.id, is_active: checked })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditForm(vehicle)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => confirmDelete(vehicle)}
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
        {/* Create/Edit Dialog */}
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingVehicle ? t.admin.editVehicle : t.admin.addNewVehicle}
              </DialogTitle>
              <DialogDescription>
                {editingVehicle
                  ? t.admin.updateVehicleDetails
                  : t.admin.fillVehicleDetails}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">{t.common.name}</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="e.g., Business Class"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">{t.admin.category}</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, category: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t.admin.selectCategory} />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="passengers">{t.booking.passengers}</Label>
                  <Input
                    id="passengers"
                    type="number"
                    min={1}
                    max={20}
                    value={formData.passengers}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        passengers: parseInt(e.target.value) || 1,
                      }))
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="luggage">{t.booking.luggage}</Label>
                  <Input
                    id="luggage"
                    type="number"
                    min={0}
                    max={20}
                    value={formData.luggage}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        luggage: parseInt(e.target.value) || 0,
                      }))
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="base_price">{t.admin.basePrice} ({sym})</Label>
                  <Input
                    id="base_price"
                    type="number"
                    step="0.01"
                    min={0}
                    value={formData.base_price}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        base_price: parseFloat(e.target.value) || 0,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="price_per_km">{t.admin.perKm} ({sym})</Label>
                  <Input
                    id="price_per_km"
                    type="number"
                    step="0.01"
                    min={0}
                    value={formData.price_per_km}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        price_per_km: parseFloat(e.target.value) || 0,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="hourly_rate">{t.admin.hourlyRate} ({sym})</Label>
                  <Input
                    id="hourly_rate"
                    type="number"
                    step="0.01"
                    min={0}
                    value={formData.hourly_rate}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        hourly_rate: parseFloat(e.target.value) || 0,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="min_hours">{t.admin.minHours}</Label>
                  <Input
                    id="min_hours"
                    type="number"
                    min={1}
                    value={formData.min_hours}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        min_hours: parseInt(e.target.value) || 1,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max_hours">{t.admin.maxHours}</Label>
                  <Input
                    id="max_hours"
                    type="number"
                    min={1}
                    value={formData.max_hours}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        max_hours: parseInt(e.target.value) || 1,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sort_order">{t.admin.sortOrder}</Label>
                  <Input
                    id="sort_order"
                    type="number"
                    min={0}
                    value={formData.sort_order}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        sort_order: parseInt(e.target.value) || 0,
                      }))
                    }
                  />
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({ ...prev, is_active: checked }))
                    }
                  />
                  <Label htmlFor="is_active">{t.admin.active}</Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t.admin.vehicleImage}</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                
                {imagePreview || formData.image ? (
                  <div className="relative w-full h-40 rounded-lg overflow-hidden bg-muted">
                    <img
                      src={imagePreview || formData.image || ''}
                      alt="Vehicle preview"
                      className="w-full h-full object-cover"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-8 w-8"
                      onClick={removeImage}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div
                    onClick={() => !isUploading && fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:border-primary/50 transition-colors"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
                        <p className="mt-2 text-sm text-muted-foreground">{t.admin.uploading}</p>
                      </>
                    ) : (
                      <>
                        <Upload className="h-8 w-8 text-muted-foreground" />
                        <p className="mt-2 text-sm text-muted-foreground">{t.admin.uploadImage}</p>
                        <p className="text-xs text-muted-foreground">{t.admin.maxFileSize}</p>
                      </>
                    )}
                  </div>
                )}
                
                <p className="text-xs text-muted-foreground">
                  {t.admin.orEnterUrl}
                </p>
                <Input
                  id="image"
                  type="url"
                  value={formData.image || ''}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, image: e.target.value }));
                    setImagePreview(e.target.value || null);
                  }}
                  placeholder="https://example.com/image.jpg"
                />
              </div>

              <div className="space-y-2">
                <Label>{t.admin.features}</Label>
                <div className="flex gap-2">
                  <Input
                    value={featureInput}
                    onChange={(e) => setFeatureInput(e.target.value)}
                    placeholder={t.admin.addFeature}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addFeature();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" onClick={addFeature}>
                    {t.admin.add}
                  </Button>
                </div>
                {formData.features.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.features.map((feature) => (
                      <Badge
                        key={feature}
                        variant="secondary"
                        className="cursor-pointer"
                        onClick={() => removeFeature(feature)}
                      >
                        {feature} ×
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeForm}>
                  {t.common.cancel}
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting
                    ? t.common.saving
                    : editingVehicle
                    ? t.admin.updateVehicle
                    : t.admin.createVehicle}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t.admin.deleteVehicle}</AlertDialogTitle>
              <AlertDialogDescription>
                {t.admin.deleteVehicleConfirm.replace('{name}', deletingVehicle?.name || '')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deletingVehicle && deleteMutation.mutate(deletingVehicle.id)}
              >
                {deleteMutation.isPending ? t.admin.deleting : t.common.delete}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout>
  );
}
