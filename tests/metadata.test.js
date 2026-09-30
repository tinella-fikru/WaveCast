import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createIcyMetadataProvider,
  stationFallback,
  subscribeMetadata,
} from "../src/lib/metadata.js";

const station = {
  name: "Test Radio",
  tags: "jazz, soul",
  url_resolved: "https://radio.example/live",
};

function icyBlock(title) {
  const metadata = new TextEncoder().encode(`StreamTitle='${title}';`);
  const length = Math.ceil(metadata.length / 16);
  const bytes = new Uint8Array(5 + length * 16);
  bytes[4] = length;
  bytes.set(metadata, 5);
  return bytes;
}

test("ICY title is parsed across fragmented chunks and the probe closes its stream", async () => {
  let cancelled = false;
  let options;
  const bytes = icyBlock("Artist - Track");
  const provider = createIcyMetadataProvider({
    fetcher: async (_url, init) => {
      options = init;
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(bytes.slice(0, 7));
            controller.enqueue(bytes.slice(7));
          },
          cancel() {
            cancelled = true;
          },
        }),
        { headers: { "icy-metaint": "4" } },
      );
    },
  });
  let stop;
  const title = await new Promise((resolve) => {
    stop = provider.subscribe(station, resolve);
  });
  stop();
  assert.equal(title, "Artist - Track");
  assert.equal(options.headers["Icy-MetaData"], "1");
  assert.equal(options.credentials, "omit");
  assert.equal(cancelled, true);
});

test("unavailable headers, CORS failures, and empty titles quietly return null", async () => {
  for (const fetcher of [
    async () => new Response("plain audio"),
    async () => {
      throw new TypeError("Failed to fetch");
    },
    async () => new Response(icyBlock(""), { headers: { "icy-metaint": "4" } }),
    async () => new Response("invalid", { headers: { "icy-metaint": "-1" } }),
  ]) {
    let stop;
    const title = await new Promise((resolve) => {
      stop = createIcyMetadataProvider({ fetcher }).subscribe(station, resolve);
    });
    stop();
    assert.equal(title, null);
  }
  assert.equal(stationFallback(station), "Test Radio · jazz · soul");
});

test("metadata polling updates tracks and clears an explicitly empty title", async () => {
  const titles = ["First track", "Second track", ""];
  const received = [];
  let calls = 0;
  let stop;
  await new Promise((resolve) => {
    stop = createIcyMetadataProvider({
      intervalMs: 1,
      fetcher: async () =>
        new Response(icyBlock(titles[calls++]), {
          headers: { "icy-metaint": "4" },
        }),
    }).subscribe(station, (title) => {
      received.push(title);
      if (received.length === 3) {
        stop();
        resolve();
      }
    });
  });
  assert.deepEqual(received, ["First track", "Second track", null]);
  assert.equal(calls, 3);
});

test("stopping a provider aborts pending requests without publishing stale titles", async () => {
  let signal;
  let complete;
  const fetcher = (_url, options) => {
    signal = options.signal;
    return new Promise((resolve) => {
      complete = resolve;
    });
  };
  const received = [];
  const stop = createIcyMetadataProvider({ fetcher }).subscribe(
    station,
    (title) => received.push(title),
  );
  stop();
  assert.equal(signal.aborted, true);
  complete(
    new Response(icyBlock("Old station"), { headers: { "icy-metaint": "4" } }),
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(received, []);
});

test("provider replacement contract guards late callbacks and thrown errors", () => {
  let publish;
  let disposed = false;
  const received = [];
  const stop = subscribeMetadata(
    {
      subscribe(_station, onTitle) {
        publish = onTitle;
        return () => {
          disposed = true;
        };
      },
    },
    station,
    (title) => received.push(title),
  );
  publish(" Current track ");
  stop();
  publish("Old station update");
  assert.deepEqual(received, ["Current track"]);
  assert.equal(disposed, true);
  subscribeMetadata(
    {
      subscribe() {
        throw Error("Unsupported");
      },
    },
    station,
    (title) => received.push(title),
  );
  assert.deepEqual(received, ["Current track", null]);
});

test("a stalled metadata body is cancelled at the deadline with a quiet fallback", async () => {
  let cancelled = false;
  let stop;
  const title = await new Promise((resolve) => {
    stop = createIcyMetadataProvider({
      timeoutMs: 5,
      fetcher: async () =>
        new Response(
          new ReadableStream({
            cancel() {
              cancelled = true;
            },
          }),
          { headers: { "icy-metaint": "4" } },
        ),
    }).subscribe(station, resolve);
  });
  stop();
  assert.equal(title, null);
  assert.equal(cancelled, true);
});

test("metadata probes stop at the byte budget instead of downloading an endless stream", async () => {
  let reads = 0;
  let cancelled = false;
  let stop;
  const title = await new Promise((resolve) => {
    stop = createIcyMetadataProvider({
      maxBytes: 10,
      fetcher: async () =>
        new Response(
          new ReadableStream({
            pull(controller) {
              reads++;
              controller.enqueue(new Uint8Array(5));
            },
            cancel() {
              cancelled = true;
            },
          }),
          { headers: { "icy-metaint": "4" } },
        ),
    }).subscribe(station, resolve);
  });
  stop();
  assert.equal(title, null);
  assert.equal(cancelled, true);
  assert.ok(reads <= 3);
});
