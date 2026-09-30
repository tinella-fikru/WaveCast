import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { registerClick } from "../lib/radio.js";
import { readPreference, writePreference } from "../lib/storage";
import { useAccount } from "./Account";
import { icyMetadataProvider, subscribeMetadata } from "../lib/metadata.js";
import type { MetadataProvider, Station } from "../types";
import { createPlaybackController } from "../lib/playback.js";

type Status = "idle" | "loading" | "playing" | "paused" | "error";
type PlayerState = {
  station: Station | null;
  status: Status;
  volume: number;
  muted: boolean;
  error: string;
  trackTitle: string | null;
  connectionMessage: string;
  playStation: (station: Station) => void;
  toggle: () => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  sleepUntil: number | null;
  remaining: number;
  setSleep: (minutes: number) => void;
};
const PlayerContext = createContext<PlayerState | null>(null);

export function PlayerProvider({
  children,
  metadataProvider = icyMetadataProvider,
}: {
  children: ReactNode;
  metadataProvider?: MetadataProvider;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const current = useRef<Station | null>(null);
  const controller = useRef<ReturnType<typeof createPlaybackController> | null>(
    null,
  );
  const recorded = useRef(false);
  const [station, setStation] = useState<Station | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [connectionMessage, setConnectionMessage] = useState("");
  const [track, setTrack] = useState<{
    stationUuid: string;
    title: string | null;
  } | null>(null);
  const metadataActive = status === "playing";
  const trackTitle =
    metadataActive && track?.stationUuid === station?.stationuuid
      ? (track?.title ?? null)
      : null;
  const [volume, updateVolume] = useState(() =>
    Math.max(
      0,
      Math.min(1, Number(readPreference("wavecast-volume", "0.7")) || 0),
    ),
  );
  const [muted, setMuted] = useState(false);
  const [sleepUntil, setSleepUntil] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);
  const { recordRecent } = useAccount();

  function resume() {
    if (current.current) controller.current?.resume();
  }

  function playStation(next: Station) {
    if (!next.url_resolved.startsWith("https://") || !audio.current) return;
    if (current.current?.stationuuid === next.stationuuid) {
      toggle();
      return;
    }
    audio.current.pause();
    current.current = next;
    recorded.current = false;
    setStation(next);
    setError("");
    setStatus("loading");
    controller.current?.play(next);
    void registerClick(next.stationuuid).catch(() => undefined);
  }

  function toggle() {
    if (!audio.current || !current.current) return;
    if (status === "playing" || status === "loading") {
      controller.current?.pause();
    } else resume();
  }

  function setVolume(value: number) {
    value = Math.max(0, Math.min(1, value));
    updateVolume(value);
    setMuted(false);
    writePreference("wavecast-volume", String(value));
  }

  useEffect(() => {
    if (audio.current) {
      audio.current.volume = volume;
      audio.current.muted = muted;
    }
  }, [volume, muted]);

  useEffect(() => {
    setTrack(null);
    if (!station || !metadataActive) return;
    return subscribeMetadata(
      metadataProvider,
      station,
      (title: string | null) => {
        setTrack({ stationUuid: station.stationuuid, title });
      },
    );
  }, [station, metadataActive, metadataProvider]);

  useEffect(() => {
    if (!audio.current) return;
    controller.current = createPlaybackController(
      audio.current,
      (nextStatus: Status, message: string) => {
        setStatus(nextStatus);
        setError(nextStatus === "error" ? message : "");
        setConnectionMessage(nextStatus !== "error" ? message : "");
      },
    );
    return () => controller.current?.dispose();
  }, []);

  useEffect(() => {
    if (status === "playing" && station && !recorded.current) {
      recorded.current = true;
      void recordRecent(station);
    }
  }, [status, station, recordRecent]);

  useEffect(() => {
    if (!sleepUntil) {
      setRemaining(0);
      return;
    }
    function tick() {
      const left = Math.max(0, sleepUntil! - Date.now());
      setRemaining(Math.ceil(left / 1000));
      if (!left) {
        controller.current?.pause();
        setSleepUntil(null);
      }
    }
    tick();
    const interval = window.setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [sleepUntil]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    if (station)
      navigator.mediaSession.metadata = new MediaMetadata({
        title: trackTitle || station.name,
        artist: trackTitle ? station.name : station.country || "Live radio",
        album: "WaveCast",
        artwork: station.favicon.startsWith("https://")
          ? [{ src: station.favicon }]
          : [],
      });
    navigator.mediaSession.playbackState =
      status === "playing" ? "playing" : station ? "paused" : "none";
    navigator.mediaSession.setActionHandler("play", resume);
    navigator.mediaSession.setActionHandler("pause", () =>
      controller.current?.pause(),
    );
    navigator.mediaSession.setActionHandler("stop", () =>
      controller.current?.pause(),
    );
    return () => {
      for (const action of ["play", "pause", "stop"] as const)
        navigator.mediaSession.setActionHandler(action, null);
    };
  }, [station, status, trackTitle]);

  return (
    <PlayerContext.Provider
      value={{
        station,
        status,
        volume,
        muted,
        error,
        trackTitle,
        connectionMessage,
        playStation,
        toggle,
        setVolume,
        toggleMute: () => setMuted((previous) => !previous),
        sleepUntil,
        remaining,
        setSleep: (minutes) =>
          setSleepUntil(minutes ? Date.now() + minutes * 60000 : null),
      }}
    >
      <audio ref={audio} preload="none" />
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) throw new Error("PlayerProvider is required");
  return context;
}
