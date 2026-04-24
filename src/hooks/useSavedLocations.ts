import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';

export interface SavedLocation {
  id: string;
  user_id: string;
  name: string;
  address: string;
  is_default_pickup: boolean;
  is_default_dropoff: boolean;
  created_at: string;
  updated_at: string;
}

export function useSavedLocations() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const { data: savedLocations = [], isLoading } = useQuery({
    queryKey: ['saved-locations', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('saved_locations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as SavedLocation[];
    },
    enabled: !!user,
  });

  const addLocation = useMutation({
    mutationFn: async (location: { name: string; address: string; is_default_pickup?: boolean; is_default_dropoff?: boolean }) => {
      if (!user) throw new Error('Must be logged in');
      
      const { data, error } = await supabase
        .from('saved_locations')
        .insert({
          user_id: user.id,
          name: location.name,
          address: location.address,
          is_default_pickup: location.is_default_pickup || false,
          is_default_dropoff: location.is_default_dropoff || false,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-locations'] });
      toast({ title: t.savedLocations.locationSaved, description: t.savedLocations.locationSavedDesc });
    },
    onError: (error) => {
      toast({ title: t.common.error, description: t.savedLocations.failedToSave, variant: 'destructive' });
      console.error('Add location error:', error);
    },
  });

  const removeLocation = useMutation({
    mutationFn: async (locationId: string) => {
      const { error } = await supabase
        .from('saved_locations')
        .delete()
        .eq('id', locationId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-locations'] });
      toast({ title: t.savedLocations.locationRemoved, description: t.savedLocations.locationRemovedDesc });
    },
    onError: (error) => {
      toast({ title: t.common.error, description: t.savedLocations.failedToRemove, variant: 'destructive' });
      console.error('Remove location error:', error);
    },
  });

  const setDefaultLocation = useMutation({
    mutationFn: async ({ locationId, type }: { locationId: string; type: 'pickup' | 'dropoff' }) => {
      if (!user) throw new Error('Must be logged in');
      
      // First, clear any existing defaults of this type
      const field = type === 'pickup' ? 'is_default_pickup' : 'is_default_dropoff';
      
      await supabase
        .from('saved_locations')
        .update({ [field]: false })
        .eq('user_id', user.id);
      
      // Then set the new default
      const { error } = await supabase
        .from('saved_locations')
        .update({ [field]: true })
        .eq('id', locationId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-locations'] });
    },
  });

  const defaultPickup = savedLocations.find(l => l.is_default_pickup);
  const defaultDropoff = savedLocations.find(l => l.is_default_dropoff);

  return {
    savedLocations,
    isLoading,
    addLocation,
    removeLocation,
    setDefaultLocation,
    defaultPickup,
    defaultDropoff,
  };
}
