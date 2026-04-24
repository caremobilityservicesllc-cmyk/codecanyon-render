import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { User, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

interface Driver {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  is_available: boolean | null;
  average_rating: number | null;
}

interface DriverAssignmentSelectProps {
  bookingId: string;
  currentDriverId: string | null;
  onAssigned: (driverId: string | null, driverName: string | null) => void;
}

export function DriverAssignmentSelect({ 
  bookingId, 
  currentDriverId, 
  onAssigned 
}: DriverAssignmentSelectProps) {
  const [selectedDriverId, setSelectedDriverId] = useState<string>(currentDriverId || 'unassigned');
  const [isAssigning, setIsAssigning] = useState(false);
  const { t } = useLanguage();

  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ['available-drivers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drivers')
        .select('id, first_name, last_name, avatar_url, is_available, average_rating')
        .eq('is_active', true)
        .order('average_rating', { ascending: false });

      if (error) throw error;
      return data as Driver[];
    },
  });

  const handleAssign = async () => {
    setIsAssigning(true);
    try {
      const driverId = selectedDriverId === 'unassigned' ? null : selectedDriverId;
      
      const { error } = await supabase
        .from('bookings')
        .update({ 
          driver_id: driverId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookingId);

      if (error) throw error;

      const driver = drivers.find(d => d.id === driverId);
      const driverName = driver ? `${driver.first_name} ${driver.last_name}` : null;
      
      onAssigned(driverId, driverName);
      toast.success(driverId ? t.driverAssignment.assignedSuccessfully : t.driverAssignment.unassigned);
    } catch (error) {
      console.error('Error assigning driver:', error);
      toast.error(t.driverAssignment.failedToAssign);
    } finally {
      setIsAssigning(false);
    }
  };

  const da = (t as any).driverAssignmentSelect || {};

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">{da.loadingDrivers || 'Loading drivers...'}</div>;
  }

  return (
    <div className="space-y-3">
      <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={da.selectADriver || 'Select a driver'} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="unassigned">
            <div className="flex items-center gap-2">
              <X className="h-4 w-4 text-muted-foreground" />
              <span>{da.unassigned || 'Unassigned'}</span>
            </div>
          </SelectItem>
          {drivers.map((driver) => (
            <SelectItem key={driver.id} value={driver.id}>
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={driver.avatar_url || undefined} />
                  <AvatarFallback className="text-xs">
                    {driver.first_name[0]}{driver.last_name[0]}
                  </AvatarFallback>
                </Avatar>
                <span>{driver.first_name} {driver.last_name}</span>
                <span className="text-xs text-muted-foreground">
                  ⭐ {driver.average_rating?.toFixed(1) || '5.0'}
                </span>
                {driver.is_available && (
                  <span className="ml-auto text-xs text-green-500">{da.available || 'Available'}</span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      <Button 
        onClick={handleAssign} 
        disabled={isAssigning || selectedDriverId === (currentDriverId || 'unassigned')}
        className="w-full"
      >
        {isAssigning ? (da.assigning || 'Assigning...') : (da.assignDriver || 'Assign Driver')}
      </Button>
    </div>
  );
}
