import { describe, it, expect } from "vitest";
import { gaugeFraction, trendArrow } from "../driftGauge";

describe("gaugeFraction", () => {
  it("is 0 for null", () => {
    expect(gaugeFraction(null)).toBe(0);
  });
  it("is 0 at 0%", () => {
    expect(gaugeFraction(0)).toBe(0);
  });
  it("maps 5% to ~0.333 against the default cap of 15", () => {
    expect(gaugeFraction(5)).toBeCloseTo(1 / 3, 5);
  });
  it("maps 10% to ~0.667", () => {
    expect(gaugeFraction(10)).toBeCloseTo(2 / 3, 5);
  });
  it("is full at the cap", () => {
    expect(gaugeFraction(15)).toBe(1);
  });
  it("clamps above the cap", () => {
    expect(gaugeFraction(20)).toBe(1);
  });
  it("uses magnitude for negative drift", () => {
    expect(gaugeFraction(-6)).toBeCloseTo(0.4, 5);
  });
  it("honours a custom cap", () => {
    expect(gaugeFraction(5, 10)).toBeCloseTo(0.5, 5);
  });
});

describe("trendArrow", () => {
  it("is flat for null", () => {
    expect(trendArrow(null)).toBe("flat");
  });
  it("is up for positive drift", () => {
    expect(trendArrow(4)).toBe("up");
  });
  it("is down for negative drift", () => {
    expect(trendArrow(-4)).toBe("down");
  });
  it("is flat at zero", () => {
    expect(trendArrow(0)).toBe("flat");
  });
  it("treats the deadband as flat", () => {
    expect(trendArrow(0.4)).toBe("flat");
    expect(trendArrow(-0.4)).toBe("flat");
  });
});
