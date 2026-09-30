import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  AudioLines,
  ChevronDown,
  Disc3,
  Globe2,
  Guitar,
  Headphones,
  Mic2,
  Music2,
  Newspaper,
  Piano,
  Radio,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { radioRequest, searchStations } from "../lib/radio.js";
import { StationGrid } from "../components/Stations";
import type { Station } from "../types";

const genres = [
  { name: "All stations", tag: "", icon: AudioLines },
  { name: "Pop", tag: "pop", icon: Sparkles },
  { name: "Jazz", tag: "jazz", icon: Music2 },
  { name: "Rock", tag: "rock", icon: Guitar },
  { name: "Electronic", tag: "electronic", icon: Disc3 },
  { name: "Classical", tag: "classical", icon: Piano },
  { name: "News", tag: "news", icon: Newspaper },
  { name: "Talk", tag: "talk", icon: Mic2 },
  { name: "Chill", tag: "chill", icon: Headphones },
];

type DirectoryOption = { name: string; stationcount: number };

export default function Discover({ browse = false }: { browse?: boolean }) {
  const [params, setParams] = useSearchParams();
  const { countryName } = useParams<{ countryName: string }>();
  const navigate = useNavigate();
  const name = params.get("name") ?? "";
  const tag = params.get("tag") ?? "";
  const country = countryName ?? params.get("country") ?? "";
  const countryExact = countryName ? "true" : "";
  const language = params.get("language") ?? "";
  const [query, setQuery] = useState(name);
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [moreLoading, setMoreLoading] = useState(false);
  const [error, setError] = useState("");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [retry, setRetry] = useState(0);
  const [directories, setDirectories] = useState<
    Record<string, DirectoryOption[]>
  >({});
  const [directoryError, setDirectoryError] = useState(false);
  const [directoryRetry, setDirectoryRetry] = useState(0);
  const requestId = useRef(0);
  const moreController = useRef<AbortController | null>(null);

  useEffect(() => {
    setQuery(name);
  }, [name]);
  useEffect(() => {
    const controller = new AbortController();
    requestId.current++;
    moreController.current?.abort();
    setLoading(true);
    setMoreLoading(false);
    setError("");
    setStations([]);
    setHasMore(false);
    searchStations({ name, tag, country, countryExact, language }, 0, controller.signal)
      .then((result) => {
        setStations(result.stations);
        setOffset(result.nextOffset);
        setHasMore(result.hasMore);
      })
      .catch((reason) => {
        if (reason.name !== "AbortError")
          setError(
            "We could not reach the radio directory. Check your connection and try again.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      controller.abort();
      moreController.current?.abort();
    };
  }, [name, tag, country, countryExact, language, retry]);

  useEffect(() => {
    if (!browse) return;
    const controller = new AbortController();
    setDirectoryError(false);
    Promise.all(
      ["countries", "tags", "languages"].map(async (kind) => {
        const rows: DirectoryOption[] = await radioRequest(
          `/${kind}`,
          { hidebroken: "true" },
          controller.signal,
        );
        return [
          kind,
          rows
            .filter((row) => row.name && row.stationcount > 0)
            .sort((first, second) => first.name.localeCompare(second.name)),
        ] as const;
      }),
    )
      .then((values) => setDirectories(Object.fromEntries(values)))
      .catch(() => {
        if (!controller.signal.aborted) setDirectoryError(true);
      });
    return () => controller.abort();
  }, [browse, directoryRetry]);

  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (key === "country" && countryName) {
      next.delete("country");
      navigate(`${value ? `/countries/${encodeURIComponent(value)}` : "/browse"}?${next}`);
      return;
    }
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  }

  function search(event: FormEvent) {
    event.preventDefault();
    const next = new URLSearchParams(params);
    if (query.trim()) next.set("name", query.trim());
    else next.delete("name");
    if (browse) setParams(next);
    else navigate(`/browse?${next}`);
  }

  async function loadMore() {
    if (moreLoading) return;
    const version = requestId.current;
    const controller = new AbortController();
    moreController.current = controller;
    setMoreLoading(true);
    setError("");
    try {
      const result = await searchStations(
        { name, tag, country, countryExact, language },
        offset,
        controller.signal,
      );
      if (version !== requestId.current) return;
      setStations((previous) => [
        ...previous,
        ...result.stations.filter(
          (item: Station) =>
            !previous.some((saved) => saved.stationuuid === item.stationuuid),
        ),
      ]);
      setOffset(result.nextOffset);
      setHasMore(result.hasMore);
    } catch (reason) {
      if (
        (reason as Error).name !== "AbortError" &&
        version === requestId.current
      )
        setError("More stations could not be loaded. Please try again.");
    } finally {
      if (version === requestId.current) setMoreLoading(false);
    }
  }

  const searchForm = (
    <form
      className={`search-form ${browse ? "browse-search" : ""}`}
      onSubmit={search}
      data-tour="search"
    >
      <Search size={20} />
      <label className="sr-only" htmlFor="station-search">
        Search stations
      </label>
      <input
        id="station-search"
        placeholder="Search stations, sounds, and places..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {query && (
        <button
          className="clear-search"
          type="button"
          onClick={() => {
            setQuery("");
            if (name) updateFilter("name", "");
          }}
          aria-label="Clear search"
        >
          <X size={16} />
        </button>
      )}
      <button
        className="search-submit"
        type="submit"
        aria-label="Find a station"
      >
        <span>Find a station</span>
        <ArrowRight size={18} />
      </button>
    </form>
  );

  return (
    <>
      {browse ? (
        <section className="page-heading">
          {countryName && <Link className="text-link country-back" to="/countries"><Globe2 size={16} /> Explore by Country</Link>}
          <span className="eyebrow">A WORLD OF FREQUENCIES</span>
          <h1>{countryName || "Explore the airwaves"}</h1>
          <p>{countryName ? "Live stations, ranked by popularity." : "Somewhere in the world, your next favorite station is live."}</p>
          {searchForm}
        </section>
      ) : (
        <section className="hero">
          <div className="hero-content">
            <span className="hero-eyebrow">
              <span /> THE WORLD IS ON AIR
            </span>
            <h1>
              Live radio.
              <br />
              <span>Without borders.</span>
            </h1>
            <p>
              Local voices. New discoveries. A world of sound.
              <br className="desktop-break" /> Tune into somewhere different.
            </p>
            {searchForm}
            <div className="hero-note">
              <Globe2 size={14} />
              <span>Across countries. Across time zones. Always live.</span>
            </div>
          </div>
          <div className="hero-caption">
            <span className="caption-line" />
            <span>
              GOOD SOUNDS.
              <br />
              NO PASSPORT NEEDED.
            </span>
          </div>
        </section>
      )}

      <section className="genre-section" data-tour="filters">
        <div className="section-heading small">
          <h2>Find your frequency</h2>
          <span>A sound for every mood</span>
        </div>
        <div className="genre-chips">
          {genres.map((genre) => (
            <button
              key={genre.name}
              className={`genre-chip ${tag === genre.tag ? "active" : ""}`}
              onClick={() => updateFilter("tag", genre.tag)}
              aria-pressed={tag === genre.tag}
            >
              <genre.icon size={17} />
              {genre.name}
            </button>
          ))}
        </div>
      </section>

      {browse && (
        <section className="browse-filters" aria-label="Station filters">
          <span className="filter-heading">
            <SlidersHorizontal size={18} /> Filter by
          </span>
          {[
            {
              key: "country",
              kind: "countries",
              label: "Country",
              value: country,
            },
            { key: "tag", kind: "tags", label: "Genre", value: tag },
            {
              key: "language",
              kind: "languages",
              label: "Language",
              value: language,
            },
          ].map((filter) => (
            <label className="filter-select" key={filter.key}>
              <span>{filter.label}</span>
              <select
                aria-label={filter.label}
                value={filter.value}
                onChange={(event) =>
                  updateFilter(filter.key, event.target.value)
                }
              >
                <option value="">
                  All {filter.kind === "tags" ? "genres" : filter.kind}
                </option>
                {filter.value &&
                  !directories[filter.kind]?.some(
                    (item) => item.name === filter.value,
                  ) && <option value={filter.value}>{filter.value}</option>}
                {directories[filter.kind]?.map((option) => (
                  <option key={option.name} value={option.name}>
                    {option.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={15} />
            </label>
          ))}
          {(name || tag || country || language) && (
            <button className="text-button" onClick={() => setParams({})}>
              <X size={15} /> Reset
            </button>
          )}
          {directoryError && (
            <span className="filter-error" role="alert">
              Filters unavailable.{" "}
              <button onClick={() => setDirectoryRetry((value) => value + 1)}>
                Retry
              </button>
            </span>
          )}
        </section>
      )}

      <section className="stations-section">
        <div className="section-heading">
          <div>
            <span className="section-kicker">
              <span /> LIVE & LOUD
            </span>
            <h2>
              {browse
                ? name
                  ? `Results for "${name}"`
                  : countryName ? "Top stations" : "Discover stations"
                : tag
                  ? `${genres.find((genre) => genre.tag === tag)?.name ?? tag} on the air`
                  : "Popular right now"}
            </h2>
            <p>
              {browse
                ? "Find a connection, wherever you are."
                : "The stations the world is tuning into."}
            </p>
          </div>
          {!browse && (
            <Link
              className="text-link"
              to={tag ? `/browse?tag=${encodeURIComponent(tag)}` : "/browse"}
            >
              Explore all stations <ArrowRight size={17} />
            </Link>
          )}
          {browse && !loading && (
            <span className="result-count">{stations.length} stations</span>
          )}
        </div>
        <StationGrid
          stations={browse ? stations : stations.slice(0, 8)}
          loading={loading}
          error={error}
          retry={() =>
            stations.length ? void loadMore() : setRetry((value) => value + 1)
          }
        />
        {browse && hasMore && !loading && (
          <div className="load-more">
            <button
              className="button secondary"
              onClick={loadMore}
              disabled={moreLoading}
            >
              {moreLoading ? "Finding more stations..." : "Load more stations"}
              <ChevronDown size={16} />
            </button>
          </div>
        )}
      </section>

      {!browse && (
        <section className="around-world">
          <div className="section-heading">
            <div>
              <span className="section-kicker">A LITTLE AUDIO EXPLORATION</span>
              <h2>Around the world in a few clicks</h2>
              <p>Same planet. A whole different soundtrack.</p>
            </div>
            <Link className="text-link" to="/countries"><Globe2 size={20} /> Explore by Country <ArrowRight size={16} /></Link>
          </div>
          <div className="country-grid">
            {[
              {
                name: "United States",
                subtitle: "From coast to coast",
                image: "photo-1485871981521-5b1fd3805eee",
              },
              {
                name: "United Kingdom",
                subtitle: "An unmistakable sound",
                image: "photo-1513635269975-59663e0ac1ad",
              },
              {
                name: "France",
                subtitle: "A different kind of rhythm",
                image: "photo-1502602898657-3e91760cbb34",
              },
              {
                name: "Japan",
                subtitle: "Tune into the unexpected",
                image: "photo-1540959733332-eab4deabeeaf",
              },
            ].map((place) => (
              <Link
                className="country-tile"
                key={place.name}
                to={`/browse?country=${encodeURIComponent(place.name)}`}
              >
                <img
                  src={`https://images.unsplash.com/${place.image}?auto=format&fit=crop&w=600&q=80`}
                  alt=""
                  loading="lazy"
                />
                <div>
                  <span>{place.subtitle}</span>
                  <h3>{place.name}</h3>
                </div>
                <ArrowRight size={20} />
              </Link>
            ))}
          </div>
        </section>
      )}
      <div className="bottom-note">
        <Radio size={16} />
        <span>Real stations. Real people. A little closer together.</span>
      </div>
    </>
  );
}
