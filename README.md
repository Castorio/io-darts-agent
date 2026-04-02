# IO-Darts-Agent

A modular hub for [Autodarts](https://autodarts.io) that processes real-time events and triggers various actions through extensible modules.

**[Deutsche Version / German Version](README.de.md)**

## Features

- **Autodarts Integration** - Connects to the Autodarts WebSocket and receives all game events in real-time
- **Modular System** - Extensible plugin system for various actions (WLED control, Game Display, Darts Caller, etc.)
- **Web Interface** - Modern Vue.js-based configuration interface
- **Player Management** - Custom player profiles with individual colors for light effects
- **Voice Pack Generator** - Create custom caller voice packs using ElevenLabs TTS
- **Real-time Logs** - Live view of all events and module activities
- **Multi-language** - Interface available in English, German, and Spanish

---

## Download & Installation

### Pre-built Packages (Recommended)

Download the appropriate package for your system:

| System | Download | Description |
|--------|----------|-------------|
| **Windows** | [`IO-Darts-Agent Setup.exe`](https://github.com/user/io-darts-agent/releases/latest) | One-Click Installer |
| **macOS** | [`IO-Darts-Agent.dmg`](https://github.com/user/io-darts-agent/releases/latest) | Disk Image |
| **Ubuntu/Debian** | [`io-darts-agent.deb`](https://github.com/user/io-darts-agent/releases/latest) | Debian Package |
| **Linux** | [`IO-Darts-Agent.AppImage`](https://github.com/user/io-darts-agent/releases/latest) | Universal Linux |

> **Node.js is NOT required!** The app contains everything needed.

### First Start

1. Launch the app (found in Start Menu / Launchpad)
2. The web interface opens automatically at `http://localhost:3000`
3. Follow the setup wizard:
   - Enter your Autodarts credentials
   - Select your board
   - Done!

---

## Modules

### Built-in Modules

| Module | Description |
|--------|-------------|
| **WLED Lighting Controller** | Controls WLED-compatible LED strips based on game events. Player colors, special effects for 180s, triples, bulls, and more. Supports presets, effects, configurable fade times, and intent-based actions. |
| **Game Display** | Shows game score on external displays/tablets in real-time. Checkout suggestions, player colors, animations, match started screen, and results table with statistics. |
| **Darts Caller** | Professional darts caller with TTS or custom audio packs. Announces scores, checkouts, player changes, and special events. Includes Voice Pack Generator with ElevenLabs integration. |

### Module Features

#### WLED Lighting Controller
- Event-based actions for all game events
- Player color support with automatic matching
- Temporary effects with duration and fade time
- Support for presets, effects, solid colors
- Multi-color effects (up to 3 colors)
- Single-player mode support (takeout.finished applies player color)
- Intent system support for module-to-module communication
- Automatic player color restore after event animations

#### Game Display
- Real-time score updates
- Animated player color backgrounds
- Checkout suggestions (2-170 points)
- Dart visualization with animations
- Multi-player overview
- Demo mode for testing
- Configurable animations per event (180, Bull, High Score, Checkout, Bust, Leg/Set/Match Win)
- **Player-specific animations**: Configure individual animations per player in the "Players" tab
  - Unique animations for 180, Leg Win, Set Win, Match Win, and Checkout per player
  - Supports Built-in animations, GIF, Video, and custom sounds
  - Player animations override global animations when that player is on throw
- Match started screen (configurable: default or custom image/GIF)
- Match results table with chalkboard and statistics
- Configurable results display duration (auto-hide or manual dismiss)
- Configurable background colors

#### Darts Caller
- Score announcements after each turn
- Checkout calls ("You require...")
- Special calls: 180, bust, game shot, match shot
- Player change announcements with player names
- **Dynamic player name generation**: New players are automatically detected at game start and their names are generated via ElevenLabs TTS
- Browser TTS or custom audio packs
- Voice Pack Generator with ElevenLabs TTS
- Multi-voice-pack support (different voices/languages)
- Local audio playback (server-side)

### Installing Modules from Git

1. Open **Modules** → **Install Module**
2. Enter the Git URL
3. Click **Install**

---

## Events

The agent processes the following Autodarts events:

| Event | Description |
|-------|-------------|
| `match.start` | Match was started |
| `match.finished` | Match was finished (winner determined) |
| `match.finish` | Match dismissed (user clicked "Finish" button) |
| `match.result` | Match result with chalkboard, stats, and scores |
| `match.delete` | Match was cancelled |
| `match.state` | Match state update (scores, players, etc.) |
| `throw.detected` | Throw was detected |
| `player.change` | Player changed (synthetic event) |
| `turn.finished` | Turn finished (synthetic event) |
| `game.finished` | Leg/Set won |
| `takeout.started` | Darts removal started |
| `takeout.finished` | Darts removal finished |

---

## For Developers

### Prerequisites

- Node.js 18+
- npm 9+
- Git

### Development Environment

```bash
# Clone repository
git clone https://github.com/user/io-darts-agent.git
cd io-darts-agent

# Install dependencies
npm install
cd web && npm install && cd ..
cd modules/game-display/web && npm install && cd ../../..

# Start development server
npm run dev
```

### Build

```bash
# Build everything (Backend + Frontend + Modules)
npm run prebuild:dist

# Build desktop app
npm run dist:mac      # macOS .dmg
npm run dist:win      # Windows .exe
npm run dist:linux    # Linux .deb, .AppImage
npm run dist:all      # All platforms
```

### Project Structure

```
io-darts-agent/
├── src/                    # Backend source code
│   ├── core/               # Core services
│   │   ├── auth/           # Autodarts authentication
│   │   ├── socket/         # WebSocket & event parsing
│   │   ├── events/         # Event bus system
│   │   ├── config/         # Configuration management
│   │   └── modules/        # Module system (handlers, manager)
│   ├── api/                # Fastify REST API
│   └── types/              # TypeScript definitions
├── web/                    # Vue 3 Frontend
├── modules/                # Built-in modules
│   ├── wled/               # WLED Lighting Controller
│   ├── game-display/       # Game Display (with Vue frontend)
│   └── darts-caller/       # Darts Caller
├── media/                  # Media files (audio packs)
├── config/                 # Runtime configuration
└── docs/                   # Documentation
```

---

## Architecture

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
│  │  (Generates synthetic events: player.change, turn.finished) │
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

## API Reference

### REST Endpoints

```
# Status
GET    /api/status              # Hub status and connection info

# Authentication
POST   /api/auth/login          # Web interface login
POST   /api/auth/logout         # Logout
GET    /api/auth/session        # Current session

# Autodarts Connection
POST   /api/autodarts/connect   # Connect to Autodarts
POST   /api/autodarts/disconnect # Disconnect

# Modules
GET    /api/modules             # List all modules
GET    /api/modules/:id         # Module details + config
POST   /api/modules/:id/start   # Start module
POST   /api/modules/:id/stop    # Stop module
PUT    /api/modules/:id/config  # Update config
DELETE /api/modules/:id         # Uninstall module
POST   /api/modules/install     # Install from Git URL

# Intents
GET    /api/intents             # List all available intents (basic)
GET    /api/intents/available   # List all intents with full payload schema
GET    /api/modules/:id/intents # Get module intent actions
PUT    /api/modules/:id/intents # Update module intent subscriptions

# Match
GET    /api/match/current       # Current match state
GET    /api/match/current/players # Current players
GET    /api/match/current/scores  # Current scores

# Live Events
WS     /api/events              # WebSocket event stream
```

---

## License

MIT License - see [LICENSE](LICENSE)

---

## Contributing

Contributions are welcome!

- **Bug Reports**: Open an [Issue](https://github.com/user/io-darts-agent/issues)
- **Feature Requests**: Open an [Issue](https://github.com/user/io-darts-agent/issues)
- **Pull Requests**: Fork & create PR

---

## Support

- [GitHub Issues](https://github.com/user/io-darts-agent/issues)
- [Documentation](docs/)

---

A project by [castor.io](https://castor.io)
