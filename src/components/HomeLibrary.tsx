import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAccount } from "../context/Account";
import { StationGrid } from "./Stations";
import { recommendStations } from "../lib/recommendations.js";
import type { Station } from "../types";
export default function HomeLibrary() {
  const account = useAccount();
  const [recommendations, setRecommendations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setRecommendations([]);
    setError("");
    if (!account.user || !account.recent.length) return;
    setLoading(true);
    recommendStations(account.recent.slice(0, 5), controller.signal)
      .then(setRecommendations)
      .catch((reason) => {
        if (!controller.signal.aborted) setError(reason.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [account.user?.id, account.recent, retry]);
  if (!account.user) return null;
  return (
    <>
      <section className="home-library">
        <div className="section-heading">
          <h2>Recently played</h2>
          <Link className="text-link" to="/recent">
            View history
          </Link>
        </div>
        <StationGrid
          stations={account.recent.slice(0, 4)}
          loading={account.libraryLoading}
          error={account.libraryError}
          retry={() => void account.refreshLibrary()}
          emptyTitle="Your next discovery starts here"
          emptyMessage="Play a station to start your listening history."
        />
      </section>
      {account.recent.length > 0 && (
        <section className="home-library">
          <div className="section-heading">
            <h2>Because you listened to {account.recent[0].name}</h2>
          </div>
          <StationGrid
            stations={recommendations}
            loading={loading}
            error={error}
            retry={() => setRetry((value) => value + 1)}
            emptyTitle="More discoveries ahead"
            emptyMessage="No matching stations yet. Try a few more stations."
          />
        </section>
      )}
    </>
  );
}
