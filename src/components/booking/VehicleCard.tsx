import { Users, Briefcase, Check, Route, TrendingUp, Heart, ChevronDown, ChevronUp, DollarSign, MapPin, Clock, Tag, AlertTriangle, GitCompare, Maximize2, Timer, Percent } from 'lucide-react';
import { Vehicle, ServiceType } from '@/types/booking';
import { cn } from '@/lib/utils';
import { VehiclePriceEstimate } from '@/hooks/useVehiclePricing';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useFavoriteVehicles } from '@/hooks/useFavoriteVehicles';
import { useAuth } from '@/contexts/AuthContext';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';

type BadgeType = 'best-value' | 'popular' | 'most-spacious' | null;

interface VehicleCardProps {
  vehicle: Vehicle;
  isSelected: boolean;
  onSelect: () => void;
  priceEstimate?: VehiclePriceEstimate | null;
  isReturnTrip?: boolean;
  luggageCount?: number;
  isInCompare?: boolean;
  onToggleCompare?: (vehicleId: string) => void;
  showCompareCheckbox?: boolean;
  badge?: BadgeType;
  serviceType?: ServiceType;
}

export function VehicleCard({ 
  vehicle, 
  isSelected, 
  onSelect, 
  priceEstimate, 
  isReturnTrip,
  luggageCount = 0,
  isInCompare = false,
  onToggleCompare,
  showCompareCheckbox = false,
  badge,
  serviceType = 'flat-rate',
}: VehicleCardProps) {
  const { user } = useAuth();
  const { formatPrice } = useSystemSettings();
  const { t } = useLanguage();
  const vc = (t as any).vehicleCard || {};
  const { toggleFavorite, isFavorite } = useFavoriteVehicles();
  const isVehicleFavorite = isFavorite(vehicle.id);
  const [showBreakdown, setShowBreakdown] = useState(false);
  
  const hasBasePrice = vehicle.base_price && vehicle.base_price > 0;
  const hasEstimate = priceEstimate && priceEstimate.estimatedTotal > 0;
  
  // Check if dynamic pricing differs from base
  const hasDynamicAdjustment = hasEstimate && hasBasePrice && 
    Math.abs(priceEstimate.estimatedTotal - (vehicle.base_price! * (isReturnTrip ? 2 : 1))) > 0.01;

  const hasBreakdownDetails = hasEstimate && (
    priceEstimate.distancePrice > 0 || 
    priceEstimate.appliedRules.length > 0 || 
    (priceEstimate.zoneMultiplier && priceEstimate.zoneMultiplier !== 1)
  );

  // Luggage capacity warning
  const hasLuggageWarning = luggageCount > 0 && vehicle.luggage < luggageCount;

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (user) {
      toggleFavorite.mutate(vehicle.id);
    }
  };

  const handleBreakdownToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowBreakdown(!showBreakdown);
  };

  const handleCompareToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleCompare?.(vehicle.id);
  };

  return (
    <div
      className={cn(
        'vehicle-card',
        isSelected && 'selected',
        hasLuggageWarning && 'border-amber-500/50'
      )}
      onClick={onSelect}
    >
      {/* Luggage Warning Badge */}
      {hasLuggageWarning && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="absolute inset-inline-start-3 top-3 z-10 flex items-center gap-1 rounded-full bg-amber-500/90 px-2 py-1 text-xs font-medium text-white">
                <AlertTriangle className="h-3 w-3" />
                <span>{vc.lowCapacity || 'Low capacity'}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{(vc.fitsXBags || 'This vehicle fits {luggage} bags, but you need {needed}').replace('{luggage}', String(vehicle.luggage)).replace('{needed}', String(luggageCount))}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Selection Indicator */}
      {isSelected && !badge && !priceEstimate?.hasRouteMatch && (
        <div className="absolute inset-inline-end-3 top-3 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="h-4 w-4" />
        </div>
      )}
      {isSelected && (badge || priceEstimate?.hasRouteMatch) && (
        <div className="absolute inset-inline-end-3 top-10 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="h-4 w-4" />
        </div>
      )}

      {/* Compare Checkbox */}
      {showCompareCheckbox && (
        <div
          className={cn(
            "absolute inset-inline-start-3 z-10",
            hasLuggageWarning ? "top-10" : "top-3"
          )}
          onClick={handleCompareToggle}
        >
          <div className={cn(
            "flex items-center gap-1.5 rounded-full px-2 py-1 text-xs transition-colors",
            isInCompare 
              ? "bg-accent text-accent-foreground" 
              : "bg-muted/80 text-muted-foreground hover:bg-muted"
          )}>
            <Checkbox 
              checked={isInCompare} 
              className="h-3.5 w-3.5 border-current"
            />
            <span>{vc.compare || 'Compare'}</span>
          </div>
        </div>
      )}

      {/* Favorite Button */}
      {user && (
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "absolute inset-inline-end-3 top-10 h-7 w-7 rounded-full",
            isVehicleFavorite ? "text-red-500" : "text-muted-foreground hover:text-red-500"
          )}
          onClick={handleFavoriteClick}
          disabled={toggleFavorite.isPending}
        >
          <Heart className={cn("h-4 w-4", isVehicleFavorite && "fill-current")} />
        </Button>
      )}

      {/* Recommendation Badge */}
      {badge && !priceEstimate?.hasRouteMatch && (
        <div className={cn(
          "absolute inset-inline-end-3 top-3 z-10 flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
          badge === 'best-value' && "bg-emerald-500 text-white",
          badge === 'popular' && "bg-amber-500 text-white",
          badge === 'most-spacious' && "bg-sky-500 text-white"
        )}>
          {badge === 'best-value' && (
            <>
              <TrendingUp className="h-3 w-3" />
              <span>{vc.bestValue || 'Best Value'}</span>
            </>
          )}
          {badge === 'popular' && (
            <>
              <Heart className="h-3 w-3 fill-current" />
              <span>{vc.popular || 'Popular'}</span>
            </>
          )}
          {badge === 'most-spacious' && (
            <>
              <Maximize2 className="h-3 w-3" />
              <span>{vc.mostSpacious || 'Most Spacious'}</span>
            </>
          )}
        </div>
      )}

      {/* Route Match Badge */}
      {priceEstimate?.hasRouteMatch && (
        <div className="absolute inset-inline-end-3 top-3 z-10 flex items-center gap-1 rounded-full bg-primary/90 px-2 py-1 text-xs font-medium text-primary-foreground">
          <Route className="h-3 w-3" />
          <span>{vc.routeMatched || 'Route matched'}</span>
        </div>
      )}

      {/* Vehicle Image */}
      <div className="mb-4 aspect-[16/10] overflow-hidden rounded-lg bg-muted">
        <img
          src={vehicle.image}
          alt={vehicle.name}
          className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
        />
      </div>

      {/* Vehicle Info */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            {/* Category Badge */}
            <span className="inline-block rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
              {vehicle.category}
            </span>

            {/* Name */}
            <h3 className="mt-2 font-display text-lg font-semibold text-foreground">
              {vehicle.name}
            </h3>
          </div>

          {/* Price */}
          <div className="text-right">
            {hasEstimate ? (
              <div>
                <div className="flex items-center gap-1 justify-end">
                  <p className="text-lg font-bold text-accent">
                    {formatPrice(priceEstimate.estimatedTotal)}
                  </p>
                  {hasDynamicAdjustment && (
                    <TrendingUp className="h-3.5 w-3.5 text-accent" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {priceEstimate.isHourly 
                    ? `${priceEstimate.bookingHours} hr${priceEstimate.bookingHours !== 1 ? 's' : ''}${isReturnTrip ? ` ${vc.returnLabel || '(return)'}` : ''}`
                    : `${vc.estimated || 'estimated'}${isReturnTrip ? ` ${vc.returnLabel || '(return)'}` : ''}`
                  }
                </p>
                {priceEstimate.isHourly && priceEstimate.hourlyRate > 0 && (
                  <p className="text-xs text-muted-foreground flex items-center gap-0.5 justify-end">
                    <Timer className="h-3 w-3" />
                    {formatPrice(priceEstimate.hourlyRate)}/hr
                  </p>
                )}
                {!priceEstimate.isHourly && priceEstimate.estimatedDistance && (
                  <p className="text-xs text-muted-foreground">
                    ~{priceEstimate.estimatedDistance.toFixed(1)} km
                  </p>
                )}
                {priceEstimate.returnDiscount > 0 && (
                  <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-0.5 justify-end">
                    <Percent className="h-3 w-3" />
                    -{formatPrice(priceEstimate.returnDiscount)} {vc.returnDiscount || 'return discount'}
                  </p>
                )}
              </div>
            ) : serviceType === 'hourly' && vehicle.hourly_rate && vehicle.hourly_rate > 0 ? (
              <>
                <p className="text-lg font-bold text-accent">
                  {formatPrice(vehicle.hourly_rate)}
                </p>
                <p className="text-xs text-muted-foreground">{vc.perHour || '/hour'}</p>
                {vehicle.min_hours && vehicle.min_hours > 1 && (
                  <p className="text-xs text-muted-foreground">
                    min {vehicle.min_hours} hrs
                  </p>
                )}
              </>
            ) : hasBasePrice ? (
              <>
                <p className="text-lg font-bold text-accent">
                  {formatPrice(vehicle.base_price || 0)}
                </p>
                {vehicle.price_per_km && vehicle.price_per_km > 0 && (
                  <p className="text-xs text-muted-foreground">
                    +{formatPrice(vehicle.price_per_km || 0)}{vc.perKm || '/km'}
                  </p>
                )}
              </>
            ) : null}
          </div>
        </div>

        {/* Capacity */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span>{(vc.upTo || 'Up to {count}').replace('{count}', String(vehicle.passengers))}</span>
          </div>
          <div className={cn(
            "flex items-center gap-1",
            hasLuggageWarning && "text-amber-500 font-medium"
          )}>
            <Briefcase className="h-4 w-4" />
            <span>{(vc.bags || '{count} bags').replace('{count}', String(vehicle.luggage))}</span>
            {hasLuggageWarning && (
              <span className="text-xs">{(vc.needed || '({count} needed)').replace('{count}', String(luggageCount))}</span>
            )}
          </div>
        </div>

        {/* Features */}
        <div className="flex flex-wrap gap-1">
          {vehicle.features.slice(0, 3).map((feature) => (
            <span
              key={feature}
              className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground"
            >
              {feature}
            </span>
          ))}
          {vehicle.features.length > 3 && (
            <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              +{vehicle.features.length - 3} {vc.more || 'more'}
            </span>
          )}
        </div>

        {/* Price Breakdown */}
        {hasEstimate && (hasBreakdownDetails || priceEstimate.isHourly || priceEstimate.stopSurcharge > 0 || priceEstimate.returnDiscount > 0) && (
          <Collapsible open={showBreakdown} onOpenChange={setShowBreakdown}>
            <CollapsibleTrigger asChild>
              <button
                onClick={handleBreakdownToggle}
                className="flex w-full items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted"
              >
                <span className="flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5" />
                  {vc.viewPriceBreakdown || 'View price breakdown'}
                </span>
                {showBreakdown ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 space-y-1.5 rounded-lg border border-border bg-card p-3 text-xs">
                {/* Hourly Rate */}
                {priceEstimate.isHourly ? (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Timer className="h-3 w-3" />
                      {formatPrice(priceEstimate.hourlyRate)}/hr × {priceEstimate.bookingHours} hrs
                    </span>
                    <span className="font-medium text-foreground">
                      {formatPrice(priceEstimate.hourlyRate * priceEstimate.bookingHours)}
                    </span>
                  </div>
                ) : (
                  <>
                    {/* Base Price */}
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                      <DollarSign className="h-3 w-3" />
                      {vc.baseFare || 'Base fare'}
                      </span>
                      <span className="font-medium text-foreground">
                        {formatPrice(priceEstimate.basePrice)}
                      </span>
                    </div>

                    {/* Distance Price */}
                    {priceEstimate.distancePrice > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {(vc.distanceLabel || 'Distance ({km} km)').replace('{km}', priceEstimate.estimatedDistance?.toFixed(1) || '0')}
                        </span>
                        <span className="font-medium text-foreground">
                          +{formatPrice(priceEstimate.distancePrice)}
                        </span>
                      </div>
                    )}

                    {/* Zone Multiplier */}
                    {priceEstimate.zoneMultiplier && priceEstimate.zoneMultiplier !== 1 && (
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <Route className="h-3 w-3" />
                          {priceEstimate.zoneName || vc.zone || 'Zone'} ({priceEstimate.zoneMultiplier}x)
                        </span>
                        <span className="font-medium text-amber-500">
                          ×{priceEstimate.zoneMultiplier.toFixed(2)}
                        </span>
                      </div>
                    )}

                    {/* Stop Surcharge */}
                    {priceEstimate.stopSurcharge > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {vc.stopSurcharges || 'Stop surcharges'}
                        </span>
                        <span className="font-medium text-foreground">
                          +{formatPrice(priceEstimate.stopSurcharge)}
                        </span>
                      </div>
                    )}
                  </>
                )}

                {/* Applied Rules */}
                {priceEstimate.appliedRules.map((rule, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      {rule.type === 'multiplier' ? (
                        <Clock className="h-3 w-3" />
                      ) : (
                        <Tag className="h-3 w-3" />
                      )}
                      {rule.name}
                    </span>
                    <span className={cn(
                      "font-medium",
                      rule.type === 'multiplier' 
                        ? rule.adjustment > 1 ? "text-amber-500" : "text-green-500"
                        : "text-foreground"
                    )}>
                      {rule.type === 'multiplier' 
                        ? `×${rule.adjustment.toFixed(2)}`
                        : `+${formatPrice(rule.adjustment)}`
                      }
                    </span>
                  </div>
                ))}

                {/* Return Trip */}
                {isReturnTrip && (
                  <div className="flex items-center justify-between border-t border-border pt-1.5">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Route className="h-3 w-3" />
                      {vc.returnTripLabel || 'Return trip'}
                    </span>
                    <span className="font-medium text-foreground">
                      ×2
                    </span>
                  </div>
                )}

                {/* Return Discount */}
                {priceEstimate.returnDiscount > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                      <Percent className="h-3 w-3" />
                      {vc.returnDiscount || 'Return discount'}
                    </span>
                    <span className="font-medium text-green-600 dark:text-green-400">
                      -{formatPrice(priceEstimate.returnDiscount)}
                    </span>
                  </div>
                )}

                {/* Total */}
                <div className="flex items-center justify-between border-t border-border pt-1.5">
                  <span className="font-semibold text-foreground">{vc.total || 'Total'}</span>
                  <span className="font-bold text-accent">
                    {formatPrice(priceEstimate.estimatedTotal)}
                  </span>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  );
}
