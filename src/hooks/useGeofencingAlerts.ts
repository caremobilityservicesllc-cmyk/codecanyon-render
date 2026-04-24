import { useEffect, useRef, useCallback, useState } from 'react';
import { toast } from 'sonner';
import { geocodeAddress } from '@/utils/geocoding';
import { useLanguage } from '@/contexts/LanguageContext';

interface GeofenceZone {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  type: 'pickup' | 'dropoff';
}

interface GeofenceAlert {
  zoneId: string;
  type: 'approaching' | 'arrived';
  timestamp: Date;
}

interface UseGeofencingAlertsOptions {
  currentLocation: { lat: number; lng: number } | null;
  pickupAddress?: string;
  dropoffAddress?: string;
  isRideStarted: boolean;
  enabled: boolean;
}

// Calculate distance between two coordinates using Haversine formula
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

// Geocode an address to coordinates using Nominatim via location-proxy
async function geocodeToCoords(
  address: string
): Promise<{ lat: number; lng: number } | null> {
  try {
    const coords = await geocodeAddress(address);
    if (coords) {
      return { lat: coords[0], lng: coords[1] };
    }
  } catch (error) {
    console.error('Geocoding error:', error);
  }
  return null;
}

// Play notification sound
function playAlertSound() {
  try {
    const audio = new Audio('/sounds/notification.mp3');
    audio.volume = 0.7;
    audio.play().catch(() => {});
  } catch (error) {
    console.error('Failed to play alert sound:', error);
  }
}

export function useGeofencingAlerts({
  currentLocation,
  pickupAddress,
  dropoffAddress,
  isRideStarted,
  enabled,
}: UseGeofencingAlertsOptions) {
  const [zones, setZones] = useState<GeofenceZone[]>([]);
  const [alerts, setAlerts] = useState<GeofenceAlert[]>([]);
  const [distanceToPickup, setDistanceToPickup] = useState<number | null>(null);
  const [distanceToDropoff, setDistanceToDropoff] = useState<number | null>(null);
  const { t } = useLanguage();
  
  const triggeredAlertsRef = useRef<Set<string>>(new Set());
  const lastAlertTimeRef = useRef<Record<string, number>>({});

  // Thresholds in meters
  const APPROACHING_THRESHOLD = 500; // 500m
  const ARRIVED_THRESHOLD = 100; // 100m
  const ALERT_COOLDOWN = 60000; // 1 minute cooldown between same alerts

  // Geocode addresses to create zones
  useEffect(() => {
    if (!enabled) return;

    const setupZones = async () => {
      const newZones: GeofenceZone[] = [];

      if (pickupAddress && !isRideStarted) {
        const coords = await geocodeToCoords(pickupAddress);
        if (coords) {
          const gz = (t as any).geofenceZones || {};
          newZones.push({
            id: 'pickup',
            name: gz.pickupLocation || 'Pickup Location',
            lat: coords.lat,
            lng: coords.lng,
            radiusMeters: APPROACHING_THRESHOLD,
            type: 'pickup',
          });
        }
      }

      if (dropoffAddress && isRideStarted) {
        const coords = await geocodeToCoords(dropoffAddress);
        if (coords) {
          const gz = (t as any).geofenceZones || {};
          newZones.push({
            id: 'dropoff',
            name: gz.dropoffLocation || 'Dropoff Location',
            lat: coords.lat,
            lng: coords.lng,
            radiusMeters: APPROACHING_THRESHOLD,
            type: 'dropoff',
          });
        }
      }

      setZones(newZones);
    };

    setupZones();
  }, [pickupAddress, dropoffAddress, isRideStarted, enabled]);

  // Reset triggered alerts when ride state changes
  useEffect(() => {
    if (isRideStarted) {
      // Clear pickup alerts when ride starts
      triggeredAlertsRef.current.delete('pickup-approaching');
      triggeredAlertsRef.current.delete('pickup-arrived');
    }
  }, [isRideStarted]);

  // Check geofences
  const checkGeofences = useCallback(() => {
    if (!currentLocation || zones.length === 0) return;

    const now = Date.now();

    zones.forEach((zone) => {
      const distance = calculateDistance(
        currentLocation.lat,
        currentLocation.lng,
        zone.lat,
        zone.lng
      );

      // Update distance states
      if (zone.type === 'pickup') {
        setDistanceToPickup(distance);
      } else {
        setDistanceToDropoff(distance);
      }

      const approachingKey = `${zone.id}-approaching`;
      const arrivedKey = `${zone.id}-arrived`;

      // Check if we should show an alert (with cooldown)
      const canAlert = (key: string) => {
        const lastTime = lastAlertTimeRef.current[key] || 0;
        return now - lastTime > ALERT_COOLDOWN;
      };

      // Check for "arrived" (within 100m)
      if (distance <= ARRIVED_THRESHOLD) {
        if (!triggeredAlertsRef.current.has(arrivedKey) && canAlert(arrivedKey)) {
          triggeredAlertsRef.current.add(arrivedKey);
          lastAlertTimeRef.current[arrivedKey] = now;

          const alert: GeofenceAlert = {
            zoneId: zone.id,
            type: 'arrived',
            timestamp: new Date(),
          };
          setAlerts((prev) => [...prev, alert]);

          playAlertSound();

          if (zone.type === 'pickup') {
            toast.success(t.geofencing.youHaveArrived, {
              description: t.geofencing.atPickupLocation,
              duration: 8000,
            });
          } else {
            toast.success(t.geofencing.destinationReached, {
              description: t.geofencing.arrivedAtDropoff,
              duration: 8000,
            });
          }
        }
      }
      // Check for "approaching" (within 500m but not yet arrived)
      else if (distance <= APPROACHING_THRESHOLD) {
        if (!triggeredAlertsRef.current.has(approachingKey) && canAlert(approachingKey)) {
          triggeredAlertsRef.current.add(approachingKey);
          lastAlertTimeRef.current[approachingKey] = now;

          const alert: GeofenceAlert = {
            zoneId: zone.id,
            type: 'approaching',
            timestamp: new Date(),
          };
          setAlerts((prev) => [...prev, alert]);

          playAlertSound();

          const distanceText = distance < 1000 
            ? `${Math.round(distance)}m` 
            : `${(distance / 1000).toFixed(1)}km`;

          if (zone.type === 'pickup') {
            toast.info(t.geofencing.approachingPickup, {
              description: t.geofencing.awayFromPickup.replace('{distance}', distanceText),
              duration: 6000,
            });
          } else {
            toast.info(t.geofencing.approachingDestination, {
              description: t.geofencing.awayFromDropoff.replace('{distance}', distanceText),
              duration: 6000,
            });
          }
        }
      }
    });
  }, [currentLocation, zones, t]);

  // Run geofence checks when location updates
  useEffect(() => {
    if (enabled && currentLocation) {
      checkGeofences();
    }
  }, [enabled, currentLocation, checkGeofences]);

  // Format distance for display
  const formatDistance = (meters: number | null): string => {
    if (meters === null) return '--';
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(1)}km`;
  };

  return {
    zones,
    alerts,
    distanceToPickup,
    distanceToDropoff,
    formatDistance,
    isApproachingPickup: distanceToPickup !== null && distanceToPickup <= APPROACHING_THRESHOLD,
    isAtPickup: distanceToPickup !== null && distanceToPickup <= ARRIVED_THRESHOLD,
    isApproachingDropoff: distanceToDropoff !== null && distanceToDropoff <= APPROACHING_THRESHOLD,
    isAtDropoff: distanceToDropoff !== null && distanceToDropoff <= ARRIVED_THRESHOLD,
  };
}
