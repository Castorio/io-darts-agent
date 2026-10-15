# IO-Darts-Agent: Features

## Übersicht

IO-Darts-Agent ist ein lokaler Hub zwischen der Autodarts-Plattform und verschiedenen Aktions-Modulen. Er empfängt die Echtzeit-Ereignisse deines Boards und leitet sie an die konfigurierten Module weiter (Licht, Anzeige, Sprachansagen).

> IO-Darts-Agent ist ein inoffizielles Projekt und steht in keiner Verbindung zu Autodarts. Der Hub ist für den Betrieb im lokalen Netzwerk gebaut und darf nicht aus dem Internet erreichbar sein. Lizenz: PolyForm Noncommercial 1.0.0, kostenlos für private, nicht kommerzielle Nutzung.

## Core Features

### 1. Autodarts Integration

#### Authentifizierung
- Anmeldung mit E-Mail und Passwort an der offiziellen Autodarts-API (Auth-Dienst v1, `api.autodarts.com/auth/v1`)
- Automatische Erneuerung des Zugriffstokens vor Ablauf, bei abgelehntem Refresh Neu-Anmeldung mit dem gespeicherten Passwort
- Keine Unterstützung für Zwei-Faktor-Authentifizierung (2FA)
- Zugangsdaten werden nur lokal auf dem Hub-Rechner gespeichert (`dist/config/hub.config.json`, Klartext)
- Eingabe im Setup-Wizard oder später unter **Einstellungen > Autodarts**

#### WebSocket-Verbindung
- Persistente WebSocket-Verbindung zum Autodarts-Server
- Kurzlebiges Ticket pro Verbindungsaufbau, bei jedem Reconnect neu angefordert
- Automatische Wiederverbindung bei Verbindungsabbruch

#### Event-Verarbeitung

**Native Events** (von Autodarts):

| Event | Beschreibung | Daten |
|-------|-------------|-------|
| `match.start` | Neues Match gestartet | Match-ID, Board-ID |
| `match.state` | Match-Zustandsupdate | Spieler, Scores, Einstellungen |
| `match.finish` | Match geschlossen (Benutzer hat "Beenden" geklickt) | Match-ID |
| `match.delete` | Match abgebrochen | Match-ID |
| `throw.detected` | Wurf erkannt | Segment, Punkte, Multiplikator |
| `takeout.started` | Dart-Entnahme gestartet | - |
| `takeout.finished` | Dart-Entnahme beendet | - |

**Synthetische Events** (vom EventParser erzeugt):

| Event | Beschreibung | Auslöser |
|-------|-------------|----------|
| `player.change` | Spielerwechsel | Spieler-Index ändert sich in match.state |
| `turn.finished` | Aufnahme beendet | 3 Darts geworfen, Bust oder Rundenwechsel |
| `game.finished` | Leg gewonnen (Gewinner, Leg, Set) | Gewinner in match.state erkannt |
| `match.finished` | Match beendet (Gewinner ermittelt) | Match-Gewinner in match.state erkannt |
| `match.result` | Match-Ergebnis mit vollständigen Daten (Chalkboard, Statistiken, Scores) | Wird direkt nach `match.finished` gesendet |

> **Hinweis zur Array-Rotation:** Autodarts rotiert das Spieler-Array nach jedem Leg. Die synthetischen Events enthalten daher sowohl `playerName`/`winnerName` als auch `playerIndex`/`winnerPlayerIndex` für eine robuste Spieler-Erkennung. Details im Developer Guide.

### 2. Modulares Plugin-System

#### Modul-Architektur
- Eingebaute Module: WLED, Game Display, Darts Caller
- Jedes Modul beschreibt Events, Konfiguration und Übersetzungen in einer `module.json`
- Eigene Web-UIs pro Modul möglich (z.B. das Game Display unter `/module-ui/game-display/`)
- Weitere Module lassen sich aus Git-Repositories oder einem lokalen Pfad installieren und laufen als eigene Node-Prozesse

#### Modul-Lebenszyklus
```
Installation > Konfiguration > Start > Running > Stop > Deinstallation
```

#### Event-Handling und Intents
- Module registrieren sich für bestimmte Events
- Fehler in einem Modul beeinflussen andere nicht
- Intent-System für Modul-zu-Modul-Kommunikation, konfigurierbar unter **Intent-Reaktionen**

### 3. Web-Interface

#### Setup-Wizard
- Schritt 1: Optionaler Login für das Web-Interface
- Schritt 2: Autodarts-Zugangsdaten und Board-ID mit Verbindungstest
- Schritt 3: Zusammenfassung und Abschluss

#### Dashboard
- Aktive Module, Laufzeit, Events heute
- Autodarts-Verbindungsstatus mit Trennen und Verbinden, aktives Match
- Modulliste und Live-Event-Feed

#### Modul-Verwaltung
- Installierte und verfügbare eingebaute Module
- Starten, Stoppen, Neustarten, Autostart
- Modul-Konfiguration, Intent-Reaktionen, Statistiken
- Neue Module installieren (Git oder lokal), Deinstallation

#### Spielerverwaltung
- Spielerprofile mit Name, Farbe, Avatar und optionaler Autodarts Benutzer-ID

#### Mediathek
- Animationen, Sounds und Bilder mit Ordnern, Suche, Upload (bis 50 MB) und URL kopieren

#### AI Provider
- API-Schlüssel, Standard-Modelle und Verbindungstest für alle KI-Anbieter

#### Konsole
- Echtzeit-Log mit Event-, Modul- und System-Einträgen
- Filter, Suche, Pausieren, Auto-Scroll, Export, Löschen

#### Einstellungen
- Sprache, Server (Host, Port), Web-Authentifizierung, Autodarts-Zugang, Entwickler-Modus
- Der Server-Host wird gespeichert, aber derzeit ignoriert: Der Hub bindet immer an `0.0.0.0`

#### Entwickler-Tools
- Simulation von Matches, Würfen und Aufnahmen ohne echtes Board (nach Aktivieren des Entwickler-Modus)

#### Mehrsprachigkeit
- Oberfläche in 10 Sprachen: Deutsch, Englisch, Spanisch, Französisch, Italienisch, Japanisch, Niederländisch, Russisch, Ukrainisch, Chinesisch
- Deutsch und Englisch vollständig, die übrigen teilweise übersetzt

### 4. Spielerverwaltung

#### Spielerprofile
- Name, Farbe (Palette oder Hex-Code), Avatar
- Zuordnung zu Autodarts-Spielern über den Namen (Groß- und Kleinschreibung egal)

#### Farbsystem
- Profilfarben werden an WLED und Game Display weitergegeben
- WLED nutzt für Spieler ohne Profil Positionsfarben (bis zu 6 Spieler)

### 5. Konfigurationssystem

```
config/
├── hub.config.json         Autodarts-Zugang, Board, Server, Web-Login
├── ai-providers.json       KI-Anbieter, API-Schlüssel, Modelle
├── animation-settings.json Gewählte Engine des Animations-Generators
├── players.json            Spielerprofile
└── modules/*.json          Modul-Einstellungen
media/                      Mediathek (animation, sound, image)
data/voicepacks/            Voice Packs des Darts Callers
data/tts-cache/             Cache für ElevenLabs-Ansagen
```

Beim Betrieb aus dem Quellcode liegen diese Ordner unter `dist/`. Zugangsdaten und API-Schlüssel werden im Klartext gespeichert.

## Integrierte Module

### WLED Modul

Steuert WLED-kompatible LED-Controller abhängig von Spiel-Events.

**Features:**
- Aktionstypen pro Event: Preset, Effekt, Farbe, Aus, Keine
- Presets und Effekte werden direkt vom Controller geladen, mit eingebauter Effektliste als Fallback
- Effekte mit bis zu 3 Farben, Geschwindigkeit, Intensität und Helligkeit
- Option "Spielerfarbe verwenden" pro Aktion
- Dauer pro Aktion, danach wird wieder die Farbe des aktiven Spielers gesetzt (nicht der vorherige WLED-Zustand)
- Übergangszeit (Fade) pro Aktion in Millisekunden, dazu eine globale Übergangszeit in den Verbindungseinstellungen
- Einzelspieler-Unterstützung: Spielerfarbe nach Match-Start und nach jedem Takeout
- Spielerfarben für bis zu 6 Positionen als Fallback
- Test-Button pro Aktion und Schnellaktionen (Rainbow Test, LEDs aus, Grün, Rot)
- Reaktion auf Intents anderer Module

**Unterstützte Events:**

| Gruppe | Events |
|--------|--------|
| Match Events | Match gestartet, Match beendet, Match verlassen, Match abgebrochen |
| Wurf Events | Wurf erkannt, Triple getroffen, Double getroffen, Single Bull, Bullseye!, 180!, Fehlwurf |
| Spieler Events | Spielerwechsel, Aufnahme gestartet, Aufnahme beendet |
| Board Events | Pfeile ziehen, Pfeile gezogen |

Ein Event "High Finish" gibt es nicht: Der Hub liefert keinen Checkout-Wert, deshalb kann das Modul ihn nicht erkennen.

### Game Display Modul

Zeigt den aktuellen Spielstand im Vollbild auf einem separaten Gerät. Display-URL: `http://192.168.1.100:3000/module-ui/game-display/` (IP des Hub-Rechners).

**Features:**
- Große Punkteanzeige mit Spielerfarbe als Hintergrund
- Checkout-Vorschläge (Schwelle einstellbar, Standard 170)
- Wurf-Anzeige (Dart 1, 2, 3) und Aufnahme-Summe
- Leiste mit anderen Spielern
- Optionales Spielinfo-Overlay (Position, Größe, Versatz einstellbar)
- Idle-Modus: Letzten Spielstand anzeigen, Schwarzer Bildschirm, Eigenes Bild
- Match-Start-Bildschirm: Standard (Game On!) oder eigenes Bild/GIF, Dauer und Hintergrundfarbe einstellbar
- Ergebnistabelle nach Match-Ende mit Chalkboard und Statistiken, Anzeigedauer und Hintergrundfarbe einstellbar
- Vorschau, "Display öffnen" und "URL kopieren" in der Konfiguration
- Automatisches Abrufen der vollständigen Match-Daten beim Match-Start

**Animationen pro Event:**
- 180, Bull, Double Bull, High Score (Schwelle einstellbar), Checkout, Leg-Sieg, Match-Sieg, Überworfen
- Typ: Deaktiviert, Built-in, GIF oder Video, jeweils mit optionalem Sound und eigener Dauer
- Leg- und Match-Sieg zusätzlich mit Gewinnername, Statistiken, Effekt (Konfetti, Feuerwerk, Funken) und Farben
- Medien per Upload, aus der Mediathek oder als externe URL
- Animations-Generator direkt im Tab Animationen

**Spieler-spezifische Animationen:**
- Eigene Animationen pro Spieler im Tab **Spieler** für: 180, Leg Gewonnen, Match Gewonnen, Checkout
- Ersetzen die globale Animation, wenn dieser Spieler das Event auslöst
- Ohne Spieler-Eintrag gilt die globale Animation

### Darts Caller Modul

Darts-Caller mit Browser-TTS, Voice Packs, ElevenLabs oder eigenen Audiodateien.

**Features:**
- Score-Ansagen nach jeder Aufnahme
- Checkout-Ansagen ("You require ...")
- Spezial-Ansagen: 180, Bust, No Score, Game On, Game Shot, Match Shot
- Spielerwechsel-Ansagen mit Spielernamen
- Sprachen: Deutsch, Englisch
- Caller-Typen: Browser TTS (Wiedergabe im Browser), KI Voice Pack, ElevenLabs Live KI, Eigene Audiodateien (Wiedergabe über die Lautsprecher des Hub-Rechners)
- Ansage-Einstellungen: Scores, nur hohe Scores, Checkouts mit Obergrenze für "You require ...", Spielerwechsel, Spielstart, Spielende, 180, Busts, Bulls, Double Bulls
- Lautstärke und Verzögerung einstellbar, bei Browser TTS auch Stimme, Tonhöhe und Geschwindigkeit
- Eine gemeinsame Konfiguration für Caller-Seite und allgemeines Modulformular; Änderungen gelten ohne Modul-Neustart, ältere gespeicherte Einstellungen werden automatisch übernommen

**ElevenLabs:**
- Nutzt den ElevenLabs-Schlüssel aus den AI Provider-Einstellungen
- Auswahl aus den Stimmen deines ElevenLabs-Kontos
- Voice Pack Generator: Scores 0 bis 180, alle möglichen Checkouts 2 bis 170 und Spezial-Ansagen, mit Fortschritt und Abbruch
- Mehrere Voice Packs (verschiedene Stimmen und Sprachen), Upload als ZIP, Auswahl und Löschen
- Automatische Erzeugung fehlender Spielernamen beim Match-Start (bei aktivem Voice Pack)
- TTS-Cache für Live-Ansagen, wiederholte Sätze werden nicht erneut angefragt

## KI-Features

### AI Provider

Die Anbieter werden unter **AI Provider** in der Seitenleiste eingerichtet. Alle sind optional.

| Anbieter | Typ | Verwendung |
|----------|-----|-----------|
| **OpenAI** | Text, Bild, Sprache, Embeddings | Für Module verfügbar |
| **Anthropic** | Text | Für Module verfügbar |
| **Ollama (Lokal)** | Lokale Textmodelle | Für Module verfügbar, ohne API-Schlüssel |
| **ElevenLabs** | Sprachsynthese | Darts Caller |
| **Stability AI** | Bild | Für Module verfügbar |
| **Runway ML** | Video | Animations-Generator |
| **Higgsfield** | Video, Bild | Animations-Generator |
| **Replicate** | Text, Bild, Video | Für Module verfügbar |

**Funktionen:**
- API-Schlüssel, Standard-Modell, Speichern, Verbindung testen, Ein/Aus pro Anbieter
- Speicherung auf dem Hub in `dist/config/ai-providers.json`
- OpenAI und Anthropic: Modellliste wird live mit dem jeweiligen Schlüssel beim Anbieter geladen. Nicht mehr angebotene Modelle werden gemeldet und ersetzt.
- Higgsfield: Schlüssel im Format `KEY_ID:KEY_SECRET`, fester Katalog mit 20 Text-zu-Video- und 10 Text-zu-Bild-Modellen, getrennte Auswahl für Video- und Bildmodell (Standard: Kling 3.0 Standard und Soul Standard)
- Higgsfield-Anfragen werden pro Modell angepasst: erlaubte Dauer, unterstütztes Seitenverhältnis, Ton aus
- Runway: fester Katalog mit 23 Text-zu-Video-Modellen aus der Runway-API (Standard: Gen-4.5), auch ohne Schlüssel sichtbar. Abgeschaltete Modelle wie Gen-3 werden gemeldet und durch Gen-4.5 ersetzt.
- Runway-Anfragen werden pro Modell angepasst: erlaubtes Seitenverhältnis passend zur Ausrichtung, erlaubte Dauer, Ton aus, Prompt auf die Höchstlänge gekürzt. Generierungen werden genau einmal gesendet (keine automatische Wiederholung, die doppelt kosten könnte), Statusabfragen werden wiederholt.
- Kostenpflichtige Anfragen aller Cloud-Anbieter (Text, Bild, Sprache, Video, Embeddings) werden genau einmal gesendet. Nach einem Serverfehler oder Timeout kann der Anbieter sie bereits berechnet haben, deshalb wiederholt der Hub sie nicht. Abfragen wie Modelllisten und Status werden wiederholt.

> Generierungen kosten beim jeweiligen Anbieter Guthaben bzw. Credits.

### Animations-Generator

Erzeugt per KI Animationen für das Game Display. Zu finden in der Game Display Konfiguration im Tab **Animationen**.

- **Engine**: Runway oder Higgsfield, umschaltbar, Auswahl wird in `dist/config/animation-settings.json` gespeichert
- **Modell**: das Standard-Modell des Anbieters aus den AI-Einstellungen. Runway erzeugt per Text-zu-Video, ohne Platzhalterbild.
- **Stile**: Fire, Ice, Neon, Gold, Cartoon, Minimal, Electric, Confetti, Smoke, Stars oder ein eigener Stil mit Name und Beschreibung
- **Events**: 180, Bull, Double Bull, High Score (160+), Checkout, Leg Gewinn, Match Gewinn, Bust
- **Batch-Generierung**: Ein Job pro gewähltem Event
- **Jobs**: Status, Fortschritt, Abbrechen, Vorschau, "Verwenden" (trägt die Animation beim Event ein), "Abgeschlossene löschen"
- **Ergebnis**: Umwandlung per `ffmpeg` in ein transparentes WebM (schwarzer Hintergrund wird entfernt). Ohne `ffmpeg` bleibt das Original als MP4.
- **Speicherort**: Mediathek, Bereich Animationen, Ordner `ai-generated/<Stil>`

---

## Technische Details

### Sicherheit
- Für ein vertrauenswürdiges lokales Netzwerk gebaut, nicht ins Internet stellen, keine Portweiterleitung
- Zugangsdaten und API-Schlüssel liegen im Klartext auf dem Hub-Rechner
- Verbindungen nur zu Autodarts, zu deinen Geräten im Netzwerk und zu eingerichteten KI-Anbietern
- Optionaler Login für das Web-Interface

### Kompatibilität
- Node.js 22 oder neuer (Betrieb aus dem Quellcode)
- Aktuelle Browser (Chrome, Firefox, Safari, Edge)
- WLED-Controller mit JSON-API
- `ffmpeg` optional für transparente Animationen

### API
- REST- und WebSocket-API, siehe [API-Dokumentation](api.md)
