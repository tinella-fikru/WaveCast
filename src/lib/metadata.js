import { IcecastMetadataReader } from "icecast-metadata-js";

export function stationFallback(station) {
  return [
    station.name,
    ...station.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 3),
  ].join(" · ");
}

export function subscribeMetadata(provider, station, onTitle) {
  let active = true;
  let dispose;
  try {
    dispose = provider.subscribe(station, (title) => {
      if (active)
        onTitle(
          typeof title === "string" ? title.trim().slice(0, 512) || null : null,
        );
    });
  } catch {
    onTitle(null);
  }
  return () => {
    active = false;
    try {
      dispose?.();
    } catch {
      return;
    }
  };
}

export function createIcyMetadataProvider({
  fetcher = fetch,
  intervalMs = 30000,
  timeoutMs = 10000,
  maxBytes = 262144,
} = {}) {
  return {
    subscribe(station, onTitle) {
      const lifetime = new AbortController();
      let timer;

      async function probe() {
        const request = new AbortController();
        let reader;
        const cancel = () => {
          request.abort();
          void reader?.cancel().catch(() => undefined);
        };
        lifetime.signal.addEventListener("abort", cancel, { once: true });
        const timeout = setTimeout(cancel, timeoutMs);
        let supported = false;
        let title = null;
        try {
          if (!station.url_resolved.startsWith("https://")) return;
          const response = await fetcher(station.url_resolved, {
            headers: { "Icy-MetaData": "1" },
            signal: request.signal,
            credentials: "omit",
            cache: "no-store",
          });
          reader = response.body?.getReader();
          const header = response.headers.get("icy-metaint") ?? "";
          const interval = /^\d+$/.test(header) ? Number(header) : 0;
          if (
            !response.ok ||
            !reader ||
            !interval ||
            interval > maxBytes ||
            (response.url && !response.url.startsWith("https://"))
          )
            return;
          let received = false;
          const parser = new IcecastMetadataReader({
            icyMetaInt: interval,
            metadataTypes: ["icy"],
            enableLogging: false,
            onMetadata: ({ metadata }) => {
              received = true;
              title =
                typeof metadata.StreamTitle === "string"
                  ? metadata.StreamTitle.trim().slice(0, 512) || null
                  : null;
            },
          });
          let bytesRead = 0;
          while (!request.signal.aborted && !received && bytesRead < maxBytes) {
            const chunk = await reader.read();
            if (chunk.done) break;
            const bytes = chunk.value.subarray(0, maxBytes - bytesRead);
            bytesRead += bytes.length;
            parser.readAll(bytes);
          }
          supported = !request.signal.aborted;
        } catch {
          title = null;
        } finally {
          clearTimeout(timeout);
          request.abort();
          if (reader) {
            try {
              await reader.cancel();
            } catch {}
            reader.releaseLock();
          }
          lifetime.signal.removeEventListener("abort", cancel);
          if (!lifetime.signal.aborted) {
            onTitle(title);
            if (supported) timer = setTimeout(probe, intervalMs);
          }
        }
      }

      void probe();
      return () => {
        lifetime.abort();
        clearTimeout(timer);
      };
    },
  };
}

export const icyMetadataProvider = createIcyMetadataProvider();
