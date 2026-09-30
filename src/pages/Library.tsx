import { Heart, History, LogIn, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { useAccount } from "../context/Account";
import { StationGrid } from "../components/Stations";

export default function Library({ recent = false }: { recent?: boolean }) {
  const account = useAccount();
  const Icon = recent ? History : Heart;
  return (
    <>
      <section className="page-heading">
        <span className="eyebrow">YOUR PERSONAL AIRWAVES</span>
        <h1>{recent ? "Recently played" : "Your favorites"}</h1>
        <p>
          {recent
            ? "A little rewind. Your last 20 stations, all in one place."
            : "The sounds you come back to. Always within reach."}
        </p>
      </section>
      {!account.ready ? (
        <StationGrid stations={[]} loading />
      ) : !account.user ? (
        <div className="empty-state library-empty">
          <span className="empty-icon">
            <Icon size={34} />
          </span>
          <h2>
            {recent
              ? "Keep track of your discoveries"
              : "Make yourself at home"}
          </h2>
          <p>
            {recent
              ? "Sign in to keep your listening history across devices."
              : "Sign in to save the stations you love and find them here."}
          </p>
          <Link className="button primary" to="/login">
            <LogIn size={17} /> Sign in
          </Link>
          <Link className="text-link" to="/browse">
            Keep exploring <span aria-hidden="true">→</span>
          </Link>
        </div>
      ) : (
        <>
          <StationGrid
            stations={recent ? account.recent : account.favorites}
            loading={account.libraryLoading}
            error={account.libraryError}
            retry={() => void account.refreshLibrary()}
            emptyTitle={
              recent
                ? "Your next discovery starts here"
                : "A home for your favorite sounds"
            }
            emptyMessage={
              recent
                ? "Play a station and it will appear here."
                : "Tap the heart on a station to add it to your favorites."
            }
          />
          <div className="library-actions">
            <Link className="button secondary" to="/browse">
              Explore stations
            </Link>
            <button
              className="icon-button"
              title="Refresh library"
              aria-label="Refresh library"
              onClick={() => void account.refreshLibrary()}
            >
              <RefreshCw size={18} />
            </button>
          </div>
        </>
      )}
    </>
  );
}
