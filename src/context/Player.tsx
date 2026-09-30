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
import type { Station } from "../types";

type Status = "idle" | "loading" | "playing" | "paused" | "error";
type PlayerState = {
  station: Station | null;
  status: Status;
  volume: number;
  muted: boolean;
  error: string;
  playStation: (station: Station) => void;
  toggle: () => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  sleepUntil: number | null;
  remaining: number;
  setSleep: (minutes: number) => void;
};
const PlayerContext = createContext<PlayerState | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audio = useRef<HTMLAudioElement>(null);
  const current = useRef<Station | null>(null);
  const generation = useRef(0);
  const recorded = useRef(false);
  const [station, setStation] = useState<Station | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
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

  function fail() {
    audio.current?.pause();
    setStatus("error");
    setError("This station is unavailable, try another");
  }

  function resume() {
    if (!audio.current || !current.current) return;
    const request = generation.current;
    setError("");
    setStatus("loading");
    if (audio.current.error) audio.current.load();
    audio.current.play().catch((reason: DOMException) => {
      if (generation.current === request && reason.name !== "AbortError")
        fail();
    });
  }

  function playStation(next: Station) {
    if (!next.url_resolved.startsWith("https://") || !audio.current) return;
    if (current.current?.stationuuid === next.stationuuid) {
      toggle();
      return;
    }
    generation.current++;
    audio.current.pause();
    current.current = next;
    recorded.current = false;
    setStation(next);
    setError("");
    setStatus("loading");
    audio.current.src = next.url_resolved;
    audio.current.load();
    resume();
    void registerClick(next.stationuuid).catch(() => undefined);
  }

  function toggle() {
    if (!audio.current || !current.current) return;
    if (!audio.current.paused) {
      audio.current.pause();
      setStatus("paused");
    } else resume();
  }

  function setVolume(value: number) {
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
    if (status !== "loading") return;
    const timeout = window.setTimeout(() => {
      audio.current?.pause();
      fail();
    }, 25000);
    return () => window.clearTimeout(timeout);
  }, [status, station?.stationuuid]);

  useEffect(() => {
    if (!sleepUntil) {
      setRemaining(0);
      return;
    }
    function tick() {
      const left = Math.max(0, sleepUntil! - Date.now());
      setRemaining(Math.ceil(left / 1000));
      if (!left) {
        audio.current?.pause();
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
        title: station.name,
        artist: station.country || "Live radio",
        album: "WaveCast",
        artwork: station.favicon.startsWith("https://")
          ? [{ src: station.favicon }]
          : [],
      });
    navigator.mediaSession.playbackState =
      status === "playing" ? "playing" : station ? "paused" : "none";
    navigator.mediaSession.setActionHandler("play", resume);
    navigator.mediaSession.setActionHandler("pause", () =>
      audio.current?.pause(),
    );
    navigator.mediaSession.setActionHandler("stop", () =>
      audio.current?.pause(),
    );
    return () => {
      for (const action of ["play", "pause", "stop"] as const)
        navigator.mediaSession.setActionHandler(action, null);
    };
  }, [station, status]);

  return (
    <PlayerContext.Provider
      value={{
        station,
        status,
        volume,
        muted,
        error,
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
      <audio
        ref={audio}
        preload="none"
        onPlaying={() => {
          setStatus("playing");
          setError("");
          if (!recorded.current && current.current) {
            recorded.current = true;
            void recordRecent(current.current);
          }
        }}
        onWaiting={() => setStatus("loading")}
        onPause={() =>
          setStatus((previous) => (previous === "error" ? previous : "paused"))
        }
        onError={fail}
        onEnded={() => setStatus("paused")}
      />
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) throw new Error("PlayerProvider is required");
  return context;
}
