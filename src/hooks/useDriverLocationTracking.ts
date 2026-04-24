import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

interface UseDriverLocationTrackingOptions {
  bookingId: string | null;
  driverId: string;
  pickupLocation?: string;
  dropoffLocation?: string;
  enabled: boolean;
  updateIntervalMs?: number; // How often to push updates to DB (default 3000ms)
}

interface ETAData {
  formatted: string;
  durationText: string;
  distanceText: string;
  hasTrafficData: boolean;
}

interface LocationData {
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  accuracy?: number;
  timestamp: number;
}

export function useDriverLocationTracking({
  bookingId,
  driverId,
  pickupLocation,
  dropoffLocation,
  enabled,
  updateIntervalMs = 3000,
}: UseDriverLocationTrackingOptions) {
  const watchIdRef = useRef<number | null>(null);
  const lastDbUpdateRef = useRef<number>(0);
  const lastEtaUpdateRef = useRef<number>(0);
  const { t } = useLanguage();
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [eta, setEta] = useState<ETAData | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);

  const calculateETA = useCallback(async (lat: number, lng: number) => {
    if (!bookingId || !pickupLocation) return;

    // Throttle ETA updates to every 30 seconds to avoid API rate limits
    const now = Date.now();
    if (now - lastEtaUpdateRef.current < 30000) return;
    lastEtaUpdateRef.current = now;

    try {
      const { data, error: fetchError } = await supabase.functions.invoke('calculate-eta', {
        body: {
          bookingId,
          driverLat: lat,
          driverLng: lng,
          destinationAddress: pickupLocation,
        },
      });

      if (fetchError) {
        console.error('ETA calculation failed:', fetchError);
        return;
      }

      if (data?.eta) {
        setEta({
          formatted: data.eta.formatted,
          durationText: data.eta.durationText,
          distanceText: data.eta.distanceText,
          hasTrafficData: data.eta.hasTrafficData,
        });
      }
    } catch (err) {
      console.error('ETA fetch error:', err);
    }
  }, [bookingId, pickupLocation]);

  const updateLocationToDb = useCallback(async (locationData: LocationData) => {
    const { lat, lng, heading, speed, accuracy } = locationData;
    
    if (!bookingId) return;

    // Throttle DB updates to configured interval
    const now = Date.now();
    if (now - lastDbUpdateRef.current < updateIntervalMs) return;
    lastDbUpdateRef.current = now;

    try {
      // Update booking with driver location
      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          driver_location_lat: lat,
          driver_location_lng: lng,
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookingId)
        .eq('driver_id', driverId);

      if (updateError) {
        console.error('Failed to update driver location:', updateError);
      }

      // Also update driver's current location in drivers table
      await supabase
        .from('drivers')
        .update({
          current_location_lat: lat,
          current_location_lng: lng,
          updated_at: new Date().toISOString(),
        })
        .eq('id', driverId);

      setLastUpdateTime(new Date());

      // Calculate ETA with new position
      if (pickupLocation) {
        calculateETA(lat, lng);
      }
    } catch (err) {
      console.error('Location update error:', err);
    }
  }, [bookingId, driverId, pickupLocation, calculateETA, updateIntervalMs]);

  const handlePositionUpdate = useCallback((position: GeolocationPosition) => {
    const { latitude, longitude, heading, speed, accuracy } = position.coords;
    
    const locationData: LocationData = {
      lat: latitude,
      lng: longitude,
      heading: heading ?? undefined,
      speed: speed ?? undefined,
      accuracy: accuracy ?? undefined,
      timestamp: position.timestamp,
    };
    
    // Always update local state immediately for smooth UI
    setCurrentLocation(locationData);
    
    // Push to database at configured interval
    updateLocationToDb(locationData);
  }, [updateLocationToDb]);

  const handleError = useCallback((error: GeolocationPositionError) => {
    const ge = (t as any).geolocationErrors || {};
    let message = ge.unableToGetLocation || 'Unable to get location';
    switch (error.code) {
      case error.PERMISSION_DENIED:
        message = ge.permissionDenied || 'Location permission denied. Please enable location access.';
        break;
      case error.POSITION_UNAVAILABLE:
        message = ge.positionUnavailable || 'Location unavailable. Please check GPS settings.';
        break;
      case error.TIMEOUT:
        message = ge.timeout || 'Location request timed out. Retrying...';
        break;
    }
    setError(message);
    console.error('Geolocation error:', message);
  }, [t]);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError(t.driverLocation.geolocationNotSupported);
      toast.error(t.driverLocation.geolocationNotSupported);
      return;
    }

    // Get initial position
    navigator.geolocation.getCurrentPosition(
      (position) => {
        handlePositionUpdate(position);
        setIsTracking(true);
        setError(null);
        toast.success(t.driverLocation.trackingStarted);
      },
      handleError,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    // Start watching position with high frequency
    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePositionUpdate,
      handleError,
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 1000, // Accept positions up to 1 second old for smooth updates
      }
    );

    setIsTracking(true);
  }, [handlePositionUpdate, handleError]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
    setEta(null);
    setLastUpdateTime(null);
  }, []);

  useEffect(() => {
    if (enabled && bookingId) {
      startTracking();
    } else {
      stopTracking();
    }

    return () => {
      stopTracking();
    };
  }, [enabled, bookingId, startTracking, stopTracking]);

  return {
    isTracking,
    error,
    currentLocation,
    eta,
    lastUpdateTime,
    startTracking,
    stopTracking,
  };
}
