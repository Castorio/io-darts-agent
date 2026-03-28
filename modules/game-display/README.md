# Game Display Module

Zeigt den aktuellen Spielstand auf einem separaten Display in Echtzeit an. Perfekt für große Bildschirme neben dem Dartboard oder als Zuschauer-Ansicht.

## Features

- **Echtzeit-Updates** - Punktestand wird sofort bei jedem Wurf aktualisiert
- **Spielerfarben** - Animierter Gradient-Hintergrund in der Farbe des aktiven Spielers
- **Checkout-Vorschläge** - Zeigt mögliche Finish-Wege (2-170 Punkte)
- **Wurf-Anzeige** - Drei Boxen für Dart 1, 2 und 3 mit Animationen
- **Andere Spieler** - Horizontale Leiste mit allen anderen Spielern und deren Punkteständen
- **Premium Design** - Dunkler, moderner Look mit sanften Animationen
- **Responsive** - Passt sich verschiedenen Bildschirmgrößen an
- **Demo-Modus** - Zum Testen ohne aktives Spiel

## Screenshot

```
┌──────────────────────────────────────────────────┐
│                                                  │
│                     MAX                          │
│              Set 1 • Leg 2 • Am Zug             │
│                                                  │
│                                                  │
│                     301                          │
│                                                  │
│              T20 → T20 → D20                    │
│                                                  │
│     ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│     │   T20   │ │   T20   │ │    -    │        │
│     │   60    │ │   60    │ │         │        │
│     └─────────┘ └─────────┘ └─────────┘        │
│                                                  │
│               Aufnahme: 120                      │
│                                                  │
│  ┌────────────────────────────────────────────┐ │
│  │  🔴 Anna: 245  │  🟢 Tom: 180              │ │
│  └────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
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
3. Klicke auf **Display konfigurieren**
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

### Einstellungen

| Einstellung | Beschreibung | Standard |
|-------------|-------------|----------|
| **Display Name** | Name zur Identifikation | "Main Display" |
| **Checkout-Vorschläge** | Zeigt mögliche Finish-Wege | Aktiviert |
| **Checkout ab Punktzahl** | Ab welchem Score Checkouts gezeigt werden | 170 |
| **Animationsgeschwindigkeit** | Langsam / Normal / Schnell | Normal |
| **Andere Spieler anzeigen** | Zeigt die Punktestände der anderen Spieler | Aktiviert |

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
        ├── stores/
        │   └── gameDisplay.ts
        └── utils/
            └── checkouts.ts
```

### WebSocket-Verbindung

Das Display verbindet sich mit dem Hub-WebSocket unter `/api/events` und empfängt alle Spiel-Events in Echtzeit.

### Event-Verarbeitung

| Event | Aktion |
|-------|--------|
| `match.started` | Initialisiert Spielansicht |
| `match.state` | Aktualisiert vollständigen Spielstand |
| `throw.detected` | Zeigt Wurf an, aktualisiert Score |
| `player.changed` | Wechselt aktiven Spieler, ändert Hintergrundfarbe |
| `turn.finished` | Zeigt finale Aufnahme, bereitet nächsten Spieler vor |
| `game.finished` | Markiert Leg/Set-Gewinn |
| `match.finished` | Zeigt Spielende |
| `match.deleted` | Kehrt zur Warteansicht zurück |

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

### Farben werden nicht angezeigt

1. Stelle sicher, dass Spielerprofile in der Spielerverwaltung angelegt sind
2. Prüfe, ob die Spielernamen übereinstimmen (oder Aliase konfiguriert sind)

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
