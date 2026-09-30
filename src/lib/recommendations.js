import { radioRequest, searchStations, secureStations } from "./radio.js";

export async function recommendStations(history, signal, limit = 8) {
  const sources = await Promise.all(
    history.slice(0, 5).map(async (station) => {
      if (station.tags || station.country) return station;
      try {
        return (
          (
            await radioRequest(
              `/stations/byuuid/${encodeURIComponent(station.stationuuid)}`,
              {},
              signal,
            )
          )[0] || station
        );
      } catch {
        return station;
      }
    }),
  );
  const queries = new Map();
  for (const station of sources) {
    const tag = station.tags
      ?.split(",")
      .map((value) => value.trim())
      .find(Boolean);
    if (tag) queries.set(`tag:${tag}`, { tag });
    if (station.country)
      queries.set(`country:${station.country}`, {
        country: station.country,
        countryExact: "true",
      });
  }
  const results = await Promise.allSettled(
    [...queries.values()].map((filters) => searchStations(filters, 0, signal)),
  );
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  if (results.length && results.every((result) => result.status === "rejected"))
    throw Error("Recommendations could not be loaded.");
  const excluded = new Set(history.map((station) => station.stationuuid));
  return secureStations(
    results.flatMap((result) =>
      result.status === "fulfilled" ? result.value.stations : [],
    ),
  )
    .filter((station) => !excluded.has(station.stationuuid))
    .sort((first, second) => (second.clickcount || 0) - (first.clickcount || 0))
    .slice(0, limit);
}
