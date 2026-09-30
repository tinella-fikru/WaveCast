import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ExternalLink, Play, Pause } from "lucide-react";
import { radioRequest, secureStations } from "../lib/radio.js";
import { usePlayer } from "../context/Player";
import { FavoriteButton, StationLogo } from "../components/Stations";
import Share from "../components/Share";
import CollectionButton from "../components/CollectionButton";
import type { Station as RadioStation } from "../types";
export default function StationPage() {
  const { uuid } = useParams();
  const [station, setStation] = useState<RadioStation | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const player = usePlayer();
  useEffect(() => {
    const controller = new AbortController();
    setStation(null);
    setError("");
    if (!uuid || !/^[a-f\d-]{36}$/i.test(uuid)) {
      setError("This station link is invalid.");
      return;
    }
    radioRequest(
      `/stations/byuuid/${encodeURIComponent(uuid)}`,
      {},
      controller.signal,
    )
      .then((rows) => {
        const found = secureStations(rows)[0];
        if (!found)
          throw Error("This station is missing or has no HTTPS stream.");
        if (!controller.signal.aborted) setStation(found);
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(reason.message || "Station could not be loaded.");
      });
    return () => controller.abort();
  }, [uuid, retry]);
  useEffect(() => {
    if (!station) return;
    document.title = `${station.name} - WaveCast`;
    const values = {
      "og:title": `${station.name} - WaveCast`,
      "og:description": `Listen to ${station.name}. ${station.country}. ${station.tags}`,
      "og:url": `${location.origin}${import.meta.env.BASE_URL}station/${station.stationuuid}`,
      "og:image": station.favicon.startsWith("https://")
        ? station.favicon
        : `${location.origin}${import.meta.env.BASE_URL}icons/icon-512.png`,
      "og:type": "website",
    };
    const previous: Array<[HTMLMetaElement, string | null, boolean]> = [];
    for (const [property, content] of Object.entries(values)) {
      const existing = document.querySelector<HTMLMetaElement>(
        `meta[property="${property}"]`,
      );
      const element = existing || document.createElement("meta");
      previous.push([element, element.getAttribute("content"), !existing]);
      element.setAttribute("property", property);
      element.content = content;
      if (!existing) document.head.appendChild(element);
    }
    return () => {
      for (const [element, content, created] of previous) {
        if (created) element.remove();
        else element.content = content || "";
      }
    };
  }, [station]);
  if (error)
    return (
      <div className="empty-state" role="alert">
        <h1>Station unavailable</h1>
        <p>{error}</p>
        <button
          className="button secondary"
          onClick={() => setRetry((value) => value + 1)}
        >
          Retry
        </button>
        <Link to="/browse">Browse stations</Link>
      </div>
    );
  if (!station)
    return (
      <div className="empty-state" role="status">
        Loading station...
      </div>
    );
  const active =
    player.station?.stationuuid === station.stationuuid &&
    ["playing", "loading"].includes(player.status);
  return (
    <section className="station-page">
      <StationLogo station={station} />
      <span className="eyebrow">LIVE RADIO</span>
      <h1>{station.name}</h1>
      <p>
        {station.country} · {station.bitrate || "Variable"} kbps
      </p>
      <p>{station.tags.split(",").join(" · ")}</p>
      <div className="station-page-actions">
        <button
          className="button primary"
          onClick={() => player.playStation(station)}
        >
          {active ? <Pause size={18} /> : <Play size={18} />}
          {active ? "Pause" : "Play station"}
        </button>
        <FavoriteButton station={station} />
        <CollectionButton station={station} />
        <Share station={station} />
      </div>
      {station.homepage && /^https?:\/\//.test(station.homepage) && (
        <a
          className="text-link"
          href={station.homepage}
          target="_blank"
          rel="noreferrer"
        >
          Station website <ExternalLink size={16} />
        </a>
      )}
    </section>
  );
}
