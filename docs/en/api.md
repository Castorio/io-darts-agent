# IO-Darts-Agent: API Documentation

## Overview

IO-Darts-Agent exposes a local REST API (Fastify) plus one WebSocket endpoint for real-time events. The API is built for the **local network only**: it is not designed or hardened for exposure to the public internet.

Two independent protections apply to every route below, in addition to whatever is noted per route:

- **Origin check** - every request (including the WebSocket upgrade) is rejected with `403 Origin not allowed` unless the `Origin` header is empty (same-origin, curl, etc.) or resolves to a private/local address (`127.0.0.1`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, link-local, `.local`/`.lan`/`.home.arpa`/`.fritz.box`, or a dotless hostname).
- **CORS** mirrors the same local-origin check.

**Base URL:** `http://<hub-host>:3000/api` (default port `3000`)

## Authentication

IO-Darts-Agent has an optional username/password login ("web auth"), configured during setup or in **Settings**. A single global Fastify hook (`onRequest`) runs in front of every route below and decides whether the request is even allowed to reach its handler:

- **While initial setup is incomplete**: only `/api/setup/*` routes are reachable; everything else returns `403`.
- **Web auth disabled** (default): every route is open to any client on the local network, no login needed.
- **Web auth enabled**: the request needs a valid `autodarts_session` cookie (set by `POST /api/auth/login`), or it must be one of a short, hardcoded list of always-public routes: `GET /health`, `GET /api/auth/session`, `POST /api/auth/login`, `GET /api/setup/status`. Every other route - including ones marked `Public` below - returns `401 Authentication required` from this global hook before its own code ever runs.

Routes marked **Public** in the tables below have no additional, route-specific session check in their own handler (so they behave like any other route when web auth is disabled, and some are written as if meant to be reachable without logging in, e.g. for a Game Display or WLED config page opened on a second device). They are still subject to the global hook above, so **when web auth is enabled they also require a valid session** - this includes the Darts Caller, TTS/Voice Pack, i18n, logs, media file delivery, and module config endpoints. Treat `Public` here as "no extra per-route check", not as "always reachable without login". Routes marked **Session** additionally run their own `isAuthorized()` check and return a `401` body shaped for that route if there is no session.

`/api/developer/*` additionally requires `developerMode: true` in the hub settings; it returns `403` otherwise.

## REST API

### Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | Public | Liveness check. Returns `{ "status": "ok" }`. Not under `/api`. |

### Setup

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/setup/status` | Public | Whether the first-run setup wizard still needs to run. Response: `{ setupRequired, version }`. |
| POST | `/api/setup/test-connection` | Public | Tests Autodarts credentials before saving them. Body: `{ email, password, boardId }` (all required). |
| POST | `/api/setup/complete` | Public | Saves the initial configuration and marks setup as completed. Body: `{ autodarts: { email, password, boardId }, webAuth?: { enabled, username, password } }`. Fails with `400` if setup was already completed. |

### Authentication

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/auth/session` | Public | Current session status: `{ authenticated, authRequired, username? }`. |
| POST | `/api/auth/login` | Public | Body: `{ username, password }`. On success sets the `autodarts_session` cookie. No-ops (`success: true`) if web auth is disabled. |
| POST | `/api/auth/logout` | Public | Clears the session cookie. |
| POST | `/api/auth/change-password` | Session | Body: `{ currentPassword, newPassword }`. Requires an authenticated session and web auth to be enabled. |

### Hub Status & Connection

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/status` | Session | Hub status: `{ version, uptime, setupCompleted, autodarts: { connected, userId?, boardId? }, modules: { total, running } }`. Not in the global allowlist, so it requires a session once web auth is enabled, even though the handler itself does not check it. |
| POST | `/api/autodarts/connect` | Session | Triggers a connection attempt to the Autodarts API. Fails with `400` if setup is not completed. |
| POST | `/api/autodarts/disconnect` | Session | Triggers a disconnect from Autodarts. |

### Settings

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/settings` | Session | Returns hub settings with secrets masked (passwords and API keys are never returned, only whether they are `configured`). |
| PUT | `/api/settings` | Session | Partial update. Body may contain any of `language`, `server: { port, host }`, `webAuth: { enabled, username, password }`, `autodarts: { email, password, boardId }`, `aiProviders: { runway: { apiKey, model }, elevenlabs: { apiKey } }`, `developerMode`. Emits a `settingsChanged` event on the hub. |
| POST | `/api/settings/restart` | Session | Signals the hub to restart (used after a port change). |

### Match

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/match/current` | Session | Full current match state (players, scores, legs/sets, stats, settings) or an "inactive" shape if no match is running. |
| GET | `/api/match/current/players` | Session | Lightweight player list with per-player score and average. |
| GET | `/api/match/current/scores` | Session | Lightweight scores only: `{ active, scores, gameScores, turnScore, currentPlayer }`. |
| GET | `/api/match/status` | Session | Match status from the centralized `MatchStatusService` (includes player colors from the local player database). |
| GET | `/api/match/status/active` | Session | `{ active, matchId }` only. |
| GET | `/api/match/status/player` | Session | Current player only: `{ hasMatch, currentPlayer: { index, name, score, average, color? } }`. |

### Modules

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/modules` | Session | List of installed modules with status. |
| GET | `/api/modules/:id` | Session | Details for one module (manifest, config, status, stats). |
| GET | `/api/modules/:id/config` | **Public** | Config values only, so module frontends (served without their own session) can load their settings. |
| PUT | `/api/modules/:id/config` | Session | Body: `{ config: Record<string, unknown> }`. Replaces the module's stored configuration. |
| POST | `/api/modules/:id/start` | Session | Starts a stopped module. |
| POST | `/api/modules/:id/stop` | Session | Stops a running module. |
| POST | `/api/modules/:id/restart` | Session | Restarts a module. |
| POST | `/api/modules/:id/update` | Session | Pulls the latest Git commit for the module and runs `npm install`. |
| POST | `/api/modules/install` | Session | Body: `{ source: 'git' \| 'local', url?, path?, branch? }` (`url` required for `git`, `path` required for `local`). Response: `{ success, moduleId }`. |
| DELETE | `/api/modules/:id` | Session | Uninstalls a module. |
| GET | `/api/modules/:id/translations/:language` | Session | Translated manifest/strings for `language` (`en`, `de`, or `es`). |
| GET | `/api/modules/:id/languages` | Session | Which languages a module's manifest provides translations for. |
| GET | `/api/modules/:id/intents` | Session | The module's intent actions and default subscriptions (from its manifest). |
| PUT | `/api/modules/:id/intents` | Session | Body: `{ subscriptions: Array<{ intentId, enabled, action: { type, config? } }> }`. Stores intent subscriptions in the module's config. |
| GET | `/api/modules/:id/intent-subscriptions` | Session | Currently configured intent subscriptions (falls back to the manifest's defaults). |
| GET | `/api/modules/:id/autostart` | Session | Whether the module auto-starts with the hub. |
| PUT | `/api/modules/:id/autostart` | Session | Body: `{ autostart: boolean }`. |
| GET | `/api/modules/autostart` | Session | Autostart flags for all modules. |
| GET | `/api/modules/intents` | Session | Intent actions/subscriptions for every installed module, keyed by module ID. |
| GET | `/api/intents` | Session | Short list of intents any module declares via `intents.emits` (`id`, `description`, `category`, `sourceModule`). |
| GET | `/api/intents/available` | Session | Same as above but with full payload schema per intent. |
| POST | `/api/modules/wled/test-action` | Session | Sends a one-off WLED command directly (bypassing module config). Body: `{ host, port?, actionType: 'preset' \| 'effect' \| 'solid' \| 'off', presetId?, effectId?, color?, color2?, color3?, brightness?, speed?, intensity? }`. |
| POST | `/api/modules/wled/test-connection` | Session | Body: `{ host, port? }`. Calls the WLED device's `/json/info`. |
| POST | `/api/modules/wled/presets` | Session | Body: `{ host, port? }`. Returns the WLED device's saved presets. |
| POST | `/api/modules/wled/effects` | Session | Body: `{ host, port? }`. Returns the WLED device's effect list. |
| POST | `/api/modules/wled/palettes` | Session | Body: `{ host, port? }`. Returns the WLED device's color palette list. |

Module UIs are served statically under `/module-ui/:moduleId/` (e.g. `/module-ui/game-display/`), and a module's own custom API routes (registered via the module SDK) are reachable under `/api/modules/:moduleId/routes/*`; see [Module SDK](module-sdk.md).

### Players

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/players` | Session | List of local player profiles. Query: `search?` (filters by name/alias). |
| GET | `/api/players/:id` | Session | One player profile. |
| POST | `/api/players` | Session | Body: `{ name, nickname?, color?, avatar?, autodartsUserId? }` (`name` required). `409` on duplicate name. |
| PUT | `/api/players/:id` | Session | Partial update of the same fields. |
| DELETE | `/api/players/:id` | Session | Deletes a player profile. |
| GET | `/api/players/:id/stats` | Session | The player's aggregated statistics. |
| GET | `/api/players/:id/module-settings/:moduleId` | Session | Per-player, per-module settings override (used for player-specific animations/colors/voices). |
| PUT | `/api/players/:id/module-settings/:moduleId` | Session | Body: `{ settings: Record<string, unknown> }`. |
| POST | `/api/players/match` | Session | Body: `{ name }`. Matches an Autodarts player name/alias to a local profile: `{ matched, player? }`. |

### Internationalization (hub UI)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/i18n/languages` | Public | Currently selected language plus metadata for all supported languages. |
| GET | `/api/i18n/translations` | Public | Query: `lang?`. Full translation bundle for a language (falls back to the active language). |
| PUT | `/api/i18n/language` | Public | Body: `{ language }`. Persists the hub UI language. |
| GET | `/api/i18n/t/:key` | Public | Query: `lang?`. Translates a single key. |

### AI Providers

The hub ships adapters for `elevenlabs`, `runway`, `higgsfield`, `openai`, `anthropic`, `stability`, `ollama`, and `replicate`. All AI routes require a session.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/ai/providers` | Session | List of configured providers with capabilities and whether an API key is set. |
| GET | `/api/ai/providers/:id` | Session | Details for one provider. |
| GET | `/api/ai/providers/:id/status` | Session | Live status/health of a provider. |
| GET | `/api/ai/providers/:id/models` | Session | Text models the configured key can use (`502` if the upstream call fails; not every provider implements this). |
| PUT | `/api/ai/providers/:id` | Session | Body: provider config fields to update (API key, model, `enabled`, etc.). Persists to disk. |
| POST | `/api/ai/providers/:id/enable` | Session | Shortcut for `PUT .../:id` with `{ enabled: true }`. |
| POST | `/api/ai/providers/:id/disable` | Session | Shortcut for `PUT .../:id` with `{ enabled: false }`. |
| GET | `/api/ai/capabilities` | Session | All capabilities (`text`, `image-generation`, `video-generation`, `audio-tts`, ...) and which available providers offer each. |
| GET | `/api/ai/provider-options` | Session | Query: `capability?`. Provider list formatted for a `provider-select` module config field. |
| POST | `/api/ai/generate/text` | Session | Body: `{ providerId?, ...TextGenerationAPIRequest }`. Uses the default text provider if `providerId` is omitted. |
| POST | `/api/ai/generate/image` | Session | Body: `{ providerId?, ...ImageGenerationAPIRequest }`. |
| POST | `/api/ai/generate/speech` | Session | Body: `{ providerId?, ...TTSAPIRequest }`. |
| POST | `/api/ai/generate/embeddings` | Session | Body: `{ providerId?, ...EmbeddingsAPIRequest }`. |
| GET | `/api/ai/jobs` | Session | Query: `status?`, `limit?` (default `100`). List of async AI jobs. |
| GET | `/api/ai/jobs/:id` | Session | One job's status/result. |
| POST | `/api/ai/jobs/:id/cancel` | Session | Cancels a running job. |
| DELETE | `/api/ai/jobs/:id` | Session | Removes a job from history. |

### Animation Generator

AI-generated celebration animations (Runway or Higgsfield) for dart events.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/animations/status` | Session | `{ available, provider }` - whether an animation provider is configured. |
| GET | `/api/animations/engine` | Session | `{ engine, engines: [{ id, name, available }] }` - which engine (`runway` or `higgsfield`) is active and which are usable. `404` if engine selection isn't wired up. |
| PUT | `/api/animations/engine` | Session | Body: `{ engine: 'runway' \| 'higgsfield' }`. Switches the active engine. |
| GET | `/api/animations/styles` | Session | Built-in style presets. |
| GET | `/api/animations/events` | Session | Dart event types that can have a generated animation. |
| POST | `/api/animations/generate` | Session | Body: `{ eventType, styleId? \| customStyle?: { name, prompt }, customPrompt?, options? }`. Starts a single generation job. |
| POST | `/api/animations/generate-batch` | Session | Body: `{ styleId? \| customStyle?, eventTypes?, options? }`. Starts one job per event type. |
| GET | `/api/animations/jobs` | Session | Query: `status?`. List of generation jobs. |
| GET | `/api/animations/jobs/:id` | Session | One job's status/result. |
| DELETE | `/api/animations/jobs/:id` | Session | Cancels the job if still running, otherwise deletes it. |
| POST | `/api/animations/jobs/clear` | Session | Clears all finished jobs; returns `{ cleared }`. |

### Media Library

Stores uploaded/generated animations, sounds, and images used by modules. `:type` is `animation`, `sound`, or `image`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/media/:type` | Session | Query: `folder?` (`*` lists recursively). Lists files of that type. |
| GET | `/api/media/:type/folders` | Session | Lists folders for that type. |
| POST | `/api/media/:type/folders` | Session | Body: `{ path }`. Creates a folder. |
| DELETE | `/api/media/:type/folders/:path` | Session | Deletes a folder; fails if not empty. |
| POST | `/api/media/:type/upload` | Session | Query: `folder?`. Multipart file upload (max 50 MB, MIME type validated per media type). |
| POST | `/api/media/:type/move` | Session | Body: `{ filename, fromFolder?, toFolder? }`. |
| DELETE | `/api/media/:type/:filename` | Session | Query: `folder?`. Deletes a file. |
| GET | `/api/media/files/:type/:filename` | **Public** | Serves a file from the type's root folder (for embedding in displays). Cached for one year. |
| GET | `/api/media/files/:type/*` | **Public** | Same, for a file in a nested folder (last path segment is the filename). |
| GET | `/api/media/info` | **Public** | `{ maxFileSize, allowedTypes }` per media type. |

### Text-to-Speech & Voice Packs

Routes under `/api/tts/*` have no route-specific session check (`Public` below). With web auth enabled, the global hook (see [Authentication](#authentication)) still requires a session.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/tts/elevenlabs/voices` | Public | Requires the ElevenLabs API key to be configured. |
| GET | `/api/tts/elevenlabs/voice/:voiceId` | Public | Details for one voice. |
| GET | `/api/tts/elevenlabs/subscription` | Public | ElevenLabs account/subscription info. |
| POST | `/api/tts/elevenlabs/generate` | Public | Body: `{ text, voiceId? }`. Returns base64 audio for quick testing. |
| GET | `/api/tts/elevenlabs/cache/stats` | Public | TTS cache size/entry stats. |
| DELETE | `/api/tts/elevenlabs/cache` | Public | Clears the TTS cache. |
| GET | `/api/tts/elevenlabs/status` | Public | `{ available, configured, cache }`. |
| GET | `/api/tts/voicepacks` | Public | Lists generated/imported voice packs. |
| GET | `/api/tts/voicepacks/:packId` | Public | One voice pack's info. |
| DELETE | `/api/tts/voicepacks/:packId` | Public | Deletes a voice pack. |
| GET | `/api/tts/voicepacks/generation/progress` | Public | Current generation progress, if any. |
| GET | `/api/tts/voicepacks/generation/status` | Public | Combined status: generator availability, progress, and existing packs. |
| POST | `/api/tts/voicepacks/generate` | Public | Body: `{ packId, packName, voiceId, language, modelId?, stability?, similarityBoost? }` (`language` must be `en` or `de`). `409` if a generation is already running. |
| POST | `/api/tts/voicepacks/generation/cancel` | Public | Cancels the running generation. |
| GET | `/api/tts/voicepacks/:packId/download` | Public | Downloads the pack as a ZIP. |
| POST | `/api/tts/voicepacks/upload` | Public | Multipart upload of a voice pack ZIP; extracted and imported server-side. |

### Darts Caller

Routes under `/api/caller/*` have no route-specific session check (`Public` below). With web auth enabled, the global hook (see [Authentication](#authentication)) still requires a session.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/caller/config` | Public | The running caller module's configuration. `503` if the module isn't running. |
| GET | `/api/caller/stats` | Public | Caller statistics (calls generated, by backend). |
| POST | `/api/caller/stats/reset` | Public | Resets the statistics. |
| GET | `/api/caller/voices` | Public | Placeholder; actual TTS voices come from the browser's `speechSynthesis` API. |
| POST | `/api/caller/test` | Public | Body: `{ score? }` (default `180`). Triggers a real test call through the caller's event pipeline. |
| GET | `/api/caller/audio-packs` | Public | Placeholder list of audio packs. |
| GET | `/api/caller/audio/status` | Public | Current playback status/queue. |
| POST | `/api/caller/audio/stop` | Public | Stops playback and clears the queue. |
| POST | `/api/caller/audio/skip` | Public | Skips to the next queued item. |
| GET | `/api/caller/voicepacks` | Public | Voice packs available to the caller module. |

### Autodarts Trainer

Custom endpoints used by the Autodarts Trainer module.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/trainer/session` | Session | Current training session or `null`. |
| POST | `/api/trainer/session/start` | Session | Body: `TrainingSessionConfig` (`type`, `difficulty` required). `400`-level validation via JSON schema. |
| POST | `/api/trainer/session/pause` | Session | Pauses the active session. |
| POST | `/api/trainer/session/resume` | Session | Resumes a paused session. |
| POST | `/api/trainer/session/end` | Session | Ends the session and returns final stats. |
| POST | `/api/trainer/session/throw` | Session | Body: `{ number, multiplier, isHit? }`. Records a throw against the current target. |
| GET | `/api/trainer/routines` | Session | Built-in and custom practice routines. |
| GET | `/api/trainer/routines/:id` | Session | One routine. |
| POST | `/api/trainer/routines` | Session | Body: `{ name, description, type, difficulty, duration, targets }`. Creates a custom routine. |
| DELETE | `/api/trainer/routines/:id` | Session | Deletes a custom routine (built-ins cannot be deleted). |
| POST | `/api/trainer/routines/:id/start` | Session | Starts a session from a routine. |
| GET | `/api/trainer/history` | Session | Query: `limit?` (default `20`), `offset?`, `type?`. |
| GET | `/api/trainer/stats` | Session | Query: `period?` (`day` \| `week` \| `month` \| `all`, default `all`). Aggregated stats across history. |

Session/routine/history data is held in the hub's memory for the current process only; it resets on restart.

### Developer Mode

Requires both an authenticated session (if web auth is enabled) **and** `developerMode: true` in settings. Used to simulate Autodarts matches without a physical board, for testing modules.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/developer/status` | Session + Dev mode | Whether developer mode is on and whether a simulated match is active. |
| POST | `/api/developer/simulate/match/start` | Session + Dev mode | Body: `{ players?: [{ name, color? }], startScore? }`. Emits `match.start` then `match.state`. |
| POST | `/api/developer/simulate/match/end` | Session + Dev mode | Body: `{ winner?, cancelled? }`. Emits `match.finished` or `match.delete`. |
| POST | `/api/developer/simulate/throw` | Session + Dev mode | Body: `{ number, multiplier }`. Emits `throw.detected` and an updated `match.state`. |
| POST | `/api/developer/simulate/turn/end` | Session + Dev mode | Emits `turn.finished`, `takeout.started`, then (after a short delay) `takeout.finished`, `player.change`, and `match.state`. |
| POST | `/api/developer/simulate/event` | Session + Dev mode | Body: `{ type, data? }`. Emits an arbitrary event of any `AutodartsEventType`. |
| GET | `/api/developer/scenarios` | Session + Dev mode | Built-in scenarios: `180`, `bust`, `checkout`, `bullseye`, `full-leg`. |
| POST | `/api/developer/scenarios/:id/run` | Session + Dev mode | Runs one of the scenarios above. |

### Logs

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/logs` | Public | Recent log history (same entries streamed as `log` WebSocket messages). |

## WebSocket API

### Connection

**URL:** `ws://<hub-host>:3000/api/events`

Requires a valid `autodarts_session` cookie if web auth is enabled; the server closes the connection with code `4001` otherwise. There is no separate Server-Sent-Events endpoint - all live data (events, logs, module status, caller requests, voice pack progress) goes over this one WebSocket.

### Message Format

All messages are JSON-encoded, each with a `type` field.

### Client to Server

| Type | Payload | Description |
|------|---------|-------------|
| `ping` | - | Server replies with `{ "type": "pong", "timestamp": <ms> }`. |
| `subscribe` | `{ events: string[] }` | Replaces the client's subscription set (default is `*`, meaning everything). |
| `unsubscribe` | `{ events: string[] }` | Removes event types from the subscription set. |

### Server to Client

| Type | Shape | Description |
|------|-------|-------------|
| `status` | `{ status: { connected, matchId? } }` | Sent immediately on connect, and again whenever the hub's connection status changes. |
| `event` | `{ event: { type, timestamp, data } }` | A parsed Autodarts event (see [Autodarts Events](#autodarts-events) below). |
| `log` | `{ entry: { id, timestamp, type, source, message, data? } }` | A log line for the live log view. |
| `module` | `{ moduleId, status, message? }` | A module's running status changed (`running`, `stopped`, `error`). |
| `voicepack_progress` | `{ progress: { status, packId, packName, voiceId, totalFiles, completedFiles, currentFile?, error?, ... } }` | Voice pack generation progress. |
| `caller` | `{ request: CallRequest, callerType? }` | A Darts Caller announcement for browser playback: `CallRequest` has `id`, `type`, `text`, `score?`, `playerName?`, `remaining?`, `audioUrl?`, `audioFile?`, `priority`, `timestamp`. |

## Autodarts Events

`event.type` is one of a fixed set (`AutodartsEventType`). Some are forwarded from Autodarts largely unchanged ("native"); others are derived by the hub's `EventParser` from `match.state` updates ("synthetic").

### Native

| Event | When | Key data |
|-------|------|----------|
| `board.state` | Board connects/disconnects | board connection info |
| `board.event` | Any other raw board event | event-specific |
| `match.start` | A match begins | `matchId`, `boardId` |
| `match.delete` | A match is cancelled | `matchId`, `boardId` |
| `match.finish` | User dismisses the results screen | `matchId`, `boardId` |
| `match.state` | Any match state update | `matchId`, `player`, `gameScores`, `round`, `leg`, `set`, `players`, `settings`, ... |
| `throw.detected` | A dart is scored | `segment`, `coords?`, `throwNumber`, `boardId` |
| `takeout.started` | Darts are being pulled | `boardId` |
| `takeout.finished` | Darts have been pulled | `boardId` |

### Synthetic (derived from `match.state`)

| Event | When | Key data |
|-------|------|----------|
| `player.change` | The active player index changes | `previousPlayer`, `currentPlayer`, `playerIndex`, `playerName`, `remaining` |
| `turn.finished` | 3 darts thrown, a bust, or a round change | `matchId`, `playerIndex`, `playerName`, `turnScore`, `busted`, `remaining`, `round`, `throws` |
| `game.finished` | A leg is won | `matchId`, `winner`, `winnerName`, `winnerPlayerIndex`, `leg`, `set`, `players`, `scores` |
| `match.finished` | The match is won | `matchId`, `winner`, `winnerName`, `winnerPlayerIndex`, `players`, `scores` |
| `match.result` | Emitted right after `match.finished` | `winner`, `winnerName`, `chalkboards`, `stats`, `scores`, `settings` |

`raw` is used for anything the parser doesn't otherwise recognize.

**Note:** Individual modules (for example WLED) further derive their own sub-keys - such as `throw.triple`, `throw.double`, `throw.180`, `throw.bullseye` - from the data inside a `throw.detected` event, purely for their own per-event action configuration. These sub-keys are not separate events on the bus or the WebSocket; see the module's own README and [Module SDK](module-sdk.md) for details.

## Error Handling

Most error responses follow this shape, though the exact fields vary by route (some use `error`, others `success: false` plus `error`/`message`):

```json
{
  "error": "Error message",
  "success": false
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad request (validation failure) |
| 401 | Not authenticated (session required) |
| 403 | Forbidden (non-local origin, or developer mode disabled) |
| 404 | Not found |
| 409 | Conflict (duplicate name, generation already running) |
| 500 | Server error |
| 502 | Upstream provider error |

## Module UI Routing

Modules with their own frontend are served under `/module-ui/:moduleId/`:

- Game Display: `/module-ui/game-display/`
- Other modules with a UI follow the same pattern.
