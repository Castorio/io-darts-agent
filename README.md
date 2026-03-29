# IO-Darts-Agent

A modular agent for [Autodarts](https://autodarts.io) that processes real-time events and can trigger various actions through extensible modules.

**[Deutsche Version / German Version](README.de.md)**

## Features

- **Autodarts Integration** - Connects to the Autodarts WebSocket and receives all game events in real-time
- **Modular System** - Extensible plugin system for various actions (WLED control, Game Display, etc.)
- **Web Interface** - Modern Vue.js-based configuration interface
- **Player Management** - Custom player profiles with individual colors for light effects
- **Real-time Logs** - Live view of all events and module activities
- **Desktop App** - Native application for Windows, macOS and Linux

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

**Detailed Guide:** [Installation](docs/en/installation.md)

### First Start

1. Launch the app (found in Start Menu / Launchpad)
2. The web interface opens automatically
3. Follow the setup wizard:
   - Enter your Autodarts credentials
   - Select your board
   - Done!

---

## Modules

### Built-in Modules

| Module | Description |
|--------|-------------|
| **WLED** | Controls WLED-compatible LED strips on Triples, 180s, etc. |
| **Game Display** | Shows game score on external displays/tablets |

### Installing Modules from Git

1. Open **Modules** → **Install Module**
2. Enter the Git URL
3. Click **Install**

---

## Documentation

### For Users

- [**Installation**](docs/en/installation.md) - Step-by-step guide
- [**User Guide**](docs/en/user-guide.md) - Complete guide with screenshots
- [**Features**](docs/en/features.md) - All features in detail

### For Developers

- [**Developer Guide**](docs/en/developer-guide.md) - Development environment & architecture
- [**Developer Quick Start**](docs/en/developer-quickstart.md) - Create a module in 5 minutes
- [**Module SDK**](docs/en/module-sdk.md) - Complete module API
- [**API Reference**](docs/en/api.md) - REST API & WebSocket events

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

### Create Release

```bash
# Tag version & trigger GitHub Actions
./scripts/create-release.sh 1.0.0
```

GitHub Actions automatically builds all platforms and creates a release.

---

## Architecture

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

The agent processes the following Autodarts events:

| Event | Description |
|-------|-------------|
| `match.started` | Match was started |
| `match.finished` | Match was finished |
| `match.deleted` | Match was cancelled |
| `throw.detected` | Throw was detected |
| `player.changed` | Player changed |
| `turn.started` | New turn started |
| `turn.finished` | Turn finished |
| `game.finished` | Leg/Set won |

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
