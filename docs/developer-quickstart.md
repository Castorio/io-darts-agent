# Developer Quick Start Guide

Diese Anleitung zeigt dir, wie du in wenigen Minuten ein eigenes Modul für den IO-Darts-Agent erstellst.

> **Hinweis:** Diese Anleitung ist für **Modul-Entwickler**. Wenn du am Hub selbst arbeiten möchtest, siehe [Developer Guide](developer-guide.md).

## TL;DR - Modul in 5 Minuten

```bash
# 1. Modul-Ordner erstellen
mkdir -p modules/my-module

# 2. Manifest erstellen
cat > modules/my-module/module.json << 'EOF'
{
  "id": "my-module",
  "name": "My Module",
  "version": "1.0.0",
  "description": "Mein erstes Modul",
  "entry": "internal",
  "events": ["throw.detected"]
}
EOF

# 3. In modules_installed verlinken
ln -s ../modules/my-module modules_installed/my-module

# 4. Server neu starten
npm run dev
```

Fertig! Dein Modul erscheint jetzt im Web-Interface unter "Module".

---

## Schritt-für-Schritt Anleitung

### 1. Modul-Struktur verstehen

Ein Modul besteht mindestens aus einer `module.json`:

```
my-module/
├── module.json      # Pflicht: Modul-Definition
├── README.md        # Optional: Dokumentation
└── web/             # Optional: Eigenes Frontend
    └── ...
```

### 2. Manifest erstellen (module.json)

Das Manifest definiert dein Modul:

```json
{
  "id": "my-module",
  "name": "Mein Modul",
  "version": "1.0.0",
  "description": "Beschreibung was das Modul macht",
  "author": "Dein Name",
  "entry": "internal",
  "events": [
    "throw.detected",
    "player.changed",
    "match.started"
  ],
  "config": {
    "serverUrl": {
      "type": "string",
      "label": "Server URL",
      "required": true
    },
    "enabled": {
      "type": "boolean",
      "label": "Aktiviert",
      "default": true
    }
  }
}
```

### 3. Konfigurationsfelder

| Typ | Beispiel |
|-----|----------|
| `string` | Text-Eingabe |
| `number` | Zahlen-Eingabe mit min/max |
| `boolean` | Toggle/Checkbox |
| `select` | Dropdown mit options[] |
| `color` | Farbwähler |

```json
{
  "config": {
    "text": { "type": "string", "label": "Text", "default": "Hallo" },
    "port": { "type": "number", "label": "Port", "default": 80, "min": 1, "max": 65535 },
    "active": { "type": "boolean", "label": "Aktiv", "default": true },
    "mode": {
      "type": "select",
      "label": "Modus",
      "options": [
        { "value": "a", "label": "Option A" },
        { "value": "b", "label": "Option B" }
      ]
    },
    "color": { "type": "color", "label": "Farbe", "default": "#ff0000" }
  }
}
```

### 4. Events empfangen

Dein Modul kann auf diese Events reagieren:

| Event | Wann | Wichtige Daten |
|-------|------|----------------|
| `match.started` | Spiel startet | `players`, `mode` |
| `match.finished` | Spiel endet | `winner` |
| `throw.detected` | Wurf erkannt | `segment`, `points`, `remaining` |
| `player.changed` | Spielerwechsel | `playerIndex`, `playerName` |
| `turn.finished` | Aufnahme fertig | `darts[]`, `turnScore` |
| `game.finished` | Leg gewonnen | `winner` |

### 5. Eigenes Frontend (optional)

Wenn dein Modul eine UI braucht:

```bash
cd modules/my-module
mkdir web && cd web
npm init -y
npm install vue vite @vitejs/plugin-vue
```

**vite.config.ts:**
```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: '/module-ui/my-module/',  // Wichtig!
  build: { outDir: 'dist' }
})
```

**WebSocket-Verbindung:**
```typescript
const ws = new WebSocket(`ws://${location.host}/api/events`)

ws.onmessage = (e) => {
  const msg = JSON.parse(e.data)
  if (msg.type === 'event') {
    console.log('Event:', msg.data.type, msg.data)
  }
}
```

### 6. Modul testen

```bash
# Frontend bauen (falls vorhanden)
cd modules/my-module/web && npm run build

# Server starten
cd ../../..
npm run dev
```

Öffne `http://localhost:3000/modules` und prüfe, ob dein Modul erscheint.

---

## Beispiel: Webhook-Modul

Ein einfaches Modul, das bei jedem Wurf einen Webhook aufruft:

**modules/webhook/module.json:**
```json
{
  "id": "webhook",
  "name": "Webhook Notifier",
  "version": "1.0.0",
  "description": "Sendet Events an einen Webhook",
  "entry": "internal",
  "events": ["throw.detected", "match.started", "match.finished"],
  "config": {
    "webhookUrl": {
      "type": "string",
      "label": "Webhook URL",
      "description": "Die URL, an die Events gesendet werden",
      "required": true
    },
    "sendThrows": {
      "type": "boolean",
      "label": "Würfe senden",
      "default": true
    }
  }
}
```

---

## Tipps

### Debugging

1. Öffne `http://localhost:3000/logs` für Live-Events
2. Browser-DevTools für Frontend-Fehler
3. Terminal für Backend-Logs

### Best Practices

- **Fehlerbehandlung**: Fange alle Fehler ab, damit dein Modul nicht crasht
- **Spielerfarben**: Nutze `event.data.color` für Spielerfarben
- **Temporäre Effekte**: Speichere vorherigen Zustand und stelle ihn nach X ms wieder her

### Veröffentlichen

1. Erstelle ein Git-Repository
2. Pushe dein Modul
3. Nutzer können es installieren über: Module → Installieren → Git URL

---

## Referenz

- [Vollständige API-Dokumentation](api.md)
- [Detaillierte SDK-Dokumentation](module-sdk.md)
- [WLED-Modul als Beispiel](../modules/wled/)
- [Game Display als Beispiel mit UI](../modules/game-display/)
