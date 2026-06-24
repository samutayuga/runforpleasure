import type { ZoneId } from "../core/karvonen";

export const ZONE_THEME: Record<ZoneId, { label: string; color: string; icon: string }> = {
  below: { label: "Below Z2", color: "#6B7280", icon: "🚶" },
  zone2: { label: "Zone 2 · Aerobic", color: "#0E7C7B", icon: "🟢" },
  zone3: { label: "Zone 3 · Tempo", color: "#B45309", icon: "🟠" },
  above: { label: "Above Z3", color: "#9D174D", icon: "🔴" },
};
