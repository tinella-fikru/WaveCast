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
2. Run [the migration](supabase/migrations/202609300001_wavecast.sql) once in the Supabase SQL editor, or apply it with the Supabase CLI.
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

## Data and security

Both tables use row-level security. Favorites are readable/writable only by their owner. History is readable/deletable only by its owner; inserts go through `record_recent_station`, which derives the user from `auth.uid()` rather than accepting a user ID. A per-user transaction lock serializes writes and trims history to 20 entries. Anonymous database access is revoked. Station URLs have a database HTTPS constraint.

The history function uses `security definer` with an empty search path, schema-qualified references, and authenticated-only execution. Onboarding completion is stored in user metadata, not used for authorization.

Radio directory metadata and live stream availability are controlled by third parties. A secure source URL can still redirect to HTTP or use a codec unsupported by a browser; those streams show the friendly unavailable state. Browsers/operating systems may suspend background tabs, so sleep timers are best-effort while suspended and recheck their deadline when the tab resumes. Mobile hardware may control the actual output volume.

## Track metadata

The player accepts an optional `metadataProvider` prop implementing `MetadataProvider` from [src/types.ts](src/types.ts): `subscribe(station, onTitle)` returns an unsubscribe function. Publish a track title with `onTitle(title)` or request the fallback with `onTitle(null)`. Providers must release resources when unsubscribed. The adapter ignores late callbacks after cancellation, and titles are scoped to their station to prevent stale updates after switching.

The default provider in [src/lib/metadata.js](src/lib/metadata.js) uses `icecast-metadata-js` for ICY parsing. During playback it requests `Icy-MetaData: 1`, reads the exposed `icy-metaint` header, and probes for metadata every 30 seconds. Each probe has a 10-second timeout and a 256 KiB parsing budget; it closes the auxiliary connection after reading metadata. These requests use some additional bandwidth but never replace or modify the HTML5 audio stream. Pausing, buffering, changing stations, and unmounting stop the subscription.

Stations must allow browser CORS requests (including the `Icy-MetaData` header) and expose `icy-metaint`. Blocked requests, missing/invalid headers, missing titles, and parsing failures do not show a metadata error or interrupt playback. Unsupported stations stop probing until playback resumes. HLS timed metadata and server-side metadata proxies are not included. Polling is best-effort and may differ slightly from the audio buffer's timing; a future provider can replace it with a station API or server-side feed.

## Deployment

Deploy the `dist` output from `npm run build` to any static host. Configure a SPA fallback that serves `index.html` for app routes such as `/browse`, `/favorites`, `/recent`, and `/login`. Provide the two public Supabase environment variables at build time. Use HTTPS in production.

## Verification

`npm test` covers HTTPS filtering, deduplication, directory failover, pagination, and request cancellation. `npm run build` runs TypeScript checks and the production bundler. Auth and RLS integration require a configured Supabase project; validate two accounts cannot access each other's favorites/history before production use.

Streams are provided by the stations. Station data from [Radio Browser](https://www.radio-browser.info/). Photography from Unsplash.
