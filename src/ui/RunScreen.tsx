import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { parseGpx } from "../core/gpxParser";
import { cumulativeDistances } from "../core/geo";
import { ReplayEngine } from "../core/replayEngine";
import { deriveMetrics } from "../core/metrics";
import type { Run } from "../core/types";
import type { Profile } from "../core/karvonen";
import { ZONE_THEME } from "./theme";
import { RouteView } from "./RouteView";
import { Dashboard } from "./Dashboard";
import { loadSampleGpx } from "./loadSampleGpx";

const SPEEDS = [1, 4, 8];

export function RunScreen({ profile }: { profile: Profile }): React.JSX.Element {
  const [run, setRun] = useState<Run | null>(null);
  const [error, setError] = useState(false);
  const [, force] = useState(0);
  const engineRef = useRef<ReplayEngine | null>(null);
  const speedIdx = useRef(0);
  const lastTs = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadSampleGpx()
      .then((xml) => {
        if (cancelled) return;
        const parsed = parseGpx(xml);
        setRun(parsed);
        engineRef.current = new ReplayEngine(parsed.points, SPEEDS[0]);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error(err);
        setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let raf = 0;
    const tick = (ts: number) => {
      const e = engineRef.current;
      if (e) {
        if (lastTs.current !== null) e.advance(ts - lastTs.current);
        lastTs.current = ts;
        if (e.playing) force((n) => n + 1);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const cumulative = useMemo(
    () => (run ? cumulativeDistances(run.points) : []),
    [run],
  );

  if (error) {
    return (
      <View style={styles.center}>
        <Text>Could not load run. Please try again.</Text>
      </View>
    );
  }

  if (!run || !engineRef.current) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text>Loading run…</Text>
      </View>
    );
  }

  const engine = engineRef.current;
  const metrics = deriveMetrics(run, cumulative, engine.index, profile);
  const markerColor = metrics.zone ? ZONE_THEME[metrics.zone].color : "#6B7280";

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{run.name}</Text>
      <RouteView points={run.points} currentIndex={engine.index} markerColor={markerColor} />
      <Dashboard
        metrics={metrics}
        playing={engine.playing}
        speed={SPEEDS[speedIdx.current]}
        onPlayPause={() => {
          engine.playing ? engine.pause() : engine.play();
          force((n) => n + 1);
        }}
        onRestart={() => {
          engine.seekToStart();
          force((n) => n + 1);
        }}
        onCycleSpeed={() => {
          speedIdx.current = (speedIdx.current + 1) % SPEEDS.length;
          engine.setSpeed(SPEEDS[speedIdx.current]);
          force((n) => n + 1);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: "center", justifyContent: "center", gap: 20, padding: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  title: { fontSize: 18, fontWeight: "600" },
});
