import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface AddDriverDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddDriverDialog({ open, onOpenChange }: AddDriverDialogProps) {
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
  });

  const addMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from('drivers')
        .insert({
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email || null,
          phone: data.phone,
          license_number: data.license_number,
          license_expiry: format(data.license_expiry, 'yyyy-MM-dd'),
          is_active: true,
          is_available: true,
          onboarding_status: 'pending',
          background_check_status: 'pending',
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-drivers'] });
      toast.success(ad.driverAdded);
      onOpenChange(false);
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        license_number: '',
        license_expiry: new Date(),
      });
    },
    onError: (error) => {
      console.error('Error adding driver:', error);
      toast.error(ad.failedToAddDriver);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.first_name || !formData.last_name || !formData.phone || !formData.license_number) {
      toast.error(ad.fillRequiredFields);
      return;
    }
    addMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{ad.addNewDriver || 'Add New Driver'}</DialogTitle>
          <DialogDescription>
            {ad.addNewDriverDesc || "Enter the driver's information to add them to the system."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">{ad.firstName || 'First Name'} *</Label>
              <Input
                id="first_name"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                placeholder={(t as any).placeholders?.firstName || "John"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">{ad.lastName || 'Last Name'} *</Label>
              <Input
                id="last_name"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                placeholder={(t as any).placeholders?.lastName || "Doe"}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">{t.common.email}</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder={(t as any).placeholders?.driverEmail || "john.doe@example.com"}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">{ad.phoneNumber || 'Phone Number'} *</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder={(t as any).placeholders?.phoneAlt || "+1 234 567 8900"}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="license_number">{ad.licenseNumber || 'License Number'} *</Label>
            <Input
              id="license_number"
              value={formData.license_number}
              onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
              placeholder={(t as any).placeholders?.licenseNumber || "DL123456789"}
            />
          </div>

          <div className="space-y-2">
            <Label>{ad.licenseExpiryDate || 'License Expiry Date'} *</Label>
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={addMutation.isPending}>
              {addMutation.isPending ? (ad.adding || 'Adding...') : (ad.addDriver || 'Add Driver')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
