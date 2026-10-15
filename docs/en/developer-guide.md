# Developer Guide

This guide is for developers who want to contribute to IO-Darts-Agent or create their own modules.

---

## Table of Contents

1. [Setting Up Development Environment](#setting-up-development-environment)
2. [Project Structure](#project-structure)
3. [Backend Development](#backend-development)
4. [Frontend Development](#frontend-development)
5. [Developing Modules](#developing-modules)
6. [Testing](#testing)
7. [Build & Release](#build--release)
8. [Architecture](#architecture)
9. [Event System](#event-system)
10. [AI Provider System](#ai-provider-system)

---

## Setting Up Development Environment

### Prerequisites

| Tool | Version | Note |
|------|---------|------|
| **Node.js** | 22+ | [Download](https://nodejs.org/) |
| **npm** | Comes with Node.js | |
| **Git** | Current | [Download](https://git-scm.com/) |
| **ffmpeg** | On `PATH` | Only needed for the AI animation generator (transparent WebM export) |

### Clone Project

```bash
git clone https://github.com/Castorio/io-darts-agent.git
cd io-darts-agent
```

### Install Dependencies

```bash
npm run setup       # installs all dependencies, builds the module SDK
npm run build:app   # backend, web UI and Game Display UI
npm start
```

This is the same sequence as in the [installation guide](installation.md#install-from-source). For development, use `npm run dev` instead of `npm start` (see below).

### Start Development Server

```bash
# Backend only (tsx watch, hot-reload on save)
npm run dev

# Backend + web UI dev server (separate terminals)
npm run dev              # Terminal 1 - backend on :3000
cd web && npm run dev     # Terminal 2 - Vite dev server on :5173, proxies /api and /module-ui to :3000
```

The backend listens on `http://localhost:3000` by default. The `PORT` environment variable only applies before setup; after the setup wizard the port comes from `server.port` in `hub.config.json`.

**Data directories differ between the two start modes.** All runtime paths are resolved relative to the directory of `main`:

| Start | Code runs from | Config and data |
|-------|----------------|-----------------|
| `npm run dev` (tsx) | `src/main.ts` | `config/`, `data/`, `media/` and `modules_installed/` in the repository root |
| `npm start` | `dist/src/main.js` | `dist/config/`, `dist/data/`, `dist/media/` and `dist/modules_installed/` |

Both modes therefore have their own configuration and run their own setup wizard. With `npm run dev` the hub does not serve the web UI; use the Vite dev server (`cd web && npm run dev`, `http://localhost:5173`).

---

## Project Structure

```
AutodartsClient/
├── src/                    # Backend TypeScript source
│   ├── main.ts             # Entry point: builds the Fastify server, wires routes and modules
│   ├── index.ts
│   ├── api/                 # Fastify server, routes, auth middleware
│   │   ├── Server.ts        # APIServer class: plugins, local-origin check, sessions
│   │   ├── middleware/auth.ts
│   │   └── routes/          # One file per resource (see docs/en/api.md)
│   ├── core/
│   │   ├── auth/            # AuthService - logs in with the official Autodarts account API
│   │   ├── socket/           # SocketTicket, SocketService, EventParser (board WebSocket)
│   │   ├── events/           # EventBus, EventSystem (pub/sub for parsed events)
│   │   ├── intents/           # IntentBus, IntentEmitter, ModuleIntentHandler, templateResolver
│   │   ├── modules/           # ModuleManager, ModuleBridge, ModuleProtocol, ModuleInstaller,
│   │   │                      # ModuleHandlerFactory, ModuleRouteRegistry, ModuleI18n, handlers/
│   │   ├── ai/                # AIProviderService, AIProviderInitializer, providers/
│   │   ├── media/             # MediaService, AnimationGeneratorService, providers/
│   │   ├── match/             # MatchStatusService
│   │   ├── players/           # PlayerService, PlayerRepository
│   │   ├── config/            # ConfigService (reads/writes dist/config/*.json)
│   │   ├── tts/, audio/       # small shared helpers
│   ├── i18n/                 # I18nService + locales/ for the hub UI translations
│   └── types/                 # Shared TypeScript types (api.ts, index.ts, modules.ts, ...)
├── web/                     # Vue 3 web interface
│   ├── src/
│   ├── dist/                 # Compiled frontend (served by the backend)
│   └── vite.config.ts
├── modules/                 # Built-in modules (each with its own package.json)
│   ├── wled/
│   ├── game-display/         # Has its own Vue frontend under web/
│   └── darts-caller/
├── modules_installed/       # Modules installed from Git or a local path (symlinks)
├── module-sdk/              # @autodarts-hub/module-sdk - base class for process modules
├── electron/                 # Electron main process (desktop app)
├── config/                   # Local runtime configuration (gitignored)
├── build/                    # Build assets (icons, etc.)
├── scripts/
│   └── linux/                 # systemd service + kiosk launcher for a dedicated board PC
├── test/                     # Vitest unit/integration tests (src/**/*.test.ts, test/**/*.test.ts)
├── tests/                    # Manual Playwright E2E specs run against a live hub
├── dist/                     # Compiled backend output and runtime config at dist/config/
└── docs/                     # This documentation
```

---

## Backend Development

### Technology Stack

- **Runtime**: Node.js 22+
- **Language**: TypeScript (strict mode), compiled with `tsc`
- **Framework**: [Fastify](https://fastify.io/) with `@fastify/cors`, `@fastify/cookie`, `@fastify/static`, `@fastify/websocket`, `@fastify/multipart`
- **Autodarts connection**: `ws` (raw WebSocket client) plus a custom auth/ticket flow against the official Autodarts account and board APIs
- **Logging**: `pino-pretty`

### Important Files

| File | Description |
|------|-------------|
| `src/main.ts` | Entry point; builds the hub, registers all routes and module wiring |
| `src/api/Server.ts` | Fastify instance, CORS/local-origin check, sessions |
| `src/api/middleware/auth.ts` | Global `onRequest` auth gate (see [API Documentation](api.md#authentication)) |
| `src/core/auth/AuthService.ts` | Logs in with the Autodarts account and keeps the access token fresh |
| `src/core/socket/SocketTicket.ts`, `SocketService.ts` | Gets a board socket ticket and connects to the Autodarts board WebSocket |
| `src/core/socket/EventParser.ts` | Converts raw Autodarts WebSocket messages into typed `ParsedEvent`s, including the synthetic events |
| `src/core/events/EventBus.ts` | In-process pub/sub that routes `ParsedEvent`s to modules and the WebSocket API |
| `src/core/intents/IntentBus.ts` | Module-to-module messaging (see [Module SDK](module-sdk.md#intent-system)) |
| `src/core/modules/ModuleManager.ts` | Loads manifests, starts/stops/installs/updates modules |
| `src/core/modules/ModuleBridge.ts`, `ModuleProtocol.ts` | Unix-socket IPC protocol used to talk to modules that run as a separate process |
| `src/core/modules/handlers/index.ts` | Re-exports the in-process handler classes that live in `modules/wled/src/`, `modules/game-display/src/`, `modules/darts-caller/src/` |
| `src/core/ai/AIProviderService.ts` | Registry and dispatch for AI providers |
| `src/core/media/MediaService.ts`, `AnimationGeneratorService.ts` | Media library storage, and AI animation generation jobs |

### API Endpoints

See the full [API Documentation](api.md) for every route, its body/query fields, and its authentication requirement. In short:

| Area | Base path |
|------|-----------|
| Setup & auth | `/api/setup/*`, `/api/auth/*` |
| Status & settings | `/api/status`, `/api/settings`, `/api/autodarts/*` |
| Match | `/api/match/*` |
| Modules & intents | `/api/modules/*`, `/api/intents*` |
| Players | `/api/players/*` |
| AI providers | `/api/ai/*` |
| Animation generator | `/api/animations/*` |
| Media library | `/api/media/*` |
| TTS & voice packs | `/api/tts/*` |
| Darts Caller | `/api/caller/*` |
| Autodarts Trainer | `/api/trainer/*` |
| Developer/simulation | `/api/developer/*` |
| Live events & logs | `/api/events` (WebSocket), `/api/logs` |

### Build

```bash
# Compile TypeScript (src/ -> dist/)
npm run build
```

---

## Frontend Development

### Technology Stack

- **Framework**: Vue 3 (Composition API, `<script setup>`)
- **Build**: Vite
- **Styling**: Tailwind CSS
- **State**: Pinia
- **Router**: Vue Router
- **i18n**: vue-i18n, 10 locales (`de`, `en`, `es`, `fr`, `it`, `ja`, `nl`, `ru`, `uk`, `zh`); German and English are complete, the rest partially translated
- **Icons**: inline SVG, no icon library

### Development

```bash
cd web

# Dev server with hot-reload on :5173, proxies /api and /module-ui to :3000
npm run dev

# Production build
npm run build

# Type check (vue-tsc)
npm run type-check
```

### Component Structure

```
web/src/
├── App.vue                 # Root component
├── main.ts                 # Vue app entry
├── router/                 # Vue Router configuration
├── api/                    # Typed fetch wrappers for the hub API
├── stores/                 # Pinia stores: app.ts, events.ts, modules.ts, players.ts, index.ts
├── views/                  # Pages, e.g. DashboardView.vue, ModulesView.vue, PlayersView.vue,
│                            # SetupView.vue, SettingsView.vue, AISettingsView.vue,
│                            # AnimationGeneratorView.vue, MediaLibraryView.vue, LogsView.vue
├── components/              # Reusable components (BaseCard.vue, ModuleConfigCard.vue, ...)
│   └── config/               # Config field renderers (DynamicConfigForm.vue and friends)
├── i18n/
│   ├── index.ts
│   └── locales/              # de.ts, en.ts, es.ts, fr.ts, it.ts, ja.ts, nl.ts, ru.ts, uk.ts, zh.ts
├── types/
├── utils/
└── assets/                  # Static assets
```

---

## Developing Modules

See [Developer Quick Start](developer-quickstart.md) for a quick introduction.

See [Module SDK](module-sdk.md) for complete API documentation.

### Module Types

A module's `module.json` declares an `entry`:

| `entry` value | Behavior |
|---------------|----------|
| `"internal"` | No separate process. The manifest only drives the UI (config form, event/intent pickers) - behavior has to be wired into the hub directly. |
| a file path, e.g. `"dist/index.js"` | The hub spawns `node <path>` as a child process and talks to it over a Unix domain socket, using the `@autodarts-hub/module-sdk` package's `AutodartsModule` base class. |

**Exception:** the three built-in modules WLED, Game Display, and Darts Caller are always loaded in-process by module ID, regardless of what their `entry` says (their manifests still say `"dist/index.js"` from an earlier architecture, but that path is never actually spawned). Their handler classes live in each module's own `src/` and are re-exported through `src/core/modules/handlers/index.ts`. A newly installed module does not get this special treatment - give it `entry: "internal"` only if you intend to fork the hub itself, otherwise use a process entry point with the module SDK.

### Built-in Modules

| Module | Description | Features |
|--------|-------------|----------|
| **WLED** (`modules/wled/`) | LED lighting control | Player colors, effects/presets, fade time, duration-based actions with color restore, intent actions |
| **Game Display** (`modules/game-display/`) | Score display | Own Vue.js frontend, checkout suggestions, per-event and per-player animations |
| **Darts Caller** (`modules/darts-caller/`) | Voice announcements | Browser TTS, ElevenLabs live TTS, voice packs, audio file packs, Voice Pack Generator |
| **Autodarts Trainer** (separate repository, not included) | Practice routines | Own REST endpoints under `/api/trainer/*`, built-in and custom routines, history/stats |

### Example Modules

- **WLED** (`modules/wled/`) - controls external hardware over HTTP
- **Game Display** (`modules/game-display/`) - custom Vue.js frontend served at `/module-ui/game-display/`
- **Darts Caller** (`modules/darts-caller/`) - Voice Pack Generator and multiple output backends

---

## Testing

### Unit & Integration Tests (Vitest)

Test files live in `src/**/*.test.ts` and `test/**/*.test.ts` (see `vitest.config.ts`); `test/` mirrors the source layout with `api/`, `core/`, `integration/`, `mocks/`, `modules/`, and `packaging/` subfolders.

```bash
# Watch mode
npm test

# Run once (CI mode)
npm run test:unit
# equivalent to:
npx vitest run

# With coverage (v8 provider, 80% threshold for lines/functions/branches/statements)
npm run test:coverage
```

### End-to-End Specs (Playwright)

`tests/*.spec.ts` are Playwright specs that drive a running hub at `http://localhost:3000` through the browser (e.g. checking that a module's intent section renders). There is no committed `playwright.config.ts` and no `npm` script for them; run a specific spec manually against a running dev server:

```bash
npm run dev            # in one terminal
npx playwright test tests/test-intents.spec.ts
```

---

## Build & Release

### Local Build

```bash
# Compile backend
npm run build

# Build web UI
npm run build:frontend

# Build the Game Display UI
npm run build:modules

# All three together
npm run build:app
```

### Desktop App (Electron)

`electron/main.cjs` starts the hub (`dist/src/main.js`) as a child process with the Electron binary in Node mode (`ELECTRON_RUN_AS_NODE=1`), so the package needs no system Node.js. It passes `IO_DARTS_DATA_DIR` (per-user app data folder), `IO_DARTS_SUPERVISED=1` and `PORT` (from `IO_DARTS_PORT`, default 3000). If the hub exits with code 75 (restart request), Electron starts it again; any other exit shows an error and closes the app.

Runtime data paths come from `src/core/runtimePaths.ts` (`runtimePath()`): `IO_DARTS_DATA_DIR` if set, otherwise `dist/` as before. Read-only assets (`web/dist`, the built-in modules in `modules/`) stay resolved relative to the code.

The app is packaged without asar (`asar: false` in `electron-builder.yml`): the backend runs as a separate Node process with the ESM loader, reads `web/dist` and `modules/*/module.json` through plain file paths and symlinks the built-in modules into the data folder. Runtime data from a local `dist/` (`dist/config` and others) is excluded from the package.

```bash
npm run setup               # once: dependencies
npm run build:app           # backend, web UI, Game Display UI
npm run electron:dev        # build + run Electron locally
npm run dist:mac            # build:app + electron-builder --mac   -> releases/
npm run dist:linux          # build:app + electron-builder --linux -> releases/
npm run dist:win            # build:app + electron-builder --win   -> releases/
npm run dist:all            # all three
npx electron-builder --mac --dir   # unpacked app only, faster for testing
```

The `dist*` scripts are aliases for the `electron:build*` scripts. Only the macOS build has been tested. Code signing and notarization are not configured (macOS falls back to an ad hoc signature). The former pkg scripts (`build:linux`, `build:macos`, `build:windows`, `build:all`) have been removed; pkg does not support Node.js 22.

### Linting

```bash
npm run lint       # eslint src --ext .ts
npm run lint:fix
```

---

## Architecture

### Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Electron (optional)                    │
│  Starts the backend as a child process, shows it in a window  │
│  with a system tray icon. Running the backend directly with   │
│  `npm start` / `node dist/src/main.js` works the same way.    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Node.js Backend (Fastify)                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  REST API    │  │  WebSocket   │  │  Module Manager   │  │
│  │  /api/*      │  │  /api/events │  │  + IPC bridge      │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│         │                  │                   │            │
│         └──────────────────┼───────────────────┘            │
│                            ▼                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │        AuthService + SocketService + EventParser         │ │
│  │  Logs in with the Autodarts account, opens the board     │ │
│  │  WebSocket, turns raw messages into typed events          │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        Autodarts.io                           │
└─────────────────────────────────────────────────────────────┘
```

### Event Flow

```
Autodarts -> board WebSocket -> EventParser -> EventBus -> Module Manager -> Modules
                                     │                            │
                                     │ generates synthetic events  └──> in-process handlers
                                     │ (player.change, turn.finished,     or IPC to module processes
                                     │  game.finished, match.finished)
                                     └──> WebSocket API -> hub UI, module UIs
```

### Native vs Synthetic Events

`EventParser` forwards some Autodarts messages largely unchanged ("native") and derives others from `match.state` updates ("synthetic"):

| Event Type | Source | Description |
|------------|--------|-------------|
| `board.state`, `board.event` | Native | Board connection and other raw board events |
| `match.start`, `match.delete`, `match.finish` | Native | Match lifecycle messages from Autodarts |
| `match.state` | Native | Every match state update |
| `throw.detected` | Native | A dart is scored |
| `takeout.started`, `takeout.finished` | Native | Darts are being/have been pulled |
| `player.change` | Synthetic | Generated when the active player index changes |
| `turn.finished` | Synthetic | Generated after 3 darts, a bust, or a round change |
| `game.finished`, `match.finished`, `match.result` | Synthetic | Generated when a leg/match ends |

This allows modules to react to logical events without parsing raw `match.state`. See [API Documentation](api.md#autodarts-events) for the full list with payload fields.

### Module Sandbox

Process-type modules run as isolated child processes, each with its own Unix domain socket:

```
Backend
   │
   ├── Module 1 (subprocess, module-sdk IPC)
   │      └── Unix socket
   │
   ├── Module 2 (subprocess, module-sdk IPC)
   │      └── Unix socket
   │
   └── WLED / Game Display / Darts Caller (in-process handlers, no subprocess)
```

### Authentication

Two independent layers (see [API Documentation](api.md#authentication) for the exact per-route behavior):

1. **Local-only by default.** `src/api/Server.ts` rejects any request whose `Origin` header does not resolve to a local/private address, both at the CORS layer and with an explicit `onRequest` check. The hub is not meant to be reachable from outside the LAN.
2. **Optional web login.** A global `onRequest` hook (`src/api/middleware/auth.ts`) answers every `/api/*` route except `/api/setup/*` with 403 until setup is completed (the web UI with the setup wizard still loads). After setup, if "web auth" is enabled in settings, it requires a valid `autodarts_session` cookie for everything except a short list of always-public routes (`/health`, `/api/auth/session`, `/api/auth/login`, `/api/setup/status`).

The Autodarts connection itself is separate from web auth: `AuthService` logs in to the official Autodarts account API with the email/password/board ID collected in the setup wizard, independent of whether the hub's own web login is turned on.

---

## Code Style

### TypeScript

- **Strict mode** enabled
- **ESLint** for linting (`npm run lint`)
- No `any` types where avoidable

### Vue

- **Composition API** (not Options API)
- **`<script setup>`** syntax
- **TypeScript** for all components

### Commits

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new WLED effect
fix: resolve connection timeout issue
docs: update installation guide
chore: upgrade dependencies
```

---

## Help & Support

- **Issues**: GitHub Issues for bugs and features
- **Discussions**: GitHub Discussions for questions
- **Code Reviews**: PRs are reviewed before merging

---

## Event System

### EventParser

`src/core/socket/EventParser.ts` reads raw messages from the Autodarts board WebSocket and:

1. Emits native events largely unchanged (`board.state`, `match.start`, `throw.detected`, ...).
2. Analyzes each `match.state` update to also emit the synthetic events (`player.change`, `turn.finished`, `game.finished`, `match.finished`, `match.result`) described above.

### Module Handlers

The three in-process built-in modules each have a handler class that lives in the module's own folder and is re-exported through `src/core/modules/handlers/index.ts`:

| Handler | Module | Key Features |
|---------|--------|---------------|
| `modules/wled/src/WledHandler.ts` | WLED | HTTP calls to the WLED JSON API, player colors, fade time, duration-based color restore, derives throw sub-keys (`throw.triple`, `throw.180`, ...) from `throw.detected` |
| `modules/game-display/src/GameDisplayHandler.ts` | Game Display | Serves config/state to the Vue frontend under `/module-ui/game-display/` |
| `modules/darts-caller/src/DartsCallerHandler.ts` | Darts Caller | TTS/audio playback dispatch, Voice Pack Generator, ElevenLabs integration |

Process-type modules instead extend `AutodartsModule` from `@autodarts-hub/module-sdk` and implement `onInit`/`onEvent`/`onConfigUpdate`/`onShutdown` (see [Module SDK](module-sdk.md)).

### Autodarts Array Rotation on Leg Changes

**Important:** Autodarts rotates the players array after every leg. This affects event handling:

```
Match start:
  players[0] = { index: 0, name: "Max" }
  players[1] = { index: 1, name: "Anna" }
  data.player = 0 -> Max is up

After leg 1 (Max wins, Anna starts leg 2):
  players[0] = { index: 1, name: "Anna" }  <- array rotated!
  players[1] = { index: 0, name: "Max" }
  data.player = 0 -> now it's Anna's turn (but at array position 0)
```

#### The stable `player.index`

The `player.index` value stays stable for the whole match and should be used for lookups:

```typescript
// Wrong: using the array position
const player = players[data.player]; // can be wrong after rotation!

// Right: using the stable index
const playerIndex = players[data.player]?.index;
const player = players.find(p => p.index === playerIndex);
```

#### Event data on leg changes

The synthetic events (`player.change`, `turn.finished`, `game.finished`) carry extra fields for this:

| Field | Description | Reliability |
|-------|-------------|-------------|
| `playerName` | Player name at the time of the event | High |
| `winnerName` | Winner name (on `game.finished`) | High |
| `playerIndex` | Stable `player.index` | High |
| `winnerPlayerIndex` | Stable winner index | High |
| `currentPlayer` | Array position | Low (after rotation) |
| `winner` | Array position of the winner | Low (after rotation) |

**Best practice:** always prefer `playerName`/`winnerName` or `playerIndex`/`winnerPlayerIndex` for lookups.

### Player Color Resolution

Modules can resolve player colors via the player management system:

```typescript
// Color from event data
const color = event.data.color || '#ffffff';

// Or via the local player database
const players = await fetch('/api/players').then(r => r.json());
```

### PlayerResolver Pattern (Frontend Modules)

Frontend modules such as Game Display, which must cope with array rotation in the browser, use a PlayerResolver pattern:

```typescript
class PlayerResolver {
  // Persistent map: match-start assignments
  private originalIndexByName: Map<string, number> = new Map()

  updatePlayers(autodartsPlayers: Player[]): void {
    // Save the original assignments on the FIRST call only
    if (!this.isInitialized) {
      autodartsPlayers.forEach(p => {
        this.originalIndexByName.set(p.name.toLowerCase(), p.index)
      })
      this.isInitialized = true
    }
  }

  findPlayer(name: string, players: Player[]): Player | null {
    // Always use the ORIGINAL assignment
    const idx = this.originalIndexByName.get(name.toLowerCase())
    if (idx !== undefined) {
      return players.find(p => p.index === idx) || null
    }
    return null
  }

  // Reset on a new match
  reset(): void {
    this.originalIndexByName.clear()
    this.isInitialized = false
  }
}
```

**Important:** the resolver must be reset on `match.start` so the new player assignments are captured correctly.

---

## AI Provider System

IO-Darts-Agent includes a flexible AI provider system (`src/core/ai/`) that modules can use for various AI-powered features.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Provider Service                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  ElevenLabs  │  │ Runway /     │  │   OpenAI /         │  │
│  │  (TTS)       │  │ Higgsfield   │  │   Anthropic /      │  │
│  │              │  │ (Video/Image)│  │   Ollama (Text)    │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │ Stability AI │  │  Replicate   │                        │
│  │ (Images)     │  │  (Various)   │                        │
│  └──────────────┘  └──────────────┘                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        Modules                                │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐   │
│  │ Darts Caller│ │ Game Display│ │  Custom Modules     │   │
│  │ (TTS)       │ │ (Animations)│ │  (Any AI Features)  │   │
│  └─────────────┘ └─────────────┘ └─────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Provider Configuration

Providers are configured in `dist/config/ai-providers.json` (or via the sidebar entry **AI Provider** (`/ai-settings`) in the UI, or `PUT /api/ai/providers/:id`):

```json
[
  {
    "id": "elevenlabs",
    "type": "elevenlabs",
    "name": "ElevenLabs",
    "apiKey": "your-api-key",
    "enabled": true,
    "options": {
      "defaultModel": "eleven_multilingual_v2"
    }
  },
  {
    "id": "runway",
    "type": "runway",
    "name": "Runway ML",
    "apiKey": "your-api-key",
    "enabled": true
  }
]
```

### Supported Providers

| Provider | Type | Capabilities | Use Cases |
|----------|------|---------------|-----------|
| **ElevenLabs** | `elevenlabs` | `audio-tts` | Voice packs, player name synthesis |
| **Runway ML** | `runway` | `video-generation` | Animation generator (one of two selectable engines) |
| **Higgsfield** | `higgsfield` | `image-generation`, `video-generation` | Animation generator (the other selectable engine) |
| **OpenAI** | `openai` | `text`, `image-generation` | Chat, image generation |
| **Anthropic** | `anthropic` | `text` | Chat, analysis |
| **Stability AI** | `stability` | `image-generation` | Image generation |
| **Ollama** | `ollama` | `text` | Local LLM inference |
| **Replicate** | `replicate` | Various | Custom hosted models |

### Using AI Providers in Code

```typescript
import { getAIProviderService } from '../core/ai/index.js';

const service = getAIProviderService();

// Get a specific provider
const elevenlabs = service.getProvider('elevenlabs');
if (elevenlabs?.isAvailable()) {
  const audio = await service.generateSpeech(
    { text: 'One hundred and eighty!', voice: 'voice-id-or-name' },
    'elevenlabs'
  );
}

// Which providers currently offer a capability
const capabilities = service.getAvailableCapabilities();
```

### Creating a Custom Provider

```typescript
// src/core/ai/providers/MyProvider.ts
import { BaseAIProvider } from '../AIProvider.js';
import type { AIProviderConfig, AICapability } from '../types.js';

export class MyProvider extends BaseAIProvider {
  readonly capabilities: AICapability[] = ['text'];

  constructor(config: AIProviderConfig) {
    super(config);
  }

  protected override getAuthHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.apiKey}`,
    };
  }

  async generateText(prompt: string): Promise<string> {
    const response = await this.fetchJson('/v1/completions', {
      method: 'POST',
      body: { prompt },
    });
    return response.text;
  }
}
```

Register it with `aiService.registerProviderFactory('my-provider', (config) => new MyProvider(config))` in `src/core/ai/AIProviderInitializer.ts`.
