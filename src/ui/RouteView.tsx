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
  const marker = xy[Math.min(currentIndex, xy.length - 1)] ?? { x: 0, y: 0 };

  return (
    <View accessibilityLabel="Route map" style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Polyline points={polyline} fill="none" stroke="#CBD5E1" strokeWidth={3} />
        <Circle cx={marker.x} cy={marker.y} r={7} fill={markerColor} stroke="#fff" strokeWidth={2} />
      </Svg>
    </View>
  );
}
