export function summarizeSessions(sessions, now = new Date()) {
  let seconds = 0;
  const genres = new Map(),
    countries = new Map(),
    days = new Set();
  for (const session of sessions) {
    const duration = Math.max(0, Number(session.seconds) || 0);
    seconds += duration;
    const country = session.country || "Unknown";
    countries.set(country, (countries.get(country) || 0) + duration);
    const tags = [
      ...new Set(
        (session.tags || "")
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      ),
    ];
    for (const tag of tags.length ? tags : ["Other"])
      genres.set(
        tag,
        (genres.get(tag) || 0) + duration / Math.max(1, tags.length),
      );
    if (duration > 0)
      days.add(new Date(session.started_at).toISOString().slice(0, 10));
  }
  const cursor = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  if (!days.has(cursor.toISOString().slice(0, 10)))
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  let streak = 0;
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  const chart = (values) =>
    [...values]
      .sort((first, second) => second[1] - first[1])
      .slice(0, 6)
      .map(([name, duration]) => ({
        name,
        minutes: Math.round(duration / 6) / 10,
      }));
  return {
    seconds,
    streak,
    genres: chart(genres),
    countries: chart(countries),
    days: days.size,
  };
}

export function elapsedListening(previous, current) {
  const elapsed = current - previous;
  return elapsed > 0 && elapsed <= 5000 ? elapsed / 1000 : 0;
}
