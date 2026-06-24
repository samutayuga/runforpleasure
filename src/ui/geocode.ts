const cache = new Map<string, string | null>();
const keyOf = (lat: number, lon: number) => `${lat.toFixed(4)},${lon.toFixed(4)}`;

interface NominatimAddress {
  neighbourhood?: string;
  suburb?: string;
  quarter?: string;
  hamlet?: string;
  village?: string;
  town?: string;
  city_district?: string;
  road?: string;
  city?: string;
}

// Reverse geocode to a short, human area name. Cached. Returns null on failure (offline / rate-limited).
export async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  const k = keyOf(lat, lon);
  const cached = cache.get(k);
  if (cached !== undefined) return cached;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=jsonv2&zoom=16&addressdetails=1`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) { cache.set(k, null); return null; }
    const data: { address?: NominatimAddress; name?: string } = await res.json();
    const a = data.address ?? {};
    const name =
      a.neighbourhood || a.suburb || a.quarter || a.hamlet || a.village ||
      a.town || a.city_district || a.road || a.city || data.name || null;
    cache.set(k, name);
    return name;
  } catch {
    cache.set(k, null);
    return null;
  }
}
