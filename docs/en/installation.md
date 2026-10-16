# IO-Darts-Agent: Installation

This guide installs IO-Darts-Agent from source, on a normal computer or on a dedicated board PC next to the dartboard.

> **Unofficial project.** IO-Darts-Agent is not affiliated with, endorsed by or supported by Autodarts.
>
> **Local network only.** The hub always listens on all network interfaces (`0.0.0.0`) and stores your Autodarts password in plain text in its config file. Use it in your home network only. Do not forward or expose the port to the internet.

---

## Contents

1. [Requirements](#requirements)
2. [Install from source](#install-from-source)
3. [First configuration](#first-configuration)
4. [Where the hub stores its data](#where-the-hub-stores-its-data)
5. [Dedicated board PC (Linux)](#dedicated-board-pc-linux)
6. [Updating](#updating)
7. [Logs](#logs)
8. [Troubleshooting](#troubleshooting)
9. [Uninstall](#uninstall)
10. [Desktop packages](#desktop-packages)

---

## Requirements

| What | Notes |
|------|-------|
| Node.js 22 or newer | Required. `package.json` declares `"engines": { "node": ">=22" }` and the repository contains a `.nvmrc` with `22`. |
| npm | Comes with Node.js. |
| git | To clone and update the repository. |
| ffmpeg | Optional. The animation generator uses it to turn generated videos into transparent WebM files. Without ffmpeg the original MP4 is kept (no transparency). |
| Autodarts account | With email and password login. The board must already be set up and connected in Autodarts. |
| Board ID | The ID of your Autodarts board. |

**About the Autodarts login:** The hub logs in with your Autodarts email and password against the Autodarts auth service (`https://api.autodarts.com/auth/v1`). Access tokens are refreshed automatically; the service rotates refresh tokens, and if a refresh is rejected the hub logs in again. For live events the hub requests a short lived ticket from `https://play.ws.autodarts.com/ms/v0/tickets` and opens the websocket `wss://play.ws.autodarts.com/ms/v0/subscribe` with it.

**Two-factor authentication is not supported.** The hub has no 2FA step, so an account that requires a second factor cannot log in.

---

## Install from source

Installing from source is the supported way to run IO-Darts-Agent.

### 1. Clone the repository

```bash
git clone https://github.com/Castorio/io-darts-agent.git
cd io-darts-agent
```

If you use nvm, `nvm use` picks Node 22 from `.nvmrc`.

### 2. Install dependencies

```bash
npm run setup
```

`npm run setup` installs the dependencies of the hub, builds the module SDK and installs the dependencies of `modules/wled`, `modules/darts-caller`, `web` and `modules/game-display/web`.

### 3. Build

```bash
npm run build:app
```

`npm run build:app` builds the hub (TypeScript to `dist/`), the web UI (`web/dist/`) and the Game Display UI (`modules/game-display/web/dist/`).

### 4. Start

```bash
npm start
```

`npm start` runs `node dist/src/main.js`. The console shows `Server running at http://localhost:3000`. On the first start the hub installs the built-in modules (WLED, Darts Caller, Game Display) as links to the modules in the repository, so module updates arrive with `git pull`.

Open the web UI in a browser:

```
http://localhost:3000
```

From another device in the same network use the IP of the computer running the hub, for example `http://192.168.1.50:3000`.

---

## First configuration

### Setup wizard

As long as no configuration exists, the web UI opens the setup wizard (`/setup`). Until the setup is finished, the API only answers the setup routes. The wizard has three steps:

1. **Web login:** optionally protect the web UI with a user name (at least 3 characters) and password (at least 6 characters).
2. **Autodarts:** enter your Autodarts email, password and board ID and test the connection.
3. **Finish:** the hub saves the configuration and connects to Autodarts.

After that the hub logs `Configuration loaded - connecting to Autodarts...` on every start and connects to your board. You can change the Autodarts credentials, the board ID, the port and the web UI login later under **Settings** in the web UI. These changes take effect after a restart of the hub: click **Restart hub** in the server section of the settings. Started with `npm start`, the hub launches a new copy of itself; as a systemd service or in the desktop app it exits with code 75 and the service or app starts it again. The page reloads once the hub answers, on the new port if you changed it.

### Config file

The wizard writes **`dist/config/hub.config.json`**. The path is resolved relative to the built code in `dist/src/`, not relative to the current working directory. The file contains your Autodarts password in plain text, so protect it:

```bash
chmod 600 dist/config/hub.config.json
```

`config/hub.config.example.json` in the repository shows the format and can serve as a reference. The hub does not read it.

| Field | Meaning |
|-------|---------|
| `setupCompleted` | `true` after the wizard. With `false` the hub opens the wizard again. |
| `language` | Language of the UI: `en`, `de` or `es`. |
| `webAuth` | Optional login for the web UI (`enabled`, `username`, `passwordHash`). Change it under **Settings**; the hub stores the password as a bcrypt hash. |
| `autodarts.email`, `autodarts.password` | Your Autodarts login. |
| `autodarts.boardId` | The ID of your Autodarts board. |
| `autodarts.clientId` | Optional. Defaults to `autodarts-play`. Leave it out. |
| `server.port` | HTTP port of the hub. Default `3000`. |
| `server.host` | Stored, but currently ignored: the hub always binds to `0.0.0.0`. |
| `developerMode` | Turns on the developer tools in the web UI. |

### API keys for AI features

Keys for AI providers (OpenAI, Anthropic, Ollama, ElevenLabs, Stability AI, Runway, Higgsfield, Replicate) are entered in the web UI under the sidebar entry **AI Provider** (`/ai-settings`). The hub stores them in `dist/config/ai-providers.json` and creates that file with defaults on first start. The Darts Caller (ElevenLabs voice) and the animation generator (Runway, Higgsfield) read their keys from there.

### Optional: .env file

The hub loads a `.env` file from the current working directory. For normal operation it is not needed. Variables the server actually evaluates:

| Variable | Effect |
|----------|--------|
| `PORT` | Port used only when no config file exists (setup mode). |
| `IO_DARTS_DATA_DIR` | Folder for runtime data (`config/`, `data/`, `media/`, `modules_installed/`). Default: `dist/`. The desktop app sets it to the per-user app data folder. |
| `AUTODARTS_CLIENT_ID` | Overrides the OAuth client id. Not needed. |
| `NODE_ENV` | `production` turns off debug output of the intent bus. It does not affect the session cookie: the cookie gets the `Secure` flag only for HTTPS requests, so the web login also works over plain HTTP in the LAN. |

`.env.example` also lists `SERVER_PORT`, `SERVER_HOST`, `AUTODARTS_EMAIL`, `AUTODARTS_PASSWORD` and `AUTODARTS_BOARD_ID`. `npm start` ignores them; the port and the credentials come from `dist/config/hub.config.json`.

---

## Where the hub stores its data

When started from the build, all runtime data lives below `dist/`:

| Path | Content |
|------|---------|
| `dist/config/hub.config.json` | Main configuration including the Autodarts password |
| `dist/config/ai-providers.json` | AI provider settings and API keys |
| `dist/config/players.json` | Player database |
| `dist/config/animation-settings.json` | Animation engine choice |
| `dist/config/modules/` | Settings of each module |
| `dist/data/voicepacks/`, `dist/data/tts-cache/` | Darts Caller voice packs and speech cache |
| `dist/media/` | Media library (animations, sounds, images) |
| `dist/modules_installed/` | Installed modules (links to built-in modules and installed external modules) |

The folders `config/`, `data/` and `media/` in the repository root are not used at runtime with `npm start`; `npm run dev` (development mode) uses them, together with `modules_installed/` in the repository root.

`dist/` is listed in `.gitignore`. This keeps your data out of git, but it also means that any command that cleans ignored files deletes your configuration. Make a backup before larger changes:

```bash
tar czf ~/io-darts-agent-backup-$(date +%F).tar.gz \
  -C ~/io-darts-agent dist/config dist/data dist/media dist/modules_installed
```

---

## Dedicated board PC (Linux)

This section sets up a small Linux PC (for example Linux Mint or Ubuntu with Xfce) that starts the hub at boot and shows the Game Display full screen on a monitor next to the board. The repository contains the needed files in `scripts/linux/`:

| File | Purpose |
|------|---------|
| `io-darts-agent.service` | systemd user service. Runs `/usr/bin/node dist/src/main.js` in `~/io-darts-agent` with `NODE_ENV=production`, waits until `api.autodarts.com` resolves in DNS before the start (the hub does not retry a failed start-up login), restarts on failure. The web login still works over plain HTTP, because the session cookie gets the `Secure` flag only for HTTPS requests. |
| `game-display-kiosk.sh` | Turns off screen blanking (X11, plus Xfce power manager and screensaver), waits until the hub answers, then opens Firefox in kiosk mode on `http://localhost:3000/module-ui/game-display/`. The URL can be changed with `GAME_DISPLAY_URL`. |
| `game-display-kiosk.desktop` | Autostart entry that runs the kiosk script after desktop login. |

All commands below run as your normal user, except where `sudo` is shown.

### 1. Install system packages

```bash
sudo apt update
sudo apt install -y git curl ffmpeg firefox
```

On Ubuntu `firefox` may be installed as a snap. The kiosk script only needs a `firefox` command.

### 2. Install Node.js 22

**Option A, NodeSource (recommended for the service):** installs `node` to `/usr/bin/node`, which is the path the service file uses.

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v
```

**Option B, nvm:** works too, but `node` then lives below `~/.nvm/`. In that case replace `/usr/bin/node` in the service file with the output of `which node`.

### 3. Install the hub

The service expects the hub in `~/io-darts-agent`:

```bash
cd ~
git clone https://github.com/Castorio/io-darts-agent.git io-darts-agent
cd ~/io-darts-agent
```

Then build and test once by hand:

```bash
npm run setup
npm run build:app
npm start
```

Open `http://localhost:3000`, complete the [setup wizard](#setup-wizard), then stop the hub with `Ctrl+C`.

### 4. Install the systemd user service

```bash
mkdir -p ~/.config/systemd/user
cp ~/io-darts-agent/scripts/linux/io-darts-agent.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now io-darts-agent
systemctl --user status io-darts-agent
```

So the service starts at boot even before anyone logs in:

```bash
sudo loginctl enable-linger "$USER"
```

### 5. Install the Game Display kiosk

```bash
mkdir -p ~/.local/bin ~/.config/autostart
cp ~/io-darts-agent/scripts/linux/game-display-kiosk.sh ~/.local/bin/
chmod +x ~/.local/bin/game-display-kiosk.sh
cp ~/io-darts-agent/scripts/linux/game-display-kiosk.desktop ~/.config/autostart/
```

The script uses its own Firefox profile in `~/.local/share/game-display-kiosk`, so your normal Firefox profile stays untouched. To leave kiosk mode press `Alt+F4`.

If the hub runs on another port or you want a different page, set `GAME_DISPLAY_URL` in the `Exec` line of `~/.config/autostart/game-display-kiosk.desktop`:

```ini
Exec=env GAME_DISPLAY_URL=http://localhost:3001/module-ui/game-display/ sh -c '"$HOME/.local/bin/game-display-kiosk.sh"'
```

### 6. Turn on automatic desktop login

The kiosk starts after a desktop login, so the board PC should log in automatically.

- **Linux Mint:** open **Login Window**, go to **Users** and set automatic login for your user.
- **Ubuntu or Xubuntu with LightDM:** create `/etc/lightdm/lightdm.conf.d/50-autologin.conf` (replace `your-user` with your user name):

```ini
[Seat:*]
autologin-user=your-user
```

Reboot and check that the hub starts and the Game Display appears.

---

## Updating

### Normal update (source install and board PC)

```bash
cd ~/io-darts-agent
git pull
npm run setup
npm run build:app
systemctl --user restart io-darts-agent
```

Without the service, stop the hub with `Ctrl+C` and run `npm start` again instead of the last line.

The builds write into `dist/`, `web/dist/` and `modules/game-display/web/dist/` but do not delete existing files, so your data in `dist/config`, `dist/data`, `dist/media` and `dist/modules_installed` stays in place.

### What you must not do

- **Never delete `dist/`** (for example `rm -rf dist`) and never run `git clean -x` or `git clean -X`. `dist/` is ignored by git and holds your configuration and data.
- **Never sync the whole directory with `rsync --delete`** from another computer. The target's `dist/config` and the other runtime folders do not exist on the source, so `--delete` removes the runtime configuration. If you deploy with rsync, exclude the runtime folders:

```bash
rsync -a --delete \
  --exclude node_modules --exclude dist \
  ./ board-pc:io-darts-agent/
```

---

## Logs

With the systemd service:

```bash
journalctl --user -u io-darts-agent -f
```

Without the service the log goes to the terminal running `npm start`. The web UI also shows a log view under **Console**.

---

## Troubleshooting

### Port 3000 is already in use

The hub fails to start with an "address already in use" error, and the service keeps restarting.

```bash
ss -ltnp | grep 3000
```

Stop the other program or choose another port: set `server.port` in `dist/config/hub.config.json` (or under **Settings** in the web UI) and restart the hub. On the board PC also adjust the kiosk URL (`GAME_DISPLAY_URL`, see above).

### Autodarts login fails

- `Login failed: invalid email or password`: check `autodarts.email` and `autodarts.password` in `dist/config/hub.config.json` or under **Settings**. Log in once at Autodarts in a browser with the same data.
- The account uses two-factor authentication: not supported.
- No network or DNS at boot: the service waits until `api.autodarts.com` resolves. Check with `getent hosts api.autodarts.com`. The hub does not retry a failed start-up login by itself; after fixing the network run `systemctl --user restart io-darts-agent`.
- After changing credentials or the board ID in the web UI, restart the hub.

### The Game Display stays black or shows nothing

- The kiosk script waits until the hub answers on the display URL. If Firefox does not open at all, the hub is not reachable: check `systemctl --user status io-darts-agent` and the logs.
- Open `http://localhost:3000/module-ui/game-display/` by hand. `Module UI not found` means the Game Display UI was not built: run `npm run setup` and `npm run build:app`. If the setup wizard was never finished, the display gets no data: open `http://localhost:3000` and complete it.
- If the module list in the web UI is empty, check the log for `Installed built-in module` or `Built-in module not found`. The hub installs the built-in modules only when `dist/modules_installed/` is empty.
- A black area around animations instead of transparency means ffmpeg is missing: `sudo apt install ffmpeg`. Without ffmpeg generated animations are stored as MP4 without transparency.

### The Darts Caller reports that ElevenLabs is not configured

The Darts Caller takes the ElevenLabs API key from the AI settings. Open **AI Settings** (`/ai-settings`) in the web UI, enter the key for ElevenLabs, enable the provider, then restart the Darts Caller module (or the hub).

---

## Uninstall

On the board PC:

```bash
systemctl --user disable --now io-darts-agent
rm ~/.config/systemd/user/io-darts-agent.service
systemctl --user daemon-reload
rm ~/.local/bin/game-display-kiosk.sh ~/.config/autostart/game-display-kiosk.desktop
rm -rf ~/.local/share/game-display-kiosk
sudo loginctl disable-linger "$USER"   # only if nothing else needs it
```

Remove the hub itself (this deletes the configuration and all data, make a backup first if needed):

```bash
rm -rf ~/io-darts-agent
```

Remove `/etc/lightdm/lightdm.conf.d/50-autologin.conf` or turn off automatic login in **Login Window** if you no longer want it. Node.js, ffmpeg and Firefox can be removed with `apt` if nothing else uses them.

On other systems stop the hub and delete the cloned directory.

---

## Desktop packages

There are no published installers or desktop downloads yet. You can build the Electron desktop app yourself from the source code. It bundles the hub, the web UI and the built-in modules and needs no separate Node.js installation on the target machine. The macOS build has been tested, the Windows and Linux builds have not.

Build on the platform you are building for (Node.js 22 required on the build machine):

```bash
npm run setup        # install dependencies (root and sub-packages)
npm run build:app    # compile the backend, the web UI and the Game Display UI
npm run dist:mac     # or: npm run dist:linux / npm run dist:win
```

The packages end up in `releases/` (macOS: `.dmg` and `.zip`, Windows: NSIS installer and portable `.exe`, Linux: `.deb`, `.rpm` and AppImage). `npm run dist:*` runs `build:app` again by itself.

The desktop app starts the hub in the background, opens the web UI in its own window and keeps a tray icon. Closing the window keeps the hub running; **Quit** in the tray menu stops it. The app does not write into its install folder. Configuration, data, media and installed modules live in the per-user app data folder:

| System | Data folder |
|--------|-------------|
| macOS | `~/Library/Application Support/io-darts-agent/hub` |
| Windows | `%APPDATA%\io-darts-agent\hub` |
| Linux | `~/.config/io-darts-agent/hub` |

The app uses port 3000. If that port is taken, start it with the environment variable `IO_DARTS_PORT` set to another port. The setup wizard stores the port the hub runs on. If you later change the port in the settings and restart the hub, the app follows it automatically.

The macOS build is signed ad hoc only and not notarized, so Gatekeeper warns on first start (open it with right click, **Open**). The former standalone binaries built with pkg have been removed.
