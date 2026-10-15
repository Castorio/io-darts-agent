# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> Hinweis: Datumsangaben anhand der Git-Historie korrigiert. Die gesamte
> Repository-Historie liegt zwischen März und Mai 2026 (Initial Commit
> 2026-03-28), nicht 2024/2025.

## [Unreleased]

### Changed

- **Autodarts-Login auf v2 umgestellt.** Der alte Keycloak-Login (`login.autodarts.io`) ist abgeschaltet. Der Hub meldet sich jetzt über `https://api.autodarts.com/auth/v1/login` an (Client-ID `autodarts-play`, per `AUTODARTS_CLIENT_ID` überschreibbar, kein Client-Secret mehr) und erneuert Tokens über `/auth/v1/refresh` (rotierende Refresh-Tokens, Neu-Login als Fallback).
- **AI-Provider aktualisiert.** Claude: Standard `claude-opus-5` (Claude 3.5 Sonnet war abgeschaltet), abgeschaltete IDs fallen auf den Standard zurück, `temperature`/`top_p` nur noch für Modelle, die sie akzeptieren, `effort: low` und mind. 1024 Tokens für Modelle mit Thinking, Refusal-Fallbacks. OpenAI: Modelle kommen live aus `GET /v1/models` des jeweiligen Keys (bevorzugt neueste), abgeschaltete Modelle (DALL-E, gpt-4o, o1/o3-mini/o4-mini, gpt-4.1-nano, tts-1) werden ersetzt, `max_completion_tokens` und `reasoning_effort` für Reasoning-Modelle, GPT Image ohne `response_format`. Neuer Endpunkt `GET /api/ai/providers/:id/models`; die Einstellungsseite zeigt die verfügbaren Modelle des Keys.
- **WebSocket per Ticket.** Verbindung zu `wss://play.ws.autodarts.com/ms/v0/subscribe?code=<ticket>`; jedes Connect und Reconnect holt ein frisches Ticket über `/ms/v0/tickets`.
- Alte Client-Credentials (`developer-darts-caller`, Client-Secret) in Config oder `.env` werden ignoriert und nicht mehr in die Config geschrieben.

### Added

- **Intent System** (`src/core/intents/`): semantische Intent-Schicht über dem
  EventBus für lose gekoppelte Inter-Modul-Kommunikation. Module emittieren
  Intents, andere reagieren konfigurierbar. Die abgeleiteten/analytischen
  Intents lagen im Player-Analytics-Modul und sind mit diesem entfernt.
- **AI-Subsystem** (`src/core/ai/`): Provider-Abstraktion für Anthropic, OpenAI,
  Ollama, Replicate, Runway, Stability AI und ElevenLabs.
- **Media Library & Animation Generator** (`src/core/media/`): Medienverwaltung,
  Upload und AI-gestützte Animationsgenerierung.
- **Autodarts Trainer**: Trainingscoach mit Echtzeit-Empfehlungen und
  Performance-Analyse (eigenes Repo `autodarts-trainer-module`).
- **MQTT-Modul**: publiziert Spielereignisse an einen MQTT-Broker
  (Home Assistant, Node-RED), eigenes Repo `autodarts-mqtt-module`.
- **Developer-Modus** mit Event-Simulation.
- **Module SDK** (`module-sdk/`): eigenes Paket für SDK-konforme Module.

### Changed

- Modul-spezifischer Code in die jeweiligen Modul-Verzeichnisse verschoben.
- Trennung `modules/` (Entwicklung) und `modules_installed/` (Laufzeit).

### Fixed

- Authentifizierung am AI-Provider-Options-Endpoint ergänzt.
- `timeSpent`-Berechnung in Trainer Pause/Resume korrigiert.
- Veraltete `substr()`-Aufrufe durch `substring()` ersetzt.
- Veraltete Tests für ConfigService (ENV-Credentials) und ModuleInstaller
  repariert; Testsuite wieder vollständig grün.
- ESLint lintet Testdateien über `tsconfig.eslint.json` (keine Parse-Fehler mehr).

### Security

- ModuleInstaller nutzt `execFile` ohne Shell; Git-URL und Branch können keine
  Shell-Befehle mehr einschleusen.
- Modul-IDs und Repository-Namen werden validiert; `uninstall('../..')` kann
  nicht mehr außerhalb des Modulverzeichnisses löschen.
- Nur noch lokale Origins: CORS-Allowlist (localhost, private IPv4/IPv6-Netze, Hostnamen ohne Punkt, `.local`, `.lan`, `.home.arpa`, `.fritz.box`) und 403 für Requests fremder Origins, inklusive WebSocket-Upgrade.
- npm läuft unter Windows über `cmd.exe` statt `shell: true`.

### Removed

- Player-Analytics-Modul (bereits in `834a14d`), toter Autostart-Eintrag dazu.
- Ungenutzte WLED-Zweitimplementierung (`EventMapper`, `WledClient`).
- Legacy-Beispielmodule `example-caller` und `ai-coach-backup-old`.
- Prototyp `index.js` (enthielt Klartext-Zugangsdaten) und Ad-hoc-Playwright-Skripte im Root.
- Versehentlich committete Build-Artefakte in `src/types/` und `test/`.

## [1.1.0] - 2026-04-03

### Added

#### Game Display Module - Player-Specific Animations
- **New "Players" configuration tab** for configuring individual animations per player
- Players can have unique animations for the following events:
  - **180**: Custom animation when the player throws 180
  - **Leg Win**: Custom animation when the player wins a leg
  - **Set Win**: Custom animation when the player wins a set
  - **Match Win**: Custom animation when the player wins the match
  - **Checkout**: Custom animation when the player checks out
- **Multiple media types supported**: Built-in animations, GIF, Video
- **Custom sound support**: Each animation can have its own sound file (MP3, WAV, etc.)
- **Override mechanism**: Player-specific animations override global animations when that player is on throw
- **Fallback system**: If no player animation is configured, the global animation is used

#### Win Animation System
- **Configurable win animations** for Leg Win, Set Win, and Match Win events
- **Win animation options**:
  - Show Winner Name - Displays the player's name
  - Show Statistics - Displays Average, Darts, Checkout%, 180s
  - Effect - None / Confetti / Fireworks / Sparkles
  - Background Color - Configurable background color
  - Text Color - Configurable text color
- **Correct winner name resolution** from Autodarts match data at the moment of leg win

#### Animation System Enhancements
- Extended animation events: 180, Bull, Double Bull, High Score, Bust, Checkout, Leg Win, Set Win, Match Win
- Configurable high score threshold (default: 140)
- Improved animation triggering based on player identification (by ID, name, or index)

#### Match Results Display
- **Match results table** with chalkboard and statistics after match ends
- **Configurable display duration**: auto-hide after X seconds or manual dismiss
- Statistics include: Average, Darts thrown, Checkout percentage, 180s count

### Changed

- Enhanced `GameDisplayHandler` to support player-specific animation resolution
- Updated configuration UI with new "Players" tab for animation management
- Improved animation lookup logic: searches by player ID first, then by name, then by index
- Win animation now shows correct player name from the Autodarts event data

### Fixed

- **Leg win animation** now shows the correct winner name (fetched from Autodarts data at the moment of win)
- Player identification during win events now uses data from the current match state

### Technical Details

- New types: `PlayerAnimationConfig`, `PlayerAnimations` in `modules/game-display/src/types.ts`
- New function: `resolveAnimation()` for determining the correct animation based on event and player
- Player animations are stored in `config.playerAnimations[]` array
- Win animation configuration stored in `config.legWin`, `config.setWin`, `config.matchWin`

---

## [1.0.0] - 2026-03-30

### Added

- Win animation system with configurable effects
- Module configuration UI improvements
- Comprehensive documentation

### Previous Releases

See git history for changes before version 1.0.0.
