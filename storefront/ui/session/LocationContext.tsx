import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { formatCoordinates, reverseGeocode } from '../services/location/reverseGeocode';

const STORAGE_KEY = 'buildmate_current_location';

export interface CurrentLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  address?: string;
  updatedAt: number;
}

type AddressStatus = 'idle' | 'loading' | 'ready' | 'error';

interface LocationContextValue {
  currentLocation: CurrentLocation | null;
  addressStatus: AddressStatus;
  addressError: string | null;
  isTracking: boolean;
  /** Last problem getting the position (permission denied, location off, timeout, not HTTPS…). */
  trackingError: string | null;
  saveLocation: (location: Omit<CurrentLocation, 'updatedAt'>) => void;
  requestCurrentLocation: () => Promise<CurrentLocation>;
  startLiveTracking: () => void;
  stopLiveTracking: () => void;
}

const LocationContext = createContext<LocationContextValue | null>(null);

function readLocation(): CurrentLocation | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<CurrentLocation>;
    if (typeof value.latitude !== 'number' || typeof value.longitude !== 'number') return null;
    return {
      latitude: value.latitude,
      longitude: value.longitude,
      accuracy: value.accuracy,
      address: value.address,
      updatedAt: value.updatedAt ?? Date.now(),
    };
  } catch {
    return null;
  }
}

function persistLocation(location: CurrentLocation) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(location));
  } catch {
    // Storage unavailable — keep in memory only.
  }
}

function locationErrorMessage(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'Location permission was denied. Allow location access in your browser settings.';
    case error.POSITION_UNAVAILABLE:
      return 'Location is turned off or unavailable. Turn on location (GPS) on your device and try again.';
    case error.TIMEOUT:
      return 'Getting your location took too long. Please try again.';
    default:
      return 'Unable to determine your current location.';
  }
}

/** Browsers give the position only on HTTPS (or localhost). */
function insecureMessage(): string | null {
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    return 'Current location works only on the secure (https://) website address.';
  }
  return null;
}

function readCurrentPosition(): Promise<GeolocationPosition> {
  const insecure = insecureMessage();
  if (insecure) return Promise.reject(new Error(insecure));
  if (!navigator.geolocation) {
    return Promise.reject(new Error('This browser does not support current location.'));
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, (error) => reject(new Error(locationErrorMessage(error))), {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 20000,
    });
  });
}

function positionToLocation(position: GeolocationPosition): CurrentLocation {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    updatedAt: Date.now(),
  };
}

function hasMovedEnough(previous: CurrentLocation, next: CurrentLocation): boolean {
  const latDelta = Math.abs(previous.latitude - next.latitude);
  const lonDelta = Math.abs(previous.longitude - next.longitude);
  return latDelta > 0.00015 || lonDelta > 0.00015;
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const [currentLocation, setCurrentLocation] = useState<CurrentLocation | null>(readLocation);
  const [addressStatus, setAddressStatus] = useState<AddressStatus>(
    currentLocation?.address ? 'ready' : 'idle',
  );
  const [addressError, setAddressError] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  // Several screens (shell + home) can ask for tracking; it stops when the last one lets go.
  const trackingUsersRef = useRef(0);

  const geocodeAbortRef = useRef<AbortController | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastGeocodedRef = useRef<CurrentLocation | null>(null);

  const resolveAddress = useCallback((location: CurrentLocation, force = false) => {
    if (
      !force &&
      lastGeocodedRef.current &&
      !hasMovedEnough(lastGeocodedRef.current, location) &&
      location.address
    ) {
      return;
    }

    geocodeAbortRef.current?.abort();
    const controller = new AbortController();
    geocodeAbortRef.current = controller;
    setAddressStatus('loading');
    setAddressError(null);

    void reverseGeocode(location.latitude, location.longitude, controller.signal)
      .then((address) => {
        if (controller.signal.aborted) return;
        const located = { ...location, address };
        lastGeocodedRef.current = located;
        setCurrentLocation(located);
        persistLocation(located);
        setAddressStatus('ready');
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const fallback = formatCoordinates(location.latitude, location.longitude);
        const located = { ...location, address: fallback };
        lastGeocodedRef.current = located;
        setCurrentLocation(located);
        persistLocation(located);
        setAddressStatus('error');
        setAddressError(error instanceof Error ? error.message : 'Unable to look up address.');
      });
  }, []);

  const saveLocation = useCallback(
    (location: Omit<CurrentLocation, 'updatedAt'>) => {
      const next: CurrentLocation = { ...location, updatedAt: Date.now() };
      setCurrentLocation(next);
      persistLocation(next);
      resolveAddress(next, true);
    },
    [resolveAddress],
  );

  const requestCurrentLocation = useCallback(async () => {
    try {
      const position = await readCurrentPosition();
      const location = positionToLocation(position);
      setTrackingError(null);
      saveLocation(location);
      return location;
    } catch (e) {
      setTrackingError(e instanceof Error ? e.message : 'Unable to determine your current location.');
      throw e;
    }
  }, [saveLocation]);

  const clearWatch = useCallback(() => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
  }, []);

  const stopLiveTracking = useCallback(() => {
    trackingUsersRef.current = Math.max(0, trackingUsersRef.current - 1);
    if (trackingUsersRef.current === 0) clearWatch();
  }, [clearWatch]);

  const startLiveTracking = useCallback(() => {
    trackingUsersRef.current += 1;
    const insecure = insecureMessage();
    if (insecure) { setTrackingError(insecure); return; }
    if (!navigator.geolocation) { setTrackingError('This browser does not support current location.'); return; }
    if (watchIdRef.current != null) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const next = positionToLocation(position);
        setTrackingError(null);
        setCurrentLocation((previous) => {
          if (previous && !hasMovedEnough(previous, next) && previous.address) {
            return { ...previous, accuracy: next.accuracy, updatedAt: next.updatedAt };
          }
          const withoutAddress = { ...next, address: previous?.address };
          persistLocation(withoutAddress);
          resolveAddress(withoutAddress);
          return withoutAddress;
        });
      },
      (error) => {
        // Keep the last known location; report the problem. A denied permission stops tracking for good.
        setTrackingError(locationErrorMessage(error));
        if (error.code === error.PERMISSION_DENIED) clearWatch();
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
    setIsTracking(true);
  }, [resolveAddress, clearWatch]);

  useEffect(() => {
    return () => {
      geocodeAbortRef.current?.abort();
      trackingUsersRef.current = 0;
      clearWatch();
    };
  }, [clearWatch]);

  return (
    <LocationContext.Provider
      value={{
        currentLocation,
        addressStatus,
        addressError,
        isTracking,
        trackingError,
        saveLocation,
        requestCurrentLocation,
        startLiveTracking,
        stopLiveTracking,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useCurrentLocation() {
  const context = useContext(LocationContext);
  if (!context) throw new Error('useCurrentLocation must be used within LocationProvider');
  return context;
}

/**
 * Live location while the calling screen is open: starts automatically when the customer has already allowed
 * location for this site (never pops a permission prompt on its own), and stops when the screen closes.
 * `enable()` is for a "Use current location" tap: asks for permission, then keeps tracking.
 */
export function useLiveLocation() {
  const ctx = useCurrentLocation();
  const { startLiveTracking, stopLiveTracking, requestCurrentLocation } = ctx;
  const holding = useRef(false);

  const hold = useCallback(() => {
    if (holding.current) return;
    holding.current = true;
    startLiveTracking();
  }, [startLiveTracking]);

  useEffect(() => {
    let status: PermissionStatus | null = null;
    let cancelled = false;
    const onChange = () => { if (status?.state === 'granted') hold(); };
    navigator.permissions?.query({ name: 'geolocation' as PermissionName })
      .then((s) => {
        if (cancelled) return;
        status = s;
        if (s.state === 'granted') hold();
        s.addEventListener('change', onChange);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      status?.removeEventListener('change', onChange);
      if (holding.current) { holding.current = false; stopLiveTracking(); }
    };
  }, [hold, stopLiveTracking]);

  const enable = useCallback(async () => {
    await requestCurrentLocation();
    hold();
  }, [requestCurrentLocation, hold]);

  return { ...ctx, enable };
}
