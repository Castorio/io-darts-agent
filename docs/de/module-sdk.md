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
| `name` | string | Ja | Anzeigename (Englisch) |
| `version` | string | Ja | Semantic Version (x.y.z) |
| `description` | string | Nein | Kurzbeschreibung (Englisch) |
| `author` | string | Nein | Autor/Entwickler |
| `repository` | string | Nein | URL zum Git-Repository |
| `entry` | string | Ja | Pfad zur Haupt-JS-Datei (z.B. "dist/index.js") oder "internal" für Hub-Module |
| `events` | string[] | Nein | Events, auf die reagiert wird |
| `config` | object | Nein | Konfigurationsschema |
| `i18n` | object | Nein | Mehrsprachige Übersetzungen |
| `intents` | object | Nein | Intent-System-Konfiguration |
| `eventMeta` | object | Nein | Metadaten für Events (Labels, Beschreibungen) |
| `eventGroups` | array | Nein | Gruppierung von Events für die UI |
| `effects` | array | Nein | Liste von verfügbaren Effekten (z.B. für WLED) |

### Konfigurations-Feldtypen

#### string
```json
{
  "type": "string",
  "label": "Name",
  "description": "Hilfetext",
  "required": true,
  "default": "Standardwert",
  "placeholder": "Platzhaltertext..."
}
```

Das `placeholder`-Attribut ist optional und zeigt einen Hinweistext im leeren Eingabefeld an.

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

Das `step`-Attribut ist optional und definiert die Schrittweite für Slider-Eingaben.

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

#### group (Verschachtelte Konfiguration)

Gruppen ermöglichen es, zusammengehörige Einstellungen zu organisieren, mit optionaler bedingter Sichtbarkeit:

```json
{
  "type": "group",
  "label": "TTS Einstellungen",
  "description": "Einstellungen für Text-to-Speech",
  "showIf": { "field": "callerType", "value": "tts" },
  "fields": {
    "voice": {
      "type": "string",
      "label": "Stimme",
      "default": ""
    },
    "rate": {
      "type": "number",
      "label": "Geschwindigkeit",
      "default": 1.0,
      "min": 0.5,
      "max": 2.0,
      "step": 0.1
    }
  }
}
```

Die `showIf`-Eigenschaft zeigt die Gruppe bedingt basierend auf dem Wert eines anderen Konfigurationsfelds an.

## Event-Metadaten (eventMeta)

Module können Metadaten für Events mit mehrsprachiger Unterstützung bereitstellen:

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

Diese Metadaten werden in der UI verwendet, um lesbare Event-Namen und Beschreibungen anzuzeigen.

## Event-Gruppen (eventGroups)

Events können in logische Gruppen für bessere UI-Darstellung organisiert werden:

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

## Effects-Liste (effects)

Module können eine Liste von verfügbaren Effekten definieren. Dies ist besonders nützlich für Hardware-Module wie WLED:

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

Diese Liste wird in der UI angezeigt und kann für Effekt-Auswahl in Intent-Aktionen verwendet werden.

## Intent-System

Das Intent-System ermöglicht **Modul-zu-Modul-Kommunikation**. Ein Modul kann Aktionen anbieten, die andere Module aufrufen können. Es geht dabei NICHT um das Replizieren von Events - dafür gibt es bereits Events. Intents dienen dazu, spezifische Funktionalitäten eines Moduls anzusprechen.

### Zweck von Intents

Intents ermöglichen Modulen:
1. **Fähigkeiten anbieten** - Ein Modul deklariert, welche Aktionen es ausführen kann
2. **Von anderen Modulen aufgerufen werden** - Andere Module können diese Aktionen nutzen
3. **Als Service fungieren** - Ein Modul kann als Dienstleister für andere agieren

### Praxis-Beispiel: MQTT-Modul

Das MQTT-Modul bietet eine `publish`-Aktion an, die andere Module nutzen können um MQTT-Nachrichten zu senden:

```json
{
  "intents": {
    "actions": [
      {
        "type": "publish",
        "label": "Nachricht veröffentlichen",
        "description": "Eine eigene Nachricht an ein Topic senden",
        "configSchema": {
          "topic": { "type": "string", "label": "Topic", "default": "custom/event" },
          "message": { "type": "string", "label": "Nachricht", "default": "{}" },
          "retain": { "type": "boolean", "label": "Nachricht speichern", "default": false }
        }
      }
    ],
    "defaultSubscriptions": []
  }
}
```

**Anwendungsfall:** Ein WLED-Modul könnte `mqtt.publish` verwenden, um eine Nachricht an Home Assistant zu senden, wenn ein bestimmter Effekt ausgelöst wird.

### Praxis-Beispiel: WLED-Modul

Das WLED-Modul bietet Aktionen zur LED-Steuerung an:

```json
{
  "intents": {
    "actions": [
      {
        "type": "solidColor",
        "label": "Einfarbig",
        "description": "Alle LEDs auf eine Farbe setzen",
        "configSchema": {
          "color": { "type": "color", "label": "Farbe", "default": "#ff0000" },
          "brightness": { "type": "number", "label": "Helligkeit", "default": 255, "min": 0, "max": 255 },
          "duration": { "type": "number", "label": "Dauer (ms)", "description": "0 = permanent", "default": 0, "min": 0 }
        }
      },
      {
        "type": "effect",
        "label": "Effekt abspielen",
        "description": "Einen Effekt abspielen",
        "configSchema": {
          "effectId": { "type": "number", "label": "Effekt-ID", "default": 0 },
          "duration": { "type": "number", "label": "Dauer (ms)", "default": 2000, "min": 0 }
        }
      },
      {
        "type": "off",
        "label": "Ausschalten",
        "description": "Alle Ausgaben ausschalten"
      }
    ],
    "defaultSubscriptions": []
  }
}
```

**Anwendungsfall:** Ein Caller-Modul könnte `wled.effect` auslösen, wenn eine 180 angesagt wird.

### Aktions-Felder

| Feld | Typ | Erforderlich | Beschreibung |
|------|-----|--------------|--------------|
| `type` | string | Ja | Eindeutiger Aktions-Identifier (wird beim Aufrufen verwendet) |
| `label` | string | Ja | Lesbarer Name für die UI-Anzeige |
| `description` | string | Nein | Beschreibung der Aktion |
| `configSchema` | object | Nein | Konfigurationsoptionen, die der Aufrufer bereitstellen muss/kann |

### Intent-Aktionen aufrufen

Andere Module können die Aktionen deines Moduls über das Intent-System auslösen:

```typescript
// Ein anderes Modul kann einen Intent an das MQTT-Modul senden
await sendIntent({
  targetModule: 'mqtt',
  action: 'publish',
  payload: {
    topic: 'autodarts/180',
    message: '{"event": "180", "player": "John"}',
    retain: false
  }
});

// Oder das WLED-Modul ansprechen
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

### Standard-Subscriptions

Module können Standard Event-zu-Aktion-Zuordnungen definieren. Das sind vorkonfigurierte Reaktionen, die das Modul ausführt wenn bestimmte Events auftreten:

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

### Wann Intents vs Events verwenden

| Anwendungsfall | Lösung |
|----------------|--------|
| Auf Spielgeschehnisse reagieren (Würfe, Spielerwechsel, etc.) | **Events** abonnieren |
| Funktionalität eines anderen Moduls auslösen | **Intent-Aktion** aufrufen |
| Anderen Modulen eigene Funktionalität anbieten | **Intent-Aktionen** bereitstellen |
| Mitteilen dass etwas passiert ist | **Event** aussenden |

**Beispiel-Ablauf:**
1. Spieler wirft 180 → `throw.180` **Event** wird ausgelöst
2. Caller-Modul empfängt Event → spielt "ONE HUNDRED AND EIGHTY" Audio ab
3. Caller-Modul ruft auch `wled.effect` **Intent** auf → LEDs zeigen Rainbow-Effekt
4. WLED-Modul ruft auch `mqtt.publish` **Intent** auf → Home Assistant erhält Benachrichtigung

## Internationalisierung (i18n)

Module können Übersetzungen für mehrere Sprachen bereitstellen. Die Standardsprache ist Englisch, welche für alle Labels im `config`-Abschnitt verwendet werden sollte. Übersetzungen werden im `i18n`-Abschnitt definiert.

### Unterstützte Sprachen

| Code | Sprache |
|------|---------|
| `en` | Englisch (Standard) |
| `de` | Deutsch |
| `es` | Spanisch |
| `fr` | Französisch |
| `it` | Italienisch |
| `nl` | Niederländisch |
| `ja` | Japanisch |
| `zh` | Chinesisch |
| `ru` | Russisch |
| `uk` | Ukrainisch |

### i18n-Struktur

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

### i18n-Übersetzungsfelder

| Feld | Beschreibung |
|------|--------------|
| `name` | Übersetzter Modulname |
| `description` | Übersetzte Modulbeschreibung |
| `config` | Übersetzungen für Config-Felder |
| `config.[key].label` | Übersetztes Feld-Label |
| `config.[key].description` | Übersetzte Feld-Beschreibung |
| `config.[key].options` | Übersetzungen für Select-Optionen (Key: Value Paare) |
| `strings` | Eigene Strings, die vom Modul-Frontend verwendet werden |

### Übersetzungen im Frontend nutzen

```typescript
// Übersetztes Modul-Manifest laden
const response = await fetch(`/api/modules/${moduleId}/translations/${language}`)
const { manifest, strings, availableLanguages } = await response.json()

// Übersetzte Strings verwenden
const successMessage = strings.connectionSuccess || 'Connected!'

// Verfügbare Sprachen prüfen
console.log('Verfügbare Sprachen:', availableLanguages) // ['en', 'de', 'es']
```

### Sprach-Fallback

Das Übersetzungssystem verwendet folgende Fallback-Reihenfolge:
1. Angeforderte Sprache (z.B. `de`)
2. Englisch (`en`) als Fallback
3. Originalwerte aus dem Manifest

Dies stellt sicher, dass Module auch funktionieren, wenn Übersetzungen unvollständig sind.

### Modul-Init-Payload

Wenn ein Modul initialisiert wird, erhält es die aktuelle Spracheinstellung:

```typescript
interface InitPayload {
  moduleId: string;
  config: Record<string, unknown>;
  hubVersion: string;
  subscribedEvents: string[];
  language: string; // Aktuelle UI-Sprache (z.B. 'de')
}
```

## Events

Module können auf folgende Autodarts-Events reagieren:

### Native Events (von Autodarts)

| Event | Beschreibung | Wichtige Daten |
|-------|-------------|----------------|
| `match.start` | Match gestartet | `matchId`, `boardId` |
| `match.state` | Match-Status Update | `players`, `gameScores`, `player`, `round`, `settings` |
| `match.finished` | Match beendet (Gewinner ermittelt) | `winner`, `winnerName`, `matchId` |
| `match.result` | Match-Ergebnis mit vollständigen Daten | `winner`, `winnerName`, `chalkboards`, `stats`, `scores`, `settings` |
| `match.finish` | Match geschlossen (Benutzer klickt "Beenden") | `matchId` |
| `match.delete` | Match abgebrochen | `matchId` |
| `throw.detected` | Wurf erkannt | `segment`, `points`, `remaining`, `playerIndex` |
| `game.finished` | Leg/Set gewonnen | `winner`, `checkoutPath` |
| `takeout.started` | Dart-Entnahme gestartet | `matchId` |
| `takeout.finished` | Dart-Entnahme beendet | `matchId` |

### Synthetische Events (generiert von EventParser)

Diese Events werden vom IO-Darts-Agent aus `match.state` Updates generiert:

| Event | Beschreibung | Wichtige Daten |
|-------|-------------|----------------|
| `player.changed` | Spielerwechsel | `playerIndex`, `playerName`, `remaining`, `players[]` mit Farben |
| `turn.started` | Aufnahme gestartet | `playerIndex`, `playerName`, `remaining` |
| `turn.finished` | Aufnahme beendet | `playerIndex`, `playerName`, `turnScore`, `busted`, `remaining` |

> **Hinweis:** Synthetische Events bieten praktische Hooks für Module. Das `turn.finished` Event wird ausgelöst wenn:
> - 3 Darts geworfen wurden
> - Ein Bust auftritt
> - Die Rundennummer sich ändert

### Wurf Sub-Events

Diese werden aus `throw.detected` Daten abgeleitet:

| Event | Auslöser | Daten |
|-------|----------|-------|
| `throw.triple` | `multiplier === 3` | `segment` |
| `throw.double` | `multiplier === 2` | `segment` |
| `throw.bullseye` | `number === 25 && multiplier === 2` | - |
| `throw.bull` | `number === 25 && multiplier === 1` | - |
| `throw.miss` | `points === 0` | - |
| `throw.180` | `turnPoints === 180` | - |
| `throw.highfinish` | Checkout über 100 Punkte | `checkoutScore` |
| `throw.bust` | Match State zeigt Bust | - |

## Custom API Routes (Module Routes)

Module können eigene API-Endpunkte registrieren, die unter `/api/modules/<module-id>/routes/` verfügbar sind.

### Routes registrieren

```typescript
// Im Modul - Routes beim Hub registrieren
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

// Über IPC an Hub senden
sendMessage({
  type: 'routes.register',
  payload: { routes }
});
```

### Route Handler implementieren

```typescript
// Auf route.request vom Hub reagieren
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

### Route Definition Felder

| Feld | Typ | Erforderlich | Beschreibung |
|------|-----|--------------|--------------|
| `method` | string | Ja | HTTP-Methode (GET, POST, PUT, PATCH, DELETE) |
| `path` | string | Ja | Pfad relativ zu `/api/modules/:moduleId/routes/` |
| `handlerId` | string | Ja | Eindeutige ID für den Handler |
| `description` | string | Nein | Beschreibung des Endpunkts |
| `requireAuth` | boolean | Nein | Authentifizierung erforderlich (Standard: true) |
| `schema` | object | Nein | JSON-Schema für Validierung |

### Vom Frontend aufrufen

```typescript
// Modul-Route aufrufen
const response = await fetch('/api/modules/my-module/routes/status');
const status = await response.json();

// Mit Body
await fetch('/api/modules/my-module/routes/test', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'flash' })
});
```

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

### 5. Temporäre Effekte mit Spielerfarben-Wiederherstellung

```typescript
// Effekt mit automatischer Wiederherstellung der Spielerfarbe (empfohlen)
async function flashEffect(duration = 1000, playerColor: string) {
  await setEffect('flash')

  setTimeout(async () => {
    // Zur Spielerfarbe zurückkehren, nicht zum vorherigen Gerätezustand
    await setColor(playerColor)
  }, duration)
}
```

> **Best Practice:** Bei temporären Effekten zur aktuellen Spielerfarbe zurückkehren statt zum vorherigen Gerätezustand. Dies gewährleistet konsistentes Verhalten auch wenn der vorherige Zustand falsch oder unbekannt war.

### 6. Fade-Zeit / Übergänge

```typescript
// Unterstützung für sanfte Übergänge bei Farbwechseln
async function setColorWithFade(color: string, fadeTimeMs: number) {
  const payload = {
    seg: [{ col: [[r, g, b]] }],
    transition: Math.round(fadeTimeMs / 100) // WLED verwendet 100ms Einheiten
  }
  await sendToDevice(payload)
}
```

### 7. Einzelspieler-Unterstützung

```typescript
// Sowohl Einzelspieler- als auch Mehrspieler-Spiele behandeln
async function handlePlayerChange(event) {
  // Dieses Event wird für beide Modi ausgelöst
  const playerColor = event.data.color || '#ffffff'
  await setColor(playerColor)
}

async function handleTakeoutFinished(event) {
  // Spielerfarbe nach Dart-Entnahme wiederherstellen
  // Funktioniert für Einzel- und Mehrspieler
  const currentPlayer = getCurrentPlayerFromMatchState()
  await setColor(currentPlayer.color)
}
```

### 8. Spieler-spezifische Konfigurationsüberschreibungen

Module können spieler-spezifische Einstellungen unterstützen, die die Standard-Konfiguration überschreiben, wenn ein bestimmter Spieler aktiv ist. Dieses Pattern wird von WLED, Darts Caller und Game Display verwendet.

#### Konfigurationsstruktur

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

#### Überschreibungs-Datenstruktur

```typescript
interface PlayerOverride {
  playerId?: string      // Optionale Autodarts-Spieler-ID
  playerName: string     // Spielername (für Anzeige und Fallback-Matching)
  // Modul-spezifische Felder:
  color?: string         // z.B. für WLED
  animations?: {         // z.B. für Game Display
    '180'?: { enabled: boolean; url?: string; sound?: string }
    legWin?: { enabled: boolean; url?: string; sound?: string }
    // ...
  }
  voiceStyle?: string    // z.B. für Darts Caller
}
```

#### Spieler-Matching implementieren

**Wichtig:** Autodarts sendet Spielernamen in Kleinbuchstaben. Verwende immer case-insensitive Vergleiche:

```typescript
function getPlayerOverride(
  playerOverrides: PlayerOverride[],
  playerName?: string,
  playerId?: string
): PlayerOverride | undefined {
  if (!playerOverrides || playerOverrides.length === 0) {
    return undefined
  }

  // 1. Zuerst nach playerId suchen (exakte Übereinstimmung)
  if (playerId) {
    const byId = playerOverrides.find(p => p.playerId === playerId)
    if (byId) return byId
  }

  // 2. Nach playerName suchen (case-insensitive!)
  if (playerName) {
    const byName = playerOverrides.find(
      p => p.playerName.toLowerCase() === playerName.toLowerCase()
    )
    if (byName) return byName
  }

  return undefined
}
```

#### UI-Integration

Die Hauptanwendung stellt die `/api/players`-API bereit, die im System registrierte Spieler auflistet. Module können dies nutzen, um Spieler für Überschreibungen auszuwählen:

```typescript
// Verfügbare Spieler laden
const players = await fetch('/api/players').then(r => r.json())

// players: Array<{ id: string, name: string, color?: string }>
```

#### Event-Behandlung mit Überschreibungen

```typescript
async function handleEvent(event: GameEvent) {
  const { playerName, playerId } = event.data

  // Spieler-spezifische Konfiguration laden
  const playerOverride = getPlayerOverride(
    config.playerOverrides,
    playerName,
    playerId
  )

  if (playerOverride?.animations?.['180']?.enabled) {
    // Spieler-spezifische Animation verwenden
    await playAnimation(playerOverride.animations['180'].url)
  } else if (config.animations?.['180']?.enabled) {
    // Auf Standard-Konfiguration zurückfallen
    await playAnimation(config.animations['180'].url)
  }
}
```

> **Best Practice:** Prüfe immer zuerst die spieler-spezifische Überschreibung, dann falle auf die Standard-Modul-Konfiguration zurück. Dies ermöglicht personalisierte Erlebnisse pro Spieler, während Standardwerte für nicht konfigurierte Spieler erhalten bleiben.

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

Siehe [WLED Module](/modules/wled/) als Referenz für ein Modul, das externe Hardware steuert mit:
- Dauer-basierte Effekte, die zur Spielerfarbe zurückkehren
- Konfigurierbare Fade-Zeit (Übergänge)
- Einzelspieler- und Mehrspieler-Unterstützung
- Event-basierte Aktionskonfiguration
- Intent-System-Unterstützung für Modul-zu-Modul-Kommunikation

### Modul mit Audio/TTS

Siehe [Darts Caller Module](/modules/darts-caller/) als Referenz für ein Modul, das:
- Browser-TTS oder Audio-Dateien verwendet
- Voice Pack Generator mit ElevenLabs enthält
- Mehrere Ausgabemodi unterstützt (Browser, lokal, Audio-Packs)

## WebSocket Events für Modul-UIs

Modul-Frontends können auf spezielle WebSocket-Events lauschen:

### caller Event

Für das Darts Caller Modul - löst Audio-Wiedergabe im Browser aus:

```typescript
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data)
  if (msg.type === 'caller') {
    const { callType, text, audioFile, priority } = msg.data
    // Audio abspielen oder TTS verwenden
    if (audioFile) {
      playAudio(audioFile)
    } else {
      speakText(text)
    }
  }
}
```

### module_status Event

Benachrichtigt über Modul-Status-Änderungen:

```typescript
{
  "type": "module_status",
  "data": {
    "moduleId": "wled",
    "status": "running" // oder "stopped", "error"
  }
}
```

---

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
