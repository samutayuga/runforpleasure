export interface TrackPoint {
  lat: number;
  lon: number;
  ele: number | null;
  time: Date;
  hr: number | null;
}

export interface Run {
  name: string;
  points: TrackPoint[];
}
