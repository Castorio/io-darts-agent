# WLED Lighting Controller

Steuert WLED-kompatible LED-Controller basierend auf Autodarts-Spielevents.

## Features

- **Event-basierte Aktionen**: Verschiedene Lichteffekte für unterschiedliche Spielsituationen
- **Spielerfarben**: Automatische Verwendung der Spielerfarben aus der Spielerverwaltung
- **Temporäre Effekte**: Effekte mit Dauer und automatischer Rückkehr zur Spielerfarbe
- **Fade Time (Übergangszeit)**: Sanfte Übergänge zwischen Lichtzuständen
- **Presets & Effekte**: Unterstützung für WLED-Presets und alle WLED-Effekte
- **Multi-Color**: Bis zu 3 Farben pro Effekt
- **Einzelspieler-Modus**: Spielerfarbe wird auch ohne Spielerwechsel korrekt angezeigt
- **Intent-System**: Reagiert auf Intents von anderen Modulen (z.B. Caller-Ansagen lösen Lichteffekte aus)

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
3. Klicke auf **Konfigurieren**

### Verbindung

| Einstellung | Beschreibung |
|-------------|-------------|
| **WLED IP-Adresse** | IP-Adresse deines WLED-Controllers (z.B. 192.168.1.100) |
| **WLED Port** | HTTP-Port von WLED (Standard: 80) |
| **Übergangszeit (Fade Time)** | Globale Übergangszeit in ms für sanfte Farbwechsel |

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
| **Match Ergebnis** | Match-Ergebnis wird angezeigt |
| **Match Beenden** | Benutzer schließt Match-Ergebnisse |
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
| **Pfeile gezogen (Takeout)** | Nach dem Entfernen der Pfeile |

**Hinweis:** "High Finish" ist in `module.json` als Event gelistet, wird aber vom WLED-Modul aktuell nicht ausgelöst: Es gibt keine Checkout-Erkennung in der Wurf-Zuordnung. Die Zeile wurde hier bewusst weggelassen; bis das implementiert ist, bleibt eine dafür konfigurierte Aktion wirkungslos.

### Erweiterte Optionen

#### Spielerfarben verwenden

Wenn **Spielerfarbe verwenden** aktiviert ist, wird für den Effekt automatisch die Farbe des aktuellen Spielers verwendet:

1. Zuerst wird geprüft, ob der Spieler in der Spielerverwaltung mit einer Farbe hinterlegt ist
2. Falls nicht, wird eine Standardfarbe basierend auf der Spielerposition verwendet

#### Dauer (Temporäre Effekte)

Mit der **Dauer**-Einstellung kann ein Effekt nach einer bestimmten Zeit automatisch zur Spielerfarbe zurückkehren:

- Dauer = 0: Effekt bleibt aktiv bis zum nächsten Event
- Dauer > 0: Nach X Millisekunden wird zur Spielerfarbe zurückgekehrt

**Wichtig:** Nach Ablauf der Dauer wird nicht der vorherige WLED-Zustand wiederhergestellt, sondern die aktuelle Spielerfarbe angewendet.

Beispiel: Ein 180er löst einen kurzen Flash-Effekt aus, danach kehrt WLED zur Spielerfarbe zurück.

#### Übergangszeit (Fade Time)

Die **Fade Time** bestimmt, wie sanft der Übergang zwischen zwei Lichtzuständen ist:

- **Global**: In den Grundeinstellungen konfigurierbar
- **Pro Aktion**: Kann für jede Aktion individuell überschrieben werden
- Wert in Millisekunden (z.B. 500ms = 0,5 Sekunden Übergang)

### Einzelspieler-Modus

Das WLED-Modul unterstützt auch Einzelspieler-Spiele korrekt:

1. **Bei Match-Start**: Die Spielerfarbe wird nach der optionalen Start-Animation automatisch angewendet
2. **Nach jedem Takeout**: Die Spielerfarbe wird erneut angewendet
3. **Kein Spielerwechsel nötig**: Die Farbe bleibt auch ohne `player.change`-Event aktiv

### Intent-System

Das WLED-Modul kann auf Intents von anderen Modulen reagieren:

1. **Aktivierung**: In der Modul-Konfiguration können Intent-Abonnements konfiguriert werden
2. **Verfügbare Intents**: Abhängig von installierten Modulen (z.B. Caller-Ansagen)
3. **Aktionen**: Jeder Intent kann eine WLED-Aktion auslösen (Effekt, Solid, Preset, etc.)

Beispiel: Wenn der Darts Caller "180" ansagt, kann WLED einen speziellen Lichteffekt abspielen.

## Beispiel-Konfiguration

### Gaming-Setup mit Spielerfarben

```
Match Start: Effekt "Rainbow", Dauer 2000ms
Spielerwechsel: Solid mit Spielerfarbe, Fade Time 500ms
Triple: Effekt "Blink", Spielerfarbe, Dauer 300ms
180: Effekt "Fireworks", Dauer 3000ms
Bust: Solid Rot, Dauer 1000ms
Pfeile gezogen: Solid mit Spielerfarbe
Match Ende: Preset 1 (z.B. "Winner Animation")
```

### Ambient-Setup

```
Match Start: Helligkeit auf 50%
Spielerwechsel: Solid mit Spielerfarbe, Fade Time 1000ms
Wurf: Kurzer Flash, Dauer 100ms
Pfeile gezogen: Spielerfarbe wiederherstellen
Match Ende: Aus
```

## API

### WLED JSON API

Das Modul kommuniziert über die WLED JSON API:

```
POST http://<wled-ip>:<port>/json/state
```

Beispiel-Payload mit Fade Time:
```json
{
  "on": true,
  "bri": 255,
  "transition": 5,
  "seg": [{
    "fx": 0,
    "col": [[255, 0, 0]]
  }]
}
```

Hinweis: `transition` ist in 100ms-Einheiten (5 = 500ms).

### Effekt-IDs

Die wichtigsten WLED-Effekt-IDs:

| ID | Effekt |
|----|--------|
| 0 | Solid |
| 1 | Blink |
| 2 | Breathe |
| 9 | Rainbow |
| 12 | Fade |
| 28 | Fire |
| 38 | Chase Rainbow |
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

### Spielerfarbe wird im Einzelspieler-Modus nicht angezeigt

1. Stelle sicher, dass für `player.change` eine Aktion mit **Spielerfarbe verwenden** konfiguriert ist
2. Diese Aktion wird auch für Einzelspieler-Spiele verwendet
3. Prüfe die Konsolen-Logs auf WLED-Meldungen

### Falsche Farben

1. Prüfe die Spielerverwaltung auf korrekte Farbzuweisung
2. Stelle sicher, dass "Spielerfarbe verwenden" aktiviert ist
3. Prüfe die RGB-Reihenfolge in WLED (manche LED-Strips haben GRB statt RGB)

### Effekt kehrt nicht zur Spielerfarbe zurück

1. Prüfe, ob eine **Dauer** > 0 konfiguriert ist
2. Stelle sicher, dass für `player.change` eine Aktion konfiguriert ist
3. Diese Aktion wird für die Rückkehr zur Spielerfarbe verwendet

## Logs

WLED-Aktivitäten werden im Hub-Log aufgezeichnet:

```
[wled] Sending solid action for player.change (fade: 500ms)
[wled] Sending effect action for throw.detected
[wled] Will restore to player color in 500ms
[wled] Restoring to player color RGB(255, 128, 0)
```

Zusätzliche Debug-Logs (in der Konsole):
```
WLED [match.start]: Will apply player color after 2000ms
WLED [takeout.finished]: Applying player color for Max
WLED [throw.detected]: Restoring to player color RGB(255, 128, 0)
```

## Weitere Ressourcen

- [WLED Projekt](https://github.com/Aircoookie/WLED)
- [WLED Dokumentation](https://kno.wled.ge/)
- [WLED JSON API](https://kno.wled.ge/interfaces/json-api/)
