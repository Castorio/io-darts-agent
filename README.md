# IO-Darts-Agent

Ein modularer Agent für [Autodarts](https://autodarts.io), der Echtzeit-Events verarbeitet und über erweiterbare Module verschiedene Aktionen auslösen kann.

## Features

- **Autodarts Integration** - Verbindet sich mit dem Autodarts WebSocket und empfängt alle Spiel-Events in Echtzeit
- **Modulares System** - Erweiterbares Plugin-System für verschiedene Aktionen (WLED-Steuerung, Game Display, etc.)
- **Web-Interface** - Moderne Vue.js-basierte Konfigurationsoberfläche
- **Spielerverwaltung** - Eigene Spielerprofile mit individuellen Farben für Lichteffekte
- **Echtzeit-Logs** - Live-Ansicht aller Events und Modul-Aktivitäten
- **Desktop App** - Native Anwendung für Windows, macOS und Linux

---

## Download & Installation

### Fertige Pakete (empfohlen)

Lade das passende Paket für dein System herunter:

| System | Download | Beschreibung |
|--------|----------|--------------|
| **Windows** | [`IO-Darts-Agent Setup.exe`](https://github.com/Castorio/io-darts-agent/releases/latest) | One-Click Installer |
| **macOS** | [`IO-Darts-Agent.dmg`](https://github.com/Castorio/io-darts-agent/releases/latest) | Disk Image |
| **Ubuntu/Debian** | [`io-darts-agent.deb`](https://github.com/Castorio/io-darts-agent/releases/latest) | Debian-Paket |
| **Linux** | [`IO-Darts-Agent.AppImage`](https://github.com/Castorio/io-darts-agent/releases/latest) | Universal Linux |

> **Node.js ist NICHT erforderlich!** Die App enthält alles, was benötigt wird.

**Detaillierte Anleitung:** [Installation](docs/installation.md)

### Erster Start

1. Starte die App (findet sich im Start-Menü / Launchpad)
2. Das Web-Interface öffnet sich automatisch
3. Folge dem Setup-Wizard:
   - Gib deine Autodarts-Zugangsdaten ein
   - Wähle dein Board
   - Fertig!

---

## Module

### Integrierte Module

| Modul | Beschreibung |
|-------|-------------|
| **WLED** | Steuert WLED-kompatible LED-Strips bei Triples, 180ern, etc. |
| **Game Display** | Zeigt Spielstand auf externen Displays/Tablets an |

### Module aus Git installieren

1. Öffne **Module** → **Modul installieren**
2. Gib die Git-URL ein
3. Klicke auf **Installieren**

---

## Dokumentation

### Für Benutzer

- [**Installation**](docs/installation.md) - Schritt-für-Schritt Anleitung
- [**Benutzerhandbuch**](docs/user-guide.md) - Komplette Anleitung mit Screenshots
- [**Features**](docs/features.md) - Alle Features im Detail

### Für Entwickler

- [**Developer Guide**](docs/developer-guide.md) - Entwicklungsumgebung & Architektur
- [**Developer Quick Start**](docs/developer-quickstart.md) - Modul in 5 Minuten erstellen
- [**Module SDK**](docs/module-sdk.md) - Vollständige Modul-API
- [**API Referenz**](docs/api.md) - REST API & WebSocket Events

---

## Für Entwickler

### Voraussetzungen

- Node.js 18+
- npm 9+
- Git

### Entwicklungsumgebung

```bash
# Repository klonen
git clone https://github.com/Castorio/io-darts-agent.git
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

### Release erstellen

```bash
# Version taggen & GitHub Actions triggern
./scripts/create-release.sh 1.0.0
```

GitHub Actions baut automatisch alle Plattformen und erstellt ein Release.

---

## Architektur

```
┌─────────────────────────────────────────────────────────────┐
│                     Electron Desktop App                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ System Tray  │  Main Window  │  Backend Process        │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                     Node.js Backend                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Express API  │  │  WebSocket   │  │  Module Manager  │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│                            │                                 │
│  ┌─────────────────────────▼────────────────────────────┐  │
│  │              Autodarts WebSocket Client               │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        Autodarts.io                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Events

Der Agent verarbeitet folgende Autodarts Events:

| Event | Beschreibung |
|-------|-------------|
| `match.started` | Match wurde gestartet |
| `match.finished` | Match wurde beendet |
| `match.deleted` | Match wurde abgebrochen |
| `throw.detected` | Wurf wurde erkannt |
| `player.changed` | Spielerwechsel |
| `turn.started` | Neue Aufnahme gestartet |
| `turn.finished` | Aufnahme beendet |
| `game.finished` | Leg/Set gewonnen |

---

## Lizenz

MIT License - siehe [LICENSE](LICENSE)

---

## Beitragen

Beiträge sind willkommen!

- **Bug Reports**: Öffne ein [Issue](https://github.com/Castorio/io-darts-agent/issues)
- **Feature Requests**: Öffne ein [Issue](https://github.com/Castorio/io-darts-agent/issues)
- **Pull Requests**: Fork & PR erstellen

---

## Support

- [GitHub Issues](https://github.com/Castorio/io-darts-agent/issues)
- [Dokumentation](docs/)

---

Ein Projekt von [castor.io](https://castor.io)
