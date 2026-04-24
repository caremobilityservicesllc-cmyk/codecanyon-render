import { useEffect, useState } from 'react';
import { MapPin, Navigation, AlertCircle, Car, Clock } from 'lucide-react';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { LeafletMap } from '@/components/booking/LeafletMap';
import { format } from 'date-fns';

interface DriverLocation {
  lat: number;
  lng: number;
}

interface DriverTrackingMapProps {
  driverLocation: DriverLocation | null;
  pickupLocation: string;
  estimatedArrival?: string | null;
  lastUpdated?: Date | null;
}

export function DriverTrackingMap({ 
  driverLocation, 
  pickupLocation,
  estimatedArrival,
  lastUpdated 
}: DriverTrackingMapProps) {
  if (!driverLocation) {
    return (
      <div className="relative h-64 overflow-hidden rounded-xl border border-border">
        <LeafletMap
          pickupLocation={pickupLocation}
          showLiveIndicator={false}
          height="100%"
        />
        <div className="absolute bottom-3 left-3 right-3 z-[1000]">
          <div className="flex items-center justify-center gap-2 rounded-lg bg-background/90 backdrop-blur-md border border-border px-4 py-2 shadow-lg">
            <Car className="h-4 w-4 text-muted-foreground animate-pulse" />
            <span className="text-sm font-medium text-muted-foreground">
              Waiting for driver location...
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-64 overflow-hidden rounded-xl border border-border">
      <LeafletMap
        pickupLocation={pickupLocation}
        driverLocation={driverLocation}
        showLiveIndicator={true}
        height="100%"
      />

      {/* Estimated Arrival Overlay */}
      {estimatedArrival && (
        <div className="absolute bottom-3 left-3 right-3 z-[1000]">
          <div className="flex items-center justify-center gap-2 rounded-lg bg-background/90 backdrop-blur-md border border-border px-4 py-2 shadow-lg">
            <Navigation className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">
              Estimated arrival: {estimatedArrival}
            </span>
          </div>
        </div>
      )}

      {/* Last update time */}
      {lastUpdated && (
        <div className="absolute top-3 right-3 z-[1000]">
          <div className="rounded-full bg-background/90 backdrop-blur-md border border-border px-2 py-1 shadow-lg">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {format(lastUpdated, 'HH:mm:ss')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
