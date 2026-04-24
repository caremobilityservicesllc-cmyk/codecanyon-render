import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';

export function useFavoriteVehicles() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const { data: favoriteVehicleIds = [], isLoading } = useQuery({
    queryKey: ['favorite-vehicles', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('favorite_vehicles')
        .select('vehicle_id')
        .eq('user_id', user.id);
      
      if (error) throw error;
      return data.map(f => f.vehicle_id);
    },
    enabled: !!user,
  });

  const toggleFavorite = useMutation({
    mutationFn: async (vehicleId: string) => {
      if (!user) throw new Error('Must be logged in');
      
      const isFavorite = favoriteVehicleIds.includes(vehicleId);
      
      if (isFavorite) {
        const { error } = await supabase
          .from('favorite_vehicles')
          .delete()
          .eq('user_id', user.id)
          .eq('vehicle_id', vehicleId);
        
        if (error) throw error;
        return { action: 'removed' };
      } else {
        const { error } = await supabase
          .from('favorite_vehicles')
          .insert({
            user_id: user.id,
            vehicle_id: vehicleId,
          });
        
        if (error) throw error;
        return { action: 'added' };
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['favorite-vehicles'] });
      toast({
        title: result.action === 'added' ? t.favorites.addedToFavorites : t.favorites.removedFromFavorites,
        description: result.action === 'added' 
          ? t.favorites.addedDesc
          : t.favorites.removedDesc,
      });
    },
    onError: (error) => {
      toast({ title: t.common.error, description: t.favorites.failedToUpdate, variant: 'destructive' });
      console.error('Toggle favorite error:', error);
    },
  });

  const isFavorite = (vehicleId: string) => favoriteVehicleIds.includes(vehicleId);

  return {
    favoriteVehicleIds,
    isLoading,
    toggleFavorite,
    isFavorite,
  };
}
