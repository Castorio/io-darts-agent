# IO-Darts-Agent: Installation

Diese Anleitung installiert IO-Darts-Agent aus dem Quellcode, auf einem normalen Rechner oder auf einem eigenen Board-PC neben der Dartscheibe.

> **Inoffizielles Projekt.** IO-Darts-Agent steht in keiner Verbindung zu Autodarts und wird von Autodarts weder unterstützt noch empfohlen.
>
> **Nur im lokalen Netzwerk.** Der Hub lauscht immer auf allen Netzwerkschnittstellen (`0.0.0.0`) und speichert dein Autodarts-Passwort im Klartext in seiner Konfigurationsdatei. Nutze ihn nur im Heimnetz. Gib den Port nicht ins Internet frei und richte keine Portweiterleitung ein.

---

## Inhalt

1. [Voraussetzungen](#voraussetzungen)
2. [Installation aus dem Quellcode](#installation-aus-dem-quellcode)
3. [Erste Konfiguration](#erste-konfiguration)
4. [Wo der Hub seine Daten speichert](#wo-der-hub-seine-daten-speichert)
5. [Eigener Board-PC (Linux)](#eigener-board-pc-linux)
6. [Aktualisieren](#aktualisieren)
7. [Logs](#logs)
8. [Fehlerbehebung](#fehlerbehebung)
9. [Deinstallation](#deinstallation)
10. [Desktop-Pakete](#desktop-pakete)

---

## Voraussetzungen

| Was | Hinweis |
|-----|---------|
| Node.js 22 oder neuer | Pflicht. `package.json` legt `"engines": { "node": ">=22" }` fest, und im Repository liegt eine `.nvmrc` mit `22`. |
| npm | Kommt mit Node.js. |
| git | Zum Klonen und Aktualisieren des Repositorys. |
| ffmpeg | Optional. Der Animationsgenerator wandelt damit erzeugte Videos in transparente WebM-Dateien um. Ohne ffmpeg bleibt das originale MP4 erhalten (ohne Transparenz). |
| Autodarts-Konto | Mit Anmeldung per E-Mail und Passwort. Das Board muss in Autodarts bereits eingerichtet und verbunden sein. |
| Board-ID | Die ID deines Autodarts-Boards. |

**Zur Autodarts-Anmeldung:** Der Hub meldet sich mit deiner Autodarts-E-Mail und deinem Passwort beim Autodarts-Anmeldedienst an (`https://api.autodarts.com/auth/v1`). Access Tokens werden automatisch erneuert. Der Dienst rotiert die Refresh Tokens, und wird eine Erneuerung abgelehnt, meldet sich der Hub neu an. Für Live-Ereignisse holt der Hub ein kurzlebiges Ticket von `https://play.ws.autodarts.com/ms/v0/tickets` und öffnet damit den Websocket `wss://play.ws.autodarts.com/ms/v0/subscribe`.

**Zwei-Faktor-Authentifizierung wird nicht unterstützt.** Der Hub hat keinen 2FA-Schritt. Ein Konto, das einen zweiten Faktor verlangt, kann sich nicht anmelden.

---

## Installation aus dem Quellcode

Die Installation aus dem Quellcode ist der unterstützte Weg, IO-Darts-Agent zu betreiben.

### 1. Repository klonen

```bash
git clone https://github.com/Castorio/io-darts-agent.git
cd io-darts-agent
```

Wenn du nvm nutzt, wählt `nvm use` Node 22 aus der `.nvmrc`.

### 2. Abhängigkeiten installieren

```bash
npm run setup
```

`npm run setup` installiert die Abhängigkeiten des Hubs, baut das Modul-SDK und installiert die Abhängigkeiten von `modules/wled`, `modules/darts-caller`, `web` und `modules/game-display/web`.

### 3. Bauen

```bash
npm run build:app
```

`npm run build:app` baut den Hub (TypeScript nach `dist/`), die Weboberfläche (`web/dist/`) und die Oberfläche des Game Displays (`modules/game-display/web/dist/`).

### 4. Starten

```bash
npm start
```

`npm start` führt `node dist/src/main.js` aus. In der Konsole erscheint `Server running at http://localhost:3000`. Beim ersten Start installiert der Hub die mitgelieferten Module (WLED, Darts Caller, Game Display) als Links auf die Module im Repository. Modul-Updates kommen so mit `git pull` an.

Öffne die Weboberfläche im Browser:

```
http://localhost:3000
```

Von einem anderen Gerät im selben Netz nimmst du die IP des Rechners, auf dem der Hub läuft, zum Beispiel `http://192.168.1.50:3000`.

---

## Erste Konfiguration

### Einrichtungsassistent

Solange keine Konfiguration existiert, öffnet die Weboberfläche den Einrichtungsassistenten (`/setup`). Bis die Einrichtung abgeschlossen ist, beantwortet die API nur die Einrichtungsrouten. Der Assistent hat drei Schritte:

1. **Web-Anmeldung:** Schütze die Weboberfläche optional mit Benutzername (mindestens 3 Zeichen) und Passwort (mindestens 6 Zeichen).
2. **Autodarts:** Trage deine Autodarts-E-Mail, dein Passwort und die Board-ID ein und teste die Verbindung.
3. **Abschluss:** Der Hub speichert die Konfiguration und verbindet sich mit Autodarts.

Danach meldet der Hub bei jedem Start `Configuration loaded - connecting to Autodarts...` und verbindet sich mit deinem Board. Zugangsdaten, Board-ID, Port und die Anmeldung der Weboberfläche kannst du später unter **Einstellungen** in der Weboberfläche ändern. Die Änderungen greifen nach einem Neustart des Hubs: Klicke im Bereich Server der Einstellungen auf **Hub neu starten**. Mit `npm start` gestartet, startet der Hub eine neue Instanz von sich selbst. Als systemd-Dienst oder in der Desktop-App beendet er sich mit Code 75, und Dienst oder App starten ihn wieder. Die Seite lädt neu, sobald der Hub antwortet, bei geändertem Port auf dem neuen Port.

### Konfigurationsdatei

Der Assistent schreibt **`dist/config/hub.config.json`**. Der Pfad wird relativ zum gebauten Code in `dist/src/` aufgelöst, nicht relativ zum aktuellen Arbeitsverzeichnis. Die Datei enthält dein Autodarts-Passwort im Klartext. Schütze sie deshalb:

```bash
chmod 600 dist/config/hub.config.json
```

`config/hub.config.example.json` im Repository zeigt das Format und dient als Vorlage zum Nachschlagen. Der Hub liest sie nicht.

| Feld | Bedeutung |
|------|-----------|
| `setupCompleted` | Nach dem Assistenten `true`. Mit `false` öffnet der Hub den Assistenten erneut. |
| `language` | Sprache der Oberfläche: `en`, `de` oder `es`. |
| `webAuth` | Optionale Anmeldung für die Weboberfläche (`enabled`, `username`, `passwordHash`). Ändere sie unter **Einstellungen**. Der Hub speichert das Passwort als bcrypt-Hash. |
| `autodarts.email`, `autodarts.password` | Deine Autodarts-Zugangsdaten. |
| `autodarts.boardId` | Die ID deines Autodarts-Boards. |
| `autodarts.clientId` | Optional. Standard ist `autodarts-play`. Lass das Feld weg. |
| `server.port` | HTTP-Port des Hubs. Standard `3000`. |
| `server.host` | Wird gespeichert, aber derzeit ignoriert. Der Hub bindet immer an `0.0.0.0`. |
| `developerMode` | Schaltet die Entwicklerwerkzeuge in der Weboberfläche ein. |

### API-Schlüssel für KI-Funktionen

Schlüssel für KI-Anbieter (OpenAI, Anthropic, Ollama, ElevenLabs, Stability AI, Runway, Higgsfield, Replicate) trägst du in der Weboberfläche unter dem Menüpunkt **AI Provider** in der Seitenleiste (`/ai-settings`) ein. Der Hub speichert sie in `dist/config/ai-providers.json` und legt diese Datei beim ersten Start mit Standardwerten an. Der Darts Caller (ElevenLabs-Stimme) und der Animationsgenerator (Runway, Higgsfield) lesen ihre Schlüssel von dort.

### Optional: .env-Datei

Der Hub lädt eine `.env`-Datei aus dem aktuellen Arbeitsverzeichnis. Für den normalen Betrieb ist sie nicht nötig. Diese Variablen wertet der Server tatsächlich aus:

| Variable | Wirkung |
|----------|---------|
| `PORT` | Port, der nur ohne Konfigurationsdatei (Einrichtungsmodus) gilt. |
| `IO_DARTS_DATA_DIR` | Ordner für Laufzeitdaten (`config/`, `data/`, `media/`, `modules_installed/`). Standard: `dist/`. Die Desktop-App setzt ihn auf den App-Datenordner des Benutzers. |
| `AUTODARTS_CLIENT_ID` | Überschreibt die OAuth-Client-ID. Nicht nötig. |
| `NODE_ENV` | `production` schaltet die Debug-Ausgabe des Intent-Bus ab. Auf das Session-Cookie wirkt es sich nicht aus: Das Cookie bekommt das `Secure`-Flag nur bei HTTPS-Anfragen, deshalb funktioniert die Web-Anmeldung auch über einfaches HTTP im LAN. |

`.env.example` nennt außerdem `SERVER_PORT`, `SERVER_HOST`, `AUTODARTS_EMAIL`, `AUTODARTS_PASSWORD` und `AUTODARTS_BOARD_ID`. `npm start` ignoriert sie. Port und Zugangsdaten kommen aus `dist/config/hub.config.json`.

---

## Wo der Hub seine Daten speichert

Beim Start aus dem Build liegen alle Laufzeitdaten unter `dist/`:

| Pfad | Inhalt |
|------|--------|
| `dist/config/hub.config.json` | Hauptkonfiguration einschließlich Autodarts-Passwort |
| `dist/config/ai-providers.json` | Einstellungen und API-Schlüssel der KI-Anbieter |
| `dist/config/players.json` | Spielerdatenbank |
| `dist/config/animation-settings.json` | Gewählte Animations-Engine |
| `dist/config/modules/` | Einstellungen der einzelnen Module |
| `dist/data/voicepacks/`, `dist/data/tts-cache/` | Sprachpakete und Sprach-Cache des Darts Callers |
| `dist/media/` | Medienbibliothek (Animationen, Sounds, Bilder) |
| `dist/modules_installed/` | Installierte Module (Links auf die mitgelieferten Module und installierte externe Module) |

Die Ordner `config/`, `data/` und `media/` im Hauptverzeichnis des Repositorys werden mit `npm start` zur Laufzeit nicht genutzt. `npm run dev` (Entwicklungsmodus) nutzt sie, zusammen mit `modules_installed/` im Hauptverzeichnis des Repositorys.

`dist/` steht in `.gitignore`. Das hält deine Daten aus git heraus, bedeutet aber auch: Jeder Befehl, der ignorierte Dateien aufräumt, löscht deine Konfiguration. Mach vor größeren Änderungen eine Sicherung:

```bash
tar czf ~/io-darts-agent-backup-$(date +%F).tar.gz \
  -C ~/io-darts-agent dist/config dist/data dist/media dist/modules_installed
```

---

## Eigener Board-PC (Linux)

Dieser Abschnitt richtet einen kleinen Linux-PC ein (zum Beispiel Linux Mint oder Ubuntu mit Xfce), der den Hub beim Booten startet und das Game Display im Vollbild auf einem Monitor neben dem Board zeigt. Die nötigen Dateien liegen im Repository unter `scripts/linux/`:

| Datei | Zweck |
|-------|-------|
| `io-darts-agent.service` | systemd-Benutzerdienst. Startet `/usr/bin/node dist/src/main.js` in `~/io-darts-agent` mit `NODE_ENV=production`, wartet vor dem Start, bis `api.autodarts.com` per DNS auflösbar ist (der Hub wiederholt eine fehlgeschlagene Anmeldung beim Start nicht), und startet bei Fehlern neu. Die Web-Anmeldung funktioniert trotzdem über einfaches HTTP, weil das Session-Cookie das `Secure`-Flag nur bei HTTPS-Anfragen bekommt. |
| `game-display-kiosk.sh` | Schaltet die Bildschirmabschaltung aus (X11, dazu Energieverwaltung und Bildschirmschoner von Xfce), wartet, bis der Hub antwortet, und öffnet dann Firefox im Kioskmodus auf `http://localhost:3000/module-ui/game-display/`. Die URL lässt sich mit `GAME_DISPLAY_URL` ändern. |
| `game-display-kiosk.desktop` | Autostart-Eintrag, der das Kiosk-Skript nach der Desktop-Anmeldung startet. |

Alle folgenden Befehle laufen als dein normaler Benutzer, außer dort, wo `sudo` steht.

### 1. Systempakete installieren

```bash
sudo apt update
sudo apt install -y git curl ffmpeg firefox unclutter-xfixes
```

`unclutter-xfixes` blendet den Mauszeiger auf dem Display aus. Unter Ubuntu kommt `firefox` eventuell als Snap. Das Kiosk-Skript braucht nur einen Befehl `firefox`.

### 2. Node.js 22 installieren

Ist schon Node.js 22 oder neuer unter `/usr/bin/node` installiert (`node -v`), überspringe diesen Schritt.

**Variante A, NodeSource (empfohlen für den Dienst):** installiert `node` nach `/usr/bin/node`. Genau diesen Pfad nutzt die Dienstdatei.

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v
```

**Variante B, nvm:** funktioniert auch, dann liegt `node` aber unter `~/.nvm/`. Ersetze in diesem Fall `/usr/bin/node` in der Dienstdatei durch die Ausgabe von `which node`.

### 3. Hub installieren

Der Dienst erwartet den Hub in `~/io-darts-agent`:

```bash
cd ~
git clone https://github.com/Castorio/io-darts-agent.git io-darts-agent
cd ~/io-darts-agent
```

Baue den Hub und teste einmal von Hand:

```bash
npm run setup
npm run build:app
npm start
```

Öffne `http://localhost:3000`, schließe den [Einrichtungsassistenten](#einrichtungsassistent) ab und beende den Hub mit `Strg+C`.

### 4. systemd-Benutzerdienst einrichten

```bash
mkdir -p ~/.config/systemd/user
cp ~/io-darts-agent/scripts/linux/io-darts-agent.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now io-darts-agent
systemctl --user status io-darts-agent
```

Damit der Dienst beim Booten startet, auch bevor sich jemand anmeldet:

```bash
sudo loginctl enable-linger "$USER"
```

### 5. Game-Display-Kiosk einrichten

```bash
mkdir -p ~/.local/bin ~/.config/autostart
cp ~/io-darts-agent/scripts/linux/game-display-kiosk.sh ~/.local/bin/
chmod +x ~/.local/bin/game-display-kiosk.sh
cp ~/io-darts-agent/scripts/linux/game-display-kiosk.desktop ~/.config/autostart/
```

Das Skript nutzt ein eigenes Firefox-Profil in `~/.local/share/game-display-kiosk`. Dein normales Firefox-Profil bleibt unberührt. Den Kioskmodus verlässt du mit `Alt+F4`.

Läuft der Hub auf einem anderen Port oder soll eine andere Seite erscheinen, setze `GAME_DISPLAY_URL` in der `Exec`-Zeile von `~/.config/autostart/game-display-kiosk.desktop`:

```ini
Exec=env GAME_DISPLAY_URL=http://localhost:3001/module-ui/game-display/ sh -c '"$HOME/.local/bin/game-display-kiosk.sh"'
```

### 6. Automatische Desktop-Anmeldung einschalten

Der Kiosk startet nach einer Desktop-Anmeldung. Der Board-PC sollte sich deshalb automatisch anmelden.

- **Linux Mint:** Öffne **Anmeldefenster**, gehe zu **Benutzer** und stelle die automatische Anmeldung für deinen Benutzer ein.
- **Ubuntu oder Xubuntu mit LightDM:** Lege `/etc/lightdm/lightdm.conf.d/50-autologin.conf` an (ersetze `dein-benutzer` durch deinen Benutzernamen):

```ini
[Seat:*]
autologin-user=dein-benutzer
```

Starte neu und prüfe, ob der Hub startet und das Game Display erscheint.

---

## Aktualisieren

### Normales Update (Quellcode-Installation und Board-PC)

```bash
cd ~/io-darts-agent
git pull
npm run setup
npm run build:app
systemctl --user restart io-darts-agent
```

Ohne Dienst beendest du den Hub statt der letzten Zeile mit `Strg+C` und startest ihn mit `npm start` neu.

Auf einem Board-PC, der vor dem Neustart-Button eingerichtet wurde, kopierst du die Dienstdatei noch einmal, damit der Hub mit `IO_DARTS_SUPERVISED=1` läuft (sonst kann **Hub neu starten** den Neustart nicht an systemd übergeben):

```bash
cp scripts/linux/io-darts-agent.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user restart io-darts-agent
```

`npm run build:app` entfernt zuerst den alten kompilierten Code in `dist/src` und `dist/modules` und baut dann nach `dist/`, `web/dist/` und `modules/game-display/web/dist/`. Deine Daten in `dist/config`, `dist/data`, `dist/media` und `dist/modules_installed` bleiben erhalten.

### Was du nicht tun darfst

- **Lösche niemals `dist/`** (zum Beispiel mit `rm -rf dist`) und führe niemals `git clean -x` oder `git clean -X` aus. `dist/` wird von git ignoriert und enthält deine Konfiguration und deine Daten.
- **Synchronisiere niemals das ganze Verzeichnis mit `rsync --delete`** von einem anderen Rechner. Auf der Quelle gibt es das `dist/config` des Ziels und die anderen Laufzeitordner nicht, deshalb löscht `--delete` die Laufzeitkonfiguration. Wenn du mit rsync verteilst, nimm die Laufzeitordner aus:

```bash
rsync -a --delete \
  --exclude node_modules --exclude dist \
  ./ board-pc:io-darts-agent/
```

---

## Logs

Mit dem systemd-Dienst:

```bash
journalctl --user -u io-darts-agent -f
```

Ohne Dienst landet das Log im Terminal, in dem `npm start` läuft. Die Weboberfläche zeigt außerdem eine Log-Ansicht unter **Konsole**.

---

## Fehlerbehebung

### Port 3000 ist schon belegt

Der Hub startet nicht und meldet "address already in use", der Dienst startet immer wieder neu.

```bash
ss -ltnp | grep 3000
```

Beende das andere Programm oder wähle einen anderen Port: Setze `server.port` in `dist/config/hub.config.json` (oder unter **Einstellungen** in der Weboberfläche) und starte den Hub neu. Auf dem Board-PC passt du außerdem die Kiosk-URL an (`GAME_DISPLAY_URL`, siehe oben).

### Die Autodarts-Anmeldung schlägt fehl

- `Login failed: invalid email or password`: Prüfe `autodarts.email` und `autodarts.password` in `dist/config/hub.config.json` oder unter **Einstellungen**. Melde dich mit denselben Daten einmal im Browser bei Autodarts an.
- Das Konto nutzt Zwei-Faktor-Authentifizierung: wird nicht unterstützt.
- Kein Netz oder DNS beim Booten: Der Dienst wartet, bis `api.autodarts.com` auflösbar ist. Prüfe das mit `getent hosts api.autodarts.com`. Der Hub wiederholt eine fehlgeschlagene Anmeldung beim Start nicht von selbst. Nachdem das Netz wieder geht, führe `systemctl --user restart io-darts-agent` aus.
- Nach einer Änderung von Zugangsdaten oder Board-ID in der Weboberfläche starte den Hub neu.

### Das Game Display bleibt schwarz oder zeigt nichts

- Das Kiosk-Skript wartet, bis der Hub unter der Display-URL antwortet. Öffnet sich Firefox gar nicht, ist der Hub nicht erreichbar. Prüfe `systemctl --user status io-darts-agent` und die Logs.
- Öffne `http://localhost:3000/module-ui/game-display/` von Hand. `Module UI not found` heißt, die Oberfläche des Game Displays wurde nicht gebaut: Führe `npm run setup` und `npm run build:app` aus. Wurde der Einrichtungsassistent nie abgeschlossen, bekommt das Display keine Daten. Öffne dann `http://localhost:3000` und schließe ihn ab.
- Ist die Modulliste in der Weboberfläche leer, suche im Log nach `Installed built-in module` oder `Built-in module not found`. Der Hub installiert die mitgelieferten Module nur, wenn `dist/modules_installed/` leer ist.
- Eine schwarze Fläche um Animationen statt Transparenz bedeutet, dass ffmpeg fehlt: `sudo apt install ffmpeg`. Ohne ffmpeg werden erzeugte Animationen als MP4 ohne Transparenz gespeichert.

### Der Darts Caller meldet, dass ElevenLabs nicht konfiguriert ist

Der Darts Caller nimmt den ElevenLabs-Schlüssel aus den KI-Einstellungen. Öffne **AI Einstellungen** (`/ai-settings`) in der Weboberfläche, trage den Schlüssel für ElevenLabs ein, aktiviere den Anbieter und starte danach das Modul Darts Caller (oder den Hub) neu.

---

## Deinstallation

Auf dem Board-PC:

```bash
systemctl --user disable --now io-darts-agent
rm ~/.config/systemd/user/io-darts-agent.service
systemctl --user daemon-reload
rm ~/.local/bin/game-display-kiosk.sh ~/.config/autostart/game-display-kiosk.desktop
rm -rf ~/.local/share/game-display-kiosk
sudo loginctl disable-linger "$USER"   # nur, wenn nichts anderes es braucht
```

Lass `disable-linger` weg, wenn weitere Benutzerdienste ohne Anmeldung laufen sollen. Das gilt besonders für den Autodarts-Dienst `autodarts.service` auf demselben PC: Ohne Linger startet er nach einem Neustart erst, wenn sich jemand anmeldet. Prüfen kannst du das mit `systemctl --user list-unit-files --state=enabled`.

Den Hub selbst entfernen (das löscht die Konfiguration und alle Daten, bei Bedarf vorher sichern):

```bash
rm -rf ~/io-darts-agent
```

Entferne `/etc/lightdm/lightdm.conf.d/50-autologin.conf` oder schalte die automatische Anmeldung im **Anmeldefenster** aus, wenn du sie nicht mehr willst. Node.js, ffmpeg und Firefox kannst du mit `apt` entfernen, wenn nichts anderes sie nutzt.

Auf anderen Systemen beendest du den Hub und löschst das geklonte Verzeichnis.

---

## Desktop-Pakete

Es gibt noch keine veröffentlichten Installer oder Desktop-Downloads. Die Electron-Desktop-App kannst du selbst aus dem Quellcode bauen. Sie enthält den Hub, die Weboberfläche und die eingebauten Module und braucht auf dem Zielrechner keine eigene Node.js-Installation. Der macOS-Build ist getestet, die Builds für Windows und Linux nicht.

Gebaut wird auf der Plattform, für die das Paket gedacht ist (auf dem Build-Rechner ist Node.js 22 nötig):

```bash
npm run setup        # Abhängigkeiten installieren (Hauptprojekt und Unterpakete)
npm run build:app    # Backend, Weboberfläche und Game-Display-UI bauen
npm run dist:mac     # oder: npm run dist:linux / npm run dist:win
```

Die Pakete landen in `releases/` (macOS: `.dmg` und `.zip`, Windows: NSIS-Installer und portable `.exe`, Linux: `.deb`, `.rpm` und AppImage). `npm run dist:*` führt `build:app` selbst noch einmal aus.

Die Desktop-App startet den Hub im Hintergrund, öffnet die Weboberfläche in einem eigenen Fenster und zeigt ein Tray-Symbol. Schließt du das Fenster, läuft der Hub weiter. **Quit** im Tray-Menü beendet ihn. Die App schreibt nicht in ihren Installationsordner. Konfiguration, Daten, Medien und installierte Module liegen im App-Datenordner des Benutzers:

| System | Datenordner |
|--------|-------------|
| macOS | `~/Library/Application Support/io-darts-agent/hub` |
| Windows | `%APPDATA%\io-darts-agent\hub` |
| Linux | `~/.config/io-darts-agent/hub` |

Die App nutzt Port 3000. Ist der Port belegt, starte sie mit der Umgebungsvariable `IO_DARTS_PORT` auf einem anderen Port. Der Einrichtungsassistent speichert den Port, auf dem der Hub läuft. Änderst du den Port später in den Einstellungen und startest den Hub neu, folgt die App automatisch.

Der macOS-Build ist nur ad hoc signiert und nicht notarisiert. Gatekeeper warnt deshalb beim ersten Start (mit Rechtsklick und **Öffnen** starten). Die früheren eigenständigen Binaries aus pkg sind entfernt.
