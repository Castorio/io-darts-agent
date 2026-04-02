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
9. [Event System](#event-system)

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
git clone https://github.com/Castorio/io-darts-agent.git
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
│   ├── wled/               # WLED Lighting Controller
│   ├── game-display/       # Game Display Module
│   └── darts-caller/       # Darts Caller Module
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
| `src/core/EventParser.ts` | Generates synthetic events from match.state |
| `src/core/MatchStateTracker.ts` | Tracks match state for event generation |
| `src/modules/manager.ts` | Loads and manages modules |
| `src/modules/sandbox.ts` | Sandbox for module execution |
| `src/core/modules/handlers/` | Module event handlers (WLED, etc.) |

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/status` | GET | Connection status |
| `/api/setup/*` | Various | Setup wizard endpoints |
| `/api/match/current` | GET | Current match state |
| `/api/match/current/players` | GET | Current players with colors |
| `/api/match/current/scores` | GET | Current scores |
| `/api/modules` | GET | List all modules |
| `/api/modules/:id` | GET/POST | Single module |
| `/api/modules/:id/config` | GET/PUT | Module configuration |
| `/api/modules/:id/translations/:lang` | GET | Module translations |
| `/api/players` | GET/POST | Player management |
| `/api/voicepack/*` | Various | Voice Pack Generator |
| `/api/events` | WebSocket | Live event stream |

See [API Documentation](api.md) for complete details.

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

### Built-in Modules

| Module | Description | Features |
|--------|-------------|----------|
| **WLED** (`modules/wled/`) | LED lighting control | Player colors, effects, fade time, duration-based actions |
| **Game Display** (`modules/game-display/`) | Score display | Vue.js frontend, checkout suggestions, animations |
| **Darts Caller** (`modules/darts-caller/`) | Voice announcements | Browser TTS, audio packs, Voice Pack Generator |

### Example Modules

- **WLED** (`modules/wled/`) - Module controlling external hardware (HTTP API)
- **Game Display** (`modules/game-display/`) - Module with custom Vue.js frontend
- **Darts Caller** (`modules/darts-caller/`) - Module with Voice Pack Generator and multiple output modes

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
Autodarts → WebSocket → Backend → EventParser → Module Manager → Modules
                            │          │
                            │          └──→ Generates synthetic events
                            │                (player.change, turn.finished)
                            │
                            └──→ WebSocket → Frontend (Hub UI, Module UIs)
```

### Native vs Synthetic Events

The EventParser generates **synthetic events** from `match.state` updates:

| Event Type | Source | Description |
|------------|--------|-------------|
| `match.start` | Native | From Autodarts |
| `match.state` | Native | From Autodarts |
| `throw.detected` | Native | From Autodarts |
| `player.change` | Synthetic | Generated when player index changes |
| `turn.finished` | Synthetic | Generated when turn ends (3 darts, bust, round change) |

This allows modules to react to logical events without parsing raw state.

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

## AI Provider System

IO-Darts-Agent includes a flexible AI provider system that modules can use for various AI-powered features.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Provider Manager                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  ElevenLabs  │  │   Runway ML  │  │   Other Providers │  │
│  │  (TTS)       │  │  (Video)     │  │   (LLM, Images)   │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        Modules                                │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐   │
│  │DartsCaller  │ │Game Display │ │  Custom Modules     │   │
│  │(TTS)        │ │(Animations) │ │  (Any AI Features)  │   │
│  └─────────────┘ └─────────────┘ └─────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Provider Configuration

Providers are configured in `config/ai-providers.json`:

```json
[
  {
    "id": "elevenlabs",
    "type": "elevenlabs",
    "name": "ElevenLabs",
    "apiKey": "your-api-key",
    "enabled": true,
    "options": {
      "defaultModel": "eleven_multilingual_v2"
    }
  },
  {
    "id": "runway",
    "type": "runway",
    "name": "Runway ML",
    "apiKey": "your-api-key",
    "enabled": true
  }
]
```

### Supported Providers

| Provider | Type | Capabilities | Use Cases |
|----------|------|--------------|-----------|
| **ElevenLabs** | `elevenlabs` | `audio-tts` | Voice packs, player names |
| **Runway ML** | `runway` | `video-generation` | Animations, celebrations |
| **OpenAI** | `openai` | `text`, `image-generation` | Chat, image generation |
| **Anthropic** | `anthropic` | `text` | Chat, analysis |
| **Stability AI** | `stability` | `image-generation` | Image generation |
| **Ollama** | `ollama` | `text` | Local LLM inference |
| **Replicate** | `replicate` | Various | Custom models |

### Using AI Providers in Code

```typescript
import { getAIProvider, getEnabledProviders } from '../core/ai/index.js';

// Get a specific provider
const elevenlabs = getAIProvider('elevenlabs');
if (elevenlabs?.isAvailable()) {
  // Generate speech
  const response = await elevenlabs.generateSpeech({
    text: 'One hundred and eighty!',
    voice: 'voice-id-or-name',
  });
}

// Get all enabled providers with a capability
const ttsProviders = getEnabledProviders('audio-tts');
```

### ElevenLabs Provider

```typescript
import { ElevenLabsProvider } from '../core/ai/providers/ElevenLabsProvider.js';

// Get voices
const voices = await elevenlabs.getVoices();

// Generate speech
const result = await elevenlabs.generateSpeech({
  text: 'Player one, you require 40!',
  voice: 'Rachel',  // Name or ID
  model: 'eleven_multilingual_v2',
  stability: 0.5,
  similarityBoost: 0.75,
});

// Save to file
await elevenlabs.generateSpeechToFile(
  { text: '180!', voice: 'voice-id' },
  '/path/to/output.mp3'
);
```

### Runway ML Provider

```typescript
import { RunwayProvider } from '../core/ai/providers/RunwayProvider.js';

// Text-to-video
const result = await runway.generateVideo({
  prompt: 'Fireworks celebration, darts theme',
  duration: 5,
  aspectRatio: '16:9',
});

// Image-to-video
const result = await runway.generateVideo({
  imageUrl: 'https://example.com/player-photo.jpg',
  prompt: 'Celebrating, arms raised',
  duration: 5,
});

// Wait for completion (async job)
const job = await runway.waitForCompletion(result.jobId);
console.log('Video URL:', job.resultUrl);
```

### Creating a Custom Provider

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

---

## Help & Support

- **Issues**: GitHub Issues for bugs and features
- **Discussions**: GitHub Discussions for questions
- **Code Reviews**: PRs are reviewed before merging

---

## Event System

### EventParser

The `EventParser` class analyzes `match.state` updates and generates synthetic events:

```typescript
// EventParser detects:
// 1. Player changes (player index changed)
// 2. Turn completion (3 darts thrown, bust, or round change)
// 3. Special throws (180, etc.)
```

### MatchStateTracker

Tracks match state between events for accurate event generation:

- Stores previous match state
- Detects changes between states
- Provides player color information

### Module Handlers

Each module has a handler class in `src/core/modules/handlers/`:

| Handler | Module | Key Features |
|---------|--------|--------------|
| `WledHandler.ts` | WLED | HTTP API calls, player colors, fade time, duration restore |
| `DartsCallerHandler.ts` | Darts Caller | TTS, audio playback, Voice Pack Generator |

### Creating a New Handler

```typescript
// src/core/modules/handlers/MyHandler.ts
export class MyHandler {
  private config: MyModuleConfig;
  private currentMatchState: MatchState | null = null;

  constructor(config: MyModuleConfig) {
    this.config = config;
  }

  async handleEvent(event: AutodartsEvent): Promise<void> {
    switch (event.type) {
      case 'match.state':
        this.currentMatchState = event.data;
        break;
      case 'player.change':
        await this.handlePlayerChange(event);
        break;
      case 'throw.detected':
        await this.handleThrow(event);
        break;
    }
  }

  private async handlePlayerChange(event: AutodartsEvent): Promise<void> {
    // React to player change
  }

  private async handleThrow(event: AutodartsEvent): Promise<void> {
    // React to throw
  }
}
```

### Player Color Resolution

Modules can resolve player colors using the player management system:

```typescript
// Get player color from event data
const color = event.data.color || '#ffffff';

// Or resolve from match state
async resolvePlayerColor(playerIndex: number): Promise<string> {
  const player = this.currentMatchState?.players[playerIndex];
  if (player) {
    const profile = await this.playerManager.findByName(player.name);
    return profile?.color || '#ffffff';
  }
  return '#ffffff';
}
```
