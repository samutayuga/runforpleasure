import React from "react";
import { View } from "react-native";
import Svg, { Line, Circle, Text as SvgText, Rect } from "react-native-svg";
import { buildElevationProfile } from "../core/elevation";
import { zoneForHr } from "../core/karvonen";
import { ZONE_THEME } from "./theme";
import type { TrackPoint } from "../core/types";
import type { Profile } from "../core/karvonen";

export interface ElevationProfileProps {
  points: TrackPoint[];
  cumulative: number[]; // from geo.cumulativeDistances(points)
  profile: Profile;
  progressIndex: number; // fractional, from ReplayEngine.fractionalIndex
  width: number;
  height?: number; // default 120
}

const FALLBACK_COLOR = "#94A3B8";

export function ElevationProfile({
  points,
  cumulative,
  profile,
  progressIndex,
  width,
  height = 120,
}: ElevationProfileProps): React.JSX.Element {
  const samples = buildElevationProfile(points, cumulative);
  const pad = 14;

  // Downsample: never more than ~240 segments
  const STEP = Math.max(1, Math.ceil(samples.length / 240));
  const downsampled: typeof samples = [];
  for (let i = 0; i < samples.length; i += STEP) {
    downsampled.push(samples[i]);
  }
  // Always include the last sample
  const last = samples[samples.length - 1];
  if (last && downsampled[downsampled.length - 1] !== last) {
    downsampled.push(last);
  }

  // Compute range
  const eles = samples.map((s) => s.ele);
  const eleMin = Math.min(...eles);
  const eleMax = Math.max(...eles);
  const eleRange = eleMax === eleMin ? 1 : eleMax - eleMin;

  const totalDist = cumulative[cumulative.length - 1] || 1;

  const x = (d: number) => pad + (d / totalDist) * (width - 2 * pad);
  const y = (e: number) => pad + ((eleMax - e) / eleRange) * (height - 2 * pad);

  // Build zone-colored segments
  const segments: React.JSX.Element[] = [];
  for (let i = 0; i < downsampled.length - 1; i++) {
    const a = downsampled[i];
    const b = downsampled[i + 1];
    const zone = zoneForHr(points[a.index].hr, profile);
    const color = zone ? ZONE_THEME[zone].color : FALLBACK_COLOR;
    segments.push(
      <Line
        key={i}
        x1={x(a.distanceM)}
        y1={y(a.ele)}
        x2={x(b.distanceM)}
        y2={y(b.ele)}
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
      />,
    );
  }

  // Cursor position
  const clampedProgress = Math.max(0, Math.min(progressIndex, points.length - 1));
  const ci = Math.floor(clampedProgress);
  const frac = clampedProgress - ci;
  const nextCi = Math.min(ci + 1, cumulative.length - 1);
  const cursorDist = cumulative[ci] + (cumulative[nextCi] - cumulative[ci]) * frac;
  const cursorEle = samples[ci].ele + (samples[Math.min(ci + 1, samples.length - 1)].ele - samples[ci].ele) * frac;
  const cursorX = x(cursorDist);
  const cursorY = y(cursorEle);

  return (
    <View
      style={{
        width: "100%",
        maxWidth: width,
        alignSelf: "center",
        backgroundColor: "transparent",
        padding: 8,
        borderTopWidth: 1,
        borderTopColor: "#1E293B",
      }}
    >
      <Svg width={width} height={height + 4}>
        {/* Background baseline */}
        <Line
          x1={pad}
          y1={y(eleMin)}
          x2={width - pad}
          y2={y(eleMin)}
          stroke="#334155"
          strokeWidth={1}
        />

        {/* Zone-colored profile segments */}
        {segments}

        {/* Cursor vertical line */}
        <Line
          x1={cursorX}
          y1={pad}
          x2={cursorX}
          y2={height - pad}
          stroke="#F8FAFC"
          strokeWidth={1}
          strokeDasharray="3,2"
        />

        {/* Cursor circle on the profile */}
        <Circle cx={cursorX} cy={cursorY} r={4} fill="#FB923C" />

        {/* Labels */}
        {/* Max elevation top-left */}
        <SvgText x={pad + 2} y={pad + 10} fill="#94A3B8" fontSize={10}>
          {`${Math.round(eleMax)} m`}
        </SvgText>

        {/* Min elevation bottom-left */}
        <SvgText x={pad + 2} y={height - 2} fill="#94A3B8" fontSize={10}>
          {`${Math.round(eleMin)} m`}
        </SvgText>

        {/* Total distance bottom-right */}
        <SvgText x={width - pad - 2} y={height - 2} fill="#94A3B8" fontSize={10} textAnchor="end">
          {`${(totalDist / 1000).toFixed(2)} km`}
        </SvgText>

        {/* Title top-right */}
        <SvgText x={width - pad - 2} y={pad + 10} fill="#94A3B8" fontSize={10} textAnchor="end">
          Elevation · zone
        </SvgText>
      </Svg>
    </View>
  );
}
