# IO-Darts-Agent - Module SDK

This documentation describes how to develop custom modules for IO-Darts-Agent.

## Overview

Modules are standalone extensions that can react to Autodarts events and perform various actions. Each module consists of:

1. **Manifest** (`module.json`) - Metadata and configuration schema
2. **Event Handler** - Code that reacts to events (optional, for internal modules)
3. **Web UI** - Custom user interface (optional)

## Module Structure

```
my-module/
├── module.json          # Manifest (required)
├── README.md            # Documentation
├── web/                 # Frontend (optional)
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── main.ts
│       ├── App.vue
│       └── ...
└── dist/                # Build output of frontend
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
  "entry": "internal",
  "events": [
    "throw.detected",
    "player.change",
    "match.started",
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
| `entry` | string | Yes | Path to main JS file (e.g., "dist/index.js") or "internal" for hub modules |
| `events` | string[] | No | Events to react to |
| `config` | object | No | Configuration schema |
| `i18n` | object | No | Multi-language translations |
| `intents` | object | No | Intent system configuration |
| `eventMeta` | object | No | Metadata for events (labels, descriptions) |
| `eventGroups` | array | No | Grouping of events for UI |
| `effects` | array | No | List of available effects (e.g., for WLED) |

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
    },
    "throw.180": {
      "label": { "en": "180!", "de": "180!", "es": "¡180!" },
      "description": { "en": "A perfect 180 was thrown", "de": "Eine perfekte 180 wurde geworfen", "es": "Se lanzó un 180 perfecto" }
    }
  }
}
```

This metadata is used in the UI to display human-readable event names and descriptions.

## Event Groups (eventGroups)

Events can be organized into logical groups for better UI presentation:

```json
{
  "eventGroups": [
    {
      "title": { "en": "Match Events", "de": "Match Events", "es": "Eventos de Partido" },
      "events": ["match.started", "match.finished", "match.deleted"]
    },
    {
      "title": { "en": "Throw Events", "de": "Wurf Events", "es": "Eventos de Tiro" },
      "events": ["throw.detected", "throw.triple", "throw.double", "throw.180"]
    },
    {
      "title": { "en": "Player Events", "de": "Spieler Events", "es": "Eventos de Jugador" },
      "events": ["player.changed", "turn.started", "turn.finished"]
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
1. **Expose capabilities** - A module declares what actions it can perform
2. **Be triggered by other modules** - Other modules can call these actions
3. **Provide services** - One module can act as a service provider for others

### Real-World Example: MQTT Module

The MQTT module exposes a `publish` action that other modules can use to send MQTT messages:

```json
{
  "intents": {
    "actions": [
      {
        "type": "publish",
        "label": "Publish Message",
        "description": "Publish a custom message to a topic",
        "configSchema": {
          "topic": { "type": "string", "label": "Topic", "default": "custom/event" },
          "message": { "type": "string", "label": "Message", "default": "{}" },
          "retain": { "type": "boolean", "label": "Retain Message", "default": false }
        }
      }
    ],
    "defaultSubscriptions": []
  }
}
```

**Use Case:** A WLED module could use `mqtt.publish` to send a message to Home Assistant when a specific effect is triggered.

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

**Use Case:** A Caller module could trigger `wled.effect` when announcing a 180.

### Action Definition Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Unique action identifier (used when calling) |
| `label` | string | Yes | Human-readable name for UI display |
| `description` | string | No | Description of what the action does |
| `configSchema` | object | No | Configuration options the caller must/can provide |

### Calling Intent Actions

Other modules can trigger your module's actions through the intent system:

```typescript
// Another module can send an intent to MQTT module
await sendIntent({
  targetModule: 'mqtt',
  action: 'publish',
  payload: {
    topic: 'autodarts/180',
    message: '{"event": "180", "player": "John"}',
    retain: false
  }
});

// Or trigger WLED module
await sendIntent({
  targetModule: 'wled',
  action: 'solidColor',
  payload: {
    color: '#ff0000',
    brightness: 255,
    duration: 2000
  }
});
```

### Default Subscriptions

Modules can define default event-to-action mappings. These are pre-configured reactions that the module will execute when certain events occur:

```json
{
  "defaultSubscriptions": [
    {
      "event": "player.changed",
      "action": "solidColor",
      "config": { "usePlayerColor": true }
    },
    {
      "event": "throw.180",
      "action": "effect",
      "config": { "effectId": 9, "duration": 3000 }
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
| Broadcast that something happened | Emit an **Event** |

**Example Flow:**
1. User throws 180 → `throw.180` **event** fires
2. Caller module receives event → plays "ONE HUNDRED AND EIGHTY" audio
3. Caller module also calls `wled.effect` **intent** → LEDs flash rainbow
4. WLED module also calls `mqtt.publish` **intent** → Home Assistant receives notification

## Internationalization (i18n)

Modules can provide translations for multiple languages. The default language is English, which should be used for all labels in the `config` section. Translations are provided in the `i18n` section.

### Supported Languages

| Code | Language |
|------|----------|
| `en` | English (Default) |
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
    },
    "mode": {
      "type": "select",
      "label": "Mode",
      "options": [
        { "value": "normal", "label": "Normal" },
        { "value": "fast", "label": "Fast" }
      ]
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
        },
        "mode": {
          "label": "Mode",
          "options": {
            "normal": "Normal",
            "fast": "Fast"
          }
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
        },
        "mode": {
          "label": "Modus",
          "options": {
            "normal": "Normal",
            "fast": "Schnell"
          }
        }
      },
      "strings": {
        "connectionSuccess": "Erfolgreich verbunden!",
        "connectionFailed": "Verbindung fehlgeschlagen"
      }
    },
    "es": {
      "name": "Mi Módulo",
      "description": "Descripción del módulo en español",
      "config": {
        "hostAddress": {
          "label": "Dirección del Host",
          "description": "Dirección IP del servidor"
        },
        "mode": {
          "label": "Modo",
          "options": {
            "normal": "Normal",
            "fast": "Rápido"
          }
        }
      },
      "strings": {
        "connectionSuccess": "¡Conectado correctamente!",
        "connectionFailed": "Conexión fallida"
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

// Check available languages
console.log('Available languages:', availableLanguages) // ['en', 'de', 'es']
```

### Language Fallback

The translation system uses the following fallback order:
1. Requested language (e.g., `de`)
2. English (`en`) as fallback
3. Original values from the manifest

This ensures modules work even if translations are incomplete.

### Module Init Payload

When a module is initialized, it receives the current language setting:

```typescript
interface InitPayload {
  moduleId: string;
  config: Record<string, unknown>;
  hubVersion: string;
  subscribedEvents: string[];
  language: string; // Current UI language (e.g., 'de')
}
```

## Events

Modules can react to the following Autodarts events:

### Native Events (from Autodarts)

| Event | Description | Important Data |
|-------|-------------|----------------|
| `match.start` | Match started | `matchId`, `boardId` |
| `match.state` | Match status update | `players`, `gameScores`, `player`, `round`, `settings` |
| `match.finished` | Match finished (winner determined) | `winner`, `winnerName`, `matchId` |
| `match.result` | Match result with full data | `winner`, `winnerName`, `chalkboards`, `stats`, `scores`, `settings` |
| `match.finish` | Match dismissed (user clicked "Finish") | `matchId` |
| `match.delete` | Match cancelled | `matchId` |
| `throw.detected` | Throw detected | `segment`, `points`, `remaining`, `playerIndex` |
| `game.finished` | Leg/Set won | `winner`, `checkoutPath` |
| `takeout.started` | Dart removal started | `matchId` |
| `takeout.finished` | Dart removal finished | `matchId` |

### Synthetic Events (generated by EventParser)

These events are generated by IO-Darts-Agent from `match.state` updates:

| Event | Description | Important Data |
|-------|-------------|----------------|
| `player.changed` | Player changed | `playerIndex`, `playerName`, `remaining`, `players[]` with colors |
| `turn.started` | Turn started | `playerIndex`, `playerName`, `remaining` |
| `turn.finished` | Turn finished | `playerIndex`, `playerName`, `turnScore`, `busted`, `remaining` |

> **Note:** Synthetic events provide convenient hooks for modules. The `turn.finished` event is triggered when:
> - 3 darts have been thrown
> - A bust occurs
> - The round number changes

### Throw Sub-Events

These are derived from `throw.detected` data:

| Event | Trigger | Data |
|-------|---------|------|
| `throw.triple` | `multiplier === 3` | `segment` |
| `throw.double` | `multiplier === 2` | `segment` |
| `throw.bullseye` | `number === 25 && multiplier === 2` | - |
| `throw.bull` | `number === 25 && multiplier === 1` | - |
| `throw.miss` | `points === 0` | - |
| `throw.180` | `turnPoints === 180` | - |
| `throw.highfinish` | Checkout over 100 points | `checkoutScore` |
| `throw.bust` | Match state shows bust | - |

## Custom API Routes (Module Routes)

Modules can register custom API endpoints that are available at `/api/modules/<module-id>/routes/`.

### Registering Routes

```typescript
// In the module - register routes with the Hub
const routes: ModuleRouteDefinition[] = [
  {
    method: 'GET',
    path: '/status',
    handlerId: 'getStatus',
    description: 'Get module status'
  },
  {
    method: 'POST',
    path: '/test',
    handlerId: 'runTest',
    description: 'Run a test action'
  },
  {
    method: 'GET',
    path: '/effects/:id',
    handlerId: 'getEffect',
    description: 'Get effect by ID'
  }
];

// Send via IPC to Hub
sendMessage({
  type: 'routes.register',
  payload: { routes }
});
```

### Implementing Route Handlers

```typescript
// React to route.request from Hub
onMessage('route.request', async (payload: RouteRequestPayload) => {
  const { handlerId, method, params, query, body } = payload;

  switch (handlerId) {
    case 'getStatus':
      return {
        statusCode: 200,
        body: { status: 'ok', connected: true }
      };

    case 'runTest':
      await runTestAction(body);
      return {
        statusCode: 200,
        body: { success: true }
      };

    case 'getEffect':
      const effect = getEffectById(params.id);
      return {
        statusCode: effect ? 200 : 404,
        body: effect || { error: 'Not found' }
      };

    default:
      return {
        statusCode: 404,
        body: { error: 'Handler not found' }
      };
  }
});
```

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
  body: JSON.stringify({ action: 'flash' })
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
      // Autodarts event
      handleEvent(message.data)
      break
    case 'log':
      // Log entry
      break
  }
}

function handleEvent(event) {
  switch (event.type) {
    case 'throw.detected':
      // Process throw
      break
    case 'player.changed':
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
// Close connections when module stops
function onStop() {
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
    transition: Math.round(fadeTimeMs / 100) // WLED uses 100ms units
  }
  await sendToDevice(payload)
}
```

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

## Example Modules

### Minimal Module

```json
{
  "id": "minimal",
  "name": "Minimal Module",
  "version": "1.0.0",
  "entry": "internal",
  "events": ["throw.detected"]
}
```

### Module with UI

See [Game Display Module](/modules/game-display/) as reference for a module with custom Vue.js frontend.

### Module with External Hardware

See [WLED Module](/modules/wled/) as reference for a module that controls external hardware with:
- Duration-based effects that restore to player color
- Configurable fade time (transitions)
- Single-player and multi-player support
- Event-based action configuration
- Intent system support for module-to-module communication

### Module with Audio/TTS

See [Darts Caller Module](/modules/darts-caller/) as reference for a module that:
- Uses browser TTS or audio files
- Includes Voice Pack Generator with ElevenLabs
- Supports multiple output modes (browser, local, audio packs)

## Debugging

### Logs

Module activities are shown in the hub log:

1. Open the web interface
2. Go to "Logs"
3. Filter by your module

### Browser DevTools

For frontend modules:

1. Open `/module-ui/my-module/`
2. Open browser developer tools (F12)
3. Check Console and Network tab

## WebSocket Events for Module UIs

Module frontends can listen for special WebSocket events:

### caller Event

For Darts Caller module - triggers audio playback in browser:

```typescript
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data)
  if (msg.type === 'caller') {
    const { callType, text, audioFile, priority } = msg.data
    // Play audio or use TTS
    if (audioFile) {
      playAudio(audioFile)
    } else {
      speakText(text)
    }
  }
}
```

### module_status Event

Notifies about module status changes:

```typescript
{
  "type": "module_status",
  "data": {
    "moduleId": "wled",
    "status": "running" // or "stopped", "error"
  }
}
```

---

## Support

For questions or problems:

1. Check the [API Documentation](api.md)
2. Look at the example modules in `/modules/`
3. Open an issue in the GitHub repository
