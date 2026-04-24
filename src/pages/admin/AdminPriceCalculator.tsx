import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calculator, Car, MapPin, Calendar as CalendarIcon, Clock, Route, Tag, Info, ArrowRight, RotateCcw, RefreshCw, Loader2, Navigation } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { format, getDay, parse } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AddressAutocompleteInput } from '@/components/booking/AddressAutocompleteInput';
import { useRouteCalculation } from '@/hooks/useRouteCalculation';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { useLanguage } from '@/contexts/LanguageContext';

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
  destination_zone_id: string | null;
}

interface Vehicle {
  id: string;
  name: string;
  category: string;
  base_price: number | null;
  price_per_km: number | null;
}

type TransferType = 'one-way' | 'return' | 'return-new-ride';

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
  if (s > e) return t >= s || t <= e;
  return t >= s && t <= e;
}

export default function AdminPriceCalculator() {
  const { t } = useLanguage();
  const { formatDistance, convertDistance, distanceAbbr, formatPrice } = useSystemSettings();
  const [pickupLocation, setPickupLocation] = useState('');
  const [dropoffLocation, setDropoffLocation] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [pickupDate, setPickupDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [pickupTime, setPickupTime] = useState('10:00');
  const [transferType, setTransferType] = useState<TransferType>('one-way');
  const [manualDistance, setManualDistance] = useState('');

  // Route calculation hook
  const { routeInfo, isLoading: isCalculatingRoute } = useRouteCalculation({
    pickupLocation: selectedRouteId === 'none' ? pickupLocation : undefined,
    dropoffLocation: selectedRouteId === 'none' ? dropoffLocation : undefined,
  });

  // Auto-update manual distance when route is calculated
  useEffect(() => {
    if (routeInfo?.distanceMeters && selectedRouteId === 'none') {
      const distanceKm = (routeInfo.distanceMeters / 1000).toFixed(1);
      setManualDistance(distanceKm);
    }
  }, [routeInfo, selectedRouteId]);

  // Fetch data
  const { data: vehicles } = useQuery({
    queryKey: ['admin-vehicles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicles')
        .select('id, name, category, base_price, price_per_km')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data as Vehicle[];
    },
  });

  const { data: routes } = useQuery({
    queryKey: ['admin-routes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('routes')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data as Route[];
    },
  });

  const { data: zones } = useQuery({
    queryKey: ['admin-zones'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zones')
        .select('*')
        .eq('is_active', true);
      if (error) throw error;
      return data as Zone[];
    },
  });

  const { data: pricingRules } = useQuery({
    queryKey: ['admin-pricing-rules'],
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

  const selectedVehicle = vehicles?.find(v => v.id === selectedVehicleId);
  const selectedRoute = routes?.find(r => r.id === selectedRouteId);

  // Calculate pricing
  const calculatePrice = () => {
    if (!selectedVehicle) return null;

    const appliedRules: { name: string; adjustment: number; type: 'multiplier' | 'fee' }[] = [];
    
    // Determine base price and distance
    let basePrice = Number(selectedVehicle.base_price) || 0;
    let estimatedDistance = manualDistance ? parseFloat(manualDistance) : null;
    let zoneName: string | null = null;
    let zoneMultiplier = 1;

    // If route selected, use route data
    if (selectedRoute) {
      basePrice = selectedRoute.base_price;
      estimatedDistance = selectedRoute.estimated_distance_km;
      
      if (selectedRoute.destination_zone_id && zones) {
        const zone = zones.find(z => z.id === selectedRoute.destination_zone_id);
        if (zone) {
          zoneMultiplier = zone.multiplier;
          zoneName = zone.name;
        }
      }
    }

    // Distance pricing
    let distancePrice = 0;
    if (estimatedDistance && selectedVehicle.price_per_km) {
      distancePrice = estimatedDistance * Number(selectedVehicle.price_per_km);
    }

    // Apply pricing rules
    let ruleMultiplier = 1;
    let ruleFees = 0;
    const parsedDate = new Date(pickupDate);

    if (pricingRules) {
      for (const rule of pricingRules) {
        let applies = false;

        if (rule.rule_type === 'vehicle') {
          if (rule.vehicle_id && rule.vehicle_id === selectedVehicle.id) applies = true;
          if (rule.vehicle_category && rule.vehicle_category === selectedVehicle.category) applies = true;
          if (!rule.vehicle_id && !rule.vehicle_category) applies = true;
        }

        if (rule.rule_type === 'distance' && estimatedDistance) {
          const minOk = rule.min_distance_km === null || estimatedDistance >= rule.min_distance_km;
          const maxOk = rule.max_distance_km === null || estimatedDistance <= rule.max_distance_km;
          applies = minOk && maxOk;
        }

        if (rule.rule_type === 'time') {
          let dayOk = true;
          let timeOk = true;

          if (rule.days_of_week && rule.days_of_week.length > 0) {
            const dayNum = getDay(parsedDate);
            const dayName = dayOfWeekMap[dayNum];
            dayOk = rule.days_of_week.includes(dayName);
          }

          if (rule.start_time && rule.end_time) {
            timeOk = isTimeInRange(pickupTime, rule.start_time, rule.end_time);
          }

          applies = dayOk && timeOk;
        }

        if (applies) {
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

    // Calculate totals
    const subtotal = (basePrice + distancePrice) * zoneMultiplier * ruleMultiplier + ruleFees;
    const returnMultiplier = transferType !== 'one-way' ? 2 : 1;
    const total = subtotal * returnMultiplier;
    const deposit = total * 0.3;

    return {
      basePrice,
      distancePrice,
      estimatedDistance,
      zoneName,
      zoneMultiplier,
      appliedRules,
      subtotal,
      returnMultiplier,
      total,
      deposit,
    };
  };

  const result = calculatePrice();

  const transferIcons = {
    'one-way': <ArrowRight className="h-4 w-4" />,
    'return': <RotateCcw className="h-4 w-4" />,
    'return-new-ride': <RefreshCw className="h-4 w-4" />,
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Calculator className="h-6 w-6" />
            {t.admin.priceCalculatorTitle}
          </h1>
          <p className="text-muted-foreground">
            {t.admin.priceCalculatorDesc}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Input Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t.admin.bookingScenario}</CardTitle>
              <CardDescription>{t.admin.bookingScenarioDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Vehicle Selection */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Car className="h-4 w-4" />
                  {t.booking.selectVehicle}
                </Label>
                <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t.admin.selectVehicleToPricing} />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles?.map(v => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name} ({v.category}) - {formatPrice(v.base_price || 0)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Route Selection */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Route className="h-4 w-4" />
                  {t.admin.predefinedRoute}
                </Label>
                <Select value={selectedRouteId} onValueChange={setSelectedRouteId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t.admin.selectRouteOrLocations} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t.admin.noRouteManual}</SelectItem>
                    {routes?.map(r => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name} ({r.estimated_distance_km ? formatDistance(r.estimated_distance_km) : '?'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Manual Locations with Autocomplete */}
              {selectedRouteId === 'none' && (
                <>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-accent" />
                      {t.admin.pickupLocation}
                    </Label>
                    <AddressAutocompleteInput
                      id="calc-pickup"
                      value={pickupLocation}
                      onChange={setPickupLocation}
                      placeholder={t.admin.searchPickupAddress}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-destructive" />
                      {t.admin.dropoffLocation}
                    </Label>
                    <AddressAutocompleteInput
                      id="calc-dropoff"
                      value={dropoffLocation}
                      onChange={setDropoffLocation}
                      placeholder={t.admin.searchDropoffAddress}
                    />
                  </div>

                  {/* Route Info Display */}
                  {isCalculatingRoute && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground bg-secondary/50 rounded-md px-3 py-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t.admin.calculatingRoute}
                    </div>
                  )}
                  {routeInfo && !isCalculatingRoute && (
                    <div className="flex items-center gap-4 text-sm bg-accent/10 rounded-md px-3 py-2">
                      <div className="flex items-center gap-1">
                        <Navigation className="h-4 w-4 text-accent" />
                        <span className="font-medium">{routeInfo.distance}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4 text-primary" />
                        <span className="font-medium">{routeInfo.duration}</span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      {t.admin.distanceLabel} ({distanceAbbr})
                      {routeInfo && <Badge variant="secondary" className="text-xs">{t.admin.autoCalculated}</Badge>}
                    </Label>
                    <Input
                      type="number"
                      value={manualDistance}
                      onChange={(e) => setManualDistance(e.target.value)}
                      placeholder={`${t.admin.distanceLabel} (${distanceAbbr})`}
                    />
                  </div>
                </>
              )}

              {/* Date & Time */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    {t.admin.pickupDateLabel}
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !pickupDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {pickupDate ? format(parse(pickupDate, 'yyyy-MM-dd', new Date()), 'PPP') : <span>{t.admin.pickADate}</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={pickupDate ? parse(pickupDate, 'yyyy-MM-dd', new Date()) : undefined}
                        onSelect={(date) => date && setPickupDate(format(date, 'yyyy-MM-dd'))}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {t.admin.pickupTimeLabel}
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <Clock className="mr-2 h-4 w-4" />
                        {pickupTime || t.booking.selectTime}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-4 pointer-events-auto" align="start">
                      <div className="flex items-center gap-2">
                        <Select
                          value={pickupTime.split(':')[0] || '10'}
                          onValueChange={(h) => setPickupTime(`${h}:${pickupTime.split(':')[1] || '00'}`)}
                        >
                          <SelectTrigger className="w-[70px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 24 }, (_, i) => (
                              <SelectItem key={i} value={String(i).padStart(2, '0')}>
                                {String(i).padStart(2, '0')}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span className="text-lg font-semibold">:</span>
                        <Select
                          value={pickupTime.split(':')[1] || '00'}
                          onValueChange={(m) => setPickupTime(`${pickupTime.split(':')[0] || '10'}:${m}`)}
                        >
                          <SelectTrigger className="w-[70px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {['00', '15', '30', '45'].map((m) => (
                              <SelectItem key={m} value={m}>{m}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Transfer Type */}
              <div className="space-y-2">
                <Label>{t.admin.transferTypeLabel}</Label>
                <div className="flex gap-2">
                  {(['one-way', 'return', 'return-new-ride'] as TransferType[]).map(type => (
                    <Button
                      key={type}
                      type="button"
                      variant={transferType === type ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTransferType(type)}
                      className="flex items-center gap-1"
                    >
                      {transferIcons[type]}
                      {type === 'one-way' ? t.admin.oneWayLabel : type === 'return' ? t.admin.returnLabel : t.admin.returnNewLabel}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t.admin.priceBreakdown}</CardTitle>
              <CardDescription>
                {selectedVehicle ? `${t.admin.pricingFor} ${selectedVehicle.name}` : t.admin.selectVehicleToPricing}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {result ? (
                <div className="space-y-4">
                  {/* Route Info */}
                  {selectedRoute && (
                    <div className="flex items-center gap-2 text-sm bg-accent/10 rounded-md px-3 py-2">
                      <Route className="h-4 w-4 text-accent" />
                      <span className="font-medium text-accent">{selectedRoute.name}</span>
                      {result.estimatedDistance && (
                        <span className="text-muted-foreground">~{formatDistance(result.estimatedDistance)}</span>
                      )}
                    </div>
                  )}

                  {/* Base Price */}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t.admin.baseFareLabel}</span>
                    <span className="font-medium">{formatPrice(result.basePrice)}</span>
                  </div>

                  {/* Distance Price */}
                  {result.distancePrice > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {t.admin.distanceLabel} ({formatDistance(result.estimatedDistance || 0)} × {formatPrice(Number(selectedVehicle?.price_per_km || 0))}/{distanceAbbr})
                      </span>
                      <span className="font-medium">{formatPrice(result.distancePrice)}</span>
                    </div>
                  )}

                  {/* Zone Multiplier */}
                  {result.zoneMultiplier !== 1 && result.zoneName && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        Zone: {result.zoneName}
                      </span>
                      <span className="font-medium">×{result.zoneMultiplier.toFixed(2)}</span>
                    </div>
                  )}

                  {/* Applied Rules */}
                  {result.appliedRules.length > 0 && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          {t.admin.appliedPricingRules}
                        </p>
                        {result.appliedRules.map((rule, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Tag className="h-3 w-3" />
                              {rule.name}
                            </span>
                            <span className={cn(
                              'font-medium',
                              rule.type === 'multiplier' && rule.adjustment > 1 && 'text-orange-500',
                              rule.type === 'multiplier' && rule.adjustment < 1 && 'text-green-500'
                            )}>
                              {rule.type === 'multiplier' 
                                ? `×${rule.adjustment.toFixed(2)}`
                                : `+${formatPrice(rule.adjustment)}`
                              }
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {result.appliedRules.length === 0 && (
                    <div className="text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2 flex items-center gap-2">
                      <Info className="h-4 w-4" />
                      {t.admin.noPricingRulesApplied}
                    </div>
                  )}

                  {/* Return Trip */}
                  {result.returnMultiplier > 1 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t.admin.returnTrip}</span>
                      <span className="font-medium">×2</span>
                    </div>
                  )}

                  <Separator />

                  {/* Subtotal */}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t.admin.subtotalOneWay}</span>
                    <span className="font-medium">{formatPrice(result.subtotal)}</span>
                  </div>

                  {/* Total */}
                  <div className="flex justify-between pt-2 border-t">
                    <span className="font-semibold">{t.admin.estimatedTotal}</span>
                    <span className="text-xl font-bold text-accent">{formatPrice(result.total)}</span>
                  </div>

                  {/* Deposit */}
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{t.admin.depositPercent}</span>
                    <span>{formatPrice(result.deposit)}</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Calculator className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>{t.admin.selectVehicleToCalc}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{vehicles?.length || 0}</div>
              <p className="text-xs text-muted-foreground">{t.admin.activeVehicles}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{routes?.length || 0}</div>
              <p className="text-xs text-muted-foreground">{t.admin.activeRoutes}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{zones?.length || 0}</div>
              <p className="text-xs text-muted-foreground">{t.admin.activeZonesLabel}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{pricingRules?.length || 0}</div>
              <p className="text-xs text-muted-foreground">{t.admin.activeRulesLabel}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
