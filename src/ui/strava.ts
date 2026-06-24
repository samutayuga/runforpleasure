import type { TrackPoint } from "../core/types";

export interface StravaActivity {
  id: number;
  name: string;
  distance: number;      // metres
  start_date: string;    // ISO
  type: string;
  moving_time: number;   // seconds
}

const BASE = "https://www.strava.com/api/v3";

// List recent activities. Throws Error with a friendly message on failure.
export async function fetchActivities(token: string): Promise<StravaActivity[]> {
  const res = await fetch(`${BASE}/athlete/activities?per_page=30`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) throw new Error("Token rejected (401). Check the access token / scope (needs activity:read).");
  if (!res.ok) throw new Error(`Strava error ${res.status}.`);
  const data: unknown = await res.json();
  if (!Array.isArray(data)) throw new Error("Unexpected Strava response.");
  return (data as StravaActivity[]).map((a) => ({
    id: a.id, name: a.name, distance: a.distance, start_date: a.start_date, type: a.type, moving_time: a.moving_time,
  }));
}

interface StreamSet {
  latlng?: { data: Array<[number, number]> };
  altitude?: { data: number[] };
  time?: { data: number[] };
  heartrate?: { data: number[] };
}

// Fetch an activity's GPS streams and build TrackPoint[]. Throws on failure or no GPS.
export async function fetchActivityTrack(token: string, activity: StravaActivity): Promise<TrackPoint[]> {
  const res = await fetch(
    `${BASE}/activities/${activity.id}/streams?keys=latlng,altitude,time,heartrate&key_by_type=true`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Could not load activity streams (${res.status}).`);
  const s: StreamSet = await res.json();
  const latlng = s.latlng?.data ?? [];
  if (latlng.length === 0) throw new Error("This activity has no GPS data.");
  const alt = s.altitude?.data ?? [];
  const time = s.time?.data ?? [];
  const hr = s.heartrate?.data ?? [];
  const start = Date.parse(activity.start_date);
  return latlng.map(([lat, lon], i) => ({
    lat, lon,
    ele: alt[i] ?? null,
    time: new Date(start + (time[i] ?? i) * 1000),
    hr: hr[i] ?? null,
  }));
}
