import { api } from '@/lib/api';

/**
 * Address lookups go through the BuildMate API (GET /api/geo/reverse), which caches results and talks to the
 * geocoding provider (OpenStreetMap by default, Google when configured on the server). Browsers no longer call
 * OpenStreetMap directly, so a busy live site isn't rate-limited or blocked by it.
 */

export function formatCoordinates(latitude: number, longitude: number): string {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

export interface GeocodedPlace {
  address: string;
  area?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

type ApiPlace = { address: string; area?: string | null; city?: string | null; state?: string | null; pincode?: string | null };

function abortable<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new DOMException('Aborted', 'AbortError'));
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  });
}

/** Address parts for a map position. */
export async function reverseGeocodeDetails(latitude: number, longitude: number, signal?: AbortSignal): Promise<GeocodedPlace> {
  const q = new URLSearchParams({ lat: latitude.toFixed(6), lng: longitude.toFixed(6) });
  const p = await abortable(api<ApiPlace>(`/api/geo/reverse?${q.toString()}`), signal);
  return {
    address: p.address?.trim() || formatCoordinates(latitude, longitude),
    area: p.area ?? undefined,
    city: p.city ?? undefined,
    state: p.state ?? undefined,
    pincode: p.pincode ?? undefined,
  };
}

export async function reverseGeocode(latitude: number, longitude: number, signal?: AbortSignal): Promise<string> {
  const place = await reverseGeocodeDetails(latitude, longitude, signal);
  if (!place.address) throw new Error('No address was found for this location.');
  return place.address;
}
