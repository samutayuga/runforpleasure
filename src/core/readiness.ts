export type ReadinessLevel = "ready" | "compromised" | "under";

function clamp(min: number, max: number, x: number): number {
  return Math.min(max, Math.max(min, x));
}

// Recovery multiplier in [0.90, 1.00]. Undefined sleep = fully rested (1.00).
// >= 7h -> 1.00 ; linear over 3h..7h ; <= 3h -> 0.90 floor.
export function readinessFactor(sleepHours?: number): number {
  if (sleepHours === undefined) return 1;
  return clamp(0.9, 1, 0.9 + ((sleepHours - 3) / 4) * 0.1);
}

// 🟢 ready (>=0.99) / 🟡 compromised (>=0.94) / 🔴 under (else)
export function readinessLevel(factor: number): ReadinessLevel {
  if (factor >= 0.99) return "ready";
  if (factor >= 0.94) return "compromised";
  return "under";
}
