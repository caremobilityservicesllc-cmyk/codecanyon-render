import { useEffect, useState } from 'react';
import { Car } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useLanguage } from '@/contexts/LanguageContext';

export function ActiveRidesCounter() {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();
  const ar = (t as any).activeRides || {};

  const fetchActiveRides = async () => {
    const { count, error } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'confirmed')
      .not('ride_started_at', 'is', null)
      .is('ride_completed_at', null);

    if (!error && count !== null) {
      setCount(count);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchActiveRides();

    const channel = supabase
      .channel('active-rides-counter')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        () => { fetchActiveRides(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted animate-pulse">
        <Car className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">...</span>
      </div>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors ${
          count > 0 ? 'bg-primary/10 border border-primary/20' : 'bg-muted'
        }`}>
          <Car className={`h-4 w-4 ${count > 0 ? 'text-primary' : 'text-muted-foreground'}`} />
          <span className={`text-sm font-medium ${count > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
            {count}
          </span>
          {count > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-xs bg-primary/20 text-primary border-0">
              {ar.live || 'Live'}
            </Badge>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-medium">
          {count === 0
            ? (ar.noActiveRides || 'No active rides')
            : (ar.ridesInProgress || '{count} ride(s) in progress').replace('{count}', String(count))}
        </p>
        <p className="text-xs text-muted-foreground">{ar.updatesInRealTime || 'Updates in real-time'}</p>
      </TooltipContent>
    </Tooltip>
  );
}
