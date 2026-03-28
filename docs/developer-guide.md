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

---

## Entwicklungsumgebung einrichten

### Voraussetzungen

| Tool | Version | Hinweis |
|------|---------|---------|
| **Node.js** | 18+ | [Download](https://nodejs.org/) |
| **npm** | 9+ | Kommt mit Node.js |
| **Git** | 2.30+ | [Download](https://git-scm.com/) |
| **VS Code** | Aktuell | Empfohlener Editor |

### Projekt klonen

```bash
git clone https://github.com/nicokempe/io-darts-agent.git
cd io-darts-agent
```

### Dependencies installieren

```bash
# Backend-Dependencies
npm install

# Frontend-Dependencies
cd web && npm install && cd ..

# Modul-Dependencies
cd modules/game-display/web && npm install && cd ../../..
```

### Development Server starten

```bash
# Option 1: Nur Backend (mit Hot-Reload)
npm run dev

# Option 2: Backend + Frontend Dev-Server
npm run dev          # Terminal 1
cd web && npm run dev   # Terminal 2
```

Der Server läuft auf `http://localhost:3000`.

---

## Projekt-Struktur

```
io-darts-agent/
├── src/                    # Backend TypeScript Source
│   ├── main.ts             # Entry Point
│   ├── server.ts           # Express Server
│   ├── autodarts/          # Autodarts API & WebSocket
│   ├── modules/            # Modul-Manager
│   └── types/              # TypeScript Definitionen
├── web/                    # Vue.js Frontend
│   ├── src/
│   │   ├── views/          # Seiten-Komponenten
│   │   ├── components/     # Wiederverwendbare Komponenten
│   │   └── stores/         # Pinia Stores
│   └── dist/               # Kompiliertes Frontend
├── modules/                # Mitgelieferte Module
│   ├── wled/               # WLED Modul
│   └── game-display/       # Game Display Modul
├── modules_installed/      # Installierte Module (Symlinks)
├── electron/               # Electron Main Process
│   └── main.js             # Desktop App Entry
├── config/                 # Konfigurationsdateien (gitignored)
├── dist/                   # Kompiliertes Backend & Builds
├── build/                  # Build-Assets (Icons, etc.)
├── scripts/                # Build & Release Scripts
├── docs/                   # Dokumentation
└── .github/workflows/      # GitHub Actions
```

---

## Backend-Entwicklung

### Technologie-Stack

- **Runtime**: Node.js 18+
- **Sprache**: TypeScript
- **Framework**: Express.js
- **WebSocket**: ws
- **Build**: esbuild

### Wichtige Dateien

| Datei | Beschreibung |
|-------|-------------|
| `src/main.ts` | Entry Point, startet Server |
| `src/server.ts` | Express Server, API Routes |
| `src/autodarts/client.ts` | Autodarts API Client |
| `src/autodarts/websocket.ts` | WebSocket zu Autodarts |
| `src/modules/manager.ts` | Lädt und verwaltet Module |
| `src/modules/sandbox.ts` | Sandbox für Modul-Ausführung |

### API Endpoints

| Endpoint | Methode | Beschreibung |
|----------|---------|-------------|
| `/api/status` | GET | Verbindungsstatus |
| `/api/config` | GET/POST | Hub-Konfiguration |
| `/api/modules` | GET | Liste aller Module |
| `/api/modules/:id` | GET/POST | Einzelnes Modul |
| `/api/modules/:id/config` | GET/POST | Modul-Konfiguration |
| `/api/players` | GET/POST | Spielerverwaltung |
| `/api/events` | WebSocket | Live Event-Stream |

### Build

```bash
# TypeScript kompilieren
npm run build

# Mit Source Maps (für Debugging)
npm run build -- --sourcemap
```

---

## Frontend-Entwicklung

### Technologie-Stack

- **Framework**: Vue 3
- **Build**: Vite
- **Styling**: Tailwind CSS
- **State**: Pinia
- **Router**: Vue Router

### Development

```bash
cd web

# Dev-Server mit Hot-Reload
npm run dev

# Produktions-Build
npm run build

# Type-Check
npm run type-check
```

### Komponenten-Struktur

```
web/src/
├── App.vue                 # Root-Komponente
├── main.ts                 # Vue App Entry
├── router/                 # Vue Router Konfiguration
├── stores/                 # Pinia State Management
│   ├── connection.ts       # Verbindungsstatus
│   ├── modules.ts          # Module
│   └── players.ts          # Spieler
├── views/                  # Seiten
│   ├── DashboardView.vue
│   ├── ModulesView.vue
│   ├── PlayersView.vue
│   └── ...
├── components/             # Wiederverwendbar
│   ├── BaseCard.vue
│   ├── ModuleCard.vue
│   └── ...
└── assets/                 # Statische Assets
```

---

## Module entwickeln

Siehe [Developer Quick Start](developer-quickstart.md) für eine schnelle Einführung.

Siehe [Module SDK](module-sdk.md) für die vollständige API-Dokumentation.

### Modul-Typen

| Typ | Beschreibung |
|-----|-------------|
| `internal` | Kein eigener Prozess, nur Events |
| `process` | Eigener Node.js Prozess (Sandbox) |
| `external` | Externer Prozess/Service |

### Beispiel-Module

- **WLED** (`modules/wled/`) - Einfaches Modul ohne UI
- **Game Display** (`modules/game-display/`) - Modul mit eigenem Frontend

---

## Testing

### Unit Tests

```bash
# Alle Tests
npm test

# Watch-Mode
npm run test:watch

# Coverage
npm run test:coverage
```

### E2E Tests (TODO)

```bash
npm run test:e2e
```

---

## Build & Release

### Lokaler Build

```bash
# Backend kompilieren
npm run build

# Frontend bauen
npm run build:frontend

# Module bauen
npm run build:modules

# Alles zusammen
npm run prebuild:dist
```

### Desktop-App bauen (Electron)

```bash
# Alle Plattformen
npm run dist:all

# Einzelne Plattformen
npm run dist:mac      # macOS .dmg
npm run dist:win      # Windows .exe
npm run dist:linux    # Linux .deb, .AppImage, .rpm
```

Die Builds landen in `dist/`.

### Release erstellen

**Option 1: Automatisch via GitHub Actions**

```bash
# Release-Script verwenden
./scripts/create-release.sh 1.2.0
```

**Option 2: Manuell mit Git Tag**

```bash
git tag -a v1.2.0 -m "Release v1.2.0"
git push origin v1.2.0
```

GitHub Actions baut automatisch alle Plattformen und erstellt ein Release.

### CI/CD Pipeline

Die `.github/workflows/release.yml` definiert:

1. **Build Linux** (Ubuntu Runner) → `.deb`, `.rpm`, `.AppImage`
2. **Build Windows** (Windows Runner) → `.exe`
3. **Build macOS** (macOS Runner) → `.dmg`, `.zip`
4. **Create Release** → Alle Artifacts hochladen

---

## Architektur

### Übersicht

```
┌─────────────────────────────────────────────────────────────┐
│                        Electron                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                     Main Process                        │ │
│  │  - Startet Backend als Child Process                    │ │
│  │  - Zeigt Fenster mit Web-UI                            │ │
│  │  - System Tray Integration                              │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Node.js Backend                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Express API  │  │  WebSocket   │  │  Module Manager  │  │
│  │  /api/*      │  │  /api/events │  │  Sandbox         │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│         │                  │                   │            │
│         └──────────────────┼───────────────────┘            │
│                            │                                 │
│                            ▼                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                   Autodarts Client                      │ │
│  │  - API Authentifizierung                                │ │
│  │  - WebSocket Verbindung                                 │ │
│  │  - Event Parsing & Weiterleitung                        │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        Autodarts.io                          │
└─────────────────────────────────────────────────────────────┘
```

### Event-Flow

```
Autodarts → WebSocket → Backend → Module Manager → Module
                            │
                            └──→ WebSocket → Frontend
```

### Modul-Sandbox

Module laufen in isolierten Prozessen:

```
Backend
   │
   ├── Module 1 (Subprocess)
   │      └── IPC Socket
   │
   ├── Module 2 (Subprocess)
   │      └── IPC Socket
   │
   └── ...
```

---

## Code Style

### TypeScript

- **Strict Mode** aktiviert
- **ESLint** + **Prettier** für Formatting
- Keine `any` Types (wenn vermeidbar)

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

## Nützliche Befehle

```bash
# Lint
npm run lint

# Type-Check
npm run type-check

# Clean Build
rm -rf dist && npm run build

# Update Dependencies
npm update

# Check for outdated packages
npm outdated
```

---

## Hilfe & Support

- **Issues**: GitHub Issues für Bugs und Features
- **Discussions**: GitHub Discussions für Fragen
- **Code Reviews**: PRs werden reviewed bevor sie gemergt werden
