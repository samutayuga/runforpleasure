import React, { useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from "react-native";
import { formatDuration } from "../core/format";

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

// Drag-to-scrub time controller. Maps a horizontal drag along the track to a
// 0..1 fraction of the run and reports it via onSeek, so the runner moves with
// the thumb. Scrub to the end to jump straight to the report.
export function TimeSlider({
  progress,
  totalSec,
  onSeek,
  onScrubStart,
  onScrubEnd,
}: {
  progress: number;
  totalSec: number;
  onSeek: (fraction: number) => void;
  onScrubStart?: () => void;
  onScrubEnd?: () => void;
}): React.JSX.Element {
  const trackRef = useRef<View>(null);
  const geom = useRef({ left: 0, width: 0 });

  const measure = () => {
    trackRef.current?.measureInWindow((x, _y, w) => {
      geom.current = { left: x, width: w };
    });
  };

  const seekAtPageX = (pageX: number) => {
    const { left, width } = geom.current;
    if (width > 0) onSeek(clamp01((pageX - left) / width));
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (_e: GestureResponderEvent, g: PanResponderGestureState) => {
        onScrubStart?.();
        measure();
        seekAtPageX(g.x0);
      },
      onPanResponderMove: (_e: GestureResponderEvent, g: PanResponderGestureState) => {
        seekAtPageX(g.moveX);
      },
      onPanResponderRelease: () => onScrubEnd?.(),
      onPanResponderTerminate: () => onScrubEnd?.(),
    }),
  ).current;

  const pct = clamp01(progress) * 100;
  const elapsedSec = clamp01(progress) * totalSec;

  return (
    <View style={styles.wrap}>
      <View
        ref={trackRef}
        onLayout={measure}
        style={styles.track}
        {...pan.panHandlers}
        accessibilityRole="adjustable"
        accessibilityLabel="Run time scrubber"
        accessibilityValue={{ now: Math.round(pct), min: 0, max: 100 }}
      >
        <View style={styles.rail} />
        <View style={[styles.fill, { width: `${pct}%` }]} />
        <View style={[styles.thumb, { left: `${pct}%` }]} />
      </View>
      <View style={styles.labels}>
        <Text style={styles.time}>{formatDuration(elapsedSec)}</Text>
        <Text style={styles.timeMuted}>{formatDuration(totalSec)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  track: { height: 28, justifyContent: "center" },
  rail: { position: "absolute", left: 0, right: 0, height: 6, borderRadius: 3, backgroundColor: "#1E293B" },
  fill: {
    position: "absolute",
    height: 6,
    borderRadius: 3,
    backgroundColor: "#0E7C7B",
  },
  thumb: {
    position: "absolute",
    width: 18,
    height: 18,
    borderRadius: 9,
    marginLeft: -9,
    backgroundColor: "#F1F5F9",
    borderWidth: 2,
    borderColor: "#0E7C7B",
  },
  labels: { flexDirection: "row", justifyContent: "space-between" },
  time: { color: "#F1F5F9", fontSize: 12, fontWeight: "600" },
  timeMuted: { color: "#64748B", fontSize: 12 },
});
