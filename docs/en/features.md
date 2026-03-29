# IO-Darts-Agent - Features

## Overview

IO-Darts-Agent is a middleware solution that mediates between the Autodarts platform and various action modules. The hub receives real-time events from Autodarts and forwards them to configured modules.

## Core Features

### 1. Autodarts Integration

#### Authentication
- OAuth2-based login with Autodarts
- Automatic token management and renewal
- Secure storage of credentials

#### WebSocket Connection
- Persistent WebSocket connection to Autodarts server
- Automatic reconnection on connection loss
- Heartbeat monitoring for connection stability

#### Event Processing
The following events are processed:

| Event | Description | Data |
|-------|-------------|------|
| `match.started` | New match started | Match ID, players, mode |
| `match.finished` | Match finished | Winner, final scores |
| `match.deleted` | Match cancelled | Match ID |
| `throw.detected` | Throw detected | Segment, points, multiplier |
| `player.changed` | Player change | New player, player color |
| `turn.started` | Turn started | Player index |
| `turn.finished` | Turn finished | Throw sum, remaining |
| `game.finished` | Leg/Set won | Winner |
| `takeout.started` | Dart removal started | - |
| `takeout.finished` | Dart removal finished | - |

### 2. Modular Plugin System

#### Module Architecture
- Each module is a standalone package
- Modules define their configuration via `module.json`
- Support for custom web UIs per module
- Modules can be installed from Git repositories

#### Module Lifecycle
```
Installation → Configuration → Start → Running → Stop → Uninstallation
```

#### Event Handling
- Modules register for specific events
- Parallel event processing for multiple modules
- Errors in one module don't affect others

### 3. Web Interface

#### Setup Wizard
- Guided initial setup
- Autodarts connection test
- Board selection

#### Dashboard
- Connection status
- Active modules
- Live event feed

#### Module Management
- View installed modules
- Start/stop modules
- Edit module configuration
- Install new modules (local or Git)

#### Player Management
- Create player profiles
- Individual colors per player
- Aliases for player name matching

#### Live Logs
- Real-time event log
- Filtering by event type
- Module-specific logs

### 4. Player Management

#### Player Profiles
- Name and aliases
- Individual color (for WLED, display, etc.)
- Automatic matching during Autodarts games

#### Color System
- RGB color selection
- Colors are passed to modules
- Fallback colors for unknown players

### 5. Configuration System

#### Hierarchical Configuration
```
Hub Config (hub.config.json)
├── Autodarts Credentials
├── Server Settings
└── Setup Status

Module Configs (config/modules/*.json)
├── wled.json
├── game-display.json
└── ...
```

#### Live Reload
- Configuration changes take effect immediately
- No server restart needed

## Built-in Modules

### WLED Module

Controls WLED-compatible LED controllers based on game events.

**Features:**
- Various action types (Preset, Effect, Solid, Brightness, Off)
- Event-based configuration
- Player color integration
- Temporary effects with automatic restore
- Multi-color effects (3 colors)

**Supported Events:**
- Match start/end
- Throws (Triple, Double, Bullseye, Miss, 180)
- Player change
- Bust

### Game Display Module

Shows the current game score on a separate display.

**Features:**
- Large, readable score display
- Checkout suggestions
- Animated player colors as background
- Throw display (Dart 1, 2, 3)
- Other players bar
- Responsive design for various screen sizes
- Demo mode for testing

## Technical Details

### Performance
- Minimal latency in event processing (<10ms)
- Efficient WebSocket communication
- Lazy-loading for module UIs

### Security
- Credentials are stored locally only
- No external data transfer except to Autodarts
- Local access to web interface recommended

### Compatibility
- Node.js 18+
- Modern browsers (Chrome, Firefox, Safari, Edge)
- WLED Version 0.13+
