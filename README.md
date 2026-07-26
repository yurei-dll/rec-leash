# Recommendation Leash

Recommendation Leash is a Firefox-first WebExtension that keeps a local history of watched YouTube video IDs and marks watched videos when they reappear in YouTube recommendations, search results, or feed-like pages.

The MVP is intentionally local-first and diagnostic-first: watched recommendation cards receive a `WATCHED` badge by default. You can switch to dimming, hiding, or disabling the card treatment from the options page.

## Install In Firefox

1. Run `npm install`.
2. Run `npm run build`.
3. Open `about:debugging#/runtime/this-firefox`.
4. Click **Load Temporary Add-on...**.
5. Select `dist/manifest.json`.

Firefox temporary add-ons are removed when the browser restarts, so repeat the load step after a restart.

## Controls

Click the extension toolbar icon to open the quick settings popup. It includes display mode, watch-status source, and verbose logging. Use **Open full options and local data** in that popup (or Firefox's add-ons manager) for diagnostics and import/export controls.

- **Badge only**: show a visible `WATCHED` badge on matched cards.
- **Badge and dim**: badge matched cards and reduce their opacity.
- **Hide watched cards**: remove matched cards from view.
- **Disabled**: restore cards and stop applying visual changes.
- **Watch-status source**: default to the extension's 30-second actual-playback history, or also treat a card with YouTube's red resume-progress bar as watched. The latter is deliberately broad and can hide nearly every previously started video.
- **Verbose console logging**: enabled by default for the MVP. Open the YouTube tab's developer console and filter for `Recommendation Leash` to see startup, navigation, playback-threshold, scan, match, and mutation activity.

The options page also shows:

- local watched-record count
- last page/session card diagnostics: scanned, matched, modified
- last recorded video
- export/import for Recommendation Leash JSON
- confirmed local-history clearing

## Privacy Model

Recommendation Leash stores all watch history locally in the extension's IndexedDB database. It does not use the YouTube Data API, private YouTube APIs, account automation, cookies, credentials, comments, or browsing history outside matched YouTube pages.

Requested permissions are deliberately small:

- `storage` for settings and lightweight diagnostics
- YouTube page matches for the content script

## How Recording Works

The content script watches normal YouTube `/watch?v=...` URLs, including SPA navigation events and URL changes. It records a video only after about 30 seconds of actual playback time from the page's `<video>` element. Merely rendering links, thumbnails, previews, or recommendation cards does not create a watched record. Optionally, card treatment can also use YouTube's visible red resume-progress overlay without adding that video to local history. This recognizes both the older overlay and YouTube's newer progress-segment markup, including full (100%) bars, while ignoring zero-width segments.

Each watched record stores:

- video ID
- first and last observed timestamps
- title, when available
- channel, when available
- source
- optional playback progress

## Storage Choice

Watched-video history uses IndexedDB instead of `browser.storage.local`. A YouTube watch history can grow to tens or hundreds of thousands of records, and IndexedDB is better suited to that shape of data in Firefox extensions. Settings and diagnostics remain in `browser.storage.local` because they are tiny and convenient.

The store is behind `HistoryStore` in `src/shared/history-store.ts`, so a later storage implementation can replace IndexedDB without changing the observers or card filter.

## Architecture

- `src/shared/video-id.ts`: URL and video-ID parsing
- `src/shared/history-store.ts`: local watched-video storage and deduplication
- `src/content/watch-observer.ts`: YouTube watch-page and playback-threshold observation
- `src/content/watch-threshold.ts`: conservative playback-time state machine
- `src/content/card-adapter.ts`: centralized YouTube recommendation-card recognition
- `src/content/card-filter.ts`: debounced MutationObserver processing and reversible card mutations
- `src/shared/settings.ts`: display mode settings
- `src/shared/diagnostics.ts`: options/debug data
- `src/shared/import-export.ts`: JSON export/import plus a representative Takeout importer boundary
- `src/options/options.ts`: options and debug UI

## Tests

Run:

```sh
npm test
```

The suite uses fixtures and JSDOM. It does not depend on live YouTube or network access.

Covered areas:

- YouTube URL/video-ID extraction
- watched-record deduplication
- playback threshold state
- settings normalization
- Recommendation Leash JSON import/export
- representative Google Takeout fixture parsing
- recommendation-card shapes, duplicate links, unrelated links, dynamic insertions
- idempotent rescanning
- restoring cards when settings change

## Build

Run:

```sh
npm run build
```

The build typechecks with TypeScript and bundles the content script/options script with `esbuild` into `dist/` so Firefox can load the unpacked extension from `dist/manifest.json`.

## Known Selector Fragility

YouTube changes its DOM often. The adapter primarily extracts video IDs from ordinary `/watch?v=` anchors, then centralizes container selection in `src/content/card-adapter.ts`. If a manual test shows a card shape that is missed or over-selected, update that adapter and add a fixture test.

The MVP avoids Shorts and playlist/channel links. Live streams are not specially classified yet; if they use normal watch URLs and pass the playback threshold, they may be recorded.

## Future Google Takeout Work

The importer boundary is `HistoryImporter` in `src/shared/import-export.ts`. The current project includes a small representative JSON Takeout parser for fixture-based validation, but full Takeout ingestion is future work.

Planned flow:

1. User downloads YouTube watch history from Google Takeout.
2. User imports the exported local file manually through the options page.
3. The importer parses recognized Takeout formats into local `WatchedVideoRecord` values.
4. Records are deduplicated through `HistoryStore.importRecords`.

Recommendation Leash will not sign into Google, automate Google account pages, create API credentials, or call private YouTube endpoints.
