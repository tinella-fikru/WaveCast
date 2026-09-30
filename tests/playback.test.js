import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createPlaybackController,
  streamCandidates,
} from "../src/lib/playback.js";
const station = {
  url_resolved: "https://primary.test/live",
  url: "https://alternate.test/live",
};
class AudioStub extends EventTarget {
  src = "";
  played = [];
  paused = true;
  load() {}
  play() {
    this.paused = false;
    this.played.push(this.src);
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
}
test("retry uses secure alternate, exponential delay, and stops after three retries", () => {
  const audio = new AudioStub(),
    tasks = new Map(),
    states = [];
  let next = 0;
  const controller = createPlaybackController(
    audio,
    (state) => states.push(state),
    {
      setTimer: (callback, delay) => {
        tasks.set(++next, { callback, delay });
        return next;
      },
      clearTimer: (id) => tasks.delete(id),
    },
  );
  controller.play(station);
  for (const delay of [1000, 2000, 4000]) {
    audio.dispatchEvent(new Event("error"));
    const [id, task] = [...tasks].find(([, task]) => task.delay === delay);
    tasks.delete(id);
    task.callback();
  }
  audio.dispatchEvent(new Event("error"));
  audio.dispatchEvent(new Event("pause"));
  assert.deepEqual(audio.played, [
    station.url_resolved,
    station.url,
    station.url_resolved,
    station.url,
  ]);
  assert.equal(states.at(-1), "error");
  assert.equal(tasks.size, 0);
  controller.dispose();
});
test("pause and station replacement cancel pending retries", () => {
  const audio = new AudioStub(),
    tasks = new Map();
  let next = 0;
  const controller = createPlaybackController(audio, () => {}, {
    setTimer: (callback, delay) => {
      tasks.set(++next, { callback, delay });
      return next;
    },
    clearTimer: (id) => tasks.delete(id),
  });
  controller.play(station);
  audio.dispatchEvent(new Event("error"));
  controller.pause();
  assert.equal(tasks.size, 0);
  controller.play({ ...station, url_resolved: "https://new.test/live" });
  assert.equal(audio.src, "https://new.test/live");
  controller.dispose();
  assert.equal(tasks.size, 0);
  assert.deepEqual(
    streamCandidates({ ...station, url: "http://insecure.test" }),
    [station.url_resolved],
  );
});
