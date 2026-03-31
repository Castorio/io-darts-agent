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
    "total": 3,
    "running": 3
  }
}
```

---

### Match

#### GET /api/match/current
Returns current match state.

**Response:**
```json
{
  "matchId": "match-uuid",
  "isActive": true,
  "players": [
    {
      "index": 0,
      "name": "Max",
      "color": "#3b82f6"
    }
  ],
  "gameScores": [301],
  "settings": {
    "baseScore": 501,
    "legs": 3,
    "sets": 1
  },
  "player": 0,
  "round": 5
}
```

#### GET /api/match/current/players
Returns current players with enriched data.

**Response:**
```json
{
  "players": [
    {
      "index": 0,
      "name": "Max",
      "color": "#3b82f6",
      "score": 301,
      "legsWon": 1,
      "setsWon": 0
    }
  ]
}
```

#### GET /api/match/current/scores
Returns current scores.

**Response:**
```json
{
  "scores": [301, 245]
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
    "version": "1.2.0",
    "description": "Controls WLED LED strips",
    "status": "running",
    "events": ["throw.detected", "player.change", "match.start"]
  },
  {
    "id": "game-display",
    "name": "Game Display",
    "version": "1.0.0",
    "description": "Shows game score on external displays",
    "status": "running",
    "hasUI": true
  },
  {
    "id": "darts-caller",
    "name": "Darts Caller",
    "version": "1.0.0",
    "description": "Professional darts caller",
    "status": "running"
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
  "version": "1.2.0",
  "description": "Controls WLED LED strips based on game events",
  "author": "IO-Darts-Agent Team",
  "status": "running",
  "events": ["throw.detected", "player.change", "match.start", "takeout.finished"],
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
      },
      "fadeTime": {
        "type": "number",
        "label": "Fade Time (ms)",
        "default": 0,
        "min": 0,
        "max": 10000
      }
    },
    "values": {
      "wledHost": "192.168.1.100",
      "wledPort": 80,
      "fadeTime": 500
    }
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
  "fadeTime": 500,
  "events": {
    "player.change": {
      "actionType": "solid",
      "usePlayerColor": true
    },
    "throw.triple": {
      "actionType": "effect",
      "effectId": 12,
      "brightness": 255,
      "duration": 500
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
  "wledPort": 80,
  "fadeTime": 1000
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

#### GET /api/modules/:id/translations/:language
Returns translated module manifest for the specified language.

**Parameters:**
- `language`: Language code (`en`, `de`, `es`)

**Response:**
```json
{
  "success": true,
  "manifest": {
    "id": "wled",
    "name": "WLED Beleuchtungssteuerung",
    "version": "1.2.0",
    "description": "Steuert WLED-basierte LED-Streifen...",
    "config": {
      "wledHost": {
        "type": "string",
        "label": "WLED IP-Adresse",
        "description": "IP-Adresse oder Hostname des WLED-Geräts"
      },
      "fadeTime": {
        "label": "Übergangszeit (ms)",
        "description": "Globale Übergangszeit für Farbwechsel"
      }
    }
  },
  "strings": {
    "connectionSuccess": "Erfolgreich mit WLED verbunden!",
    "connectionFailed": "Verbindung zu WLED fehlgeschlagen"
  },
  "availableLanguages": ["en", "de", "es"]
}
```

---

### Voice Pack Generator

#### GET /api/voicepack/voices
Returns available ElevenLabs voices.

**Request Headers:**
- `X-ElevenLabs-API-Key`: Your ElevenLabs API key

**Response:**
```json
{
  "voices": [
    {
      "voice_id": "voice-uuid",
      "name": "Adam",
      "labels": {
        "accent": "american",
        "gender": "male"
      }
    }
  ]
}
```

#### POST /api/voicepack/generate
Generates a voice pack using ElevenLabs TTS.

**Request:**
```json
{
  "apiKey": "your-elevenlabs-api-key",
  "voiceId": "voice-uuid",
  "packName": "my-voice-pack",
  "stability": 0.5,
  "clarity": 0.75
}
```

**Response:**
```json
{
  "success": true,
  "packPath": "media/caller/my-voice-pack",
  "filesGenerated": 352
}
```

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
Finds a player by name or alias.

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

#### caller
Darts Caller event (for browser TTS/audio playback).

```json
{
  "type": "caller",
  "data": {
    "callType": "score",
    "text": "One hundred and eighty!",
    "audioFile": "media/caller/default/180.mp3",
    "priority": 10
  }
}
```

---

## Autodarts Events

### Native Events (from Autodarts)

#### match.start
```json
{
  "type": "match.start",
  "data": {
    "matchId": "match-uuid",
    "boardId": "board-uuid"
  }
}
```

#### match.state
```json
{
  "type": "match.state",
  "data": {
    "matchId": "match-uuid",
    "players": [
      { "name": "Max", "index": 0 },
      { "name": "Anna", "index": 1 }
    ],
    "gameScores": [301, 245],
    "player": 0,
    "round": 5,
    "turnBusted": false,
    "settings": {
      "baseScore": 501,
      "legs": 3,
      "sets": 1
    }
  }
}
```

#### throw.detected
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
    "playerIndex": 0,
    "playerName": "Max"
  }
}
```

#### takeout.started
```json
{
  "type": "takeout.started",
  "data": {
    "matchId": "match-uuid"
  }
}
```

#### takeout.finished
```json
{
  "type": "takeout.finished",
  "data": {
    "matchId": "match-uuid"
  }
}
```

#### game.finished
```json
{
  "type": "game.finished",
  "data": {
    "winner": "Max",
    "checkoutPath": ["T20", "T20", "D20"]
  }
}
```

#### match.finished
```json
{
  "type": "match.finished",
  "data": {
    "matchId": "match-uuid",
    "winner": 0,
    "winnerName": "Max"
  }
}
```

#### match.result
Sent when a match finishes with full result data (chalkboards, stats, scores).

```json
{
  "type": "match.result",
  "data": {
    "matchId": "match-uuid",
    "winner": 0,
    "winnerName": "Max",
    "variant": "X01",
    "type": "Local",
    "leg": 1,
    "set": 1,
    "round": 15,
    "players": [
      { "index": 0, "name": "Max", "userId": null },
      { "index": 1, "name": "Anna", "userId": null }
    ],
    "scores": [
      { "legs": 1, "sets": 0 },
      { "legs": 0, "sets": 0 }
    ],
    "chalkboards": [...],
    "stats": [
      {
        "legStats": { "average": 45.5, "dartsThrown": 12 },
        "matchStats": { "average": 45.5, "dartsThrown": 12 }
      }
    ],
    "settings": { "baseScore": 501, "legs": 3 }
  }
}
```

#### match.finish
Sent when user clicks "Finish" button to dismiss match results.

```json
{
  "type": "match.finish",
  "data": {
    "matchId": "match-uuid"
  }
}
```

#### match.delete
```json
{
  "type": "match.delete",
  "data": {
    "matchId": "match-uuid"
  }
}
```

### Synthetic Events (generated by EventParser)

These events are generated by the IO-Darts-Agent from `match.state` updates:

#### player.change
Triggered when the active player changes.

```json
{
  "type": "player.change",
  "data": {
    "playerIndex": 1,
    "playerName": "Anna",
    "remaining": 245,
    "players": [
      { "name": "Max", "index": 0, "color": "#3b82f6" },
      { "name": "Anna", "index": 1, "color": "#ef4444" }
    ]
  }
}
```

#### turn.finished
Triggered when a turn ends (3 darts thrown, bust, or round change).

```json
{
  "type": "turn.finished",
  "data": {
    "playerIndex": 0,
    "playerName": "Max",
    "turnScore": 100,
    "busted": false,
    "remaining": 301
  }
}
```

**Note:** If `busted` is `true`, the `turnScore` will be `0`.

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
