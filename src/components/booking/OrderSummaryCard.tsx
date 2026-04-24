import { useMemo } from 'react';
import { MapPin, Calendar, Clock, Users, Car, Briefcase, Baby, Plane, RotateCcw, ArrowRight, RefreshCw, Route, Tag, Info, Loader2 } from 'lucide-react';
import { BookingDetails, TransferType } from '@/types/booking';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';

interface OrderSummaryCardProps {
  bookingDetails: BookingDetails;
  priceBreakdown: {
    basePrice: number;
    distancePrice: number;
    zoneMultiplier: number;
    zoneName?: string;
    appliedRules: Array<{ name: string; type: 'multiplier' | 'fee'; adjustment: number }>;
    returnMultiplier: number;
    total: number;
    deposit: number;
    matchedRoute?: { name: string };
    estimatedDistance?: number;
    isHourly?: boolean;
    hourlyRate?: number;
    bookingHours?: number;
    stopSurcharge?: number;
    returnDiscount?: number;
  } | null;
  isPricingLoading: boolean;
  appliedDiscount?: { code: string; percentage: number; description: string } | null;
}

export function OrderSummaryCard({ bookingDetails, priceBreakdown, isPricingLoading, appliedDiscount }: OrderSummaryCardProps) {
  const { bookingPolicies, formatPrice } = useSystemSettings();
  const { t } = useLanguage();

  const transferTypeLabels: Record<TransferType, { label: string; icon: React.ReactNode }> = {
    'one-way': { label: t.bookingConfirmationToasts.oneWay, icon: <ArrowRight className="h-4 w-4" /> },
    'return': { label: t.bookingConfirmationToasts.return, icon: <RotateCcw className="h-4 w-4" /> },
    'return-new-ride': { label: t.bookingConfirmationToasts.returnNewRide, icon: <RefreshCw className="h-4 w-4" /> },
  };
  const transferInfo = transferTypeLabels[bookingDetails.transferType];
  
  const extras = useMemo(() => {
    const items: { icon: React.ReactNode; label: string }[] = [];
    if (bookingDetails.luggageCount > 0) {
      items.push({ icon: <Briefcase className="h-3.5 w-3.5" />, label: `${bookingDetails.luggageCount} ${t.common.bags}` });
    }
    if (bookingDetails.childSeats > 0) {
      items.push({ icon: <Baby className="h-3.5 w-3.5" />, label: `${bookingDetails.childSeats} ${t.bookingExtras.childSeats.toLowerCase()}` });
    }
    if (bookingDetails.flightNumber) {
      items.push({ icon: <Plane className="h-3.5 w-3.5" />, label: bookingDetails.flightNumber });
    }
    return items;
  }, [bookingDetails.luggageCount, bookingDetails.childSeats, bookingDetails.flightNumber, t]);

  const discountMultiplier = appliedDiscount ? (100 - appliedDiscount.percentage) / 100 : 1;
  const originalTotal = priceBreakdown?.total ?? 0;
  const discountAmount = appliedDiscount ? originalTotal * (appliedDiscount.percentage / 100) : 0;
  const discountedTotal = originalTotal - discountAmount;
  const depositAmount = discountedTotal * (bookingPolicies.depositPercentage / 100);
  const remainingAmount = discountedTotal - depositAmount;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 px-6 py-4 border-b border-border">
        <h3 className="font-display text-lg font-semibold text-foreground">
          {t.orderSummary.orderSummary}
        </h3>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-background px-3 py-1 text-xs font-medium text-primary border border-primary/20">
            {bookingDetails.serviceType === 'hourly' ? t.orderSummary.hourly : t.orderSummary.flatRate}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-background px-3 py-1 text-xs font-medium text-foreground border border-border">
            {transferInfo.icon}
            {transferInfo.label}
          </span>
        </div>
      </div>

      <div className="p-6 space-y-4">
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <MapPin className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{t.orderSummary.pickup}</p>
              <p className="font-medium text-foreground text-sm truncate">{bookingDetails.pickupLocation || t.orderSummary.notSet}</p>
            </div>
          </div>
          
          {bookingDetails.stops.length > 0 && (
            <div className="ml-4 border-l-2 border-dashed border-muted-foreground/30 pl-6 space-y-2">
              {bookingDetails.stops.map((stop, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  <div className="h-2 w-2 rounded-full bg-muted-foreground/50" />
                  <span className="text-muted-foreground truncate">{stop}</span>
                </div>
              ))}
            </div>
          )}
          
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10">
              <MapPin className="h-4 w-4 text-destructive" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{t.orderSummary.dropOff}</p>
              <p className="font-medium text-foreground text-sm truncate">{bookingDetails.dropoffLocation || t.orderSummary.notSet}</p>
            </div>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-foreground">
              {bookingDetails.pickupDate ? format(bookingDetails.pickupDate, 'MMM d, yyyy') : t.orderSummary.notSet}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-foreground">{bookingDetails.pickupTime || t.orderSummary.notSet}</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-foreground">
              {bookingDetails.passengers} {bookingDetails.passengers !== 1 ? t.common.passengers : t.common.passenger}
            </span>
          </div>
          {bookingDetails.selectedVehicle && (
            <div className="flex items-center gap-2">
              <Car className="h-4 w-4 text-muted-foreground" />
              <span className="text-foreground truncate">{bookingDetails.selectedVehicle.name}</span>
            </div>
          )}
        </div>

        {extras.length > 0 && (
          <>
            <Separator />
            <div className="flex flex-wrap gap-2">
              {extras.map((extra, idx) => (
                <span key={idx} className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                  {extra.icon}
                  {extra.label}
                </span>
              ))}
            </div>
          </>
        )}

        {bookingDetails.notes && (
          <>
            <Separator />
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">{t.orderSummary.notes}</p>
              <p className="text-sm text-foreground">{bookingDetails.notes}</p>
            </div>
          </>
        )}

        <Separator />

        {bookingDetails.selectedVehicle && (
          <div className="space-y-2">
            {isPricingLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">{t.orderSummary.calculatingPrice}</span>
              </div>
            ) : priceBreakdown ? (
              <>
                {priceBreakdown.matchedRoute && (
                  <div className="flex items-center gap-2 text-xs text-accent bg-accent/10 rounded-md px-2.5 py-1.5 mb-3">
                    <Route className="h-3.5 w-3.5" />
                    <span>{priceBreakdown.matchedRoute.name}</span>
                    {priceBreakdown.estimatedDistance && (
                      <span className="text-muted-foreground ml-auto">~{priceBreakdown.estimatedDistance} km</span>
                    )}
                  </div>
                )}

                {priceBreakdown.isHourly ? (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {t.orderSummary.hourlyRate.replace('{hours}', String(priceBreakdown.bookingHours || 0))}
                    </span>
                    <span className="text-foreground">
                      {formatPrice((priceBreakdown.hourlyRate || 0) * (priceBreakdown.bookingHours || 0))}
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t.orderSummary.baseFare}</span>
                      <span className="text-foreground">{formatPrice(priceBreakdown.basePrice)}</span>
                    </div>

                    {priceBreakdown.distancePrice > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {t.orderSummary.distance.replace('{km}', String(priceBreakdown.estimatedDistance))}
                        </span>
                        <span className="text-foreground">{formatPrice(priceBreakdown.distancePrice)}</span>
                      </div>
                    )}
                  </>
                )}

                {priceBreakdown.zoneMultiplier !== 1 && priceBreakdown.zoneName && (
                  <div className="flex justify-between text-sm">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-muted-foreground flex items-center gap-1 cursor-help">
                            {t.orderSummary.zone.replace('{name}', priceBreakdown.zoneName)}
                            <Info className="h-3 w-3" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{t.orderSummary.priceAdjustedForZone}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <span className="text-foreground">×{priceBreakdown.zoneMultiplier.toFixed(2)}</span>
                  </div>
                )}

                {priceBreakdown.appliedRules.length > 0 && (
                  <div className="space-y-1">
                    {priceBreakdown.appliedRules.map((rule, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Tag className="h-3 w-3" />
                          {rule.name}
                        </span>
                        <span className={cn(
                          "text-foreground",
                          rule.type === 'multiplier' && rule.adjustment > 1 && "text-orange-500",
                          rule.type === 'multiplier' && rule.adjustment < 1 && "text-green-500"
                        )}>
                          {rule.type === 'multiplier' 
                            ? `×${rule.adjustment.toFixed(2)}`
                            : `+${formatPrice(rule.adjustment)}`
                          }
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {priceBreakdown.stopSurcharge && priceBreakdown.stopSurcharge > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t.orderSummary.stopSurcharges}</span>
                    <span className="text-foreground">+{formatPrice(priceBreakdown.stopSurcharge)}</span>
                  </div>
                )}

                {priceBreakdown.returnMultiplier > 1 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t.orderSummary.returnTrip}</span>
                    <span className="text-foreground">×2</span>
                  </div>
                )}

                {priceBreakdown.returnDiscount && priceBreakdown.returnDiscount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-green-600 dark:text-green-400">{t.orderSummary.returnDiscount}</span>
                    <span className="text-green-600 dark:text-green-400">-{formatPrice(priceBreakdown.returnDiscount)}</span>
                  </div>
                )}

                {appliedDiscount && (
                  <>
                    <Separator className="my-3" />
                    <div className="flex justify-between text-sm">
                       <span className="text-muted-foreground">{t.orderSummary.subtotal}</span>
                       <span className="text-foreground">{formatPrice(originalTotal)}</span>
                    </div>
                    
                    <div className="flex justify-between text-sm animate-fade-in">
                      <span className="text-green-600 dark:text-green-400 flex items-center gap-1.5">
                        <Tag className="h-3.5 w-3.5" />
                        {appliedDiscount.code}
                        <span className="text-xs font-normal text-muted-foreground">
                          ({appliedDiscount.description})
                        </span>
                      </span>
                        <span className="text-green-600 dark:text-green-400 font-medium">
                          -{formatPrice(discountAmount)}
                      </span>
                    </div>
                  </>
                )}

                <Separator className="my-3" />

                <div className="flex justify-between items-center">
                  <span className="font-semibold text-foreground">{t.orderSummary.total}</span>
                  <div className="text-right">
                    {appliedDiscount && (
                      <span className="text-sm text-muted-foreground line-through mr-2">
                        {formatPrice(originalTotal)}
                      </span>
                    )}
                    <span className={cn(
                      "text-xl font-bold",
                      appliedDiscount ? "text-green-600 dark:text-green-400" : "text-accent"
                    )}>
                      {formatPrice(discountedTotal)}
                    </span>
                  </div>
                </div>

                <div className="mt-4 rounded-lg bg-accent/10 p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-foreground font-medium">
                      {t.orderSummary.depositDueNow.replace('{pct}', String(bookingPolicies.depositPercentage))}
                    </span>
                    <span className="font-bold text-accent">{formatPrice(depositAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t.orderSummary.remainingOnPickup}</span>
                    <span className="text-foreground">{formatPrice(remainingAmount)}</span>
                  </div>
                  <div className="mt-2 h-2 bg-background rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-accent rounded-full transition-all duration-500"
                      style={{ width: `${bookingPolicies.depositPercentage}%` }}
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-4 text-sm text-muted-foreground">
                {t.orderSummary.priceWillBeCalculated}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
