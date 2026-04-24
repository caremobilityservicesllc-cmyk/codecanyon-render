import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { Wallet, Clock, CheckCircle, AlertCircle, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { useLanguage } from '@/contexts/LanguageContext';

interface DriverPayoutTrackerProps {
  driverId: string;
}

interface Payout {
  id: string;
  amount: number;
  status: string;
  payout_method: string;
  period_start: string;
  period_end: string;
  processed_at: string | null;
  notes: string | null;
  created_at: string;
}

interface Earning {
  id: string;
  amount: number;
  created_at: string;
  booking_id: string | null;
}

export function DriverPayoutTracker({ driverId }: DriverPayoutTrackerProps) {
  const { formatPrice } = useSystemSettings();
  const { t } = useLanguage();
  const { data: payouts = [], isLoading: payoutsLoading } = useQuery({
    queryKey: ['driver-payouts', driverId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('driver_payouts')
        .select('*')
        .eq('driver_id', driverId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as Payout[];
    },
    enabled: !!driverId,
  });

  // Fetch all earnings to calculate pending amount
  const { data: earnings = [], isLoading: earningsLoading } = useQuery({
    queryKey: ['driver-all-earnings', driverId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('driver_earnings')
        .select('id, amount, created_at, booking_id')
        .eq('driver_id', driverId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Earning[];
    },
    enabled: !!driverId,
  });

  // Calculate total earnings
  const totalEarnings = earnings.reduce((sum, e) => sum + e.amount, 0);

  // Calculate total paid out
  const totalPaidOut = payouts
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + p.amount, 0);

  // Pending payout is total earnings minus what's been paid
  const pendingPayout = Math.max(0, totalEarnings - totalPaidOut);

  // Check for any payouts currently processing
  const processingPayouts = payouts.filter(p => p.status === 'processing');

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
            <CheckCircle className="h-3 w-3 mr-1" />
            {t.driverPayout.completed}
          </Badge>
        );
      case 'processing':
        return (
          <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">
            <Clock className="h-3 w-3 mr-1 animate-pulse" />
            {t.driverPayout.processing}
          </Badge>
        );
      case 'failed':
        return (
          <Badge className="bg-destructive/10 text-destructive border-destructive/20">
            <AlertCircle className="h-3 w-3 mr-1" />
            {t.driverPayout.failed}
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            {t.driverPayout.pending}
          </Badge>
        );
    }
  };

  const isLoading = payoutsLoading || earningsLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Pending Payout Card */}
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{t.driverPayout.pendingPayout}</p>
              <p className="text-3xl font-bold text-primary">{formatPrice(pendingPayout)}</p>
              {processingPayouts.length > 0 && (
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <Clock className="h-3 w-3 animate-pulse" />
                  {formatPrice(processingPayouts.reduce((sum, p) => sum + p.amount, 0))} {t.driverPayout.beingProcessed}
                </p>
              )}
            </div>
            <div className="h-14 w-14 rounded-full bg-primary/20 flex items-center justify-center">
              <Wallet className="h-7 w-7 text-primary" />
            </div>
          </div>
          
          <Separator className="my-4" />
          
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-xs text-muted-foreground">{t.driverPayout.totalEarned}</p>
              <p className="text-lg font-semibold flex items-center justify-center gap-1">
                <TrendingUp className="h-4 w-4 text-green-500" />
                {formatPrice(totalEarnings)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t.driverPayout.totalPaidOut}</p>
              <p className="text-lg font-semibold">{formatPrice(totalPaidOut)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payout History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            {t.driverPayout.payoutHistory}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {payouts.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Wallet className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">{t.driverPayout.noPayoutsYet}</p>
              <p className="text-xs">{t.driverPayout.payoutHistoryAppears}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {payouts.map((payout) => (
                <div
                  key={payout.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{formatPrice(payout.amount)}</p>
                      {getStatusBadge(payout.status)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(payout.period_start), 'MMM d')} - {format(parseISO(payout.period_end), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    {payout.processed_at ? (
                      <p>{t.driverPayout.paid} {format(parseISO(payout.processed_at), 'MMM d')}</p>
                    ) : (
                      <p>{t.driverPayout.created} {format(parseISO(payout.created_at), 'MMM d')}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
