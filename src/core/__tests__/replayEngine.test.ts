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
