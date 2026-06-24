import React from "react";
import { RouteView } from "./RouteView";
import type { TrackPoint } from "../core/types";

export interface MapViewProps {
  points: TrackPoint[];
  progressIndex: number;
  markerColor: string;
  cumulative: number[];
  onRequestImport?: () => void;
  onRequestStrava?: () => void;
}

export default function MapView({ points, progressIndex, markerColor }: MapViewProps): React.JSX.Element {
  return <RouteView points={points} currentIndex={progressIndex} markerColor={markerColor} size={280} />;
}
