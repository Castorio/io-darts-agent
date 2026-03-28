# IO-Darts-Agent - Module SDK

Diese Dokumentation beschreibt, wie du eigene Module für den IO-Darts-Agent entwickeln kannst.

## Übersicht

Module sind eigenständige Erweiterungen, die auf Autodarts-Events reagieren und verschiedene Aktionen ausführen können. Jedes Modul besteht aus:

1. **Manifest** (`module.json`) - Metadaten und Konfigurationsschema
2. **Event Handler** - Code, der auf Events reagiert (optional, für interne Module)
3. **Web UI** - Eigene Benutzeroberfläche (optional)

## Modul-Struktur

```
my-module/
├── module.json          # Manifest (erforderlich)
├── README.md            # Dokumentation
├── web/                 # Frontend (optional)
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── main.ts
│       ├── App.vue
│       └── ...
└── dist/                # Build-Output des Frontends
```

## Manifest (module.json)

Das Manifest definiert alle Metadaten und die Konfiguration deines Moduls:

```json
{
  "id": "my-module",
  "name": "My Awesome Module",
  "version": "1.0.0",
  "description": "Beschreibung des Moduls",
  "author": "Dein Name",
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
      "label": "Server-Adresse",
      "description": "IP-Adresse oder Hostname des Servers",
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
      "label": "Aktiviert",
      "default": true
    },
    "mode": {
      "type": "select",
      "label": "Modus",
      "default": "normal",
      "options": [
        { "value": "normal", "label": "Normal" },
        { "value": "advanced", "label": "Erweitert" }
      ]
    }
  }
}
```

### Manifest-Felder

| Feld | Typ | Erforderlich | Beschreibung |
|------|-----|--------------|--------------|
| `id` | string | Ja | Eindeutige Modul-ID (kebab-case) |
| `name` | string | Ja | Anzeigename |
| `version` | string | Ja | Semantic Version (x.y.z) |
| `description` | string | Nein | Kurzbeschreibung |
| `author` | string | Nein | Autor/Entwickler |
| `entry` | string | Ja | "internal" für Hub-Module |
| `events` | string[] | Nein | Events, auf die reagiert wird |
| `config` | object | Nein | Konfigurationsschema |

### Konfigurations-Feldtypen

#### string
```json
{
  "type": "string",
  "label": "Name",
  "description": "Hilfetext",
  "required": true,
  "default": "Standardwert"
}
```

#### number
```json
{
  "type": "number",
  "label": "Port",
  "default": 80,
  "min": 1,
  "max": 65535
}
```

#### boolean
```json
{
  "type": "boolean",
  "label": "Aktiviert",
  "default": true
}
```

#### select
```json
{
  "type": "select",
  "label": "Modus",
  "default": "normal",
  "options": [
    { "value": "normal", "label": "Normal" },
    { "value": "fast", "label": "Schnell" }
  ]
}
```

#### color
```json
{
  "type": "color",
  "label": "Farbe",
  "default": "#3b82f6"
}
```

## Events

Module können auf folgende Autodarts-Events reagieren:

### Match Events

| Event | Beschreibung | Wichtige Daten |
|-------|-------------|----------------|
| `match.started` | Match gestartet | `players`, `mode`, `startScore` |
| `match.finished` | Match beendet | `winner`, `finalScores` |
| `match.deleted` | Match abgebrochen | `matchId` |
| `match.state` | Match-Status Update | Vollständiger Match-State |

### Wurf Events

| Event | Beschreibung | Wichtige Daten |
|-------|-------------|----------------|
| `throw.detected` | Wurf erkannt | `segment`, `points`, `remaining` |
| `throw.180` | 180er geworfen | - |
| `throw.triple` | Triple getroffen | `segment` |
| `throw.double` | Double getroffen | `segment` |
| `throw.bullseye` | Bullseye (D25) | - |
| `throw.bull` | Single Bull (S25) | - |
| `throw.miss` | Fehlwurf (0 Punkte) | - |
| `throw.bust` | Überworfen | - |

### Spieler Events

| Event | Beschreibung | Wichtige Daten |
|-------|-------------|----------------|
| `player.changed` | Spielerwechsel | `playerIndex`, `playerName`, `color` |
| `turn.started` | Aufnahme gestartet | `playerIndex` |
| `turn.finished` | Aufnahme beendet | `darts`, `turnScore` |

### Spiel Events

| Event | Beschreibung | Wichtige Daten |
|-------|-------------|----------------|
| `game.finished` | Leg/Set gewonnen | `winner`, `checkoutPath` |
| `takeout.started` | Dart-Entnahme | - |
| `takeout.finished` | Dart-Entnahme fertig | - |

## Frontend-Entwicklung

Module können ein eigenes Frontend mitbringen, das unter `/module-ui/<module-id>/` bereitgestellt wird.

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

### WebSocket-Verbindung

Module können sich mit dem Hub-WebSocket verbinden:

```typescript
const ws = new WebSocket(`ws://${window.location.host}/api/events`)

ws.onmessage = (event) => {
  const message = JSON.parse(event.data)

  switch (message.type) {
    case 'status':
      // Verbindungsstatus
      break
    case 'event':
      // Autodarts-Event
      handleEvent(message.data)
      break
    case 'log':
      // Log-Eintrag
      break
  }
}

function handleEvent(event) {
  switch (event.type) {
    case 'throw.detected':
      // Wurf verarbeiten
      break
    case 'player.changed':
      // Spielerwechsel
      break
  }
}
```

### API-Aufrufe

Module können die Hub-API nutzen:

```typescript
// Modul-Konfiguration laden
const config = await fetch('/api/modules/my-module/config')
  .then(r => r.json())

// Konfiguration speichern
await fetch('/api/modules/my-module/config', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ key: 'value' })
})

// Spieler laden (für Farben etc.)
const players = await fetch('/api/players').then(r => r.json())
```

## Installation

### Aus Git-Repository

Module können direkt aus Git installiert werden:

```bash
# Über die Web-UI
# Oder per API:
curl -X POST http://localhost:3000/api/modules/install \
  -H "Content-Type: application/json" \
  -d '{"source": "git", "url": "https://github.com/user/my-module.git"}'
```

### Lokale Installation

Für Entwicklung können Module lokal installiert werden:

```bash
# Modul-Ordner verlinken
ln -s /path/to/my-module modules_installed/my-module
```

## Best Practices

### 1. Fehlerbehandlung

```typescript
try {
  await sendToDevice(payload)
} catch (error) {
  console.error(`Module error: ${error.message}`)
  // Modul sollte nicht crashen
}
```

### 2. Konfiguration validieren

```typescript
function validateConfig(config) {
  if (!config.hostAddress) {
    throw new Error('Host address is required')
  }
  // Weitere Validierungen...
}
```

### 3. Ressourcen freigeben

```typescript
// Bei Modul-Stop Verbindungen schließen
function onStop() {
  if (wsConnection) {
    wsConnection.close()
  }
}
```

### 4. Spielerfarben nutzen

```typescript
// Farbe aus Event oder Spielerverwaltung
const playerColor = event.data.color || '#ffffff'
```

### 5. Temporäre Effekte

```typescript
// Effekt mit automatischem Restore
async function flashEffect(duration = 1000) {
  const previousState = await getDeviceState()
  await setEffect('flash')

  setTimeout(async () => {
    await restoreState(previousState)
  }, duration)
}
```

## Beispiel-Module

### Minimal-Modul

```json
{
  "id": "minimal",
  "name": "Minimal Module",
  "version": "1.0.0",
  "entry": "internal",
  "events": ["throw.detected"]
}
```

### Modul mit UI

Siehe [Game Display Module](/modules/game-display/) als Referenz für ein Modul mit eigenem Frontend.

### Modul mit externer Hardware

Siehe [WLED Module](/modules/wled/) als Referenz für ein Modul, das externe Hardware steuert.

## Debugging

### Logs

Modul-Aktivitäten werden im Hub-Log angezeigt:

1. Öffne das Web-Interface
2. Gehe zu "Logs"
3. Filtere nach deinem Modul

### Browser DevTools

Für Frontend-Module:

1. Öffne `/module-ui/my-module/`
2. Öffne die Browser-Entwicklertools (F12)
3. Prüfe Console und Network-Tab

## Support

Bei Fragen oder Problemen:

1. Prüfe die [API-Dokumentation](api.md)
2. Schaue dir die Beispiel-Module an
3. Öffne ein Issue im GitHub-Repository
