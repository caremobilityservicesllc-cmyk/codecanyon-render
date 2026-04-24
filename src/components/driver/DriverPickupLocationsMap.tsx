import { useEffect, useRef, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Navigation, Loader2, AlertCircle, List, Map as MapIcon, Radio, X, Route, Clock, Volume2, VolumeX } from 'lucide-react';
import { format, parseISO, isToday, isTomorrow } from 'date-fns';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useVoiceAnnouncements } from '@/hooks/useVoiceAnnouncements';
import { PickupListByETA } from './PickupListByETA';
import { geocodeAddress as geocodeViaProxy } from '@/utils/geocoding';

interface AssignedBooking {
  id: string;
  booking_reference: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_date: string;
  pickup_time: string;
  status: string;
  ride_started_at: string | null;
}

interface DriverPickupLocationsMapProps {
  driverId: string;
  onMapReady?: (focusLocation: (address: string) => void) => void;
  activeRideDestination?: string;
  isRideInProgress?: boolean;
}

interface MarkerData {
  booking: AssignedBooking;
  position: { lat: number; lng: number };
  eta?: string;
  etaMinutes?: number;
}

interface LiveLocationData {
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  timestamp: number;
}

type ViewMode = 'map' | 'list';

// Helper to geocode via the existing location-proxy
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const result = await geocodeViaProxy(address);
  if (result) {
    return { lat: result[0], lng: result[1] };
  }
  return null;
}

// Helper to get OSRM route
async function getOSRMRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<{ durationSeconds: number; distanceMeters: number; geometry: [number, number][] } | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.code === 'Ok' && data.routes?.length > 0) {
      const route = data.routes[0];
      const coords = route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]] as [number, number]);
      return {
        durationSeconds: Math.round(route.duration),
        distanceMeters: Math.round(route.distance),
        geometry: coords,
      };
    }
  } catch (err) {
    console.error('OSRM route error:', err);
  }
  return null;
}

// Helper to get OSRM table (duration matrix)
async function getOSRMDurations(
  origin: { lat: number; lng: number },
  destinations: { lat: number; lng: number }[]
): Promise<number[]> {
  try {
    const coords = [origin, ...destinations].map(c => `${c.lng},${c.lat}`).join(';');
    const sources = '0';
    const dests = destinations.map((_, i) => i + 1).join(';');
    const url = `https://router.project-osrm.org/table/v1/driving/${coords}?sources=${sources}&destinations=${dests}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.code === 'Ok' && data.durations?.[0]) {
      return data.durations[0].map((d: number | null) => (d !== null ? Math.round(d) : -1));
    }
  } catch (err) {
    console.error('OSRM table error:', err);
  }
  return destinations.map(() => -1);
}

function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} hr ${minutes % 60} min`;
}

function formatDistance(meters: number): string {
  const km = meters / 1000;
  return km >= 1 ? `${km.toFixed(1)} km` : `${meters} m`;
}

export function DriverPickupLocationsMap({ driverId, onMapReady, activeRideDestination, isRideInProgress }: DriverPickupLocationsMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const driverMarkerRef = useRef<L.Marker | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);

  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { mapLocation } = useSystemSettings();
  const { t } = useLanguage();
  const dm = (t as any).driverPickupMap || {};
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [driverLocation, setDriverLocation] = useState<LiveLocationData | null>(null);
  const [geocodedMarkers, setGeocodedMarkers] = useState<MarkerData[]>([]);
  const [isLiveTracking, setIsLiveTracking] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState<{ lat: number; lng: number } | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string; durationSeconds?: number } | null>(null);
  const [etaLastUpdated, setEtaLastUpdated] = useState<Date | null>(null);
  const [etaCountdown, setEtaCountdown] = useState<number | null>(null);
  const [arrivalTime, setArrivalTime] = useState<Date | null>(null);
  const [voiceEnabled, setVoiceEnabledState] = useState(true);

  const { isSupported: voiceSupported, announceProximity, setEnabled: setVoiceHookEnabled, clearAnnounced } = useVoiceAnnouncements();

  const toggleVoice = useCallback(() => {
    const newState = !voiceEnabled;
    setVoiceEnabledState(newState);
    setVoiceHookEnabled(newState);
  }, [voiceEnabled, setVoiceHookEnabled]);

  // Fetch assigned bookings
  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ['driver-pickup-map-bookings', driverId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('id, booking_reference, pickup_location, dropoff_location, pickup_date, pickup_time, status, ride_started_at')
        .eq('driver_id', driverId)
        .in('status', ['confirmed', 'pending'])
        .order('pickup_date', { ascending: true })
        .order('pickup_time', { ascending: true });
      if (error) throw error;
      return data as AssignedBooking[];
    },
    enabled: !!driverId,
  });

  // Get driver's current location
  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, heading, speed } = position.coords;
        setDriverLocation({ lat: latitude, lng: longitude, heading: heading ?? undefined, speed: speed ?? undefined, timestamp: position.timestamp });
        setIsLiveTracking(true);
      },
      (err) => {
        console.warn('Geolocation error:', err.message);
        setIsLiveTracking(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 1000 }
    );
    return () => { navigator.geolocation.clearWatch(watchId); setIsLiveTracking(false); };
  }, []);

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainer.current || viewMode !== 'map') return;
    if (mapRef.current) return; // Already initialized

    const center: [number, number] = driverLocation
      ? [driverLocation.lat, driverLocation.lng]
      : [mapLocation.defaultLat, mapLocation.defaultLng];

    const map = L.map(mapContainer.current, {
      center,
      zoom: 12,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    setIsLoaded(true);

    return () => {
      map.remove();
      mapRef.current = null;
      markersLayerRef.current = null;
      driverMarkerRef.current = null;
      routeLayerRef.current = null;
      setIsLoaded(false);
      setSelectedDestination(null);
      setRouteInfo(null);
    };
  }, [viewMode]);

  // Geocode bookings
  useEffect(() => {
    if (!isLoaded || bookings.length === 0) return;

    const doGeocode = async () => {
      const geocoded: MarkerData[] = [];
      for (const booking of bookings) {
        const pos = await geocodeAddress(booking.pickup_location);
        if (pos) geocoded.push({ booking, position: pos });
      }
      setGeocodedMarkers(geocoded);
    };
    doGeocode();
  }, [isLoaded, bookings]);

  // Calculate ETAs using OSRM table API
  useEffect(() => {
    if (!isLoaded || !driverLocation || geocodedMarkers.length === 0) return;

    const calculateETAs = async () => {
      const durations = await getOSRMDurations(
        { lat: driverLocation.lat, lng: driverLocation.lng },
        geocodedMarkers.map(m => m.position)
      );
      const updated = geocodedMarkers.map((marker, i) => {
        const dur = durations[i];
        if (dur > 0) {
          return { ...marker, eta: formatDuration(dur), etaMinutes: Math.round(dur / 60) };
        }
        return marker;
      });
      setGeocodedMarkers(updated);
      setEtaLastUpdated(new Date());
    };

    calculateETAs();
    const interval = setInterval(calculateETAs, 60000);
    return () => clearInterval(interval);
  }, [isLoaded, driverLocation?.lat, driverLocation?.lng, geocodedMarkers.length]);

  // Update markers on map
  useEffect(() => {
    if (!mapRef.current || !isLoaded || !markersLayerRef.current) return;

    markersLayerRef.current.clearLayers();

    const bounds = L.latLngBounds([]);

    geocodedMarkers.forEach(({ booking, position, eta, etaMinutes }, index) => {
      const isActive = booking.ride_started_at && booking.status === 'confirmed';
      const color = isActive ? '#22c55e' : '#3b82f6';

      const icon = L.divIcon({
        className: 'custom-pickup-marker',
        html: `<div style="width:28px;height:28px;border-radius:50%;background:${color};border:2px solid #fff;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:bold;box-shadow:0 2px 6px rgba(0,0,0,0.3);">${index + 1}</div>${eta ? `<div style="margin-top:2px;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:bold;color:#fff;text-align:center;white-space:nowrap;background:${etaMinutes !== undefined && etaMinutes <= 10 ? '#22c55e' : etaMinutes !== undefined && etaMinutes <= 20 ? '#f59e0b' : '#ef4444'}">${eta}</div>` : ''}`,
        iconSize: [28, eta ? 48 : 28],
        iconAnchor: [14, 14],
      });

      const dateLabel = getDateLabel(booking.pickup_date);
      const etaHtml = eta
        ? `<div style="font-size:13px;margin-top:8px;padding:6px 8px;background:${etaMinutes !== undefined && etaMinutes <= 10 ? '#22c55e' : etaMinutes !== undefined && etaMinutes <= 20 ? '#f59e0b' : '#ef4444'};color:white;border-radius:4px;text-align:center;"><strong>ETA:</strong> ${eta}</div>`
        : '';

      const popup = `
        <div style="padding:8px;min-width:200px;">
          <div style="font-weight:bold;margin-bottom:4px;">${booking.booking_reference}</div>
          <div style="font-size:12px;color:#6b7280;margin-bottom:8px;">${dateLabel} at ${booking.pickup_time.slice(0, 5)}</div>
          <div style="font-size:13px;margin-bottom:4px;"><strong>${dm.pickupLabel || 'Pickup:'}</strong> ${booking.pickup_location}</div>
          <div style="font-size:13px;"><strong>${dm.dropoffLabel || 'Dropoff:'}</strong> ${booking.dropoff_location}</div>
          ${etaHtml}
        </div>
      `;

      const marker = L.marker([position.lat, position.lng], { icon }).bindPopup(popup);
      markersLayerRef.current!.addLayer(marker);
      bounds.extend([position.lat, position.lng]);
    });

    // Driver marker
    if (driverLocation) {
      const driverIcon = L.divIcon({
        className: 'driver-location-marker',
        html: `<div style="width:20px;height:20px;background:#ef4444;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.4);"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

      if (driverMarkerRef.current) {
        driverMarkerRef.current.setLatLng([driverLocation.lat, driverLocation.lng]);
      } else {
        driverMarkerRef.current = L.marker([driverLocation.lat, driverLocation.lng], { icon: driverIcon, zIndexOffset: 1000 })
          .bindPopup(dm.yourLocation || 'Your Location')
          .addTo(mapRef.current);
      }
      bounds.extend([driverLocation.lat, driverLocation.lng]);
    }

    if (bounds.isValid()) {
      mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [geocodedMarkers, driverLocation, isLoaded]);

  // Draw route from driver to selected destination via OSRM
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;

    // Clear existing route
    if (routeLayerRef.current) {
      routeLayerRef.current.remove();
      routeLayerRef.current = null;
    }

    if (!driverLocation || !selectedDestination) {
      setRouteInfo(null);
      return;
    }

    const drawRoute = async () => {
      const route = await getOSRMRoute(
        { lat: driverLocation.lat, lng: driverLocation.lng },
        selectedDestination
      );
      if (route && mapRef.current) {
        routeLayerRef.current = L.polyline(route.geometry, {
          color: '#3b82f6',
          weight: 5,
          opacity: 0.8,
        }).addTo(mapRef.current);

        setRouteInfo({
          distance: formatDistance(route.distanceMeters),
          duration: formatDuration(route.durationSeconds),
          durationSeconds: route.durationSeconds,
        });

        if (isRideInProgress && route.durationSeconds > 0) {
          const arrival = new Date(Date.now() + route.durationSeconds * 1000);
          setArrivalTime(arrival);
          setEtaCountdown(route.durationSeconds);
        }

        const bounds = L.latLngBounds([
          [driverLocation.lat, driverLocation.lng],
          [selectedDestination.lat, selectedDestination.lng],
        ]);
        mapRef.current.fitBounds(bounds, { padding: [60, 60] });
      }
    };
    drawRoute();
  }, [driverLocation?.lat, driverLocation?.lng, selectedDestination, isLoaded]);

  // Auto-route to active ride dropoff
  useEffect(() => {
    if (!isLoaded || !isRideInProgress || !activeRideDestination) return;
    const setup = async () => {
      const pos = await geocodeAddress(activeRideDestination);
      if (pos) setSelectedDestination(pos);
    };
    setup();
  }, [isLoaded, isRideInProgress, activeRideDestination]);

  // ETA countdown timer
  useEffect(() => {
    if (!arrivalTime || !isRideInProgress) { setEtaCountdown(null); return; }
    const updateCountdown = () => {
      const remaining = Math.max(0, Math.floor((arrivalTime.getTime() - Date.now()) / 1000));
      setEtaCountdown(remaining);
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [arrivalTime, isRideInProgress]);

  const formatCountdown = useCallback((seconds: number): string => {
    if (seconds <= 0) return dm.arriving || 'Arriving';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const clearRoute = useCallback(() => {
    setSelectedDestination(null);
    setRouteInfo(null);
    setArrivalTime(null);
    setEtaCountdown(null);
    if (routeLayerRef.current) {
      routeLayerRef.current.remove();
      routeLayerRef.current = null;
    }
  }, []);

  // Focus on location
  const focusLocation = useCallback(async (address: string) => {
    if (viewMode !== 'map') { setViewMode('map'); return; }
    const pos = await geocodeAddress(address);
    if (pos) {
      setSelectedDestination(pos);
      // Open popup for matching marker
      if (markersLayerRef.current) {
        markersLayerRef.current.eachLayer((layer) => {
          const marker = layer as L.Marker;
          const popup = marker.getPopup();
          if (popup && popup.getContent()?.toString().includes(address)) {
            marker.openPopup();
          }
        });
      }
    }
  }, [viewMode]);

  // Notify parent when map is ready
  useEffect(() => {
    if (isLoaded && onMapReady) onMapReady(focusLocation);
  }, [isLoaded, onMapReady, focusLocation]);

  // Voice announcements for proximity
  useEffect(() => {
    if (!voiceEnabled || !voiceSupported || !driverLocation || geocodedMarkers.length === 0) return;
    const pickups = geocodedMarkers.map(m => ({
      id: m.booking.id,
      lat: m.position.lat,
      lng: m.position.lng,
      bookingRef: m.booking.booking_reference,
    }));
    announceProximity(driverLocation.lat, driverLocation.lng, pickups);
  }, [voiceEnabled, voiceSupported, driverLocation?.lat, driverLocation?.lng, geocodedMarkers, announceProximity]);

  const getDateLabel = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return dm.todayLabel || 'Today';
    if (isTomorrow(date)) return dm.tomorrowLabel || 'Tomorrow';
    return format(date, 'EEE, MMM d');
  };

  return (
    <Card className="mb-4 overflow-hidden">
      <CardHeader className="py-3 px-3 sm:px-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Navigation className="h-4 w-4 text-primary shrink-0" />
            <span className="truncate">{dm.pickupLocations || 'Pickup Locations'}</span>
            {bookings.length > 0 && (
              <Badge variant="secondary" className="text-xs shrink-0">{bookings.length}</Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-1 self-end sm:self-auto">
            <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewMode('list')} className="text-xs gap-1 h-8 px-2 sm:px-3">
              <List className="h-4 w-4" />
              <span className="hidden xs:inline">{dm.list || 'List'}</span>
            </Button>
            <Button variant={viewMode === 'map' ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewMode('map')} className="text-xs gap-1 h-8 px-2 sm:px-3">
              <MapIcon className="h-4 w-4" />
              <span className="hidden xs:inline">{dm.map || 'Map'}</span>
            </Button>
          </div>
        </div>
      </CardHeader>

      {viewMode === 'list' && (
        <CardContent className="pt-2">
          <PickupListByETA
            markers={geocodedMarkers}
            onPickupClick={(address) => { setViewMode('map'); setTimeout(() => focusLocation(address), 300); }}
            voiceEnabled={voiceEnabled}
            onToggleVoice={toggleVoice}
            voiceSupported={voiceSupported}
            driverLocation={driverLocation ? { lat: driverLocation.lat, lng: driverLocation.lng } : null}
          />
        </CardContent>
      )}

      {viewMode === 'map' && (
        <div className="relative h-80 sm:h-96 border-t border-border">
          <div ref={mapContainer} className="absolute inset-0 z-0" />

          {(!isLoaded || bookingsLoading) && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted z-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted z-10">
              <div className="text-center text-muted-foreground">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 text-destructive" />
                <p className="text-sm">{error}</p>
              </div>
            </div>
          )}

          {isLoaded && bookings.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/80 z-10">
              <div className="text-center text-muted-foreground">
                <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">{dm.noAssignedPickups || 'No assigned pickups to display'}</p>
              </div>
            </div>
          )}

          {/* Live Tracking Status Panel */}
          {isLoaded && (
            <div className="absolute top-2 left-2 right-2 z-[1000] flex items-center justify-between gap-2">
              {driverLocation ? (
                <div className="flex items-center gap-2">
                  <Badge className="bg-destructive/90 text-destructive-foreground backdrop-blur-sm text-xs gap-1.5 px-2.5 py-1">
                    <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                    {dm.live || 'LIVE'}
                    {driverLocation.speed !== undefined && driverLocation.speed > 0 && (
                      <span className="ml-1 opacity-80">{Math.round(driverLocation.speed * 3.6)} km/h</span>
                    )}
                  </Badge>
                  {isRideInProgress && (
                    <Badge variant="outline" className="bg-primary/90 text-primary-foreground backdrop-blur-sm text-xs gap-1.5 px-2.5 py-1 border-primary">
                      <Navigation className="h-3 w-3" />
                      {dm.rideActive || 'Ride Active'}
                    </Badge>
                  )}
                </div>
              ) : (
                <Badge variant="outline" className="bg-background/90 backdrop-blur-sm text-xs gap-1">
                  <Radio className="h-3 w-3 animate-pulse" />
                  {dm.acquiringGps || 'Acquiring GPS...'}
                </Badge>
              )}
              {driverLocation && (
                <Button variant="secondary" size="sm" className="h-7 text-xs bg-background/90 backdrop-blur-sm"
                  onClick={() => { if (mapRef.current && driverLocation) { mapRef.current.setView([driverLocation.lat, driverLocation.lng], 15); } }}>
                  <Navigation className="h-3 w-3 mr-1" />
                  {dm.center || 'Center'}
                </Button>
              )}
            </div>
          )}

          {/* Route Info Panel with ETA Countdown */}
          {routeInfo && selectedDestination && (
            <div className="absolute bottom-14 left-2 right-2 z-[1000]">
              <div className={cn("rounded-xl shadow-2xl overflow-hidden transition-all duration-300", isRideInProgress ? "bg-gradient-to-r from-primary to-primary/90" : "bg-primary")}>
                {isRideInProgress && etaCountdown !== null && (
                  <div className="px-4 py-3 border-b border-primary-foreground/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                          <Clock className="h-4 w-4 text-primary-foreground" />
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-primary-foreground/70">{dm.arrivingIn || 'Arriving in'}</p>
                          <p className="text-2xl font-bold font-mono text-primary-foreground tracking-tight">{formatCountdown(etaCountdown)}</p>
                        </div>
                      </div>
                      {arrivalTime && (
                        <div className="text-right">
                          <p className="text-[10px] uppercase tracking-wider text-primary-foreground/70">{dm.eta || 'ETA'}</p>
                          <p className="text-lg font-semibold text-primary-foreground">{arrivalTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      )}
                    </div>
                    {routeInfo.durationSeconds && routeInfo.durationSeconds > 0 && (
                      <div className="mt-2 h-1.5 bg-primary-foreground/20 rounded-full overflow-hidden">
                        <div className="h-full bg-primary-foreground/80 rounded-full transition-all duration-1000"
                          style={{ width: `${Math.max(0, 100 - (etaCountdown / routeInfo.durationSeconds) * 100)}%` }} />
                      </div>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-between gap-2 px-3 py-2 text-sm text-primary-foreground">
                  <div className="flex items-center gap-3">
                    <Route className="h-4 w-4" />
                    <span className="font-medium">{routeInfo.distance}</span>
                    <span className="opacity-60">•</span>
                    <span className="opacity-90">{routeInfo.duration}</span>
                  </div>
                  {!isRideInProgress && (
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-primary-foreground/20 text-primary-foreground" onClick={clearRoute}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Legend + ETA Summary */}
          {isLoaded && geocodedMarkers.length > 0 && (
            <div className="absolute bottom-2 left-2 right-2 z-[1000] flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3 rounded-lg bg-background/90 backdrop-blur-sm border border-border px-3 py-1.5 text-xs">
                <div className="flex items-center gap-1">
                  <span className="h-3 w-3 rounded-full bg-primary" />
                  <span>{dm.pickup || 'Pickup'}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="h-3 w-3 rounded-full bg-accent" />
                  <span>{dm.active || 'Active'}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="h-3 w-3 rounded-full bg-destructive" />
                  <span>{dm.you || 'You'}</span>
                </div>
              </div>
              {etaLastUpdated && geocodedMarkers.some(m => m.eta) && (
                <div className="flex items-center gap-2 rounded-lg bg-background/90 backdrop-blur-sm border border-border px-3 py-1.5 text-xs">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">{dm.etasUpdated || 'ETAs updated'}</span>
                  <span className="font-medium">{etaLastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
