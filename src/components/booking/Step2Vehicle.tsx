import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Filter, Route, GitCompare, AlertTriangle, X, Briefcase, ArrowUpDown, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VehicleCard } from './VehicleCard';
import { VehicleComparisonDrawer } from './VehicleComparisonDrawer';
import { Step2VehicleSkeleton } from './Step2VehicleSkeleton';
import { BookingDetails, Vehicle } from '@/types/booking';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useVehiclePricing } from '@/hooks/useVehiclePricing';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SmartVehicleRecommendation } from './SmartVehicleRecommendation';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { useLanguage } from '@/contexts/LanguageContext';

type SortOption = 'price-asc' | 'price-desc' | 'capacity-asc' | 'capacity-desc' | 'name-asc' | 'name-desc';

interface Step2VehicleProps {
  bookingDetails: BookingDetails;
  onUpdate: (updates: Partial<BookingDetails>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function Step2Vehicle({ bookingDetails, onUpdate, onNext, onBack }: Step2VehicleProps) {
  const { aiAssistantEnabled } = useSystemSettings();
  const { t } = useLanguage();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [filterByLuggage, setFilterByLuggage] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('price-asc');

  // Fetch vehicles from database
  const { data: dbVehicles, isLoading } = useQuery({
    queryKey: ['booking-vehicles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicles')
        .select('id, name, category, passengers, luggage, image, features, base_price, price_per_km, hourly_rate, min_hours, max_hours')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      
      return data.map((v) => ({
        id: v.id,
        name: v.name,
        category: v.category,
        passengers: v.passengers,
        luggage: v.luggage,
        image: v.image || '',
        features: v.features || [],
        base_price: Number(v.base_price) || 0,
        price_per_km: Number(v.price_per_km) || 0,
        hourly_rate: Number(v.hourly_rate) || 0,
        min_hours: Number(v.min_hours) || 2,
        max_hours: Number(v.max_hours) || 12,
      })) as Vehicle[];
    },
  });

  const vehicles = dbVehicles || [];

  const { calculateVehiclePrice, matchedRoute, isLoading: isPricingLoading } = useVehiclePricing({
    pickupLocation: bookingDetails.pickupLocation,
    dropoffLocation: bookingDetails.dropoffLocation,
    pickupDate: bookingDetails.pickupDate,
    pickupTime: bookingDetails.pickupTime,
    transferType: bookingDetails.transferType,
    routeDistanceKm: bookingDetails.routeDistanceKm,
    serviceType: bookingDetails.serviceType,
    bookingHours: bookingDetails.bookingHours,
    stops: bookingDetails.stops,
  });

  const isReturnTrip = bookingDetails.transferType !== 'one-way';
  const luggageCount = bookingDetails.luggageCount || 0;

  const vehicleCategories = useMemo(() => {
    const categories = new Set(vehicles.map((v) => v.category));
    return [t.common.all, ...Array.from(categories)];
  }, [vehicles, t.common.all]);

  useEffect(() => {
    if (!bookingDetails.selectedVehicle && vehicles.length > 0) {
      onUpdate({ selectedVehicle: vehicles[0] });
    }
  }, [vehicles, bookingDetails.selectedVehicle, onUpdate]);

  const filteredVehicles = useMemo(() => {
    let result = [...vehicles];
    
    if (selectedCategory !== t.common.all) {
      result = result.filter((v) => v.category === selectedCategory);
    }
    
    result = result.filter((v) => v.passengers >= bookingDetails.passengers);
    
    if (filterByLuggage && luggageCount > 0) {
      result = result.filter((v) => v.luggage >= luggageCount);
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'price-asc': {
          const priceA = calculateVehiclePrice(a)?.estimatedTotal ?? a.base_price ?? 0;
          const priceB = calculateVehiclePrice(b)?.estimatedTotal ?? b.base_price ?? 0;
          return priceA - priceB;
        }
        case 'price-desc': {
          const priceA = calculateVehiclePrice(a)?.estimatedTotal ?? a.base_price ?? 0;
          const priceB = calculateVehiclePrice(b)?.estimatedTotal ?? b.base_price ?? 0;
          return priceB - priceA;
        }
        case 'capacity-asc':
          return a.passengers - b.passengers;
        case 'capacity-desc':
          return b.passengers - a.passengers;
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        default:
          return 0;
      }
    });
    
    return result;
  }, [vehicles, selectedCategory, bookingDetails.passengers, filterByLuggage, luggageCount, sortBy, calculateVehiclePrice, t.common.all]);

  const handleVehicleSelect = (vehicle: Vehicle) => {
    onUpdate({ selectedVehicle: vehicle });
  };

  const handleToggleCompare = useCallback((vehicleId: string) => {
    setCompareIds(prev => {
      if (prev.includes(vehicleId)) {
        return prev.filter(id => id !== vehicleId);
      }
      if (prev.length >= 4) return prev;
      return [...prev, vehicleId];
    });
  }, []);

  const clearCompareSelection = () => {
    setCompareIds([]);
  };

  const resetFilters = () => {
    setSelectedCategory(t.common.all);
    setFilterByLuggage(false);
    setSortBy('price-asc');
  };

  const hasActiveFilters = selectedCategory !== t.common.all || filterByLuggage || sortBy !== 'price-asc';

  const vehiclesToCompare = useMemo(() => {
    return vehicles.filter(v => compareIds.includes(v.id));
  }, [vehicles, compareIds]);

  const vehicleBadges = useMemo(() => {
    const badges: Record<string, 'best-value' | 'popular' | 'most-spacious' | null> = {};
    
    if (filteredVehicles.length === 0) return badges;

    let bestValueId: string | null = null;
    let lowestPricePerPassenger = Infinity;
    
    filteredVehicles.forEach(vehicle => {
      const price = calculateVehiclePrice(vehicle);
      if (price && price.estimatedTotal > 0) {
        const pricePerPassenger = price.estimatedTotal / vehicle.passengers;
        if (pricePerPassenger < lowestPricePerPassenger) {
          lowestPricePerPassenger = pricePerPassenger;
          bestValueId = vehicle.id;
        }
      }
    });

    if (bestValueId) {
      badges[bestValueId] = 'best-value';
    }

    let mostSpaciousId: string | null = null;
    let highestCapacity = 0;
    
    filteredVehicles.forEach(vehicle => {
      const totalCapacity = vehicle.passengers + vehicle.luggage;
      if (totalCapacity > highestCapacity && vehicle.id !== bestValueId) {
        highestCapacity = totalCapacity;
        mostSpaciousId = vehicle.id;
      }
    });

    if (mostSpaciousId) {
      badges[mostSpaciousId] = 'most-spacious';
    }

    const popularCategories = ['Business', 'Comfort'];
    const popularVehicle = filteredVehicles.find(
      v => popularCategories.includes(v.category) && !badges[v.id]
    );
    
    if (popularVehicle) {
      badges[popularVehicle.id] = 'popular';
    }

    return badges;
  }, [filteredVehicles, calculateVehiclePrice]);

  const selectedVehicleLuggageWarning = bookingDetails.selectedVehicle && 
    luggageCount > 0 && 
    bookingDetails.selectedVehicle.luggage < luggageCount;

  if (isLoading) {
    return <Step2VehicleSkeleton />;
  }

  const isValid = bookingDetails.selectedVehicle !== null && !selectedVehicleLuggageWarning;

  return (
    <div className="animate-fade-in">
      <div className="mb-6 text-center">
        <h2 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
          {t.booking.chooseYourRide}
        </h2>
        <p className="mt-2 text-muted-foreground">
          {t.booking.selectVehicleFor} {bookingDetails.passengers} {bookingDetails.passengers === 1 ? t.common.passenger : t.common.passengers}
          {luggageCount > 0 && ` ${t.booking.with} ${luggageCount} ${luggageCount === 1 ? t.common.bag : t.common.bags}`}
        </p>
      </div>

      {aiAssistantEnabled && <SmartVehicleRecommendation bookingDetails={bookingDetails} />}

      {luggageCount > 0 && (
        <Alert className="mb-4 border-amber-500/50 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-amber-600 dark:text-amber-400">
            {t.booking.luggageWarning.replace('{count}', String(luggageCount)).replace('{unit}', luggageCount === 1 ? t.common.bag : t.common.bags)}
          </AlertDescription>
        </Alert>
      )}

      {(bookingDetails.routeDistanceKm || matchedRoute) && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-accent/10 px-4 py-3 text-sm">
          <Route className="h-4 w-4 text-accent" />
          <span className="text-foreground">
            {matchedRoute && (
              <strong className="text-accent">{matchedRoute.name} • </strong>
            )}
            {bookingDetails.routeDistanceKm ? (
              <span className="text-muted-foreground">
                {bookingDetails.routeDistanceKm.toFixed(1)} {t.common.km}
                {bookingDetails.routeDurationMinutes && (
                  <> • ~{bookingDetails.routeDurationMinutes} {t.common.min}</>
                )}
              </span>
            ) : matchedRoute?.estimated_distance_km && (
              <span className="text-muted-foreground">
                ~{matchedRoute.estimated_distance_km} {t.common.km}
              </span>
            )}
          </span>
        </div>
      )}

      {/* Filter Bar with Compare */}
      <div className="mb-6 space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <Filter className="h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="flex-1 overflow-x-auto scrollbar-hide">
            <div className="flex gap-2 rounded-lg bg-muted/50 p-1.5 w-max min-w-full sm:w-auto sm:min-w-0">
              {vehicleCategories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={cn(
                    'rounded-md px-3 sm:px-4 py-2 text-sm font-medium transition-all duration-200 whitespace-nowrap',
                    selectedCategory === category
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'text-muted-foreground hover:bg-background hover:text-foreground'
                  )}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {luggageCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              <Label 
                htmlFor="luggage-filter" 
                className="text-sm font-medium text-muted-foreground cursor-pointer whitespace-nowrap"
              >
                {t.booking.fitsNBags.replace('{count}', String(luggageCount))}
              </Label>
              <Switch
                id="luggage-filter"
                checked={filterByLuggage}
                onCheckedChange={setFilterByLuggage}
              />
            </div>
          )}

          <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-1.5">
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
            <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
              <SelectTrigger className="h-8 w-[130px] sm:w-[140px] border-0 bg-transparent shadow-none focus:ring-0">
                <SelectValue placeholder={t.booking.sortBy} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="price-asc">{t.booking.priceLowToHigh}</SelectItem>
                <SelectItem value="price-desc">{t.booking.priceHighToLow}</SelectItem>
                <SelectItem value="capacity-desc">{t.booking.capacityMost}</SelectItem>
                <SelectItem value="capacity-asc">{t.booking.capacityLeast}</SelectItem>
                <SelectItem value="name-asc">{t.booking.nameAToZ}</SelectItem>
                <SelectItem value="name-desc">{t.booking.nameZToA}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="mr-1.5 h-4 w-4" />
              {t.common.reset}
            </Button>
          )}

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            {compareIds.length > 0 && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearCompareSelection}
                  className="text-muted-foreground"
                >
                  <X className="mr-1 h-4 w-4" />
                  <span className="hidden sm:inline">{t.common.clear}</span> ({compareIds.length})
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setShowComparison(true)}
                  disabled={compareIds.length < 2}
                >
                  <GitCompare className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">{t.booking.compare} {compareIds.length}</span>
                </Button>
              </>
            )}
            {compareIds.length === 0 && (
              <span className="hidden sm:inline text-xs text-muted-foreground">
                {t.booking.selectVehiclesToCompare}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Vehicle Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredVehicles.map((vehicle) => (
          <VehicleCard
            key={vehicle.id}
            vehicle={vehicle}
            isSelected={bookingDetails.selectedVehicle?.id === vehicle.id}
            onSelect={() => handleVehicleSelect(vehicle)}
            priceEstimate={!isPricingLoading ? calculateVehiclePrice(vehicle) : null}
            isReturnTrip={isReturnTrip}
            luggageCount={luggageCount}
            showCompareCheckbox={true}
            isInCompare={compareIds.includes(vehicle.id)}
            onToggleCompare={handleToggleCompare}
            badge={vehicleBadges[vehicle.id] || null}
            serviceType={bookingDetails.serviceType}
          />
        ))}
      </div>

      {filteredVehicles.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">
            {t.booking.noVehiclesAvailable.replace('{count}', String(bookingDetails.passengers))}
          </p>
        </div>
      )}

      {selectedVehicleLuggageWarning && (
        <Alert className="mt-4 border-destructive/50 bg-destructive/10">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <AlertDescription className="text-destructive">
            {t.booking.selectedVehicleLuggageWarning
              .replace('{capacity}', String(bookingDetails.selectedVehicle?.luggage))
              .replace('{needed}', String(luggageCount))}
          </AlertDescription>
        </Alert>
      )}

      {/* Navigation Buttons */}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-between">
        <Button variant="outline" onClick={onBack} className="order-2 h-14 text-base sm:order-1">
          {t.booking.backToLocation}
        </Button>
        <Button
          variant="booking"
          disabled={!isValid}
          onClick={onNext}
          className="order-1 h-14 text-base sm:order-2"
        >
          {t.booking.continueToPayment}
        </Button>
      </div>

      {/* Comparison Drawer */}
      <VehicleComparisonDrawer
        open={showComparison}
        onOpenChange={setShowComparison}
        vehicles={vehiclesToCompare}
        selectedVehicle={bookingDetails.selectedVehicle}
        onSelectVehicle={handleVehicleSelect}
        getPrice={calculateVehiclePrice}
        isReturnTrip={isReturnTrip}
        luggageCount={luggageCount}
        passengerCount={bookingDetails.passengers}
      />
    </div>
  );
}
