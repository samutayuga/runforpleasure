import type { TrackPoint } from "./types";

export class ReplayEngine {
  private points: TrackPoint[];
  private speed: number;
  private elapsedMs = 0;
  private offsets: number[];
  private totalMs: number;
  private _playing = false;

  constructor(points: TrackPoint[], speed = 1) {
    this.points = points;
    this.speed = speed;
    const start = points.length ? points[0].time.getTime() : 0;
    this.offsets = points.map((p) => p.time.getTime() - start);
    this.totalMs = this.offsets.length ? this.offsets[this.offsets.length - 1] : 0;
  }

  get playing(): boolean {
    return this._playing;
  }

  play(): void {
    this._playing = true;
  }

  pause(): void {
    this._playing = false;
  }

  setSpeed(multiplier: number): void {
    this.speed = multiplier;
  }

  seekToStart(): void {
    this.elapsedMs = 0;
  }

  advance(realDeltaMs: number): void {
    if (!this._playing) return;
    this.elapsedMs = Math.min(this.totalMs, this.elapsedMs + realDeltaMs * this.speed);
  }

  get index(): number {
    let i = 0;
    while (i + 1 < this.offsets.length && this.offsets[i + 1] <= this.elapsedMs) i++;
    return i;
  }

  get finished(): boolean {
    return this.elapsedMs >= this.totalMs && this.totalMs > 0;
  }

  get current(): TrackPoint {
    return this.points[this.index];
  }

  get fractionalIndex(): number {
    const i = this.index;
    if (i + 1 >= this.offsets.length) return i;
    const segDuration = this.offsets[i + 1] - this.offsets[i];
    if (segDuration === 0) return i;
    const frac = (this.elapsedMs - this.offsets[i]) / segDuration;
    return i + Math.min(1, Math.max(0, frac));
  }
}
