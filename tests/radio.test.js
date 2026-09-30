import { test } from "node:test";
import assert from "node:assert/strict";
import {
  radioRequest,
  searchStations,
  secureStations,
  mapStations,
  SERVERS,
} from "../src/lib/radio.js";

test("only unique HTTPS stations are exposed", () => {
  const rows = [
    { stationuuid: "secure", url_resolved: "https://radio.example/live" },
    { stationuuid: "http", url_resolved: "http://radio.example/live" },
    { stationuuid: "missing" },
    { stationuuid: "secure", url_resolved: "https://radio.example/live" },
  ];
  assert.deepEqual(secureStations(rows), [rows[0]]);
});

test("directory retries secondary and tertiary servers", async () => {
  const calls = [];
  const result = await radioRequest(
    "/countries",
    {},
    undefined,
    async (url) => {
      calls.push(url);
      if (calls.length < 3) throw new Error("Offline");
      return { ok: true, json: async () => [{ name: "France" }] };
    },
  );
  assert.deepEqual(
    calls,
    SERVERS.map((server) => `${server}/countries`),
  );
  assert.equal(result[0].name, "France");
});

test("pagination counts raw results and sends search parameters", async () => {
  let requested;
  const result = await searchStations(
    { name: "jazz", country: "France" },
    48,
    undefined,
    async (url) => {
      requested = new URL(url);
      return {
        ok: true,
        json: async () =>
          Array.from({ length: 48 }, (_, index) => ({
            stationuuid: String(index),
            url_resolved: `${index % 2 ? "http" : "https"}://radio.example/${index}`,
          })),
      };
    },
  );
  assert.equal(result.stations.length, 24);
  assert.equal(result.nextOffset, 96);
  assert.equal(result.hasMore, true);
  assert.equal(requested.searchParams.get("name"), "jazz");
  assert.equal(requested.searchParams.get("country"), "France");
  assert.equal(requested.searchParams.get("hidebroken"), "true");
  assert.equal(requested.searchParams.get("order"), "clickcount");
});

test("aborted requests do not retry", async () => {
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  await assert.rejects(
    radioRequest("/tags", {}, controller.signal, async () => {
      calls++;
    }),
    { name: "AbortError" },
  );
  assert.equal(calls, 0);
});

test("map stations require secure URLs and valid numeric coordinates, including zero", async () => {
  let requested;
  const coordinates = [[0, 0], [null, 12], [91, 12], [12, -181], ["12", 12], [45, 90]];
  const result = await mapStations(500, undefined, async (url) => {
    requested = new URL(url);
    return { ok: true, json: async () => coordinates.map(([geo_lat, geo_long], index) => ({
      stationuuid: String(index), geo_lat, geo_long,
      url_resolved: `${index === 5 ? "http" : "https"}://radio.example/live`,
    })) };
  });
  assert.deepEqual(result.stations.map((station) => station.stationuuid), ["0"]);
  assert.equal(result.nextOffset, 506);
  assert.equal(result.hasMore, false);
  assert.equal(requested.searchParams.get("has_geo_info"), "true");
  assert.equal(requested.searchParams.get("order"), "clickcount");
  assert.equal(requested.searchParams.get("offset"), "500");
});

test("country station searches preserve exact country and popularity filters", async () => {
  let requested;
  await searchStations({ country: "France", countryExact: "true", tag: "jazz", language: "french" }, 0, undefined, async (url) => {
    requested = new URL(url);
    return { ok: true, json: async () => [] };
  });
  for (const [key, value] of Object.entries({ country: "France", countryExact: "true", tag: "jazz", language: "french", order: "clickcount", reverse: "true" })) {
    assert.equal(requested.searchParams.get(key), value);
  }
});
