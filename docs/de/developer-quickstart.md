# Developer Quick Start Guide

Diese Anleitung zeigt dir, wie du in wenigen Minuten ein eigenes Modul für den IO-Darts-Agent erstellst.

> **Hinweis:** Diese Anleitung ist für **Modul-Entwickler**. Wenn du am Hub selbst arbeiten möchtest, siehe [Developer Guide](developer-guide.md).

## TL;DR: Modul in 5 Minuten

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

# 3. Hub einmal starten, dann mit Strg+C beenden
#    (legt modules_installed/ mit den mitgelieferten Modulen an)
npm run dev

# 4. In modules_installed verlinken
ln -s ../modules/my-module modules_installed/my-module

# 5. Hub neu starten
npm run dev
```

Starte den Hub einmal, bevor du den Link anlegst: Beim Start installiert der Hub die mitgelieferten Module (WLED, Darts Caller, Game Display) nur, wenn `modules_installed/` leer ist. Liegt dein Link schon dort, überspringt er die mitgelieferten Module.

Fertig! Dein Modul erscheint jetzt im Web-Interface unter **Module**. Mit `npm run dev` liefert der Hub keine Web-UI aus. Starte zusätzlich den Vite-Dev-Server (`cd web && npm run dev`) und öffne `http://localhost:5173/modules`.

> `entry: "internal"` funktioniert nur, wenn du auch Code im Hub ergänzt, der es ausführt (siehe [Modul-Typen](developer-guide.md#modul-typen)). Für ein echtes, eigenständig laufendes Modul gib ihm statt dessen einen Prozess-Entry-Point, siehe Schritt 2 unten und das [Module SDK](module-sdk.md).

---

## Schritt-für-Schritt Anleitung

### 1. Modul-Struktur verstehen

Ein Modul besteht mindestens aus einer `module.json`:

```
my-module/
├── module.json      # Pflicht: Modul-Manifest
├── package.json     # Pflicht für ein Prozess-Modul (Entry-Point und Dependencies)
├── README.md        # Optional: Dokumentation
└── web/             # Optional: Eigenes Frontend
    └── ...
```

### 2. Manifest erstellen (module.json)

Das Manifest definiert dein Modul. `events` listet die Autodarts-Event-Typen, auf die dein Modul in der UI konfiguriert werden kann. Die vollständige, echte Liste steht unter [Events empfangen](#4-events-empfangen) weiter unten:

```json
{
  "id": "my-module",
  "name": "My Module",
  "version": "1.0.0",
  "description": "Beschreibung was das Modul macht",
  "author": "Dein Name",
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
      "label": "Aktiviert",
      "default": true
    }
  }
}
```

Bei einem Prozess-Modul zeigt `entry` auf die kompilierte JS-Datei, die der Hub mit `node` startet (z.B. `dist/index.js`); der Hub verbindet sich dann über einen Unix-Domain-Socket mit dem `@autodarts-hub/module-sdk`-Paket. `entry: "internal"` ist nur für Module, deren Code direkt im Hub selbst verdrahtet ist.

### 3. Konfigurationsfelder

| Typ | Beispiel |
|-----|----------|
| `string` | Text-Eingabe |
| `number` | Zahlen-Eingabe mit min/max |
| `boolean` | Toggle/Checkbox |
| `select` | Dropdown mit `options[]` |
| `color` | Farbwähler |
| `group` | Verschachtelte Felder, optional bedingt sichtbar via `showIf` |
| `provider-select` | Dropdown der konfigurierten KI-Provider, optional nach Fähigkeit gefiltert |

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

Dein Modul kann auf diese Events reagieren. `type` ist einer aus einer festen Menge (`AutodartsEventType`); alle Payload-Felder stehen in der [API-Dokumentation](api.md#autodarts-events).

#### Native Events (von Autodarts weitergeleitet)

| Event | Wann | Wichtige Daten |
|-------|------|-----------------|
| `match.start` | Match startet | `matchId`, `boardId` |
| `match.state` | Status-Update | `players`, `gameScores`, `player`, `round`, `settings` |
| `match.delete`, `match.finish` | Match abgebrochen / Ergebnis geschlossen | `matchId`, `boardId` |
| `throw.detected` | Wurf erkannt | `segment`, `coords?`, `throwNumber`, `boardId`, `points`, `turnPoints`, `busted` (die letzten beiden nur bei Würfen aus `match.state`) |
| `takeout.started`, `takeout.finished` | Darts werden gerade/wurden gezogen | `boardId` |

#### Synthetische Events (vom `EventParser` des Hubs aus `match.state` abgeleitet)

| Event | Wann | Wichtige Daten |
|-------|------|-----------------|
| `player.change` | Spielerwechsel | `previousPlayer`, `currentPlayer`, `playerIndex`, `playerName`, `remaining` |
| `turn.finished` | Aufnahme beendet (3 Darts, Bust oder Rundenwechsel) | `playerIndex`, `playerName`, `turnScore`, `busted`, `remaining` |
| `game.finished` | Ein Leg wird gewonnen | `winner`, `winnerName`, `winnerPlayerIndex`, `leg`, `set` |
| `match.finished` / `match.result` | Das Match wird gewonnen | `winner`, `winnerName`, `winnerPlayerIndex`, `scores`, `stats` (bei `match.result`) |

> **Tipp:** Verwende die synthetischen Events für die meiste Modul-Logik. Sie bieten praktische Hooks, ohne den rohen Zustand parsen zu müssen.

> **Hinweis:** Es gibt kein `throw.triple`, `throw.180`, `player.changed`, `match.started` usw. auf Hub-Ebene. Diese existieren nur als Schlüssel *innerhalb* der Event-Verarbeitung eines konkreten Moduls (so leitet z.B. das WLED-Modul sie aus den Daten von `throw.detected` ab). Brauchst du sie, leite sie selbst aus `throw.detected`/`turnPoints` in deinem eigenen Modul-Code ab, so wie es `modules/wled/src/WledHandler.ts` macht.

### 5. Eigenes Frontend (optional)

Wenn dein Modul eine UI braucht:

```bash
cd modules/my-module
mkdir web && cd web
npm init -y
npm pkg set scripts.build="vite build"
npm install vue vite @vitejs/plugin-vue
```

`npm pkg set` trägt das Build-Skript in `package.json` ein (`"build": "vite build"`). Vite braucht außerdem eine `index.html` und eine Einstiegsdatei:

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
    console.log('Event:', msg.event.type, msg.event.data)
  }
}
```

### 6. Modul testen

```bash
# Frontend bauen (falls vorhanden)
cd modules/my-module/web && npm run build

# Hub starten
cd ../../..
npm run dev

# In einem zweiten Terminal: Dev-Server der Web-UI starten
cd web && npm run dev
```

Mit `npm run dev` liefert der Hub keine Web-UI aus, deshalb brauchst du den Vite-Dev-Server. Öffne `http://localhost:5173/modules` und prüfe, ob dein Modul erscheint.

Kein physisches Dartboard? Aktiviere den **Entwicklermodus** in den Einstellungen und nutze dann `http://localhost:5173/developer` (oder `POST /api/developer/simulate/*`, siehe [API-Dokumentation](api.md#entwicklermodus)), um Matches, Würfe und ganze Szenarien wie eine 180 oder einen Bust zu simulieren.

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
  "entry": "dist/index.js",
  "events": ["throw.detected", "match.start", "match.finished"],
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

**modules/webhook/src/index.ts** (Prozess-Entry-Point, mit dem Module SDK):
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

## Tipps

### Debugging

1. Öffne `http://localhost:3000/logs` für Live-Events.
2. Browser-DevTools für Frontend-Fehler.
3. Terminal für Hub-/Modul-Prozess-Logs.

### Best Practices

- **Fehlerbehandlung**: Fange alle Fehler ab, damit dein Modul nicht crasht.
- **Spielerfarben**: Nutze `event.data.color`, falls vorhanden, sonst löse über `GET /api/players` auf.
- **Temporäre Effekte**: Stelle nach dem Effekt die Spielerfarbe wieder her, nicht den vorherigen Gerätezustand.
- **Fade-Zeit**: Unterstütze sanfte Übergänge mit konfigurierbarer Fade-Zeit.
- **Einzelspieler**: Behandle auch Einzelspieler-Spiele (reagiere auf `player.change` und `takeout.finished`, nicht nur auf die Spieleranzahl).
- **Array-Rotation**: Autodarts rotiert das Spieler-Array nach jedem Leg. Verwende die stabilen Felder `playerIndex`/`winnerPlayerIndex`, nicht die Array-Position. Siehe [Developer Guide](developer-guide.md#autodarts-array-rotation-bei-leg-wechseln).

### Veröffentlichen

1. Erstelle ein Git-Repository.
2. Pushe dein Modul.
3. Nutzer können es installieren über: **Module -> Installieren -> Git URL**.

---

## Referenz

- [Vollständige API-Dokumentation](api.md)
- [Detaillierte SDK-Dokumentation](module-sdk.md)
- [WLED-Modul](../../modules/wled/): externe Hardware-Steuerung, läuft im Hub-Prozess
- [Game Display](../../modules/game-display/): mitgeliefertes Modul mit eigenem Vue.js-Frontend
- [Darts Caller](../../modules/darts-caller/): mitgeliefertes Modul mit Audio/TTS und Voice Pack Generator
- Autodarts Trainer (separat entwickelt, nicht in diesem Repository): Prozess-Modul mit eigenen `/api/trainer/*` REST-Routen
