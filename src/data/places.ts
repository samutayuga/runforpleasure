import type { Place } from "../core/places";
import { PLACES_PACKED } from "./placesData";

// Parse the packed "name|lat|lon" records once at module load. Names never
// contain "|" (stripped at generation time), so a plain split is safe.
export const PLACES: Place[] = PLACES_PACKED.split("\n").map((line) => {
  const parts = line.split("|");
  return { name: parts[0], lat: Number(parts[1]), lon: Number(parts[2]) };
});
