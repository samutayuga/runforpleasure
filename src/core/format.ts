function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function formatDuration(sec: number): string {
  const total = Math.floor(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function formatDistance(meters: number): string {
  return `${(meters / 1000).toFixed(2)} km`;
}

export function formatPace(min: number | null): string {
  if (min === null) return "--:-- /km";
  const m = Math.floor(min);
  const s = Math.round((min - m) * 60);
  return `${m}:${pad(s)} /km`;
}
