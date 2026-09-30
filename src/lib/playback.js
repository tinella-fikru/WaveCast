export function streamCandidates(station) {
  return [
    ...new Set(
      [station.url_resolved, station.url].filter(
        (url) => typeof url === "string" && url.startsWith("https://"),
      ),
    ),
  ];
}

export function createPlaybackController(
  audio,
  onState,
  { setTimer = setTimeout, clearTimer = clearTimeout, timeoutMs = 15000 } = {},
) {
  let urls = [],
    attempt = 0,
    generation = 0,
    timer,
    deadline,
    wanted = false,
    retryPending = false;
  function clear() {
    clearTimer(timer);
    clearTimer(deadline);
    timer = undefined;
    deadline = undefined;
  }
  function paused() {
    if (wanted && !retryPending && audio.paused) {
      wanted = false;
      clear();
      onState("paused", "");
    }
  }
  function fail() {
    if (!wanted || retryPending) return;
    clear();
    if (attempt >= 3) {
      wanted = false;
      audio.pause();
      onState("error", "This station is unavailable, try another");
      return;
    }
    const delay = 1000 * 2 ** attempt;
    attempt++;
    retryPending = true;
    audio.pause();
    onState("loading", `Reconnecting (${attempt}/3)...`);
    timer = setTimer(() => {
      retryPending = false;
      start();
    }, delay);
  }
  function watch() {
    clearTimer(deadline);
    deadline = setTimer(fail, timeoutMs);
  }
  function start() {
    if (!wanted || !urls.length) return;
    const request = ++generation;
    onState("loading", attempt ? `Reconnecting (${attempt}/3)...` : "");
    audio.src = urls[attempt % urls.length];
    audio.load();
    watch();
    audio.play().catch((error) => {
      if (request !== generation || !wanted || error.name === "AbortError")
        return;
      if (error.name === "NotAllowedError") {
        wanted = false;
        clear();
        onState("paused", "Press Play to start listening.");
      } else fail();
    });
  }
  function playing() {
    if (!wanted) {
      audio.pause();
      return;
    }
    clear();
    retryPending = false;
    onState("playing", "");
  }
  function waiting() {
    if (wanted && !retryPending) {
      onState("loading", "");
      watch();
    }
  }
  audio.addEventListener("playing", playing);
  audio.addEventListener("waiting", waiting);
  audio.addEventListener("error", fail);
  audio.addEventListener("ended", fail);
  audio.addEventListener("pause", paused);
  return {
    play(station) {
      generation++;
      clear();
      wanted = false;
      audio.pause();
      urls = streamCandidates(station);
      attempt = 0;
      retryPending = false;
      wanted = true;
      start();
    },
    pause() {
      generation++;
      wanted = false;
      retryPending = false;
      clear();
      audio.pause();
      onState("paused", "");
    },
    resume() {
      clear();
      attempt = 0;
      retryPending = false;
      wanted = true;
      start();
    },
    dispose() {
      generation++;
      wanted = false;
      clear();
      audio.pause();
      audio.removeEventListener("playing", playing);
      audio.removeEventListener("waiting", waiting);
      audio.removeEventListener("error", fail);
      audio.removeEventListener("ended", fail);
      audio.removeEventListener("pause", paused);
    },
  };
}
