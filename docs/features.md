# IO-Darts-Agent - Features

## Übersicht

IO-Darts-Agent ist eine Middleware-Lösung, die zwischen der Autodarts-Plattform und verschiedenen Aktions-Modulen vermittelt. Der Hub empfängt Echtzeit-Events von Autodarts und leitet diese an konfigurierte Module weiter.

## Core Features

### 1. Autodarts Integration

#### Authentifizierung
- OAuth2-basierte Anmeldung bei Autodarts
- Automatische Token-Verwaltung und -Erneuerung
- Sichere Speicherung der Zugangsdaten

#### WebSocket-Verbindung
- Persistente WebSocket-Verbindung zum Autodarts-Server
- Automatische Reconnection bei Verbindungsabbruch
- Heartbeat-Monitoring für Verbindungsstabilität

#### Event-Verarbeitung
Folgende Events werden verarbeitet:

| Event | Beschreibung | Daten |
|-------|-------------|-------|
| `match.started` | Neues Match gestartet | Match-ID, Spieler, Modus |
| `match.finished` | Match beendet | Gewinner, finale Scores |
| `match.deleted` | Match abgebrochen | Match-ID |
| `throw.detected` | Wurf erkannt | Segment, Punkte, Multiplikator |
| `player.changed` | Spielerwechsel | Neuer Spieler, Spielerfarbe |
| `turn.started` | Aufnahme gestartet | Spieler-Index |
| `turn.finished` | Aufnahme beendet | Wurf-Summe, Remaining |
| `game.finished` | Leg/Set gewonnen | Gewinner |
| `takeout.started` | Dart-Entnahme gestartet | - |
| `takeout.finished` | Dart-Entnahme beendet | - |

### 2. Modulares Plugin-System

#### Modul-Architektur
- Jedes Modul ist ein eigenständiges Package
- Module definieren ihre Konfiguration über `module.json`
- Unterstützung für eigene Web-UIs pro Modul
- Module können aus Git-Repositories installiert werden

#### Modul-Lebenszyklus
```
Installation → Konfiguration → Start → Running → Stop → Deinstallation
```

#### Event-Handling
- Module registrieren sich für bestimmte Events
- Parallele Event-Verarbeitung für mehrere Module
- Fehler in einem Modul beeinflussen andere nicht

### 3. Web-Interface

#### Setup-Wizard
- Geführte Ersteinrichtung
- Autodarts-Verbindungstest
- Board-Auswahl

#### Dashboard
- Verbindungsstatus
- Aktive Module
- Live-Event-Feed

#### Modul-Verwaltung
- Installierte Module anzeigen
- Module starten/stoppen
- Modul-Konfiguration bearbeiten
- Neue Module installieren (lokal oder Git)

#### Spielerverwaltung
- Spielerprofile anlegen
- Individuelle Farben pro Spieler
- Aliase für Spielernamen-Matching

#### Live-Logs
- Echtzeit-Event-Log
- Filterung nach Event-Typ
- Modul-spezifische Logs

### 4. Spielerverwaltung

#### Spielerprofile
- Name und Aliase
- Individuelle Farbe (für WLED, Display, etc.)
- Automatisches Matching bei Autodarts-Spielen

#### Farbsystem
- RGB-Farbauswahl
- Farben werden an Module weitergegeben
- Fallback-Farben für unbekannte Spieler

### 5. Konfigurationssystem

#### Hierarchische Konfiguration
```
Hub-Config (hub.config.json)
├── Autodarts Credentials
├── Server-Einstellungen
└── Setup-Status

Modul-Configs (config/modules/*.json)
├── wled.json
├── game-display.json
└── ...
```

#### Live-Reload
- Konfigurations-Änderungen werden sofort wirksam
- Kein Server-Neustart nötig

## Integrierte Module

### WLED Modul

Steuert WLED-kompatible LED-Controller basierend auf Spiel-Events.

**Features:**
- Verschiedene Aktionstypen (Preset, Effekt, Solid, Brightness, Off)
- Event-basierte Konfiguration
- Spielerfarben-Integration
- Temporäre Effekte mit automatischem Restore
- Multi-Color-Effekte (3 Farben)

**Unterstützte Events:**
- Match Start/Ende
- Würfe (Triple, Double, Bullseye, Miss, 180)
- Spielerwechsel
- Bust

### Game Display Modul

Zeigt den aktuellen Spielstand auf einem separaten Display an.

**Features:**
- Große, gut lesbare Punkteanzeige
- Checkout-Vorschläge
- Animierte Spielerfarben als Hintergrund
- Wurf-Anzeige (Dart 1, 2, 3)
- Andere Spieler-Leiste
- Responsive Design für verschiedene Bildschirmgrößen
- Demo-Modus zum Testen

## Technische Details

### Performance
- Minimale Latenz bei Event-Verarbeitung (<10ms)
- Effiziente WebSocket-Kommunikation
- Lazy-Loading für Module-UIs

### Sicherheit
- Credentials werden nur lokal gespeichert
- Keine externe Datenübertragung außer zu Autodarts
- Lokaler Zugriff auf Web-Interface empfohlen

### Kompatibilität
- Node.js 18+
- Moderne Browser (Chrome, Firefox, Safari, Edge)
- WLED Version 0.13+
