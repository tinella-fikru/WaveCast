import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const origin = process.env.TEST_ORIGIN || "http://localhost:5189";
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || undefined,
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  permissions: ["clipboard-read", "clipboard-write"],
});
const station = {
  stationuuid: "11111111-1111-4111-8111-111111111111",
  name: "Radio Test International",
  country: "France",
  countrycode: "FR",
  tags: "jazz,soul",
  bitrate: 128,
  favicon: "",
  url_resolved: "https://stream.wavecast.test/live",
  url: "https://stream.wavecast.test/alternate",
  geo_lat: 48.85,
  geo_long: 2.35,
};
const errors = [];
await mkdir("test-results", { recursive: true });
try {
  await context.addInitScript(() => {
    localStorage.setItem("wavecast-tour-guest", "done");
    Object.defineProperty(navigator, "share", {
      value: undefined,
      configurable: true,
    });
    const states = new WeakMap();
    Object.defineProperty(HTMLMediaElement.prototype, "paused", {
      get() {
        return states.get(this) !== true;
      },
    });
    HTMLMediaElement.prototype.load = function () {};
    HTMLMediaElement.prototype.play = function () {
      states.set(this, true);
      queueMicrotask(() => this.dispatchEvent(new Event("playing")));
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function () {
      if (states.get(this)) {
        states.set(this, false);
        queueMicrotask(() => this.dispatchEvent(new Event("pause")));
      }
    };
  });
  await context.route("https://*.api.radio-browser.info/**", (route) => {
    const url = new URL(route.request().url());
    let data = [station];
    if (url.pathname.endsWith("/countries"))
      data = [
        { name: "France", iso_3166_1: "FR", stationcount: 100 },
        { name: "Germany", iso_3166_1: "DE", stationcount: 80 },
      ];
    if (url.pathname.endsWith("/tags"))
      data = [{ name: "jazz", stationcount: 100 }];
    if (url.pathname.endsWith("/languages"))
      data = [{ name: "english", stationcount: 100 }];
    return route.fulfill({ json: data });
  });
  await context.route("https://stream.wavecast.test/**", (route) =>
    route.abort(),
  );
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin);
  await page
    .getByRole("link", { name: station.name, exact: true })
    .first()
    .waitFor();
  await page
    .getByRole("button", { name: `Play ${station.name}`, exact: true })
    .click();
  await page
    .getByRole("button", { name: "Pause radio", exact: true })
    .waitFor();
  await page.locator("#main-content").focus();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "Play radio", exact: true }).waitFor();
  await page.keyboard.press("Space");
  await page
    .getByRole("button", { name: "Pause radio", exact: true })
    .waitFor();
  await page.keyboard.press("m");
  await page.getByRole("button", { name: "Unmute", exact: true }).waitFor();
  await page.keyboard.press("ArrowUp");
  assert.equal(
    Number(await page.getByRole("slider", { name: "Volume" }).inputValue()),
    0.75,
  );
  await page.keyboard.press("/");
  assert.equal(
    await page
      .locator("#station-search")
      .evaluate((element) => element === document.activeElement),
    true,
  );
  await page.keyboard.type("m f /");
  assert.equal(await page.locator("#station-search").inputValue(), "m f /");
  await page.locator("#station-search").fill("");
  await page.locator("#main-content").focus();
  await page.keyboard.press("?");
  await page.getByRole("dialog", { name: "Keyboard shortcuts" }).waitFor();
  for (let index = 0; index < 8; index++) {
    await page.keyboard.press("Tab");
    assert.equal(
      await page.evaluate(() => !!document.activeElement?.closest("dialog")),
      true,
    );
  }
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("dialog[open]").count(), 0);
  await page
    .getByRole("link", { name: station.name, exact: true })
    .first()
    .click();
  await page
    .getByRole("heading", { name: station.name, exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Pause radio", exact: true })
      .count(),
    1,
  );
  await page
    .locator(".station-page")
    .getByRole("button", { name: /Share/ })
    .click();
  await page.getByText("Link copied", { exact: true }).waitFor();
  assert.match(
    await page.evaluate(() => navigator.clipboard.readText()),
    /\/station\/11111111/,
  );
  const violations = [];
  for (const width of [320, 360, 375, 390, 414, 520, 600, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => document.fonts.ready);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `Station page overflow at ${width}`,
    );
    const overlap = await page.evaluate(() => {
      const selectors = [".player-station", ".player-center", ".player-tools"];
      const rects = selectors.map((selector) =>
        document.querySelector(selector).getBoundingClientRect(),
      );
      return rects.some((first, index) =>
        rects.some(
          (second, other) =>
            other > index &&
            first.left < second.right &&
            first.right > second.left &&
            first.top < second.bottom &&
            first.bottom > second.top,
        ),
      );
    });
    assert.equal(overlap, false, `Player overlap at ${width}`);
    const controlCollisions = await page.evaluate(() => {
      const collisions = [];
      for (const selector of [
        '.player-center button, .player-tools button, .volume-slider, .visualizer-display, .player-mobile-mark',
        '.header-actions > *, .page-breadcrumb',
        '.main-nav > a',
      ]) {
        const elements = Array.from(document.querySelectorAll(selector)).filter(element => element.getClientRects().length > 0);
        for (const [index, element] of elements.entries()) {
          const first = element.getBoundingClientRect();
          if (first.left < 0 || first.right > innerWidth) collisions.push(`${element.className}: outside viewport`);
          for (const next of elements.slice(index + 1)) {
            const second = next.getBoundingClientRect();
            if (first.left < second.right && first.right > second.left && first.top < second.bottom && first.bottom > second.top) {
              collisions.push(`${element.className} overlaps ${next.className}`);
            }
          }
        }
      }
      return collisions;
    });
    assert.deepEqual(controlCollisions, [], `Control collisions at ${width}`);
    await page.screenshot({
      path: `test-results/station-${width}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const theme of ["dark", "light"]) {
    if (theme === "light")
      await page.getByRole("button", { name: "Switch to light mode" }).click();
    const scan = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    violations.push(
      ...scan.violations.map((item) => ({
        theme,
        id: item.id,
        nodes: item.nodes.map((node) => ({
          target: node.target,
          summary: node.failureSummary,
        })),
      })),
    );
  }
  await page.evaluate(() => {
    const prompt = new Event("beforeinstallprompt");
    Object.assign(prompt, {
      prompt: async () => {
        window.__installPromptCalled = true;
      },
      userChoice: Promise.resolve({ outcome: "accepted" }),
    });
    window.dispatchEvent(prompt);
  });
  await page
    .getByRole("button", { name: "Install WaveCast", exact: true })
    .click();
  assert.equal(await page.evaluate(() => window.__installPromptCalled), true);
  for (const retry of [1, 2, 3]) {
    await page
      .locator("audio")
      .evaluate((element) => element.dispatchEvent(new Event("error")));
    await page
      .getByText(`Reconnecting (${retry}/3)...`, { exact: true })
      .waitFor();
    await page.waitForFunction(
      () => document.querySelector("audio")?.paused === false,
    );
  }
  await page
    .locator("audio")
    .evaluate((element) => element.dispatchEvent(new Event("error")));
  await page
    .getByText("This station is unavailable, try another", { exact: true })
    .waitFor();
  await page.setViewportSize({ width: 320, height: 900 });
  await page.getByRole("button", { name: "Report / alternatives" }).click();
  await page.getByRole("dialog", { name: "Station unavailable" }).waitFor();
  assert.match(
    await page
      .getByRole("link", { name: "Report broken station" })
      .getAttribute("href"),
    /gitlab.com\/radiobrowser\/radio-database/,
  );
  await page
    .getByRole("button", { name: "Retry playback", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Pause radio", exact: true })
    .waitFor();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByRole("button", { name: `Add ${station.name} to collection` })
    .click();
  await page.waitForURL("**/login");
  for (const path of ["/collections", "/insights"]) {
    await page.goto(origin + path);
    await page.getByRole("heading", { level: 1 }).waitFor();
    assert.equal(
      await page
        .locator("main")
        .getByRole("link", { name: "Sign in", exact: true })
        .count(),
      1,
    );
  }
  await page.goto(origin + "/countries");
  await page.locator(".leaflet-container").waitFor();
  await page.setViewportSize({ width: 390, height: 900 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
    "Country map mobile overflow",
  );
  await page.screenshot({
    path: "test-results/countries-mobile.png",
    fullPage: true,
  });
  for (const path of [
    "/",
    "/browse",
    "/login",
    "/collections",
    "/insights",
    "/countries",
  ]) {
    await page.goto(origin + path);
    await page.getByRole("heading", { level: 1 }).waitFor();
    if (path === "/countries")
      await page.locator(".leaflet-container").waitFor();
    if (path === "/" || path === "/browse")
      await page
        .getByRole("link", { name: station.name, exact: true })
        .first()
        .waitFor();
    const scan = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    violations.push(
      ...scan.violations.map((item) => ({
        path,
        id: item.id,
        nodes: item.nodes.map((node) => ({
          target: node.target,
          summary: node.failureSummary,
        })),
      })),
    );
  }
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  assert.equal(
    await page.evaluate(() => !!navigator.serviceWorker.controller),
    true,
  );
  const cached = await page.evaluate(async () => {
    const result = [];
    for (const name of await caches.keys()) {
      for (const request of await (await caches.open(name)).keys())
        result.push(request.url);
    }
    return result;
  });
  assert.ok(cached.length > 10);
  assert.ok(
    cached.every((url) => new URL(url).origin === locationOrigin(origin)),
  );
  assert.ok(
    !cached.some((url) => /stream\.wavecast|api\.radio-browser/.test(url)),
  );
  await context.setOffline(true);
  await page.goto(origin + "/offline-check");
  await page
    .getByText("You're offline, reconnect to keep listening", { exact: true })
    .waitFor();
  await page.screenshot({ path: "test-results/offline.png", fullPage: true });
  console.log(
    JSON.stringify(
      {
        cachedAssets: cached.length,
        violations,
        errors,
        screenshots: "test-results",
      },
      null,
      2,
    ),
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(violations, []);
  const audioContext = await browser.newContext({
    viewport: { width: 390, height: 900 },
  });
  try {
    const wave = Buffer.alloc(44 + 16000 * 60 * 2);
    wave.write("RIFF", 0);
    wave.writeUInt32LE(wave.length - 8, 4);
    wave.write("WAVEfmt ", 8);
    wave.writeUInt32LE(16, 16);
    wave.writeUInt16LE(1, 20);
    wave.writeUInt16LE(1, 22);
    wave.writeUInt32LE(16000, 24);
    wave.writeUInt32LE(32000, 28);
    wave.writeUInt16LE(2, 32);
    wave.writeUInt16LE(16, 34);
    wave.write("data", 36);
    wave.writeUInt32LE(wave.length - 44, 40);
    for (let sample = 0; sample < 16000 * 60; sample++)
      wave.writeInt16LE(
        Math.round(Math.sin((2 * Math.PI * 440 * sample) / 16000) * 12000),
        44 + sample * 2,
      );
    await audioContext.addInitScript(() =>
      localStorage.setItem("wavecast-tour-guest", "done"),
    );
    await audioContext.route("https://*.api.radio-browser.info/**", (route) =>
      route.fulfill({ json: [station] }),
    );
    await audioContext.route("https://stream.wavecast.test/**", (route) =>
      route.fulfill({
        contentType: "audio/wav",
        headers: { "access-control-allow-origin": "*" },
        body: wave,
      }),
    );
    const audioPage = await audioContext.newPage();
    await audioPage.goto(origin);
    await audioPage
      .getByRole("button", { name: `Play ${station.name}`, exact: true })
      .click();
    await audioPage
      .getByRole("button", { name: "Pause radio", exact: true })
      .waitFor();
    await audioPage
      .getByRole("button", { name: "Audio visualizer", exact: true })
      .click();
    await audioPage.waitForFunction(() => {
      const canvas = document.querySelector(".visualizer canvas");
      return (
        canvas &&
        !canvas.hidden &&
        canvas
          .getContext("2d")
          .getImageData(0, 0, 160, 48)
          .data.some((value) => value > 0)
      );
    });
    await audioPage.screenshot({
      path: "test-results/visualizer-mobile.png",
      fullPage: true,
    });
    await audioPage
      .getByRole("button", { name: "Audio visualizer", exact: true })
      .click();
    assert.equal(
      await audioPage
        .getByRole("button", { name: "Pause radio", exact: true })
        .count(),
      1,
    );
    await audioPage
      .getByRole("button", { name: "Pause radio", exact: true })
      .click();
    console.log(
      "Real CORS audio fixture: playback and nonblank spectrum passed.",
    );
  } finally {
    await audioContext.close();
  }
} finally {
  await context.close();
  await browser.close();
}
function locationOrigin(value) {
  return new URL(value).origin;
}
