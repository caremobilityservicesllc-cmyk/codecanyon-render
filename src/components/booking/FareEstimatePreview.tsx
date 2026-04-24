import { useQuery } from '@tanstack/react-query';
import { DollarSign, Car, TrendingUp, Loader2, Clock, Zap, Moon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Vehicle, TransferType } from '@/types/booking';
import { cn } from '@/lib/utils';
import { format, getDay } from 'date-fns';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { useLanguage } from '@/contexts/LanguageContext';

interface FareEstimatePreviewProps {
  routeDistanceKm: number | null;
  transferType: TransferType;
  pickupDate: Date | null;
  pickupTime: string;
  serviceType?: 'hourly' | 'flat-rate';
  bookingHours?: number;
  className?: string;
}

type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

interface PricingRule {
  id: string;
  name: string;
  rule_type: string;
  multiplier: number;
  flat_fee: number;
  start_time: string | null;
  end_time: string | null;
  days_of_week: DayOfWeek[] | null;
  is_active: boolean;
}

const DAY_MAP: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export function FareEstimatePreview({
  routeDistanceKm,
  transferType,
  pickupDate,
  pickupTime,
  serviceType = 'flat-rate',
  bookingHours = 2,
  className,
}: FareEstimatePreviewProps) {
  const { formatDistance, formatPrice, convertDistance, distanceAbbr } = useSystemSettings();
  const { t } = useLanguage();
  const fe = (t as any).fareEstimate || {};

  const { data: vehicles, isLoading: vehiclesLoading } = useQuery({
    queryKey: ['fare-estimate-vehicles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicles')
        .select('id, name, category, base_price, price_per_km, hourly_rate, min_hours, max_hours')
        .eq('is_active', true)
        .order('base_price', { ascending: true });
      if (error) throw error;
      return data as Pick<Vehicle, 'id' | 'name' | 'category' | 'base_price' | 'price_per_km' | 'hourly_rate' | 'min_hours' | 'max_hours'>[];
    },
  });

  const { data: pricingRules } = useQuery({
    queryKey: ['fare-estimate-pricing-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pricing_rules')
        .select('id, name, rule_type, multiplier, flat_fee, start_time, end_time, days_of_week, is_active')
        .eq('is_active', true)
        .eq('rule_type', 'time');
      if (error) throw error;
      return data as PricingRule[];
    },
  });

  const getApplicableTimeRules = () => {
    if (!pricingRules || !pickupDate || !pickupTime) return [];
    const dayOfWeek = DAY_MAP[getDay(pickupDate)];
    const [hours, minutes] = pickupTime.split(':').map(Number);
    const timeInMinutes = hours * 60 + minutes;

    return pricingRules.filter((rule) => {
      if (rule.days_of_week && rule.days_of_week.length > 0) {
        if (!rule.days_of_week.includes(dayOfWeek)) return false;
      }
      if (rule.start_time && rule.end_time) {
        const [startH, startM] = rule.start_time.split(':').map(Number);
        const [endH, endM] = rule.end_time.split(':').map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;
        if (startMinutes > endMinutes) {
          if (timeInMinutes < startMinutes && timeInMinutes >= endMinutes) return false;
        } else {
          if (timeInMinutes < startMinutes || timeInMinutes >= endMinutes) return false;
        }
      }
      return true;
    });
  };

  const applicableRules = getApplicableTimeRules();
  const isPeakTime = applicableRules.some((rule) => rule.multiplier > 1);
  const isDiscountTime = applicableRules.some((rule) => rule.multiplier < 1);
  const peakMultiplier = applicableRules.reduce((max, rule) => Math.max(max, rule.multiplier), 1);
  const discountMultiplier = applicableRules.reduce((min, rule) => Math.min(min, rule.multiplier), 1);

  const isHourly = serviceType === 'hourly';

  const renderLoading = () => (
    <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>{fe.calculatingFare || 'Calculating fare estimates...'}</span>
    </div>
  );

  const renderTimeBadge = () => {
    if (!pickupDate || !pickupTime) return null;
    if (isPeakTime) {
      return (
        <div className="flex items-center gap-1 rounded-full bg-orange-500/10 px-2.5 py-1 border border-orange-500/20">
          <Zap className="h-3.5 w-3.5 text-orange-500" />
          <span className="text-xs font-medium text-orange-600 dark:text-orange-400">
            {(fe.peak || 'Peak +{percent}%').replace('{percent}', String(Math.round((peakMultiplier - 1) * 100)))}
          </span>
        </div>
      );
    }
    if (isDiscountTime) {
      return (
        <div className="flex items-center gap-1 rounded-full bg-green-500/10 px-2.5 py-1 border border-green-500/20">
          <Moon className="h-3.5 w-3.5 text-green-500" />
          <span className="text-xs font-medium text-green-600 dark:text-green-400">
            {(fe.offPeak || 'Off-Peak -{percent}%').replace('{percent}', String(Math.round((1 - discountMultiplier) * 100)))}
          </span>
        </div>
      );
    }
    return null;
  };

  if (isHourly) {
    if (vehiclesLoading) return renderLoading();
    if (!vehicles || vehicles.length === 0) return null;

    const returnMultiplier = transferType === 'one-way' ? 1 : 2;
    const timeMultiplier = isPeakTime ? peakMultiplier : (isDiscountTime ? discountMultiplier : 1);

    const estimates = vehicles
      .filter(v => (v.hourly_rate || 0) > 0)
      .map((vehicle) => {
        const effectiveHours = Math.max(bookingHours, vehicle.min_hours || 1);
        const subtotal = (vehicle.hourly_rate || 0) * effectiveHours * returnMultiplier;
        const total = subtotal * timeMultiplier;
        return { ...vehicle, estimatedPrice: total, baseEstimate: subtotal };
      })
      .filter(v => v.estimatedPrice > 0);

    if (estimates.length === 0) return null;

    const sortedByPrice = [...estimates].sort((a, b) => a.estimatedPrice - b.estimatedPrice);
    const minPrice = sortedByPrice[0].estimatedPrice;
    const maxPrice = sortedByPrice[sortedByPrice.length - 1].estimatedPrice;
    const cheapestVehicle = sortedByPrice[0];
    const categories = [...new Set(estimates.map(v => v.category))];

    return (
      <div className={cn("rounded-xl border border-border bg-gradient-to-br from-card to-card/50 p-4", className)}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20">
              <Clock className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold text-foreground text-sm">{fe.hourlyEstimate || 'Hourly Estimate'}</h4>
              <p className="text-xs text-muted-foreground">{(fe.booking || '{hours}h booking').replace('{hours}', String(bookingHours))}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">{renderTimeBadge()}</div>
        </div>
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-2xl font-bold text-primary">{formatPrice(minPrice)}</span>
          {maxPrice !== minPrice && (
            <>
              <span className="text-muted-foreground">–</span>
              <span className="text-2xl font-bold text-primary">{formatPrice(maxPrice)}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 mb-3">
          <Car className="h-4 w-4 text-primary" />
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">{fe.startingFrom || 'Starting from'}</p>
            <p className="text-sm font-medium text-foreground">{cheapestVehicle.name} • {formatPrice(cheapestVehicle.estimatedPrice)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.slice(0, 4).map((category) => {
            const catMin = Math.min(...estimates.filter(v => v.category === category).map(v => v.estimatedPrice));
            return (
              <div key={category} className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1">
                <span className="text-xs font-medium text-secondary-foreground">{category}</span>
                <span className="text-xs text-muted-foreground">{fe.from || 'from'} {formatPrice(catMin)}</span>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{fe.finalPriceMayVary || 'Final price may vary based on vehicle selection and pricing rules'}</p>
      </div>
    );
  }

  // Flat-rate mode
  if (!routeDistanceKm || vehiclesLoading) {
    if (vehiclesLoading && routeDistanceKm) return renderLoading();
    return null;
  }

  if (!vehicles || vehicles.length === 0) return null;

  const returnMultiplier = transferType === 'one-way' ? 1 : 2;
  const timeMultiplier = isPeakTime ? peakMultiplier : (isDiscountTime ? discountMultiplier : 1);
  
  const estimates = vehicles.map((vehicle) => {
    const basePrice = vehicle.base_price || 0;
    const distancePrice = routeDistanceKm * (vehicle.price_per_km || 0);
    const subtotal = (basePrice + distancePrice) * returnMultiplier;
    const total = subtotal * timeMultiplier;
    return { ...vehicle, estimatedPrice: total, baseEstimate: subtotal };
  }).filter(v => v.estimatedPrice > 0);

  if (estimates.length === 0) return null;

  const sortedByPrice = [...estimates].sort((a, b) => a.estimatedPrice - b.estimatedPrice);
  const minPrice = sortedByPrice[0].estimatedPrice;
  const maxPrice = sortedByPrice[sortedByPrice.length - 1].estimatedPrice;
  const cheapestVehicle = sortedByPrice[0];
  const categories = [...new Set(estimates.map(v => v.category))];

  return (
    <div className={cn("rounded-xl border border-border bg-gradient-to-br from-card to-card/50 p-4", className)}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20">
            <DollarSign className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h4 className="font-semibold text-foreground text-sm">{fe.fareEstimate || 'Fare Estimate'}</h4>
            <p className="text-xs text-muted-foreground">{(fe.basedOn || 'Based on {distance}').replace('{distance}', formatDistance(routeDistanceKm))}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {renderTimeBadge() || (pickupDate && pickupTime && (
            <div className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">{fe.standard || 'Standard'}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-2xl font-bold text-primary">{formatPrice(minPrice)}</span>
        {maxPrice !== minPrice && (
          <>
            <span className="text-muted-foreground">–</span>
            <span className="text-2xl font-bold text-primary">{formatPrice(maxPrice)}</span>
          </>
        )}
        {transferType !== 'one-way' && (
          <span className="text-xs text-muted-foreground ml-1">{fe.returnTrip || '(return trip)'}</span>
        )}
      </div>

      {applicableRules.length > 0 && (
        <div className="mb-3 text-xs text-muted-foreground">
          {applicableRules.map((rule) => (
            <div key={rule.id} className="flex items-center gap-1">
              {rule.multiplier > 1 ? (
                <Zap className="h-3 w-3 text-orange-500" />
              ) : rule.multiplier < 1 ? (
                <Moon className="h-3 w-3 text-green-500" />
              ) : (
                <Clock className="h-3 w-3" />
              )}
              <span>{rule.name}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 mb-3">
        <Car className="h-4 w-4 text-primary" />
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">{fe.startingFrom || 'Starting from'}</p>
          <p className="text-sm font-medium text-foreground">{cheapestVehicle.name} • {formatPrice(cheapestVehicle.estimatedPrice)}</p>
        </div>
        <TrendingUp className="h-4 w-4 text-primary" />
      </div>

      <div className="flex flex-wrap gap-2">
        {categories.slice(0, 4).map((category) => {
          const categoryMin = Math.min(...estimates.filter(v => v.category === category).map(v => v.estimatedPrice));
          return (
            <div key={category} className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1">
              <span className="text-xs font-medium text-secondary-foreground">{category}</span>
              <span className="text-xs text-muted-foreground">{fe.from || 'from'} {formatPrice(categoryMin)}</span>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">{fe.finalPriceMayVary || 'Final price may vary based on vehicle selection and pricing rules'}</p>
    </div>
  );
}
