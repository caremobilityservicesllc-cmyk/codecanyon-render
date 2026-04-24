import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, AlertCircle } from 'lucide-react';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { geocodeAddress } from '@/utils/geocoding';
import { useLanguage } from '@/contexts/LanguageContext';

// Fix default marker icons for Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface LeafletMapProps {
  pickupLocation?: string;
  dropoffLocation?: string;
  routeCoordinates?: [number, number][];
  stops?: string[];
  className?: string;
  height?: string;
  driverLocation?: { lat: number; lng: number } | null;
  showLiveIndicator?: boolean;
  markers?: Array<{
    position: [number, number];
    label?: string;
    color?: string;
    popup?: string;
  }>;
}

// geocodeAddress is now imported from @/utils/geocoding

export function LeafletMap({
  pickupLocation,
  dropoffLocation,
  routeCoordinates,
  stops,
  className = '',
  height = '100%',
  driverLocation,
  showLiveIndicator = false,
  markers: externalMarkers,
}: LeafletMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const routeLayersRef = useRef<L.Layer[]>([]);
  const pickupMarkerRef = useRef<L.Marker | null>(null);
  const dropoffMarkerRef = useRef<L.Marker | null>(null);
  const driverMarkerRef = useRef<L.Marker | null>(null);
  const stopMarkersRef = useRef<L.Marker[]>([]);
  const externalMarkersRef = useRef<L.Marker[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useLanguage();
  const me = (t as any).mapErrors || {};
  const { mapLocation } = useSystemSettings();

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    try {
      const map = L.map(mapContainer.current, {
        center: [mapLocation.defaultLat, mapLocation.defaultLng],
        zoom: 12,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;
      setIsLoaded(true);

      // Force resize after mount (guard against unmounted container)
      setTimeout(() => {
        if (mapRef.current && mapContainer.current) {
          try {
            map.invalidateSize();
          } catch {
            // Ignore if map pane not ready yet
          }
        }
      }, 100);
    } catch (err) {
      console.error('Map init error:', err);
      setError(me.failedToInitializeMap || 'Failed to initialize map');
    }

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Update pickup/dropoff markers
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;

    const updateMarkers = async () => {
      const map = mapRef.current!;
      const bounds: L.LatLngExpression[] = [];

      // Pickup marker
      if (pickupLocation) {
        const coords = await geocodeAddress(pickupLocation);
        if (coords) {
          if (pickupMarkerRef.current) {
            pickupMarkerRef.current.setLatLng(coords);
          } else {
            const greenIcon = L.icon({
              iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
              shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
              iconSize: [25, 41],
              iconAnchor: [12, 41],
              popupAnchor: [1, -34],
              shadowSize: [41, 41],
            });
            pickupMarkerRef.current = L.marker(coords, { icon: greenIcon })
              .addTo(map)
              .bindPopup(`<b>${(window as any).__mapLabels?.pickup || 'Pickup'}</b><br/>${pickupLocation}`);
          }
          bounds.push(coords);
        }
      } else if (pickupMarkerRef.current) {
        pickupMarkerRef.current.remove();
        pickupMarkerRef.current = null;
      }

      // Dropoff marker
      if (dropoffLocation) {
        const coords = await geocodeAddress(dropoffLocation);
        if (coords) {
          if (dropoffMarkerRef.current) {
            dropoffMarkerRef.current.setLatLng(coords);
          } else {
            const redIcon = L.icon({
              iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
              shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
              iconSize: [25, 41],
              iconAnchor: [12, 41],
              popupAnchor: [1, -34],
              shadowSize: [41, 41],
            });
            dropoffMarkerRef.current = L.marker(coords, { icon: redIcon })
              .addTo(map)
              .bindPopup(`<b>${(window as any).__mapLabels?.dropoff || 'Drop-off'}</b><br/>${dropoffLocation}`);
          }
          bounds.push(coords);
        }
      } else if (dropoffMarkerRef.current) {
        dropoffMarkerRef.current.remove();
        dropoffMarkerRef.current = null;
      }

      // Fit bounds
      if (bounds.length >= 2) {
        map.fitBounds(L.latLngBounds(bounds), { padding: [50, 50] });
      } else if (bounds.length === 1) {
        map.setView(bounds[0], 14);
      }
    };

    updateMarkers();
  }, [pickupLocation, dropoffLocation, isLoaded]);

  // Draw route
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;

    // Clear ALL previous route layers
    routeLayersRef.current.forEach(layer => {
      try { layer.remove(); } catch (_) {}
    });
    routeLayersRef.current = [];

    if (routeCoordinates && routeCoordinates.length > 1) {
      const primaryColor = getComputedStyle(document.documentElement)
        .getPropertyValue('--primary').trim();
      const resolvedColor = primaryColor ? `hsl(${primaryColor})` : '#22c55e';
      
      const polyline = L.polyline(routeCoordinates, {
        color: resolvedColor,
        weight: 5,
        opacity: 0.8,
      }).addTo(mapRef.current);

      routeLayersRef.current.push(polyline);
      mapRef.current.fitBounds(polyline.getBounds(), { padding: [50, 50] });
    }
  }, [routeCoordinates, isLoaded]);

  // Driver marker
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;

    if (driverLocation) {
      const coords: L.LatLngExpression = [driverLocation.lat, driverLocation.lng];
      if (driverMarkerRef.current) {
        driverMarkerRef.current.setLatLng(coords);
      } else {
        const driverIcon = L.divIcon({
          html: `<div style="background:#3b82f6;border:3px solid white;border-radius:50%;width:20px;height:20px;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>`,
          className: '',
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });
        driverMarkerRef.current = L.marker(coords, { icon: driverIcon, zIndexOffset: 1000 })
          .addTo(mapRef.current)
          .bindPopup('Driver Location');
      }
    } else if (driverMarkerRef.current) {
      driverMarkerRef.current.remove();
      driverMarkerRef.current = null;
    }
  }, [driverLocation, isLoaded]);

  // External markers
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;

    // Clear old markers
    externalMarkersRef.current.forEach(m => m.remove());
    externalMarkersRef.current = [];

    if (externalMarkers) {
      externalMarkers.forEach((m) => {
        const icon = L.divIcon({
          html: `<div style="background:${m.color || '#3b82f6'};border:2px solid white;border-radius:50%;width:16px;height:16px;display:flex;align-items:center;justify-content:center;font-size:10px;color:white;font-weight:bold;box-shadow:0 2px 4px rgba(0,0,0,0.3);">${m.label || ''}</div>`,
          className: '',
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });
        const marker = L.marker(m.position, { icon })
          .addTo(mapRef.current!);
        if (m.popup) marker.bindPopup(m.popup);
        externalMarkersRef.current.push(marker);
      });
    }
  }, [externalMarkers, isLoaded]);

  // Stop markers - use a ref to track the latest stops to avoid cancellation issues
  const stopsRef = useRef<string[]>([]);
  const stopsKey = JSON.stringify(stops || []);
  
  useEffect(() => {
    const validStops = (stops || []).filter(s => s.trim().length > 0);
    stopsRef.current = validStops;
  }, [stopsKey]);

  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;

    // Clear old stop markers
    stopMarkersRef.current.forEach(m => m.remove());
    stopMarkersRef.current = [];

    const validStops = stopsRef.current;
    if (validStops.length === 0) return;

    // Use an AbortController-like pattern with a stable ref
    const effectId = Symbol();
    const currentEffectRef = { current: effectId };

    const addStopMarkers = async () => {
      for (let i = 0; i < validStops.length; i++) {
        if (currentEffectRef.current !== effectId) return;
        const stop = validStops[i];

        // Space out all geocoding requests to respect Nominatim's 1 req/sec policy
        await new Promise(r => setTimeout(r, 1500));

        if (currentEffectRef.current !== effectId || !mapRef.current) return;

        const coords = await geocodeAddress(stop);
        if (currentEffectRef.current !== effectId || !mapRef.current) return;

        if (coords) {
          const stopIcon = L.divIcon({
            html: `<div style="background:#f97316;border:2px solid white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:12px;color:white;font-weight:bold;box-shadow:0 2px 8px rgba(0,0,0,0.4);">${i + 1}</div>`,
            className: '',
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          });
          const marker = L.marker(coords, { icon: stopIcon, zIndexOffset: 500 })
            .addTo(mapRef.current!)
            .bindPopup(`<b>Stop ${i + 1}</b><br/>${stop}`);
          stopMarkersRef.current.push(marker);
        }
      }
    };

    addStopMarkers();

    return () => { currentEffectRef.current = null as any; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopsKey, isLoaded]);

  if (error) {
    return (
      <div className="flex h-full min-h-[300px] flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
        <AlertCircle className="mb-4 h-12 w-12 text-destructive" />
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-xl border border-border ${className}`} style={{ height }}>
      <div ref={mapContainer} className="absolute inset-0 z-0" />
      
      {showLiveIndicator && isLoaded && (
        <div className="absolute top-3 left-3 z-[1000]">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive text-destructive-foreground shadow-lg animate-pulse">
            <span className="h-2 w-2 rounded-full bg-white" />
            <span className="text-xs font-bold tracking-wide">LIVE</span>
          </div>
        </div>
      )}

      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted z-[1000]">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      )}
    </div>
  );
}
