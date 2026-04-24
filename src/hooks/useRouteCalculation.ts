import { useState, useEffect, useCallback } from 'react';
import { geocodeAddress } from '@/utils/geocoding';
import { useLanguage } from '@/contexts/LanguageContext';

export interface RouteLeg {
  from: string;
  to: string;
  distance: string;
  distanceMeters: number;
  duration: string;
  durationSeconds: number;
}

export interface RouteInfo {
  distance: string;
  distanceMeters: number;
  duration: string;
  durationSeconds: number;
  routeCoordinates?: [number, number][];
  legs?: RouteLeg[];
}

interface UseRouteCalculationProps {
  pickupLocation?: string;
  dropoffLocation?: string;
  stops?: string[];
}

export function useRouteCalculation({
  pickupLocation,
  dropoffLocation,
  stops,
}: UseRouteCalculationProps) {
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useLanguage();
  const rc = (t as any).routeCalculationErrors || {};

  const stopsKey = JSON.stringify(stops || []);

  const calculateRoute = useCallback(async () => {
    if (!pickupLocation || !dropoffLocation) {
      setRouteInfo(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Geocode all points: pickup, stops, dropoff
      const validStops = (stops || []).filter(s => s.trim().length > 0);
      const allAddresses = [pickupLocation, ...validStops, dropoffLocation];

      // Geocode sequentially with delays to respect Nominatim rate limits
      const allCoords: ([number, number] | null)[] = [];
      for (let i = 0; i < allAddresses.length; i++) {
        if (i > 0) await new Promise(r => setTimeout(r, 1100));
        allCoords.push(await geocodeAddress(allAddresses[i]));
      }

      const validCoords = allCoords.filter((c): c is [number, number] => c !== null);
      if (validCoords.length < 2) {
        throw new Error(rc.couldNotGeocode || 'Could not geocode enough addresses');
      }

      // Build OSRM waypoints string (lon,lat format)
      const waypointsStr = validCoords.map(c => `${c[1]},${c[0]}`).join(';');

      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${waypointsStr}?overview=full&geometries=geojson&steps=false`
      );

      const data = await response.json();

      if (data.routes?.[0]) {
        const route = data.routes[0];
        const distanceKm = route.distance / 1000;
        const durationMins = Math.round(route.duration / 60);

        // Convert GeoJSON coordinates [lng, lat] to Leaflet [lat, lng]
        const routeCoordinates: [number, number][] = route.geometry.coordinates.map(
          (coord: [number, number]) => [coord[1], coord[0]]
        );

        // Build per-leg info
        const validStops = (stops || []).filter(s => s.trim().length > 0);
        const waypointLabels = [pickupLocation!, ...validStops, dropoffLocation!];
        const legs: RouteLeg[] = (route.legs || []).map((leg: any, i: number) => {
          const legDistKm = leg.distance / 1000;
          const legDurMins = Math.round(leg.duration / 60);
          return {
            from: waypointLabels[i] || `Point ${i + 1}`,
            to: waypointLabels[i + 1] || `Point ${i + 2}`,
            distance: legDistKm < 1
              ? `${Math.round(leg.distance)} m`
              : `${legDistKm.toFixed(1)} km`,
            distanceMeters: leg.distance,
            duration: legDurMins < 60
              ? `${legDurMins} min${legDurMins !== 1 ? 's' : ''}`
              : `${Math.floor(legDurMins / 60)} hr ${legDurMins % 60} min`,
            durationSeconds: leg.duration,
          };
        });

        setRouteInfo({
          distance: distanceKm < 1
            ? `${Math.round(route.distance)} m`
            : `${distanceKm.toFixed(1)} km`,
          distanceMeters: route.distance,
          duration: durationMins < 60
            ? `${durationMins} min${durationMins !== 1 ? 's' : ''}`
            : `${Math.floor(durationMins / 60)} hr ${durationMins % 60} min`,
          durationSeconds: route.duration,
          routeCoordinates,
          legs: legs.length > 1 ? legs : undefined,
        });
      } else {
        throw new Error(rc.noRouteFound || 'No route found');
      }
    } catch (err) {
      console.error('Route calculation failed:', err);
      setError(rc.couldNotCalculate || 'Could not calculate route');
      setRouteInfo(null);
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickupLocation, dropoffLocation, stopsKey]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      calculateRoute();
    }, 500);
    return () => clearTimeout(debounceTimer);
  }, [calculateRoute]);

  return { routeInfo, isLoading, error, recalculate: calculateRoute };
}
