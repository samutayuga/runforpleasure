import type { ZoneId } from "./karvonen";
import type { DecouplingRating } from "./decoupling";

export interface ZoneInfo {
  id: ZoneId;
  label: string;
  range: string;
  fuel: string;
  meaning: string;
}

export interface DriftBand {
  rating: DecouplingRating;
  range: string;
  meaning: string;
}

export const DRIFT_INTRO =
  "Drift (aerobic decoupling) compares the first and second half of your run. " +
  "It measures how much your heart rate crept up to hold the same pace. Lower is " +
  "better — under 5% is a solid, well-paced aerobic run. It needs about 6 minutes " +
  "of running before it can show a number.";

export const ZONE_INFO: ZoneInfo[] = [
  {
    id: "below",
    label: "Below Zone 2",
    range: "Under 60% HRR",
    fuel: "Mostly fat",
    meaning: "Very easy — warm-up or recovery pace.",
  },
  {
    id: "zone2",
    label: "Zone 2 · Aerobic",
    range: "60–70% HRR",
    fuel: "Mostly fat",
    meaning: "Easy aerobic base. Builds endurance and fat-burning efficiency.",
  },
  {
    id: "zone3",
    label: "Zone 3 · Tempo",
    range: "70–80% HRR",
    fuel: "Fat + carbs",
    meaning: "Comfortably hard. Shifts toward burning carbohydrate (glycogen).",
  },
  {
    id: "above",
    label: "Above Zone 3",
    range: "Over 80% HRR",
    fuel: "Mostly carbs",
    meaning: "Hard effort. Burns mostly carbohydrate; not for base-building.",
  },
];

export const DRIFT_BANDS: DriftBand[] = [
  {
    rating: "good",
    range: "< 5%",
    meaning: "Heart rate held steady. Strong aerobic base, well paced.",
  },
  {
    rating: "moderate",
    range: "5–10%",
    meaning: "Mild drift. Base still building, or you started too fast.",
  },
  {
    rating: "high",
    range: "≥ 10%",
    meaning: "Heart rate climbed to hold pace. Went too hard, under-trained, hot, or under-fuelled.",
  },
];
