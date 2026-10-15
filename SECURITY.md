# Security Policy

## Intended environment

IO-Darts-Agent is designed for a trusted local network, such as your home network next to the dartboard. It is not hardened for exposure to the internet.

- Do not expose the hub to the internet and do not set up port forwarding to it.
- The server listens on all network interfaces (`0.0.0.0`, port 3000 by default), so every device in your network can reach it.
- The web login for the configuration interface is off by default. Enable it under **Settings** if other people use your network.
- Installing a module from a Git URL clones that repository and runs its code on the hub machine. Only install modules from sources you trust.

## Stored credentials

Credentials are stored in plain JSON files on the hub machine, not encrypted:

| File | Content |
|------|---------|
| `dist/config/hub.config.json` | Autodarts email and password, board ID, web login (password stored as a bcrypt hash) |
| `dist/config/ai-providers.json` | API keys for AI providers (ElevenLabs, Runway, Higgsfield, OpenAI, Anthropic and others) |

Protect the hub machine accordingly: restrict access to the user account that runs the hub, do not share these files, and remove credentials before posting config files or logs in issues. If you think a file has leaked, change your Autodarts password and rotate the affected API keys.

## Supported versions

Only the latest state of the `main` branch receives security fixes.

## Reporting a vulnerability

Please report vulnerabilities privately by email to [info@castor.io](mailto:info@castor.io), not in public issues.

Include:

- a description of the problem and its impact,
- steps to reproduce or a proof of concept,
- the affected version or commit.

You will get a reply as soon as possible. Please give a reasonable amount of time for a fix before disclosing the issue publicly.
