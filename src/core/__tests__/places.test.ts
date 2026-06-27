import { describe, it, expect } from "vitest";
import { nearestPlace, type Place } from "../places";

const places: Place[] = [
  { name: "Alpha", lat: 0, lon: 0 },
  { name: "Beta", lat: 10, lon: 10 },
  { name: "Gamma", lat: -5, lon: 20 },
];

describe("nearestPlace", () => {
  it("returns null for an empty list", () => {
    expect(nearestPlace(1, 1, [])).toBeNull();
  });

  it("picks the closest place by distance", () => {
    expect(nearestPlace(0.5, 0.5, places)).toBe("Alpha");
    expect(nearestPlace(9, 11, places)).toBe("Beta");
    expect(nearestPlace(-4, 19, places)).toBe("Gamma");
  });

  it("scales longitude by latitude cosine (closer in latitude wins)", () => {
    const near = nearestPlace(9.9, 0, [
      { name: "SameLatFarLon", lat: 9.9, lon: 30 },
      { name: "NearLat", lat: 11, lon: 0 },
    ]);
    expect(near).toBe("NearLat");
  });
});
