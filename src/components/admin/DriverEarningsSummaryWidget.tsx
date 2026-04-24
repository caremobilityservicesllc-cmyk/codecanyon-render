import { useQuery } from '@tanstack/react-query';
import { DollarSign, TrendingUp, Users, Calendar } from 'lucide-react';
import { startOfWeek, startOfMonth, endOfWeek, endOfMonth, format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Skeleton } from '@/components/ui/skeleton';

interface EarningsSummary {
  weeklyTotal: number;
  monthlyTotal: number;
  weeklyRides: number;
  monthlyRides: number;
  topDrivers: Array<{
    driverId: string;
    driverName: string;
    earnings: number;
    rides: number;
  }>;
}

export function DriverEarningsSummaryWidget() {
  const { formatPrice } = useSystemSettings();
  const { t } = useLanguage();
  const des = (t as any).driverEarningsSummary || {};
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const { data: summary, isLoading } = useQuery({
    queryKey: ['driver-earnings-summary', format(now, 'yyyy-MM')],
    queryFn: async (): Promise<EarningsSummary> => {
      // Fetch weekly earnings
      const { data: weeklyEarnings, error: weeklyError } = await supabase
        .from('driver_earnings')
        .select('amount, driver_id')
        .gte('created_at', weekStart.toISOString())
        .lte('created_at', weekEnd.toISOString());

      if (weeklyError) throw weeklyError;

      // Fetch monthly earnings
      const { data: monthlyEarnings, error: monthlyError } = await supabase
        .from('driver_earnings')
        .select('amount, driver_id')
        .gte('created_at', monthStart.toISOString())
        .lte('created_at', monthEnd.toISOString());

      if (monthlyError) throw monthlyError;

      // Fetch drivers for names
      const { data: drivers, error: driversError } = await supabase
        .from('drivers')
        .select('id, first_name, last_name');

      if (driversError) throw driversError;

      const driverMap = new Map(
        drivers?.map(d => [d.id, `${d.first_name} ${d.last_name}`]) || []
      );

      // Calculate totals
      const weeklyTotal = weeklyEarnings?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;
      const monthlyTotal = monthlyEarnings?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;
      const weeklyRides = weeklyEarnings?.length || 0;
      const monthlyRides = monthlyEarnings?.length || 0;

      // Calculate top drivers this month
      const driverEarningsMap = new Map<string, { earnings: number; rides: number }>();
      monthlyEarnings?.forEach(e => {
        const current = driverEarningsMap.get(e.driver_id) || { earnings: 0, rides: 0 };
        driverEarningsMap.set(e.driver_id, {
          earnings: current.earnings + (e.amount || 0),
          rides: current.rides + 1,
        });
      });

      const topDrivers = Array.from(driverEarningsMap.entries())
        .map(([driverId, data]) => ({
          driverId,
          driverName: driverMap.get(driverId) || 'Unknown Driver',
          earnings: data.earnings,
          rides: data.rides,
        }))
        .sort((a, b) => b.earnings - a.earnings)
        .slice(0, 5);

      return {
        weeklyTotal,
        monthlyTotal,
        weeklyRides,
        monthlyRides,
        topDrivers,
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <DollarSign className="h-5 w-5 text-primary" />
          {des.title || 'Driver Earnings Summary'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Grid */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-border bg-muted/30 p-3 sm:p-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs sm:text-sm text-muted-foreground">{des.thisWeek || 'This Week'}</span>
            </div>
            <p className="mt-2 text-xl sm:text-2xl font-bold text-primary">
              {formatPrice(summary?.weeklyTotal || 0)}
            </p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">
              {summary?.weeklyRides || 0} {des.rides || 'rides'}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-3 sm:p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs sm:text-sm text-muted-foreground">{des.thisMonth || 'This Month'}</span>
            </div>
            <p className="mt-2 text-xl sm:text-2xl font-bold text-primary">
              {formatPrice(summary?.monthlyTotal || 0)}
            </p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">
              {summary?.monthlyRides || 0} {des.rides || 'rides'}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-3 sm:p-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs sm:text-sm text-muted-foreground">{des.avgPerRideWeek || 'Avg/Ride (Week)'}</span>
            </div>
            <p className="mt-2 text-xl sm:text-2xl font-bold">
              {formatPrice(summary?.weeklyRides ? summary.weeklyTotal / summary.weeklyRides : 0)}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-3 sm:p-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs sm:text-sm text-muted-foreground">{des.avgPerRideMonth || 'Avg/Ride (Month)'}</span>
            </div>
            <p className="mt-2 text-xl sm:text-2xl font-bold">
              {formatPrice(summary?.monthlyRides ? summary.monthlyTotal / summary.monthlyRides : 0)}
            </p>
          </div>
        </div>

        {/* Top Drivers */}
        {summary?.topDrivers && summary.topDrivers.length > 0 && (
          <div>
            <h4 className="mb-3 text-sm font-medium text-muted-foreground">
              {des.topEarningDrivers || 'Top Earning Drivers (This Month)'}
            </h4>
            <div className="space-y-2">
              {summary.topDrivers.map((driver, index) => (
                <div
                  key={driver.driverId}
                  className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{driver.driverName}</p>
                      <p className="text-xs text-muted-foreground">
                        {driver.rides} {driver.rides !== 1 ? (des.rides || 'rides') : (des.ride || 'ride')}
                      </p>
                    </div>
                  </div>
                  <p className="font-bold text-primary">{formatPrice(driver.earnings)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {(!summary?.topDrivers || summary.topDrivers.length === 0) && (
          <p className="text-sm text-muted-foreground text-center py-4">
            {des.noEarningsYet || 'No earnings recorded this month yet'}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
