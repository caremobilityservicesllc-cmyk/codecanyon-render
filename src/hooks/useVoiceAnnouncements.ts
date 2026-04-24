import { useRef, useCallback, useEffect } from 'react';

interface AnnouncementOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
}

interface ProximityAnnouncement {
  id: string;
  distance: number; // in meters
  locationName: string;
  bookingRef: string;
}

const PROXIMITY_THRESHOLDS = {
  APPROACHING: 500, // meters
  ARRIVING: 100,
  ARRIVED: 30,
} as const;

export function useVoiceAnnouncements(options: AnnouncementOptions = {}) {
  const { rate = 1, pitch = 1, volume = 1 } = options;
  const announcedLocations = useRef<Map<string, Set<string>>>(new Map());
  const isSpeaking = useRef(false);
  const isEnabled = useRef(true);

  // Check if speech synthesis is supported
  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const speak = useCallback((text: string) => {
    if (!isSupported || !isEnabled.current) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;
    utterance.lang = 'en-US';

    // Use a good voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(
      v => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Samantha'))
    ) || voices.find(v => v.lang.startsWith('en'));
    
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onstart = () => { isSpeaking.current = true; };
    utterance.onend = () => { isSpeaking.current = false; };
    utterance.onerror = () => { isSpeaking.current = false; };

    window.speechSynthesis.speak(utterance);
  }, [isSupported, rate, pitch, volume]);

  const checkProximityAndAnnounce = useCallback((
    driverLat: number,
    driverLng: number,
    locations: ProximityAnnouncement[]
  ) => {
    if (!isSupported || !isEnabled.current) return;

    locations.forEach(location => {
      // Calculate distance using Haversine formula
      const R = 6371e3; // Earth's radius in meters
      const φ1 = driverLat * Math.PI / 180;
      const φ2 = location.distance; // Already in meters from geocoded position
      const lat2 = location.distance; // placeholder - we use pre-calculated distance
      
      // Get or create the set of announced thresholds for this location
      if (!announcedLocations.current.has(location.id)) {
        announcedLocations.current.set(location.id, new Set());
      }
      const announced = announcedLocations.current.get(location.id)!;

      // Check each threshold
      if (location.distance <= PROXIMITY_THRESHOLDS.ARRIVED && !announced.has('arrived')) {
        speak(`You have arrived at pickup for booking ${location.bookingRef}`);
        announced.add('arrived');
      } else if (location.distance <= PROXIMITY_THRESHOLDS.ARRIVING && !announced.has('arriving')) {
        speak(`Arriving at pickup for booking ${location.bookingRef}. ${Math.round(location.distance)} meters away.`);
        announced.add('arriving');
      } else if (location.distance <= PROXIMITY_THRESHOLDS.APPROACHING && !announced.has('approaching')) {
        speak(`Approaching pickup for booking ${location.bookingRef}. About ${Math.round(location.distance)} meters away.`);
        announced.add('approaching');
      }
    });
  }, [isSupported, speak]);

  // Helper to calculate distance between two coordinates
  const calculateDistance = useCallback((
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }, []);

  // Announce with distance calculation
  const announceProximity = useCallback((
    driverLat: number,
    driverLng: number,
    pickups: Array<{
      id: string;
      lat: number;
      lng: number;
      bookingRef: string;
    }>
  ) => {
    if (!isSupported || !isEnabled.current) return;

    pickups.forEach(pickup => {
      const distance = calculateDistance(driverLat, driverLng, pickup.lat, pickup.lng);
      
      // Get or create the set of announced thresholds for this location
      if (!announcedLocations.current.has(pickup.id)) {
        announcedLocations.current.set(pickup.id, new Set());
      }
      const announced = announcedLocations.current.get(pickup.id)!;

      // Check each threshold
      if (distance <= PROXIMITY_THRESHOLDS.ARRIVED && !announced.has('arrived')) {
        speak(`You have arrived at pickup for booking ${pickup.bookingRef}`);
        announced.add('arrived');
      } else if (distance <= PROXIMITY_THRESHOLDS.ARRIVING && !announced.has('arriving')) {
        speak(`Arriving at pickup. ${Math.round(distance)} meters to booking ${pickup.bookingRef}`);
        announced.add('arriving');
      } else if (distance <= PROXIMITY_THRESHOLDS.APPROACHING && !announced.has('approaching')) {
        speak(`Approaching pickup for ${pickup.bookingRef}. ${Math.round(distance)} meters away.`);
        announced.add('approaching');
      }
    });
  }, [isSupported, speak, calculateDistance]);

  // Manual announcement
  const announce = useCallback((message: string) => {
    speak(message);
  }, [speak]);

  // Toggle voice announcements
  const setEnabled = useCallback((enabled: boolean) => {
    isEnabled.current = enabled;
    if (!enabled) {
      window.speechSynthesis?.cancel();
    }
  }, []);

  // Clear announced locations (when pickup is completed)
  const clearAnnounced = useCallback((locationId: string) => {
    announcedLocations.current.delete(locationId);
  }, []);

  // Reset all announcements
  const resetAll = useCallback(() => {
    announcedLocations.current.clear();
  }, []);

  // Load voices on mount
  useEffect(() => {
    if (!isSupported) return;
    
    // Voices might not be loaded immediately
    const loadVoices = () => {
      window.speechSynthesis.getVoices();
    };
    
    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
      window.speechSynthesis.cancel();
    };
  }, [isSupported]);

  return {
    isSupported,
    announce,
    announceProximity,
    setEnabled,
    clearAnnounced,
    resetAll,
    PROXIMITY_THRESHOLDS,
  };
}
