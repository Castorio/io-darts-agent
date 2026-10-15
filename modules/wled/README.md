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
| **Übergangszeit (ms)** | Globale Übergangszeit in Millisekunden, gilt für alle Aktionen mit Übergangszeit "Global". Leer (Standard) = WLED-Standard, `0` = sofortiger Wechsel |

### Event-Aktionen

Für jedes Ereignis kann eine Aktion konfiguriert werden:

#### Aktionstypen

| Typ | Beschreibung |
|-----|-------------|
| **Keine Aktion** | Event wird ignoriert |
| **Preset** | Aktiviert ein gespeichertes WLED-Preset |
| **Effekt** | Startet einen WLED-Effekt mit konfigurierten Parametern |
| **Farbe** | Setzt eine einzelne Farbe |
| **Helligkeit** | Ändert nur die Helligkeit (nur in der Konfigurationsdatei, nicht in der Oberfläche) |
| **Aus** | Schaltet die LEDs aus |

#### Verfügbare Events

Diese Events bietet die Konfigurationsseite an:

| Event | Wann ausgelöst |
|-------|----------------|
| **Match gestartet** | Ein neues Match beginnt |
| **Match beendet** | Ein Match ist zu Ende |
| **Match verlassen** | Benutzer klickt nach der Ergebnisanzeige auf Beenden |
| **Match abgebrochen** | Match wurde abgebrochen |
| **Wurf erkannt** | Jeder Wurf, der in keine der folgenden Kategorien fällt |
| **Triple getroffen** | Triple-Feld getroffen |
| **Double getroffen** | Double-Feld getroffen |
| **Single Bull** | Äußeres Bull (25 Punkte) |
| **Bullseye!** | Bullseye (50 Punkte) |
| **180!** | Der dritte Dart einer Aufnahme mit 180 Punkten |
| **Fehlwurf** | Dart außerhalb der Wertungsfelder (0 Punkte) |
| **Spielerwechsel** | Anderer Spieler ist dran |
| **Aufnahme gestartet** | Ein Spieler beginnt seine Aufnahme |
| **Aufnahme beendet** | Ein Spieler beendet seine Aufnahme |
| **Pfeile ziehen** | Die Pfeile werden aus der Scheibe gezogen |
| **Pfeile gezogen** | Die Pfeile wurden gezogen |

Ein überworfener Dart (Bust) hat intern den Schlüssel `throw.bust`, die Oberfläche bietet dafür aber keine Aktion an. Ein Bust-Dart löst deshalb die Aktion des getroffenen Feldes aus (z.B. Triple getroffen). Genauso fällt der dritte Dart einer 180 auf die Feld-Aktion zurück, wenn für 180! keine Aktion eingestellt ist.

Ein Event "High Finish" gibt es nicht: Der Hub liefert keinen Checkout-Wert, deshalb kann das Modul ihn nicht erkennen.

### Erweiterte Optionen

#### Spielerfarben verwenden

Wenn **Spielerfarbe verwenden** aktiviert ist, wird für den Effekt automatisch die Farbe des aktuellen Spielers verwendet:

1. Zuerst wird geprüft, ob der Spieler in der Spielerverwaltung mit einer Farbe hinterlegt ist
2. Falls nicht, wird eine Standardfarbe basierend auf der Spielerposition verwendet

#### Dauer (Temporäre Effekte)

Mit der **Dauer**-Einstellung kann ein Effekt nach einer bestimmten Zeit automatisch zur Spielerfarbe zurückkehren:

- Dauer = 0: Effekt bleibt aktiv bis zum nächsten Event
- Dauer > 0: Nach X Millisekunden wird die Farbe des aktiven Spielers gesetzt, mit der Aktion für `player.change`

**Wichtig:** Nach Ablauf der Dauer wird nicht der vorherige WLED-Zustand wiederhergestellt, sondern die aktuelle Spielerfarbe angewendet. Ohne Aktion für `player.change` oder außerhalb eines Matches passiert nichts. Beim Match-Start ist die Dauer die Wartezeit bis zur Spielerfarbe; nach Match-Ende, Match verlassen und Match-Abbruch wird nichts gesetzt. Intent-Aktionen mit Dauer (Farbe, Effekt, Preset, Rainbow) verhalten sich genauso.

Beispiel: Ein 180er löst einen kurzen Flash-Effekt aus, danach kehrt WLED zur Spielerfarbe zurück.

#### Übergangszeit (Fade Time)

Die **Fade Time** bestimmt, wie sanft der Übergang zwischen zwei Lichtzuständen ist:

- **Global**: In den Verbindungseinstellungen konfigurierbar (Millisekunden)
- **Pro Aktion**: Global, Sofort, 0.2s, 0.5s, 1s, 2s oder 5s. "Global" übernimmt den globalen Wert, "Sofort" erzwingt einen Wechsel ohne Übergang
- Gespeichert wird immer in Millisekunden (z.B. 500 = 0,5 Sekunden). Erst beim Senden wird in WLED-Einheiten umgerechnet: `tt = round(ms / 100)`, maximal 65,5 Sekunden
- Ist das globale Feld leer und die Aktion auf "Global", schickt das Modul keine Übergangszeit und WLED nutzt seine eigene Standard-Übergangszeit
- Blitz-Aktionen (Flash) laufen immer ohne Übergang

**Migration älterer Konfigurationen:** Frühere Versionen haben die Übergangszeit pro Aktion in Zehntelsekunden gespeichert (50 = 5s), aber als Millisekunden gelesen. Konfigurationen ohne das Feld `fadeTimeUnit: "ms"` werden beim Laden umgerechnet:

| Alter Wert pro Aktion | Neuer Wert |
|-----------------------|------------|
| 0 bis 100 | Wert × 100 ms (50 wird 5000 ms) |
| über 100 | bleibt, wird als Millisekunden gelesen (der alte Editor konnte solche Werte nicht erzeugen) |
| negativ oder keine Zahl | wird entfernt, die Aktion nutzt dann die globale Übergangszeit |

Die globale Übergangszeit war schon immer in Millisekunden. Ein alter globaler Wert `0` war nur der frühere Standardwert (in der Oberfläche nicht einstellbar) und wird entfernt, damit WLED wie bisher seine eigene Standard-Übergangszeit nutzt. Ein alter globaler Wert über 0 bleibt erhalten. Beim nächsten Speichern in der Oberfläche wird `fadeTimeUnit: "ms"` gesetzt; danach wird nichts mehr umgerechnet.

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
Match gestartet: Effekt "Rainbow", Dauer 2s
Spielerwechsel: Farbe mit Spielerfarbe, Übergangszeit 0.5s
Triple getroffen: Effekt "Blink", Spielerfarbe, Dauer 0.5s
180!: Effekt "Fireworks", Dauer 3s
Fehlwurf: Farbe Rot, Dauer 1s
Pfeile gezogen: Farbe mit Spielerfarbe
Match beendet: Preset 1 (z.B. "Winner Animation")
```

### Ambient-Setup

```
Match gestartet: Farbe Weiß, Helligkeit 50%
Spielerwechsel: Farbe mit Spielerfarbe, Übergangszeit 1s
Wurf erkannt: Farbe Weiß, Dauer 0.5s
Pfeile gezogen: Farbe mit Spielerfarbe
Match beendet: Aus
```

## API

### WLED JSON API

Das Modul kommuniziert über die WLED JSON API:

```
POST http://<wled-ip>:<port>/json/state
```

Beispiel-Payload mit 500 ms Übergangszeit:
```json
{
  "on": true,
  "bri": 255,
  "tt": 5,
  "seg": [{
    "fx": 0,
    "col": [[255, 0, 0]]
  }]
}
```

Hinweis: `tt` ist in 100ms-Einheiten (5 = 500ms) und gilt nur für diesen Befehl. Das Modul nutzt bewusst nicht `transition`, weil das die Standard-Übergangszeit des Controllers dauerhaft ändern würde.

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
