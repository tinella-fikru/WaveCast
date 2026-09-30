import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeSessions, elapsedListening } from "../src/lib/insights.js";
test("insights totals and UTC streak include yesterday and distribute genres", () => {
  const result = summarizeSessions(
    [
      {
        seconds: 120,
        country: "France",
        tags: "jazz,soul,jazz",
        started_at: "2026-09-29T23:00:00Z",
      },
      {
        seconds: 60,
        country: "France",
        tags: "jazz",
        started_at: "2026-09-28T12:00:00Z",
      },
    ],
    new Date("2026-09-30T10:00:00Z"),
  );
  assert.equal(result.seconds, 180);
  assert.equal(result.streak, 2);
  assert.equal(result.days, 2);
  assert.deepEqual(result.genres, [
    { name: "jazz", minutes: 2 },
    { name: "soul", minutes: 1 },
  ]);
});
test("clock gaps from suspension do not count as listening", () => {
  assert.equal(elapsedListening(1000, 2000), 1);
  assert.equal(elapsedListening(1000, 61000), 0);
  assert.equal(elapsedListening(2000, 1000), 0);
  assert.equal(summarizeSessions([], new Date()).streak, 0);
});
