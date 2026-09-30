import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import Dialog from "./Dialog";
import { usePlayer } from "../context/Player";
import { recommendStations } from "../lib/recommendations.js";
import type { Station } from "../types";

export default function Recovery() {
  const player = usePlayer();
  const [open, setOpen] = useState(false);
  const [similar, setSimilar] = useState<Station[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!open || !player.station) return;
    const controller = new AbortController();
    setLoading(true);
    setSimilar([]);
    setError("");
    recommendStations([player.station], controller.signal, 3)
      .then(setSimilar)
      .catch((reason) => {
        if (!controller.signal.aborted) setError(reason.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [open, player.station, retry]);
  useEffect(() => {
    if (player.status !== "error") setOpen(false);
  }, [player.status]);
  if (!player.station || player.status !== "error") return null;
  const report = new URL(
    "https://gitlab.com/radiobrowser/radio-database/-/issues/new",
  );
  report.searchParams.set(
    "issue[title]",
    `Broken stream: ${player.station.name}`,
  );
  report.searchParams.set(
    "issue[description]",
    `Station UUID: ${player.station.stationuuid}\nStream: ${player.station.url_resolved}\n\nPlayback failed after retries in WaveCast. Please describe when the failure occurred and your browser/device:`,
  );
  return (
    <>
      <button className="recovery-button" onClick={() => setOpen(true)}>
        Report / alternatives
      </button>
      {open && (
        <Dialog title="Station unavailable" onClose={() => setOpen(false)}>
          <p>{player.error}</p>
          <div className="dialog-actions">
            <button className="button primary" onClick={player.toggle}>
              Retry playback
            </button>
            <a
              className="button secondary"
              href={report.href}
              target="_blank"
              rel="noreferrer"
            >
              Report broken station <ExternalLink size={16} />
            </a>
          </div>
          <h3>Similar stations</h3>
          {loading ? (
            <p role="status">Finding stations...</p>
          ) : error ? (
            <p role="alert">
              {error}
              <button
                className="text-button"
                onClick={() => setRetry((value) => value + 1)}
              >
                Retry suggestions
              </button>
            </p>
          ) : similar.length ? (
            similar.map((station) => (
              <button
                className="similar-row"
                key={station.stationuuid}
                onClick={() => player.playStation(station)}
              >
                {station.name}
                <span>{station.country}</span>
              </button>
            ))
          ) : (
            <p>
              No similar stations found.{" "}
              <Link to="/browse" onClick={() => setOpen(false)}>
                Browse all stations
              </Link>
            </p>
          )}
        </Dialog>
      )}
    </>
  );
}
