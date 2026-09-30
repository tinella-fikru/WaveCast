import { useEffect, useRef, useState } from "react";
import { Keyboard } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePlayer } from "../context/Player";
import { useAccount } from "../context/Account";
import Dialog from "./Dialog";
export default function Shortcuts() {
  const player = usePlayer();
  const account = useAccount();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const favoriteBusy = useRef(false);
  useEffect(() => {
    function handle(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.repeat ||
        target.closest(
          'input,textarea,select,button,a,[contenteditable="true"],[role="slider"],dialog,.leaflet-container',
        )
      )
        return;
      if (event.key === "?") {
        event.preventDefault();
        setOpen(true);
        return;
      }
      if (document.querySelector("dialog[open]")) return;
      const key = event.key.toLowerCase();
      if (![" ", "m", "arrowup", "arrowdown", "/", "f"].includes(key)) return;
      event.preventDefault();
      if (key === " ") player.toggle();
      if (key === "m") player.toggleMute();
      if (key === "arrowup" || key === "arrowdown")
        player.setVolume(
          Math.max(
            0,
            Math.min(1, player.volume + (key === "arrowup" ? 0.05 : -0.05)),
          ),
        );
      if (key === "/") {
        const search = document.querySelector<HTMLInputElement>(
          "#station-search, .country-search input",
        );
        if (search) search.focus();
        else {
          navigate("/browse");
          requestAnimationFrame(() =>
            document.getElementById("station-search")?.focus(),
          );
        }
      }
      if (key === "f" && player.station && !favoriteBusy.current) {
        if (!account.user) {
          navigate("/login");
          return;
        }
        favoriteBusy.current = true;
        void account
          .toggleFavorite(player.station)
          .catch((reason) => setError(reason.message))
          .finally(() => {
            favoriteBusy.current = false;
          });
      }
    }
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [player, account, navigate]);
  return (
    <>
      <button
        className="icon-button"
        title="Keyboard shortcuts (?)"
        aria-label="Keyboard shortcuts"
        onClick={() => setOpen(true)}
      >
        <Keyboard size={19} />
      </button>
      {open && (
        <Dialog title="Keyboard shortcuts" onClose={() => setOpen(false)}>
          <dl className="shortcut-list">
            {[
              ["Space", "Play / pause"],
              ["M", "Mute / unmute"],
              ["Up / Down", "Adjust volume"],
              ["/", "Focus search"],
              ["F", "Favorite current station"],
              ["?", "Open shortcuts"],
            ].map(([key, action]) => (
              <div key={key}>
                <dt>
                  <kbd>{key}</kbd>
                </dt>
                <dd>{action}</dd>
              </div>
            ))}
          </dl>
        </Dialog>
      )}
      {error && (
        <Dialog title="Favorites unavailable" onClose={() => setError("")}>
          <p role="alert">{error}</p>
        </Dialog>
      )}
    </>
  );
}
