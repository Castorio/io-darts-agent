# IO-Darts-Agent: API Dokumentation

## Übersicht

Der IO-Darts-Agent bietet eine lokale REST API (Fastify) sowie einen WebSocket-Endpunkt für Echtzeit-Events. Die API ist ausschließlich für das lokale Netzwerk gedacht: Sie ist nicht für den Betrieb im öffentlichen Internet ausgelegt oder abgesichert.

Zusätzlich zu den pro Route genannten Prüfungen gelten für jede Route unten zwei unabhängige Schutzmechanismen:

- **Origin-Prüfung**: Jede Anfrage (inklusive des WebSocket-Upgrades) wird mit `403 Origin not allowed` abgelehnt, außer der `Origin`-Header ist leer (Same-Origin, curl usw.) oder löst zu einer privaten/lokalen Adresse auf (`127.0.0.1`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, Link-Local, `.local`/`.lan`/`.home.arpa`/`.fritz.box`, oder ein Hostname ohne Punkt).
- **CORS** spiegelt dieselbe Lokal-Origin-Prüfung.

**Base URL:** `http://<hub-host>:3000/api` (Standardport `3000`)

## Authentifizierung

Der IO-Darts-Agent hat einen optionalen Benutzername/Passwort-Login ("Web-Auth"), der im Setup oder unter **Einstellungen** konfiguriert wird. Ein einziger globaler Fastify-Hook (`onRequest`) läuft vor jeder Route unten und entscheidet, ob die Anfrage überhaupt bis zu ihrem Handler kommt:

- **Solange die Ersteinrichtung nicht abgeschlossen ist**: Nur `/api/setup/*`-Routen sind erreichbar, alles andere liefert `403`.
- **Web-Auth deaktiviert** (Standard): Jede Route ist für jeden Client im lokalen Netzwerk offen, kein Login nötig.
- **Web-Auth aktiviert**: Die Anfrage braucht ein gültiges `autodarts_session`-Cookie (gesetzt durch `POST /api/auth/login`), oder sie muss eine von wenigen fest hinterlegten, immer öffentlichen Routen sein: `GET /health`, `GET /api/auth/session`, `POST /api/auth/login`, `GET /api/setup/status`. Jede andere Route, auch unten mit `Public` markierte, liefert von diesem globalen Hook `401 Authentication required`, bevor ihr eigener Code überhaupt läuft.

Mit **Public** markierte Routen in den Tabellen unten haben keine zusätzliche, routenspezifische Session-Prüfung im eigenen Handler (sie verhalten sich also wie jede andere Route, wenn Web-Auth deaktiviert ist, und manche sind so geschrieben, als sollten sie ohne Login erreichbar sein, z.B. für eine Game-Display- oder WLED-Konfigurationsseite auf einem zweiten Gerät). Sie unterliegen trotzdem dem globalen Hook oben, **wenn Web-Auth aktiviert ist, benötigen auch sie eine gültige Session**. Das betrifft Darts Caller, TTS/Voice Pack, i18n, Logs, Medienauslieferung und die Modul-Konfigurationsendpunkte. `Public` bedeutet hier "keine zusätzliche routenspezifische Prüfung", nicht "immer ohne Login erreichbar". Mit **Session** markierte Routen führen zusätzlich ihre eigene `isAuthorized()`-Prüfung aus und liefern ohne Session einen für diese Route passend geformten `401`-Body.

`/api/developer/*` verlangt zusätzlich `developerMode: true` in den Hub-Einstellungen, sonst `403`.

## REST API

### Health

| Methode | Pfad | Auth | Beschreibung |
|---------|------|------|---------------|
| GET | `/health` | Public | Liveness-Check. Liefert `{ "status": "ok" }`. Liegt nicht unter `/api`. |

### Setup

| Methode | Pfad | Auth | Beschreibung |
|---------|------|------|---------------|
| GET | `/api/setup/status` | Public | Ob die Ersteinrichtung noch nötig ist. Antwort: `{ setupRequired, version }`. |
| POST | `/api/setup/test-connection` | Public | Testet Autodarts-Zugangsdaten vor dem Speichern. Body: `{ email, password, boardId }` (alle erforderlich). |
| POST | `/api/setup/complete` | Public | Speichert die Erstkonfiguration und markiert das Setup als abgeschlossen. Body: `{ autodarts: { email, password, boardId }, webAuth?: { enabled, username, password } }`. Liefert `400`, wenn das Setup bereits abgeschlossen ist. |

### Authentifizierung

| Methode | Pfad | Auth | Beschreibung |
|---------|------|------|---------------|
| GET | `/api/auth/session` | Public | Aktueller Session-Status: `{ authenticated, authRequired, username? }`. |
| POST | `/api/auth/login` | Public | Body: `{ username, password }`. Setzt bei Erfolg das `autodarts_session`-Cookie. Liefert `success: true` ohne Wirkung, wenn Web-Auth deaktiviert ist. |
| POST | `/api/auth/logout` | Public | Löscht das Session-Cookie. |
| POST | `/api/auth/change-password` | Session | Body: `{ currentPassword, newPassword }`. Erfordert eine authentifizierte Session und aktivierte Web-Auth. Der neue Hash wird in der Konfiguration gespeichert; scheitert das Speichern, bleibt das alte Passwort gültig und die Antwort ist `500`. Bestehende Sessions bleiben gültig. |

### Hub-Status & Verbindung

| Methode | Pfad | Auth | Beschreibung |
|---------|------|------|---------------|
| GET | `/api/status` | Session | Hub-Status: `{ version, uptime, setupCompleted, autodarts: { connected, userId?, boardId? }, modules: { total, running } }`. Nicht in der globalen Ausnahmeliste, daher bei aktivierter Web-Auth session-pflichtig, obwohl der Handler selbst nicht prüft. |
| POST | `/api/autodarts/connect` | Session | Löst einen Verbindungsversuch zur Autodarts-API aus. Liefert `400`, wenn das Setup nicht abgeschlossen ist. |
| POST | `/api/autodarts/disconnect` | Session | Löst eine Trennung von Autodarts aus. |

### Einstellungen

| Methode | Pfad | Auth | Beschreibung |
|---------|------|------|---------------|
| GET | `/api/settings` | Session | Gibt die Hub-Einstellungen zurück, Geheimnisse sind maskiert (Passwörter und API-Keys werden nie zurückgegeben, nur ob sie `configured` sind). |
| PUT | `/api/settings` | Session | Teilweise Aktualisierung. Body kann beliebige der Felder `language`, `server: { port, host }`, `webAuth: { enabled, username, password }`, `autodarts: { email, password, boardId }`, `aiProviders: { runway: { apiKey, model }, elevenlabs: { apiKey } }`, `developerMode` enthalten. Löst ein `settingsChanged`-Event auf dem Hub aus. |
| POST | `/api/settings/restart` | Session | Startet den Hub neu. Unter systemd oder in der Desktop-App beendet er sich mit Code 75 und wird wieder gestartet, sonst startet er eine abgelöste Kopie von sich selbst. |

### Match

| Methode | Pfad | Auth | Beschreibung |
|---------|------|------|---------------|
| GET | `/api/match/current` | Session | Vollständiger aktueller Match-Zustand (Spieler, Scores, Legs/Sets, Statistiken, Einstellungen) oder ein "inaktiv"-Zustand, wenn kein Match läuft. Enthält zusätzlich `cricket` (gleiche Form wie das `cricket.state`-Event, `null` außerhalb von Cricket/Tactics) und `turns` (Array mit der letzten Aufnahme). |
| GET | `/api/match/current/players` | Session | Schlanke Spielerliste mit Score und Average pro Spieler. |
| GET | `/api/match/current/scores` | Session | Nur Scores: `{ active, scores, gameScores, turnScore, currentPlayer }`. |
| GET | `/api/match/status` | Session | Match-Status aus dem zentralen `MatchStatusService` (inklusive Spielerfarben aus der lokalen Spielerdatenbank). |
| GET | `/api/match/status/active` | Session | Nur `{ active, matchId }`. |
| GET | `/api/match/status/player` | Session | Nur der aktuelle Spieler: `{ hasMatch, currentPlayer: { index, name, score, average, color? } }`. |

### Module

| Methode | Pfad | Auth | Beschreibung |
|---------|------|------|---------------|
| GET | `/api/modules` | Session | Liste der installierten Module mit Status. |
| GET | `/api/modules/:id` | Session | Details zu einem Modul (Manifest, Konfiguration, Status, Statistik). |
| GET | `/api/modules/:id/config` | **Public** | Nur die Konfigurationswerte, damit Modul-Frontends (die ohne eigene Session laufen) ihre Einstellungen laden können. |
| PUT | `/api/modules/:id/config` | Session | Body: `{ config: Record<string, unknown> }`. Ersetzt die gespeicherte Konfiguration des Moduls. |
| POST | `/api/modules/:id/start` | Session | Startet ein gestopptes Modul. |
| POST | `/api/modules/:id/stop` | Session | Stoppt ein laufendes Modul. |
| POST | `/api/modules/:id/restart` | Session | Startet ein Modul neu. |
| POST | `/api/modules/:id/update` | Session | Zieht den neuesten Git-Commit für das Modul und führt `npm install` aus. |
| POST | `/api/modules/install` | Session | Body: `{ source: 'git' \| 'local', url?, path?, branch? }` (`url` erforderlich bei `git`, `path` erforderlich bei `local`). Antwort: `{ success, moduleId }`. |
| DELETE | `/api/modules/:id` | Session | Deinstalliert ein Modul. |
| GET | `/api/modules/:id/translations/:language` | Session | Übersetztes Manifest/Strings für `language` (`en`, `de` oder `es`). |
| GET | `/api/modules/:id/languages` | Session | Für welche Sprachen das Manifest eines Moduls Übersetzungen bereitstellt. |
| GET | `/api/modules/:id/intents` | Session | Die Intent-Aktionen und Standard-Subscriptions des Moduls (aus seinem Manifest). |
| PUT | `/api/modules/:id/intents` | Session | Body: `{ subscriptions: Array<{ intentId, enabled, action: { type, config? } }> }`. Speichert Intent-Subscriptions in der Modul-Konfiguration. |
| GET | `/api/modules/:id/intent-subscriptions` | Session | Aktuell konfigurierte Intent-Subscriptions (fällt auf die Standardwerte des Manifests zurück). |
| GET | `/api/modules/:id/autostart` | Session | Ob das Modul mit dem Hub automatisch startet. |
| PUT | `/api/modules/:id/autostart` | Session | Body: `{ autostart: boolean }`. |
| GET | `/api/modules/autostart` | Session | Autostart-Flags für alle Module. |
| GET | `/api/modules/intents` | Session | Intent-Aktionen/Subscriptions für jedes installierte Modul, nach Modul-ID. |
| GET | `/api/intents` | Session | Kurzliste der Intents, die Module über `intents.emits` deklarieren (`id`, `description`, `category`, `sourceModule`). |
| GET | `/api/intents/available` | Session | Wie oben, aber mit vollständigem Payload-Schema pro Intent. |
| POST | `/api/modules/wled/test-action` | Session | Sendet einen einmaligen WLED-Befehl direkt (unabhängig von der Modul-Konfiguration). Body: `{ host, port?, actionType: 'preset' \| 'effect' \| 'solid' \| 'off', presetId?, effectId?, color?, color2?, color3?, brightness?, speed?, intensity? }`. |
| POST | `/api/modules/wled/test-connection` | Session | Body: `{ host, port? }`. Ruft `/json/info` des WLED-Geräts auf. |
| POST | `/api/modules/wled/presets` | Session | Body: `{ host, port? }`. Gibt die gespeicherten Presets des WLED-Geräts zurück. |
| POST | `/api/modules/wled/effects` | Session | Body: `{ host, port? }`. Gibt die Effektliste des WLED-Geräts zurück. |
| POST | `/api/modules/wled/palettes` | Session | Body: `{ host, port? }`. Gibt die Farbpaletten des WLED-Geräts zurück. |

Modul-UIs werden statisch unter `/module-ui/:moduleId/` ausgeliefert (z.B. `/module-ui/game-display/`), eigene API-Routen eines Moduls (über das Module SDK registriert) sind unter `/api/modules/:moduleId/routes/*` erreichbar; siehe [Module SDK](module-sdk.md).

### Modul-Store

| Methode | Pfad | Auth | Beschreibung |
|---------|------|------|---------------|
| GET | `/api/store` | Session | Katalog offiziell betreuter Module mit Installationsstatus: `{ available, error?, modules: Array<StoreModule & { installed, installedVersion }> }`. Ist der Katalog nicht erreichbar, liefert die Antwort `available: false` mit `error` (Status bleibt `200`). |
| POST | `/api/store/:id/install` | Session | Installiert ein Modul aus dem Katalog; Repository und Branch kommen ausschließlich aus dem Katalog-Eintrag, ein im Body mitgeschickter `url`/`branch` wird ignoriert. Antwort: `{ success, moduleId?, error? }`. `404` wenn `id` nicht im Katalog steht, `409` wenn das Modul bereits installiert ist, `503` wenn der Katalog gerade nicht erreichbar ist, `401` ohne gültige Session. |

Die Katalog-URL (Standard: `store/modules.json` im Repository [`Castorio/io-darts-agent`](https://github.com/Castorio/io-darts-agent), siehe [Module SDK](module-sdk.md#modul-in-den-store-aufnehmen)) lässt sich über die Umgebungsvariable `IO_DARTS_STORE_URL` überschreiben (nur `https:`).

### Spieler

| Methode | Pfad | Auth | Beschreibung |
|---------|------|------|---------------|
| GET | `/api/players` | Session | Liste der lokalen Spielerprofile. Query: `search?` (filtert nach Name/Alias). |
| GET | `/api/players/:id` | Session | Ein Spielerprofil. |
| POST | `/api/players` | Session | Body: `{ name, nickname?, color?, avatar?, autodartsUserId? }` (`name` erforderlich). `409` bei doppeltem Namen. |
| PUT | `/api/players/:id` | Session | Teilweise Aktualisierung derselben Felder. |
| DELETE | `/api/players/:id` | Session | Löscht ein Spielerprofil. |
| GET | `/api/players/:id/stats` | Session | Die aggregierten Statistiken des Spielers. |
| GET | `/api/players/:id/module-settings/:moduleId` | Session | Spieler- und modulspezifische Einstellungsüberschreibung (für spielerspezifische Animationen/Farben/Stimmen). |
| PUT | `/api/players/:id/module-settings/:moduleId` | Session | Body: `{ settings: Record<string, unknown> }`. |
| POST | `/api/players/match` | Session | Body: `{ name }`. Gleicht einen Autodarts-Spielernamen/Alias mit einem lokalen Profil ab: `{ matched, player? }`. |

### Internationalisierung (Hub-UI)

| Methode | Pfad | Auth | Beschreibung |
|---------|------|------|---------------|
| GET | `/api/i18n/languages` | Public | Aktuell gewählte Sprache plus Metadaten für alle unterstützten Sprachen. |
| GET | `/api/i18n/translations` | Public | Query: `lang?`. Vollständiges Übersetzungsbündel für eine Sprache (fällt auf die aktive Sprache zurück). |
| PUT | `/api/i18n/language` | Public | Body: `{ language }`. Speichert die Hub-UI-Sprache dauerhaft. |
| GET | `/api/i18n/t/:key` | Public | Query: `lang?`. Übersetzt einen einzelnen Schlüssel. |

### KI-Provider

Der Hub liefert Adapter für `elevenlabs`, `runway`, `higgsfield`, `openai`, `anthropic`, `stability`, `ollama` und `replicate` mit. Alle KI-Routen erfordern eine Session.

| Methode | Pfad | Auth | Beschreibung |
|---------|------|------|---------------|
| GET | `/api/ai/providers` | Session | Liste der konfigurierten Provider mit Fähigkeiten und ob ein API-Key gesetzt ist. |
| GET | `/api/ai/providers/:id` | Session | Details zu einem Provider. |
| GET | `/api/ai/providers/:id/status` | Session | Live-Status/Gesundheit eines Providers. |
| GET | `/api/ai/providers/:id/models` | Session | Text-Modelle, die der konfigurierte Key nutzen kann (`502` bei Fehler beim Upstream-Aufruf; nicht jeder Provider implementiert dies). |
| PUT | `/api/ai/providers/:id` | Session | Body: zu aktualisierende Provider-Konfigurationsfelder (API-Key, Modell, `enabled`, usw.). Wird auf Festplatte gespeichert. |
| POST | `/api/ai/providers/:id/enable` | Session | Kurzform für `PUT .../:id` mit `{ enabled: true }`. |
| POST | `/api/ai/providers/:id/disable` | Session | Kurzform für `PUT .../:id` mit `{ enabled: false }`. |
| GET | `/api/ai/capabilities` | Session | Alle Fähigkeiten (`text`, `image-generation`, `video-generation`, `audio-tts`, ...) und welche verfügbaren Provider sie jeweils anbieten. |
| GET | `/api/ai/provider-options` | Session | Query: `capability?`. Provider-Liste für ein `provider-select`-Konfigurationsfeld eines Moduls. |
| POST | `/api/ai/generate/text` | Session | Body: `{ providerId?, ...TextGenerationAPIRequest }`. Nutzt den Standard-Text-Provider, wenn `providerId` fehlt. |
| POST | `/api/ai/generate/image` | Session | Body: `{ providerId?, ...ImageGenerationAPIRequest }`. |
| POST | `/api/ai/generate/speech` | Session | Body: `{ providerId?, ...TTSAPIRequest }`. |
| POST | `/api/ai/generate/embeddings` | Session | Body: `{ providerId?, ...EmbeddingsAPIRequest }`. |
| GET | `/api/ai/jobs` | Session | Query: `status?`, `limit?` (Standard `100`). Liste asynchroner KI-Jobs. |
| GET | `/api/ai/jobs/:id` | Session | Status/Ergebnis eines Jobs. |
| POST | `/api/ai/jobs/:id/cancel` | Session | Bricht einen laufenden Job ab. |
| DELETE | `/api/ai/jobs/:id` | Session | Entfernt einen Job aus der Historie. |

### Animations-Generator

KI-generierte Celebration-Animationen (Runway oder Higgsfield) für Dart-Events.

| Methode | Pfad | Auth | Beschreibung |
|---------|------|------|---------------|
| GET | `/api/animations/status` | Session | `{ available, provider }`: ob ein Animations-Provider konfiguriert ist. |
| GET | `/api/animations/engine` | Session | `{ engine, engines: [{ id, name, available }] }`: welche Engine (`runway` oder `higgsfield`) aktiv ist und welche nutzbar sind. `404`, wenn die Engine-Auswahl nicht verdrahtet ist. |
| PUT | `/api/animations/engine` | Session | Body: `{ engine: 'runway' \| 'higgsfield' }`. Wechselt die aktive Engine. |
| GET | `/api/animations/styles` | Session | Mitgelieferte Style-Presets. |
| GET | `/api/animations/events` | Session | Dart-Event-Typen, für die eine Animation generiert werden kann. |
| POST | `/api/animations/generate` | Session | Body: `{ eventType, styleId? \| customStyle?: { name, prompt }, customPrompt?, options? }`. Startet einen einzelnen Generierungs-Job. |
| POST | `/api/animations/generate-batch` | Session | Body: `{ styleId? \| customStyle?, eventTypes?, options? }`. Startet einen Job pro Event-Typ. |
| GET | `/api/animations/jobs` | Session | Query: `status?`. Liste der Generierungs-Jobs. |
| GET | `/api/animations/jobs/:id` | Session | Status/Ergebnis eines Jobs. |
| DELETE | `/api/animations/jobs/:id` | Session | Bricht den Job ab, falls noch laufend, sonst wird er gelöscht. |
| POST | `/api/animations/jobs/clear` | Session | Löscht alle abgeschlossenen Jobs; liefert `{ cleared }`. |

### Medienbibliothek

Speichert hochgeladene/generierte Animationen, Sounds und Bilder, die von Modulen genutzt werden. `:type` ist `animation`, `sound` oder `image`.

| Methode | Pfad | Auth | Beschreibung |
|---------|------|------|---------------|
| GET | `/api/media/:type` | Session | Query: `folder?` (`*` listet rekursiv). Listet Dateien dieses Typs. |
| GET | `/api/media/:type/folders` | Session | Listet Ordner dieses Typs. |
| POST | `/api/media/:type/folders` | Session | Body: `{ path }`. Erstellt einen Ordner. |
| DELETE | `/api/media/:type/folders/:path` | Session | Löscht einen Ordner; schlägt fehl, wenn nicht leer. |
| POST | `/api/media/:type/upload` | Session | Query: `folder?`. Multipart-Datei-Upload (max. 50 MB, MIME-Typ wird je Medientyp geprüft). |
| POST | `/api/media/:type/move` | Session | Body: `{ filename, fromFolder?, toFolder? }`. |
| DELETE | `/api/media/:type/:filename` | Session | Query: `folder?`. Löscht eine Datei. |
| GET | `/api/media/files/:type/:filename` | **Public** | Liefert eine Datei aus dem Root-Ordner des Typs (zum Einbetten in Displays). Ein Jahr Cache. |
| GET | `/api/media/files/:type/*` | **Public** | Gleiches für eine Datei in einem verschachtelten Ordner (letztes Pfadsegment ist der Dateiname). |
| GET | `/api/media/info` | **Public** | `{ maxFileSize, allowedTypes }` je Medientyp. |

### Text-to-Speech & Voice Packs

Routen unter `/api/tts/*` haben keine routenspezifische Session-Prüfung (`Public` unten). Bei aktivierter Web-Auth verlangt der globale Hook (siehe [Authentifizierung](#authentifizierung)) trotzdem eine Session.

| Methode | Pfad | Auth | Beschreibung |
|---------|------|------|---------------|
| GET | `/api/tts/elevenlabs/voices` | Public | Erfordert einen konfigurierten ElevenLabs-API-Key. |
| GET | `/api/tts/elevenlabs/voice/:voiceId` | Public | Details zu einer Stimme. |
| GET | `/api/tts/elevenlabs/subscription` | Public | ElevenLabs-Account-/Abo-Informationen. |
| POST | `/api/tts/elevenlabs/generate` | Public | Body: `{ text, voiceId? }`. Liefert Base64-Audio zum schnellen Testen. |
| GET | `/api/tts/elevenlabs/cache/stats` | Public | Größe/Anzahl Einträge des TTS-Caches. |
| DELETE | `/api/tts/elevenlabs/cache` | Public | Leert den TTS-Cache. |
| GET | `/api/tts/elevenlabs/status` | Public | `{ available, configured, cache }`. |
| GET | `/api/tts/voicepacks` | Public | Listet generierte/importierte Voice Packs. |
| GET | `/api/tts/voicepacks/:packId` | Public | Infos zu einem Voice Pack. |
| DELETE | `/api/tts/voicepacks/:packId` | Public | Löscht ein Voice Pack. |
| GET | `/api/tts/voicepacks/generation/progress` | Public | Aktueller Generierungsfortschritt, falls vorhanden. |
| GET | `/api/tts/voicepacks/generation/status` | Public | Kombinierter Status: Verfügbarkeit des Generators, Fortschritt und vorhandene Packs. |
| POST | `/api/tts/voicepacks/generate` | Public | Body: `{ packId, packName, voiceId, language, modelId?, stability?, similarityBoost? }` (`language` muss `en` oder `de` sein). `409`, wenn bereits eine Generierung läuft. |
| POST | `/api/tts/voicepacks/generation/cancel` | Public | Bricht die laufende Generierung ab. |
| GET | `/api/tts/voicepacks/:packId/download` | Public | Lädt das Pack als ZIP herunter. |
| POST | `/api/tts/voicepacks/upload` | Public | Multipart-Upload eines Voice-Pack-ZIP; wird serverseitig extrahiert und importiert. |

### Darts Caller

Routen unter `/api/caller/*` haben keine routenspezifische Session-Prüfung (`Public` unten). Bei aktivierter Web-Auth verlangt der globale Hook (siehe [Authentifizierung](#authentifizierung)) trotzdem eine Session.

| Methode | Pfad | Auth | Beschreibung |
|---------|------|------|---------------|
| GET | `/api/caller/config` | Public | Konfiguration des laufenden Caller-Moduls. `503`, wenn das Modul nicht läuft. |
| GET | `/api/caller/stats` | Public | Caller-Statistiken (generierte Ansagen, nach Backend). |
| POST | `/api/caller/stats/reset` | Public | Setzt die Statistik zurück. |
| GET | `/api/caller/voices` | Public | Platzhalter; die tatsächlichen TTS-Stimmen kommen aus der `speechSynthesis`-API des Browsers. |
| POST | `/api/caller/test` | Public | Body: `{ score? }` (Standard `180`). Löst eine echte Test-Ansage über die Event-Pipeline des Callers aus. |
| GET | `/api/caller/audio-packs` | Public | Platzhalter-Liste von Audio-Packs. |
| GET | `/api/caller/audio/status` | Public | Aktueller Wiedergabestatus/Warteschlange. |
| POST | `/api/caller/audio/stop` | Public | Stoppt die Wiedergabe und leert die Warteschlange. |
| POST | `/api/caller/audio/skip` | Public | Springt zum nächsten Eintrag in der Warteschlange. |
| GET | `/api/caller/voicepacks` | Public | Für das Caller-Modul verfügbare Voice Packs. |

### Autodarts Trainer

Eigene Endpunkte für das Autodarts-Trainer-Modul.

| Methode | Pfad | Auth | Beschreibung |
|---------|------|------|---------------|
| GET | `/api/trainer/session` | Session | Aktuelle Trainingssession oder `null`. |
| POST | `/api/trainer/session/start` | Session | Body: `TrainingSessionConfig` (`type`, `difficulty` erforderlich). Validierung per JSON-Schema. |
| POST | `/api/trainer/session/pause` | Session | Pausiert die aktive Session. |
| POST | `/api/trainer/session/resume` | Session | Setzt eine pausierte Session fort. |
| POST | `/api/trainer/session/end` | Session | Beendet die Session und liefert die finale Statistik. |
| POST | `/api/trainer/session/throw` | Session | Body: `{ number, multiplier, isHit? }`. Erfasst einen Wurf gegen das aktuelle Ziel. |
| GET | `/api/trainer/routines` | Session | Mitgelieferte und eigene Übungsroutinen. |
| GET | `/api/trainer/routines/:id` | Session | Eine Routine. |
| POST | `/api/trainer/routines` | Session | Body: `{ name, description, type, difficulty, duration, targets }`. Erstellt eine eigene Routine. |
| DELETE | `/api/trainer/routines/:id` | Session | Löscht eine eigene Routine (mitgelieferte können nicht gelöscht werden). |
| POST | `/api/trainer/routines/:id/start` | Session | Startet eine Session aus einer Routine. |
| GET | `/api/trainer/history` | Session | Query: `limit?` (Standard `20`), `offset?`, `type?`. |
| GET | `/api/trainer/stats` | Session | Query: `period?` (`day` \| `week` \| `month` \| `all`, Standard `all`). Aggregierte Statistik über die Historie. |

Session-, Routinen- und Historien-Daten liegen nur im Arbeitsspeicher des laufenden Hub-Prozesses und werden bei einem Neustart zurückgesetzt.

### Entwicklermodus

Erfordert sowohl eine authentifizierte Session (falls Web-Auth aktiviert ist) **als auch** `developerMode: true` in den Einstellungen. Damit lassen sich Autodarts-Matches ohne physisches Board simulieren, um Module zu testen.

| Methode | Pfad | Auth | Beschreibung |
|---------|------|------|---------------|
| GET | `/api/developer/status` | Session + Dev-Modus | Ob der Entwicklermodus aktiv ist und ob ein simuliertes Match läuft. |
| POST | `/api/developer/simulate/match/start` | Session + Dev-Modus | Body: `{ players?: [{ name, color? }], startScore? }`. Löst `match.start` und danach `match.state` aus. |
| POST | `/api/developer/simulate/match/end` | Session + Dev-Modus | Body: `{ winner?, cancelled? }`. Löst `match.finished` oder `match.delete` aus. |
| POST | `/api/developer/simulate/throw` | Session + Dev-Modus | Body: `{ number, multiplier }`. Löst `throw.detected` und ein aktualisiertes `match.state` aus. |
| POST | `/api/developer/simulate/turn/end` | Session + Dev-Modus | Löst `turn.finished`, `takeout.started` und (nach kurzer Verzögerung) `takeout.finished`, `player.change` und `match.state` aus. |
| POST | `/api/developer/simulate/event` | Session + Dev-Modus | Body: `{ type, data? }`. Löst ein beliebiges Event eines `AutodartsEventType` aus. |
| GET | `/api/developer/scenarios` | Session + Dev-Modus | Mitgelieferte Szenarien: `180`, `bust`, `checkout`, `bullseye`, `full-leg`. |
| POST | `/api/developer/scenarios/:id/run` | Session + Dev-Modus | Führt eines der obigen Szenarien aus. |

### Logs

| Methode | Pfad | Auth | Beschreibung |
|---------|------|------|---------------|
| GET | `/api/logs` | Public | Letzte Log-Historie (dieselben Einträge, die als `log`-WebSocket-Nachrichten gestreamt werden). |

## WebSocket API

### Verbindung

**URL:** `ws://<hub-host>:3000/api/events`

Erfordert ein gültiges `autodarts_session`-Cookie, wenn Web-Auth aktiviert ist; der Server schließt die Verbindung sonst mit Code `4001`. Es gibt keinen separaten Server-Sent-Events-Endpunkt. Alle Live-Daten (Events, Logs, Modul-Status, Caller-Ansagen, Voice-Pack-Fortschritt) laufen über diesen einen WebSocket.

### Nachrichtenformat

Alle Nachrichten sind JSON-kodiert und haben jeweils ein `type`-Feld.

### Client zu Server

| Typ | Payload | Beschreibung |
|-----|---------|---------------|
| `ping` | - | Der Server antwortet mit `{ "type": "pong", "timestamp": <ms> }`. |
| `subscribe` | `{ events: string[] }` | Ersetzt die Subscription-Menge des Clients (Standard ist `*`, also alles). |
| `unsubscribe` | `{ events: string[] }` | Entfernt Event-Typen aus der Subscription-Menge. |

### Server zu Client

| Typ | Form | Beschreibung |
|-----|------|---------------|
| `status` | `{ status: { connected, matchId? } }` | Wird sofort bei Verbindungsaufbau gesendet, danach erneut bei jeder Änderung des Hub-Verbindungsstatus. |
| `event` | `{ event: { type, timestamp, data } }` | Ein geparstes Autodarts-Event (siehe [Autodarts Events](#autodarts-events) unten). |
| `log` | `{ entry: { id, timestamp, type, source, message, data? } }` | Eine Log-Zeile für die Live-Log-Ansicht. |
| `module` | `{ moduleId, status, message? }` | Der Laufstatus eines Moduls hat sich geändert (`running`, `stopped`, `error`). |
| `voicepack_progress` | `{ progress: { status, packId, packName, voiceId, totalFiles, completedFiles, currentFile?, error?, ... } }` | Fortschritt der Voice-Pack-Generierung. |
| `caller` | `{ request: CallRequest, callerType? }` | Eine Darts-Caller-Ansage zur Wiedergabe im Browser: `CallRequest` hat `id`, `type`, `text`, `score?`, `playerName?`, `remaining?`, `audioUrl?`, `audioFile?`, `priority`, `timestamp`. |

## Autodarts Events

`event.type` ist einer aus einer festen Menge (`AutodartsEventType`). Manche werden von Autodarts weitgehend unverändert weitergeleitet ("nativ"), andere werden vom `EventParser` des Hubs aus `match.state`-Updates abgeleitet ("synthetisch").

### Nativ

| Event | Wann | Wichtige Daten |
|-------|------|-----------------|
| `board.state` | Board verbindet/trennt sich | Board-Verbindungsinfo |
| `board.event` | Jedes andere rohe Board-Event | eventspezifisch |
| `match.start` | Ein Match beginnt | `matchId`, `boardId` |
| `match.delete` | Ein Match wird abgebrochen | `matchId`, `boardId` |
| `match.finish` | Benutzer schließt die Ergebnisanzeige | `matchId`, `boardId` |
| `match.state` | Jedes Match-Status-Update | `matchId`, `player`, `gameScores`, `round`, `leg`, `set`, `players`, `settings`, ... |
| `throw.detected` | Ein Wurf wird gewertet | `segment`, `coords?`, `throwNumber`, `boardId`, `points`, `turnPoints`, `busted`, `turnId` (die letzten vier nur bei Würfen aus `match.state`); in Cricket/Tactics zusätzlich `marks`, `turnMarks` |
| `takeout.started` | Die Pfeile werden gezogen | `boardId` |
| `takeout.finished` | Die Pfeile wurden gezogen | `boardId` |

### Synthetisch (aus `match.state` abgeleitet)

| Event | Wann | Wichtige Daten |
|-------|------|-----------------|
| `player.change` | Der aktive Spieler-Index ändert sich | `previousPlayer`, `currentPlayer`, `playerIndex`, `playerName`, `remaining` |
| `turn.finished` | 3 Darts geworfen, ein Bust oder ein Rundenwechsel | `matchId`, `playerIndex`, `playerName`, `turnScore`, `busted`, `remaining`, `round`, `throws`; in Cricket/Tactics zusätzlich `turnMarks` |
| `game.finished` | Ein Leg wird gewonnen | `matchId`, `winner`, `winnerName`, `winnerPlayerIndex`, `leg`, `set`, `players`, `scores` |
| `match.finished` | Das Match wird gewonnen | `matchId`, `winner`, `winnerName`, `winnerPlayerIndex`, `players`, `scores` |
| `match.result` | Wird direkt nach `match.finished` gesendet | `winner`, `winnerName`, `chalkboards`, `stats`, `scores`, `settings` |
| `cricket.state` | Treffer oder Punkte ändern sich (Cricket/Tactics) | `matchId`, `set`, `leg`, `mode`, `cutThroat`, `fields`, `deadFields`, `players[].{index,name,points,marks}` |
| `cricket.closed` | Ein Spieler schließt ein Feld mit dem dritten Treffer (Cricket/Tactics) | `matchId`, `set`, `leg`, `field`, `playerIndex`, `playerName` |

`raw` wird für alles verwendet, was der Parser sonst nicht erkennt.

**Hinweis zu `game`:** `match.state`, `throw.detected`, `turn.finished`, `player.change`, `game.finished`, `match.finished`, `match.result`, `cricket.state` und `cricket.closed` tragen zusätzlich `data.game: { variant: string; mode: 'x01' | 'cricket' | 'tactics' | 'other'; cutThroat: boolean }`. `match.start`, `match.delete` und `match.finish` tragen kein `game`.

**Hinweis:** Einzelne Module (zum Beispiel WLED) leiten intern noch eigene Unter-Schlüssel ab, etwa `throw.triple`, `throw.double`, `throw.180`, `throw.bullseye`, aus den Daten eines `throw.detected`-Events, rein für ihre eigene Aktionskonfiguration pro Ereignis. Diese Unter-Schlüssel sind keine eigenständigen Events auf dem Bus oder im WebSocket; Details stehen im README des jeweiligen Moduls und im [Module SDK](module-sdk.md).

## Fehlerbehandlung

Die meisten Fehlerantworten folgen dieser Form, wobei die genauen Felder je Route variieren (manche verwenden `error`, andere `success: false` plus `error`/`message`):

```json
{
  "error": "Fehlermeldung",
  "success": false
}
```

### HTTP Status Codes

| Code | Bedeutung |
|------|-----------|
| 200 | Erfolg |
| 201 | Erstellt |
| 400 | Ungültige Anfrage (Validierungsfehler) |
| 401 | Nicht authentifiziert (Session erforderlich) |
| 403 | Verboten (nicht-lokale Origin oder Entwicklermodus deaktiviert) |
| 404 | Nicht gefunden |
| 409 | Konflikt (doppelter Name, Generierung läuft bereits) |
| 500 | Server-Fehler |
| 502 | Fehler beim Upstream-Provider |

## Modul-UI Routing

Module mit eigenem Frontend werden unter `/module-ui/:moduleId/` bereitgestellt:

- Game Display: `/module-ui/game-display/`
- Weitere Module mit UI folgen dem gleichen Muster.
