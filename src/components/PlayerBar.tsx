import { useState } from "react";
import {
  AudioLines,
  ChevronDown,
  LoaderCircle,
  Moon,
  Pause,
  Play,
  Radio,
  Timer,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import { usePlayer } from "../context/Player";
import { FavoriteButton, StationLogo } from "./Stations";
import { stationFallback } from "../lib/metadata.js";

export default function PlayerBar() {
  const player = usePlayer();
  const nowPlaying = player.station
    ? player.trackTitle || stationFallback(player.station)
    : "";
  const [timerOpen, setTimerOpen] = useState(false);
  const active = player.status === "playing" || player.status === "loading";
  const VolumeIcon =
    player.muted || !player.volume
      ? VolumeX
      : player.volume < 0.5
        ? Volume1
        : Volume2;
  return (
    <footer className="player-bar" data-tour="player" aria-label="Radio player">
      <div className="player-station">
        <StationLogo station={player.station} />
        <div className="player-station-copy">
          <strong>
            {player.station?.name || "Your next favorite is out there"}
          </strong>
          {player.station && (
            <span
              className="now-playing"
              aria-live="polite"
              aria-atomic="true"
              title={`Now playing: ${nowPlaying}`}
            >
              Now playing: {nowPlaying}
            </span>
          )}
          <span aria-live="polite">
            {player.error ||
              (player.status === "loading"
                ? "Tuning in..."
                : player.station
                  ? `${player.station.country || "Worldwide"} · ${player.status === "playing" ? "Live radio" : "Paused"}`
                  : "Pick a station. Find your frequency.")}
          </span>
        </div>
        {player.station && <FavoriteButton station={player.station} />}
      </div>
      <div className="player-center">
        <AudioLines
          className={player.status === "playing" ? "audio-active" : ""}
          size={23}
        />
        <button
          className="main-play"
          disabled={!player.station}
          onClick={player.toggle}
          aria-label={active ? "Pause radio" : "Play radio"}
          title={active ? "Pause" : "Play"}
        >
          {player.status === "loading" ? (
            <LoaderCircle className="spin" size={24} />
          ) : active ? (
            <Pause size={22} fill="currentColor" />
          ) : (
            <Play size={22} fill="currentColor" />
          )}
        </button>
        <span
          className={`player-live ${player.status === "playing" ? "on" : ""}`}
        >
          <span /> LIVE
        </span>
      </div>
      <div className="player-tools">
        <button
          className="icon-button volume-button"
          onClick={player.toggleMute}
          aria-label={player.muted ? "Unmute" : "Mute"}
          title={player.muted ? "Unmute" : "Mute"}
        >
          <VolumeIcon size={20} />
        </button>
        <input
          className="volume-slider"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={player.muted ? 0 : player.volume}
          onChange={(event) => player.setVolume(Number(event.target.value))}
          aria-label="Volume"
        />
        <span className="tool-divider" />
        <div className="sleep-control">
          <button
            className={`sleep-button ${player.sleepUntil ? "active" : ""}`}
            onClick={() => setTimerOpen(!timerOpen)}
            aria-expanded={timerOpen}
            aria-label="Sleep timer"
            title="Sleep timer"
          >
            <Moon size={18} />
            <span>
              {player.sleepUntil
                ? `${Math.floor(player.remaining / 60)}:${String(player.remaining % 60).padStart(2, "0")}`
                : "Sleep timer"}
            </span>
            <ChevronDown size={13} />
          </button>
          {timerOpen && (
            <>
              <button
                className="popover-dismiss"
                aria-label="Close sleep timer"
                onClick={() => setTimerOpen(false)}
              />
              <div
                className="timer-menu"
                onKeyDown={(event) => {
                  if (event.key === "Escape") setTimerOpen(false);
                }}
              >
                <strong>
                  <Timer size={16} /> Sleep timer
                </strong>
                {[15, 30, 60].map((minutes) => (
                  <button
                    key={minutes}
                    onClick={() => {
                      player.setSleep(minutes);
                      setTimerOpen(false);
                    }}
                  >
                    {minutes} minutes
                  </button>
                ))}
                <button
                  onClick={() => {
                    player.setSleep(0);
                    setTimerOpen(false);
                  }}
                >
                  Turn off
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <Radio className="player-mobile-mark" size={16} />
    </footer>
  );
}
