import { useMemo } from 'react';
import { format } from 'date-fns';
import { TrendingUp, Calendar, Clock, MapPin, Car, Users, PiggyBank, Wallet, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { SharingBadges } from './SharingBadges';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { useLanguage } from '@/contexts/LanguageContext';

interface CompletedSharedRide {
  id: string;
  booking_id: string;
  booking_reference: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_date: string;
  pickup_time: string;
  vehicle_name: string;
  total_price: number;
  cost_split_percentage: number;
  accepted_at: string;
  ride_completed_at: string;
  is_sharer: boolean;
  partner_name: string;
}

interface SharedRidesHistoryProps {
  completedShares: CompletedSharedRide[];
  isLoading?: boolean;
}

export function SharedRidesHistory({ completedShares, isLoading }: SharedRidesHistoryProps) {
  const { formatPrice } = useSystemSettings();
  const { t } = useLanguage();

  const ridesWithSavings = useMemo(() => {
    return completedShares.map(ride => {
      const userPercentage = ride.is_sharer ? (100 - ride.cost_split_percentage) : ride.cost_split_percentage;
      const amountPaid = (ride.total_price * userPercentage) / 100;
      const savings = ride.total_price - amountPaid;
      return { ...ride, userPercentage, amountPaid, savings };
    });
  }, [completedShares]);

  const stats = useMemo(() => {
    const totalSavings = ridesWithSavings.reduce((sum, ride) => sum + ride.savings, 0);
    const totalPaid = ridesWithSavings.reduce((sum, ride) => sum + ride.amountPaid, 0);
    const totalRides = ridesWithSavings.length;
    const avgSavingsPerRide = totalRides > 0 ? totalSavings / totalRides : 0;
    return { totalSavings, totalPaid, totalRides, avgSavingsPerRide };
  }, [ridesWithSavings]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  if (completedShares.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="font-display text-lg font-semibold text-foreground mb-2">
            {t.sharedRidesHistory.noCompletedShares}
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            {t.sharedRidesHistory.historyDesc}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <SharingBadges totalRides={stats.totalRides} totalSavings={stats.totalSavings} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-accent/10 to-accent/5 border-accent/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-accent/20 p-2"><PiggyBank className="h-5 w-5 text-accent" /></div>
              <div>
                <p className="text-sm text-muted-foreground">{t.sharedRidesHistory.totalSavings}</p>
                <p className="font-display text-2xl font-bold text-accent">{formatPrice(stats.totalSavings)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-secondary p-2"><Users className="h-5 w-5 text-muted-foreground" /></div>
              <div>
                <p className="text-sm text-muted-foreground">{t.sharedRidesHistory.sharedRides}</p>
                <p className="font-display text-2xl font-bold text-foreground">{stats.totalRides}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-secondary p-2"><TrendingUp className="h-5 w-5 text-muted-foreground" /></div>
              <div>
                <p className="text-sm text-muted-foreground">{t.sharedRidesHistory.avgSavedPerRide}</p>
                <p className="font-display text-2xl font-bold text-foreground">{formatPrice(stats.avgSavingsPerRide)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-secondary p-2"><Wallet className="h-5 w-5 text-muted-foreground" /></div>
              <div>
                <p className="text-sm text-muted-foreground">{t.sharedRidesHistory.totalPaid}</p>
                <p className="font-display text-2xl font-bold text-foreground">{formatPrice(stats.totalPaid)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5 text-accent" />
            {t.sharedRidesHistory.completedSharedRides}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {ridesWithSavings.map((ride) => (
              <div key={ride.id} className="p-4 hover:bg-muted/50 transition-colors">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="font-mono text-sm font-medium text-foreground">{ride.booking_reference}</span>
                      <Badge variant={ride.is_sharer ? "default" : "secondary"} className="text-xs">
                        {ride.is_sharer ? t.sharedRidesHistory.youShared : t.sharedRidesHistory.sharedWithYou}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <MapPin className="h-3.5 w-3.5 text-accent flex-shrink-0" />
                      <span className="truncate">{ride.pickup_location}</span>
                      <ArrowRight className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{ride.dropoff_location}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(ride.pickup_date), 'MMM d, yyyy')}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{ride.pickup_time}</span>
                      <span className="flex items-center gap-1"><Car className="h-3 w-3" />{ride.vehicle_name}</span>
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" />{t.sharedRidesHistory.with} {ride.partner_name}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs text-muted-foreground mb-1">{ride.userPercentage}% of {formatPrice(ride.total_price)}</div>
                    <div className="font-display text-lg font-semibold text-foreground">{formatPrice(ride.amountPaid)}</div>
                    <div className="text-xs font-medium text-accent">{t.sharedRidesHistory.saved.replace('{amount}', formatPrice(ride.savings))}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
