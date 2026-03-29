# IO-Darts-Agent - API Dokumentation

## Übersicht

Der IO-Darts-Agent bietet eine REST API für die Konfiguration und eine WebSocket API für Echtzeit-Events.

**Base URL:** `http://localhost:3000/api`

## REST API

### Setup

#### GET /api/setup/status
Prüft ob die Ersteinrichtung abgeschlossen ist.

**Response:**
```json
{
  "needsSetup": false,
  "hasConfig": true
}
```

#### POST /api/setup/test-connection
Testet die Autodarts-Verbindung.

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
Schließt die Ersteinrichtung ab und speichert die Konfiguration.

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
Gibt den aktuellen Hub-Status zurück.

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

### Module

#### GET /api/modules
Listet alle installierten Module auf.

**Response:**
```json
[
  {
    "id": "wled",
    "name": "WLED Lighting Controller",
    "version": "1.1.0",
    "description": "Steuert WLED-LED-Strips",
    "status": "running",
    "events": ["throw.detected", "player.change", "match.started"]
  }
]
```

#### GET /api/modules/:id
Gibt Details zu einem Modul zurück.

**Response:**
```json
{
  "id": "wled",
  "name": "WLED Lighting Controller",
  "version": "1.1.0",
  "description": "Steuert WLED-LED-Strips",
  "author": "IO-Darts-Agent Team",
  "status": "running",
  "events": ["throw.detected", "player.change"],
  "config": {
    "schema": {
      "wledHost": {
        "type": "string",
        "label": "WLED IP-Adresse",
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
Gibt die Modul-Konfiguration zurück.

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
Aktualisiert die Modul-Konfiguration.

**Request:**
```json
{
  "wledHost": "192.168.1.101",
  "wledPort": 80
}
```

#### POST /api/modules/:id/start
Startet ein Modul.

#### POST /api/modules/:id/stop
Stoppt ein Modul.

#### POST /api/modules/:id/restart
Startet ein Modul neu.

#### POST /api/modules/install
Installiert ein neues Modul.

**Request (Git):**
```json
{
  "source": "git",
  "url": "https://github.com/user/autodarts-module.git",
  "branch": "main"
}
```

**Request (Lokal):**
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
Deinstalliert ein Modul.

#### GET /api/modules/:id/translations/:language
Gibt das übersetzte Modul-Manifest für die angegebene Sprache zurück.

**Parameter:**
- `language`: Sprachcode (`en`, `de`, `es`)

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

#### GET /api/modules/:id/languages
Gibt die verfügbaren Sprachen für ein Modul zurück.

**Response:**
```json
{
  "success": true,
  "languages": ["en", "de", "es"]
}
```

---

### Spieler

#### GET /api/players
Listet alle Spielerprofile auf.

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
Erstellt einen neuen Spieler.

**Request:**
```json
{
  "name": "Max",
  "aliases": ["MaxDarts"],
  "color": "#3b82f6"
}
```

#### GET /api/players/:id
Gibt ein Spielerprofil zurück.

#### PUT /api/players/:id
Aktualisiert ein Spielerprofil.

#### DELETE /api/players/:id
Löscht ein Spielerprofil.

#### POST /api/players/match
Findet einen Spieler anhand des Namens.

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

### Einstellungen

#### GET /api/settings
Gibt die Hub-Einstellungen zurück.

#### PUT /api/settings
Aktualisiert die Hub-Einstellungen.

---

## WebSocket API

### Verbindung

**URL:** `ws://localhost:3000/api/events`

### Nachrichtenformat

Alle Nachrichten sind JSON-kodiert:

```json
{
  "type": "message-type",
  "data": { ... },
  "timestamp": 1704067200000
}
```

### Client → Server Nachrichten

#### ping
Heartbeat-Nachricht.

```json
{
  "type": "ping"
}
```

**Antwort:**
```json
{
  "type": "pong"
}
```

### Server → Client Nachrichten

#### status
Wird bei Verbindungsaufbau gesendet.

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
Autodarts-Event wurde empfangen.

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
Log-Eintrag für die Live-Ansicht.

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
Modul-Status hat sich geändert.

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

## Fehlerbehandlung

Alle API-Fehler folgen diesem Format:

```json
{
  "error": "Fehlermeldung",
  "code": "ERROR_CODE",
  "details": { ... }
}
```

### HTTP Status Codes

| Code | Bedeutung |
|------|-----------|
| 200 | Erfolg |
| 201 | Erstellt |
| 400 | Ungültige Anfrage |
| 401 | Nicht authentifiziert |
| 404 | Nicht gefunden |
| 500 | Server-Fehler |

---

## Modul-UI Routing

Module mit eigenem Frontend werden unter `/module-ui/:moduleId/` bereitgestellt:

- Game Display: `/module-ui/game-display/`
- (Weitere Module folgen dem gleichen Muster)
