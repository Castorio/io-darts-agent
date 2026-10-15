# IO-Darts-Agent

Ein lokaler Hub für [Autodarts](https://autodarts.io): Er empfängt die Live-Spielereignisse deines Boards und macht daraus Lichteffekte, ein Scoreboard auf einem zweiten Bildschirm und gesprochene Score-Ansagen.

**[English Version](README.md)**

IO-Darts-Agent ist Source Available und für private, nicht-kommerzielle Nutzung kostenlos (siehe [Lizenz](#lizenz)).

![Dashboard](docs/images/03-dashboard.png)

## Funktionen

- **Autodarts-Anbindung**: meldet sich mit deinem Autodarts-Konto an und empfängt Match-, Wurf- und Takeout-Events deines Boards in Echtzeit.
- **Modulsystem**: Module reagieren auf Spielereignisse und kommunizieren über Intents miteinander. Eingebaute Module lassen sich im Web-Interface starten, stoppen und konfigurieren; weitere Module können über eine Git-URL installiert werden.
- **Web-Interface** (Vue 3): Setup-Assistent, Dashboard, Modulverwaltung, Spieler, Medienbibliothek, Live-Konsole, Einstellungen und KI-Anbieter-Einstellungen.
- **Spielerprofile**: eigene Spieler mit individuellen Farben, die von Licht- und Display-Modul genutzt werden.
- **Mehrsprachige Oberfläche**: Englisch und Deutsch vollständig, Spanisch, Französisch, Italienisch, Niederländisch, Russisch, Ukrainisch, Japanisch und Chinesisch teilweise übersetzt.
- **Optionaler Web-Login** für die Konfigurationsoberfläche.

### Eingebaute Module

| Modul | Funktion |
|-------|----------|
| **WLED Lighting Controller** | Steuert WLED-LED-Strips pro Spielereignis: Spielerfarben, Effekte und Presets für 180er, Triples, Bulls, Bust und Siege, mit Dauer, Überblendung und Wiederherstellung der Spielerfarbe. |
| **Game Display** | Vollbild-Scoreboard für einen zweiten Bildschirm oder ein Tablet: Punktestand, Checkout-Vorschläge, Spielerfarben, Animationen pro Event und pro Spieler, Startbildschirm und Ergebnistabelle. |
| **Darts Caller** | Sagt Scores, Checkouts, Bust, Game Shot und Spielerwechsel an, per Browser-TTS oder Audio-Voice-Packs. Voice Packs und Spielernamen lassen sich mit ElevenLabs erzeugen. |

### KI-Anbieter

Einstellbar unter dem Menüpunkt **AI Provider** in der Seitenleiste (`/ai-settings`), alle optional:

| Anbieter | Verwendung |
|----------|------------|
| ElevenLabs | Voice-Pack-Erzeugung und Spielernamen für den Darts Caller |
| Runway, Higgsfield | Animationsgenerator für das Game Display (Engine wählbar) |
| OpenAI, Anthropic, Ollama | Textmodelle für Module |
| Stability AI, Replicate | Bild- und weitere Modelle für Module |

Der Animationsgenerator erzeugt kurze Clips aus einem Text-Prompt (Stil und Event) und kann einen schwarzen Hintergrund zu einem transparenten WebM freistellen (benötigt `ffmpeg`).

![Game Display Demo](docs/images/10-game-display-demo.png)

## Voraussetzungen

- Node.js 22 oder neuer mit npm
- Git
- `ffmpeg` im `PATH` (für generierte Animationen)
- Ein Autodarts-Konto und ein Board
- Optional: WLED-Controller, ein zweiter Bildschirm für das Game Display, API-Keys für die gewünschten KI-Anbieter

## Schnellstart

Start aus dem Quellcode:

```bash
git clone https://github.com/Castorio/io-darts-agent.git
cd io-darts-agent

npm run setup       # installiert alle Abhängigkeiten, baut das Modul-SDK
npm run build:app   # Backend, Web-Interface und Game-Display-Oberfläche
npm start
```

Öffne <http://localhost:3000>. Ohne Konfiguration startet der Hub im Setup-Modus, und der Setup-Assistent fragt nach Autodarts-Login und Board.

Die Laufzeitkonfiguration liegt in `dist/config/` (relativ zum kompilierten `dist/src/main.js`):

| Datei | Inhalt |
|-------|--------|
| `dist/config/hub.config.json` | Autodarts-Login, Board, Server-Port, Web-Login |
| `dist/config/ai-providers.json` | KI-Anbieter und API-Keys |
| `dist/config/players.json` | Spielerprofile |
| `dist/config/modules/` | Moduleinstellungen |

Der Server-Port ist standardmäßig 3000. Die Umgebungsvariable `PORT` gilt nur vor der Einrichtung (Setup-Modus, noch keine Konfigurationsdatei). Der Setup-Assistent speichert den laufenden Port als `server.port` in `hub.config.json`, danach gilt dieser Wert.

Die vollständige Anleitung, auch für einen eigenen Linux-Board-PC, der Hub und Game Display automatisch startet (`scripts/linux/`), steht in der Installationsanleitung: [Deutsch](docs/de/installation.md) | [English](docs/en/installation.md).

## Dokumentation

| Thema | Deutsch | English |
|-------|---------|---------|
| Installation | [installation.md](docs/de/installation.md) | [installation.md](docs/en/installation.md) |
| Benutzerhandbuch | [user-guide.md](docs/de/user-guide.md) | [user-guide.md](docs/en/user-guide.md) |
| Funktionen | [features.md](docs/de/features.md) | [features.md](docs/en/features.md) |
| REST- und WebSocket-API | [api.md](docs/de/api.md) | [api.md](docs/en/api.md) |
| Entwickler-Schnellstart | [developer-quickstart.md](docs/de/developer-quickstart.md) | [developer-quickstart.md](docs/en/developer-quickstart.md) |
| Entwicklerhandbuch | [developer-guide.md](docs/de/developer-guide.md) | [developer-guide.md](docs/en/developer-guide.md) |
| Modul-SDK | [module-sdk.md](docs/de/module-sdk.md) | [module-sdk.md](docs/en/module-sdk.md) |

Die Modul-READMEs in `modules/` sind auf Deutsch.

Änderungen stehen im [Changelog](CHANGELOG.md).

## Tech-Stack

- **Backend**: Node.js, TypeScript, Fastify (REST und WebSocket), Autodarts-WebSocket-Client
- **Frontend**: Vue 3, Vite, Pinia, Vue Router, vue-i18n, Tailwind CSS
- **Module**: eingebaute Module laufen im Hub; über Git installierte Module laufen als eigene Node-Prozesse, per IPC angebunden; das Game Display hat eine eigene Vue-Oberfläche
- **Tests**: Vitest, Playwright
- **Paketierung**: Electron-Desktop-App über electron-builder (macOS getestet)

## Mitwirken

Issues und Pull Requests sind willkommen. Siehe [CONTRIBUTING.md](CONTRIBUTING.md) (Englisch).

## Sicherheit

IO-Darts-Agent ist für ein vertrauenswürdiges lokales Netzwerk gebaut. Stelle ihn nicht ins Internet und richte keine Portweiterleitung auf ihn ein. Zugangsdaten und API-Keys liegen als einfaches JSON auf dem Hub-Rechner. Details und wie du eine Schwachstelle meldest: [SECURITY.md](SECURITY.md) (Englisch).

## Lizenz

IO-Darts-Agent steht unter der [PolyForm Noncommercial License 1.0.0](LICENSE). Der Code ist Source Available, keine OSI-Open-Source-Lizenz.

- Kostenlos für private und andere nicht-kommerzielle Nutzung.
- Du darfst den Code ändern und weitergeben, auch in geänderter Form, solange es nicht kommerziell ist.
- Kommerzielle Nutzung braucht eine separate Lizenz. Kontakt: [info@castor.io](mailto:info@castor.io).

Das Modul-SDK in `module-sdk/` steht unter der MIT-Lizenz ([module-sdk/LICENSE](module-sdk/LICENSE)), damit Module von Dritten es frei nutzen können.

## Haftungsausschluss

IO-Darts-Agent ist ein inoffizielles Projekt. Es steht in keiner Verbindung zu Autodarts und wird von Autodarts weder unterstützt noch empfohlen. "Autodarts" ist eine Marke des jeweiligen Inhabers.

---

Ein Projekt von [castor.io](https://castor.io)
