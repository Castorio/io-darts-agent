# IO-Darts-Agent - API Documentation

## Overview

IO-Darts-Agent provides a REST API for configuration and a WebSocket API for real-time events.

**Base URL:** `http://localhost:3000/api`

## REST API

### Setup

#### GET /api/setup/status
Checks if initial setup is complete.

**Response:**
```json
{
  "needsSetup": false,
  "hasConfig": true
}
```

#### POST /api/setup/test-connection
Tests the Autodarts connection.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "secret",
  "boardId": "optional-board-id"
}
```

**Response:**
```json
{
  "success": true,
  "userId": "user-uuid",
  "boardName": "My Dartboard"
}
```

#### POST /api/setup/complete
Completes initial setup and saves configuration.

**Request:**
```json
{
  "autodarts": {
    "email": "user@example.com",
    "password": "secret",
    "boardId": "board-uuid"
  },
  "server": {
    "port": 3000
  }
}
```

---

### Status

#### GET /api/status
Returns current hub status.

**Response:**
```json
{
  "version": "1.0.0",
  "uptime": 3600,
  "autodarts": {
    "connected": true,
    "boardId": "board-uuid"
  },
  "modules": {
    "total": 2,
    "running": 2
  }
}
```

---

### Modules

#### GET /api/modules
Lists all installed modules.

**Response:**
```json
[
  {
    "id": "wled",
    "name": "WLED Lighting Controller",
    "version": "1.1.0",
    "description": "Controls WLED LED strips",
    "status": "running",
    "events": ["throw.detected", "player.change", "match.started"]
  }
]
```

#### GET /api/modules/:id
Returns details for a module.

**Response:**
```json
{
  "id": "wled",
  "name": "WLED Lighting Controller",
  "version": "1.1.0",
  "description": "Controls WLED LED strips",
  "author": "IO-Darts-Agent Team",
  "status": "running",
  "events": ["throw.detected", "player.change"],
  "config": {
    "schema": {
      "wledHost": {
        "type": "string",
        "label": "WLED IP Address",
        "required": true
      },
      "wledPort": {
        "type": "number",
        "label": "WLED Port",
        "default": 80
      }
    },
    "values": {
      "wledHost": "192.168.1.100",
      "wledPort": 80
    }
  },
  "stats": {
    "restartCount": 0
  }
}
```

#### GET /api/modules/:id/config
Returns module configuration.

**Response:**
```json
{
  "wledHost": "192.168.1.100",
  "wledPort": 80,
  "eventActions": {
    "throw.triple": {
      "actionType": "effect",
      "effectId": 12,
      "brightness": 255
    }
  }
}
```

#### PUT /api/modules/:id/config
Updates module configuration.

**Request:**
```json
{
  "wledHost": "192.168.1.101",
  "wledPort": 80
}
```

#### POST /api/modules/:id/start
Starts a module.

#### POST /api/modules/:id/stop
Stops a module.

#### POST /api/modules/:id/restart
Restarts a module.

#### POST /api/modules/install
Installs a new module.

**Request (Git):**
```json
{
  "source": "git",
  "url": "https://github.com/user/autodarts-module.git",
  "branch": "main"
}
```

**Request (Local):**
```json
{
  "source": "local",
  "path": "/path/to/module"
}
```

**Response:**
```json
{
  "moduleId": "my-module",
  "success": true
}
```

#### DELETE /api/modules/:id
Uninstalls a module.

---

### Players

#### GET /api/players
Lists all player profiles.

**Response:**
```json
[
  {
    "id": "player-uuid",
    "name": "Max",
    "aliases": ["MaxDarts", "Max123"],
    "color": "#3b82f6",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
]
```

#### POST /api/players
Creates a new player.

**Request:**
```json
{
  "name": "Max",
  "aliases": ["MaxDarts"],
  "color": "#3b82f6"
}
```

#### GET /api/players/:id
Returns a player profile.

#### PUT /api/players/:id
Updates a player profile.

#### DELETE /api/players/:id
Deletes a player profile.

#### POST /api/players/match
Finds a player by name.

**Request:**
```json
{
  "name": "MaxDarts"
}
```

**Response:**
```json
{
  "found": true,
  "player": {
    "id": "player-uuid",
    "name": "Max",
    "color": "#3b82f6"
  }
}
```

---

### Settings

#### GET /api/settings
Returns hub settings.

#### PUT /api/settings
Updates hub settings.

---

## WebSocket API

### Connection

**URL:** `ws://localhost:3000/api/events`

### Message Format

All messages are JSON encoded:

```json
{
  "type": "message-type",
  "data": { ... },
  "timestamp": 1704067200000
}
```

### Client → Server Messages

#### ping
Heartbeat message.

```json
{
  "type": "ping"
}
```

**Response:**
```json
{
  "type": "pong"
}
```

### Server → Client Messages

#### status
Sent on connection.

```json
{
  "type": "status",
  "data": {
    "connected": true,
    "matchId": "current-match-uuid"
  }
}
```

#### event
Autodarts event received.

```json
{
  "type": "event",
  "data": {
    "type": "throw.detected",
    "data": {
      "segment": {
        "number": 20,
        "multiplier": 3,
        "bed": "T20"
      },
      "points": 60,
      "turnPoints": 60,
      "remaining": 441,
      "playerIndex": 0
    },
    "matchId": "match-uuid"
  }
}
```

#### log
Log entry for live view.

```json
{
  "type": "log",
  "data": {
    "id": "log-uuid",
    "timestamp": 1704067200000,
    "type": "event",
    "source": "autodarts",
    "message": "Received: throw.detected",
    "data": { ... }
  }
}
```

#### module_status
Module status changed.

```json
{
  "type": "module_status",
  "data": {
    "moduleId": "wled",
    "status": "running"
  }
}
```

---

## Autodarts Events

### throw.detected

```json
{
  "type": "throw.detected",
  "data": {
    "segment": {
      "number": 20,
      "multiplier": 3,
      "bed": "T20"
    },
    "points": 60,
    "turnPoints": 120,
    "remaining": 381,
    "busted": false,
    "playerIndex": 0,
    "playerName": "Max"
  }
}
```

### player.changed

```json
{
  "type": "player.changed",
  "data": {
    "playerIndex": 1,
    "playerName": "Anna",
    "color": "#ef4444"
  }
}
```

### match.started

```json
{
  "type": "match.started",
  "data": {
    "matchId": "match-uuid",
    "players": [
      { "name": "Max", "color": "#3b82f6" },
      { "name": "Anna", "color": "#ef4444" }
    ],
    "mode": "X01",
    "startScore": 501
  }
}
```

### match.finished

```json
{
  "type": "match.finished",
  "data": {
    "matchId": "match-uuid",
    "winner": "Max",
    "finalScores": [0, 123]
  }
}
```

### turn.finished

```json
{
  "type": "turn.finished",
  "data": {
    "playerIndex": 0,
    "turnScore": 100,
    "darts": [
      { "segment": { "number": 20, "multiplier": 3 }, "points": 60 },
      { "segment": { "number": 20, "multiplier": 1 }, "points": 20 },
      { "segment": { "number": 20, "multiplier": 1 }, "points": 20 }
    ],
    "remaining": 301
  }
}
```

### game.finished

```json
{
  "type": "game.finished",
  "data": {
    "winner": "Max",
    "checkoutPath": ["T20", "T20", "D20"]
  }
}
```

---

## Error Handling

All API errors follow this format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": { ... }
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Not Authenticated |
| 404 | Not Found |
| 500 | Server Error |

---

## Module UI Routing

Modules with their own frontend are served under `/module-ui/:moduleId/`:

- Game Display: `/module-ui/game-display/`
- (Other modules follow the same pattern)
