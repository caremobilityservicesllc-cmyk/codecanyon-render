import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BookingDetails, Vehicle, TransferType } from '@/types/booking';
import { format, getDay } from 'date-fns';

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

interface Zone {
  id: string;
  name: string;
  multiplier: number;
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

export interface PriceBreakdown {
  basePrice: number;
  distancePrice: number;
  estimatedDistance: number | null;
  appliedRules: { name: string; adjustment: number; type: 'multiplier' | 'fee' }[];
  zoneMultiplier: number;
  zoneName: string | null;
  subtotal: number;
  returnMultiplier: number;
  total: number;
  deposit: number;
  matchedRoute: Route | null;
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
  
  // Handle overnight ranges (e.g., 22:00 - 06:00)
  if (s > e) {
    return t >= s || t <= e;
  }
  return t >= s && t <= e;
}

export function useDynamicPricing(bookingDetails: BookingDetails, depositPercentage: number = 30, routeDistanceOverride?: number | null) {
  const { data: pricingRules } = useQuery({
    queryKey: ['pricing-rules'],
    queryFn: async () => {
      const { data, error } = await supabase.from('pricing_rules').select('*').eq('is_active', true).order('priority', { ascending: false });
      if (error) throw error;
      return data as PricingRule[];
    },
  });

  const { data: zones } = useQuery({
    queryKey: ['zones'],
    queryFn: async () => {
      const { data, error } = await supabase.from('zones').select('*').eq('is_active', true);
      if (error) throw error;
      return data as Zone[];
    },
  });

  const { data: routes } = useQuery({
    queryKey: ['routes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('routes').select('*').eq('is_active', true);
      if (error) throw error;
      return data as Route[];
    },
  });

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

  const calculatePrice = (): PriceBreakdown | null => {
    if (!bookingDetails.selectedVehicle) return null;

    const vehicle = bookingDetails.selectedVehicle;
    const appliedRules: PriceBreakdown['appliedRules'] = [];
    const isHourly = bookingDetails.serviceType === 'hourly';
    const bookingHours = bookingDetails.bookingHours || 2;
    const hourlyRate = vehicle.hourly_rate || 0;

    // ── HOURLY MODE ──
    if (isHourly) {
      const effectiveHours = Math.max(bookingHours, vehicle.min_hours || 1);
      const baseHourlyTotal = hourlyRate * effectiveHours;

      let ruleMultiplier = 1;
      let ruleFees = 0;
      if (pricingRules) {
        for (const rule of pricingRules) {
          if (shouldApplyRule(rule, bookingDetails, null)) {
            if (rule.multiplier !== 1) { ruleMultiplier *= rule.multiplier; appliedRules.push({ name: rule.name, adjustment: rule.multiplier, type: 'multiplier' }); }
            if (rule.flat_fee > 0) { ruleFees += rule.flat_fee; appliedRules.push({ name: rule.name, adjustment: rule.flat_fee, type: 'fee' }); }
          }
        }
      }

      const subtotal = baseHourlyTotal * ruleMultiplier + ruleFees;
      const returnMultiplier = getReturnMultiplier(bookingDetails.transferType);
      let total = subtotal * returnMultiplier;
      let returnDiscount = 0;

      if (returnMultiplier > 1 && pricingSettings?.return_trip_discount?.enabled) {
        const discPct = pricingSettings.return_trip_discount.discountPercentage || 0;
        returnDiscount = total * (discPct / 100);
        total -= returnDiscount;
      }

      const deposit = total * (depositPercentage / 100);

      return {
        basePrice: hourlyRate, distancePrice: 0, estimatedDistance: null, appliedRules,
        zoneMultiplier: 1, zoneName: null, subtotal, returnMultiplier, total, deposit,
        matchedRoute: null, isHourly: true, hourlyRate, bookingHours: effectiveHours,
        stopSurcharge: 0, returnDiscount,
      };
    }

    // ── FLAT-RATE MODE ──
    const matchedRoute = findMatchingRoute(bookingDetails.pickupLocation, bookingDetails.dropoffLocation, routes || []);
    let basePrice = vehicle.base_price || 0;
    let estimatedDistance = routeDistanceOverride ?? bookingDetails.routeDistanceKm ?? matchedRoute?.estimated_distance_km ?? null;
    let distancePrice = 0;
    let zoneName: string | null = null;
    let zoneMultiplier = 1;

    if (matchedRoute) {
      basePrice = matchedRoute.base_price;
      if (matchedRoute.destination_zone_id && zones) {
        const zone = zones.find(z => z.id === matchedRoute.destination_zone_id);
        if (zone) { zoneMultiplier = zone.multiplier; zoneName = zone.name; }
      }
    }

    if (estimatedDistance && vehicle.price_per_km) {
      distancePrice = estimatedDistance * vehicle.price_per_km;
    }

    let ruleMultiplier = 1;
    let ruleFees = 0;
    if (pricingRules) {
      for (const rule of pricingRules) {
        if (shouldApplyRule(rule, bookingDetails, estimatedDistance)) {
          if (rule.multiplier !== 1) { ruleMultiplier *= rule.multiplier; appliedRules.push({ name: rule.name, adjustment: rule.multiplier, type: 'multiplier' }); }
          if (rule.flat_fee > 0) { ruleFees += rule.flat_fee; appliedRules.push({ name: rule.name, adjustment: rule.flat_fee, type: 'fee' }); }
        }
      }
    }

    // Stop surcharges
    let stopSurcharge = 0;
    const validStops = (bookingDetails.stops || []).filter(s => s.trim().length > 0);
    if (validStops.length > 0 && pricingSettings?.stop_surcharges?.enabled) {
      stopSurcharge = (pricingSettings.stop_surcharges.perStopFee || 0) * validStops.length;
    }

    const subtotal = (basePrice + distancePrice) * zoneMultiplier * ruleMultiplier + ruleFees + stopSurcharge;
    const returnMultiplier = getReturnMultiplier(bookingDetails.transferType);
    let total = subtotal * returnMultiplier;
    let returnDiscount = 0;

    if (returnMultiplier > 1 && pricingSettings?.return_trip_discount?.enabled) {
      const discPct = pricingSettings.return_trip_discount.discountPercentage || 0;
      returnDiscount = total * (discPct / 100);
      total -= returnDiscount;
    }

    const deposit = total * (depositPercentage / 100);

    return {
      basePrice, distancePrice, estimatedDistance, appliedRules, zoneMultiplier, zoneName,
      subtotal, returnMultiplier, total, deposit, matchedRoute,
      isHourly: false, hourlyRate: 0, bookingHours: 0, stopSurcharge, returnDiscount,
    };
  };

  return {
    priceBreakdown: calculatePrice(),
    pricingRules, zones, routes,
    isLoading: !pricingRules || !zones || !routes,
  };
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

function shouldApplyRule(rule: PricingRule, bookingDetails: BookingDetails, estimatedDistance: number | null): boolean {
  // Vehicle-specific rules
  if (rule.vehicle_id && bookingDetails.selectedVehicle?.id !== rule.vehicle_id) return false;
  if (rule.vehicle_category && bookingDetails.selectedVehicle?.category !== rule.vehicle_category) return false;

  // Time-based rules
  if (rule.rule_type === 'time') {
    if (rule.start_time && rule.end_time && bookingDetails.pickupTime) {
      if (!isTimeInRange(bookingDetails.pickupTime, rule.start_time, rule.end_time)) return false;
    }
    if (rule.days_of_week && rule.days_of_week.length > 0 && bookingDetails.pickupDate) {
      const dayIndex = bookingDetails.pickupDate.getDay();
      const dayName = dayOfWeekMap[dayIndex];
      if (!rule.days_of_week.includes(dayName)) return false;
    }
  }

  // Distance-based rules
  if (rule.rule_type === 'distance' && estimatedDistance !== null) {
    if (rule.min_distance_km !== null && estimatedDistance < rule.min_distance_km) return false;
    if (rule.max_distance_km !== null && estimatedDistance > rule.max_distance_km) return false;
  }

  // Zone-based rules
  if (rule.rule_type === 'zone' && rule.zone_id) {
    // Zone rules apply if the booking matches the zone
    return true;
  }

  return true;
}

function findMatchingRoute(pickupLocation: string, dropoffLocation: string, routes: Route[]): Route | null {
  if (!pickupLocation || !dropoffLocation || routes.length === 0) return null;

  const normalise = (s: string) => s.toLowerCase().trim();
  const pickup = normalise(pickupLocation);
  const dropoff = normalise(dropoffLocation);

  for (const route of routes) {
    const origin = normalise(route.origin_name);
    const destination = normalise(route.destination_name);
    if (
      (pickup.includes(origin) || origin.includes(pickup)) &&
      (dropoff.includes(destination) || destination.includes(dropoff))
    ) {
      return route;
    }
  }
  return null;
}
