import { describe, it, expect } from "vitest";
import { ReplayEngine } from "../replayEngine";
import type { TrackPoint } from "../types";

function track(): TrackPoint[] {
  // points at t = 0s, 1s, 2s, 3s
  return [0, 1, 2, 3].map((s) => ({
    lat: 1.35,
    lon: 103.75,
    ele: null,
    time: new Date(s * 1000),
    hr: 150 + s,
  }));
}

describe("ReplayEngine", () => {
  it("starts paused at index 0", () => {
    const e = new ReplayEngine(track());
    expect(e.playing).toBe(false);
    expect(e.index).toBe(0);
  });

  it("does not advance while paused", () => {
    const e = new ReplayEngine(track());
    e.advance(2000);
    expect(e.index).toBe(0);
  });

  it("advances by real time at 1x", () => {
    const e = new ReplayEngine(track());
    e.play();
    e.advance(1500); // 1.5s elapsed -> still at the 1s point
    expect(e.index).toBe(1);
    e.advance(1000); // 2.5s elapsed -> the 2s point
    expect(e.index).toBe(2);
  });

  it("honours the speed multiplier", () => {
    const e = new ReplayEngine(track(), 2);
    e.play();
    e.advance(1000); // 2s of replay time
    expect(e.index).toBe(2);
  });

  it("clamps and reports finished at the end", () => {
    const e = new ReplayEngine(track());
    e.play();
    e.advance(10_000);
    expect(e.index).toBe(3);
    expect(e.finished).toBe(true);
  });

  it("seekToStart resets elapsed", () => {
    const e = new ReplayEngine(track());
    e.play();
    e.advance(5000);
    e.seekToStart();
    expect(e.index).toBe(0);
    expect(e.finished).toBe(false);
  });

  it("exposes the current point", () => {
    const e = new ReplayEngine(track());
    e.play();
    e.advance(2000);
    expect(e.current.hr).toBe(152);
  });
});

describe("ReplayEngine.fractionalIndex", () => {
  it("paused at start → fractionalIndex === 0", () => {
    const e = new ReplayEngine(track());
    expect(e.fractionalIndex).toBe(0);
  });

  it("play + advance(1500) → fractionalIndex close to 1.5", () => {
    const e = new ReplayEngine(track());
    e.play();
    e.advance(1500);
    expect(e.fractionalIndex).toBeCloseTo(1.5, 5);
  });

  it("play + advance(500) → fractionalIndex close to 0.5", () => {
    const e = new ReplayEngine(track());
    e.play();
    e.advance(500);
    expect(e.fractionalIndex).toBeCloseTo(0.5, 5);
  });

  it("play + advance(10_000) past end → fractionalIndex === 3 (last index)", () => {
    const e = new ReplayEngine(track());
    e.play();
    e.advance(10_000);
    expect(e.fractionalIndex).toBe(3);
  });

  it("seekToStart after advancing → fractionalIndex === 0", () => {
    const e = new ReplayEngine(track());
    e.play();
    e.advance(2000);
    e.seekToStart();
    expect(e.fractionalIndex).toBe(0);
  });
});

describe("ReplayEngine seek + progress", () => {
  it("progress is 0 at start and 1 at the end", () => {
    const e = new ReplayEngine(track());
    expect(e.progress).toBe(0);
    e.play();
    e.advance(10_000);
    expect(e.progress).toBe(1);
  });

  it("seekToFraction jumps to the matching point in time", () => {
    const e = new ReplayEngine(track()); // 3s total
    e.seekToFraction(0.5); // 1.5s -> the 1s point, halfway to 2s
    expect(e.fractionalIndex).toBeCloseTo(1.5, 5);
    expect(e.progress).toBeCloseTo(0.5, 5);
  });

  it("clamps the fraction to [0,1]", () => {
    const e = new ReplayEngine(track());
    e.seekToFraction(2);
    expect(e.progress).toBe(1);
    expect(e.finished).toBe(true);
    e.seekToFraction(-1);
    expect(e.progress).toBe(0);
  });

  it("can seek without playing (drag to scrub while paused)", () => {
    const e = new ReplayEngine(track());
    e.seekToFraction(1 / 3); // -> the 1s point
    expect(e.playing).toBe(false);
    expect(e.index).toBe(1);
  });
});
