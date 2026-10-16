# Contributing to IO-Darts-Agent

Issues and pull requests are welcome.

## Issues

- Bugs and feature requests: open an issue at <https://github.com/Castorio/io-darts-agent/issues>.
- For bugs, include your OS, Node.js version, steps to reproduce and relevant console log lines. Remove credentials, API keys and board IDs before posting logs or config files.
- Security problems are not reported in public issues. See [SECURITY.md](SECURITY.md).

## Development setup

Follow the [developer quick start](docs/en/developer-quickstart.md). The [developer guide](docs/en/developer-guide.md) and the [module SDK](docs/en/module-sdk.md) explain the architecture and how modules work.

## Before you open a pull request

Run these in the repository root:

```bash
npm run build      # TypeScript build of the backend and modules
npx vitest run     # tests
npm run lint       # ESLint
```

The build, the tests and the lint must pass: `npm run lint` has to finish with 0 errors (CI runs it on every push and pull request).

If you changed the web interface or the Game Display UI, also run `npm run build:frontend` or `npm run build:modules`.

- Keep pull requests focused on one change.
- Add or update tests for changed behavior.
- Update the docs in `docs/en/` and `docs/de/` when user-facing behavior changes.

## Commit messages

Use the conventional commit style:

- `feat: ...` new functionality
- `fix: ...` bug fixes
- `docs: ...` documentation only
- `chore: ...` maintenance, tooling, dependencies

An optional scope is fine, for example `fix(wled): ...`.

## License of contributions

IO-Darts-Agent is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE). By submitting a contribution you agree that:

1. your contribution is licensed under the PolyForm Noncommercial License 1.0.0, and
2. the maintainer (castor.io / Christoph Castor) may also license your contribution under other terms, including commercial licenses.

You confirm that you have the right to submit the contribution under these terms.
