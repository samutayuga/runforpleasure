import { nearestPlace } from "../core/places";
import { PLACES } from "../data/places";

// Offline reverse geocode: nearest named place from the bundled GeoNames
// cities1000 dataset. No network, no API key, no coordinates leave the device
// (honours NFR-6.2). Async signature retained so existing callers are unchanged.
export async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  return nearestPlace(lat, lon, PLACES);
}
