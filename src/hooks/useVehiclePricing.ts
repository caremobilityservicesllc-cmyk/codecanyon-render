import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Vehicle, TransferType } from '@/types/booking';
import { getDay } from 'date-fns';

interface PricingRule {
  id: string;
  name: string;
  rule_type: 'time' | 'distance' | 'zone' | 'vehicle';
  multiplier: number;
  flat_fee: number;
  priority: number;
  vehicle_id: string | null;
  vehicle_category: string | null;
  zone_id: string | null;
  min_distance_km: number | null;
  max_distance_km: number | null;
  start_time: string | null;
  end_time: string | null;
  days_of_week: string[] | null;
}

interface Route {
  id: string;
  name: string;
  origin_name: string;
  destination_name: string;
  base_price: number;
  estimated_distance_km: number | null;
  origin_zone_id: string | null;
  destination_zone_id: string | null;
}

interface Zone {
  id: string;
  name: string;
  multiplier: number;
}

export interface VehiclePriceEstimate {
  basePrice: number;
  distancePrice: number;
  estimatedTotal: number;
  hasRouteMatch: boolean;
  estimatedDistance: number | null;
  appliedRules: { name: string; adjustment: number; type: 'multiplier' | 'fee' }[];
  zoneMultiplier: number;
  zoneName: string | null;
  isHourly: boolean;
  hourlyRate: number;
  bookingHours: number;
  stopSurcharge: number;
  returnDiscount: number;
}

const dayOfWeekMap: Record<number, string> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
};

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function isTimeInRange(time: string, start: string, end: string): boolean {
  const t = timeToMinutes(time);
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  
  if (s > e) {
    return t >= s || t <= e;
  }
  return t >= s && t <= e;
}

interface BookingContext {
  pickupLocation: string;
  dropoffLocation: string;
  pickupDate: Date | null;
  pickupTime: string;
  transferType: TransferType;
  routeDistanceKm?: number | null;
  serviceType?: 'hourly' | 'flat-rate';
  bookingHours?: number;
  stops?: string[];
}

export function useVehiclePricing(bookingContext: BookingContext) {
  // Fetch all active pricing rules
  const { data: pricingRules } = useQuery({
    queryKey: ['pricing-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pricing_rules')
        .select('*')
        .eq('is_active', true)
        .order('priority', { ascending: false });
      
      if (error) throw error;
      return data as PricingRule[];
    },
  });

  // Fetch all active zones
  const { data: zones } = useQuery({
    queryKey: ['zones'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zones')
        .select('*')
        .eq('is_active', true);
      
      if (error) throw error;
      return data as Zone[];
    },
  });

  // Fetch all active routes
  const { data: routes } = useQuery({
    queryKey: ['routes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('routes')
        .select('*')
        .eq('is_active', true);
      
      if (error) throw error;
      return data as Route[];
    },
  });

  // Fetch stop surcharge and return discount settings
  const { data: pricingSettings } = useQuery({
    queryKey: ['pricing-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', ['stop_surcharges', 'return_trip_discount']);
      
      if (error) throw error;
      const map: Record<string, any> = {};
      data?.forEach(s => { map[s.key] = s.value; });
      return map;
    },
  });

  const matchedRoute = findMatchingRoute(
    bookingContext.pickupLocation,
    bookingContext.dropoffLocation,
    routes || []
  );

  const isHourly = bookingContext.serviceType === 'hourly';
  const bookingHours = bookingContext.bookingHours || 2;

  const calculateVehiclePrice = (vehicle: Vehicle): VehiclePriceEstimate => {
    const appliedRules: VehiclePriceEstimate['appliedRules'] = [];
    let hourlyRate = vehicle.hourly_rate || 0;
    let stopSurcharge = 0;
    let returnDiscount = 0;

    // ── HOURLY MODE ──
    if (isHourly) {
      const effectiveHours = Math.max(bookingHours, vehicle.min_hours || 1);
      const baseHourlyTotal = hourlyRate * effectiveHours;
      
      // Apply pricing rules to hourly total
      let ruleMultiplier = 1;
      let ruleFees = 0;
      if (pricingRules) {
        for (const rule of pricingRules) {
          if (shouldApplyRule(rule, vehicle, bookingContext, null)) {
            if (rule.multiplier !== 1) {
              ruleMultiplier *= rule.multiplier;
              appliedRules.push({ name: rule.name, adjustment: rule.multiplier, type: 'multiplier' });
            }
            if (rule.flat_fee > 0) {
              ruleFees += rule.flat_fee;
              appliedRules.push({ name: rule.name, adjustment: rule.flat_fee, type: 'fee' });
            }
          }
        }
      }

      const subtotal = baseHourlyTotal * ruleMultiplier + ruleFees;
      const returnMultiplier = getReturnMultiplier(bookingContext.transferType);
      
      // Apply return discount
      let total = subtotal * returnMultiplier;
      if (returnMultiplier > 1 && pricingSettings?.return_trip_discount?.enabled) {
        const discPct = pricingSettings.return_trip_discount.discountPercentage || 0;
        returnDiscount = total * (discPct / 100);
        total -= returnDiscount;
      }

      return {
        basePrice: hourlyRate,
        distancePrice: 0,
        estimatedTotal: total,
        hasRouteMatch: false,
        estimatedDistance: null,
        appliedRules,
        zoneMultiplier: 1,
        zoneName: null,
        isHourly: true,
        hourlyRate,
        bookingHours: effectiveHours,
        stopSurcharge: 0,
        returnDiscount,
      };
    }

    // ── FLAT-RATE MODE ──
    let basePrice = vehicle.base_price || 0;
    let estimatedDistance = bookingContext.routeDistanceKm ?? matchedRoute?.estimated_distance_km ?? null;
    let distancePrice = 0;
    let zoneMultiplier = 1;
    let zoneName: string | null = null;

    // Route matching
    if (matchedRoute) {
      basePrice = matchedRoute.base_price;
      if (matchedRoute.destination_zone_id && zones) {
        const zone = zones.find(z => z.id === matchedRoute.destination_zone_id);
        if (zone) {
          zoneMultiplier = zone.multiplier;
          zoneName = zone.name;
        }
      }
    }

    // Distance-based fallback pricing
    if (estimatedDistance && vehicle.price_per_km) {
      distancePrice = estimatedDistance * vehicle.price_per_km;
    }

    // Apply pricing rules
    let ruleMultiplier = 1;
    let ruleFees = 0;
    if (pricingRules) {
      for (const rule of pricingRules) {
        if (shouldApplyRule(rule, vehicle, bookingContext, estimatedDistance)) {
          if (rule.multiplier !== 1) {
            ruleMultiplier *= rule.multiplier;
            appliedRules.push({ name: rule.name, adjustment: rule.multiplier, type: 'multiplier' });
          }
          if (rule.flat_fee > 0) {
            ruleFees += rule.flat_fee;
            appliedRules.push({ name: rule.name, adjustment: rule.flat_fee, type: 'fee' });
          }
        }
      }
    }

    // Stop surcharges
    const validStops = (bookingContext.stops || []).filter(s => s.trim().length > 0);
    if (validStops.length > 0 && pricingSettings?.stop_surcharges?.enabled) {
      const perStopFee = pricingSettings.stop_surcharges.perStopFee || 0;
      stopSurcharge = perStopFee * validStops.length;
    }

    const subtotal = (basePrice + distancePrice) * zoneMultiplier * ruleMultiplier + ruleFees + stopSurcharge;
    const returnMultiplier = getReturnMultiplier(bookingContext.transferType);
    let total = subtotal * returnMultiplier;

    // Apply return discount
    if (returnMultiplier > 1 && pricingSettings?.return_trip_discount?.enabled) {
      const discPct = pricingSettings.return_trip_discount.discountPercentage || 0;
      returnDiscount = total * (discPct / 100);
      total -= returnDiscount;
    }

    return {
      basePrice: vehicle.base_price || 0,
      distancePrice,
      estimatedTotal: total,
      hasRouteMatch: !!matchedRoute,
      estimatedDistance,
      appliedRules,
      zoneMultiplier,
      zoneName,
      isHourly: false,
      hourlyRate: 0,
      bookingHours: 0,
      stopSurcharge,
      returnDiscount,
    };
  };

  return {
    calculateVehiclePrice,
    matchedRoute,
    isLoading: !pricingRules || !zones || !routes,
  };
}

function findMatchingRoute(
  pickup: string,
  dropoff: string,
  routes: Route[]
): Route | null {
  if (!pickup || !dropoff || routes.length === 0) {
    return null;
  }

  const pickupLower = pickup.toLowerCase();
  const dropoffLower = dropoff.toLowerCase();

  for (const route of routes) {
    const originMatch = 
      pickupLower.includes(route.origin_name.toLowerCase()) ||
      route.origin_name.toLowerCase().includes(pickupLower);
    const destMatch = 
      dropoffLower.includes(route.destination_name.toLowerCase()) ||
      route.destination_name.toLowerCase().includes(dropoffLower);
    
    if (originMatch && destMatch) {
      return route;
    }
  }

  return null;
}

function shouldApplyRule(
  rule: PricingRule,
  vehicle: Vehicle,
  bookingContext: BookingContext,
  estimatedDistance: number | null
): boolean {
  // Check vehicle-specific rule
  if (rule.rule_type === 'vehicle') {
    if (rule.vehicle_id && rule.vehicle_id !== vehicle.id) {
      return false;
    }
    if (rule.vehicle_category && rule.vehicle_category !== vehicle.category) {
      return false;
    }
    return true;
  }

  // Check distance-based rule
  if (rule.rule_type === 'distance') {
    if (!estimatedDistance) return false;
    
    const minOk = rule.min_distance_km === null || estimatedDistance >= rule.min_distance_km;
    const maxOk = rule.max_distance_km === null || estimatedDistance <= rule.max_distance_km;
    
    return minOk && maxOk;
  }

  // Check time-based rule
  if (rule.rule_type === 'time') {
    if (!bookingContext.pickupDate || !bookingContext.pickupTime) {
      return false;
    }

    // Check day of week
    if (rule.days_of_week && rule.days_of_week.length > 0) {
      const dayNum = getDay(bookingContext.pickupDate);
      const dayName = dayOfWeekMap[dayNum];
      if (!rule.days_of_week.includes(dayName)) {
        return false;
      }
    }

    // Check time range
    if (rule.start_time && rule.end_time) {
      if (!isTimeInRange(bookingContext.pickupTime, rule.start_time, rule.end_time)) {
        return false;
      }
    }

    return true;
  }

  return false;
}

function getReturnMultiplier(transferType: TransferType): number {
  switch (transferType) {
    case 'return':
    case 'return-new-ride':
      return 2;
    case 'one-way':
    default:
      return 1;
  }
}
