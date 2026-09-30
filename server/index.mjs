import express from "express";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { radioRequest, secureStations } from "../src/lib/radio.js";
import { stationHtml } from "./metadata.mjs";

const app = express();
const dist = fileURLToPath(new URL("../dist/", import.meta.url));
const template = await readFile(`${dist}/index.html`, "utf8");
const port = Number(process.env.PORT || 5189);
const origin = new URL(process.env.PUBLIC_ORIGIN || `http://localhost:${port}`)
  .origin;
app.disable("x-powered-by");
app.get("/station/:uuid", async (request, response) => {
  const uuid = request.params.uuid;
  if (!/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(uuid))
    return response.status(404).type("html").send(template);
  try {
    const rows = await radioRequest(
      `/stations/byuuid/${encodeURIComponent(uuid)}`,
      {},
      AbortSignal.timeout(6000),
    );
    const station = secureStations(rows)[0];
    if (!station) return response.status(404).type("html").send(template);
    response
      .set("Cache-Control", "public, max-age=300")
      .type("html")
      .send(stationHtml(template, station, origin));
  } catch {
    response.set("Cache-Control", "no-store").type("html").send(template);
  }
});
app.use(express.static(dist, { index: false }));
app.get("/{*path}", (_request, response) =>
  response.type("html").send(template),
);
app.listen(port, "0.0.0.0", () =>
  console.log(`WaveCast production server: http://localhost:${port}`),
);
