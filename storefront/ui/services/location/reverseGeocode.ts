const NOMINATIM_REVERSE = 'https://nominatim.openstreetmap.org/reverse';

let lastRequestAt = 0;

async function waitForNominatimSlot() {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < 1100) {
    await new Promise((resolve) => setTimeout(resolve, 1100 - elapsed));
  }
  lastRequestAt = Date.now();
}

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

/** Address parts for a map position (OpenStreetMap Nominatim; at most one request a second). */
export async function reverseGeocodeDetails(latitude: number, longitude: number, signal?: AbortSignal): Promise<GeocodedPlace> {
  await waitForNominatimSlot();
  const params = new URLSearchParams({ format: 'jsonv2', lat: String(latitude), lon: String(longitude), zoom: '18', addressdetails: '1' });
  const response = await fetch(`${NOMINATIM_REVERSE}?${params.toString()}`, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Address lookup failed.');
  const p = (await response.json()) as { display_name?: string; address?: Record<string, string> };
  const a = p.address ?? {};
  return {
    address: p.display_name?.trim() ?? formatCoordinates(latitude, longitude),
    area: a.road ?? a.neighbourhood ?? a.suburb ?? a.village ?? a.hamlet,
    city: a.city ?? a.town ?? a.village ?? a.county ?? a.state_district,
    state: a.state,
    pincode: a.postcode?.replace(/\s/g, ''),
  };
}

export async function reverseGeocode(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<string> {
  await waitForNominatimSlot();

  const params = new URLSearchParams({
    format: 'jsonv2',
    lat: String(latitude),
    lon: String(longitude),
    zoom: '18',
    addressdetails: '1',
  });

  const response = await fetch(`${NOMINATIM_REVERSE}?${params.toString()}`, {
    signal,
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error('Address lookup failed.');
  }

  const payload = (await response.json()) as { display_name?: string };
  const address = payload.display_name?.trim();
  if (!address) {
    throw new Error('No address was found for this location.');
  }

  return address;
}
