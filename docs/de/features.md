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

**Native Events** (von Autodarts):

| Event | Beschreibung | Daten |
|-------|-------------|-------|
| `match.start` | Neues Match gestartet | Match-ID, Board-ID |
| `match.state` | Match-Zustandsupdate | Spieler, Scores, Einstellungen |
| `match.finished` | Match beendet (Gewinner ermittelt) | Gewinner, finale Scores |
| `match.result` | Match-Ergebnis mit vollständigen Daten | Chalkboard, Statistiken, Scores |
| `match.finish` | Match geschlossen (Benutzer hat "Beenden" geklickt) | Match-ID |
| `match.delete` | Match abgebrochen | Match-ID |
| `throw.detected` | Wurf erkannt | Segment, Punkte, Multiplikator |
| `game.finished` | Leg/Set gewonnen | Gewinner |
| `takeout.started` | Dart-Entnahme gestartet | - |
| `takeout.finished` | Dart-Entnahme beendet | - |

**Synthetische Events** (generiert von EventParser):

| Event | Beschreibung | Auslöser |
|-------|-------------|----------|
| `player.change` | Spielerwechsel | Spieler-Index ändert sich in match.state |
| `turn.finished` | Aufnahme beendet | 3 Darts geworfen, Bust oder Rundenwechsel |

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
- Temporäre Effekte mit automatischer Wiederherstellung der Spielerfarbe
- Multi-Color-Effekte (bis zu 3 Farben)
- Fade-Zeit (Übergangszeit) für sanfte Farbwechsel
- Einzelspieler-Modus-Unterstützung
- Intent-System für Modul-zu-Modul-Kommunikation

**Unterstützte Events:**
- Match Start/Ende/Ergebnis/Beenden
- Würfe (Triple, Double, Bullseye, Miss, 180)
- Spielerwechsel
- Bust
- Takeout beendet

**Wichtige Features:**
- **Dauer mit Spielerfarben-Wiederherstellung**: Nach einem temporären Effekt wird die Spielerfarbe wiederhergestellt (nicht der vorherige WLED-Zustand)
- **Fade-Zeit**: Globale und pro-Aktion Übergangszeit in Millisekunden
- **Einzelspieler-Unterstützung**: Spielerfarbe wird nach Match-Start und Takeout in Einzelspieler-Spielen angewendet
- **Intent-Aktionen**: Reagiert auf Intents von anderen Modulen (z.B. Caller-Ansagen lösen Lichteffekte aus)

### Game Display Modul

Zeigt den aktuellen Spielstand auf einem separaten Display an.

**Features:**
- Große, gut lesbare Punkteanzeige
- Checkout-Vorschläge (2-170 Punkte)
- Animierte Spielerfarben als Hintergrund
- Wurf-Anzeige (Dart 1, 2, 3)
- Andere Spieler-Leiste
- Responsive Design für verschiedene Bildschirmgrößen
- Demo-Modus zum Testen
- Konfigurierbare Animationen pro Event
- Idle-Modus-Optionen (Wartebildschirm, letztes Spiel, schwarzer Bildschirm, eigenes Bild)
- Mehrsprachig
- Konfigurierbare Hintergrundfarben

**Match-Start-Handling:**
- Automatisches Abrufen vollständiger Match-Daten via API beim Match-Start
- Verhindert Anzeige von Standardwerten (501, "Player") bei Spielbeginn
- Match-Start-Bildschirm mit konfigurierbaren Anzeigemodi (Standard-Animation, eigenes Bild/GIF)

**Match-Ergebnisse:**
- Match-Ergebnistabelle mit Chalkboard und Statistiken
- Konfigurierbare Anzeigedauer (automatisch ausblenden nach Timeout oder manuell schließen)
- Konfigurierbare Hintergrundfarbe für Ergebnisbildschirm

### Darts Caller Modul

Professioneller Darts-Caller mit TTS oder eigenen Audio-Packs.

**Features:**
- Score-Ansagen nach jeder Aufnahme
- Checkout-Ansagen ("You require...")
- Spezial-Ansagen: 180, Bust, Game Shot, Match Shot
- Spielerwechsel-Ansagen mit Spielernamen
- **Dynamische Spielernamen-Generierung**: Neue Spieler werden automatisch beim Spielstart erkannt und deren Namen via ElevenLabs TTS generiert
- Browser-TTS oder eigene Audio-Packs
- Voice Pack Generator mit ElevenLabs TTS
- Multi-Voice-Pack-Unterstützung (verschiedene Stimmen/Sprachen)
- Lokale Audio-Wiedergabe (Server-seitig)

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
