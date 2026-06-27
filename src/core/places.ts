export interface Place {
  name: string;
  lat: number;
  lon: number;
}

// Nearest place name by squared equirectangular distance — fast (no sqrt, no
// trig per candidate) and accurate enough at city scale. Returns null for an
// empty list. Longitude is scaled by cos(latitude) so degrees compare fairly.
export function nearestPlace(lat: number, lon: number, places: Place[]): string | null {
  if (places.length === 0) return null;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  let best = Infinity;
  let bestName: string | null = null;
  for (let i = 0; i < places.length; i++) {
    const dLat = places[i].lat - lat;
    const dLon = (places[i].lon - lon) * cosLat;
    const d = dLat * dLat + dLon * dLon;
    if (d < best) {
      best = d;
      bestName = places[i].name;
    }
  }
  return bestName;
}
