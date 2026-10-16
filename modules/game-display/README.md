# Game Display Module

Zeigt den aktuellen Spielstand auf einem separaten Display in Echtzeit an. Perfekt für große Bildschirme neben dem Dartboard oder als Zuschauer-Ansicht.

## Features

- **Echtzeit-Updates**: Punktestand wird sofort bei jedem Wurf aktualisiert
- **Spielerfarben**: Animierter Gradient-Hintergrund in der Farbe des aktiven Spielers
- **Checkout-Vorschläge**: Zeigt mögliche Finish-Wege (2-170 Punkte)
- **Wurf-Anzeige**: Drei Boxen für Dart 1, 2 und 3 mit Animationen
- **Andere Spieler**: Horizontale Leiste mit allen anderen Spielern und deren Punkteständen
- **Animationen**: Konfigurierbare Animationen pro Event (180, Bust, Game Shot, etc.)
- **Idle-Modus**: Verschiedene Optionen wenn kein Spiel läuft
- **Premium Design**: Dunkler, moderner Look mit sanften Animationen
- **Responsive**: Passt sich verschiedenen Bildschirmgrößen an
- **Demo-Modus**: Zum Testen ohne aktives Spiel
- **Match-Start Bildschirm**: Konfigurierbarer Bildschirm bei Spielstart (Standard-Animation oder eigenes Bild/GIF)
- **Match-Ergebnisse**: Ergebnistabelle mit Chalkboard und Statistiken nach Spielende
- **Konfigurierbare Hintergrundfarben**: Anpassbare Farben für verschiedene Anzeigen

## Screenshot

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│                           MAX                                │
│                   Set 1 • Leg 2 • Am Zug                     │
│                        Sets: 0  Legs: 1                      │
│                                                              │
│                           301                                │
│                                                              │
│                    T20 → T20 → D20                           │
│                                                              │
│        ┌─────────┐   ┌─────────┐   ┌─────────┐              │
│        │   T20   │   │   T20   │   │    -    │              │
│        │   60    │   │   60    │   │         │              │
│        └─────────┘   └─────────┘   └─────────┘              │
│                                                              │
│                      Aufnahme: 120                           │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Anna: 245 (1 Leg)     │  Tom: 180 (0 Legs)              │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

## Installation

Das Game Display Modul ist standardmäßig im IO-Darts-Agent enthalten.

### Frontend bauen (falls nötig)

```bash
cd modules/game-display/web
npm install
npm run build
```

## Verwendung

### Display öffnen

1. Öffne das Web-Interface unter `http://localhost:3000`
2. Gehe zu **Module** → **Game Display**
3. Klicke auf **Konfigurieren**
4. Klicke auf **Display öffnen** oder kopiere die URL

### Direkte URL

Das Display ist erreichbar unter:
```
http://localhost:3000/module-ui/game-display/
```

Diese URL kann auch auf anderen Geräten im selben Netzwerk geöffnet werden (z.B. Tablet, Smart-TV).

### Auf externem Display

1. Kopiere die Display-URL
2. Öffne sie auf dem externen Gerät
3. Aktiviere Vollbildmodus (F11)

## Konfiguration

### Allgemeine Einstellungen

| Einstellung | Beschreibung | Standard |
|-------------|-------------|----------|
| **Display Name** | Name zur Identifikation | "Main Display" |
| **Checkout-Vorschläge** | Zeigt mögliche Finish-Wege | Aktiviert |
| **Checkout ab Punktzahl** | Ab welchem Score Checkouts gezeigt werden | 170 |
| **Andere Spieler anzeigen** | Zeigt die Punktestände der anderen Spieler | Aktiviert |

### Idle-Modus (Wenn kein Spiel läuft)

| Modus | Beschreibung |
|-------|-------------|
| **Warte-Bildschirm** | Standard-Warteansicht mit "Warte auf Spiel..." |
| **Letztes Spiel** | Zeigt die Ergebnisse des letzten Spiels |
| **Schwarzer Bildschirm** | Display wird komplett schwarz |
| **Eigenes Bild** | Zeigt ein konfiguriertes Bild |

### Match-Start Bildschirm

| Modus | Beschreibung |
|-------|-------------|
| **Standard** | Zeigt Standard-Match-Start-Animation |
| **Eigenes Bild/GIF** | Zeigt dein eigenes Bild oder animiertes GIF |

### Match-Ergebnisse

Nach Match-Ende zeigt das Display eine Ergebnistabelle mit:
- Chalkboard mit allen Würfen
- Match-Statistiken (Durchschnitte, geworfene Darts, etc.)
- Finale Punktestände

| Einstellung | Beschreibung | Standard |
|-------------|-------------|----------|
| **Anzeigedauer** | Wie lange Ergebnisse angezeigt werden (0 = manuell schließen) | 30000 (30 Sekunden) |
| **Hintergrundfarbe** | Hintergrundfarbe für den Ergebnisbildschirm | #0a0a0f |

### Animationen

Für bestimmte Events können Animationen konfiguriert werden:

| Event | Beispiel-Animation |
|-------|-------------------|
| **180** | "180!" Animation mit Konfetti |
| **Bull** | Bullauge-Animation |
| **Double Bull** | Doppel-Bull-Animation |
| **High Score** | Animation ab konfigurierbarem Schwellenwert (Standard: 140), einmal pro Aufnahme nach dem dritten Dart |
| **Bust** | Rote "BUST" Animation |
| **Checkout** | Checkout-Animation |
| **Leg Win** | Gewinner-Animation für Leg |
| **Match Win** | Große Feier-Animation |

Animationen unterstützen verschiedene Medientypen:
- **Built-in**: Vordefinierte Animationen
- **GIF**: Eigene GIF-Animationen (URL)
- **Video**: Eigene Videos (URL)
- **Sound**: Optionaler Ton zu jeder Animation (MP3, WAV, etc.)

### Spieler-spezifische Animationen

Im **Spieler-Tab** der Konfiguration können individuelle Animationen pro Spieler festgelegt werden:

| Event | Beschreibung |
|-------|-------------|
| **180** | Eigene Animation wenn dieser Spieler eine 180 wirft |
| **Leg Win** | Eigene Animation wenn dieser Spieler ein Leg gewinnt |
| **Match Win** | Eigene Animation wenn dieser Spieler das Match gewinnt |
| **Checkout** | Eigene Animation wenn dieser Spieler auscheckt |

**So funktioniert es:**
1. Gehe zur Game Display Konfiguration
2. Wechsle zum Tab "Spieler"
3. Wähle einen Spieler aus der Liste oder erstelle einen neuen Eintrag
4. Konfiguriere die gewünschten Animationen (GIF, Video, Sound)
5. Die Spieler-Animation überschreibt die globale Animation wenn der jeweilige Spieler am Zug ist

**Beispiel-Anwendung:**
- Spieler "Max" hat ein persönliches 180-GIF mit Jubel-Sound
- Spieler "Anna" hat eine Match-Win-Animation mit ihrem Lieblingssong
- Die globalen Animationen werden als Fallback verwendet

### Spielerfarben

Das Display verwendet die Farben aus der Spielerverwaltung:

1. Gehe zu **Spieler** im Web-Interface
2. Erstelle Spielerprofile mit individuellen Farben
3. Der Spielername muss mit dem Autodarts-Namen übereinstimmen (oder als Alias hinterlegt sein)

## Technische Details

### Architektur

Das Game Display ist eine eigenständige Vue.js-Anwendung, die im Modul-Ordner liegt:

```
modules/game-display/
├── module.json          # Modul-Manifest
├── README.md            # Diese Datei
└── web/                 # Frontend
    ├── package.json
    ├── vite.config.ts
    ├── index.html
    └── src/
        ├── main.ts
        ├── App.vue
        ├── components/
        │   └── AnimationOverlay.vue
        ├── stores/
        │   └── gameDisplay.ts   # Enthält PlayerResolver
        ├── locales/            # i18n (DE, EN, ES)
        └── utils/
            └── checkouts.ts
```

### WebSocket-Verbindung

Das Display verbindet sich mit dem Hub-WebSocket unter `/api/events` und empfängt alle Spiel-Events in Echtzeit.

### Event-Verarbeitung

| Event | Aktion |
|-------|--------|
| `match.start` | Holt vollständige Match-Daten via API, zeigt Match-Start Bildschirm |
| `match.state` | Aktualisiert Spielstand, Spieler, Scores |
| `throw.detected` | Zeigt Wurf an, aktualisiert Score |
| `player.change` | Wechselt aktiven Spieler, ändert Hintergrundfarbe |
| `turn.finished` | Zeigt finale Aufnahme |
| `game.finished` | Zeigt Leg/Set-Gewinn Animation |
| `match.finished` | Zeigt Spielende Animation |
| `match.result` | Zeigt Ergebnistabelle mit Chalkboard und Statistiken |
| `match.finish` | Schließt Ergebnisanzeige (Benutzer klickt "Beenden") |
| `match.delete` | Kehrt zur Idle-Ansicht zurück |

### Wichtig: Match-Start

Bei `match.start` wird automatisch die vollständige Match-Konfiguration über die API abgerufen (`/api/match/current`), da das Event selbst nur die Match-ID enthält. So werden die echten Spielerdaten und Scores angezeigt, nicht die Standardwerte.

### PlayerResolver: Robuste Spieler-Erkennung

Das Game Display verwendet einen **PlayerResolver** zur stabilen Spieler-Erkennung trotz Array-Rotation bei Leg-Wechseln.

#### Das Problem

Autodarts rotiert das Spieler-Array nach jedem Leg. Das führt zu Problemen:
- Die Array-Position (`data.player`) ändert sich nach jedem Leg
- Der "winner"-Index bezieht sich auf die aktuelle (rotierte) Array-Position
- Spielernamen werden mit dem Array mitrotiert

**Beispiel:**
```
Leg 1: players[0] = "Max", players[1] = "Anna" → activePlayer = 0 (Max)
Leg 2: players[0] = "Anna", players[1] = "Max" → activePlayer = 0 (Anna, aber Name im Array ist jetzt "Anna"!)
```

#### Die Lösung: PlayerResolver

Der PlayerResolver speichert beim Match-Start die **originale** Zuordnung von Namen zu stabilen `player.index`-Werten und verwendet diese für alle späteren Lookups:

```typescript
// Lookup-Priorität:
1. Spielername (case-insensitive) → originale Name→Index Zuordnung
2. player.index → stabiler Index von Autodarts
3. Array-Position → Fallback (kann nach Rotation falsch sein)
```

#### Gewinner-Ermittlung

Bei `game.finished` (Leg-Gewinn) und `match.finished` werden mehrere Strategien verwendet:

| Priorität | Strategie | Zuverlässigkeit |
|-----------|-----------|-----------------|
| 1 | `winnerName` aus Event | Höchste: vom Backend zum Zeitpunkt des Gewinns erfasst |
| 2 | `winnerPlayerIndex` aus Event | Hoch: stabiler player.index |
| 3 | Spieler mit `score === 0` | Mittel: wenn Leg noch nicht gewechselt hat |
| 4 | `winner` Array-Position | Niedrig: kann nach Rotation falsch sein |

#### Wichtig: Leg-Wechsel

Bei einem neuen Leg:
1. Der Winner wird zurückgesetzt
2. Das Dart-Tracking wird zurückgesetzt
3. Die Scores werden aktualisiert (auf Startwert zurückgesetzt)
4. Der **aktive Spieler wird NICHT** aus `match.state` gesetzt, stattdessen wartet das Display auf das `player.change` Event

Dies ist wichtig, da Autodarts nach einem Leg-Wechsel das Spieler-Array rotiert und `data.player` (die Array-Position) nicht mehr zuverlässig den korrekten aktiven Spieler anzeigt.

### Demo-Modus

Für Tests ohne aktives Autodarts-Spiel:

1. Klicke auf **Demo starten** (oben rechts auf dem Display)
2. Simulierte Spielerdaten werden angezeigt
3. Klicke auf **Demo beenden** zum Zurücksetzen

## Checkout-Vorschläge

Das Display zeigt optimale Checkout-Wege für Scores von 2-170:

| Score-Bereich | Beispiele |
|---------------|-----------|
| 170-100 | T20 T20 Bull, T20 T20 D20, T20 Bull, T20 D20 |
| 99-60 | T19 D20, T20 D12, S20 D20 |
| 59-40 | D20, D19, S19 D20 |
| 39-2 | S7 D16, D16, D1 |

Bogey-Numbers (nicht checkbar): 169, 168, 166, 165, 163, 162, 159

## Styling

### CSS-Variablen

Das Display verwendet folgende CSS-Variablen für die Spielerfarbe:

```css
--player-color       /* Hauptfarbe */
--player-color-dark  /* Dunklere Variante */
--player-color-deep  /* Sehr dunkle Variante für Hintergrund */
```

### Animationen

- **Hintergrund**: Sanfter Farbübergang bei Spielerwechsel (700ms)
- **Score**: Puls-Animation bei Score-Änderung
- **Dart-Boxen**: Scale-Animation bei neuem Wurf
- **Bust**: Shake-Animation und rote Hervorhebung
- **Glow-Effekte**: Langsame Pulse-Animation im Hintergrund

## Browser-Unterstützung

- Chrome 90+ (empfohlen)
- Firefox 88+
- Safari 14+
- Edge 90+

## Troubleshooting

### Display zeigt "Warte auf Spiel..."

1. Prüfe, ob ein Match in Autodarts aktiv ist
2. Prüfe die Hub-Verbindung im Dashboard
3. Prüfe die Browser-Konsole auf WebSocket-Fehler

### Bei Spielstart werden falsche Daten angezeigt (z.B. "501", "Spieler")

1. Das Display sollte bei `match.start` automatisch die vollständigen Daten via API abrufen
2. Prüfe die Browser-Konsole auf "Match started, fetching full match data..."
3. Stelle sicher, dass der Hub-Server erreichbar ist

### Farben werden nicht angezeigt

1. Stelle sicher, dass Spielerprofile in der Spielerverwaltung angelegt sind
2. Prüfe, ob die Spielernamen übereinstimmen (oder Aliase konfiguriert sind)

### Namen/Farben werden im zweiten Leg vertauscht angezeigt

**Symptom:** Im ersten Leg werden die korrekten Namen und Farben angezeigt, aber ab dem zweiten Leg sind sie vertauscht.

**Ursache:** Autodarts rotiert das Spieler-Array nach jedem Leg. Das Display muss diese Rotation korrekt handhaben.

**Lösung:**
1. Stelle sicher, dass du die aktuelle Version des Game Display Moduls verwendest (mit PlayerResolver)
2. Prüfe die Browser-Konsole auf `[PlayerResolver]` Log-Einträge
3. Beim Leg-Wechsel solltest du `[PlayerResolver] New leg started` sehen
4. Das Display sollte auf das `player.change` Event warten, nicht auf `match.state`

**Debug-Informationen in der Browser-Konsole:**
```
[PlayerResolver] First init - saved original mappings
[PlayerResolver] Building player list, activePlayerIndex: X
[PlayerResolver] New leg - updating scores only, waiting for player.change event
```

### Gewinner wird nach Leg-Gewinn falsch angezeigt

**Symptom:** Nach einem Leg-Gewinn wird der falsche Spieler als Gewinner angezeigt.

**Lösung:**
1. Prüfe, ob das Backend `winnerName` im `game.finished` Event sendet
2. Der PlayerResolver sucht den Gewinner nach: Name → playerIndex → score=0 → arrayPosition
3. Prüfe die Browser-Konsole auf `[GameFinished] Winner by...` Einträge

### Display lädt nicht

1. Prüfe, ob das Frontend gebaut wurde (`npm run build` in `modules/game-display/web`)
2. Prüfe, ob der Hub-Server läuft
3. Prüfe die Netzwerkverbindung

### Performance-Probleme

1. Verwende einen modernen Browser
2. Schließe nicht benötigte Browser-Tabs
3. Deaktiviere Browser-Erweiterungen auf der Display-Seite

## Entwicklung

### Development-Server

```bash
cd modules/game-display/web
npm run dev
```

Das Development-Frontend läuft auf `http://localhost:5174` mit Hot-Reload.

### Build

```bash
npm run build
```

Der Build-Output landet in `modules/game-display/web/dist/` und wird automatisch vom Hub unter `/module-ui/game-display/` bereitgestellt.

## Mehrsprachigkeit

Das Display unterstützt mehrere Sprachen:

- **Deutsch (de)**: Standard
- **English (en)**
- **Español (es)**

Die Sprache wird automatisch basierend auf den Browser-Einstellungen gewählt.
