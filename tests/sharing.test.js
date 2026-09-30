import { test } from "node:test";
import assert from "node:assert/strict";
import { stationHtml } from "../server/metadata.mjs";
test("station Open Graph is in initial HTML with escaped third-party values", () => {
  const html = stationHtml(
    '<html><head><title>WaveCast</title><meta property="og:title" content="Generic" /></head></html>',
    {
      stationuuid: "abc",
      name: 'Radio "<test>"',
      country: "France",
      tags: "jazz",
      favicon: "http://insecure.test/image",
    },
    "https://wavecast.test",
  );
  assert.match(html, /Radio &quot;&lt;test&gt;&quot;/);
  assert.match(html, /https:\/\/wavecast.test\/station\/abc/);
  assert.match(html, /https:\/\/wavecast.test\/icons\/icon-512.png/);
  assert.equal((html.match(/property="og:title"/g) || []).length, 1);
  assert.ok(!html.includes("<test>"));
});
