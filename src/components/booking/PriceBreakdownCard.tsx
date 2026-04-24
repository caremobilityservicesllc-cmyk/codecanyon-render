import { Info, Route, Clock, MapPin, Percent } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { BookingDetails } from '@/types/booking';
import { useDynamicPricing } from '@/hooks/useDynamicPricing';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { useLanguage } from '@/contexts/LanguageContext';

interface PriceBreakdownCardProps {
  bookingDetails: BookingDetails;
}

export function PriceBreakdownCard({ bookingDetails }: PriceBreakdownCardProps) {
  const { bookingPolicies, formatPrice } = useSystemSettings();
  const { priceBreakdown, isLoading } = useDynamicPricing(bookingDetails);
  const { t } = useLanguage();
  const pb = (t as any).priceBreakdown || {};

  if (isLoading || !priceBreakdown) {
    return (
      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Info className="h-4 w-4 text-accent" />
            {pb.priceEstimate || 'Price Estimate'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 w-3/4 rounded bg-muted" />
            <div className="h-4 w-1/2 rounded bg-muted" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const depositAmount = priceBreakdown.total * (bookingPolicies.depositPercentage / 100);

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Info className="h-4 w-4 text-accent" />
          {pb.priceBreakdown || 'Price Breakdown'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {priceBreakdown.matchedRoute && (
          <div className="flex items-center gap-2 text-sm">
            <Route className="h-4 w-4 text-accent" />
            <span className="text-muted-foreground">{pb.route || 'Route'}:</span>
            <span className="font-medium">{priceBreakdown.matchedRoute.name}</span>
          </div>
        )}

        {priceBreakdown.estimatedDistance && (
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">{pb.distance || 'Distance'}:</span>
            <span>{priceBreakdown.estimatedDistance} {t.common.km}</span>
          </div>
        )}

        <Separator className="my-2" />

        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{pb.baseFare || 'Base fare'}</span>
          <span>{formatPrice(priceBreakdown.basePrice)}</span>
        </div>

        {priceBreakdown.distancePrice > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{pb.distanceCharge || 'Distance charge'}</span>
            <span>{formatPrice(priceBreakdown.distancePrice)}</span>
          </div>
        )}

        {priceBreakdown.appliedRules.length > 0 && (
          <>
            <Separator className="my-2" />
            <div className="space-y-1">
              {priceBreakdown.appliedRules.map((rule, index) => (
                <TooltipProvider key={index}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center justify-between text-sm cursor-help">
                        <div className="flex items-center gap-1.5">
                          {rule.type === 'multiplier' ? (
                            <Percent className="h-3 w-3 text-amber-500" />
                          ) : (
                            <Clock className="h-3 w-3 text-green-500" />
                          )}
                          <span className="text-muted-foreground">{rule.name}</span>
                        </div>
                        <span className={rule.type === 'fee' ? 'text-amber-500' : 'text-blue-500'}>
                          {rule.type === 'fee' ? `+${formatPrice(rule.adjustment)}` : `x${rule.adjustment.toFixed(2)}`}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">{(pb.appliedAdjustment || 'Applied {type} pricing adjustment').replace('{type}', rule.type)}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
          </>
        )}

        <Separator className="my-2" />

        <div className="flex justify-between text-sm font-medium">
          <span>{pb.subtotal || 'Subtotal'}</span>
          <span>{formatPrice(priceBreakdown.subtotal)}</span>
        </div>

        {bookingDetails.transferType !== 'one-way' && (
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{pb.returnTrip || 'Return trip (x2)'}</span>
            <span>{pb.included || 'Included'}</span>
          </div>
        )}

        <Separator className="my-2" />

        <div className="flex justify-between text-lg font-bold">
          <span>{pb.total || t.common.total}</span>
          <span className="text-accent">{formatPrice(priceBreakdown.total)}</span>
        </div>

        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{(pb.deposit || 'Deposit ({pct}%)').replace('{pct}', String(bookingPolicies.depositPercentage))}</span>
          <span>{formatPrice(depositAmount)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
