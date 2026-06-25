import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { Decoupling, DecouplingRating } from "../core/decoupling";
import { gaugeFraction, trendArrow } from "../core/driftGauge";

const RATING_COLOR: Record<DecouplingRating, string> = {
  good: "#0E7C7B",
  moderate: "#B45309",
  high: "#9D174D",
};
const NEUTRAL = "#475569";

const ARROW_ICON = {
  up: "trending-up",
  flat: "trending-neutral",
  down: "trending-down",
} as const;

export function DriftGauge({
  decoupling,
  size = 96,
}: {
  decoupling: Decoupling;
  size?: number;
}): React.JSX.Element {
  const { pct, rating } = decoupling;
  const color = rating ? RATING_COLOR[rating] : NEUTRAL;

  const stroke = Math.max(6, size * 0.09);
  const r = size / 2 - stroke;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const arcLen = 0.75 * circ; // 270° sweep
  const frac = gaugeFraction(pct);
  const arrow = trendArrow(pct);

  const valueText = pct === null ? "—" : `${pct >= 0 ? "+" : ""}${Math.round(pct)}%`;
  const word =
    pct === null ? "warming up" : rating ? rating[0].toUpperCase() + rating.slice(1) : "";
  const a11y = pct === null ? "Drift not available yet" : `Drift ${valueText}, ${rating ?? ""}`;

  return (
    <View style={{ width: size, height: size }} accessibilityLabel={a11y}>
      <Svg width={size} height={size}>
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke="#1E293B"
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${arcLen} ${circ}`}
          strokeLinecap="round"
          rotation={135}
          originX={cx}
          originY={cy}
        />
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${frac * arcLen} ${circ}`}
          strokeLinecap="round"
          rotation={135}
          originX={cx}
          originY={cy}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <MaterialCommunityIcons name="heart-pulse" size={size * 0.18} color={color} />
        <Text style={{ fontSize: size * 0.22, fontWeight: "800", color: "#F1F5F9" }}>
          {valueText}
        </Text>
        <Text style={{ fontSize: size * 0.11, color: "#94A3B8" }}>{word}</Text>
        <MaterialCommunityIcons name={ARROW_ICON[arrow]} size={size * 0.16} color={color} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center", gap: 1 },
});
