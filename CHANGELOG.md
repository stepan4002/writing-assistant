# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/) · Versioning: [SemVer](https://semver.org/).

## [0.2.0] — 2026-11-13

First public release.

### Changed
- New name and identity: **Writing Assistant**, with its own pen icon and indigo color scheme.
- Installer is now `WritingAssistant-Setup.exe` (per-user, no admin), built by GitHub Actions on every release.

### Added
- One-line installer `install.ps1` (with uninstall).
- Unit tests for scoring, suggestion anchoring/merging and dismissal keys.
- CI: typecheck, tests, build and Windows installer on every push.

## [0.1.1]

### Fixed
- Content-Security-Policy no longer blocks the grammar engine's WebAssembly.
- The app shows "Checker unavailable" instead of a false perfect score when the engine fails to load.

## [0.1.0]

- Editor with colored underlines, suggestion cards (Accept / Dismiss), 0–100 score, category tabs.
- Embedded harper.js grammar engine; optional Ollama tier for clarity, engagement and delivery.
- Goals panel, document and dismissal persistence, Windows NSIS installer.
