# Contributing

Thanks for helping! One rule above all: **your text never leaves the machine.**
Please don't add cloud APIs, CDNs, telemetry or analytics. Local, optional extras are welcome.

## Setup

```bash
npm ci
npm run dev
```

Before opening a pull request run:

```bash
npm run typecheck
npm test
npm run build
```

## Guidelines

- Keep all Ollama calls in the main process (`src/main/ollama.ts`). The renderer must not make network requests.
- Never accept `*-cloud` model tags.
- Add or update a test in `tests/` when you change scoring, suggestion merging or anchoring logic.
- Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:` …).

## Releasing (maintainers)

1. Bump `version` in `package.json` and add a `CHANGELOG.md` entry.
2. Publish a GitHub Release tagged `vX.Y.Z`. The *Release* workflow builds
   `WritingAssistant-Setup.exe` from that tag and attaches it with a SHA-256 checksum.
