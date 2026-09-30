import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { recommendStations } from "../src/lib/recommendations.js";
test("recommendations hydrate history, deduplicate secure matches and exclude played stations", async () => {
  const requests = [];
  const station = {
    stationuuid: "played",
    url_resolved: "https://radio.test/live",
    tags: "jazz,soul",
    country: "France",
  };
  const fetch = mock.method(globalThis, "fetch", async (url) => {
    requests.push(new URL(url));
    return Response.json(
      String(url).includes("/byuuid/")
        ? [station]
        : [
            station,
            { ...station, stationuuid: "new", clickcount: 20 },
            { ...station, stationuuid: "new", clickcount: 20 },
            {
              ...station,
              stationuuid: "insecure",
              url_resolved: "http://radio.test/live",
            },
          ],
    );
  });
  try {
    const result = await recommendStations(
      [{ stationuuid: "played", tags: "", country: "" }],
      new AbortController().signal,
    );
    assert.deepEqual(
      result.map((item) => item.stationuuid),
      ["new"],
    );
    assert.equal(requests.length, 3);
    assert.ok(requests.some((url) => url.searchParams.get("tag") === "jazz"));
    assert.ok(
      requests.some((url) => url.searchParams.get("countryExact") === "true"),
    );
  } finally {
    fetch.mock.restore();
  }
});
test("recommendations preserve cancellation", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(recommendStations([], controller.signal), {
    name: "AbortError",
  });
});
