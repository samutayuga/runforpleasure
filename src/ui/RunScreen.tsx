import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { Text, Button, Surface } from "react-native-paper";
import { parseGpx } from "../core/gpxParser";
import { cumulativeDistances } from "../core/geo";
import { ReplayEngine } from "../core/replayEngine";
import { deriveMetrics } from "../core/metrics";
import type { Run } from "../core/types";
import type { Profile } from "../core/karvonen";
import { ZONE_THEME } from "./theme";
import MapView from "./MapView";
import { Dashboard } from "./Dashboard";
import { loadSampleGpx } from "./loadSampleGpx";
import { pickGpx } from "./pickGpx";
import { fetchWeather } from "./weather";
import type { Weather } from "./weather";

const SPEEDS = [1, 4, 8];

export function RunScreen({ profile }: { profile: Profile }): React.JSX.Element {
  const [run, setRun] = useState<Run | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
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
    setWeather(null);
    if (!run || run.points.length === 0) return;
    let cancelled = false;
    const { lat, lon, time } = run.points[0];
    fetchWeather(lat, lon, time).then((w) => {
      if (!cancelled) setWeather(w);
    }).catch(() => { /* graceful null fallback */ });
    return () => { cancelled = true; };
  }, [run]);

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
        <Text style={styles.statusText}>Could not load run. Please try again.</Text>
      </View>
    );
  }

  if (!run || !engineRef.current) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#F1F5F9" />
        <Text style={styles.statusText}>Loading run…</Text>
      </View>
    );
  }

  const engine = engineRef.current;
  const metrics = deriveMetrics(run, cumulative, engine.index, profile);
  const markerColor = metrics.zone ? ZONE_THEME[metrics.zone].color : "#6B7280";

  const handleImport = async () => {
    try {
      const picked = await pickGpx();
      if (!picked) return;
      const parsed = parseGpx(picked.xml);
      if (parsed.points.length === 0) {
        setError(true);
        return;
      }
      setRun(parsed);
      engineRef.current = new ReplayEngine(parsed.points, SPEEDS[speedIdx.current]);
      lastTs.current = null;
      setError(false);
      force((n) => n + 1);
    } catch (err) {
      console.error(err);
      setError(true);
    }
  };

  return (
    <View style={styles.screen}>
      <Text variant="titleMedium" style={styles.title}>{run.name}</Text>
      <Button
        mode="contained-tonal"
        onPress={() => { void handleImport(); }}
        accessibilityLabel="Import GPX"
      >
        Import GPX
      </Button>
      <Surface style={styles.mapPanel} elevation={1}>
        <MapView points={run.points} progressIndex={engine.fractionalIndex} markerColor={markerColor} />
      </Surface>
      <Dashboard
        metrics={metrics}
        playing={engine.playing}
        speed={SPEEDS[speedIdx.current]}
        startTime={run.points[0].time}
        endTime={run.points[run.points.length - 1].time}
        weather={weather}
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
  screen: { flex: 1, alignItems: "center", justifyContent: "center", gap: 20, padding: 16, backgroundColor: "#0B1220" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#0B1220" },
  title: { color: "#F1F5F9" },
  statusText: { color: "#F1F5F9" },
  mapPanel: {
    width: "100%",
    maxWidth: 360,
    height: 320,
    borderRadius: 16,
    backgroundColor: "#0F1A2E",
    overflow: "hidden",
    alignSelf: "center",
  },
});
