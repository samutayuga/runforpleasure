import React from "react";
import { View } from "react-native";
import Svg, { Line, Text as SvgText } from "react-native-svg";
import { buildZoneTimeline } from "../core/zoneTimeline";
import { formatDuration } from "../core/format";
import { ZONE_THEME } from "./theme";
import type { TrackPoint } from "../core/types";
import type { Profile } from "../core/karvonen";

const ROW_LABELS: { level: number; label: string }[] = [
  { level: 3, label: "Above" },
  { level: 2, label: "Z3" },
  { level: 1, label: "Z2" },
  { level: 0, label: "Below" },
];

export function ZoneTimeline({
  points,
  cumulative,
  profile,
  width,
  height = 132,
}: {
  points: TrackPoint[];
  cumulative: number[];
  profile: Profile;
  width: number;
  height?: number;
}): React.JSX.Element {
  const series = buildZoneTimeline(points, cumulative, profile);
  const pad = 16;
  const leftAxis = 34;
  const totalDist = cumulative[cumulative.length - 1] || 1;

  const x = (d: number) => leftAxis + (d / totalDist) * (width - leftAxis - pad);
  const y = (level: number) => height - pad - (level / 3) * (height - 2 * pad);

  const containerStyle = {
    width: "100%" as const,
    maxWidth: width,
    alignSelf: "center" as const,
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: "#1E293B",
  };

  if (series.length === 0) {
    return (
      <View style={containerStyle}>
        <Svg width={width} height={height}>
          <SvgText x={width / 2} y={height / 2} fill="#94A3B8" fontSize={12} textAnchor="middle">
            No heart-rate data
          </SvgText>
        </Svg>
      </View>
    );
  }

  const rows = ROW_LABELS.map((r) => (
    <React.Fragment key={r.level}>
      <Line x1={leftAxis} y1={y(r.level)} x2={width - pad} y2={y(r.level)} stroke="#1E293B" strokeWidth={1} />
      <SvgText x={2} y={y(r.level) + 3} fill="#94A3B8" fontSize={10}>
        {r.label}
      </SvgText>
    </React.Fragment>
  ));

  const steps: React.JSX.Element[] = [];
  for (let i = 0; i < series.length - 1; i++) {
    const a = series[i];
    const b = series[i + 1];
    const color = ZONE_THEME[a.zone].color;
    steps.push(
      <Line key={`h${i}`} x1={x(a.distanceM)} y1={y(a.level)} x2={x(b.distanceM)} y2={y(a.level)} stroke={color} strokeWidth={2.5} strokeLinecap="round" />,
    );
    if (a.level !== b.level) {
      steps.push(
        <Line key={`v${i}`} x1={x(b.distanceM)} y1={y(a.level)} x2={x(b.distanceM)} y2={y(b.level)} stroke={color} strokeWidth={2.5} strokeLinecap="round" />,
      );
    }
  }
  const lastP = series[series.length - 1];
  steps.push(
    <Line key="hlast" x1={x(lastP.distanceM) - 3} y1={y(lastP.level)} x2={x(lastP.distanceM)} y2={y(lastP.level)} stroke={ZONE_THEME[lastP.zone].color} strokeWidth={2.5} strokeLinecap="round" />,
  );

  const ticks = [0, 1 / 3, 2 / 3, 1].map((f, i) => {
    const d = f * totalDist;
    let nearest = series[0];
    for (const p of series) {
      if (Math.abs(p.distanceM - d) < Math.abs(nearest.distanceM - d)) nearest = p;
    }
    const tx = x(d);
    const anchor = i === 0 ? "start" : i === 3 ? "end" : "middle";
    return (
      <React.Fragment key={`t${i}`}>
        <SvgText x={tx} y={height + 1} fill="#94A3B8" fontSize={9} textAnchor={anchor}>
          {(d / 1000).toFixed(1)}km
        </SvgText>
        <SvgText x={tx} y={height - pad + 10} fill="#64748B" fontSize={8} textAnchor={anchor}>
          {formatDuration(nearest.elapsedSec)}
        </SvgText>
      </React.Fragment>
    );
  });

  return (
    <View style={containerStyle} accessibilityLabel="Zone over distance chart">
      <Svg width={width} height={height + 6}>
        {rows}
        {steps}
        {ticks}
        <SvgText x={width - pad} y={11} fill="#94A3B8" fontSize={10} textAnchor="end">
          Zone over distance
        </SvgText>
      </Svg>
    </View>
  );
}
