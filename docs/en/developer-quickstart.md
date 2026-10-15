# Developer Quick Start Guide

This guide shows you how to create your own module for IO-Darts-Agent in just a few minutes.

> **Note:** This guide is for **module developers**. If you want to work on the hub itself, see [Developer Guide](developer-guide.md).

## TL;DR - Module in 5 Minutes

```bash
# 1. Create module folder
mkdir -p modules/my-module

# 2. Create manifest
cat > modules/my-module/module.json << 'EOF'
{
  "id": "my-module",
  "name": "My Module",
  "version": "1.0.0",
  "description": "My first module",
  "entry": "internal",
  "events": ["throw.detected"]
}
EOF

# 3. Start the hub once, then stop it with Ctrl+C
#    (creates modules_installed/ with the built-in modules)
npm run dev

# 4. Link into modules_installed
ln -s ../modules/my-module modules_installed/my-module

# 5. Restart the hub
npm run dev
```

Start the hub once before you create the link: on start, the hub installs the built-in modules (WLED, Darts Caller, Game Display) only if `modules_installed/` is empty. If your link is already there, it skips the built-in modules.

Done! Your module now appears in the web interface under **Modules**. With `npm run dev` the hub serves no web UI; start the Vite dev server as well (`cd web && npm run dev`) and open `http://localhost:5173/modules`.

> `entry: "internal"` only works if you also add code inside the hub to run it (see [Module Types](developer-guide.md#module-types)). For a real, independently running module, give it a process entry point instead - see step 2 below and the [Module SDK](module-sdk.md).

---

## Step-by-Step Guide

### 1. Understand Module Structure

A module consists of at least a `module.json`:

```
my-module/
├── module.json      # Required: module manifest
├── package.json     # Required for a process module (your entry point and deps)
├── README.md        # Optional: documentation
└── web/             # Optional: custom frontend
    └── ...
```

### 2. Create Manifest (module.json)

The manifest defines your module. `events` lists the Autodarts event types your module can be configured to react to in the UI - see [Autodarts Events](#4-receive-events) below for the full, real list:

```json
{
  "id": "my-module",
  "name": "My Module",
  "version": "1.0.0",
  "description": "Description of what the module does",
  "author": "Your Name",
  "entry": "dist/index.js",
  "events": [
    "throw.detected",
    "player.change",
    "match.start"
  ],
  "config": {
    "serverUrl": {
      "type": "string",
      "label": "Server URL",
      "required": true
    },
    "enabled": {
      "type": "boolean",
      "label": "Enabled",
      "default": true
    }
  }
}
```

For a process module, `entry` points to the compiled JS file the hub will run with `node` (e.g. `dist/index.js`); the hub connects to it over a Unix domain socket using the `@autodarts-hub/module-sdk` package. `entry: "internal"` is only for modules whose code is wired directly into the hub itself.

### 3. Configuration Fields

| Type | Example |
|------|---------|
| `string` | Text input |
| `number` | Number input with min/max |
| `boolean` | Toggle/checkbox |
| `select` | Dropdown with `options[]` |
| `color` | Color picker |
| `group` | Nested fields, optionally shown conditionally via `showIf` |
| `provider-select` | Dropdown of configured AI providers, optionally filtered by capability |

```json
{
  "config": {
    "text": { "type": "string", "label": "Text", "default": "Hello" },
    "port": { "type": "number", "label": "Port", "default": 80, "min": 1, "max": 65535 },
    "active": { "type": "boolean", "label": "Active", "default": true },
    "mode": {
      "type": "select",
      "label": "Mode",
      "options": [
        { "value": "a", "label": "Option A" },
        { "value": "b", "label": "Option B" }
      ]
    },
    "color": { "type": "color", "label": "Color", "default": "#ff0000" }
  }
}
```

### 4. Receive Events

Your module can react to these events. `type` is one of a fixed set (`AutodartsEventType`); see [API Documentation](api.md#autodarts-events) for every payload field.

#### Native Events (forwarded from Autodarts)

| Event | When | Important Data |
|-------|------|-----------------|
| `match.start` | Match starts | `matchId`, `boardId` |
| `match.state` | State update | `players`, `gameScores`, `player`, `round`, `settings` |
| `match.delete`, `match.finish` | Match cancelled / results dismissed | `matchId`, `boardId` |
| `throw.detected` | Throw detected | `segment`, `points` *(derived field, see note)*, `remaining`, `throwNumber` |
| `takeout.started`, `takeout.finished` | Darts being/just removed | `boardId` |

#### Synthetic Events (derived by the hub's `EventParser` from `match.state`)

| Event | When | Important Data |
|-------|------|-----------------|
| `player.change` | Active player changes | `previousPlayer`, `currentPlayer`, `playerIndex`, `playerName`, `remaining` |
| `turn.finished` | Turn ends (3 darts, bust, or round change) | `playerIndex`, `playerName`, `turnScore`, `busted`, `remaining` |
| `game.finished` | A leg is won | `winner`, `winnerName`, `winnerPlayerIndex`, `leg`, `set` |
| `match.finished` / `match.result` | The match is won | `winner`, `winnerName`, `winnerPlayerIndex`, `scores`, `stats` (on `match.result`) |

> **Tip:** Use the synthetic events for most module logic - they provide convenient hooks without parsing raw state.

> **Note:** There is no hub-level `throw.triple`, `throw.180`, `player.changed`, `match.started`, etc. - those only exist as keys *inside* a specific module's own event handling (e.g. the WLED module derives them from the `throw.detected` payload). If you need them, derive them yourself from `throw.detected`/`turnPoints` in your module's own code, the way `modules/wled/src/WledHandler.ts` does.

### 5. Custom Frontend (optional)

If your module needs a UI:

```bash
cd modules/my-module
mkdir web && cd web
npm init -y
npm pkg set scripts.build="vite build"
npm install vue vite @vitejs/plugin-vue
```

`npm pkg set` adds the build script to `package.json` (`"build": "vite build"`). Vite also needs an `index.html` and an entry file:

**index.html:**
```html
<!DOCTYPE html>
<html>
  <head><meta charset="UTF-8"><title>My Module</title></head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

**src/main.ts:**
```typescript
import { createApp, h } from 'vue'

createApp({ render: () => h('h1', 'My Module') }).mount('#app')
```

**vite.config.ts:**
```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: '/module-ui/my-module/',  // Important!
  build: { outDir: 'dist' }
})
```

**WebSocket Connection:**
```typescript
const ws = new WebSocket(`ws://${location.host}/api/events`)

ws.onmessage = (e) => {
  const msg = JSON.parse(e.data)
  if (msg.type === 'event') {
    console.log('Event:', msg.event.type, msg.event.data)
  }
}
```

### 6. Test Module

```bash
# Build the frontend (if present)
cd modules/my-module/web && npm run build

# Start the hub
cd ../../..
npm run dev

# In a second terminal: start the web UI dev server
cd web && npm run dev
```

With `npm run dev` the hub serves no web UI, so the Vite dev server is needed. Open `http://localhost:5173/modules` and check that your module appears.

No physical dartboard? Enable **Developer Mode** in Settings, then use `http://localhost:5173/developer` (or `POST /api/developer/simulate/*`, see [API Documentation](api.md#developer-mode)) to simulate matches, throws, and whole scenarios like a 180 or a bust.

---

## Example: Webhook Module

A simple module that calls a webhook on every throw:

**modules/webhook/module.json:**
```json
{
  "id": "webhook",
  "name": "Webhook Notifier",
  "version": "1.0.0",
  "description": "Sends events to a webhook",
  "entry": "dist/index.js",
  "events": ["throw.detected", "match.start", "match.finished"],
  "config": {
    "webhookUrl": {
      "type": "string",
      "label": "Webhook URL",
      "description": "The URL to send events to",
      "required": true
    },
    "sendThrows": {
      "type": "boolean",
      "label": "Send Throws",
      "default": true
    }
  }
}
```

**modules/webhook/src/index.ts** (process entry point, using the module SDK):
```typescript
import { AutodartsModule } from '@autodarts-hub/module-sdk';

class WebhookModule extends AutodartsModule {
  private webhookUrl = '';

  protected async onInit(config: Record<string, unknown>): Promise<void> {
    this.webhookUrl = (config.webhookUrl as string) || '';
  }

  protected async onEvent(event: { type: string; data: unknown }): Promise<void> {
    if (!this.webhookUrl) return;
    await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
  }
}

new WebhookModule().start();
```

---

## Tips

### Debugging

1. Open `http://localhost:3000/logs` for live events.
2. Browser DevTools for frontend errors.
3. Terminal for hub/module process logs.

### Best Practices

- **Error Handling**: catch all errors so your module doesn't crash.
- **Player Colors**: use `event.data.color` where present, otherwise resolve via `GET /api/players`.
- **Duration Effects**: restore to the player's color after an effect, not the previous device state.
- **Fade Time**: support smooth transitions with a configurable fade time.
- **Single-Player**: handle single-player games too (react to `player.change` and `takeout.finished`, not just player-count checks).
- **Array rotation**: Autodarts rotates the players array after every leg - use the stable `playerIndex`/`winnerPlayerIndex` fields, not array position. See [Developer Guide](developer-guide.md#autodarts-array-rotation-on-leg-changes).

### Publishing

1. Create a Git repository.
2. Push your module.
3. Users can install it via: **Modules -> Install -> Git URL**.

---

## Reference

- [Full API Documentation](api.md)
- [Detailed SDK Documentation](module-sdk.md)
- [WLED Module](../../modules/wled/) - external hardware control, runs inside the hub process
- [Game Display](../../modules/game-display/) - built-in module with its own Vue.js frontend
- [Darts Caller](../../modules/darts-caller/) - built-in module with audio/TTS and the Voice Pack Generator
- Autodarts Trainer (developed separately, not in this repository) - process module with its own `/api/trainer/*` REST routes
