# Darts Caller Module

Professioneller Darts-Caller für IO-Darts-Agent. Sagt Scores, Checkouts und Spielereignisse mittels Text-to-Speech oder voraufgenommenen Audio-Dateien an.

## Features

- **Score-Ansagen**: Sagt geworfene Punktzahlen nach jeder Aufnahme an
- **Checkout-Ansagen**: "You require..." mit verbleibender Punktzahl
- **Spezial-Ansagen**: 180er, Bust, Game Shot, Match Shot
- **Spielerwechsel**: Sagt Spielernamen bei Wechsel an
- **Flexible Ausgabe**: Browser-TTS oder eigene Audio-Dateien
- **Voice Pack Generator**: Erstelle eigene Voice Packs mit ElevenLabs TTS
- **Lokale Wiedergabe**: Audio kann Server-seitig abgespielt werden
- **Konfigurierbar**: Einzelne Ansagetypen aktivieren/deaktivieren
- **Dynamische Spielernamen**: Neue Spieler werden automatisch erkannt und deren Namen via ElevenLabs TTS generiert
- **Multi-Voice-Pack**: Unterstützung für verschiedene Stimmen/Sprachen

## Konfiguration

Die folgenden Feldnamen entsprechen `modules/darts-caller/module.json` (nicht frei erfunden, das ist wichtig, falls du die Konfiguration direkt über `PUT /api/modules/darts-caller/config` setzt).

### Allgemeine Einstellungen

| Option | Typ | Standard | Beschreibung |
|--------|-----|----------|-------------|
| `enabled` | boolean | `true` | Modul aktivieren/deaktivieren |
| `callerType` | select | `"tts"` | Ausgabe-Typ: `"tts"`, `"voicepack"`, `"elevenlabs"` oder `"audio"` |
| `language` | select | `"en"` | Sprache der Ansage: `"en"` oder `"de"` |
| `volume` | number | `80` | Lautstärke (0-100) |
| `delayMs` | number | `200` | Verzögerung vor Ansage in ms (0-2000) |

### Browser-TTS-Einstellungen (Gruppe `ttsSettings`, sichtbar wenn `callerType = "tts"`)

| Option | Typ | Standard | Beschreibung |
|--------|-----|----------|-------------|
| `ttsSettings.voice` | string | `""` | Stimmen-Identifier (Browser-abhängig) |
| `ttsSettings.rate` | number | `1.0` | Sprechgeschwindigkeit (0.5-2.0) |
| `ttsSettings.pitch` | number | `1.0` | Tonhöhe (0.5-2.0) |

### Voice-Pack-Einstellungen (Gruppe `voicepackSettings`, sichtbar wenn `callerType = "voicepack"`)

| Option | Typ | Standard | Beschreibung |
|--------|-----|----------|-------------|
| `voicepackSettings.packId` | string | `""` | ID des zu verwendenden generierten Voice Packs |

### ElevenLabs-Einstellungen (Gruppe `elevenlabsSettings`, sichtbar wenn `callerType = "elevenlabs"`)

| Option | Typ | Standard | Beschreibung |
|--------|-----|----------|-------------|
| `elevenlabsSettings.voiceId` | string | `""` | Stimmen-ID von ElevenLabs |
| `elevenlabsSettings.stability` | number | `0.5` | Stabilität der Stimme (0.0-1.0) |
| `elevenlabsSettings.similarity` | number | `0.75` | Similarity Boost (0.0-1.0) |

### Audio-Pack-Einstellungen (Gruppe `audioSettings`, sichtbar wenn `callerType = "audio"`)

| Option | Typ | Standard | Beschreibung |
|--------|-----|----------|-------------|
| `audioSettings.packPath` | string | `""` | Pfad zum Audio-Pack-Ordner relativ zum Medienverzeichnis |

### Ansage-Optionen (Gruppe `callSettings`)

| Option | Typ | Standard | Beschreibung |
|--------|-----|----------|-------------|
| `callSettings.scores` | boolean | `true` | Geworfene Scores ansagen |
| `callSettings.highScoresOnly` | boolean | `false` | Nur Scores ≥100 ansagen |
| `callSettings.checkouts` | boolean | `true` | Checkout-Möglichkeiten ansagen |
| `callSettings.playerChange` | boolean | `true` | Spielerwechsel ansagen |
| `callSettings.gameStart` | boolean | `true` | Spiel- und Match-Start ansagen |
| `callSettings.gameOver` | boolean | `true` | Spiel- und Match-Ende ansagen |
| `callSettings.special180` | boolean | `true` | Spezielle 180-Ansage |
| `callSettings.busts` | boolean | `true` | Bust ansagen |
| `callSettings.bulls` | boolean | `true` | Single Bull (25) ansagen |
| `callSettings.doubleBulls` | boolean | `true` | Double Bull / Bullseye (50) ansagen |

## Ausgabe-Modi

Es gibt vier wählbare `callerType`-Werte. Es gibt **keinen** separaten `"local"`-Modus. Die serverseitige Wiedergabe (`LocalAudioPlayer`) ist der Mechanismus, über den `"voicepack"`, `"elevenlabs"` und `"audio"` ihr Audio abspielen, keine eigene Konfigurationsoption.

### Browser TTS (`callerType: "tts"`)

Verwendet die eingebaute Text-to-Speech des Browsers. Keine zusätzliche Software nötig; die Ansage wird als WebSocket-Nachricht (`caller`-Event) an die offenen Browser-Tabs geschickt, nicht server-seitig abgespielt.

- Funktioniert in allen modernen Browsern
- Stimmen abhängig vom Betriebssystem
- Konfigurierbare Geschwindigkeit und Tonhöhe

### Voice Pack (`callerType: "voicepack"`)

Spielt vorgenerierte MP3-Dateien aus einem mit dem Voice Pack Generator erstellten Pack **server-seitig** ab (über `LocalAudioPlayer`).

- Professioneller Klang, einmal mit ElevenLabs generiert
- Benötigt `voicepackSettings.packId`

### ElevenLabs Live (`callerType: "elevenlabs"`)

Generiert die Sprache bei jeder Ansage live über die ElevenLabs-API und spielt sie server-seitig ab.

- Höchste Flexibilität (jeder Text, nicht nur vorgenerierte Scores)
- Benötigt einen konfigurierten ElevenLabs-API-Key und laufende Internetverbindung
- Verbraucht laufend ElevenLabs-Zeichenkontingent

### Eigene Audiodateien (`callerType: "audio"`)

Verwendet voraufgenommene Audio-Dateien aus `audioSettings.packPath`, server-seitig abgespielt.

- Eigene, einmal erstellte Aufnahmen
- Keine laufenden API-Kosten
- Funktioniert auch ohne offenes Display, da server-seitig abgespielt

## Audio Packs

Audio Packs sollten im `media/caller/`-Verzeichnis mit folgender Struktur platziert werden:

```
media/
└── caller/
    └── default/
        ├── game_on.mp3
        ├── game_shot.mp3
        ├── match_shot.mp3
        ├── bust.mp3
        ├── 180.mp3
        ├── no_score.mp3
        ├── score_1.mp3
        ├── score_2.mp3
        ├── ...
        ├── score_180.mp3
        ├── require_2.mp3
        ├── require_3.mp3
        ├── ...
        └── require_170.mp3
```

### Dateinamenskonvention

| Datei | Verwendung |
|-------|-----------|
| `game_on.mp3` | Spiel gestartet |
| `match_on.mp3` | Match gestartet |
| `game_shot.mp3` | Leg gewonnen |
| `match_shot.mp3` | Match gewonnen |
| `bust.mp3` | Überworfen |
| `180.mp3` | 180 Punkte |
| `171.mp3` | 171 Punkte |
| `no_score.mp3` | 0 Punkte |
| `score_X.mp3` | Score X (1-180) |
| `require_X.mp3` | "You require X" (2-170) |
| `player_NAME.mp3` | Spielername (optional) |

## Voice Pack Generator

Der IO-Darts-Agent enthält einen integrierten Voice Pack Generator, der mit ElevenLabs TTS arbeitet:

### Verwendung

1. Gehe zu **Module** → **Darts Caller** → **Konfigurieren**
2. Scrolle zu **Voice Pack Generator**
3. Gib deinen ElevenLabs API-Key ein
4. Wähle eine Stimme aus
5. Konfiguriere die Einstellungen:
   - Pack-Name
   - Stimme
   - Stabilität
   - Klarheit
6. Klicke auf **Voice Pack generieren**

### ElevenLabs API

- Kostenloser Account mit begrenzten Zeichen verfügbar
- Professionelle Stimmen in verschiedenen Sprachen
- API-Key unter [elevenlabs.io](https://elevenlabs.io) erhältlich

### Generierte Dateien

Der Generator erstellt automatisch alle benötigten Dateien:
- Score-Ansagen (0-180)
- Checkout-Ansagen (2-170)
- Spezial-Ansagen (Game on, Game shot, etc.)

### Dynamische Spielernamen-Generierung

Wenn neue Spieler erkannt werden und ElevenLabs konfiguriert ist:

1. Bei `match.start` werden alle Spielernamen geprüft
2. Fehlende Audio-Dateien werden automatisch via ElevenLabs generiert
3. Die generierten Dateien werden im aktiven Voice Pack gespeichert
4. Bei zukünftigen Spielen sind die Namen sofort verfügbar

## Intent-Aktionen

Das Darts Caller Modul bietet diese Aktionen für das Intent-System an (siehe [Module SDK](../../docs/de/module-sdk.md#intent-system)), sodass andere Module gezielt eine Ansage auslösen können:

| Aktion | Beschreibung | Konfiguration |
|--------|-------------|----------------|
| `playPhrase` | Spielt eine vordefinierte Phrase aus dem Voice Pack | `phrase`: `oneEighty`, `oneSeventyOne`, `gameShot`, `matchShot`, `bust`, `noScore`, `gameOn` oder `matchOn` |
| `sayText` | Spricht einen eigenen Text per TTS, mit Platzhaltern | `text` mit Variablen wie `{{playerName}}`, `{{score}}`, `{{checkout}}`, `{{remaining}}`, `{{dartsThrown}}`, `{{average}}`, `{{legsWon}}`, `{{setsWon}}`, `{{turnScore}}` |
| `playScore` | Sagt einen Score aus dem Intent-Payload an | `field`: Name des Payload-Felds (Standard `score`) |
| `playFile` | Spielt eine bestimmte Audiodatei ab | `file`: Dateipfad |

## Events

| Event | Aktion |
|-------|--------|
| `match.start` | Sagt "Game on!" an, generiert ggf. fehlende Spielernamen |
| `match.finished` | Sagt "Game shot and the match!" mit Gewinner an |
| `match.result` | (Intern verarbeitet für Statistiken) |
| `match.finish` | (Intern verarbeitet) |
| `game.finished` | Sagt "Game shot!" mit Gewinner an |
| `turn.finished` | Sagt Score und Checkout an |
| `player.change` | Sagt Spielername an, danach "You require X" |

### Event-Timing

Das Modul verwendet synthetische Events vom EventParser:

1. **Nach 3 Darts oder Bust**: `turn.finished` wird ausgelöst → Score ansagen
2. **Bei Spielerwechsel**: `player.change` wird ausgelöst → Spielername, dann Checkout ansagen

## Troubleshooting

### Keine Ansagen hörbar

1. Prüfe, ob das Modul aktiviert ist (grüner Status)
2. Prüfe die Lautstärke-Einstellung
3. Bei TTS: Prüfe Browser-Berechtigungen für Audio
4. Bei Audio-Pack: Prüfe, ob die Dateien existieren

### TTS-Stimme klingt anders als erwartet

1. Verschiedene Browser haben verschiedene Stimmen
2. Die verfügbaren Stimmen hängen vom Betriebssystem ab
3. Wähle eine andere Stimme in den Einstellungen

### Audio-Pack-Dateien werden nicht abgespielt

1. Prüfe den Pfad zum Audio-Pack
2. Stelle sicher, dass die Dateien im MP3-Format sind
3. Prüfe die Dateinamen (z.B. `score_60.mp3`, nicht `60.mp3`)
4. Prüfe die Browser-Konsole auf Fehler

### Voice Pack Generator funktioniert nicht

1. Prüfe den ElevenLabs API-Key
2. Prüfe dein Zeichenkontingent bei ElevenLabs
3. Stelle sicher, dass eine Internetverbindung besteht
4. Prüfe die Server-Logs auf Fehler

### Server-seitige Wiedergabe (`voicepack`, `elevenlabs`, `audio`) funktioniert nicht

1. Prüfe, ob ein Audio-Ausgabegerät am Server (dem Rechner, auf dem der Hub läuft) angeschlossen ist
2. Prüfe die System-Lautstärke des Servers
3. Der `LocalAudioPlayer` benötigt ggf. zusätzliche Pakete (je nach Betriebssystem)

## Entwicklung

```bash
# Dependencies installieren
npm install

# Build
npm run build

# Tests ausführen
npm test

# Development-Modus
npm run dev
```

## Architektur

```
DartsCallerHandler
├── handleEvent()         # Verarbeitet Autodarts-Events (match.start, game.finished, ...)
├── handleTurnFinished()  # Score- und Checkout-Ansage
├── handlePlayerChange()  # Spielerwechsel-Ansage
├── generateCall()        # Baut den Ansage-Request und dispatcht an das Backend
└── executeIntentAction() # playPhrase / sayText / playScore / playFile

Ausgabe-Backends (ausgewählt über callerType):
├── tts         # Browser Web Speech API (über das caller-WebSocket-Event)
├── voicepack   # Vorgenerierte MP3s, server-seitig über LocalAudioPlayer
├── elevenlabs  # Live-TTS über die ElevenLabs-API, server-seitig über LocalAudioPlayer
└── audio       # Eigene MP3-Dateien, server-seitig über LocalAudioPlayer
```
