import { useState, useEffect } from 'react';
import { SmartRouteSuggestions } from './SmartRouteSuggestions';
import { MapPin, Calendar, Clock, Users, StickyNote, ArrowRight, RotateCcw, RefreshCw, ChevronDown, ChevronUp, Timer, Route as RouteIcon } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { BookingDetails, ServiceType, TransferType } from '@/types/booking';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { useTranslation } from '@/contexts/LanguageContext';
import { format, getDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { UnifiedMapPreview } from './UnifiedMapPreview';
import { SavedLocationsDropdown } from './SavedLocationsDropdown';
import { useSavedLocations } from '@/hooks/useSavedLocations';
import { useAuth } from '@/contexts/AuthContext';
import { AddressAutocompleteInput } from './AddressAutocompleteInput';
import { RouteInfoCard } from './RouteInfoCard';
import { FareEstimatePreview } from './FareEstimatePreview';
import { SmartFareSuggestions } from './SmartFareSuggestions';
import { SurgePricingAlert } from './SurgePricingAlert';

import { useSurgePricing } from '@/hooks/useSurgePricing';
import { useRouteCalculation } from '@/hooks/useRouteCalculation';
import { AdditionalStops } from './AdditionalStops';
import { BookingExtras } from './BookingExtras';
import { FormFieldError } from './FormFieldError';
import { useBookingValidation } from '@/hooks/useBookingValidation';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';


interface Step1LocationProps {
  bookingDetails: BookingDetails;
  onUpdate: (updates: Partial<BookingDetails>) => void;
  onNext: () => void;
}

export function Step1Location({ bookingDetails, onUpdate, onNext }: Step1LocationProps) {
  const { t } = useTranslation();
  const minLabel = t.common.min || 'min';
  const hourLabel = t.common.hour || 'hour';
  const hoursLabel = t.common.hours || 'hours';

  const transferTypes: { id: TransferType; label: string; description: string; icon: React.ReactNode }[] = [
    { id: 'one-way', label: t.booking.oneWay, description: t.booking.singleTrip, icon: <ArrowRight className="h-4 w-4" /> },
    { id: 'return', label: t.booking.return, description: t.booking.roundTrip, icon: <RotateCcw className="h-4 w-4" /> },
    { id: 'return-new-ride', label: t.booking.newReturn, description: t.booking.separateReturn, icon: <RefreshCw className="h-4 w-4" /> },
  ];
  const [locatingField, setLocatingField] = useState<'pickup' | 'dropoff' | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { businessHours, bookingPolicies, aiAssistantEnabled } = useSystemSettings();
  const { defaultPickup, defaultDropoff } = useSavedLocations();
  const { step1Errors, isStep1Valid } = useBookingValidation(bookingDetails);

  // Calculate route info using OSRM
  const { routeInfo, isLoading: isCalculatingRoute, error: routeError } = useRouteCalculation({
    pickupLocation: bookingDetails.pickupLocation,
    dropoffLocation: bookingDetails.dropoffLocation,
    stops: bookingDetails.stops,
  });

  // Analyze surge pricing
  const { surgeData } = useSurgePricing({
    pickupDate: bookingDetails.pickupDate,
    pickupTime: bookingDetails.pickupTime,
    routeDistanceKm: bookingDetails.routeDistanceKm,
  });

  // Handler for time selection from surge alert
  const handleSurgeTimeSelect = (time: string) => {
    onUpdate({ pickupTime: time });
  };

  // Store calculated route distance in booking details for pricing
  useEffect(() => {
    if (routeInfo) {
      const distanceKm = routeInfo.distanceMeters / 1000;
      const durationMinutes = Math.round(routeInfo.durationSeconds / 60);
      onUpdate({ 
        routeDistanceKm: distanceKm,
        routeDurationMinutes: durationMinutes,
      });
    } else {
      onUpdate({ 
        routeDistanceKm: null,
        routeDurationMinutes: null,
      });
    }
  }, [routeInfo]);

  // Auto-fill defaults on mount
  useEffect(() => {
    if (user && !bookingDetails.pickupLocation && defaultPickup) {
      onUpdate({ pickupLocation: defaultPickup.address });
    }
    if (user && !bookingDetails.dropoffLocation && defaultDropoff) {
      onUpdate({ dropoffLocation: defaultDropoff.address });
    }
  }, [user, defaultPickup, defaultDropoff]);

  const generateTimeSlots = () => {
    const slots: string[] = [];
    const startHour = parseInt(businessHours.start.split(':')[0]);
    const endHour = parseInt(businessHours.end.split(':')[0]);
    const interval = bookingPolicies.pickupTimeInterval;

    for (let hour = startHour; hour <= endHour; hour++) {
      for (let minute = 0; minute < 60; minute += interval) {
        if (hour === endHour && minute > 0) break;
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        slots.push(time);
      }
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  const reverseGeocodeWithNominatim = async (lat: number, lng: number): Promise<string | null> => {
    const { reverseGeocode } = await import('@/utils/geocoding');
    return reverseGeocode(lat, lng);
  };

  const handleUseMyLocation = (field: 'pickup' | 'dropoff') => {
    if (!navigator.geolocation) {
      alert(t.errors.geolocationNotSupported);
      return;
    }

    setLocatingField(field);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const address = await reverseGeocodeWithNominatim(latitude, longitude);
        const location = address || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        
        if (field === 'pickup') {
          onUpdate({ pickupLocation: location });
          setTouched(prev => ({ ...prev, pickupLocation: true }));
        } else {
          onUpdate({ dropoffLocation: location });
          setTouched(prev => ({ ...prev, dropoffLocation: true }));
        }
        
        setLocatingField(null);
      },
      (error) => {
        console.error('Geolocation error:', error);
        alert(t.errors.unableToGetLocation);
        setLocatingField(null);
      }
    );
  };

  const handleFieldBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const handleContinue = () => {
    setTouched({
      pickupLocation: true,
      dropoffLocation: true,
      pickupDate: true,
      pickupTime: true,
    });

    if (isStep1Valid) {
      onNext();
    }
  };

  const showError = (field: keyof typeof step1Errors) => {
    return touched[field] && step1Errors[field];
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-6 text-center">
        <h2 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
          {t.booking.whereToGo}
        </h2>
        <p className="mt-2 text-muted-foreground">
          {t.booking.enterLocations}
        </p>
      </div>

      {/* Service Type Cards */}
      <div className="mx-auto mb-6 max-w-2xl">
        <div className="grid grid-cols-2 gap-3">
          {/* Hourly Card */}
          <button
            onClick={() => onUpdate({ serviceType: 'hourly' })}
            className={cn(
              'relative flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition-all duration-200',
              bookingDetails.serviceType === 'hourly'
                ? 'border-primary bg-primary/5 shadow-md ring-2 ring-primary/20'
                : 'border-border bg-card hover:border-primary/30 hover:shadow-sm'
            )}
          >
            {bookingDetails.serviceType === 'hourly' && (
              <div className="absolute -top-1.5 -end-1.5 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                <div className="h-2 w-2 rounded-full bg-primary-foreground" />
              </div>
            )}
            <div className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
              bookingDetails.serviceType === 'hourly'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground'
            )}>
              <Timer className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-foreground">{t.booking.hourly}</p>
              <p className="text-xs text-muted-foreground">
                {t.booking.hourlyDescription}
              </p>
            </div>
          </button>

          {/* Flat Rate Card */}
          <button
            onClick={() => onUpdate({ serviceType: 'flat-rate' })}
            className={cn(
              'relative flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition-all duration-200',
              bookingDetails.serviceType === 'flat-rate'
                ? 'border-primary bg-primary/5 shadow-md ring-2 ring-primary/20'
                : 'border-border bg-card hover:border-primary/30 hover:shadow-sm'
            )}
          >
            {bookingDetails.serviceType === 'flat-rate' && (
              <div className="absolute -top-1.5 -end-1.5 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                <div className="h-2 w-2 rounded-full bg-primary-foreground" />
              </div>
            )}
            <div className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
              bookingDetails.serviceType === 'flat-rate'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground'
            )}>
              <RouteIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-foreground">{t.booking.flatRate}</p>
              <p className="text-xs text-muted-foreground">
                {t.booking.flatRateDescription}
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Hourly Duration Selector - only shown for hourly service */}
      {bookingDetails.serviceType === 'hourly' && (
        <div className="mx-auto mb-6 max-w-2xl">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Timer className="h-4 w-4 text-primary" />
                {t.booking.bookingDuration}
              </Label>
              <span className="text-lg font-bold text-primary">
                {(() => {
                  const totalMinutes = Math.round(bookingDetails.bookingHours * 60);
                  if (totalMinutes < 60) return `${totalMinutes} ${minLabel}`;
                  const hrs = Math.floor(totalMinutes / 60);
                  const mins = totalMinutes % 60;
                  return mins > 0 ? `${hrs} ${hourLabel} ${mins} ${minLabel}` : `${hrs} ${hrs === 1 ? hourLabel : hoursLabel}`;
                })()}
              </span>
            </div>
            <Slider
              value={[Math.round(bookingDetails.bookingHours * 60)]}
              onValueChange={([val]) => onUpdate({ bookingHours: val / 60 })}
              min={5}
              max={720}
              step={5}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{`5 ${minLabel}`}</span>
              <span>{`6 ${hoursLabel}`}</span>
              <span>{`12 ${hoursLabel}`}</span>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Type */}
      <div className="mx-auto mb-6 max-w-2xl">
        <Label className="mb-3 block text-sm font-medium">{t.booking.transferType}</Label>
        <TooltipProvider>
          <div className="grid grid-cols-3 gap-3">
            {transferTypes.map((type) => (
              <Tooltip key={type.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onUpdate({ transferType: type.id })}
                    className={cn(
                      'flex flex-col items-center justify-center gap-1 rounded-lg border-2 p-3 text-sm font-medium transition-all duration-200',
                      bookingDetails.transferType === type.id
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-card text-muted-foreground hover:border-primary/30'
                    )}
                  >
                    {type.icon}
                    <span className="text-xs sm:text-sm">{type.label}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{type.description}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </TooltipProvider>
      </div>

      <div className="mx-auto max-w-4xl">
        <div className="grid gap-8 xl:grid-cols-2">
          {/* Form Column */}
          <div className="space-y-5">
            {/* Pickup Location */}
            <div className="space-y-1.5">
              <Label htmlFor="pickup" className="text-sm font-medium">
                {t.booking.pickupLocation}
              </Label>
              <AddressAutocompleteInput
                id="pickup"
                placeholder={t.booking.enterPickupAddress}
                value={bookingDetails.pickupLocation}
                onChange={(value) => {
                  onUpdate({ pickupLocation: value });
                  setTouched(prev => ({ ...prev, pickupLocation: true }));
                }}
                accentColor="green"
                hasError={!!showError('pickupLocation')}
                savedLocationsElement={
                  <SavedLocationsDropdown 
                    type="pickup"
                    currentAddress={bookingDetails.pickupLocation}
                    onSelectLocation={(address) => onUpdate({ pickupLocation: address })}
                  />
                }
                onLocateMe={() => handleUseMyLocation('pickup')}
                isLocating={locatingField === 'pickup'}
              />
              <FormFieldError error={showError('pickupLocation')} />
            </div>

            {/* Drop-off Location */}
            <div className="space-y-1.5">
              <Label htmlFor="dropoff" className="text-sm font-medium">
                {t.booking.dropoffLocation}
              </Label>
              <AddressAutocompleteInput
                id="dropoff"
                placeholder={t.booking.enterDestinationAddress}
                value={bookingDetails.dropoffLocation}
                onChange={(value) => {
                  onUpdate({ dropoffLocation: value });
                  setTouched(prev => ({ ...prev, dropoffLocation: true }));
                }}
                accentColor="red"
                hasError={!!showError('dropoffLocation')}
                savedLocationsElement={
                  <SavedLocationsDropdown 
                    type="dropoff"
                    currentAddress={bookingDetails.dropoffLocation}
                    onSelectLocation={(address) => onUpdate({ dropoffLocation: address })}
                  />
                }
                onLocateMe={() => handleUseMyLocation('dropoff')}
                isLocating={locatingField === 'dropoff'}
              />
              <FormFieldError error={showError('dropoffLocation')} />
            </div>

            {/* AI Smart Route Suggestions */}
            {aiAssistantEnabled && (
              <SmartRouteSuggestions
                pickup={bookingDetails.pickupLocation}
                dropoff={bookingDetails.dropoffLocation}
                onSelectRoute={(pickup, dropoff) => onUpdate({ pickupLocation: pickup, dropoffLocation: dropoff })}
              />
            )}

            {/* Additional Stops */}
            <AdditionalStops
              stops={bookingDetails.stops}
              onStopsChange={(stops) => onUpdate({ stops })}
            />

            {/* Date, Time, Passengers Row */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 mt-2">
              {/* Date Picker */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t.common.date}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'booking-input w-full justify-start text-left font-normal',
                        !bookingDetails.pickupDate && 'text-muted-foreground',
                        showError('pickupDate') && 'border-destructive'
                      )}
                      onBlur={() => handleFieldBlur('pickupDate')}
                    >
                      <Calendar className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">
                        {bookingDetails.pickupDate ? (
                          format(bookingDetails.pickupDate, 'MMM d')
                        ) : (
                          'Date'
                        )}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={bookingDetails.pickupDate || undefined}
                      onSelect={(date) => {
                        onUpdate({ pickupDate: date || null });
                        handleFieldBlur('pickupDate');
                      }}
                      disabled={(date) => {
                        if (date < new Date(new Date().setHours(0, 0, 0, 0))) return true;
                        const dayMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                        const dayName = dayMap[getDay(date)];
                        if (businessHours.daysOfWeek && businessHours.daysOfWeek.length > 0) {
                          return !businessHours.daysOfWeek.includes(dayName);
                        }
                        return false;
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormFieldError error={showError('pickupDate')} />
              </div>

              {/* Time Picker */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t.common.time}</Label>
                <Select
                  value={bookingDetails.pickupTime}
                  onValueChange={(value) => {
                    onUpdate({ pickupTime: value });
                    handleFieldBlur('pickupTime');
                  }}
                >
                  <SelectTrigger className="booking-input w-full">
                    <div className="flex items-center min-w-0 flex-1">
                      <Clock className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate"><SelectValue placeholder={t.booking.selectTime} /></span>
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {timeSlots.map((time) => (
                      <SelectItem key={time} value={time}>{time}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormFieldError error={showError('pickupTime')} />
              </div>

              {/* Passengers */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t.booking.passengers}</Label>
                <Select
                  value={bookingDetails.passengers.toString()}
                  onValueChange={(value) => onUpdate({ passengers: parseInt(value) })}
                >
                  <SelectTrigger className="booking-input w-full">
                    <div className="flex items-center min-w-0 flex-1">
                      <Users className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate"><SelectValue /></span>
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                      <SelectItem key={num} value={num.toString()}>
                        {num} {num === 1 ? t.common.passenger : t.common.passengers}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Booking Extras */}
            <BookingExtras
              luggageCount={bookingDetails.luggageCount}
              childSeats={bookingDetails.childSeats}
              flightNumber={bookingDetails.flightNumber}
              onLuggageChange={(count) => onUpdate({ luggageCount: count })}
              onChildSeatsChange={(count) => onUpdate({ childSeats: count })}
              onFlightNumberChange={(flightNumber) => onUpdate({ flightNumber })}
            />

            {/* Route Info Display */}
            <RouteInfoCard
              routeInfo={routeInfo}
              isLoading={isCalculatingRoute}
              error={routeError}
              className="mb-1"
            />

            {/* Fare Estimate Preview */}
            <FareEstimatePreview
              routeDistanceKm={bookingDetails.routeDistanceKm}
              transferType={bookingDetails.transferType}
              pickupDate={bookingDetails.pickupDate}
              pickupTime={bookingDetails.pickupTime}
              serviceType={bookingDetails.serviceType}
              bookingHours={bookingDetails.bookingHours}
            />

            {/* Surge Pricing Alerts */}
            {bookingDetails.pickupDate && bookingDetails.pickupTime && (
              <SurgePricingAlert
                surgeData={surgeData}
                onTimeSelect={handleSurgeTimeSelect}
              />
            )}

            {/* Smart AI-Powered Fare Suggestions */}
            <SmartFareSuggestions
              pickupLocation={bookingDetails.pickupLocation}
              dropoffLocation={bookingDetails.dropoffLocation}
              pickupDate={bookingDetails.pickupDate}
              pickupTime={bookingDetails.pickupTime}
              routeDistanceKm={bookingDetails.routeDistanceKm}
              passengers={bookingDetails.passengers}
              transferType={bookingDetails.transferType}
            />

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes" className="text-sm font-medium">
                {t.booking.notesOptional}
              </Label>
              <div className="relative">
                <StickyNote className="absolute inset-inline-start-4 top-3 h-5 w-5 text-muted-foreground" />
                <Textarea
                  id="notes"
                  placeholder={t.booking.notesHint}
                  value={bookingDetails.notes}
                  onChange={(e) => onUpdate({ notes: e.target.value })}
                  className="min-h-[80px] resize-none ps-12"
                />
              </div>
            </div>

            {/* Mobile Map - Above Continue Button */}
            {isMobile && (
              <Collapsible open={isMapExpanded} onOpenChange={setIsMapExpanded}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full flex items-center justify-between gap-2 h-12"
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      <span>{isMapExpanded ? t.booking.hideMap : t.booking.showMap}</span>
                    </div>
                    {isMapExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3">
                  <div className="h-[300px] rounded-lg overflow-hidden">
                    <UnifiedMapPreview
                      pickupLocation={bookingDetails.pickupLocation}
                      dropoffLocation={bookingDetails.dropoffLocation}
                      routeInfo={routeInfo}
                      stops={bookingDetails.stops}
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Continue Button */}
            <Button
              variant="booking"
              className="w-full h-14 text-base"
              onClick={handleContinue}
            >
              {t.booking.continueToVehicle}
            </Button>
          </div>

          {/* Desktop Map Column */}
          {!isMobile && (
            <div className="h-[300px] xl:sticky xl:top-4 xl:h-[calc(100vh-8rem)]">
              <UnifiedMapPreview
                pickupLocation={bookingDetails.pickupLocation}
                dropoffLocation={bookingDetails.dropoffLocation}
                routeInfo={routeInfo}
                stops={bookingDetails.stops}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
