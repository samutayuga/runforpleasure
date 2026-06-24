import React from "react";
import { View } from "react-native";
import { Text } from "react-native-paper";
import Svg, { Rect } from "react-native-svg";
import type { SurfaceSample } from "./osmSurface";

export interface SurfaceStripProps { samples: SurfaceSample[]; width: number; }

const BUCKET_COLOR: Record<string, string> = {
  Paved:     "#475569",
  Gravel:    "#B45309",
  Dirt:      "#7C2D12",
  Sand:      "#CA8A04",
  Grass:     "#15803D",
  Boardwalk: "#92400E",
  Cobble:    "#6B7280",
  Other:     "#525252",
  Unknown:   "#1E293B",
};

function colorFor(surface: string | null): string {
  if (surface === null) return BUCKET_COLOR.Unknown;
  return BUCKET_COLOR[surface] ?? BUCKET_COLOR.Other;
}

export function SurfaceStrip({ samples, width }: SurfaceStripProps): React.JSX.Element {
  if (samples.length === 0) {
    return (
      <View style={{ backgroundColor: "#0F1A2E", borderRadius: 12, padding: 8 }}>
        <Text style={{ fontSize: 11, color: "#64748B" }}>Road surface: data unavailable</Text>
      </View>
    );
  }

  const pad = 14;
  const stripH = 22;
  const totalDist = samples[samples.length - 1].distanceM || 1;
  const xFor = (d: number) => pad + (d / totalDist) * (width - 2 * pad);

  // Distinct buckets for legend
  const distinctBuckets: string[] = [];
  for (const s of samples) {
    const label = s.surface === null ? "Unknown" : s.surface;
    if (!distinctBuckets.includes(label)) distinctBuckets.push(label);
  }

  return (
    <View style={{ backgroundColor: "#0F1A2E", borderRadius: 12, padding: 8 }}>
      <Text style={{ fontSize: 11, color: "#94A3B8", marginBottom: 4 }}>Road surface</Text>
      <Svg width={width} height={stripH}>
        {samples.map((sample, i) => {
          const x0 = xFor(sample.distanceM);
          const x1 = i + 1 < samples.length ? xFor(samples[i + 1].distanceM) : width - pad;
          const w = Math.max(1, x1 - x0);
          return (
            <Rect
              key={i}
              x={x0}
              y={0}
              width={w}
              height={stripH}
              fill={colorFor(sample.surface)}
            />
          );
        })}
      </Svg>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
        {distinctBuckets.map((label) => (
          <View key={label} style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: BUCKET_COLOR[label] ?? BUCKET_COLOR.Other }} />
            <Text style={{ fontSize: 10, color: "#94A3B8" }}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
