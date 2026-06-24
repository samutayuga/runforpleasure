import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, ActivityIndicator, ScrollView, StyleSheet } from "react-native";
import { Text, Surface } from "react-native-paper";
import { parseGpx } from "../core/gpxParser";
import { cumulativeDistances } from "../core/geo";
import { ReplayEngine } from "../core/replayEngine";
import { deriveMetrics } from "../core/metrics";
import { characterizeRun } from "../core/characterize";
import type { Run } from "../core/types";
import type { Profile } from "../core/karvonen";
import { ZONE_THEME } from "./theme";
import MapView from "./MapView";
import { Dashboard } from "./Dashboard";
import { ElevationProfile } from "./ElevationProfile";
import { loadSampleGpx } from "./loadSampleGpx";
import { pickGpx } from "./pickGpx";
import { fetchWeather } from "./weather";
import type { Weather } from "./weather";
import { fetchSurfaceAlongRoute } from "./osmSurface";
import type { SurfaceSample } from "./osmSurface";
import { SurfaceStrip } from "./SurfaceStrip";

const SPEEDS = [1, 4, 8];

export function RunScreen({ profile }: { profile: Profile }): React.JSX.Element {
  const [run, setRun] = useState<Run | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [surfaces, setSurfaces] = useState<SurfaceSample[]>([]);
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

  const cumulative = useMemo(
    () => (run ? cumulativeDistances(run.points) : []),
    [run],
  );

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
    setSurfaces([]);
    if (!run || run.points.length === 0) return;
    let cancelled = false;
    fetchSurfaceAlongRoute(run.points, cumulative).then((s) => {
      if (!cancelled) setSurfaces(s);
    });
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

  const runTitle = useMemo(
    () => (run ? characterizeRun(run.points, cumulative, profile) : ""),
    [run, cumulative, profile],
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
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
    >
      <Text variant="titleMedium" style={styles.title}>{runTitle}</Text>
      <Surface style={styles.mapPanel} elevation={1}>
        <MapView points={run.points} progressIndex={engine.fractionalIndex} markerColor={markerColor} onRequestImport={handleImport} />
      </Surface>
      <View style={styles.elevationWrapper}>
        <ElevationProfile
          points={run.points}
          cumulative={cumulative}
          profile={profile}
          progressIndex={engine.fractionalIndex}
          width={480}
        />
      </View>
      <View style={styles.surfaceWrapper}>
        <SurfaceStrip samples={surfaces} width={480} />
      </View>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#0B1220" },
  scrollContent: { alignItems: "center", paddingVertical: 6, paddingHorizontal: 8 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#0B1220" },
  title: { color: "#F1F5F9", marginBottom: 4 },
  statusText: { color: "#F1F5F9" },
  mapPanel: {
    width: "100%",
    maxWidth: 480,
    height: 360,
    borderRadius: 16,
    backgroundColor: "#0F1A2E",
    overflow: "hidden",
    alignSelf: "center",
  },
  elevationWrapper: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
  },
  surfaceWrapper: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
  },
});
