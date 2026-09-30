import { useState } from "react";
import { Share2 } from "lucide-react";
import type { Station } from "../types";
import Dialog from "./Dialog";
export default function Share({ station }: { station: Station }) {
  const [message, setMessage] = useState("");
  const [manual, setManual] = useState(false);
  const url = new URL(`${import.meta.env.BASE_URL}station/${encodeURIComponent(station.stationuuid)}`, location.origin).href;
  async function share() {
    setMessage("");
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${station.name} - WaveCast`,
          text: `Listen to ${station.name}`,
          url,
        });
        return;
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Link copied");
    } catch {
      setManual(true);
    }
  }
  return (
    <>
      <button
        className="icon-button"
        onClick={share}
        title="Share station"
        aria-label={`Share ${station.name}`}
      >
        <Share2 size={18} />
      </button>
      {message && (
        <span className="action-feedback" role="status">
          {message}
        </span>
      )}
      {manual && (
        <Dialog title="Share station" onClose={() => setManual(false)}>
          <label>
            Station link
            <input
              className="text-input"
              value={url}
              readOnly
              onFocus={(event) => event.target.select()}
            />
          </label>
        </Dialog>
      )}
    </>
  );
}
