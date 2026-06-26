import { describe, it, expect } from "vitest";
import { readinessFactor, readinessLevel } from "../readiness";

describe("readinessFactor", () => {
  it("treats undefined sleep as fully rested", () => {
    expect(readinessFactor(undefined)).toBe(1);
  });
  it("is 1.0 at 7h and clamps above", () => {
    expect(readinessFactor(7)).toBeCloseTo(1, 5);
    expect(readinessFactor(9)).toBe(1);
  });
  it("interpolates linearly between 3h and 7h", () => {
    expect(readinessFactor(6)).toBeCloseTo(0.975, 5);
    expect(readinessFactor(5)).toBeCloseTo(0.95, 5);
    expect(readinessFactor(4)).toBeCloseTo(0.925, 5);
  });
  it("floors at 0.90 at 3h and below", () => {
    expect(readinessFactor(3)).toBeCloseTo(0.9, 5);
    expect(readinessFactor(0)).toBe(0.9);
  });
});

describe("readinessLevel", () => {
  it("ready at full readiness", () => {
    expect(readinessLevel(1)).toBe("ready");
    expect(readinessLevel(0.99)).toBe("ready");
  });
  it("compromised in the mid band", () => {
    expect(readinessLevel(0.975)).toBe("compromised");
    expect(readinessLevel(0.94)).toBe("compromised");
  });
  it("under below the mid band", () => {
    expect(readinessLevel(0.925)).toBe("under");
    expect(readinessLevel(0.9)).toBe("under");
  });
});
