import { useEffect, useState } from 'react';
import { Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { format } from 'date-fns';
import { useLanguage } from '@/contexts/LanguageContext';

export function TodayBookingsCounter() {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();
  const tb = (t as any).todayBookings || {};

  const fetchTodayBookings = async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const { count, error } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('pickup_date', today);

    if (!error && count !== null) {
      setCount(count);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTodayBookings();

    const channel = supabase
      .channel('today-bookings-counter')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        () => { fetchTodayBookings(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted animate-pulse">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">...</span>
      </div>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors ${
          count > 0 ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-muted'
        }`}>
          <Calendar className={`h-4 w-4 ${count > 0 ? 'text-blue-500' : 'text-muted-foreground'}`} />
          <span className={`text-sm font-medium ${count > 0 ? 'text-blue-500' : 'text-muted-foreground'}`}>
            {count}
          </span>
          {count > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-xs bg-blue-500/20 text-blue-500 border-0">
              {tb.today || 'Today'}
            </Badge>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-medium">
          {count === 0
            ? (tb.noBookingsToday || 'No bookings today')
            : (tb.bookingsToday || '{count} booking(s) today').replace('{count}', String(count))}
        </p>
        <p className="text-xs text-muted-foreground">{tb.updatesInRealTime || 'Updates in real-time'}</p>
      </TooltipContent>
    </Tooltip>
  );
}
