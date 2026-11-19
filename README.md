# Chest Log

Counts the chests you open in Fortnite from the game's own replay files, and replays every match on the map.

There are two builds from one codebase.

- **Hosted site.** A static site. A visitor picks their Fortnite `Demos` folder (or drops replay files), the replays are parsed in their browser by a WebAssembly build of the extractor, and the result is stored in that browser's IndexedDB. Nothing is uploaded.
- **Local app.** Runs on the PC you play on. A small Node server watches the `Demos` folder, counts each match seconds after it ends, and also lines up your video clips with the replays.

## Layout

| Path | What it is |
| --- | --- |
| `extractor/` | C# replay extractor. `Engine.cs` splits the work into `Parse` (one replay, cacheable) and `Complete` (all replays together). `Program.cs` is the console program; `wasm/` is the browser build of the same sources. |
| `vendor/FortniteReplayDecompressor/` | Replay parser by Shiqan (MIT), with small local changes. |
| `web/pipeline/` | Turns extractor output into what the pages show. `dataset.ts` is a pure function used by both builds. |
| `web/src/` | The React app. `src/library/` is the hosted build's in-browser import and storage. |
| `web/live/`, `web/server.mjs` | The local app's server and match tracker. |
| `web/public/engine/` | The published WebAssembly engine. Committed, because the host does not have the .NET SDK. |
| `map/` | Island image and the calibration from game coordinates to map pixels. |

## Hosted site

```bash
cd web
npm ci
npx vite build --mode hosted        # writes web/dist-hosted
node scripts/serve-hosted.mjs       # http://127.0.0.1:4180
```

Vercel builds the same thing from `vercel.json`.

Rebuild the engine after changing anything under `extractor/` or `vendor/` (needs the .NET 10 SDK with the `wasm-tools` workload in `tools/dotnet`):

```bash
extractor/build-wasm.sh
```

Checks:

- `extractor/check/` proves the console and browser builds of the extractor produce identical output.
- `npx tsx scripts/hosted-e2e.ts` (in `web/`) imports `replays/` through the real page in headless Chromium and compares the stored library with the local pipeline's output.

## Local app

`start.cmd` builds and serves it on http://127.0.0.1:4173. It needs replays in `replays/` and the console extractor built into `extractor/bin`.

## Limits

- Replays exist only for Fortnite on PC.
- Drop spot names and the map come from one island calibration (`map/calibration.json`). Replays from a season with a different island parse, but land on the wrong map.
- A teammate's chest count is what your replay saw, so it runs low when the squad splits up.

Not affiliated with or endorsed by Epic Games.
