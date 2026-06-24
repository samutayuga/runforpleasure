import { describe, it, expect } from "vitest";
import { formatDuration, formatDistance, formatPace } from "../format";

describe("formatDuration", () => {
  it("formats under an hour as M:SS", () => {
    expect(formatDuration(125)).toBe("2:05");
  });
  it("formats over an hour as H:MM:SS", () => {
    expect(formatDuration(3725)).toBe("1:02:05");
  });
});

describe("formatDistance", () => {
  it("formats metres as km with 2 dp", () => {
    expect(formatDistance(1500)).toBe("1.50 km");
  });
});

describe("formatPace", () => {
  it("formats a pace value", () => {
    expect(formatPace(5.5)).toBe("5:30 /km");
  });
  it("formats null as placeholder", () => {
    expect(formatPace(null)).toBe("--:-- /km");
  });
});
