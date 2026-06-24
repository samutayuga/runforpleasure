import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, ActivityIndicator, ScrollView, StyleSheet } from "react-native";
import { Text, Surface } from "react-native-paper";
import { parseGpx } from "../core/gpxParser";
import { cumulativeDistances } from "../core/geo";
import { ReplayEngine } from "../core/replayEngine";
import { deriveMetrics } from "../core/metrics";
import { characterizeRun } from "../core/characterize";
import type { Run, TrackPoint } from "../core/types";
import type { Profile } from "../core/karvonen";
import { ZONE_THEME } from "./theme";
import MapView from "./MapView";
import { Dashboard } from "./Dashboard";
import { ElevationProfile } from "./ElevationProfile";
import { loadSampleGpx } from "./loadSampleGpx";
import { pickMultipleGpx } from "./pickGpx";
import { RoutesPanel } from "./RoutesPanel";
import type { LoadedRoute } from "./RoutesPanel";
import { fetchWeather } from "./weather";
import type { Weather } from "./weather";
import { fetchSurfaceAlongRoute } from "./osmSurface";
import type { SurfaceSample } from "./osmSurface";
import { SurfaceStrip } from "./SurfaceStrip";
import { StravaPanel } from "./StravaPanel";
import { reverseGeocode } from "./geocode";

const SPEEDS = [1, 4, 8];

export function RunScreen({ profile }: { profile: Profile }): React.JSX.Element {
  const [run, setRun] = useState<Run | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [surfaces, setSurfaces] = useState<SurfaceSample[]>([]);
  const [startPlace, setStartPlace] = useState<string | null>(null);
  const [endPlace, setEndPlace] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [stravaOpen, setStravaOpen] = useState(false);
  const [routes, setRoutes] = useState<LoadedRoute[]>([]);
  const [routesOpen, setRoutesOpen] = useState(false);
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
    setStartPlace(null);
    setEndPlace(null);
    if (!run || run.points.length === 0) return;
    let cancelled = false;
    const first = run.points[0], last = run.points[run.points.length - 1];
    reverseGeocode(first.lat, first.lon).then((n) => { if (!cancelled) setStartPlace(n); });
    const t = setTimeout(() => {
      reverseGeocode(last.lat, last.lon).then((n) => { if (!cancelled) setEndPlace(n); });
    }, 1100);
    return () => { cancelled = true; clearTimeout(t); };
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

  const applyRun = (name: string, pts: TrackPoint[]) => {
    if (pts.length === 0) { setError(true); return; }
    setRun({ name, points: pts });
    engineRef.current = new ReplayEngine(pts, SPEEDS[speedIdx.current]);
    lastTs.current = null;
    setError(false);
    force((n) => n + 1);
  };

  const handleImport = async () => {
    try {
      const picked = await pickMultipleGpx();
      if (picked.length === 0) return;
      const loaded: LoadedRoute[] = [];
      for (const f of picked) {
        const parsed = parseGpx(f.xml);
        if (parsed.points.length === 0) continue;
        const cum = cumulativeDistances(parsed.points);
        loaded.push({
          name: parsed.name,
          distanceKm: (cum[cum.length - 1] ?? 0) / 1000,
          date: parsed.points[0].time,
          points: parsed.points,
        });
      }
      if (loaded.length === 0) { setError(true); return; }
      setRoutes((prev) => [...prev, ...loaded]);
      applyRun(loaded[0].name, loaded[0].points);
      if (loaded.length > 1) setRoutesOpen(true);
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
      <Surface style={styles.mapSection} elevation={1}>
        <View style={styles.mapBox}>
          <MapView points={run.points} progressIndex={engine.fractionalIndex} markerColor={markerColor} cumulative={cumulative} onRequestImport={handleImport} onRequestStrava={() => setStravaOpen(true)} onShowRoutes={() => setRoutesOpen(true)} />
        </View>
        <ElevationProfile
          points={run.points}
          cumulative={cumulative}
          profile={profile}
          progressIndex={engine.fractionalIndex}
          width={480}
        />
        <SurfaceStrip samples={surfaces} width={480} />
      </Surface>
      <Dashboard
        metrics={metrics}
        playing={engine.playing}
        speed={SPEEDS[speedIdx.current]}
        startTime={run.points[0].time}
        endTime={run.points[run.points.length - 1].time}
        weather={weather}
        startPlace={startPlace}
        endPlace={endPlace}
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
      <StravaPanel
        visible={stravaOpen}
        onClose={() => setStravaOpen(false)}
        onSelectTrack={(name, pts) => { applyRun(name, pts); setStravaOpen(false); }}
      />
      <RoutesPanel
        visible={routesOpen}
        routes={routes}
        onClose={() => setRoutesOpen(false)}
        onSelect={(r) => { applyRun(r.name, r.points); setRoutesOpen(false); }}
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
  mapSection: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    backgroundColor: "#0F1A2E",
    borderRadius: 16,
    overflow: "hidden",
  },
  mapBox: {
    width: "100%",
    height: 360,
  },
});
