import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Heart,
  LoaderCircle,
  Pause,
  Play,
  Radio,
  RefreshCw,
  SearchX,
} from "lucide-react";
import { useAccount } from "../context/Account";
import { usePlayer } from "../context/Player";
import type { Station } from "../types";

export function StationLogo({
  station,
  className = "",
}: {
  station: Station | null;
  className?: string;
}) {
  const [failed, setFailed] = useState("");
  const favicon = station?.favicon ?? "";
  const valid = favicon.startsWith("https://") && failed !== favicon;
  return (
    <span className={`station-logo ${className}`}>
      {valid ? (
        <img
          src={favicon}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(favicon)}
        />
      ) : (
        <Radio aria-hidden="true" />
      )}
    </span>
  );
}

export function Equalizer() {
  return (
    <span className="equalizer" role="img" aria-label="Playing">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

export function FavoriteButton({
  station,
  tour = false,
}: {
  station: Station;
  tour?: boolean;
}) {
  const { user, favorites, toggleFavorite } = useAccount();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const saved = favorites.some(
    (item) => item.stationuuid === station.stationuuid,
  );
  async function toggle() {
    if (!user) {
      navigate("/login");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await toggleFavorite(station);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <span className="favorite-wrap">
      <button
        data-tour={tour ? "favorite" : undefined}
        className={`icon-button favorite ${saved ? "is-saved" : ""}`}
        aria-label={`${saved ? "Remove" : "Save"} ${station.name} ${saved ? "from" : "to"} favorites`}
        aria-pressed={saved}
        title={saved ? "Remove favorite" : "Save favorite"}
        onClick={toggle}
        disabled={busy}
      >
        {busy ? (
          <LoaderCircle className="spin" size={18} />
        ) : (
          <Heart size={18} fill={saved ? "currentColor" : "none"} />
        )}
      </button>
      {error && (
        <span className="favorite-error" role="alert">
          {error}
          <button onClick={() => setError("")}>Dismiss</button>
        </span>
      )}
    </span>
  );
}

export function StationCard({
  station,
  index,
}: {
  station: Station;
  index: number;
}) {
  const player = usePlayer();
  const selected = player.station?.stationuuid === station.stationuuid;
  const playing = selected && player.status === "playing";
  const loading = selected && player.status === "loading";
  const tags = station.tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 2);
  return (
    <article
      className={`station-card tone-${index % 6} ${selected ? "selected" : ""}`}
    >
      <div className="station-art">
        <span className="live-label">
          <span /> LIVE
        </span>
        <FavoriteButton station={station} tour={index === 0} />
        <StationLogo station={station} />
        <button
          className="card-play"
          onClick={() => player.playStation(station)}
          aria-label={`${playing ? "Pause" : "Play"} ${station.name}`}
          title={playing ? "Pause station" : "Play station"}
        >
          {loading ? (
            <LoaderCircle className="spin" size={21} />
          ) : playing ? (
            <Pause size={20} fill="currentColor" />
          ) : (
            <Play size={20} fill="currentColor" />
          )}
        </button>
        {playing && <Equalizer />}
      </div>
      <div className="station-details">
        <h3 title={station.name}>
          <Link to={`/station/${encodeURIComponent(station.stationuuid)}`}>
            {station.name}
          </Link>
        </h3>
        <p>
          {station.country || "Worldwide"} <span className="meta-dot">·</span>{" "}
          {station.bitrate ? `${station.bitrate} kbps` : "Live stream"}
        </p>
        <div className="station-tags">
          {tags.length ? (
            tags.map((tag) => <span key={tag}>{tag}</span>)
          ) : (
            <span>Radio</span>
          )}
        </div>
      </div>
    </article>
  );
}

export function StationGrid({
  stations,
  loading = false,
  error = "",
  retry,
  emptyTitle = "No stations found",
  emptyMessage = "Try another name or broaden your filters.",
}: {
  stations: Station[];
  loading?: boolean;
  error?: string;
  retry?: () => void;
  emptyTitle?: string;
  emptyMessage?: string;
}) {
  if (loading && !stations.length)
    return (
      <div
        className="station-grid"
        aria-busy="true"
        aria-label="Loading stations"
      >
        {Array.from({ length: 8 }, (_, index) => (
          <div className="station-skeleton" key={index}>
            <div />
            <span />
            <span />
          </div>
        ))}
      </div>
    );
  if (error && !stations.length)
    return (
      <div className="empty-state" role="alert">
        <Radio size={34} />
        <h3>The airwaves are a little quiet</h3>
        <p>{error}</p>
        <button className="button secondary" onClick={retry}>
          <RefreshCw size={16} /> Try again
        </button>
      </div>
    );
  if (!stations.length)
    return (
      <div className="empty-state">
        <SearchX size={34} />
        <h3>{emptyTitle}</h3>
        <p>{emptyMessage}</p>
      </div>
    );
  return (
    <>
      <div className="station-grid">
        {stations.map((station, index) => (
          <StationCard
            station={station}
            key={station.stationuuid}
            index={index}
          />
        ))}
      </div>
      {error && (
        <div className="inline-error" role="alert">
          {error} <button onClick={retry}>Try again</button>
        </div>
      )}
    </>
  );
}
