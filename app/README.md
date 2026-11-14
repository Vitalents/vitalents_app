# Vitalents application

The browser application for the [Vitalents prototype](../README.md): daily observations, Decode, personal references, follow-ups and simulated sharing. Built with React 19, TypeScript, Vite, Dexie and Zustand.

## Start the demo

Use Node.js 22 or newer (`.nvmrc` selects 22). Run from this directory:

```bash
npm ci
npm run dev
```

Open the URL printed by Vite. The app loads a simulated scenario and keeps changes in IndexedDB on this browser. **Settings → Scenario** lets you load S1–S5; confirmation replaces the current local record. Choose **Astronaut** under **Demo role** for the main journey.

The default assistant mode is `cached`. No API key, Python service or model download is required. See the [demo guide](../docs/demo-guide.md) for a short walkthrough.

## Build and check

```bash
npm test
npm run lint
npm run build
npm run preview
```

`npm run build` checks TypeScript and writes the production app to `dist/`. Build from a Git checkout: the build records the commit in `build-info.json`.

For browser checks:

```bash
npx playwright install chromium
npm run test:e2e
```

Playwright builds the app and starts its preview server on port 4317 by default. On Linux, browser system dependencies may also be needed (`npx playwright install --with-deps chromium`). `E2E_PORT` selects another port; `E2E_SKIP_BUILD=1` reuses an already-built `dist/`.

## Offline use

The service worker is enabled in the **production build**, not the Vite development server. Visit the preview or deployed app online first and allow its assets to load. The cached shell, scenario data and recorded answers then support the demo without a network connection. External source links and an optional remote assistant still require connectivity.

An available app update is offered through a reload prompt. Loading a different scenario is a separate, confirmed action; it replaces the current local scenario data.

## Optional local assistant

Set up the service using [the assistant guide](../ai/README.md), then start Vite with:

```bash
VITE_ASSISTANT_MODE=live VITE_ASSISTANT_URL=http://localhost:8008 npm run dev
```

| Mode | Behavior |
|---|---|
| `cached` | Uses the published recorded-answer artifact; default mode |
| `live` | Calls the configured assistant service |
| `auto` | Checks service health and falls back to recorded answers |

Specify `VITE_ASSISTANT_URL` explicitly for a local `auto` setup; otherwise that mode targets the configured public assistant hostname. Cloudflare Pages builds force `cached` mode. Live answers need separate review; model availability does not establish source support or scientific accuracy.

## Code map

| Path | Responsibility |
|---|---|
| `src/features/` | Screens and their local interactions |
| `src/engine/` | Decode scoring, references, rules and scheduling |
| `src/store/` | IndexedDB records, role constraints and review recomputation |
| `src/sync/` | Simulated sharing and delivery state |
| `src/assistant/` | Recorded/live assistant clients and consult drafts |
| `src/shell/`, `src/styles/` | Navigation, reusable shell and visual tokens |
| `src/pwa/` | Offline status and update handling |
| `public/data/` | Published scenario, research, proof and answer artifacts |
| `e2e/` | Browser journeys against the production build |

The app imports shared content and contracts from the repository root. Keep the repository structure intact. Generated data should be updated through the repository scripts, with its provenance preserved. See [architecture](../docs/architecture.md), [documentation](../docs/README.md) and [evidence limits](../docs/validation.md).
