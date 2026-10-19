# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Modul-Store**: Unter **Module** zeigt der Button **Store** einen online geladenen Katalog offiziell betreuter Module (`GET /api/store`), mit Installationsstatus pro Modul und Installation per Klick (`POST /api/store/:id/install`), ohne Repository-URL von Hand einzugeben. Repository und Branch kommen dabei immer aus dem Katalog, nie vom Client. Der Katalog liegt in `store/modules.json`, Standard-Quelle ist `Castorio/io-darts-agent` auf GitHub (10 Minuten Cache), überschreibbar per `IO_DARTS_STORE_URL` (nur `https:`). Erster Katalog mit dem MQTT-Modul und dem Autodarts Trainer.
- **Ausbullen im Game Display**: Vor Online-Matches zeigt das Display die ganze Dartscheibe mit jedem Ausbull-Dart (Spielerfarbe, Linie zum Bull, Abstand in mm), die Rangliste und wer beginnt. Der Hub merkt sich die Würfe pro Spieler und veröffentlicht sie als `bullOff` in `match.state`.
- **Legs und Sets zählt der Hub selbst**, pro Spieler (stabil über `player.index`), auch über das Rotieren der Spieler zwischen den Legs hinweg. Ein korrigierter Checkout nimmt den Leg-Sieg zurück, beim Einstieg in ein laufendes Match zählt der Hub ab dem Stand von Autodarts. Veröffentlicht als `legsWon`/`setsWon` in `match.state`, `game.finished` und `/api/match/current`.

### Changed

- README weist auf den Beta-Status hin.
- Das Game Display nimmt Darts und Restpunkte nur noch aus dem Spielstand von Autodarts und zieht nicht mehr selbst ab.
- `match.state` enthält jetzt Legs/Sets zum Sieg (`legs`, `sets`), die Autodarts-`scores` und `gameFinished`; `/api/match/current` liefert `legs` und `sets`. `scores` sind als Legs/Sets pro Spieler typisiert, Restpunkte stehen in `gameScores`.

### Fixed

- **Modul-Installation mit kollidierender Manifest-ID**: Die Installation eines Moduls, dessen Manifest-`id` bereits registriert ist, wird jetzt abgelehnt (`409`), statt die bestehende Registrierung zu überschreiben.
- **Online-Matches mit Ausbullen**: Das Ausbullen (Variante "Bull-off") lief unter derselben Match-ID als "Leg 1" und verschluckte den Sieg des ersten X01-Legs. Es zählt nicht mehr als Leg und löst keine Leg-Animation und kein "Game Shot" mehr aus.
- **Spielerwechsel nach dem Leg**: Nach dem Rotieren der Spieler wurde der Startspieler des nächsten Legs nicht gemeldet; Display, WLED und Darts Caller blieben beim vorherigen Spieler, bis dieser geworfen hatte.
- **Farben von Spielern ohne Profil** (z. B. Online-Gegner) sind stabil und nie die Profilfarbe eines anderen Spielers; vorher wechselten sie mit dem Platz in der Liste. WLED sucht die Farbe zuerst über den Namen.
- **Spielinfo** zeigt die echten Legs zum Sieg statt immer "1 Leg".
- **Jeder Dart am eigenen Board kam doppelt an** (Board-Meldung und Spielstand); das Display zog dadurch kurz doppelt ab. Während eines Matches meldet der Hub jeden Dart nur noch einmal.
- Darts Caller las für "You require" die Legs/Sets statt der Restpunkte; der Simulator im Entwicklermodus schickt dasselbe Datenformat wie Autodarts.
- Leg- und Match-Gewinner bei Cricket und anderen Nicht-X01-Varianten nach dem Rotieren der Spieler: `gameWinner`/`winner` von Autodarts sind Array-Positionen (belegt mit einem aufgezeichneten Online-Match), nicht `player.index`.

## [1.0.1-beta] - 2026-10-18

### Fixed

- **Game Display nach einem beendeten Match**: Beim nächsten Match blieb der Gewinner des vorigen gespeichert, sodass das Display (etwa bei einem Solo-Spiel nach einem Spiel zu zweit) weiter den alten Spieler mit dessen Farbe zeigte. Ein neues Match (Start-Event oder neue Match-ID) setzt jetzt Gewinner, Spieler und Zähler zurück.

## [1.0.0] - 2026-10-18

Erste öffentliche Version (Beta).

### Added

- **Cricket im Game Display**: eigene Ansicht mit den Punkten des aktiven Spielers, Treffern pro Feld (20 bis 15 und Bull, bei Tactics 10 bis 20) als `/`, `X`, `⊗`, abgedunkelten toten Feldern und den Mitspielern am Rand. Neue Animationen "Feld geschlossen" und "Starke Aufnahme" (ab einstellbarer Zahl Marks, Standard 6); 180, High Score und Checkout sind bei Cricket aus.
- **Spielmodus und Cricket-Events für alle Module**: Match-Events tragen `game: { variant, mode, cutThroat }`, `throw.detected` zusätzlich `turnId`, `marks` und `turnMarks`, `turn.finished` `turnMarks`. Neue Events `cricket.state` (Treffer pro Spieler, tote Felder, Punkte) und `cricket.closed`; `/api/match/current` liefert `cricket` und die laufende Aufnahme. Typen im Module SDK.
- **WLED**: Effekt-Gruppe Cricket (Feld geschlossen, starke Aufnahme mit Schwelle); 180-Effekt bei Cricket aus.
- **Darts Caller**: Bei Cricket Ansagen "Zwanzig geschlossen!" bzw. "Twenty closed!" und "Sechs Marks!" für starke Aufnahmen, X01-Ansagen (Score, "You require", 180, Bust) dort aus. Neue Voice-Pack-Phrasen und Button "Fehlende Ansagen erzeugen", der nur fehlende Dateien erzeugt.
- **Desktop-App (Electron)** für macOS, Windows und Linux mit Hub, Weboberfläche und eingebauten Modulen; Daten im Benutzerordner. Installer werden per GitHub Actions bei jedem Versions-Tag gebaut, per Smoke-Test geprüft und als Release-Entwurf mit `SHA256SUMS.txt` bereitgestellt (unsigniert).
- **Hub-Neustart** aus der Oberfläche (unter systemd und in der Desktop-App).
- **Mediathek**: Vorschau-Fenster für Animationen, Bilder und Sounds, URL kopieren auch über HTTP im LAN.
- Diagnose: rohe Autodarts-Nachrichten lassen sich über `IO_DARTS_RECORD_FILE` mitschneiden.
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

- Darts-Caller-Seite und Handler nutzen eine gemeinsame Konfiguration (mit Migration alter Einstellungen).
- WLED-Fade-Zeiten in Millisekunden; die WLED-Seite verbindet sich selbst und lädt Presets und Effekte ohne Klick auf "Verbinden".
- Kiosk für den Board-PC blendet den Mauszeiger von Anfang an aus.
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

- Game Display: Spielinfo zeigt das echte Match-Format ("First to N Legs") und erkennt Modi unabhängig von der Schreibweise.
- Leg- und Match-Gewinner stimmen auch, nachdem Autodarts die Spieler für das nächste Leg rotiert hat; jede Wurf-Animation läuft einmal pro Aufnahme.
- WLED setzt die Spielerfarbe mit dem ersten Spielstand, auch bei Solo-Spielen.
- Weboberfläche und Game Display bauen nur noch eine WebSocket-Verbindung auf; Würfe werden nicht mehr doppelt gezählt.
- Modul-Installation von GitHub auf dem Board-PC (devDependencies, SDK-Link, Aufräumen nach Fehlern, einmaliger Start, echter Pfad bei Symlinks).
- Darts Caller: kein Rauschen unter Linux ohne `mpg123`, Fallback auf den nächsten Spieler.
- Kiosk-Skript legt sein Firefox-Profil selbst an.
- Status-Anzeigen der Weboberfläche sind übersetzt.
- Frische Installation aus dem Quellcode funktioniert (`npm run setup`, `npm run build:app`).
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

- Setup-Sperre ließ sich über kodierte Pfade (`/%61pi/...`) umgehen; geschlossen.
- `/module-ui/` liefert nur noch Dateien aus dem UI-Ordner des Moduls (vorher war `..%2f` bis zur `hub.config.json` möglich).
- Session-Cookie über HTTP im LAN ohne `Secure`-Flag, öffentliche Routen werden exakt verglichen.
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

### Frühere interne Stände

Die bisherigen internen Stände (vor dem öffentlichen Repository, Frühjahr 2026) sind in dieser Version enthalten:

- **Game Display: spielerspezifische Animationen** im Tab "Spieler" für 180, Leg-, Set- und Match-Sieg und Checkout, jeweils als Built-in, GIF oder Video mit eigenem Sound; ohne Eintrag gilt die globale Animation.
- **Gewinn-Animationen** für Leg, Set und Match mit Gewinnername, Statistiken (Average, Darts, Checkout-Quote, 180er), Effekt (Konfetti, Feuerwerk, Funken) sowie Hintergrund- und Textfarbe.
- **Animations-Events** 180, Bull, Double Bull, High Score (Schwelle einstellbar), Checkout, Überworfen, Leg-, Set- und Match-Sieg; Spielerzuordnung über ID, Name oder Index.
- **Ergebnistabelle** nach Match-Ende mit Chalkboard und Statistiken, Anzeigedauer einstellbar.
- Modul-Konfigurationsoberfläche und erste Dokumentation.

[Unreleased]: https://github.com/Castorio/io-darts-agent/compare/v1.0.1-beta...HEAD
[1.0.1-beta]: https://github.com/Castorio/io-darts-agent/compare/v1.0.0...v1.0.1-beta
[1.0.0]: https://github.com/Castorio/io-darts-agent/releases/tag/v1.0.0
