import { describe, it, expect } from "vitest";
import { routeAreaMarkers } from "../areaMarkers";
import type { Place } from "../places";
import type { TrackPoint } from "../types";

const places: Place[] = [
  { name: "Aville", lat: 0, lon: 0 },
  { name: "Bville", lat: 0, lon: 1 },
];

// Six points marching east along lat 0; nearest flips A->B past lon 0.5.
function route(): TrackPoint[] {
  return [0, 0.2, 0.4, 0.6, 0.8, 1.0].map((lon) => ({
    lat: 0,
    lon,
    ele: null,
    time: new Date(0),
    hr: null,
  }));
}
// ~22 km between each step so every point is sampled at the default stride.
const cum = [0, 22000, 44000, 66000, 88000, 110000];

describe("routeAreaMarkers", () => {
  it("returns nothing for an empty route or empty dataset", () => {
    expect(routeAreaMarkers([], cum, places)).toEqual([]);
    expect(routeAreaMarkers(route(), cum, [])).toEqual([]);
  });

  it("marks the start area and each new area entered", () => {
    const markers = routeAreaMarkers(route(), cum, places);
    expect(markers.map((m) => m.name)).toEqual(["Aville", "Bville"]);
  });

  it("places the new-area marker at the first point inside it", () => {
    const markers = routeAreaMarkers(route(), cum, places);
    expect(markers[1].lon).toBeCloseTo(0.6, 5); // first point where Bville is nearest
  });

  it("does not repeat a marker while the nearest area is unchanged", () => {
    const markers = routeAreaMarkers(route(), cum, places);
    expect(markers).toHaveLength(2);
  });
});
