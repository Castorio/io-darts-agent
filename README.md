# IO-Darts-Agent

> **Beta:** IO-Darts-Agent is in beta. Things can still change and you may run into bugs. Please report problems as an [issue](https://github.com/Castorio/io-darts-agent/issues).

A local hub for [Autodarts](https://autodarts.io): it listens to your board's live game events and turns them into light shows, a scoreboard on a second screen and spoken score announcements.

**[Deutsche Version](README.de.md)**

IO-Darts-Agent is source available and free for private, non-commercial use (see [License](#license)).

![Dashboard](docs/images/03-dashboard.png)

## Features

- **Autodarts connection**: logs in with your Autodarts account and receives match, throw and takeout events from your board in real time.
- **Module system**: modules react to game events and talk to each other through intents. Built-in modules can be started, stopped and configured in the web UI; further modules can be installed from a Git URL.
- **Web interface** (Vue 3): setup wizard, dashboard, module management, players, media library, live console logs, settings and AI provider settings.
- **Player profiles**: custom players with individual colors used by the light and display modules.
- **Multi-language UI**: English and German complete, Spanish, French, Italian, Dutch, Russian, Ukrainian, Japanese and Chinese partly translated.
- **Optional web login** for the configuration interface.

### Built-in modules

| Module | What it does |
|--------|--------------|
| **WLED Lighting Controller** | Controls WLED LED strips per game event: player colors, effects and presets for 180s, triples, bulls, busts and wins, with durations, fades and color restore. |
| **Game Display** | Fullscreen scoreboard for a second screen or tablet: scores, checkout suggestions, player colors, animations per event and per player, match start screen and results table. |
| **Darts Caller** | Announces scores, checkouts, busts, game shot and player changes using browser TTS or audio voice packs. Voice packs and player names can be generated with ElevenLabs. |

### AI providers

Configured under the sidebar entry **AI Provider** (`/ai-settings`), all optional:

| Provider | Used for |
|----------|----------|
| ElevenLabs | Voice pack generation and player name synthesis for the Darts Caller |
| Runway, Higgsfield | Animation generator for the Game Display (selectable engine) |
| OpenAI, Anthropic, Ollama | Text models available to modules |
| Stability AI, Replicate | Image and other models available to modules |

The animation generator creates short clips from a text prompt (style and event) and can key out a black background to a transparent WebM (needs `ffmpeg`).

![Game Display demo](docs/images/10-game-display-demo.png)

## Requirements

- Node.js 22 or newer with npm
- Git
- `ffmpeg` on the `PATH` (for generated animations)
- An Autodarts account and board
- Optional: WLED controller, a second screen for the Game Display, API keys for the AI providers you want to use

## Download

Ready-made installers for macOS, Windows and Linux are on the [Releases page](https://github.com/Castorio/io-darts-agent/releases). See [Desktop packages](docs/en/installation.md#desktop-packages) for which file fits your system, checksum verification and how to start an unsigned build.

## Quick start

Run from source:

```bash
git clone https://github.com/Castorio/io-darts-agent.git
cd io-darts-agent

npm run setup       # installs all dependencies, builds the module SDK
npm run build:app   # backend, web interface and Game Display UI
npm start
```

Open <http://localhost:3000>. Without a configuration the hub starts in setup mode and the setup wizard asks for your Autodarts login and board.

Runtime configuration is stored in `dist/config/` (relative to the compiled `dist/src/main.js`):

| File | Content |
|------|---------|
| `dist/config/hub.config.json` | Autodarts login, board, server port, web login |
| `dist/config/ai-providers.json` | AI provider settings and API keys |
| `dist/config/players.json` | Player profiles |
| `dist/config/modules/` | Module settings |

The server port defaults to 3000. The `PORT` environment variable only applies before setup (setup mode, no config file yet); the setup wizard stores the port the hub runs on as `server.port` in `hub.config.json`, and from then on that value is used.

For the full guide, including a dedicated Linux board PC that starts the hub and the Game Display automatically (`scripts/linux/`), see the installation guide: [English](docs/en/installation.md) | [Deutsch](docs/de/installation.md).

## Documentation

| Topic | English | Deutsch |
|-------|---------|---------|
| Installation | [installation.md](docs/en/installation.md) | [installation.md](docs/de/installation.md) |
| User guide | [user-guide.md](docs/en/user-guide.md) | [user-guide.md](docs/de/user-guide.md) |
| Features | [features.md](docs/en/features.md) | [features.md](docs/de/features.md) |
| REST and WebSocket API | [api.md](docs/en/api.md) | [api.md](docs/de/api.md) |
| Developer quick start | [developer-quickstart.md](docs/en/developer-quickstart.md) | [developer-quickstart.md](docs/de/developer-quickstart.md) |
| Developer guide | [developer-guide.md](docs/en/developer-guide.md) | [developer-guide.md](docs/de/developer-guide.md) |
| Module SDK | [module-sdk.md](docs/en/module-sdk.md) | [module-sdk.md](docs/de/module-sdk.md) |

The module READMEs in `modules/` are in German.

Changes are listed in the [changelog](CHANGELOG.md).

## Tech stack

- **Backend**: Node.js, TypeScript, Fastify (REST and WebSocket), Autodarts WebSocket client
- **Frontend**: Vue 3, Vite, Pinia, Vue Router, vue-i18n, Tailwind CSS
- **Modules**: built-in modules run inside the hub; modules installed from Git run as separate Node processes connected over IPC; the Game Display has its own Vue UI
- **Tests**: Vitest, Playwright
- **Packaging**: Electron desktop app via electron-builder (macOS tested)

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

IO-Darts-Agent is built for a trusted local network. Do not expose it to the internet and do not set up port forwarding to it. Credentials and API keys are stored in plain JSON on the hub machine. Details and how to report a vulnerability: [SECURITY.md](SECURITY.md).

## License

IO-Darts-Agent is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE). It is source available, not OSI open source.

- Free for private and other non-commercial use.
- You may modify the code and share it, including modified versions, for non-commercial purposes.
- Commercial use requires a separate license. Contact: [info@castor.io](mailto:info@castor.io).

The module SDK in `module-sdk/` is licensed under the MIT License ([module-sdk/LICENSE](module-sdk/LICENSE)), so third-party modules can use it freely.

## Disclaimer

IO-Darts-Agent is an unofficial project. It is not affiliated with, endorsed by or supported by Autodarts. "Autodarts" is a trademark of its respective owner.

---

A project by [castor.io](https://castor.io)
