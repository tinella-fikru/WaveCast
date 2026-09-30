# WaveCast

A responsive, dark-first world radio app built with React, TypeScript, Vite, and Supabase. Radio Browser provides live directory data without an API key. Guest listening works without a Supabase project.

## Run locally

Requires Node.js 20.19+ or 22.12+ and npm.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite (usually http://localhost:5173).

```sh
npm test
npm run build
npm run preview
```

## Connect Supabase

1. Create a Supabase project and enable the Email provider in Authentication.
2. Apply both migrations in order: [favorites/history](supabase/migrations/202609300001_wavecast.sql), then [collections/insights](supabase/migrations/202609300002_collections_insights.sql). Use the Supabase SQL editor or CLI. Existing projects should apply only the new migration.
3. Create a local `.env` from [.env.example](.env.example). Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to your project URL and publishable/anon key. Never use a service-role key in a browser app.
4. Set Authentication > URL Configuration > Site URL to your deployed origin. Add your local origin (for example `http://localhost:5173`) and production origin to the allowed redirect URLs.
5. Restart Vite. Create an account, confirm the email if confirmation is enabled, and sign in.

The app intentionally does not simulate authentication when credentials are absent. The sign-in form explains that account services are not connected; Continue as guest remains available.

## Included

- Home discovery, live genre selection, country discovery, URL-addressable browse filters, and load-more pagination.
- HTTPS-only station streams, fallback logos, skeletons, retry and empty states. Directory calls retry the DE, AT, and NL servers with per-server timeouts and cancellation.
- A single persistent HTML5 audio element; no page-load autoplay. Play/pause, buffering feedback, stream error recovery, volume, mute, Media Session controls, and 15/30/60-minute sleep timers.
- A best-effort ICY "Now playing" line, with station name and tags as a quiet fallback. Available track titles also appear in Media Session metadata.
- Email/password signup and sign-in, favorites, and the last 20 recently played stations per account.
- Dark/light themes and accessible first-run onboarding, with a per-user metadata flag and localStorage fallback. Replay is available in the sidebar.
- Self-hosted fonts, responsive layouts, reduced-motion support, and keyboard focus indicators.
- Leaflet/OpenStreetMap country explorer with country counts, clickable boundaries, a searchable country list, and clustered HTTPS station locations. Country pages show stations by popularity.
- Installable PWA with 192/512px and maskable icons, an install action when supported, and an offline page. Audio streams and API responses are never cached.
- Signed-in Home rows for recent plays and recommendations sharing a tag or country with the last five stations. Older history records are rehydrated from the directory.
- Named collections with create/rename/delete, add/remove stations, and keyboard-accessible move-up/down ordering. Add stations from their individual station pages.
- Station deep links at `/station/:uuid`, native sharing with clipboard/manual-link fallback, and crawler-readable Open Graph through the included production server.
- Space play/pause, M mute, Up/Down volume, / search, F favorite, and ? shortcut help. Text fields and interactive controls retain their native keyboard behavior.
- HTTPS alternate-stream recovery with at most three retries after 1/2/4 seconds, a 15-second connection deadline, retry action, external broken-stream report, and similar stations.
- Opt-in Web Audio spectrum with an equalizer fallback and personal Recharts listening insights.

## Data and security

All five tables use row-level security. Favorites are readable/writable only by their owner. History is readable/deletable only by its owner; inserts go through `record_recent_station`, which derives the user from `auth.uid()` rather than accepting a user ID. A per-user transaction lock serializes writes and trims history to 20 entries. Anonymous database access is revoked. Station URLs have a database HTTPS constraint.

Collection entries have a composite foreign key to their owner's collection. Add/reorder RPCs lock the parent collection and validate ownership; reordering validates the complete station set. Listening sessions use an authenticated, owner-derived RPC with bounded durations and idempotent cumulative updates. The public anon/publishable key is expected in the browser; RLS is the security boundary.

The history function uses `security definer` with an empty search path, schema-qualified references, and authenticated-only execution. Onboarding completion is stored in user metadata, not used for authorization.

Radio directory metadata and live stream availability are controlled by third parties. A secure source URL can still redirect to HTTP or use a codec unsupported by a browser; those streams show the friendly unavailable state. Browsers/operating systems may suspend background tabs, so sleep timers are best-effort while suspended and recheck their deadline when the tab resumes. Mobile hardware may control the actual output volume.

## Track metadata

The player accepts an optional `metadataProvider` prop implementing `MetadataProvider` from [src/types.ts](src/types.ts): `subscribe(station, onTitle)` returns an unsubscribe function. Publish a track title with `onTitle(title)` or request the fallback with `onTitle(null)`. Providers must release resources when unsubscribed. The adapter ignores late callbacks after cancellation, and titles are scoped to their station to prevent stale updates after switching.

The default provider in [src/lib/metadata.js](src/lib/metadata.js) uses `icecast-metadata-js` for ICY parsing. During playback it requests `Icy-MetaData: 1`, reads the exposed `icy-metaint` header, and probes for metadata every 30 seconds. Each probe has a 10-second timeout and a 256 KiB parsing budget; it closes the auxiliary connection after reading metadata. These requests use some additional bandwidth but never replace or modify the HTML5 audio stream. Pausing, buffering, changing stations, and unmounting stop the subscription.

Stations must allow browser CORS requests (including the `Icy-MetaData` header) and expose `icy-metaint`. Blocked requests, missing/invalid headers, missing titles, and parsing failures do not show a metadata error or interrupt playback. Unsupported stations stop probing until playback resumes. HLS timed metadata and server-side metadata proxies are not included. Polling is best-effort and may differ slightly from the audio buffer's timing; a future provider can replace it with a station API or server-side feed.

## Deployment

### GitHub Pages

The GitHub Actions workflow deploys `main` to https://tinella-fikru.github.io/WaveCast/.
In repository Settings > Pages, select GitHub Actions as the source. The workflow sets
`VITE_BASE_PATH=/WaveCast/` and `VITE_SITE_URL=https://tinella-fikru.github.io/WaveCast/`.
Only the Supabase publishable browser key is included; RLS protects account data.
GitHub Pages uses the generated `404.html` for direct SPA routes (the page renders,
but GitHub returns HTTP 404 for those deep links). Server-rendered station previews
require the Express deployment described below and are not available on Pages.

Set Supabase Authentication > URL Configuration > Site URL to the public URL above,
and allow `https://tinella-fikru.github.io/WaveCast/**`. `VITE_SITE_URL` controls both
signup and resend confirmation redirects, including signup from local development.
Already-sent emails retain their old URL: enter the account email on the sign-in page
and choose **Resend confirmation email**, then use the newest message. Expired or
already-used confirmation links cannot be reused. If an old link already confirmed
the account, sign in normally on the public site.

Build with the two public Supabase environment variables and deploy behind HTTPS. For station-specific social previews, use the included Express server:

```sh
npm run build
npm start
```

It listens on `PORT` (default 5189). Set `PUBLIC_ORIGIN` to your canonical HTTPS origin in production. The server renders station name, description, URL, and image into the initial HTML, escapes directory values, and serves the SPA for other routes. Directory lookup failure falls back to generic app metadata. Share previews still depend on crawler reachability and station image availability.

Static deployment of `dist` is also supported with an `index.html` SPA fallback for `/browse`, `/countries`, `/countries/:countryName`, `/station/:uuid`, `/favorites`, `/recent`, `/collections`, `/insights`, and `/login`. Static-only hosting has generic previews for non-JavaScript crawlers; the client updates metadata only after loading. Restart the production server after rebuilding, since its HTML template is loaded at startup.

### PWA and offline behavior

Service workers are enabled only in production builds. Use `npm start` or `npm run preview` to test them, on HTTPS or localhost. The worker precaches only built scripts, styles, fonts, icons, and the offline document. Navigation is network-first, falling back to "You're offline, reconnect to keep listening". Neither radio audio, API responses, station logos, map tiles, nor photography are runtime-cached. New workers activate after existing app windows close, avoiding forced reloads during playback. Installation prompts depend on browser eligibility; Safari users can use the browser's Add to Home Screen action.

### Listening insights and visualizer

Sessions count only controller-confirmed playback. They stop during buffering/pause and save cumulative seconds every 30 seconds and on playback transitions. Duplicate writes do not double-count. UTC midnight starts a new session; a streak can end today or yesterday. Genre time is distributed across a station's tags, while country time is counted in full. Missing metadata is grouped as Other/Unknown. Charts include readable data tables and load only on the insights route.

Tracking is best-effort, not billing-grade: suspended timers longer than five seconds are not counted, network errors can lose an unsaved segment, and abrupt tab/device shutdown can lose the last checkpoint. Page-exit flushing is best-effort. Multiple listening tabs can count independently. No history is backfilled into listening time. Supabase connection and actual account flows still require deployment verification.

The visualizer opens a separate CORS-enabled audio connection routed through a zero-gain node. This consumes additional stream bandwidth while enabled but protects the main audio from CORS-induced muting. Unsupported/blocked analysis falls back to the equalizer. Metadata uses its own bounded probes as described above. Browser audio support and autoplay policy still apply.

Broken-stream reports open a prefilled issue on Radio Browser's community data project. The user reviews/submits it there; WaveCast does not claim to submit a report automatically. A GitLab account may be required.

### Implementation challenges

- Mixed content: filter insecure directory streams and alternatives before playback; browser security still controls redirected resources.
- Autoplay: only explicit user actions start audio; a browser rejection returns to a recoverable paused state.
- CORS: audio playback, ICY metadata, and Web Audio have different access requirements; metadata/analysis failures never replace the main stream.
- Geography: packaged Natural Earth boundaries join directory country codes; small territories missing from the boundary dataset remain available in the country list. Counts include the whole directory, whereas playable results require HTTPS.

## Verification

`npm test` covers HTTPS filtering, deduplication, failover, pagination, cancellation, ICY metadata, recovery/backoff, recommendation queries, UTC stats, and escaped Open Graph output. PGlite tests execute both migrations against PostgreSQL and check cross-account isolation, collection ordering, cascades, and idempotent time updates. `npm run build` runs TypeScript and the production bundler.

With the production server running, `npm run test:browser` runs Playwright checks. Install Chromium with `npx playwright install chromium`, or set `BROWSER_CHANNEL=msedge` to use installed Edge (`$env:BROWSER_CHANNEL='msedge'` in PowerShell). Optional `TEST_ORIGIN` defaults to `http://localhost:5189`. The script uses controlled directory responses, verifies keyboard/dialog behavior, clipboard sharing, persistent playback, guest routes, 320/390/768/1440px geometry, dark/light station-view axe scans, offline asset-only caching, and real decoded WAV audio driving a nonblank spectrum. Screenshots are written under ignored `test-results/`.

Live Supabase signup/sign-in and authenticated UI flows have not been verified without project credentials. The database tests do not replace deployed two-account checks. Browser automation does not constitute a complete screen-reader audit or a verified native installation, and no Lighthouse score is claimed.

Streams are provided by the stations. Station data from [Radio Browser](https://www.radio-browser.info/). Photography from Unsplash.
