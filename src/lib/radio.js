export const SERVERS = [
  "https://de1.api.radio-browser.info/json",
  "https://at1.api.radio-browser.info/json",
  "https://nl1.api.radio-browser.info/json",
];

export async function radioRequest(path, params = {}, signal, fetcher = fetch) {
  const query = new URLSearchParams(params).toString();
  let lastError;
  for (const server of SERVERS) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    const timeout = setTimeout(abort, 8000);
    try {
      const response = await fetcher(
        `${server}${path}${query ? `?${query}` : ""}`,
        { signal: controller.signal },
      );
      if (!response.ok)
        throw new Error(`Radio directory returned ${response.status}`);
      return await response.json();
    } catch (error) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      lastError = error;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
    }
  }
  throw lastError ?? new Error("Radio directory is unavailable");
}

export function secureStations(stations) {
  const seen = new Set();
  return stations.filter((station) => {
    if (
      !station.stationuuid ||
      !station.url_resolved?.startsWith("https://") ||
      seen.has(station.stationuuid)
    )
      return false;
    seen.add(station.stationuuid);
    return true;
  });
}

export async function searchStations(
  filters = {},
  offset = 0,
  signal,
  fetcher = fetch,
) {
  const limit = 48;
  const params = {
    ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)),
    limit: String(limit),
    offset: String(offset),
    hidebroken: "true",
    order: "clickcount",
    reverse: "true",
  };
  const raw = await radioRequest("/stations/search", params, signal, fetcher);
  if (!Array.isArray(raw)) throw new Error("Invalid station response");
  return {
    stations: secureStations(raw),
    nextOffset: offset + raw.length,
    hasMore: raw.length === limit,
  };
}

export function registerClick(uuid) {
  return radioRequest(`/url/${encodeURIComponent(uuid)}`);
}

export async function mapStations(offset = 0, signal, fetcher = fetch) {
  const limit = 500;
  const rows = await radioRequest("/stations/search", {
    has_geo_info: "true", hidebroken: "true", order: "clickcount", reverse: "true",
    limit: String(limit), offset: String(offset),
  }, signal, fetcher);
  if (!Array.isArray(rows)) throw new Error("Invalid station response");
  return {
    stations: secureStations(rows).filter((station) =>
      Number.isFinite(station.geo_lat) && Math.abs(station.geo_lat) <= 90 &&
      Number.isFinite(station.geo_long) && Math.abs(station.geo_long) <= 180),
    nextOffset: offset + rows.length,
    hasMore: rows.length === limit,
  };
}
