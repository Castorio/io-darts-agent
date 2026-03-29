# Developer Guide

This guide is for developers who want to contribute to IO-Darts-Agent or create their own modules.

---

## Table of Contents

1. [Setting Up Development Environment](#setting-up-development-environment)
2. [Project Structure](#project-structure)
3. [Backend Development](#backend-development)
4. [Frontend Development](#frontend-development)
5. [Developing Modules](#developing-modules)
6. [Testing](#testing)
7. [Build & Release](#build--release)
8. [Architecture](#architecture)

---

## Setting Up Development Environment

### Prerequisites

| Tool | Version | Note |
|------|---------|------|
| **Node.js** | 18+ | [Download](https://nodejs.org/) |
| **npm** | 9+ | Comes with Node.js |
| **Git** | 2.30+ | [Download](https://git-scm.com/) |
| **VS Code** | Current | Recommended editor |

### Clone Project

```bash
git clone https://github.com/user/io-darts-agent.git
cd io-darts-agent
```

### Install Dependencies

```bash
# Backend dependencies
npm install

# Frontend dependencies
cd web && npm install && cd ..

# Module dependencies
cd modules/game-display/web && npm install && cd ../../..
```

### Start Development Server

```bash
# Option 1: Backend only (with hot-reload)
npm run dev

# Option 2: Backend + Frontend dev server
npm run dev          # Terminal 1
cd web && npm run dev   # Terminal 2
```

Server runs on `http://localhost:3000`.

---

## Project Structure

```
io-darts-agent/
├── src/                    # Backend TypeScript Source
│   ├── main.ts             # Entry Point
│   ├── server.ts           # Express Server
│   ├── autodarts/          # Autodarts API & WebSocket
│   ├── modules/            # Module Manager
│   └── types/              # TypeScript Definitions
├── web/                    # Vue.js Frontend
│   ├── src/
│   │   ├── views/          # Page Components
│   │   ├── components/     # Reusable Components
│   │   └── stores/         # Pinia Stores
│   └── dist/               # Compiled Frontend
├── modules/                # Built-in Modules
│   ├── wled/               # WLED Module
│   └── game-display/       # Game Display Module
├── modules_installed/      # Installed Modules (Symlinks)
├── electron/               # Electron Main Process
│   └── main.js             # Desktop App Entry
├── config/                 # Configuration Files (gitignored)
├── dist/                   # Compiled Backend & Builds
├── build/                  # Build Assets (Icons, etc.)
├── scripts/                # Build & Release Scripts
├── docs/                   # Documentation
└── .github/workflows/      # GitHub Actions
```

---

## Backend Development

### Technology Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **Framework**: Express.js
- **WebSocket**: ws
- **Build**: esbuild

### Important Files

| File | Description |
|------|-------------|
| `src/main.ts` | Entry point, starts server |
| `src/server.ts` | Express server, API routes |
| `src/autodarts/client.ts` | Autodarts API client |
| `src/autodarts/websocket.ts` | WebSocket to Autodarts |
| `src/modules/manager.ts` | Loads and manages modules |
| `src/modules/sandbox.ts` | Sandbox for module execution |

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/status` | GET | Connection status |
| `/api/config` | GET/POST | Hub configuration |
| `/api/modules` | GET | List all modules |
| `/api/modules/:id` | GET/POST | Single module |
| `/api/modules/:id/config` | GET/POST | Module configuration |
| `/api/players` | GET/POST | Player management |
| `/api/events` | WebSocket | Live event stream |

### Build

```bash
# Compile TypeScript
npm run build

# With source maps (for debugging)
npm run build -- --sourcemap
```

---

## Frontend Development

### Technology Stack

- **Framework**: Vue 3
- **Build**: Vite
- **Styling**: Tailwind CSS
- **State**: Pinia
- **Router**: Vue Router

### Development

```bash
cd web

# Dev server with hot-reload
npm run dev

# Production build
npm run build

# Type check
npm run type-check
```

### Component Structure

```
web/src/
├── App.vue                 # Root Component
├── main.ts                 # Vue App Entry
├── router/                 # Vue Router Configuration
├── stores/                 # Pinia State Management
│   ├── connection.ts       # Connection Status
│   ├── modules.ts          # Modules
│   └── players.ts          # Players
├── views/                  # Pages
│   ├── DashboardView.vue
│   ├── ModulesView.vue
│   ├── PlayersView.vue
│   └── ...
├── components/             # Reusable
│   ├── BaseCard.vue
│   ├── ModuleCard.vue
│   └── ...
└── assets/                 # Static Assets
```

---

## Developing Modules

See [Developer Quick Start](developer-quickstart.md) for a quick introduction.

See [Module SDK](module-sdk.md) for complete API documentation.

### Module Types

| Type | Description |
|------|-------------|
| `internal` | No separate process, events only |
| `process` | Own Node.js process (sandbox) |
| `external` | External process/service |

### Example Modules

- **WLED** (`modules/wled/`) - Simple module without UI
- **Game Display** (`modules/game-display/`) - Module with custom frontend

---

## Testing

### Unit Tests

```bash
# All tests
npm test

# Watch mode
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

### Local Build

```bash
# Compile backend
npm run build

# Build frontend
npm run build:frontend

# Build modules
npm run build:modules

# All together
npm run prebuild:dist
```

### Build Desktop App (Electron)

```bash
# All platforms
npm run dist:all

# Individual platforms
npm run dist:mac      # macOS .dmg
npm run dist:win      # Windows .exe
npm run dist:linux    # Linux .deb, .AppImage, .rpm
```

Builds end up in `dist/`.

### Create Release

**Option 1: Automatic via GitHub Actions**

```bash
# Use release script
./scripts/create-release.sh 1.2.0
```

**Option 2: Manual with Git Tag**

```bash
git tag -a v1.2.0 -m "Release v1.2.0"
git push origin v1.2.0
```

GitHub Actions automatically builds all platforms and creates a release.

### CI/CD Pipeline

The `.github/workflows/release.yml` defines:

1. **Build Linux** (Ubuntu Runner) → `.deb`, `.rpm`, `.AppImage`
2. **Build Windows** (Windows Runner) → `.exe`
3. **Build macOS** (macOS Runner) → `.dmg`, `.zip`
4. **Create Release** → Upload all artifacts

---

## Architecture

### Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Electron                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                     Main Process                        │ │
│  │  - Starts backend as child process                     │ │
│  │  - Shows window with web UI                            │ │
│  │  - System tray integration                              │ │
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
│  │  - API Authentication                                   │ │
│  │  - WebSocket Connection                                 │ │
│  │  - Event Parsing & Forwarding                           │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        Autodarts.io                          │
└─────────────────────────────────────────────────────────────┘
```

### Event Flow

```
Autodarts → WebSocket → Backend → Module Manager → Module
                            │
                            └──→ WebSocket → Frontend
```

### Module Sandbox

Modules run in isolated processes:

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

- **Strict Mode** enabled
- **ESLint** + **Prettier** for formatting
- No `any` types (if avoidable)

### Vue

- **Composition API** (not Options API)
- **`<script setup>`** syntax
- **TypeScript** for all components

### Commits

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new WLED effect
fix: resolve connection timeout issue
docs: update installation guide
chore: upgrade dependencies
```

---

## Useful Commands

```bash
# Lint
npm run lint

# Type check
npm run type-check

# Clean build
rm -rf dist && npm run build

# Update dependencies
npm update

# Check for outdated packages
npm outdated
```

---

## Help & Support

- **Issues**: GitHub Issues for bugs and features
- **Discussions**: GitHub Discussions for questions
- **Code Reviews**: PRs are reviewed before merging
