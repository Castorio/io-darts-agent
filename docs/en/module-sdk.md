# IO-Darts-Agent: Module SDK

This documentation describes how to develop custom modules for IO-Darts-Agent.

## Overview

Modules are extensions that react to Autodarts events and perform actions. Each module consists of:

1. **Manifest** (`module.json`) - metadata and configuration schema (required)
2. **Code** - either wired directly into the hub (`entry: "internal"`, hub development only) or a standalone Node.js process built on the `@autodarts-hub/module-sdk` package (any other `entry`)
3. **Web UI** - custom user interface, served at `/module-ui/<module-id>/` (optional)

## Module Structure

```
my-module/
├── module.json          # Manifest (required)
├── package.json         # Required for a process module
├── README.md            # Documentation
├── src/                 # Process entry point(s), e.g. src/index.ts
├── dist/                # Build output (entry points to dist/index.js here)
└── web/                 # Frontend (optional)
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── main.ts
        ├── App.vue
        └── ...
```

## Manifest (module.json)

The manifest defines all metadata and configuration for your module:

```json
{
  "id": "my-module",
  "name": "My Awesome Module",
  "version": "1.0.0",
  "description": "Description of the module",
  "author": "Your Name",
  "entry": "dist/index.js",
  "events": [
    "throw.detected",
    "player.change",
    "match.start",
    "match.finished"
  ],
  "config": {
    "hostAddress": {
      "type": "string",
      "label": "Server Address",
      "description": "IP address or hostname of the server",
      "required": true,
      "default": "192.168.1.100"
    },
    "port": {
      "type": "number",
      "label": "Port",
      "default": 80,
      "min": 1,
      "max": 65535
    },
    "enabled": {
      "type": "boolean",
      "label": "Enabled",
      "default": true
    },
    "mode": {
      "type": "select",
      "label": "Mode",
      "default": "normal",
      "options": [
        { "value": "normal", "label": "Normal" },
        { "value": "advanced", "label": "Advanced" }
      ]
    }
  }
}
```

### Manifest Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique module ID (kebab-case) |
| `name` | string | Yes | Display name (English) |
| `version` | string | Yes | Semantic Version (x.y.z) |
| `description` | string | No | Short description (English) |
| `author` | string | No | Author/Developer |
| `repository` | string | No | URL to Git repository |
| `entry` | string | Yes | `"internal"` for code wired into the hub itself, otherwise a JS file path (e.g. `"dist/index.js"`) that the hub runs as a separate process |
| `events` | string[] | No | `AutodartsEventType` values the module's config UI offers as triggers |
| `config` | object | No | Configuration schema |
| `i18n` | object | No | Multi-language translations |
| `intents` | object | No | Intent system configuration |
| `eventMeta` | object | No | Metadata for events (labels, descriptions) |
| `eventGroups` | array | No | Grouping of events for the UI |
| `effects` | array | No | List of available effects (e.g. for WLED) |

`entry: "internal"` only works for the three modules the hub special-cases by ID (WLED, Game Display, Darts Caller); a newly created module needs a process entry point. See [Developer Guide - Module Types](developer-guide.md#module-types).

### Configuration Field Types

#### string
```json
{
  "type": "string",
  "label": "Name",
  "description": "Help text",
  "required": true,
  "default": "Default value",
  "placeholder": "Enter value..."
}
```

The `placeholder` attribute is optional and shows hint text in the empty input field.

#### number
```json
{
  "type": "number",
  "label": "Port",
  "default": 80,
  "min": 1,
  "max": 65535,
  "step": 1
}
```

The `step` attribute is optional and defines the increment for slider inputs.

#### boolean
```json
{
  "type": "boolean",
  "label": "Enabled",
  "default": true
}
```

#### select
```json
{
  "type": "select",
  "label": "Mode",
  "default": "normal",
  "options": [
    { "value": "normal", "label": "Normal" },
    { "value": "fast", "label": "Fast" }
  ]
}
```

#### color
```json
{
  "type": "color",
  "label": "Color",
  "default": "#3b82f6"
}
```

#### provider-select

Renders a dropdown of the AI providers configured on the hub (see `GET /api/ai/provider-options` in [API Documentation](api.md)), optionally filtered by capability:

```json
{
  "type": "provider-select",
  "label": "TTS Provider",
  "providerCapability": "audio-tts",
  "default": ""
}
```

#### group (Nested Configuration)

Groups allow you to organize related settings together with optional conditional visibility:

```json
{
  "type": "group",
  "label": "TTS Settings",
  "description": "Settings for text-to-speech",
  "showIf": { "field": "callerType", "value": "tts" },
  "fields": {
    "voice": {
      "type": "string",
      "label": "Voice",
      "default": ""
    },
    "rate": {
      "type": "number",
      "label": "Speed",
      "default": 1.0,
      "min": 0.5,
      "max": 2.0,
      "step": 0.1
    }
  }
}
```

The `showIf` property conditionally shows the group based on another config field's value.

## Event Metadata (eventMeta)

Modules can provide metadata for events with multi-language support:

```json
{
  "eventMeta": {
    "throw.detected": {
      "label": { "en": "Throw detected", "de": "Wurf erkannt", "es": "Tiro detectado" },
      "description": { "en": "A throw was detected", "de": "Ein Wurf wurde erkannt", "es": "Se detectó un tiro" }
    }
  }
}
```

This metadata is used in the UI to display human-readable event names and descriptions. It is purely cosmetic - it does not change which events the module actually receives.

## Event Groups (eventGroups)

Events can be organized into logical groups for better UI presentation:

```json
{
  "eventGroups": [
    {
      "title": { "en": "Match Events", "de": "Match Events", "es": "Eventos de Partido" },
      "events": ["match.start", "match.finished", "match.delete"]
    },
    {
      "title": { "en": "Player Events", "de": "Spieler Events", "es": "Eventos de Jugador" },
      "events": ["player.change", "turn.finished"]
    }
  ]
}
```

## Effects List (effects)

Modules can define a list of available effects. This is especially useful for hardware modules like WLED:

```json
{
  "effects": [
    { "id": 0, "name": "Solid" },
    { "id": 1, "name": "Blink" },
    { "id": 2, "name": "Breathe" },
    { "id": 9, "name": "Rainbow" },
    { "id": 52, "name": "Fire 2012" },
    { "id": 82, "name": "Fireworks" }
  ]
}
```

This list is displayed in the UI and can be used for effect selection in intent actions.

## Intent System

The Intent System enables **module-to-module communication**. A module can expose actions that other modules can call. This is NOT about replicating events - events already exist for that purpose. Intents are for triggering specific functionality that a module provides.

### Purpose of Intents

Intents allow modules to:
1. **Expose capabilities** - a module declares what actions it can perform (`intents.actions`)
2. **Be triggered by other modules** - other modules can call these actions
3. **Emit their own semantic intents** - a module can declare intents it emits (`intents.emits`), which other modules can subscribe reactions to

### Real-World Example: WLED Module

The WLED module exposes actions for LED control:

```json
{
  "intents": {
    "actions": [
      {
        "type": "solidColor",
        "label": "Solid Color",
        "description": "Set all LEDs to a solid color",
        "configSchema": {
          "color": { "type": "color", "label": "Color", "default": "#ff0000" },
          "brightness": { "type": "number", "label": "Brightness", "default": 255, "min": 0, "max": 255 },
          "duration": { "type": "number", "label": "Duration (ms)", "description": "0 = permanent", "default": 0, "min": 0 }
        }
      },
      {
        "type": "effect",
        "label": "Play Effect",
        "description": "Play an effect",
        "configSchema": {
          "effectId": { "type": "number", "label": "Effect ID", "default": 0 },
          "duration": { "type": "number", "label": "Duration (ms)", "default": 2000, "min": 0 }
        }
      },
      {
        "type": "off",
        "label": "Turn Off",
        "description": "Turn off all outputs"
      }
    ],
    "defaultSubscriptions": []
  }
}
```

**Use case:** another module could trigger `wled.effect` when announcing a special score.

### Action Definition Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Unique action identifier (used when calling) |
| `label` | string | Yes | Human-readable name for UI display |
| `description` | string | No | Description of what the action does |
| `configSchema` | object | No | Configuration options the caller must/can provide |

### Emitting Intents (from a process module)

If you extend `AutodartsModule` from `@autodarts-hub/module-sdk`, call `this.emitIntent(intentId, payload)` (protected method). Declare every intent ID you emit under `intents.emits` in `module.json`, so the UI can show it as something other modules can subscribe to:

```json
{
  "intents": {
    "emits": [
      {
        "id": "scoreboard.milestone",
        "description": "A notable score was thrown",
        "category": "my-module",
        "payload": {
          "score": { "type": "number", "description": "The score" },
          "playerName": { "type": "string" }
        }
      }
    ]
  }
}
```

```typescript
this.emitIntent('scoreboard.milestone', { score: 180, playerName: 'Max' });
```

You can also use the SDK's small templating helper to keep announcement text in one place:

```typescript
import { registerIntentTemplate } from '@autodarts-hub/module-sdk';

registerIntentTemplate({
  id: 'milestone-180',
  category: 'scoreboard',
  priority: 10,
  duration: 3000,
  templates: { en: '{{playerName}} just threw {{score}}!', de: '{{playerName}} hat gerade {{score}} geworfen!' },
  requiredParams: ['playerName', 'score'],
});

// later
this.emitTemplatedIntent('scoreboard.milestone', 'milestone-180', { playerName: 'Max', score: 180 }, 'en');
```

### Default Subscriptions

Modules can define default event-to-action mappings. These are pre-configured reactions a module will offer out of the box (the user can still change them in the UI, stored as `intentSubscriptions` in the module's config):

```json
{
  "defaultSubscriptions": [
    {
      "event": "player.change",
      "action": "solidColor",
      "config": { "usePlayerColor": true }
    }
  ]
}
```

### When to Use Intents vs Events

| Use Case | Solution |
|----------|----------|
| React to game happenings (throws, player changes, etc.) | Subscribe to **Events** |
| Trigger another module's functionality | Call an **Intent Action** |
| Let other modules use your functionality | Expose **Intent Actions** |
| Broadcast that something happened | Emit an **Intent** |

## Internationalization (i18n)

Modules can provide translations for multiple languages. The default language is English, which should be used for all labels in the `config` section. Translations are provided in the `i18n` section.

### Supported Languages

The hub UI itself ships with these ten; a module can provide translations for any subset.

| Code | Language |
|------|----------|
| `en` | English (default) |
| `de` | German |
| `es` | Spanish |
| `fr` | French |
| `it` | Italian |
| `nl` | Dutch |
| `ja` | Japanese |
| `zh` | Chinese |
| `ru` | Russian |
| `uk` | Ukrainian |

### i18n Structure

```json
{
  "id": "my-module",
  "name": "My Module",
  "description": "Module description in English",
  "config": {
    "hostAddress": {
      "type": "string",
      "label": "Host Address",
      "description": "IP address of the server"
    }
  },
  "i18n": {
    "en": {
      "name": "My Module",
      "description": "Module description in English",
      "config": {
        "hostAddress": {
          "label": "Host Address",
          "description": "IP address of the server"
        }
      },
      "strings": {
        "connectionSuccess": "Connected successfully!",
        "connectionFailed": "Connection failed"
      }
    },
    "de": {
      "name": "Mein Modul",
      "description": "Modulbeschreibung auf Deutsch",
      "config": {
        "hostAddress": {
          "label": "Host-Adresse",
          "description": "IP-Adresse des Servers"
        }
      },
      "strings": {
        "connectionSuccess": "Erfolgreich verbunden!",
        "connectionFailed": "Verbindung fehlgeschlagen"
      }
    }
  }
}
```

### i18n Translation Fields

| Field | Description |
|-------|-------------|
| `name` | Translated module name |
| `description` | Translated module description |
| `config` | Translations for config fields |
| `config.[key].label` | Translated field label |
| `config.[key].description` | Translated field description |
| `config.[key].options` | Translations for select options (key: value pairs) |
| `strings` | Custom strings used by the module's frontend |

### Using Translations in Frontend

```typescript
// Load translated module manifest
const response = await fetch(`/api/modules/${moduleId}/translations/${language}`)
const { manifest, strings, availableLanguages } = await response.json()

// Use translated strings
const successMessage = strings.connectionSuccess || 'Connected!'
```

### Language Fallback

The translation system uses the following fallback order:
1. Requested language (e.g. `de`)
2. English (`en`) as fallback
3. Original values from the manifest

This ensures modules work even if translations are incomplete.

### Module Init Payload (process modules)

When a process module's `onInit(config)` is called, the hub has already sent an `init` IPC message with:

```typescript
interface InitPayload {
  moduleId: string;
  config: Record<string, unknown>;
  hubVersion: string;
  subscribedEvents: string[];
}
```

## Events

Modules can react to the following Autodarts events. `type` is one of a fixed `AutodartsEventType` union - see [API Documentation](api.md#autodarts-events) for every payload field.

### Native Events (forwarded from Autodarts)

| Event | Description | Important Data |
|-------|-------------|------------------|
| `board.state` | Board connects/disconnects | board connection info |
| `board.event` | Any other raw board event | event-specific |
| `match.start` | Match started | `matchId`, `boardId` |
| `match.state` | Match status update | `players`, `gameScores`, `player`, `round`, `settings` |
| `match.delete` | Match cancelled | `matchId`, `boardId` |
| `match.finish` | User dismisses the results screen | `matchId`, `boardId` |
| `throw.detected` | Throw detected | `segment`, `coords?`, `throwNumber`, `boardId`, `points`, `turnId`, `turnPoints`, `busted` (the last three only for throws taken from `match.state`, the normal case); in Cricket/Tactics also `marks`, `turnMarks` |
| `takeout.started` | Dart removal started | `boardId` |
| `takeout.finished` | Dart removal finished | `boardId` |

### Synthetic Events (generated by the hub's `EventParser`)

| Event | Description | Important Data |
|-------|-------------|------------------|
| `player.change` | Active player changed | `previousPlayer`, `currentPlayer`, `playerIndex`, `playerName`, `remaining` |
| `turn.finished` | Turn finished | `playerIndex`, `playerName`, `turnScore`, `busted`, `remaining`, `round`; in Cricket/Tactics also `turnMarks` |
| `game.finished` | Leg won | `winner`, `winnerName`, `winnerPlayerIndex`, `leg`, `set` |
| `match.finished` | Match won | `winner`, `winnerName`, `winnerPlayerIndex`, `scores` |
| `match.result` | Full result data, emitted alongside `match.finished` | `chalkboards`, `stats`, `scores`, `settings` |
| `cricket.state` | Cricket/Tactics state: points and marks per field per player | `matchId`, `set`, `leg`, `mode`, `cutThroat`, `fields`, `deadFields`, `players[].{index,name,points,marks}` |
| `cricket.closed` | Cricket/Tactics: a player closes a field with the third mark | `matchId`, `set`, `leg`, `field`, `playerIndex`, `playerName` |

> **Note:** Synthetic events provide convenient hooks for modules. `turn.finished` is triggered when 3 darts have been thrown, a bust occurs, or the round number changes.

> **Note on `game`:** `match.state`, `throw.detected`, `turn.finished`, `player.change`, `game.finished`, `match.finished`, `match.result`, `cricket.state` and `cricket.closed` additionally carry `data.game: { variant: string; mode: 'x01' | 'cricket' | 'tactics' | 'other'; cutThroat: boolean }`. `match.start`, `match.delete` and `match.finish` do not carry `game`.

> **Bull-off:** during the Autodarts variant "Bull-off" `match.state` carries `bullOff: { players: [{ index, name, distance, x, y }], finished, winnerIndex }` (distance to the bull in mm, `null` until thrown; `x`/`y` normalized, radius 1 = 170 mm; `winnerIndex` = `player.index` of the player who starts), otherwise `null`. The bull-off never emits `game.finished`.

### Cricket and Tactics Data

Cricket and Tactics (a Cricket variant using fields 10 to 20 instead of 15 to 20) run over the same events as X01, with the extra fields above. Fields are strings `'10'` to `'20'` plus `'25'` for Bull. Players are keyed by the stable `index` (not the array position), so they stay identifiable across the player array rotation after a leg.

`throw.detected` in Cricket/Tactics, in addition to the usual fields:

```json
{
  "segment": { "name": "20", "number": 20, "multiplier": 1, "bed": "Single" },
  "points": 20,
  "turnId": "abc123",
  "marks": 1,
  "turnMarks": 2,
  "game": { "variant": "Cricket", "mode": "cricket", "cutThroat": false }
}
```

`marks` is the number of marks scored by this one dart, `turnMarks` the running total for the turn up to and including this dart (so a 180 is visible on the third dart). `turn.finished` only carries `turnMarks` (the whole turn's total).

`cricket.state`, sent on the first Cricket state and whenever marks or points change:

```json
{
  "matchId": "match-1",
  "set": 1,
  "leg": 1,
  "mode": "cricket",
  "cutThroat": false,
  "fields": ["20", "19", "18", "17", "16", "15", "25"],
  "deadFields": ["20"],
  "players": [
    { "index": 0, "name": "Anna", "points": 24, "marks": { "20": 3, "19": 1, "18": 0, "17": 0, "16": 0, "15": 0, "25": 0 } },
    { "index": 1, "name": "Max", "points": 12, "marks": { "20": 3, "19": 0, "18": 0, "17": 0, "16": 0, "15": 0, "25": 0 } }
  ]
}
```

`cricket.closed`, once per field and player within a leg, never for fields that were already closed in a previous state (e.g. after a hub restart):

```json
{ "matchId": "match-1", "set": 1, "leg": 1, "field": "20", "playerIndex": 0, "playerName": "Anna" }
```

**A strong turn is not a hub event.** There is no `turn.strong` or similar; modules compare `turnMarks` (from `throw.detected` or `turn.finished`) with their own threshold (3 to 9, default 6). WLED and Darts Caller are the reference implementations.

`GET /api/match/current` additionally returns `cricket` (same shape as `cricket.state`, `null` outside Cricket/Tactics) and `turns` (an array with the last turn).

### Module-Level Throw Sub-Keys (not hub events)

There is no `throw.triple`, `throw.double`, `throw.180`, `throw.bullseye`, `throw.bull`, `throw.miss`, or `throw.highfinish` event on the hub's event bus or WebSocket. `cricket.marks` (strong turn) is not a hub event either. Some modules (the WLED module is the reference implementation, see `modules/wled/src/WledHandler.ts`) derive these as internal lookup keys from a `throw.detected` payload purely to pick a per-event action in their own config:

```typescript
function getThrowEventKey(data: { turnPoints?: number; busted?: boolean; segment?: { number?: number; multiplier?: number }; points?: number }): string {
  const { turnPoints = 0, segment, points = 0 } = data;
  const { number = 0, multiplier = 0 } = segment ?? {};
  if (turnPoints === 180) return 'throw.180';
  if (data.busted) return 'throw.bust';
  if (number === 25 && multiplier === 2) return 'throw.bullseye';
  if (number === 25 && multiplier === 1) return 'throw.bull';
  if (multiplier === 3) return 'throw.triple';
  if (multiplier === 2) return 'throw.double';
  if (points === 0) return 'throw.miss';
  return 'throw.detected';
}
```

In the `throw.detected` payload `points` is the value of the dart, `turnPoints` the running turn total including this dart (180 on the third T20), and `busted` is true only on the dart that caused a bust.

If your module's UI should offer per-throw-type actions, implement the same kind of derivation yourself; there is no hub-provided helper for it today.

## Custom API Routes (Module Routes)

Modules can register custom API endpoints that are available at `/api/modules/<module-id>/routes/`. If you extend `AutodartsModule` from `@autodarts-hub/module-sdk`, use its built-in route API instead of hand-rolling IPC messages:

### Registering Routes

```typescript
import { AutodartsModule, type ModuleRouteDefinition } from '@autodarts-hub/module-sdk';

class MyModule extends AutodartsModule {
  protected async onInit(): Promise<void> {
    const routes: ModuleRouteDefinition[] = [
      { method: 'GET', path: '/status', handlerId: 'getStatus', description: 'Get module status' },
      { method: 'POST', path: '/test', handlerId: 'runTest', description: 'Run a test action' },
      { method: 'GET', path: '/effects/:id', handlerId: 'getEffect', description: 'Get effect by ID' },
    ];

    this.registerRoutes(routes);

    this.setRouteHandler('getStatus', async () => ({
      statusCode: 200,
      body: { status: 'ok', connected: true },
    }));

    this.setRouteHandler('runTest', async (request) => {
      await runTestAction(request.body);
      return { statusCode: 200, body: { success: true } };
    });

    this.setRouteHandler('getEffect', async (request) => {
      const effect = getEffectById(request.params.id);
      return { statusCode: effect ? 200 : 404, body: effect ?? { error: 'Not found' } };
    });
  }

  protected async onEvent(): Promise<void> {}
}
```

`registerRoutes` and `setRouteHandler` are protected methods on `AutodartsModule`; call them from inside your module class (e.g. in `onInit`).

### Route Definition Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `method` | string | Yes | HTTP method (GET, POST, PUT, PATCH, DELETE) |
| `path` | string | Yes | Path relative to `/api/modules/:moduleId/routes/` |
| `handlerId` | string | Yes | Unique identifier for the handler |
| `description` | string | No | Description of the endpoint |
| `requireAuth` | boolean | No | Authentication required (default: true) |
| `schema` | object | No | JSON schema for validation |

### Calling from Frontend

```typescript
// Call module route
const response = await fetch('/api/modules/my-module/routes/status');
const status = await response.json();

// With body
await fetch('/api/modules/my-module/routes/test', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'flash' }),
});
```

## Frontend Development

Modules can include their own frontend, served at `/module-ui/<module-id>/`.

### Setup

```bash
cd modules/my-module/web
npm init -y
npm install vue vite @vitejs/plugin-vue
```

### vite.config.ts

```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: '/module-ui/my-module/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        ws: true,
      },
    },
  },
})
```

### WebSocket Connection

Modules can connect to the hub WebSocket:

```typescript
const ws = new WebSocket(`ws://${window.location.host}/api/events`)

ws.onmessage = (event) => {
  const message = JSON.parse(event.data)

  switch (message.type) {
    case 'status':
      // Connection status
      break
    case 'event':
      // Autodarts event: message.event.type, message.event.data
      handleEvent(message.event)
      break
    case 'log':
      // Log entry
      break
  }
}

function handleEvent(event: { type: string; data: unknown }) {
  switch (event.type) {
    case 'throw.detected':
      // Process throw
      break
    case 'player.change':
      // Player change
      break
  }
}
```

### API Calls

Modules can use the hub API:

```typescript
// Load module configuration
const config = await fetch('/api/modules/my-module/config')
  .then(r => r.json())

// Save configuration
await fetch('/api/modules/my-module/config', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ key: 'value' })
})

// Load players (for colors etc.)
const players = await fetch('/api/players').then(r => r.json())
```

## Installation

### From Git Repository

Modules can be installed directly from Git:

```bash
# Via web UI
# Or via API:
curl -X POST http://localhost:3000/api/modules/install \
  -H "Content-Type: application/json" \
  -d '{"source": "git", "url": "https://github.com/user/my-module.git"}'
```

### Local Installation

For development, modules can be installed locally:

```bash
# Link module folder
ln -s /path/to/my-module modules_installed/my-module
```

## Best Practices

### 1. Error Handling

```typescript
try {
  await sendToDevice(payload)
} catch (error) {
  console.error(`Module error: ${error.message}`)
  // Module should not crash
}
```

### 2. Validate Configuration

```typescript
function validateConfig(config) {
  if (!config.hostAddress) {
    throw new Error('Host address is required')
  }
  // Additional validations...
}
```

### 3. Release Resources

```typescript
protected async onShutdown(reason: string): Promise<void> {
  if (wsConnection) {
    wsConnection.close()
  }
}
```

### 4. Use Player Colors

```typescript
// Color from event or player management
const playerColor = event.data.color || '#ffffff'
```

### 5. Temporary Effects with Player Color Restore

```typescript
// Effect with automatic restore to player color (recommended)
async function flashEffect(duration = 1000, playerColor: string) {
  await setEffect('flash')

  setTimeout(async () => {
    // Restore to player color, not previous device state
    await setColor(playerColor)
  }, duration)
}
```

> **Best Practice:** For temporary effects, restore to the current player's color instead of the previous device state. This ensures consistent behavior even if the previous state was incorrect or unknown.

### 6. Fade Time / Transitions

```typescript
// Support smooth transitions for color changes
async function setColorWithFade(color: string, fadeTimeMs: number) {
  const payload = {
    seg: [{ col: [[r, g, b]] }],
    tt: Math.round(fadeTimeMs / 100) // WLED uses 100ms units; tt applies to this call only
  }
  await sendToDevice(payload)
}
```

> **Note:** Use `tt` for a per-command fade. `transition` changes the controller's default transition for every later command.

### 7. Single-Player Support

```typescript
// Handle both single-player and multi-player games
async function handlePlayerChange(event) {
  // This event fires for both single and multi-player games
  const playerColor = event.data.color || '#ffffff'
  await setColor(playerColor)
}

async function handleTakeoutFinished(event) {
  // Restore player color after dart removal
  // Works for both single and multi-player
  const currentPlayer = getCurrentPlayerFromMatchState()
  await setColor(currentPlayer.color)
}
```

### 8. Player-Specific Configuration Overrides

Modules can support player-specific settings that override the default configuration when a particular player is active. This pattern is used by WLED, Darts Caller, and Game Display modules.

#### Configuration Structure

```json
{
  "config": {
    "playerOverrides": {
      "type": "array",
      "label": "Player Overrides",
      "description": "Player-specific configuration overrides",
      "default": [],
      "hidden": true
    }
  }
}
```

#### Override Data Structure

```typescript
interface PlayerOverride {
  playerId?: string      // Optional Autodarts player ID
  playerName: string     // Player name (for display and fallback matching)
  // Module-specific fields:
  color?: string         // e.g. for WLED
  animations?: {         // e.g. for Game Display
    '180'?: { enabled: boolean; url?: string; sound?: string }
    legWin?: { enabled: boolean; url?: string; sound?: string }
    // ...
  }
  voiceStyle?: string    // e.g. for Darts Caller
}
```

#### Implementing Player Matching

**Important:** Autodarts sends player names in lowercase. Always use case-insensitive comparisons:

```typescript
function getPlayerOverride(
  playerOverrides: PlayerOverride[],
  playerName?: string,
  playerId?: string
): PlayerOverride | undefined {
  if (!playerOverrides || playerOverrides.length === 0) {
    return undefined
  }

  // 1. Try matching by playerId first (exact match)
  if (playerId) {
    const byId = playerOverrides.find(p => p.playerId === playerId)
    if (byId) return byId
  }

  // 2. Try matching by playerName (case-insensitive!)
  if (playerName) {
    const byName = playerOverrides.find(
      p => p.playerName.toLowerCase() === playerName.toLowerCase()
    )
    if (byName) return byName
  }

  return undefined
}
```

#### UI Integration

The hub provides the `GET /api/players` endpoint which lists registered players. Modules can use this to let users select players for overrides:

```typescript
// Load available players
const players = await fetch('/api/players').then(r => r.json())

// players: Array<{ id: string, name: string, color?: string }>
```

#### Event Handling with Overrides

```typescript
async function handleEvent(event: GameEvent) {
  const { playerName, playerId } = event.data

  // Get player-specific config
  const playerOverride = getPlayerOverride(
    config.playerOverrides,
    playerName,
    playerId
  )

  if (playerOverride?.animations?.['180']?.enabled) {
    // Use player-specific animation
    await playAnimation(playerOverride.animations['180'].url)
  } else if (config.animations?.['180']?.enabled) {
    // Fall back to default config
    await playAnimation(config.animations['180'].url)
  }
}
```

> **Best Practice:** Always check player-specific overrides first, then fall back to default module configuration. This allows for personalized experiences per player while maintaining defaults for unconfigured players.

## Example Modules

### Minimal Module

```json
{
  "id": "minimal",
  "name": "Minimal Module",
  "version": "1.0.0",
  "entry": "dist/index.js",
  "events": ["throw.detected"]
}
```

### Module with UI

See the [Game Display module](../../modules/game-display/) as reference for a built-in module with a custom Vue.js frontend.

### Module with External Hardware

See the [WLED module](../../modules/wled/) as reference for a module that controls external hardware with:
- Duration-based effects that restore to player color
- Configurable fade time (transitions)
- Single-player and multi-player support
- Event-based action configuration, including module-level throw sub-keys (see above)
- Intent system support for module-to-module communication

### Module with Audio/TTS

See the [Darts Caller module](../../modules/darts-caller/) as reference for a module that:
- Uses browser TTS, ElevenLabs live TTS, voice packs, or custom audio files
- Includes a Voice Pack Generator powered by ElevenLabs
- Supports multiple output modes

### Process Module Example

The Autodarts Trainer module (developed separately, not part of this repository) is an example of a module that runs as its own process (`entry: "dist/index.js"`) and registers its own REST routes (`/api/trainer/*`) directly rather than through the Module Routes mechanism above.

## Debugging

### Logs

Module activities are shown in the hub log:

1. Open the web interface
2. Go to **Logs** (`/logs`)
3. Filter by your module

### Browser DevTools

For frontend modules:

1. Open `/module-ui/my-module/`
2. Open browser developer tools (F12)
3. Check Console and Network tab

## WebSocket Events for Module UIs

Module frontends can listen for special WebSocket events (see [API Documentation](api.md#websocket-api) for the full list):

### caller Event

For the Darts Caller module - triggers audio playback in the browser:

```typescript
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data)
  if (msg.type === 'caller') {
    const { text, audioFile } = msg.request
    // Play audio or use TTS
    if (audioFile) {
      playAudio(audioFile)
    } else {
      speakText(text)
    }
  }
}
```

### module Event

Notifies about module status changes:

```typescript
{
  "type": "module",
  "moduleId": "wled",
  "status": "running" // or "stopped", "error"
}
```

---

## AI Features in Modules

There is currently **no IPC message** that lets a process module call the hub's AI provider system directly (no `ai.request`/`ai.response` round trip exists in `@autodarts-hub/module-sdk`). Two options work today:

1. **In-process (built-in) modules** can import the service directly, the way the Darts Caller module does for ElevenLabs:

   ```typescript
   import { getAIProviderService } from '../../../src/core/ai/index.js';

   const service = getAIProviderService();
   const result = await service.generateSpeech({ text: 'One hundred and eighty!' }, 'elevenlabs');
   ```

2. **Process modules** can call the hub's own REST API over HTTP, since it is just a local server:

   ```typescript
   const response = await fetch('http://localhost:3000/api/ai/generate/speech', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ providerId: 'elevenlabs', text: 'One hundred and eighty!' }),
   });
   ```

   This only works out of the box while web auth is disabled on the hub; if web auth is enabled, every `/api/ai/*` route requires a session cookie (see [API Documentation](api.md#authentication)), and a module would need to log in itself to get one.

### Available AI Providers

| Provider | Capabilities | Module Use Cases |
|----------|---------------|--------------------|
| **ElevenLabs** | Text-to-Speech | Voice packs, player name synthesis, custom announcements |
| **Runway ML** | Video generation | Custom celebration animations (one of two engines) |
| **Higgsfield** | Image/video generation | Custom celebration animations (the other engine) |
| **OpenAI** | Text, images | Dynamic content, image generation |
| **Anthropic** | Text | Content generation, analysis |
| **Stability AI** | Images | Custom graphics |
| **Ollama** | Text (local) | Local AI inference |
| **Replicate** | Various | Custom hosted models |

## License

IO-Darts-Agent itself is licensed under the PolyForm Noncommercial License 1.0.0. The module SDK in `module-sdk/` (`@autodarts-hub/module-sdk`) is licensed under the MIT License ([module-sdk/LICENSE](../../module-sdk/LICENSE)), so third-party modules can use it freely.

## Support

For questions or problems:

1. Check the [API Documentation](api.md)
2. Look at the example modules in `/modules/`
3. Open an issue in the GitHub repository
