import { useEffect, useState } from 'react';
import { DollarSign } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { useLanguage } from '@/contexts/LanguageContext';

export function TodayRevenueCounter() {
  const [revenue, setRevenue] = useState(0);
  const [loading, setLoading] = useState(true);
  const { formatPrice, businessInfo } = useSystemSettings();
  const { t } = useLanguage();
  const tr = (t as any).todayRevenue || {};

  const fetchTodayRevenue = async () => {
    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    const { data, error } = await supabase
      .from('bookings')
      .select('total_price')
      .eq('pickup_date', localDate)
      .in('status', ['confirmed', 'completed']);

    if (!error && data) {
      const total = data.reduce((sum, booking) => sum + (booking.total_price || 0), 0);
      setRevenue(total);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTodayRevenue();

    const channel = supabase
      .channel('today-revenue-counter')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        () => { fetchTodayRevenue(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const formatRevenue = (amount: number) => {
    if (amount >= 1000) {
      return formatPrice(Math.round(amount / 100) * 100);
    }
    return formatPrice(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted animate-pulse">
        <DollarSign className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">...</span>
      </div>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors ${
          revenue > 0 ? 'bg-green-500/10 border border-green-500/20' : 'bg-muted'
        }`}>
          <DollarSign className={`h-4 w-4 ${revenue > 0 ? 'text-green-500' : 'text-muted-foreground'}`} />
          <span className={`text-sm font-medium ${revenue > 0 ? 'text-green-500' : 'text-muted-foreground'}`}>
            {formatRevenue(revenue)}
          </span>
          {revenue > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-xs bg-green-500/20 text-green-500 border-0">
              {tr.today || 'Today'}
            </Badge>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-medium">
          {revenue === 0
            ? (tr.noRevenueToday || 'No revenue today')
            : (tr.revenueToday || '{amount} revenue today').replace('{amount}', formatPrice(revenue))}
        </p>
        <p className="text-xs text-muted-foreground">{tr.confirmedAndCompleted || 'Confirmed & completed bookings'}</p>
      </TooltipContent>
    </Tooltip>
  );
}
