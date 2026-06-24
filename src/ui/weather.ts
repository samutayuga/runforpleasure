export interface Weather {
  temperatureC: number | null;
  humidityPct: number | null;
  windKmh: number | null;
  condition: string | null;
}

const WMO: Array<[number, number, string]> = [
  [0, 0, "Clear"], [1, 1, "Mainly clear"], [2, 2, "Partly cloudy"], [3, 3, "Overcast"],
  [45, 48, "Fog"], [51, 57, "Drizzle"], [61, 67, "Rain"], [71, 77, "Snow"],
  [80, 82, "Showers"], [85, 86, "Snow showers"], [95, 99, "Thunderstorm"],
];
function describe(code: number | null): string | null {
  if (code === null) return null;
  for (const [lo, hi, label] of WMO) if (code >= lo && code <= hi) return label;
  return null;
}

// Fetch hourly weather nearest `when` at (lat,lon) from Open-Meteo (no API key).
// Returns null on any failure (offline, parse error, out-of-range date).
export async function fetchWeather(lat: number, lon: number, when: Date): Promise<Weather | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code` +
      `&past_days=16&forecast_days=1&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json() as unknown;
    const hourly = (data as Record<string, unknown>)?.hourly;
    const times: string[] = Array.isArray((hourly as Record<string, unknown>)?.time)
      ? ((hourly as Record<string, unknown>).time as string[])
      : [];
    if (times.length === 0) return null;
    // find the hourly index closest to `when`
    const target = when.getTime();
    let best = 0;
    let bestDiff = Infinity;
    for (let i = 0; i < times.length; i++) {
      const diff = Math.abs(new Date(times[i]).getTime() - target);
      if (diff < bestDiff) { bestDiff = diff; best = i; }
    }
    const num = (a: unknown): number | null => {
      const v = Array.isArray(a) ? a[best] : undefined;
      return typeof v === "number" ? v : null;
    };
    const h = hourly as Record<string, unknown>;
    const code = num(h?.weather_code);
    return {
      temperatureC: num(h?.temperature_2m),
      humidityPct: num(h?.relative_humidity_2m),
      windKmh: num(h?.wind_speed_10m),
      condition: describe(code),
    };
  } catch {
    return null;
  }
}
