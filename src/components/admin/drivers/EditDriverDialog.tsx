import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Driver {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string;
  license_number: string;
  license_expiry: string;
  is_active: boolean;
  is_available: boolean;
  onboarding_status: string;
  background_check_status: string;
  documents_verified: boolean;
  verification_notes: string | null;
  rejection_reason: string | null;
}

interface EditDriverDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driver: Driver;
}

export function EditDriverDialog({ open, onOpenChange, driver }: EditDriverDialogProps) {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const ad = t.adminDrivers;
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    license_number: '',
    license_expiry: new Date(),
    is_active: true,
    is_available: true,
    onboarding_status: 'pending',
    background_check_status: 'pending',
    documents_verified: false,
    verification_notes: '',
    rejection_reason: '',
  });

  useEffect(() => {
    if (driver) {
      setFormData({
        first_name: driver.first_name,
        last_name: driver.last_name,
        email: driver.email || '',
        phone: driver.phone,
        license_number: driver.license_number,
        license_expiry: new Date(driver.license_expiry),
        is_active: driver.is_active,
        is_available: driver.is_available,
        onboarding_status: driver.onboarding_status,
        background_check_status: driver.background_check_status,
        documents_verified: driver.documents_verified,
        verification_notes: driver.verification_notes || '',
        rejection_reason: driver.rejection_reason || '',
      });
    }
  }, [driver]);

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const updateData: Record<string, unknown> = {
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email || null,
        phone: data.phone,
        license_number: data.license_number,
        license_expiry: format(data.license_expiry, 'yyyy-MM-dd'),
        is_active: data.is_active,
        is_available: data.is_available,
        onboarding_status: data.onboarding_status,
        background_check_status: data.background_check_status,
        documents_verified: data.documents_verified,
        verification_notes: data.verification_notes || null,
        rejection_reason: data.rejection_reason || null,
        updated_at: new Date().toISOString(),
      };

      if (data.documents_verified && !driver.documents_verified) {
        updateData.verified_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('drivers')
        .update(updateData)
        .eq('id', driver.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-drivers'] });
      toast.success(ad.driverUpdated);
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Error updating driver:', error);
      toast.error(ad.failedToUpdateDriver);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{ad.editDriver || 'Edit Driver'}</DialogTitle>
          <DialogDescription>
            {ad.editDriverDesc || 'Update driver information and onboarding status.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="info" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="info">{ad.basicInfo || 'Basic Info'}</TabsTrigger>
              <TabsTrigger value="onboarding">{ad.onboarding || 'Onboarding'}</TabsTrigger>
              <TabsTrigger value="status">{ad.statusTab || 'Status'}</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_first_name">{ad.firstName || 'First Name'}</Label>
                  <Input
                    id="edit_first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_last_name">{ad.lastName || 'Last Name'}</Label>
                  <Input
                    id="edit_last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_email">{t.common.email}</Label>
                <Input
                  id="edit_email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_phone">{ad.phoneNumber || 'Phone Number'}</Label>
                <Input
                  id="edit_phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_license_number">{ad.licenseNumber || 'License Number'}</Label>
                <Input
                  id="edit_license_number"
                  value={formData.license_number}
                  onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>{ad.licenseExpiryDate || 'License Expiry Date'}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.license_expiry && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.license_expiry ? format(formData.license_expiry, "PPP") : (ad.pickADate || "Pick a date")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.license_expiry}
                      onSelect={(date) => date && setFormData({ ...formData, license_expiry: date })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </TabsContent>

            <TabsContent value="onboarding" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>{ad.onboardingStatus || 'Onboarding Status'}</Label>
                <Select
                  value={formData.onboarding_status}
                  onValueChange={(value) => setFormData({ ...formData, onboarding_status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">{ad.pending || 'Pending'}</SelectItem>
                    <SelectItem value="documents_submitted">{ad.documentsSubmitted || 'Documents Submitted'}</SelectItem>
                    <SelectItem value="under_review">{ad.underReview || 'Under Review'}</SelectItem>
                    <SelectItem value="approved">{ad.approved || 'Approved'}</SelectItem>
                    <SelectItem value="rejected">{ad.rejected || 'Rejected'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{ad.backgroundCheckStatus || 'Background Check Status'}</Label>
                <Select
                  value={formData.background_check_status}
                  onValueChange={(value) => setFormData({ ...formData, background_check_status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">{ad.pending || 'Pending'}</SelectItem>
                    <SelectItem value="approved">{ad.approved || 'Approved'}</SelectItem>
                    <SelectItem value="rejected">{ad.rejected || 'Rejected'}</SelectItem>
                    <SelectItem value="expired">{ad.expired || 'Expired'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label>{ad.documentsVerified || 'Documents Verified'}</Label>
                  <p className="text-sm text-muted-foreground">
                    {ad.markAllDocsVerified || 'Mark all documents as verified'}
                  </p>
                </div>
                <Switch
                  checked={formData.documents_verified}
                  onCheckedChange={(checked) => setFormData({ ...formData, documents_verified: checked })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="verification_notes">{ad.verificationNotes || 'Verification Notes'}</Label>
                <Textarea
                  id="verification_notes"
                  value={formData.verification_notes}
                  onChange={(e) => setFormData({ ...formData, verification_notes: e.target.value })}
                  placeholder={ad.verificationNotesPlaceholder || 'Add any verification notes...'}
                  rows={3}
                />
              </div>

              {formData.onboarding_status === 'rejected' && (
                <div className="space-y-2">
                  <Label htmlFor="rejection_reason">{ad.rejectionReason || 'Rejection Reason'}</Label>
                  <Textarea
                    id="rejection_reason"
                    value={formData.rejection_reason}
                    onChange={(e) => setFormData({ ...formData, rejection_reason: e.target.value })}
                    placeholder={ad.rejectionReasonPlaceholder || 'Explain why the application was rejected...'}
                    rows={3}
                  />
                </div>
              )}
            </TabsContent>

            <TabsContent value="status" className="space-y-4 mt-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label>{ad.active || 'Active'}</Label>
                  <p className="text-sm text-muted-foreground">
                    {ad.activeDesc || 'Driver can accept rides when active'}
                  </p>
                </div>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label>{ad.available || 'Available'}</Label>
                  <p className="text-sm text-muted-foreground">
                    {ad.availableDesc || 'Driver is currently available for new rides'}
                  </p>
                </div>
                <Switch
                  checked={formData.is_available}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_available: checked })}
                />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (ad.saving || 'Saving...') : t.common.saveChanges}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
