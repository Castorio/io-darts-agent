# Developer Guide

Diese Anleitung ist für Entwickler, die am IO-Darts-Agent mitarbeiten oder eigene Module erstellen möchten.

---

## Inhaltsverzeichnis

1. [Entwicklungsumgebung einrichten](#entwicklungsumgebung-einrichten)
2. [Projekt-Struktur](#projekt-struktur)
3. [Backend-Entwicklung](#backend-entwicklung)
4. [Frontend-Entwicklung](#frontend-entwicklung)
5. [Module entwickeln](#module-entwickeln)
6. [Testing](#testing)
7. [Build & Release](#build--release)
8. [Architektur](#architektur)
9. [Event System](#event-system)
10. [KI-Provider-System](#ki-provider-system)

---

## Entwicklungsumgebung einrichten

### Voraussetzungen

| Tool | Version | Hinweis |
|------|---------|---------|
| **Node.js** | 22+ | [Download](https://nodejs.org/) |
| **npm** | Kommt mit Node.js | |
| **Git** | Aktuell | [Download](https://git-scm.com/) |
| **ffmpeg** | Im `PATH` | Nur für den KI-Animations-Generator (transparentes WebM) nötig |

### Projekt klonen

```bash
git clone https://github.com/Castorio/io-darts-agent.git
cd io-darts-agent
```

### Dependencies installieren

```bash
npm run setup       # installiert alle Abhängigkeiten, baut das Modul-SDK
npm run build:app   # Backend, Web-UI und Game-Display-UI
npm start
```

Das ist dieselbe Abfolge wie in der [Installationsanleitung](installation.md#installation-aus-dem-quellcode). Zum Entwickeln nimmst du statt `npm start` den Befehl `npm run dev` (siehe unten).

### Development Server starten

```bash
# Nur Backend (tsx watch, Hot-Reload beim Speichern)
npm run dev

# Backend + Web-UI-Dev-Server (zwei Terminals)
npm run dev              # Terminal 1 - Backend auf :3000
cd web && npm run dev     # Terminal 2 - Vite Dev-Server auf :5173, proxied /api und /module-ui zu :3000
```

Das Backend läuft standardmäßig auf `http://localhost:3000`. Die Umgebungsvariable `PORT` gilt nur vor der Einrichtung. Nach dem Setup-Assistenten kommt der Port aus `server.port` in `hub.config.json`.

**Die Datenverzeichnisse unterscheiden sich je nach Startart.** Alle Laufzeitpfade werden relativ zum Verzeichnis von `main` aufgelöst:

| Start | Code läuft aus | Konfiguration und Daten |
|-------|----------------|-------------------------|
| `npm run dev` (tsx) | `src/main.ts` | `config/`, `data/`, `media/` und `modules_installed/` im Hauptverzeichnis des Repositorys |
| `npm start` | `dist/src/main.js` | `dist/config/`, `dist/data/`, `dist/media/` und `dist/modules_installed/` |

Beide Startarten haben also eine eigene Konfiguration und durchlaufen jeweils den Setup-Assistenten. Mit `npm run dev` liefert der Hub keine Web-UI aus. Nutze dafür den Vite-Dev-Server (`cd web && npm run dev`, `http://localhost:5173`).

---

## Projekt-Struktur

```
AutodartsClient/
├── src/                    # Backend TypeScript Source
│   ├── main.ts             # Entry Point: baut den Fastify-Server, verdrahtet Routen und Module
│   ├── index.ts
│   ├── api/                 # Fastify-Server, Routen, Auth-Middleware
│   │   ├── Server.ts        # APIServer-Klasse: Plugins, Local-Origin-Prüfung, Sessions
│   │   ├── middleware/auth.ts
│   │   └── routes/          # Eine Datei pro Ressource (siehe docs/de/api.md)
│   ├── core/
│   │   ├── auth/            # AuthService - Login bei der offiziellen Autodarts-Account-API
│   │   ├── socket/           # SocketTicket, SocketService, EventParser (Board-WebSocket)
│   │   ├── events/           # EventBus, EventSystem (Pub/Sub für geparste Events)
│   │   ├── intents/           # IntentBus, IntentEmitter, ModuleIntentHandler, templateResolver
│   │   ├── modules/           # ModuleManager, ModuleBridge, ModuleProtocol, ModuleInstaller,
│   │   │                      # ModuleHandlerFactory, ModuleRouteRegistry, ModuleI18n, handlers/
│   │   ├── ai/                # AIProviderService, AIProviderInitializer, providers/
│   │   ├── media/             # MediaService, AnimationGeneratorService, providers/
│   │   ├── match/             # MatchStatusService
│   │   ├── players/           # PlayerService, PlayerRepository
│   │   ├── config/            # ConfigService (liest/schreibt dist/config/*.json)
│   │   ├── tts/, audio/       # kleine gemeinsame Hilfsfunktionen
│   ├── i18n/                 # I18nService + locales/ für die Hub-UI-Übersetzungen
│   └── types/                 # Gemeinsame TypeScript-Typen (api.ts, index.ts, modules.ts, ...)
├── web/                     # Vue 3 Web-Interface
│   ├── src/
│   ├── dist/                 # Kompiliertes Frontend (wird vom Backend ausgeliefert)
│   └── vite.config.ts
├── modules/                 # Mitgelieferte Module (jedes mit eigener package.json)
│   ├── wled/
│   ├── game-display/         # Hat ein eigenes Vue-Frontend unter web/
│   └── darts-caller/
├── modules_installed/       # Aus Git oder einem lokalen Pfad installierte Module (Symlinks)
├── module-sdk/              # @autodarts-hub/module-sdk - Basisklasse für Prozess-Module
├── electron/                 # Electron Main Process (Desktop-App)
├── config/                   # Lokale Laufzeit-Konfiguration (gitignored)
├── build/                    # Build-Assets (Icons, etc.)
├── scripts/
│   └── linux/                 # systemd-Service + Kiosk-Launcher für einen dedizierten Board-PC
├── test/                     # Vitest Unit-/Integrationstests (src/**/*.test.ts, test/**/*.test.ts)
├── tests/                    # Manuelle Playwright-E2E-Specs gegen einen laufenden Hub
├── dist/                     # Kompiliertes Backend und Laufzeit-Konfiguration unter dist/config/
└── docs/                     # Diese Dokumentation
```

---

## Backend-Entwicklung

### Technologie-Stack

- **Runtime**: Node.js 22+
- **Sprache**: TypeScript (Strict Mode), kompiliert mit `tsc`
- **Framework**: [Fastify](https://fastify.io/) mit `@fastify/cors`, `@fastify/cookie`, `@fastify/static`, `@fastify/websocket`, `@fastify/multipart`
- **Autodarts-Verbindung**: `ws` (reiner WebSocket-Client) plus ein eigener Auth-/Ticket-Flow gegen die offizielle Autodarts-Account- und Board-API
- **Logging**: `pino-pretty`

### Wichtige Dateien

| Datei | Beschreibung |
|-------|-------------|
| `src/main.ts` | Entry Point; baut den Hub, registriert alle Routen und die Modul-Verdrahtung |
| `src/api/Server.ts` | Fastify-Instanz, CORS-/Local-Origin-Prüfung, Sessions |
| `src/api/middleware/auth.ts` | Globaler `onRequest`-Auth-Gate (siehe [API-Dokumentation](api.md#authentifizierung)) |
| `src/core/auth/AuthService.ts` | Login beim Autodarts-Account, hält den Access-Token aktuell |
| `src/core/socket/SocketTicket.ts`, `SocketService.ts` | Holt ein Board-Socket-Ticket und verbindet sich mit dem Autodarts-Board-WebSocket |
| `src/core/socket/EventParser.ts` | Wandelt rohe Autodarts-WebSocket-Nachrichten in typisierte `ParsedEvent`s um, inklusive der synthetischen Events |
| `src/core/events/EventBus.ts` | Prozessinternes Pub/Sub, das `ParsedEvent`s an Module und die WebSocket-API verteilt |
| `src/core/intents/IntentBus.ts` | Modul-zu-Modul-Kommunikation (siehe [Module SDK](module-sdk.md#intent-system)) |
| `src/core/modules/ModuleManager.ts` | Lädt Manifeste, startet/stoppt/installiert/aktualisiert Module |
| `src/core/modules/ModuleBridge.ts`, `ModuleProtocol.ts` | Unix-Socket-IPC-Protokoll für Module, die als eigener Prozess laufen |
| `src/core/modules/handlers/index.ts` | Re-exportiert die prozessinternen Handler-Klassen aus `modules/wled/src/`, `modules/game-display/src/`, `modules/darts-caller/src/` |
| `src/core/ai/AIProviderService.ts` | Registry und Dispatch für KI-Provider |
| `src/core/media/MediaService.ts`, `AnimationGeneratorService.ts` | Speicherung der Medienbibliothek und KI-Animations-Jobs |

### API Endpoints

Siehe die vollständige [API-Dokumentation](api.md) für jede Route mit Body-/Query-Feldern und Auth-Anforderung. Kurzübersicht:

| Bereich | Basis-Pfad |
|---------|-----------|
| Setup & Auth | `/api/setup/*`, `/api/auth/*` |
| Status & Einstellungen | `/api/status`, `/api/settings`, `/api/autodarts/*` |
| Match | `/api/match/*` |
| Module & Intents | `/api/modules/*`, `/api/intents*` |
| Spieler | `/api/players/*` |
| KI-Provider | `/api/ai/*` |
| Animations-Generator | `/api/animations/*` |
| Medienbibliothek | `/api/media/*` |
| TTS & Voice Packs | `/api/tts/*` |
| Darts Caller | `/api/caller/*` |
| Autodarts Trainer | `/api/trainer/*` |
| Entwickler/Simulation | `/api/developer/*` |
| Live-Events & Logs | `/api/events` (WebSocket), `/api/logs` |

### Build

```bash
# TypeScript kompilieren (src/ -> dist/)
npm run build
```

---

## Frontend-Entwicklung

### Technologie-Stack

- **Framework**: Vue 3 (Composition API, `<script setup>`)
- **Build**: Vite
- **Styling**: Tailwind CSS
- **State**: Pinia
- **Router**: Vue Router
- **i18n**: vue-i18n, 10 Sprachen (`de`, `en`, `es`, `fr`, `it`, `ja`, `nl`, `ru`, `uk`, `zh`); Deutsch und Englisch sind vollständig, der Rest teilweise übersetzt
- **Icons**: Inline-SVG, keine Icon-Bibliothek

### Development

```bash
cd web

# Dev-Server mit Hot-Reload auf :5173, proxied /api und /module-ui zu :3000
npm run dev

# Produktions-Build
npm run build

# Type-Check (vue-tsc)
npm run type-check
```

### Komponenten-Struktur

```
web/src/
├── App.vue                 # Root-Komponente
├── main.ts                 # Vue App Entry
├── router/                 # Vue Router Konfiguration
├── api/                    # Typisierte fetch-Wrapper für die Hub-API
├── stores/                 # Pinia Stores: app.ts, events.ts, modules.ts, players.ts, index.ts
├── views/                  # Seiten, z.B. DashboardView.vue, ModulesView.vue, PlayersView.vue,
│                            # SetupView.vue, SettingsView.vue, AISettingsView.vue,
│                            # AnimationGeneratorView.vue, MediaLibraryView.vue, LogsView.vue
├── components/              # Wiederverwendbare Komponenten (BaseCard.vue, ModuleConfigCard.vue, ...)
│   └── config/               # Renderer für Config-Felder (DynamicConfigForm.vue und Co.)
├── i18n/
│   ├── index.ts
│   └── locales/              # de.ts, en.ts, es.ts, fr.ts, it.ts, ja.ts, nl.ts, ru.ts, uk.ts, zh.ts
├── types/
├── utils/
└── assets/                  # Statische Assets
```

---

## Module entwickeln

Siehe [Developer Quick Start](developer-quickstart.md) für eine schnelle Einführung.

Siehe [Module SDK](module-sdk.md) für die vollständige API-Dokumentation.

### Modul-Typen

Die `module.json` eines Moduls deklariert einen `entry`:

| `entry`-Wert | Verhalten |
|--------------|-----------|
| `"internal"` | Kein eigener Prozess. Das Manifest steuert nur die UI (Konfigurationsformular, Event-/Intent-Auswahl). Das Verhalten muss direkt im Hub verdrahtet werden. |
| ein Dateipfad, z.B. `"dist/index.js"` | Der Hub startet `node <pfad>` als Child-Prozess und spricht mit ihm über einen Unix-Domain-Socket, mit der `AutodartsModule`-Basisklasse aus dem `@autodarts-hub/module-sdk`-Paket. |

**Ausnahme:** Die drei mitgelieferten Module WLED, Game Display und Darts Caller werden immer anhand ihrer Modul-ID prozessintern geladen, unabhängig davon, was ihr `entry` sagt (ihre Manifeste sagen aus einer früheren Architektur noch `"dist/index.js"`, dieser Pfad wird aber nie tatsächlich gestartet). Ihre Handler-Klassen liegen im jeweils eigenen `src/`-Ordner des Moduls und werden über `src/core/modules/handlers/index.ts` re-exportiert. Ein neu installiertes Modul erhält diese Sonderbehandlung nicht. Setze `entry: "internal"` nur, wenn du den Hub selbst forken willst, sonst einen Prozess-Entry-Point mit dem Module SDK.

### Mitgelieferte Module

| Modul | Beschreibung | Funktionen |
|-------|-------------|------------|
| **WLED** (`modules/wled/`) | LED-Beleuchtungssteuerung | Spielerfarben, Effekte/Presets, Fade-Zeit, dauerbasierte Aktionen mit Farbwiederherstellung, Intent-Aktionen |
| **Game Display** (`modules/game-display/`) | Punkteanzeige | Eigenes Vue.js-Frontend, Checkout-Vorschläge, Animationen pro Event und pro Spieler |
| **Darts Caller** (`modules/darts-caller/`) | Sprachansagen | Browser-TTS, ElevenLabs Live-TTS, Voice Packs, Audio-Pack-Dateien, Voice Pack Generator |
| **Autodarts Trainer** (separates Repository, nicht enthalten) | Übungsroutinen | Eigene REST-Endpunkte unter `/api/trainer/*`, mitgelieferte und eigene Routinen, Historie/Statistik |

### Beispiel-Module

- **WLED** (`modules/wled/`): steuert externe Hardware über HTTP
- **Game Display** (`modules/game-display/`): eigenes Vue.js-Frontend unter `/module-ui/game-display/`
- **Darts Caller** (`modules/darts-caller/`): Voice Pack Generator und mehrere Ausgabe-Backends

---

## Testing

### Unit- & Integrationstests (Vitest)

Testdateien liegen unter `src/**/*.test.ts` und `test/**/*.test.ts` (siehe `vitest.config.ts`); `test/` spiegelt die Source-Struktur mit den Unterordnern `api/`, `core/`, `integration/`, `mocks/`, `modules/` und `packaging/`.

```bash
# Watch-Mode
npm test

# Einmalig ausführen (CI-Modus)
npm run test:unit
# entspricht:
npx vitest run

# Mit Coverage (v8-Provider, 80% Schwelle für lines/functions/branches/statements)
npm run test:coverage
```

### End-to-End-Specs (Playwright)

`tests/*.spec.ts` sind Playwright-Specs, die einen laufenden Hub unter `http://localhost:3000` über den Browser steuern (z.B. prüfen, ob der Intent-Abschnitt eines Moduls angezeigt wird). Es gibt keine eingecheckte `playwright.config.ts` und kein `npm`-Script dafür; eine einzelne Spec manuell gegen einen laufenden Dev-Server ausführen:

```bash
npm run dev            # in einem Terminal
npx playwright test tests/test-intents.spec.ts
```

---

## Build & Release

### Lokaler Build

```bash
# Backend kompilieren
npm run build

# Web-UI bauen
npm run build:frontend

# Game-Display-UI bauen
npm run build:modules

# Alle drei zusammen
npm run build:app
```

### Desktop-App (Electron)

`electron/main.cjs` startet den Hub (`dist/src/main.js`) als Kindprozess mit dem Electron-Binary im Node-Modus (`ELECTRON_RUN_AS_NODE=1`). Das Paket braucht deshalb kein Node.js auf dem System. Übergeben werden `IO_DARTS_DATA_DIR` (App-Datenordner des Benutzers), `IO_DARTS_SUPERVISED=1` und `PORT` (aus `IO_DARTS_PORT`, Standard 3000). Beendet sich der Hub mit Code 75 (Neustart-Anforderung), startet Electron ihn neu. Jedes andere Ende zeigt einen Fehler und schließt die App.

Die Pfade für Laufzeitdaten kommen aus `src/core/runtimePaths.ts` (`runtimePath()`): `IO_DARTS_DATA_DIR`, wenn gesetzt, sonst wie bisher `dist/`. Schreibgeschützte Assets (`web/dist`, die eingebauten Module in `modules/`) werden weiter relativ zum Code aufgelöst.

Die App wird ohne asar gepackt (`asar: false` in `electron-builder.yml`): Das Backend läuft als eigener Node-Prozess mit dem ESM-Loader, liest `web/dist` und `modules/*/module.json` über normale Dateipfade und verlinkt die eingebauten Module per Symlink in den Datenordner. Laufzeitdaten aus einem lokalen `dist/` (`dist/config` und weitere) kommen nicht ins Paket.

```bash
npm run setup               # einmalig: Abhängigkeiten
npm run build:app           # Backend, Weboberfläche, Game-Display-UI
npm run electron:dev        # bauen + Electron lokal starten
npm run dist:mac            # build:app + electron-builder --mac   -> releases/
npm run dist:linux          # build:app + electron-builder --linux -> releases/
npm run dist:win            # build:app + electron-builder --win   -> releases/
npm run dist:all            # alle drei
npx electron-builder --mac --dir   # nur die entpackte App, schneller zum Testen
```

Die `dist*`-Scripts sind Aliase für die `electron:build*`-Scripts. Getestet ist nur der macOS-Build. Codesignierung und Notarisierung sind nicht eingerichtet (macOS nutzt ersatzweise eine Ad-hoc-Signatur). Die früheren pkg-Scripts (`build:linux`, `build:macos`, `build:windows`, `build:all`) sind entfernt, pkg unterstützt Node.js 22 nicht.

### Linting

```bash
npm run lint       # eslint src --ext .ts
npm run lint:fix
```

---

## Architektur

### Übersicht

```
┌─────────────────────────────────────────────────────────────┐
│                     Electron (optional)                      │
│  Startet das Backend als Child-Prozess, zeigt es in einem    │
│  Fenster mit System-Tray-Icon. `npm start` bzw.               │
│  `node dist/src/main.js` starten das Backend direkt genauso.  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Node.js Backend (Fastify)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ REST API     │  │  WebSocket   │  │  Module Manager   │  │
│  │ /api/*       │  │  /api/events │  │  + IPC-Bridge      │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│         │                  │                   │            │
│         └──────────────────┼───────────────────┘            │
│                            ▼                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │       AuthService + SocketService + EventParser          │ │
│  │  Loggt sich beim Autodarts-Account ein, öffnet den        │ │
│  │  Board-WebSocket, wandelt rohe Nachrichten in typisierte  │ │
│  │  Events um                                                │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        Autodarts.io                           │
└─────────────────────────────────────────────────────────────┘
```

### Event-Flow

```
Autodarts -> Board-WebSocket -> EventParser -> EventBus -> Module Manager -> Module
                                     │                            │
                                     │ generiert synthetische      └──> prozessinterne Handler
                                     │ Events (player.change,           oder IPC zu Modul-Prozessen
                                     │ turn.finished, game.finished,
                                     │ match.finished)
                                     └──> WebSocket API -> Hub-UI, Modul-UIs
```

### Native vs. Synthetische Events

Der `EventParser` leitet manche Autodarts-Nachrichten weitgehend unverändert weiter ("nativ") und leitet andere aus `match.state`-Updates ab ("synthetisch"):

| Event-Typ | Quelle | Beschreibung |
|-----------|--------|--------------|
| `board.state`, `board.event` | Nativ | Board-Verbindung und andere rohe Board-Events |
| `match.start`, `match.delete`, `match.finish` | Nativ | Match-Lifecycle-Nachrichten von Autodarts |
| `match.state` | Nativ | Jedes Match-Status-Update |
| `throw.detected` | Nativ | Ein Wurf wird gewertet |
| `takeout.started`, `takeout.finished` | Nativ | Pfeile werden gerade/wurden gezogen |
| `player.change` | Synthetisch | Generiert, wenn der Index des aktiven Spielers sich ändert |
| `turn.finished` | Synthetisch | Generiert nach 3 Darts, einem Bust oder einem Rundenwechsel |
| `game.finished`, `match.finished`, `match.result` | Synthetisch | Generiert, wenn ein Leg/Match endet |
| `cricket.state`, `cricket.closed` | Synthetisch | Generiert, wenn sich in Cricket/Tactics Treffer oder Punkte ändern bzw. ein Spieler ein Feld schließt |

Dies ermöglicht Modulen, auf logische Events zu reagieren, ohne den rohen `match.state` parsen zu müssen. Siehe [API-Dokumentation](api.md#autodarts-events) für die vollständige Liste mit Payload-Feldern.

#### Spielmodus und Cricket

Jedes der oben genannten synthetischen Events sowie `match.state` und `throw.detected` trägt zusätzlich `data.game`:

```json
{ "variant": "Cricket", "mode": "cricket", "cutThroat": false }
```

`mode` ist `'x01' | 'cricket' | 'tactics' | 'other'`. In Cricket/Tactics liefert `cricket.state` den vollständigen Spielstand (Punkte und Treffer pro Feld je Spieler, Spieler über den stabilen `index`) und `cricket.closed` einmal pro geschlossenem Feld und Spieler im Leg. Payload-Beispiele mit allen Feldern stehen im [Module SDK](module-sdk.md#synthetische-events-generiert-vom-eventparser-des-hubs).

### Modul-Sandbox

Prozess-Module laufen als isolierte Child-Prozesse, jeweils mit eigenem Unix-Domain-Socket:

```
Backend
   │
   ├── Modul 1 (Subprozess, Module-SDK-IPC)
   │      └── Unix-Socket
   │
   ├── Modul 2 (Subprozess, Module-SDK-IPC)
   │      └── Unix-Socket
   │
   └── WLED / Game Display / Darts Caller (prozessinterne Handler, kein Subprozess)
```

### Authentifizierung

Zwei unabhängige Ebenen (siehe [API-Dokumentation](api.md#authentifizierung) für das genaue Verhalten pro Route):

1. **Standardmäßig nur lokal.** `src/api/Server.ts` lehnt jede Anfrage ab, deren `Origin`-Header nicht zu einer lokalen/privaten Adresse auflöst, sowohl auf CORS-Ebene als auch mit einer expliziten `onRequest`-Prüfung. Der Hub ist nicht dafür gedacht, von außerhalb des LANs erreichbar zu sein.
2. **Optionaler Web-Login.** Ein globaler `onRequest`-Hook (`src/api/middleware/auth.ts`) beantwortet bis zum Abschluss des Setups jede `/api/*`-Route außer `/api/setup/*` mit 403 (die Web-UI mit dem Setup-Assistenten lädt trotzdem) und verlangt danach, falls "Web-Auth" in den Einstellungen aktiviert ist, für alles außer einer kurzen Liste immer öffentlicher Routen (`/health`, `/api/auth/session`, `/api/auth/login`, `/api/setup/status`) ein gültiges `autodarts_session`-Cookie.

Die Autodarts-Verbindung selbst ist vom Web-Login getrennt: `AuthService` loggt sich bei der offiziellen Autodarts-Account-API mit der im Setup-Wizard erfassten E-Mail/Passwort/Board-ID ein, unabhängig davon, ob der eigene Web-Login des Hubs aktiviert ist.

---

## Code Style

### TypeScript

- **Strict Mode** aktiviert
- **ESLint** für Linting (`npm run lint`)
- Keine `any`-Types, wenn vermeidbar

### Vue

- **Composition API** (nicht Options API)
- **`<script setup>`** Syntax
- **TypeScript** für alle Komponenten

### Commits

Wir verwenden [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new WLED effect
fix: resolve connection timeout issue
docs: update installation guide
chore: upgrade dependencies
```

---

## Hilfe & Support

- **Issues**: GitHub Issues für Bugs und Features
- **Discussions**: GitHub Discussions für Fragen
- **Code Reviews**: PRs werden reviewed, bevor sie gemergt werden

---

## Event System

### EventParser

`src/core/socket/EventParser.ts` liest rohe Nachrichten vom Autodarts-Board-WebSocket und:

1. Gibt native Events weitgehend unverändert weiter (`board.state`, `match.start`, `throw.detected`, ...).
2. Analysiert jedes `match.state`-Update, um zusätzlich die synthetischen Events (`player.change`, `turn.finished`, `game.finished`, `match.finished`, `match.result`, `cricket.state`, `cricket.closed`) oben zu generieren.

### Module Handlers

Die drei prozessinternen mitgelieferten Module haben jeweils eine Handler-Klasse, die im eigenen Ordner des Moduls liegt und über `src/core/modules/handlers/index.ts` re-exportiert wird:

| Handler | Modul | Kernfunktionen |
|---------|-------|-----------------|
| `modules/wled/src/WledHandler.ts` | WLED | HTTP-Aufrufe an die WLED-JSON-API, Spielerfarben, Fade-Zeit, dauerbasierte Farbwiederherstellung, leitet Wurf-Unterschlüssel (`throw.triple`, `throw.180`, ...) aus `throw.detected` ab |
| `modules/game-display/src/GameDisplayHandler.ts` | Game Display | Liefert Konfiguration/Zustand an das Vue-Frontend unter `/module-ui/game-display/` |
| `modules/darts-caller/src/DartsCallerHandler.ts` | Darts Caller | Dispatch für TTS/Audio-Wiedergabe, Voice Pack Generator, ElevenLabs-Integration |

Prozess-Module erweitern stattdessen `AutodartsModule` aus `@autodarts-hub/module-sdk` und implementieren `onInit`/`onEvent`/`onConfigUpdate`/`onShutdown` (siehe [Module SDK](module-sdk.md)).

### Autodarts Array-Rotation bei Leg-Wechseln

**Wichtig:** Autodarts rotiert das Spieler-Array nach jedem Leg. Dies hat Auswirkungen auf die Event-Verarbeitung:

```
Match-Start:
  players[0] = { index: 0, name: "Max" }
  players[1] = { index: 1, name: "Anna" }
  data.player = 0 → Max ist am Zug

Nach Leg 1 (Max gewinnt, Anna beginnt Leg 2):
  players[0] = { index: 1, name: "Anna" }  ← Array rotiert!
  players[1] = { index: 0, name: "Max" }
  data.player = 0 → Jetzt ist Anna am Zug (aber Array-Position 0)
```

#### Der stabile `player.index`

Der `player.index`-Wert bleibt über das gesamte Match hinweg stabil und sollte für Zuordnungen verwendet werden:

```typescript
// Falsch: Array-Position verwenden
const player = players[data.player]; // Kann nach Rotation falsch sein!

// Richtig: Stabilen Index verwenden
const playerIndex = players[data.player]?.index;
const player = players.find(p => p.index === playerIndex);
```

#### Event-Daten bei Leg-Wechsel

Die synthetischen Events (`player.change`, `turn.finished`, `game.finished`) enthalten dafür zusätzliche Felder:

| Feld | Beschreibung | Zuverlässigkeit |
|------|-------------|-----------------|
| `playerName` | Spielername zum Zeitpunkt des Events | Hoch |
| `winnerName` | Gewinner-Name (bei `game.finished`) | Hoch |
| `playerIndex` | Stabiler `player.index` | Hoch |
| `winnerPlayerIndex` | Stabiler Gewinner-Index | Hoch |
| `currentPlayer` | Array-Position | Niedrig (nach Rotation) |
| `winner` | Array-Position des Gewinners | Niedrig (nach Rotation) |

**Best Practice:** Verwende immer zuerst `playerName`/`winnerName` oder `playerIndex`/`winnerPlayerIndex` für Zuordnungen.

### Spielerfarben-Auflösung

Module können Spielerfarben über das Spielerverwaltungssystem auflösen:

```typescript
// Farbe aus Event-Daten
const color = event.data.color || '#ffffff';

// Oder über die lokale Spielerdatenbank
const players = await fetch('/api/players').then(r => r.json());
```

### PlayerResolver Pattern (Frontend-Module)

Frontend-Module wie Game Display, die im Browser mit Array-Rotation umgehen müssen, nutzen ein PlayerResolver-Pattern:

```typescript
class PlayerResolver {
  // Persistente Map: Match-Start-Zuordnungen
  private originalIndexByName: Map<string, number> = new Map()

  updatePlayers(autodartsPlayers: Player[]): void {
    // Nur beim ERSTEN Aufruf die originalen Zuordnungen speichern
    if (!this.isInitialized) {
      autodartsPlayers.forEach(p => {
        this.originalIndexByName.set(p.name.toLowerCase(), p.index)
      })
      this.isInitialized = true
    }
  }

  findPlayer(name: string, players: Player[]): Player | null {
    // Immer die ORIGINALE Zuordnung verwenden
    const idx = this.originalIndexByName.get(name.toLowerCase())
    if (idx !== undefined) {
      return players.find(p => p.index === idx) || null
    }
    return null
  }

  // Bei neuem Match zurücksetzen
  reset(): void {
    this.originalIndexByName.clear()
    this.isInitialized = false
  }
}
```

**Wichtig:** Der Resolver muss bei `match.start` zurückgesetzt werden, damit die neuen Spielerzuordnungen korrekt erfasst werden.

---

## KI-Provider-System

Der IO-Darts-Agent enthält ein flexibles KI-Provider-System (`src/core/ai/`), das Module für verschiedene KI-gestützte Funktionen nutzen können.

### Architektur

```
┌─────────────────────────────────────────────────────────────┐
│                     AI Provider Service                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  ElevenLabs  │  │ Runway /     │  │   OpenAI /         │  │
│  │  (TTS)       │  │ Higgsfield   │  │   Anthropic /      │  │
│  │              │  │ (Video/Bild) │  │   Ollama (Text)    │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │ Stability AI │  │  Replicate   │                        │
│  │ (Bilder)     │  │  (Verschied.)│                        │
│  └──────────────┘  └──────────────┘                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                          Module                               │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐   │
│  │ Darts Caller│ │ Game Display│ │   Eigene Module     │   │
│  │ (TTS)       │ │ (Animationen)│ │  (KI-Funktionen)    │   │
│  └─────────────┘ └─────────────┘ └─────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Provider-Konfiguration

Provider werden in `dist/config/ai-providers.json` konfiguriert (oder über den Menüpunkt **AI Provider** (`/ai-settings`) in der UI, bzw. `PUT /api/ai/providers/:id`):

```json
[
  {
    "id": "elevenlabs",
    "type": "elevenlabs",
    "name": "ElevenLabs",
    "apiKey": "dein-api-key",
    "enabled": true,
    "options": {
      "defaultModel": "eleven_multilingual_v2"
    }
  },
  {
    "id": "runway",
    "type": "runway",
    "name": "Runway ML",
    "apiKey": "dein-api-key",
    "enabled": true
  }
]
```

### Unterstützte Provider

| Provider | Typ | Fähigkeiten | Anwendungsfälle |
|----------|-----|-------------|-----------------|
| **ElevenLabs** | `elevenlabs` | `audio-tts` | Voice Packs, Spielernamen-Synthese |
| **Runway ML** | `runway` | `video-generation` | Animations-Generator (eine von zwei wählbaren Engines) |
| **Higgsfield** | `higgsfield` | `image-generation`, `video-generation` | Animations-Generator (die andere wählbare Engine) |
| **OpenAI** | `openai` | `text`, `image-generation` | Chat, Bildgenerierung |
| **Anthropic** | `anthropic` | `text` | Chat, Analyse |
| **Stability AI** | `stability` | `image-generation` | Bildgenerierung |
| **Ollama** | `ollama` | `text` | Lokale LLM-Inferenz |
| **Replicate** | `replicate` | Verschiedene | Eigene gehostete Modelle |

### KI-Provider im Code verwenden

```typescript
import { getAIProviderService } from '../core/ai/index.js';

const service = getAIProviderService();

// Einen bestimmten Provider abrufen
const elevenlabs = service.getProvider('elevenlabs');
if (elevenlabs?.isAvailable()) {
  const audio = await service.generateSpeech(
    { text: 'One hundred and eighty!', voice: 'voice-id-oder-name' },
    'elevenlabs'
  );
}

// Welche Provider aktuell eine Fähigkeit anbieten
const capabilities = service.getAvailableCapabilities();
```

### Einen eigenen Provider erstellen

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

Registriere ihn mit `aiService.registerProviderFactory('my-provider', (config) => new MyProvider(config))` in `src/core/ai/AIProviderInitializer.ts`.
