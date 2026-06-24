import React, { useMemo } from "react";
import { View } from "react-native";
import Svg, { Polyline, Circle } from "react-native-svg";
import { projectRoute } from "../core/projection";
import type { TrackPoint } from "../core/types";

export function RouteView({
  points,
  currentIndex,
  markerColor,
  size = 280,
}: {
  points: TrackPoint[];
  currentIndex: number;
  markerColor: string;
  size?: number;
}): React.JSX.Element {
  const xy = useMemo(() => projectRoute(points, size, size, 16), [points, size]);
  const polyline = useMemo(() => xy.map((p) => `${p.x},${p.y}`).join(" "), [xy]);

  // Interpolate marker position from fractional index
  const clamped = Math.max(0, Math.min(currentIndex, xy.length - 1));
  const i = Math.floor(clamped);
  const frac = clamped - i;
  const a = xy[i] ?? { x: 0, y: 0 };
  const b = xy[i + 1] ?? a;
  const marker = { x: a.x + (b.x - a.x) * frac, y: a.y + (b.y - a.y) * frac };

  // Build orange passed-trail points string (guard: skip if nothing traversed yet)
  const passedPolyline = clamped > 0
    ? [...xy.slice(0, i + 1), marker].map((p) => `${p.x},${p.y}`).join(" ")
    : null;

  return (
    <View accessibilityLabel="Route map" style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {/* 1. Full route */}
        <Polyline points={polyline} fill="none" stroke="#94A3B8" strokeWidth={3} />
        {/* 2. Passed trail (bright orange) */}
        {passedPolyline !== null && (
          <Polyline points={passedPolyline} fill="none" stroke="#FB923C" strokeWidth={4} />
        )}
        {/* 3. Marker on top */}
        <Circle cx={marker.x} cy={marker.y} r={7} fill={markerColor} stroke="#F8FAFC" strokeWidth={2} />
      </Svg>
    </View>
  );
}
