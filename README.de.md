# IO-Darts-Agent

Ein modularer Hub für [Autodarts](https://autodarts.io), der Echtzeit-Events verarbeitet und über erweiterbare Module verschiedene Aktionen auslösen kann.

**[English Version](README.md)**

## Features

- **Autodarts Integration** - Verbindet sich mit dem Autodarts WebSocket und empfängt alle Spiel-Events in Echtzeit
- **Modulares System** - Erweiterbares Plugin-System für verschiedene Aktionen (WLED-Steuerung, Game Display, Darts Caller, etc.)
- **Web-Interface** - Moderne Vue.js-basierte Konfigurationsoberfläche
- **Spielerverwaltung** - Eigene Spielerprofile mit individuellen Farben für Lichteffekte
- **Voice Pack Generator** - Erstelle eigene Caller-Voice-Packs mit ElevenLabs TTS
- **Echtzeit-Logs** - Live-Ansicht aller Events und Modul-Aktivitäten
- **Mehrsprachig** - Interface verfügbar auf Deutsch, Englisch und Spanisch
- **KI-Integration** - Integrierte Unterstützung für KI-Anbieter (ElevenLabs, Runway ML, OpenAI, Anthropic und mehr)

---

## Download & Installation

### Fertige Pakete (empfohlen)

Lade das passende Paket für dein System herunter:

| System | Download | Beschreibung |
|--------|----------|--------------|
| **Windows** | [`IO-Darts-Agent Setup.exe`](https://github.com/user/io-darts-agent/releases/latest) | One-Click Installer |
| **macOS** | [`IO-Darts-Agent.dmg`](https://github.com/user/io-darts-agent/releases/latest) | Disk Image |
| **Ubuntu/Debian** | [`io-darts-agent.deb`](https://github.com/user/io-darts-agent/releases/latest) | Debian-Paket |
| **Linux** | [`IO-Darts-Agent.AppImage`](https://github.com/user/io-darts-agent/releases/latest) | Universal Linux |

> **Node.js ist NICHT erforderlich!** Die App enthält alles, was benötigt wird.

### Erster Start

1. Starte die App (findet sich im Start-Menü / Launchpad)
2. Das Web-Interface öffnet sich automatisch unter `http://localhost:3000`
3. Folge dem Setup-Wizard:
   - Gib deine Autodarts-Zugangsdaten ein
   - Wähle dein Board
   - Fertig!

---

## Module

### Integrierte Module

| Modul | Beschreibung |
|-------|-------------|
| **WLED Lichtsteuerung** | Steuert WLED-kompatible LED-Strips basierend auf Spielereignissen. Spielerfarben, Spezialeffekte für 180er, Triples, Bulls und mehr. Unterstützt Presets, Effekte, konfigurierbare Übergangszeiten und Intent-Aktionen. |
| **Game Display** | Zeigt Spielstand auf externen Displays/Tablets in Echtzeit an. Checkout-Vorschläge, Spielerfarben, Animationen, Match-Start-Bildschirm und Ergebnistabelle mit Statistiken. |
| **Darts Caller** | Professioneller Darts-Caller mit TTS oder eigenen Audio-Packs. Ansagen für Scores, Checkouts, Spielerwechsel und besondere Events. Inkl. Voice Pack Generator mit ElevenLabs-Integration. |

### Modul-Features

#### WLED Lichtsteuerung
- Event-basierte Aktionen für alle Spielereignisse
- Spielerfarben-Unterstützung mit automatischem Matching
- Temporäre Effekte mit Dauer und Übergangszeit (Fade)
- Unterstützung für Presets, Effekte, Solid-Farben
- Multi-Color-Effekte (bis zu 3 Farben)
- Einzelspieler-Modus-Unterstützung (takeout.finished wendet Spielerfarbe an)
- Intent-System-Unterstützung für Modul-zu-Modul-Kommunikation
- Automatische Spielerfarben-Wiederherstellung nach Event-Animationen

#### Game Display
- Echtzeit-Score-Updates
- Animierter Spielerfarben-Hintergrund
- Checkout-Vorschläge (2-170 Punkte)
- Dart-Visualisierung mit Animationen
- Multi-Spieler-Übersicht
- Demo-Modus zum Testen
- Konfigurierbare Animationen pro Event (180, Bull, High Score, Checkout, Bust, Leg/Set/Match-Win)
- **Spieler-spezifische Animationen**: Individuelle Animationen pro Spieler im "Spieler"-Tab
  - Eigene Animationen für 180, Leg-Win, Set-Win, Match-Win und Checkout pro Spieler
  - Unterstützt Built-in Animationen, GIF, Video und eigene Sounds
  - Spieler-Animationen überschreiben globale Animationen wenn der Spieler am Zug ist
- Match-Start-Bildschirm (konfigurierbar: Standard oder eigenes Bild/GIF)
- Match-Ergebnistabelle mit Chalkboard und Statistiken
- Konfigurierbare Anzeigedauer der Ergebnisse (automatisch ausblenden oder manuell)
- Konfigurierbare Hintergrundfarben

#### Darts Caller
- Score-Ansagen nach jeder Aufnahme
- Checkout-Ansagen ("You require...")
- Spezial-Ansagen: 180, Bust, Game Shot, Match Shot
- Spielerwechsel-Ansagen mit Spielernamen
- **Dynamische Spielernamen-Generierung**: Neue Spieler werden automatisch beim Spielstart erkannt und deren Namen via ElevenLabs TTS in Echtzeit generiert
- Browser-TTS oder eigene Audio-Packs
- Voice Pack Generator mit ElevenLabs TTS
- Multi-Voice-Pack-Unterstützung (verschiedene Stimmen/Sprachen)
- Lokale Audio-Wiedergabe (Server-seitig)

---

## KI-Features

IO-Darts-Agent enthält ein leistungsstarkes KI-Integrationssystem, das erweiterte Funktionen für alle Module ermöglicht.

### Unterstützte KI-Anbieter

| Anbieter | Typ | Funktionen |
|----------|-----|------------|
| **ElevenLabs** | Text-to-Speech | Voice Pack Generierung, dynamische Spielernamen-Synthese |
| **Runway ML** | Video-Generierung | Eigene Animationen aus Text/Bildern (Gen-2/Gen-3) |
| **OpenAI** | LLM / Bilder | Textgenerierung, Bildgenerierung (optional) |
| **Anthropic** | LLM | Textgenerierung (optional) |
| **Stability AI** | Bildgenerierung | Bildgenerierung (optional) |
| **Ollama** | Lokales LLM | Lokale KI-Modelle (optional) |
| **Replicate** | Multi-Modell | Verschiedene KI-Modelle (optional) |

### ElevenLabs-Integration

Die ElevenLabs-Integration ermöglicht die Sprachfunktionen:

- **Voice Pack Generator**: Generiere komplette Caller-Voice-Packs mit jeder ElevenLabs-Stimme
  - Alle Scores (0-180)
  - Checkout-Vorschläge ("You require X")
  - Spezial-Ansagen (180, Game Shot, Match Shot, Bust)
  - Spieler-spezifische Phrasen

- **Dynamische Spielernamen**: Wenn ein neuer Spieler einem Spiel beitritt, wird sein Name automatisch mit ElevenLabs TTS synthetisiert und für zukünftige Verwendung gecacht. Dies geschieht in Echtzeit beim Spielstart.

### Runway ML Animations-Generierung

Erstelle eigene Animationen für Spielereignisse:

- **Text-zu-Video**: Generiere Animationen aus Textbeschreibungen (z.B. "Feuerwerk-Celebration")
- **Bild-zu-Video**: Animiere statische Bilder für personalisierte Spieler-Celebrations
- **Anwendungsfälle**:
  - 180 Celebrations
  - Leg/Set/Match-Gewinn Animationen
  - Spieler-spezifische Sieges-Animationen
  - Eigene Checkout-Celebrations

### KI-Konfiguration

Konfiguriere KI-Anbieter im Web-Interface unter **Einstellungen > KI-Anbieter**:

1. Wähle einen Anbieter (z.B. ElevenLabs)
2. Gib deinen API-Key ein
3. Aktiviere den Anbieter
4. Teste die Verbindung

Anbieter-Einstellungen werden in `config/ai-providers.json` gespeichert.

### Module aus Git installieren

1. Öffne **Module** → **Modul installieren**
2. Gib die Git-URL ein
3. Klicke auf **Installieren**

---

## Events

Der Agent verarbeitet folgende Autodarts Events:

| Event | Beschreibung |
|-------|-------------|
| `match.start` | Match wurde gestartet |
| `match.finished` | Match wurde beendet (Gewinner ermittelt) |
| `match.finish` | Match wurde geschlossen (Benutzer hat "Beenden" geklickt) |
| `match.result` | Match-Ergebnis mit Chalkboard, Statistiken und Scores |
| `match.delete` | Match wurde abgebrochen |
| `match.state` | Match-Zustandsupdate (Scores, Spieler, etc.) |
| `throw.detected` | Wurf wurde erkannt |
| `player.change` | Spielerwechsel (synthetisches Event) |
| `turn.finished` | Aufnahme beendet (synthetisches Event) |
| `game.finished` | Leg/Set gewonnen |
| `takeout.started` | Pfeile ziehen begonnen |
| `takeout.finished` | Pfeile gezogen |

---

## Für Entwickler

### Voraussetzungen

- Node.js 18+
- npm 9+
- Git

### Entwicklungsumgebung

```bash
# Repository klonen
git clone https://github.com/user/io-darts-agent.git
cd io-darts-agent

# Dependencies installieren
npm install
cd web && npm install && cd ..
cd modules/game-display/web && npm install && cd ../../..

# Development Server starten
npm run dev
```

### Build

```bash
# Alles bauen (Backend + Frontend + Module)
npm run prebuild:dist

# Desktop-App bauen
npm run dist:mac      # macOS .dmg
npm run dist:win      # Windows .exe
npm run dist:linux    # Linux .deb, .AppImage
npm run dist:all      # Alle Plattformen
```

### Projektstruktur

```
io-darts-agent/
├── src/                    # Backend-Quellcode
│   ├── core/               # Core-Services
│   │   ├── auth/           # Autodarts-Authentifizierung
│   │   ├── socket/         # WebSocket & Event-Parsing
│   │   ├── events/         # Event-Bus-System
│   │   ├── config/         # Konfigurationsverwaltung
│   │   └── modules/        # Modul-System (Handler, Manager)
│   ├── api/                # Fastify REST API
│   └── types/              # TypeScript-Definitionen
├── web/                    # Vue 3 Frontend
├── modules/                # Integrierte Module
│   ├── wled/               # WLED Lichtsteuerung
│   ├── game-display/       # Game Display (mit Vue Frontend)
│   └── darts-caller/       # Darts Caller
├── media/                  # Medien-Dateien (Audio-Packs)
├── config/                 # Laufzeit-Konfiguration
└── docs/                   # Dokumentation
```

---

## Architektur

```
┌─────────────────────────────────────────────────────────────┐
│                     Web Browser (Config UI)                  │
│                    Vue 3 + Vite + Tailwind                   │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP REST + WebSocket
┌──────────────────────────▼──────────────────────────────────┐
│                    IO-Darts-Agent Backend                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  AuthService │ SocketService │ ConfigService │ Fastify │ │
│  └──────────────────────────┬─────────────────────────────┘ │
│                             │                                │
│  ┌──────────────────────────▼─────────────────────────────┐ │
│  │           EventBus + EventParser                        │ │
│  │  (Generiert synthetische Events: player.change, turn.finished) │
│  └──────────────────────────┬─────────────────────────────┘ │
│                             │                                │
│  ┌──────────────────────────▼─────────────────────────────┐ │
│  │                   ModuleManager                         │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐      │ │
│  │  │ WledHandler │ │ GameDisplay │ │ DartsCaller │      │ │
│  │  └─────────────┘ └─────────────┘ └─────────────┘      │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        Autodarts.io                          │
└─────────────────────────────────────────────────────────────┘
```

---

## API Referenz

### REST Endpoints

```
# Status
GET    /api/status              # Hub-Status und Verbindungsinfo

# Authentifizierung
POST   /api/auth/login          # Web-Interface Login
POST   /api/auth/logout         # Logout
GET    /api/auth/session        # Aktuelle Session

# Autodarts-Verbindung
POST   /api/autodarts/connect   # Mit Autodarts verbinden
POST   /api/autodarts/disconnect # Verbindung trennen

# Module
GET    /api/modules             # Liste aller Module
GET    /api/modules/:id         # Modul-Details + Config
POST   /api/modules/:id/start   # Modul starten
POST   /api/modules/:id/stop    # Modul stoppen
PUT    /api/modules/:id/config  # Config aktualisieren
DELETE /api/modules/:id         # Modul deinstallieren
POST   /api/modules/install     # Von Git-URL installieren

# Intents
GET    /api/intents             # Liste aller verfügbaren Intents (Basis)
GET    /api/intents/available   # Liste aller Intents mit vollständigem Payload-Schema
GET    /api/modules/:id/intents # Modul-Intent-Aktionen abrufen
PUT    /api/modules/:id/intents # Modul-Intent-Abonnements aktualisieren

# Match
GET    /api/match/current       # Aktueller Match-Status
GET    /api/match/current/players # Aktuelle Spieler
GET    /api/match/current/scores  # Aktuelle Scores

# Live Events
WS     /api/events              # WebSocket Event-Stream
```

---

## Lizenz

MIT License - siehe [LICENSE](LICENSE)

---

## Beitragen

Beiträge sind willkommen!

- **Bug Reports**: Öffne ein [Issue](https://github.com/user/io-darts-agent/issues)
- **Feature Requests**: Öffne ein [Issue](https://github.com/user/io-darts-agent/issues)
- **Pull Requests**: Fork & PR erstellen

---

## Support

- [GitHub Issues](https://github.com/user/io-darts-agent/issues)
- [Dokumentation](docs/)

---

Ein Projekt von [castor.io](https://castor.io)
