# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Linux-Dateien für einen eigenen Board-PC** (`scripts/linux/`): systemd-User-Service für den Hub und Autostart des Game Displays im Firefox-Kioskmodus.
- **Higgsfield als AI-Provider** mit vollständigem Text-Katalog (20 Video-, 10 Bildmodelle aus docs.higgsfield.ai, Default Kling 3.0 Standard und Soul Standard). Request-Body je Modell aus dem Schema (erlaubte Dauer, Seitenverhältnis, Batch-Größe, Ton aus über `sound` oder `generate_audio`), getrennte Auswahl für Video- und Bildmodell in den AI-Einstellungen. Zugang als `KEY_ID:KEY_SECRET`, kostenfreier Verbindungstest, Idempotency-Key gegen Doppelabrechnung.
- **Engine-Wahl im Animations-Generator** (Runway oder Higgsfield) in der Game-Display-Konfiguration, gespeichert in `config/animation-settings.json`, Routen `GET/PUT /api/animations/engine`.
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

- **Lizenz: PolyForm Noncommercial 1.0.0.** Frei für private und andere nicht-kommerzielle Nutzung, Ändern und Weitergeben eingeschlossen. Kommerzielle Nutzung nur mit separater Lizenz (info@castor.io). Das Module SDK steht unter MIT.
- **Dokumentation überarbeitet** (README, Installation inklusive Board-PC mit Autostart, Benutzerhandbuch, API, Entwickler- und SDK-Doku).
- Animations-Jobs bleiben bei der Engine, die sie gestartet hat; kurze Fehler beim Abfragen brechen bezahlte Jobs nicht mehr ab, Jobs geben nach 30 Minuten auf, Abbrechen wird bis zur Engine durchgereicht.
- Bestehende `ai-providers.json` bekommen neu hinzugekommene Provider automatisch ergänzt.
- **Autodarts-Login auf v2 umgestellt.** Der alte Keycloak-Login (`login.autodarts.io`) ist abgeschaltet. Der Hub meldet sich jetzt über `https://api.autodarts.com/auth/v1/login` an (Client-ID `autodarts-play`, per `AUTODARTS_CLIENT_ID` überschreibbar, kein Client-Secret mehr) und erneuert Tokens über `/auth/v1/refresh` (rotierende Refresh-Tokens, Neu-Login als Fallback).
- **AI-Provider aktualisiert.** Claude: Standard `claude-opus-5` (Claude 3.5 Sonnet war abgeschaltet), abgeschaltete IDs fallen auf den Standard zurück, `temperature`/`top_p` nur noch für Modelle, die sie akzeptieren, `effort: low` und mind. 1024 Tokens für Modelle mit Thinking, Refusal-Fallbacks. OpenAI: Modelle kommen live aus `GET /v1/models` des jeweiligen Keys (bevorzugt neueste), abgeschaltete Modelle (DALL-E, gpt-4o, o1/o3-mini/o4-mini, gpt-4.1-nano, tts-1) werden ersetzt, `max_completion_tokens` und `reasoning_effort` für Reasoning-Modelle, GPT Image ohne `response_format`. Neuer Endpunkt `GET /api/ai/providers/:id/models`; die Einstellungsseite zeigt die verfügbaren Modelle des Keys.
- **WebSocket per Ticket.** Verbindung zu `wss://play.ws.autodarts.com/ms/v0/subscribe?code=<ticket>`; jedes Connect und Reconnect holt ein frisches Ticket über `/ms/v0/tickets`.
- Alte Client-Credentials (`developer-darts-caller`, Client-Secret) in Config oder `.env` werden ignoriert und nicht mehr in die Config geschrieben.
- Modul-spezifischer Code in die jeweiligen Modul-Verzeichnisse verschoben.
- Trennung `modules/` (Entwicklung) und `modules_installed/` (Laufzeit).

### Fixed

- **Runway-Animationen funktionieren wieder.** Das fest eingestellte Modell `gen3a_turbo` gibt es in der Runway-API nicht mehr, außerdem wurde das in den AI-Einstellungen gewählte Modell ignoriert. Der Animations-Generator nutzt jetzt `POST /v1/text_to_video` ohne Platzhalterbild mit dem Modell aus den AI-Einstellungen (Standard Gen-4.5). Neuer Katalog mit allen 23 Text-zu-Video-Modellen der API (Gen-4.5, Veo 3.1, Kling, Seedance, WAN, Grok Imagine, Gemini Omni Flash, MiniMax, HappyHorse), der Request-Body wird je Modell gebaut: erlaubtes Seitenverhältnis passend zur Ausrichtung, Dauer gerundet bzw. begrenzt, Ton aus, Prompt auf die Höchstlänge gekürzt. Abgeschaltete oder unbekannte Modelle (Gen-3) fallen mit Logeintrag auf Gen-4.5 zurück. Die AI-Einstellungen zeigen die Runway-Modelle aus dem Katalog, auch ohne Schlüssel. Abbrechen nutzt `DELETE /v1/tasks/{id}`, der Status `THROTTLED` gilt als wartend, der Fortschritt wird von 0 bis 1 in Prozent umgerechnet.
- **Runway: keine doppelt berechneten Generierungen mehr.** `text_to_video` und `image_to_video` werden genau einmal gesendet, auch nach Serverfehler, Timeout oder Netzwerkfehler (Runway kann den Auftrag bereits gestartet haben). Die Fehlermeldung weist darauf hin, Statusabfragen werden weiter wiederholt. Gemeinsame Anfragelogik der AI-Provider: 4xx-Antworten werden nicht mehr wiederholt.
- **AI-Provider: kostenpflichtige Anfragen werden genau einmal gesendet.** Das gilt für OpenAI (Chat, Bild, Sprache, Embeddings), Anthropic (Messages), Replicate (Prediction anlegen), Stability AI (Bild, beide APIs) und ElevenLabs (Sprache). Nach Serverfehler, Timeout oder Netzwerkfehler kommt die Meldung "request failed (...); not retried", 4xx bleiben die Fehlermeldung des Anbieters. Abfragen wie Modelllisten, Status und Abbrechen werden weiter wiederholt, Ollama (lokal, kostenlos) ebenfalls.
- Veraltete Gen-3-Typen (`'gen3a_turbo' | 'gen3a'`) entfernt; `GET /api/settings` meldet für den alten Runway-Eintrag kein erfundenes `gen3a_turbo` mehr.
- **Animations-Generator:** Schlägt die Umwandlung in transparentes WebM fehl (z. B. weil ffmpeg fehlt), wird das Original als `.mp4` gespeichert statt als falsch benanntes `.webm`, ohne erneuten Download.
- Authentifizierung am AI-Provider-Options-Endpoint ergänzt.
- `timeSpent`-Berechnung in Trainer Pause/Resume korrigiert.
- Veraltete `substr()`-Aufrufe durch `substring()` ersetzt.
- Veraltete Tests für ConfigService (ENV-Credentials) und ModuleInstaller
  repariert; Testsuite wieder vollständig grün.
- ESLint lintet Testdateien über `tsconfig.eslint.json` (keine Parse-Fehler mehr).

### Security

- **Animations-Generator:** Der Event-Typ aus `POST /api/animations/generate` wird gegen die bekannten Typen geprüft, bevor er in einen Dateinamen gelangt; ffmpeg läuft per `execFile` ohne Shell. Vorher war Command Injection und Path Traversal aus dem lokalen Netz möglich.
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
