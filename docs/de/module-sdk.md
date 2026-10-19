# IO-Darts-Agent: Module SDK

Diese Dokumentation beschreibt, wie du eigene Module für den IO-Darts-Agent entwickeln kannst.

## Übersicht

Module sind Erweiterungen, die auf Autodarts-Events reagieren und Aktionen ausführen. Jedes Modul besteht aus:

1. **Manifest** (`module.json`): Metadaten und Konfigurationsschema (erforderlich)
2. **Code**: entweder direkt im Hub verdrahtet (`entry: "internal"`, nur für Hub-Entwicklung) oder ein eigenständiger Node.js-Prozess auf Basis des `@autodarts-hub/module-sdk`-Pakets (jeder andere `entry`-Wert)
3. **Web UI**: eigene Benutzeroberfläche, ausgeliefert unter `/module-ui/<module-id>/` (optional)

## Modul-Struktur

```
my-module/
├── module.json          # Manifest (erforderlich)
├── package.json         # Erforderlich für ein Prozess-Modul
├── README.md            # Dokumentation
├── src/                 # Prozess-Entry-Point(s), z.B. src/index.ts
├── dist/                # Build-Output (entry zeigt hierher auf dist/index.js)
└── web/                 # Frontend (optional)
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── main.ts
        ├── App.vue
        └── ...
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
| `entry` | string | Ja | `"internal"` für Code, der direkt im Hub verdrahtet ist, sonst ein JS-Dateipfad (z.B. `"dist/index.js"`), den der Hub als eigenen Prozess startet |
| `events` | string[] | Nein | `AutodartsEventType`-Werte, die die Konfig-UI des Moduls als Trigger anbietet |
| `config` | object | Nein | Konfigurationsschema |
| `i18n` | object | Nein | Mehrsprachige Übersetzungen |
| `intents` | object | Nein | Intent-System-Konfiguration |
| `eventMeta` | object | Nein | Metadaten für Events (Labels, Beschreibungen) |
| `eventGroups` | array | Nein | Gruppierung von Events für die UI |
| `effects` | array | Nein | Liste von verfügbaren Effekten (z.B. für WLED) |

`entry: "internal"` funktioniert nur für die drei Module, die der Hub anhand ihrer ID als Sonderfall behandelt (WLED, Game Display, Darts Caller); ein neu erstelltes Modul braucht einen Prozess-Entry-Point. Siehe [Developer Guide: Modul-Typen](developer-guide.md#modul-typen).

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

#### provider-select

Zeigt ein Dropdown der auf dem Hub konfigurierten KI-Provider (siehe `GET /api/ai/provider-options` in der [API-Dokumentation](api.md)), optional nach Fähigkeit gefiltert:

```json
{
  "type": "provider-select",
  "label": "TTS-Provider",
  "providerCapability": "audio-tts",
  "default": ""
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
    }
  }
}
```

Diese Metadaten werden in der UI verwendet, um lesbare Event-Namen und Beschreibungen anzuzeigen. Sie sind rein kosmetisch. Sie ändern nicht, welche Events das Modul tatsächlich empfängt.

## Event-Gruppen (eventGroups)

Events können in logische Gruppen für bessere UI-Darstellung organisiert werden:

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

Das Intent-System ermöglicht **Modul-zu-Modul-Kommunikation**. Ein Modul kann Aktionen anbieten, die andere Module aufrufen können. Es geht dabei NICHT um das Replizieren von Events, dafür gibt es bereits Events. Intents dienen dazu, spezifische Funktionalitäten eines Moduls anzusprechen.

### Zweck von Intents

Intents ermöglichen Modulen:
1. **Fähigkeiten anbieten**: ein Modul deklariert, welche Aktionen es ausführen kann (`intents.actions`)
2. **Von anderen Modulen aufgerufen werden**: andere Module können diese Aktionen nutzen
3. **Eigene semantische Intents aussenden**: ein Modul kann Intents deklarieren, die es aussendet (`intents.emits`), auf die andere Module Reaktionen abonnieren können

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

**Anwendungsfall:** Ein anderes Modul könnte `wled.effect` auslösen, wenn ein besonderer Score angesagt wird.

### Aktions-Felder

| Feld | Typ | Erforderlich | Beschreibung |
|------|-----|--------------|--------------|
| `type` | string | Ja | Eindeutiger Aktions-Identifier (wird beim Aufrufen verwendet) |
| `label` | string | Ja | Lesbarer Name für die UI-Anzeige |
| `description` | string | Nein | Beschreibung der Aktion |
| `configSchema` | object | Nein | Konfigurationsoptionen, die der Aufrufer bereitstellen muss/kann |

### Intents aussenden (aus einem Prozess-Modul)

Wenn du `AutodartsModule` aus `@autodarts-hub/module-sdk` erweiterst, rufe die geschützte Methode `this.emitIntent(intentId, payload)` auf. Deklariere jede ausgesendete Intent-ID unter `intents.emits` in `module.json`, damit die UI sie als etwas anzeigen kann, das andere Module abonnieren können:

```json
{
  "intents": {
    "emits": [
      {
        "id": "scoreboard.milestone",
        "description": "Ein bemerkenswerter Score wurde geworfen",
        "category": "my-module",
        "payload": {
          "score": { "type": "number", "description": "Der Score" },
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

Mit dem kleinen Templating-Helfer des SDKs lässt sich Ansagetext an einer Stelle pflegen:

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

// später
this.emitTemplatedIntent('scoreboard.milestone', 'milestone-180', { playerName: 'Max', score: 180 }, 'de');
```

### Standard-Subscriptions

Module können Standard Event-zu-Aktion-Zuordnungen definieren. Das sind vorkonfigurierte Reaktionen, die ein Modul von Haus aus anbietet (der Nutzer kann sie in der UI trotzdem ändern, gespeichert als `intentSubscriptions` in der Modul-Konfiguration):

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

### Wann Intents vs Events verwenden

| Anwendungsfall | Lösung |
|----------------|--------|
| Auf Spielgeschehnisse reagieren (Würfe, Spielerwechsel, etc.) | **Events** abonnieren |
| Funktionalität eines anderen Moduls auslösen | **Intent-Aktion** aufrufen |
| Anderen Modulen eigene Funktionalität anbieten | **Intent-Aktionen** bereitstellen |
| Mitteilen, dass etwas passiert ist | **Intent** aussenden |

## Internationalisierung (i18n)

Module können Übersetzungen für mehrere Sprachen bereitstellen. Die Standardsprache ist Englisch, welche für alle Labels im `config`-Abschnitt verwendet werden sollte. Übersetzungen werden im `i18n`-Abschnitt definiert.

### Unterstützte Sprachen

Die Hub-UI selbst liefert diese zehn mit; ein Modul kann Übersetzungen für eine beliebige Teilmenge bereitstellen.

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
```

### Sprach-Fallback

Das Übersetzungssystem verwendet folgende Fallback-Reihenfolge:
1. Angeforderte Sprache (z.B. `de`)
2. Englisch (`en`) als Fallback
3. Originalwerte aus dem Manifest

Dies stellt sicher, dass Module auch funktionieren, wenn Übersetzungen unvollständig sind.

### Modul-Init-Payload (Prozess-Module)

Wenn `onInit(config)` eines Prozess-Moduls aufgerufen wird, hat der Hub bereits eine `init`-IPC-Nachricht gesendet mit:

```typescript
interface InitPayload {
  moduleId: string;
  config: Record<string, unknown>;
  hubVersion: string;
  subscribedEvents: string[];
}
```

## Events

Module können auf folgende Autodarts-Events reagieren. `type` ist einer aus einer festen `AutodartsEventType`-Union. Alle Payload-Felder stehen in der [API-Dokumentation](api.md#autodarts-events).

### Native Events (von Autodarts weitergeleitet)

| Event | Beschreibung | Wichtige Daten |
|-------|-------------|----------------|
| `board.state` | Board verbindet/trennt sich | Board-Verbindungsinfo |
| `board.event` | Jedes andere rohe Board-Event | eventspezifisch |
| `match.start` | Match gestartet | `matchId`, `boardId` |
| `match.state` | Match-Status-Update | `players`, `gameScores`, `player`, `round`, `settings` |
| `match.delete` | Match abgebrochen | `matchId`, `boardId` |
| `match.finish` | Benutzer schließt die Ergebnisanzeige | `matchId`, `boardId` |
| `throw.detected` | Wurf erkannt | `segment`, `coords?`, `throwNumber`, `boardId`, `points`, `turnId`, `turnPoints`, `busted` (die letzten drei nur bei Würfen aus `match.state`, dem Normalfall); in Cricket/Tactics zusätzlich `marks`, `turnMarks` |
| `takeout.started` | Dart-Entnahme gestartet | `boardId` |
| `takeout.finished` | Dart-Entnahme beendet | `boardId` |

### Synthetische Events (generiert vom `EventParser` des Hubs)

| Event | Beschreibung | Wichtige Daten |
|-------|-------------|----------------|
| `player.change` | Aktiver Spieler gewechselt | `previousPlayer`, `currentPlayer`, `playerIndex`, `playerName`, `remaining` |
| `turn.finished` | Aufnahme beendet | `playerIndex`, `playerName`, `turnScore`, `busted`, `remaining`, `round`; in Cricket/Tactics zusätzlich `turnMarks` |
| `game.finished` | Leg gewonnen | `winner`, `winnerName`, `winnerPlayerIndex`, `leg`, `set` |
| `match.finished` | Match gewonnen | `winner`, `winnerName`, `winnerPlayerIndex`, `scores` |
| `match.result` | Vollständige Ergebnisdaten, zusammen mit `match.finished` gesendet | `chalkboards`, `stats`, `scores`, `settings` |
| `cricket.state` | Cricket/Tactics-Zustand: Punkte und Treffer pro Feld je Spieler | `matchId`, `set`, `leg`, `mode`, `cutThroat`, `fields`, `deadFields`, `players[].{index,name,points,marks}` |
| `cricket.closed` | Cricket/Tactics: ein Spieler schließt ein Feld mit dem dritten Treffer | `matchId`, `set`, `leg`, `field`, `playerIndex`, `playerName` |

> **Hinweis:** Synthetische Events bieten praktische Hooks für Module. `turn.finished` wird ausgelöst, wenn 3 Darts geworfen wurden, ein Bust auftritt oder sich die Rundennummer ändert.

> **Hinweis zu `game`:** `match.state`, `throw.detected`, `turn.finished`, `player.change`, `game.finished`, `match.finished`, `match.result`, `cricket.state` und `cricket.closed` tragen zusätzlich `data.game: { variant: string; mode: 'x01' | 'cricket' | 'tactics' | 'other'; cutThroat: boolean }`. `match.start`, `match.delete` und `match.finish` tragen kein `game`.

> **Ausbullen:** Während der Autodarts-Variante "Bull-off" trägt `match.state` das Feld `bullOff: { players: [{ index, name, distance, x, y }], finished, winnerIndex }` (Abstand zum Bull in mm, `null` solange nicht geworfen; `x`/`y` normiert, Radius 1 = 170 mm; `winnerIndex` = `player.index` des Spielers, der beginnt), sonst `null`. Das Ausbullen löst kein `game.finished` aus.

### Cricket- und Tactics-Daten

Cricket und Tactics (eine Cricket-Variante mit den Feldern 10 bis 20 statt 15 bis 20) laufen über dieselben Events wie X01, mit den oben genannten Zusatzfeldern. Felder sind Strings `'10'` bis `'20'` sowie `'25'` für Bull. Spieler stehen über den stabilen `index` (nicht die Array-Position), bleiben also über die Spieler-Array-Rotation nach einem Leg hinweg zuordenbar.

`throw.detected` in Cricket/Tactics, zusätzlich zu den üblichen Feldern:

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

`marks` sind die Treffer dieses einen Darts, `turnMarks` die Summe der Aufnahme bis einschließlich diesem Dart (für einen 180 auf dem dritten Dart sichtbar). `turn.finished` trägt nur `turnMarks` (Summe der ganzen Aufnahme).

`cricket.state`, gesendet beim ersten Cricket-Zustand und immer, wenn sich Treffer oder Punkte ändern:

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

`cricket.closed`, einmal pro Feld und Spieler im Leg, nicht für Felder, die bereits aus einem vorherigen Zustand (z.B. nach einem Hub-Neustart) geschlossen waren:

```json
{ "matchId": "match-1", "set": 1, "leg": 1, "field": "20", "playerIndex": 0, "playerName": "Anna" }
```

**Starke Aufnahme ist kein Hub-Event.** Es gibt kein `turn.strong` oder Ähnliches; Module vergleichen `turnMarks` (aus `throw.detected` oder `turn.finished`) selbst mit einer eigenen Schwelle (3 bis 9, Standard 6). WLED und Darts Caller sind die Referenzimplementierungen.

`GET /api/match/current` liefert zusätzlich `cricket` (gleiche Form wie `cricket.state`, `null` außerhalb von Cricket/Tactics) und `turns` (ein Array mit der letzten Aufnahme).

### Wurf-Unterschlüssel auf Modul-Ebene (keine Hub-Events)

Es gibt kein `throw.triple`, `throw.double`, `throw.180`, `throw.bullseye`, `throw.bull`, `throw.miss` oder `throw.highfinish` auf dem Event-Bus oder im WebSocket des Hubs. Ebenso ist `cricket.marks` (Starke Aufnahme) kein Hub-Event. Manche Module (das WLED-Modul ist die Referenzimplementierung, siehe `modules/wled/src/WledHandler.ts`) leiten diese als interne Lookup-Schlüssel aus einem `throw.detected`-Payload ab, rein um eine Aktion pro Ereignis in der eigenen Konfiguration auszuwählen:

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

Im Payload von `throw.detected` ist `points` der Wert des Darts, `turnPoints` die laufende Summe der Aufnahme einschließlich dieses Darts (180 beim dritten T20) und `busted` ist nur bei dem Dart wahr, der den Bust ausgelöst hat.

Soll die UI deines Moduls Aktionen pro Wurftyp anbieten, implementiere dieselbe Art Ableitung selbst; dafür gibt es heute keinen vom Hub bereitgestellten Helfer.

## Custom API Routes (Module Routes)

Module können eigene API-Endpunkte registrieren, die unter `/api/modules/<module-id>/routes/` verfügbar sind. Wenn du `AutodartsModule` aus `@autodarts-hub/module-sdk` erweiterst, nutze dessen eingebaute Route-API statt eigene IPC-Nachrichten zu bauen:

### Routes registrieren

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

`registerRoutes` und `setRouteHandler` sind geschützte Methoden auf `AutodartsModule`; rufe sie innerhalb deiner Modul-Klasse auf (z.B. in `onInit`).

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
  body: JSON.stringify({ action: 'flash' }),
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
      // Autodarts-Event: message.event.type, message.event.data
      handleEvent(message.event)
      break
    case 'log':
      // Log-Eintrag
      break
  }
}

function handleEvent(event: { type: string; data: unknown }) {
  switch (event.type) {
    case 'throw.detected':
      // Wurf verarbeiten
      break
    case 'player.change':
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

### Modul in den Store aufnehmen

Der Modul-Store im Hub zeigt einen Katalog offiziell betreuter Module (`store/modules.json` im Repository [`Castorio/io-darts-agent`](https://github.com/Castorio/io-darts-agent), Branch `main`), von dem aus Nutzer mit einem Klick installieren können. Für die Aufnahme gilt:

- Das Modul ist ein SDK-konformes Modul (siehe oben), kein Fork des Hubs selbst.
- Der Code liegt in einem öffentlichen GitHub-Repository.
- Die `id` im Katalog-Eintrag ist identisch mit der `id` in der `module.json` des Moduls. Der Hub lehnt eine Installation ab (409), wenn die vom Installer zurückgemeldete Manifest-`id` nicht zur angeforderten Katalog-`id` passt, und macht die Installation rückgängig.
- Der Eintrag wird von den Maintainern geprüft, bevor er aufgenommen wird.

**Eintragsformat**, ein Objekt pro Modul in `store/modules.json`:

```json
{
  "version": 1,
  "modules": [
    {
      "id": "mqtt",
      "name": { "de": "MQTT-Integration", "en": "MQTT Integration" },
      "description": {
        "de": "Veröffentlicht Autodarts-Spielereignisse an einen MQTT-Broker.",
        "en": "Publishes Autodarts game events to an MQTT broker."
      },
      "category": "integration",
      "author": "Dein Name oder Team",
      "repo": "https://github.com/<owner>/<repo>",
      "branch": "main",
      "homepage": "https://example.com"
    }
  ]
}
```

**Validierungsregeln** (ungültige Einträge und doppelte IDs werden beim Laden verworfen und geloggt, ohne den restlichen Katalog ungültig zu machen):

| Feld | Regel |
|------|-------|
| `id` | `/^[a-z0-9][a-z0-9-]{1,63}$/`, muss zur Modul-`id` passen |
| `name`, `description` | Objekt `{ de, en }`, beide Strings, nicht leer, `name` max. 200, `description` max. 1000 Zeichen |
| `category` | String, 1-40 Zeichen |
| `author` | String, 1-80 Zeichen |
| `repo` | Exakt `https://github.com/<owner>/<repo>` (ohne `.git`, keine Query/Fragment/Zugangsdaten in der URL) |
| `branch` | Optional, `/^[A-Za-z0-9._/-]{1,100}$/`, Standard `main` |
| `homepage` | Optional, `https://`-URL |

Installiert wird immer der aktuelle Stand des angegebenen Branches, kein fixierter Commit.

**Aufnahme beantragen:** Pull Request oder Commit auf `main` im Repository `Castorio/io-darts-agent`, der den Eintrag zu `store/modules.json` hinzufügt.

**Eigener Katalog:** Ein Hub kann mit der Umgebungsvariable `IO_DARTS_STORE_URL` auf einen anderen Katalog zeigen (Standard: der Katalog oben). Nur `https:`-URLs werden akzeptiert.

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
protected async onShutdown(reason: string): Promise<void> {
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
    tt: Math.round(fadeTimeMs / 100) // WLED verwendet 100ms Einheiten; tt gilt nur für diesen Befehl
  }
  await sendToDevice(payload)
}
```

> **Hinweis:** Nutze `tt` für einen Übergang pro Befehl. `transition` ändert die Standard-Übergangszeit des Controllers für alle folgenden Befehle.

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

Der Hub stellt den `GET /api/players`-Endpunkt bereit, der registrierte Spieler auflistet. Module können dies nutzen, um Spieler für Überschreibungen auszuwählen:

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
  "entry": "dist/index.js",
  "events": ["throw.detected"]
}
```

### Modul mit UI

Siehe das [Game Display Modul](../../modules/game-display/) als Referenz für ein mitgeliefertes Modul mit eigenem Vue.js-Frontend.

### Modul mit externer Hardware

Siehe das [WLED-Modul](../../modules/wled/) als Referenz für ein Modul, das externe Hardware steuert mit:
- Dauer-basierte Effekte, die zur Spielerfarbe zurückkehren
- Konfigurierbare Fade-Zeit (Übergänge)
- Einzelspieler- und Mehrspieler-Unterstützung
- Event-basierte Aktionskonfiguration, inklusive Wurf-Unterschlüsseln auf Modul-Ebene (siehe oben)
- Intent-System-Unterstützung für Modul-zu-Modul-Kommunikation

### Modul mit Audio/TTS

Siehe das [Darts Caller Modul](../../modules/darts-caller/) als Referenz für ein Modul, das:
- Browser-TTS, ElevenLabs Live-TTS, Voice Packs oder eigene Audiodateien nutzt
- Einen Voice Pack Generator mit ElevenLabs enthält
- Mehrere Ausgabemodi unterstützt

### Prozess-Modul-Beispiel

Das Autodarts-Trainer-Modul (separat entwickelt, nicht Teil dieses Repositorys) ist ein Beispiel für ein Modul, das als eigener Prozess läuft (`entry: "dist/index.js"`) und eigene REST-Routen (`/api/trainer/*`) direkt registriert, statt über den oben beschriebenen Module-Routes-Mechanismus.

## Debugging

### Logs

Modul-Aktivitäten werden im Hub-Log angezeigt:

1. Öffne das Web-Interface
2. Gehe zu **Logs** (`/logs`)
3. Filtere nach deinem Modul

### Browser DevTools

Für Frontend-Module:

1. Öffne `/module-ui/my-module/`
2. Öffne die Browser-Entwicklertools (F12)
3. Prüfe Console und Network-Tab

## WebSocket Events für Modul-UIs

Modul-Frontends können auf spezielle WebSocket-Events lauschen (die vollständige Liste steht in der [API-Dokumentation](api.md#websocket-api)):

### caller Event

Für das Darts Caller Modul, löst Audio-Wiedergabe im Browser aus:

```typescript
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data)
  if (msg.type === 'caller') {
    const { text, audioFile } = msg.request
    // Audio abspielen oder TTS verwenden
    if (audioFile) {
      playAudio(audioFile)
    } else {
      speakText(text)
    }
  }
}
```

### module Event

Benachrichtigt über Modul-Status-Änderungen:

```typescript
{
  "type": "module",
  "moduleId": "wled",
  "status": "running" // oder "stopped", "error"
}
```

---

## KI-Funktionen in Modulen

Es gibt derzeit **keine IPC-Nachricht**, mit der ein Prozess-Modul das KI-Provider-System des Hubs direkt aufrufen kann (kein `ai.request`/`ai.response`-Roundtrip existiert im `@autodarts-hub/module-sdk`). Zwei Wege funktionieren heute:

1. **Prozessinterne (mitgelieferte) Module** können den Service direkt importieren, so wie es das Darts-Caller-Modul für ElevenLabs tut:

   ```typescript
   import { getAIProviderService } from '../../../src/core/ai/index.js';

   const service = getAIProviderService();
   const result = await service.generateSpeech({ text: 'One hundred and eighty!' }, 'elevenlabs');
   ```

2. **Prozess-Module** können die eigene REST-API des Hubs über HTTP aufrufen, da es sich einfach um einen lokalen Server handelt:

   ```typescript
   const response = await fetch('http://localhost:3000/api/ai/generate/speech', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ providerId: 'elevenlabs', text: 'One hundred and eighty!' }),
   });
   ```

   Das funktioniert direkt, solange Web-Auth auf dem Hub deaktiviert ist; ist Web-Auth aktiviert, benötigt jede `/api/ai/*`-Route ein Session-Cookie (siehe [API-Dokumentation](api.md#authentifizierung)), und ein Modul müsste sich selbst einloggen, um eines zu bekommen.

### Verfügbare KI-Provider

| Provider | Fähigkeiten | Modul-Anwendungsfälle |
|----------|-------------|------------------------|
| **ElevenLabs** | Text-to-Speech | Voice Packs, Spielernamen-Synthese, eigene Ansagen |
| **Runway ML** | Video-Generierung | Eigene Celebration-Animationen (eine von zwei Engines) |
| **Higgsfield** | Bild-/Video-Generierung | Eigene Celebration-Animationen (die andere Engine) |
| **OpenAI** | Text, Bilder | Dynamische Inhalte, Bildgenerierung |
| **Anthropic** | Text | Inhaltsgenerierung, Analyse |
| **Stability AI** | Bilder | Eigene Grafiken |
| **Ollama** | Text (Lokal) | Lokale KI-Inferenz |
| **Replicate** | Verschiedene | Eigene gehostete Modelle |

## Lizenz

IO-Darts-Agent selbst steht unter der PolyForm Noncommercial License 1.0.0. Das Modul-SDK in `module-sdk/` (`@autodarts-hub/module-sdk`) steht unter der MIT-Lizenz ([module-sdk/LICENSE](../../module-sdk/LICENSE)), damit Module von Dritten es frei nutzen können.

## Support

Bei Fragen oder Problemen:

1. Prüfe die [API-Dokumentation](api.md)
2. Schaue dir die Beispiel-Module unter `/modules/` an
3. Öffne ein Issue im GitHub-Repository
