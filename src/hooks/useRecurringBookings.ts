import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';

export type RecurringFrequency = 'daily' | 'weekly' | 'weekdays' | 'custom';

export interface RecurringBooking {
  id: string;
  user_id: string;
  template_booking_id: string | null;
  frequency: RecurringFrequency;
  custom_days: string[] | null;
  start_date: string;
  end_date: string | null;
  pickup_location: string;
  dropoff_location: string;
  pickup_time: string;
  vehicle_id: string;
  passengers: number | null;
  notes: string | null;
  is_active: boolean | null;
  last_generated_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateRecurringBookingInput {
  frequency: RecurringFrequency;
  custom_days?: string[];
  start_date: string;
  end_date?: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_time: string;
  vehicle_id: string;
  passengers?: number;
  notes?: string;
}

export function useRecurringBookings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const rb = (t as any).recurringBookingToasts || {};
  const queryClient = useQueryClient();

  const { data: recurringBookings = [], isLoading } = useQuery({
    queryKey: ['recurring-bookings', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('recurring_bookings')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as RecurringBooking[];
    },
    enabled: !!user,
  });

  const createRecurringBooking = useMutation({
    mutationFn: async (input: CreateRecurringBookingInput) => {
      if (!user) throw new Error('Must be logged in');
      
      const { data, error } = await supabase
        .from('recurring_bookings')
        .insert({
          user_id: user.id,
          frequency: input.frequency,
          custom_days: input.custom_days || null,
          start_date: input.start_date,
          end_date: input.end_date || null,
          pickup_location: input.pickup_location,
          dropoff_location: input.dropoff_location,
          pickup_time: input.pickup_time,
          vehicle_id: input.vehicle_id,
          passengers: input.passengers || 1,
          notes: input.notes || null,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as RecurringBooking;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-bookings'] });
      toast({
        title: rb.created || 'Recurring booking created!',
        description: rb.createdDesc || 'Your recurring ride has been scheduled.',
      });
    },
    onError: (error) => {
      toast({
        title: rb.failedToCreate || 'Failed to create recurring booking',
        description: rb.pleaseRetry || 'Please try again.',
        variant: 'destructive',
      });
      console.error('Create recurring booking error:', error);
    },
  });

  const updateRecurringBooking = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<RecurringBooking> & { id: string }) => {
      const { data, error } = await supabase
        .from('recurring_bookings')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as RecurringBooking;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-bookings'] });
      toast({
        title: rb.updated || 'Recurring booking updated',
        description: rb.updatedDesc || 'Your changes have been saved.',
      });
    },
    onError: (error) => {
      toast({
        title: rb.failedToUpdate || 'Failed to update',
        description: rb.pleaseRetry || 'Please try again.',
        variant: 'destructive',
      });
      console.error('Update recurring booking error:', error);
    },
  });

  const toggleRecurringBooking = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { data, error } = await supabase
        .from('recurring_bookings')
        .update({ is_active })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as RecurringBooking;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['recurring-bookings'] });
      toast({
        title: data.is_active 
          ? (rb.activated || 'Recurring booking activated') 
          : (rb.paused || 'Recurring booking paused'),
        description: data.is_active 
          ? (rb.activatedDesc || 'Rides will be scheduled as planned.') 
          : (rb.pausedDesc || 'No new rides will be created.'),
      });
    },
    onError: (error) => {
      toast({
        title: rb.failedToUpdateStatus || 'Failed to update status',
        description: rb.pleaseRetry || 'Please try again.',
        variant: 'destructive',
      });
      console.error('Toggle recurring booking error:', error);
    },
  });

  const deleteRecurringBooking = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('recurring_bookings')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-bookings'] });
      toast({
        title: rb.deleted || 'Recurring booking deleted',
        description: rb.deletedDesc || 'The recurring schedule has been removed.',
      });
    },
    onError: (error) => {
      toast({
        title: rb.failedToDelete || 'Failed to delete',
        description: rb.pleaseRetry || 'Please try again.',
        variant: 'destructive',
      });
      console.error('Delete recurring booking error:', error);
    },
  });

  return {
    recurringBookings,
    isLoading,
    createRecurringBooking,
    updateRecurringBooking,
    toggleRecurringBooking,
    deleteRecurringBooking,
  };
}
