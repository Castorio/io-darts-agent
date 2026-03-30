# Darts Caller Module

Professioneller Darts-Caller für IO-Darts-Agent. Sagt Scores, Checkouts und Spielereignisse mittels Text-to-Speech oder voraufgenommenen Audio-Dateien an.

## Features

- **Score-Ansagen** - Sagt geworfene Punktzahlen nach jeder Aufnahme an
- **Checkout-Ansagen** - "You require..." mit verbleibender Punktzahl
- **Spezial-Ansagen** - 180er, Bust, Game Shot, Match Shot
- **Spielerwechsel** - Sagt Spielernamen bei Wechsel an
- **Flexible Ausgabe** - Browser-TTS oder eigene Audio-Dateien
- **Voice Pack Generator** - Erstelle eigene Voice Packs mit ElevenLabs TTS
- **Lokale Wiedergabe** - Audio kann Server-seitig abgespielt werden
- **Konfigurierbar** - Einzelne Ansagetypen aktivieren/deaktivieren

## Konfiguration

### Allgemeine Einstellungen

| Option | Typ | Standard | Beschreibung |
|--------|-----|----------|-------------|
| `enabled` | boolean | `true` | Modul aktivieren/deaktivieren |
| `callerType` | string | `"tts"` | Ausgabe-Typ: `"tts"`, `"audio"` oder `"local"` |
| `volume` | number | `80` | Lautstärke (0-100) |
| `delayMs` | number | `200` | Verzögerung vor Ansage in ms |

### TTS-Einstellungen (Text-to-Speech)

| Option | Typ | Standard | Beschreibung |
|--------|-----|----------|-------------|
| `ttsVoice` | string | `""` | TTS-Stimme (Browser-abhängig) |
| `ttsRate` | number | `1.0` | Sprechgeschwindigkeit (0.5-2.0) |
| `ttsPitch` | number | `1.0` | Tonhöhe (0.5-2.0) |

### Audio-Pack-Einstellungen

| Option | Typ | Standard | Beschreibung |
|--------|-----|----------|-------------|
| `audioPackPath` | string | `""` | Pfad zum Audio-Pack-Ordner |

### Ansage-Optionen

| Option | Typ | Standard | Beschreibung |
|--------|-----|----------|-------------|
| `callScores` | boolean | `true` | Scores ansagen |
| `callHighScoresOnly` | boolean | `false` | Nur Scores ≥100 ansagen |
| `callCheckouts` | boolean | `true` | Checkout-Möglichkeiten ansagen |
| `callPlayerChange` | boolean | `true` | Spielerwechsel ansagen |
| `callGameStart` | boolean | `true` | Spielstart ansagen |
| `callGameOver` | boolean | `true` | Spielende ansagen |
| `call180` | boolean | `true` | Spezielle 180-Ansage |
| `callBusts` | boolean | `true` | Bust ansagen |

## Ausgabe-Modi

### Browser TTS (`callerType: "tts"`)

Verwendet die eingebaute Text-to-Speech des Browsers. Keine zusätzliche Software nötig.

- Funktioniert in allen modernen Browsern
- Stimmen abhängig vom Betriebssystem
- Konfigurierbare Geschwindigkeit und Tonhöhe

### Audio-Pack (`callerType: "audio"`)

Verwendet voraufgenommene Audio-Dateien für professionellen Klang.

- Professionelle Caller-Stimmen möglich
- Voice Pack Generator für eigene Stimmen
- Höhere Qualität als TTS

### Lokale Wiedergabe (`callerType: "local"`)

Spielt Audio direkt auf dem Server ab (z.B. über angeschlossene Lautsprecher).

- Ideal für dedizierte Darts-Setups
- Keine Browser-Wiedergabe nötig
- Funktioniert auch ohne offenes Display

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
| `game_on.mp3` | Spielstart |
| `game_shot.mp3` | Leg gewonnen |
| `match_shot.mp3` | Match gewonnen |
| `bust.mp3` | Überworfen |
| `180.mp3` | 180 Punkte |
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

## Events

| Event | Aktion |
|-------|--------|
| `match.start` | Sagt "Game on!" an |
| `match.finished` | Sagt "Game shot and the match!" mit Gewinner an |
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

### Lokale Wiedergabe funktioniert nicht

1. Prüfe, ob ein Audio-Ausgabegerät am Server angeschlossen ist
2. Prüfe die System-Lautstärke des Servers
3. Der LocalAudioPlayer benötigt ggf. zusätzliche Pakete (je nach OS)

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
├── handleEvent()         # Verarbeitet Autodarts-Events
├── generateCall()        # Generiert Ansage-Aufruf
├── handleTurnFinished()  # Score-Ansage
├── handlePlayerChange()  # Spielerwechsel + Checkout
└── handleSpecialEvents() # 180, Bust, Game Shot, etc.

Ausgabe-Backends:
├── Browser TTS           # Web Speech API
├── Audio Pack            # Voraufgenommene MP3s
└── LocalAudioPlayer      # Server-seitige Wiedergabe
```

## Lizenz

MIT
