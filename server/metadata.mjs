function escapeAttribute(value) {
  return String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );
}
export function stationHtml(template, station, origin) {
  const title = `${station.name} | WaveCast`;
  const description =
    `Listen to ${station.name}${station.country ? ` from ${station.country}` : ""} on WaveCast. ${station.tags || ""}`.slice(
      0,
      300,
    );
  const url = `${origin}/station/${encodeURIComponent(station.stationuuid)}`;
  const image =
    typeof station.favicon === "string" &&
    station.favicon.startsWith("https://")
      ? station.favicon
      : `${origin}/icons/icon-512.png`;
  const tags = [
    ["og:title", title],
    ["og:description", description],
    ["og:url", url],
    ["og:image", image],
    ["og:type", "music.radio_station"],
  ]
    .map(
      ([property, value]) =>
        `<meta property="${property}" content="${escapeAttribute(value)}" />`,
    )
    .join("\n");
  return template
    .replace(/<meta\s+property="og:[^"]+"[^>]*>/g, "")
    .replace(
      /<title>[^<]*<\/title>/,
      `<title>${escapeAttribute(title)}</title>`,
    )
    .replace(
      "</head>",
      `${tags}\n<link rel="canonical" href="${escapeAttribute(url)}" />\n</head>`,
    );
}
