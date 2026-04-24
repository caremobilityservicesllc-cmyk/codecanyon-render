import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { DollarSign, Car, TrendingUp, Calendar, ArrowDown, ArrowRight, Percent, Receipt, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';

interface DriverEarningsTrackerProps {
  driverId: string;
}

interface EarningRecord {
  id: string;
  amount: number;
  gross_amount: number;
  commission_rate: number;
  commission_amount: number;
  earning_type: string;
  description: string | null;
  created_at: string;
  booking_id: string | null;
}

const PAGE_SIZE = 10;

export function DriverEarningsTracker({ driverId }: DriverEarningsTrackerProps) {
  const { formatPrice } = useSystemSettings();
  const { t } = useLanguage();
  const [page, setPage] = useState(0);

  // Fetch summary stats (all earnings)
  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['driver-earnings-summary', driverId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('driver_earnings')
        .select('amount, gross_amount, commission_rate, commission_amount, earning_type')
        .eq('driver_id', driverId);

      if (error) throw error;
      const records = (data || []) as Pick<EarningRecord, 'amount' | 'gross_amount' | 'commission_rate' | 'commission_amount' | 'earning_type'>[];
      
      const totalGross = records.reduce((sum, e) => sum + (e.gross_amount || e.amount || 0), 0);
      const totalCommission = records.reduce((sum, e) => sum + (e.commission_amount || 0), 0);
      const totalNet = records.reduce((sum, e) => sum + (e.amount || 0), 0);
      const totalRides = records.filter(e => e.earning_type === 'ride').length;
      const avgPerRide = totalRides > 0 ? totalNet / totalRides : 0;
      const ratesWithValue = records.filter(e => e.commission_rate > 0);
      const avgCommissionRate = ratesWithValue.length > 0
        ? ratesWithValue.reduce((sum, e) => sum + (e.commission_rate || 0), 0) / ratesWithValue.length
        : 0;
      const netPercentage = totalGross > 0 ? (totalNet / totalGross) * 100 : 100;
      const totalCount = records.length;

      return { totalGross, totalCommission, totalNet, totalRides, avgPerRide, avgCommissionRate, netPercentage, totalCount };
    },
    enabled: !!driverId,
  });

  // Fetch paginated earnings for the report
  const { data: earningsPage, isLoading: pageLoading } = useQuery({
    queryKey: ['driver-earnings-page', driverId, page],
    queryFn: async () => {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from('driver_earnings')
        .select('id, amount, gross_amount, commission_rate, commission_amount, earning_type, description, created_at, booking_id')
        .eq('driver_id', driverId)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      return (data || []) as EarningRecord[];
    },
    enabled: !!driverId,
  });

  const earnings = earningsPage || [];
  const totalCount = summaryData?.totalCount || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const isLoading = summaryLoading;

  const {
    totalGross = 0, totalCommission = 0, totalNet = 0, totalRides = 0,
    avgPerRide = 0, avgCommissionRate = 0, netPercentage = 100,
  } = summaryData || {};

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Gross → Deductions → Net Flow */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
         <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" />
            {t.driverEarnings.earningsSummary}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-center flex-1">
             <p className="text-xs text-muted-foreground mb-1">{t.driverEarnings.riderPaid}</p>
              <p className="text-lg font-bold">{formatPrice(totalGross)}</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="text-center flex-1">
              <p className="text-xs text-destructive/80 mb-1">{t.driverEarnings.serviceFee}</p>
              <p className="text-lg font-bold text-destructive/80">-{formatPrice(totalCommission)}</p>
              <p className="text-[10px] text-muted-foreground">
                {avgCommissionRate > 0 ? `~${avgCommissionRate.toFixed(0)}%` : '—'}
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="text-center flex-1">
              <p className="text-xs text-primary mb-1">{t.driverEarnings.youEarned}</p>
              <p className="text-lg font-bold text-primary">{formatPrice(totalNet)}</p>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{t.driverEarnings.yourShare} ({netPercentage.toFixed(0)}%)</span>
              <span>{t.driverEarnings.platform} ({(100 - netPercentage).toFixed(0)}%)</span>
            </div>
            <Progress value={netPercentage} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-primary/10 border-primary/20">
          <CardContent className="pt-4 pb-3 px-3 text-center">
            <Car className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-lg font-bold text-primary">{totalRides}</p>
            <p className="text-xs text-muted-foreground">{t.driverEarnings.rides}</p>
          </CardContent>
        </Card>
        <Card className="bg-accent/10 border-accent/20">
          <CardContent className="pt-4 pb-3 px-3 text-center">
            <TrendingUp className="h-5 w-5 text-accent mx-auto mb-1" />
            <p className="text-lg font-bold text-accent">{formatPrice(avgPerRide)}</p>
            <p className="text-xs text-muted-foreground">{t.driverEarnings.avgPerRide}</p>
          </CardContent>
        </Card>
        <Card className="bg-muted border-muted">
          <CardContent className="pt-4 pb-3 px-3 text-center">
            <Percent className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
            <p className="text-lg font-bold text-muted-foreground">
              {avgCommissionRate > 0 ? `${avgCommissionRate.toFixed(0)}%` : '—'}
            </p>
            <p className="text-xs text-muted-foreground">{t.driverEarnings.feeRate}</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Earnings Report with Pagination */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
             <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-accent" />
              {t.driverEarnings.earningsReport}
            </CardTitle>
            {totalCount > 0 && (
              <span className="text-xs text-muted-foreground">
                {totalCount} {totalCount === 1 ? t.driverEarnings.entry : t.driverEarnings.entries}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {pageLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : earnings.length === 0 && page === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t.driverEarnings.noEarningsYet}
            </p>
          ) : (
            <div className="space-y-3">
              {earnings.map((earning) => (
                <div
                  key={earning.id}
                  className="p-3 rounded-lg border bg-card space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                       <p className="font-medium text-sm">
                        {earning.description || t.driverEarnings.rideCompleted}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(earning.created_at), 'EEE, MMM d • h:mm a')}
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {earning.earning_type}
                    </Badge>
                  </div>

                  {earning.gross_amount > 0 ? (
                    <div className="rounded-md bg-muted/50 p-2.5 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{t.driverEarnings.grossFare}</span>
                        <span className="font-semibold">{formatPrice(earning.gross_amount)}</span>
                      </div>
                      <Separator className="my-1" />
                      <div className="flex items-center justify-between text-xs text-destructive/80">
                        <span className="flex items-center gap-1">
                           <ArrowDown className="h-3 w-3" />
                          {t.driverEarnings.serviceFeePct.replace('{rate}', String(earning.commission_rate))}
                        </span>
                        <span className="font-medium">-{formatPrice(earning.commission_amount)}</span>
                      </div>
                      <Separator className="my-1" />
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-primary flex items-center gap-1">
                           <DollarSign className="h-3.5 w-3.5" />
                          {t.driverEarnings.netPay}
                        </span>
                        <span className="font-bold text-primary">{formatPrice(earning.amount)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between rounded-md bg-muted/50 p-2.5">
                      <span className="text-xs text-muted-foreground">{t.driverEarnings.earnings}</span>
                      <span className="font-bold text-primary">{formatPrice(earning.amount)}</span>
                    </div>
                  )}
                </div>
              ))}

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="gap-1"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    {t.driverEarnings.previous}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {t.driverEarnings.page} {page + 1} {t.driverEarnings.of} {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="gap-1"
                  >
                    {t.driverEarnings.next}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
