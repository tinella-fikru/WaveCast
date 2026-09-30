import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Globe2, LoaderCircle, LocateFixed, Pause, Play, Radio, RefreshCw, Search } from "lucide-react";
import L from "leaflet";
import "leaflet.markercluster";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import { numericToAlpha2 } from "i18n-iso-countries";
import atlas from "world-atlas/countries-110m.json";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "./countries.css";
import { mapStations, radioRequest } from "../lib/radio.js";
import { usePlayer } from "../context/Player";
import { FavoriteButton, StationLogo } from "../components/Stations";
import type { Station } from "../types";

type Country = { name: string; iso_3166_1: string; stationcount: number };
const topology = atlas as unknown as Topology<{ countries: GeometryCollection }>;
const boundaries = feature(topology, topology.objects.countries);
const countryPath = (name: string) => `/countries/${encodeURIComponent(name)}`;

function StationPopup({ station }: { station: Station }) {
  const player = usePlayer();
  const selected = player.station?.stationuuid === station.stationuuid;
  const playing = selected && player.status === "playing";
  const buffering = selected && player.status === "loading";
  return <div className="map-station-popup">
    <StationLogo station={station} />
    <h3>{station.name}</h3>
    <p>{station.country || "Worldwide"} · {station.bitrate ? `${station.bitrate} kbps` : "Live stream"}</p>
    <p className="popup-tags">{station.tags.split(",").filter(Boolean).slice(0, 3).join(" · ")}</p>
    <div className="popup-actions"><button className="button primary" onClick={() => player.playStation(station)} aria-label={`${playing || buffering ? "Pause" : "Play"} ${station.name}`}>
      {buffering ? <LoaderCircle className="spin" size={16} /> : playing ? <Pause size={16} /> : <Play size={16} />}
      {buffering ? "Tuning in..." : playing ? "Pause" : "Play"}
    </button><FavoriteButton station={station} /></div>
    {selected && player.error && <p role="alert">{player.error}</p>}
    {station.country && <Link to={countryPath(station.country)}>Stations in {station.country} <ArrowRight size={14} /></Link>}
  </div>;
}

function CountryMap({ countries, stations }: { countries: Country[]; stations: Station[] }) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [map, setMap] = useState<L.Map | null>(null);
  const [popup, setPopup] = useState<{ station: Station; element: HTMLElement } | null>(null);
  const [tileError, setTileError] = useState(false);
  const tilesRef = useRef<L.TileLayer | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!container.current) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const instance = L.map(container.current, {
      center: [25, 8], zoom: 2, minZoom: 1, maxZoom: 18,
      scrollWheelZoom: false, zoomAnimation: !reducedMotion,
      maxBounds: [[-85, -180], [85, 180]], maxBoundsViscosity: 0.8,
    });
    const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      maxZoom: 19, noWrap: true,
    }).addTo(instance);
    instance.attributionControl.addAttribution('Boundaries: <a href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer">Natural Earth</a>');
    tiles.on("tileerror", () => setTileError(true));
    tilesRef.current = tiles;
    mapRef.current = instance;
    setMap(instance);
    const observer = new ResizeObserver(() => instance.invalidateSize());
    observer.observe(container.current);
    return () => { observer.disconnect(); tiles.off(); instance.remove(); mapRef.current = null; tilesRef.current = null; };
  }, []);

  useEffect(() => {
    if (!map) return;
    const byCode = new Map(countries.map((country) => [country.iso_3166_1?.toUpperCase(), country]));
    const layer = L.geoJSON(boundaries, {
      style: { color: "#348065", weight: 1, fillColor: "#69bc9b", fillOpacity: 0.12 },
      onEachFeature: (shape, countryLayer) => {
        const code = numericToAlpha2(String(shape.id).padStart(3, "0"));
        const country = byCode.get(code ?? "");
        const name = country?.name ?? shape.properties?.name ?? "Unknown country";
        const label = `${name}: ${(country?.stationcount ?? 0).toLocaleString()} stations`;
        const tooltip = document.createElement("span");
        tooltip.textContent = label;
        countryLayer.bindTooltip(tooltip, { sticky: true, className: "country-tooltip" });
        countryLayer.on("mouseover", () => (countryLayer as L.Path).setStyle({ fillOpacity: 0.3, weight: 2 }));
        countryLayer.on("mouseout", () => (countryLayer as L.Path).setStyle({ fillOpacity: 0.12, weight: 1 }));
        if (!country) return;
        const open = () => navigate(countryPath(country.name));
        countryLayer.on("click", open);
        countryLayer.on("add", () => {
          const element = (countryLayer as L.Path).getElement();
          if (!element) return;
          element.setAttribute("role", "link");
          element.setAttribute("aria-label", label);
          element.setAttribute("tabindex", "0");
          element.addEventListener("keydown", (event) => {
            const key = (event as KeyboardEvent).key;
            if (key === "Enter" || key === " ") { event.preventDefault(); open(); }
          });
        });
      },
    }).addTo(map);
    return () => { layer.remove(); };
  }, [map, countries, navigate]);

  useEffect(() => {
    if (!map) return;
    const cluster = L.markerClusterGroup({
      maxClusterRadius: 45, showCoverageOnHover: false, spiderfyOnMaxZoom: true,
      animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      iconCreateFunction: (group) => L.divIcon({
        className: "radio-cluster", html: `<span>${group.getChildCount()}</span>`, iconSize: [40, 40],
      }),
    });
    const icon = L.divIcon({ className: "radio-map-marker", html: '<span aria-hidden="true"></span>', iconSize: [26, 26], iconAnchor: [13, 13] });
    for (const station of stations) {
      if (station.geo_lat == null || station.geo_long == null) continue;
      const element = document.createElement("div");
      const marker = L.marker([station.geo_lat, station.geo_long], { icon, title: station.name, alt: station.name });
      marker.bindPopup(element, { minWidth: 205, maxWidth: 250, className: "radio-popup" });
      marker.on("popupopen", () => setPopup({ station, element }));
      marker.on("popupclose", () => setPopup((current) => current?.element === element ? null : current));
      cluster.addLayer(marker);
    }
    cluster.addTo(map);
    return () => { cluster.remove(); cluster.clearLayers(); };
  }, [map, stations]);

  return <div className="country-map-frame">
    <div ref={container} className="country-map" role="region" aria-label="World radio map" />
    <button className="map-reset icon-button" title="Reset world view" aria-label="Reset world view" onClick={() => mapRef.current?.setView([25, 8], 2)}><LocateFixed size={20} /></button>
    {tileError && <div className="map-tile-error" role="alert">Map tiles could not load. The country list is still available. <button onClick={() => { setTileError(false); tilesRef.current?.redraw(); }}>Retry tiles</button></div>}
    {popup && createPortal(<StationPopup station={popup.station} />, popup.element)}
  </div>;
}

export default function Countries() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [countryLoading, setCountryLoading] = useState(true);
  const [countryError, setCountryError] = useState("");
  const [countryRetry, setCountryRetry] = useState(0);
  const [query, setQuery] = useState("");
  const [stations, setStations] = useState<Station[]>([]);
  const [stationLoading, setStationLoading] = useState(true);
  const [stationError, setStationError] = useState("");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [stationRetry, setStationRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setCountryLoading(true); setCountryError("");
    radioRequest("/countries", { hidebroken: "true" }, controller.signal)
      .then((rows: Country[]) => {
        if (!Array.isArray(rows)) throw new Error("Invalid country response");
        if (!controller.signal.aborted) setCountries(rows.filter((country) => country.name && country.stationcount > 0).sort((first, second) => first.name.localeCompare(second.name)));
      })
      .catch(() => { if (!controller.signal.aborted) setCountryError("Countries could not be loaded. Please try again."); })
      .finally(() => { if (!controller.signal.aborted) setCountryLoading(false); });
    return () => controller.abort();
  }, [countryRetry]);

  useEffect(() => {
    const controller = new AbortController();
    setStationLoading(true); setStationError("");
    mapStations(offset, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setStations((previous) => [...previous, ...result.stations.filter((station: Station) => !previous.some((item) => item.stationuuid === station.stationuuid))]);
        setHasMore(result.hasMore);
      })
      .catch(() => { if (!controller.signal.aborted) setStationError("Station locations could not be loaded. Please try again."); })
      .finally(() => { if (!controller.signal.aborted) setStationLoading(false); });
    return () => controller.abort();
  }, [offset, stationRetry]);

  const visible = countries.filter((country) => `${country.name} ${country.iso_3166_1}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <>
    <section className="page-heading country-heading"><span className="eyebrow">LOCAL VOICES. WORLDWIDE.</span><h1>Explore by Country</h1><p>A different place. A different frequency.</p></section>
    <div className="country-explorer">
      <section className="country-directory" aria-labelledby="country-list-title">
        <div className="country-directory-heading"><h2 id="country-list-title">Countries</h2><span>{countries.length || ""}</span></div>
        <label className="country-search"><Search size={18} /><span className="sr-only">Search countries</span><input type="search" placeholder="Search countries..." value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <p className="country-count-note">Station totals from Radio Browser</p>
        <div className="country-list" aria-busy={countryLoading}>
          {countryLoading ? <div className="country-loading" role="status"><LoaderCircle className="spin" size={18} /> Loading countries...</div> : countryError ? <div className="country-list-message" role="alert"><p>{countryError}</p><button className="button secondary" onClick={() => setCountryRetry((value) => value + 1)}><RefreshCw size={16} /> Retry</button></div> : visible.length ? visible.map((country) => <Link className="country-row" to={countryPath(country.name)} key={country.name}>
            <span className="country-code">{country.iso_3166_1 || <Globe2 size={15} />}</span><span className="country-row-name">{country.name}</span><span className="country-row-count">{country.stationcount.toLocaleString()}<small>stations</small></span><ArrowRight size={14} />
          </Link>) : <div className="country-list-message"><Globe2 size={25} /><h3>No countries found</h3><p>Try a different country name or country code.</p></div>}
        </div>
      </section>
      <section className="country-map-section" aria-label="Explore live radio on the map">
        <div className="map-heading"><span><Globe2 size={17} /> World airwaves</span><span className="map-live-dot">LIVE RADIO</span></div>
        <CountryMap countries={countries} stations={stations} />
        <div className="map-status"><span role="status"><Radio size={15} /> {stationLoading ? "Loading station locations..." : `${stations.length.toLocaleString()} HTTPS station locations loaded`}</span>
          {hasMore && !stationError && <button className="text-button" disabled={stationLoading} onClick={() => setOffset((value) => value + 500)}>Load more locations <ArrowRight size={15} /></button>}
        </div>
        {stationError && <div className="inline-error" role="alert">{stationError}<button onClick={() => setStationRetry((value) => value + 1)}>Retry locations</button></div>}
        {!stationLoading && !stationError && !stations.length && <p className="country-count-note">No HTTPS station locations found. Choose a country to browse its stations.</p>}
      </section>
    </div>
  </>;
}