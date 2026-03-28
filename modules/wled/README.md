# WLED Module

Steuert WLED-kompatible LED-Controller basierend auf Autodarts-Spielevents.

## Features

- **Event-basierte Aktionen** - Verschiedene Lichteffekte für unterschiedliche Spielsituationen
- **Spielerfarben** - Automatische Verwendung der Spielerfarben aus der Spielerverwaltung
- **Temporäre Effekte** - Blitz-Effekte mit automatischer Rückkehr zum vorherigen Zustand
- **Presets & Effekte** - Unterstützung für WLED-Presets und alle WLED-Effekte
- **Multi-Color** - Bis zu 3 Farben pro Effekt

## Voraussetzungen

- WLED-kompatible LED-Installation (z.B. ESP8266/ESP32 mit WLED-Firmware)
- WLED Version 0.13 oder höher empfohlen
- LED-Controller im selben Netzwerk wie der IO-Darts-Agent

## Installation

Das WLED-Modul ist standardmäßig im IO-Darts-Agent enthalten und muss nicht separat installiert werden.

## Konfiguration

### Grundeinstellungen

1. Öffne das Web-Interface unter `http://localhost:3000`
2. Gehe zu **Module** → **WLED Lighting Controller**
3. Klicke auf **WLED konfigurieren**

### Verbindung

| Einstellung | Beschreibung |
|-------------|-------------|
| **WLED IP-Adresse** | IP-Adresse deines WLED-Controllers (z.B. 192.168.1.100) |
| **WLED Port** | HTTP-Port von WLED (Standard: 80) |

### Event-Aktionen

Für jedes Ereignis kann eine Aktion konfiguriert werden:

#### Aktionstypen

| Typ | Beschreibung |
|-----|-------------|
| **Keine Aktion** | Event wird ignoriert |
| **Preset** | Aktiviert ein gespeichertes WLED-Preset |
| **Effekt** | Startet einen WLED-Effekt mit konfigurierten Parametern |
| **Solid** | Setzt eine einzelne Farbe |
| **Helligkeit** | Ändert nur die Helligkeit |
| **Aus** | Schaltet die LEDs aus |

#### Verfügbare Events

| Event | Wann ausgelöst |
|-------|----------------|
| **Match Start** | Spiel wird gestartet |
| **Match Ende** | Spiel ist beendet |
| **Match Abbruch** | Spiel wird abgebrochen |
| **Spielerwechsel** | Anderer Spieler ist dran |
| **Triple** | Triple-Feld getroffen |
| **Double** | Double-Feld getroffen |
| **Bullseye** | Doppel-Bull (50 Punkte) |
| **Bull** | Single-Bull (25 Punkte) |
| **180** | 180 Punkte in einer Aufnahme |
| **Bust** | Überworfen |
| **Miss** | Außerhalb des Boards |
| **Wurf** | Jeder erkannte Wurf |

### Erweiterte Optionen

#### Spielerfarben

Wenn **Spielerfarbe verwenden** aktiviert ist, wird für den Effekt automatisch die Farbe des aktuellen Spielers verwendet:

1. Zuerst wird geprüft, ob der Spieler in der Spielerverwaltung mit einer Farbe hinterlegt ist
2. Falls nicht, wird eine Standardfarbe basierend auf der Spielerposition verwendet

#### Temporäre Effekte

Mit der **Dauer**-Einstellung kann ein Effekt nach einer bestimmten Zeit automatisch zum vorherigen Zustand zurückkehren:

- Dauer = 0: Effekt bleibt aktiv
- Dauer > 0: Nach X Millisekunden wird der vorherige Zustand wiederhergestellt

Beispiel: Ein 180er löst einen kurzen Flash-Effekt aus, danach kehrt WLED zum vorherigen Zustand zurück.

## Beispiel-Konfiguration

### Gaming-Setup mit Spielerfarben

```
Match Start: Effekt "Rainbow" aktivieren
Spielerwechsel: Solid-Farbe mit Spielerfarbe, Dauer 0
Triple: Effekt "Blink", Spielerfarbe, Dauer 500ms
180: Effekt "Fireworks", Dauer 3000ms
Bust: Effekt "Red Alert", Dauer 1000ms
Match Ende: Preset 1 (z.B. "Winner Animation")
```

### Ambient-Setup

```
Match Start: Helligkeit auf 50%
Spielerwechsel: Solid-Farbe mit Spielerfarbe
Wurf: Kurzer Flash, Dauer 100ms
Match Ende: Aus
```

## API

### WLED JSON API

Das Modul kommuniziert über die WLED JSON API:

```
POST http://<wled-ip>:<port>/json/state
```

Beispiel-Payload:
```json
{
  "on": true,
  "bri": 255,
  "seg": [{
    "fx": 12,
    "sx": 128,
    "ix": 128,
    "col": [
      [255, 0, 0],
      [0, 255, 0],
      [0, 0, 255]
    ]
  }]
}
```

### Effekt-IDs

Die wichtigsten WLED-Effekt-IDs:

| ID | Effekt |
|----|--------|
| 0 | Solid |
| 1 | Blink |
| 2 | Breathe |
| 9 | Chase |
| 12 | Colorful |
| 28 | Fire |
| 38 | Rainbow |
| 42 | Theater Rainbow |
| 64 | Fireworks |
| 74 | Sparkle |

Eine vollständige Liste findest du in der [WLED-Dokumentation](https://kno.wled.ge/features/effects/).

## Troubleshooting

### Keine Verbindung zu WLED

1. Prüfe, ob die IP-Adresse korrekt ist
2. Stelle sicher, dass WLED im selben Netzwerk ist
3. Teste die Verbindung: `http://<wled-ip>/json/state`
4. Prüfe die Firewall-Einstellungen

### Effekte werden nicht ausgelöst

1. Prüfe im Log-Bereich, ob Events ankommen
2. Stelle sicher, dass das Modul gestartet ist (grüner Status)
3. Prüfe die Event-Konfiguration

### Falsche Farben

1. Prüfe die Spielerverwaltung auf korrekte Farbzuweisung
2. Stelle sicher, dass "Spielerfarbe verwenden" aktiviert ist
3. Prüfe die RGB-Reihenfolge in WLED (manche LED-Strips haben GRB statt RGB)

## Logs

WLED-Aktivitäten werden im Hub-Log aufgezeichnet:

```
[wled] Sending effect action for throw.detected
[wled] Command sent successfully to 192.168.1.100:80
[wled] Saved previous state for restore after 500ms
[wled] Restoring previous state now
```

## Weitere Ressourcen

- [WLED Projekt](https://github.com/Aircoookie/WLED)
- [WLED Dokumentation](https://kno.wled.ge/)
- [WLED JSON API](https://kno.wled.ge/interfaces/json-api/)
