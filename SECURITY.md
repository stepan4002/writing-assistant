# Security & privacy

## Design guarantees

- Spelling and grammar checking runs in-process (harper.js WebAssembly). No network is used.
- Optional AI suggestions are sent only to the Ollama server you configure (default
  `http://127.0.0.1:11434`) and only from the Electron main process. Model tags ending in
  `-cloud` are rejected.
- A Content-Security-Policy blocks remote scripts, styles, images, fonts and connections in the UI.
- Your document, dismissed suggestions and settings are stored locally in
  `%APPDATA%\Writing Assistant`. Delete that folder to remove them (uninstalling keeps it).

## Reporting a vulnerability

Please **don't open a public issue** for security problems. Use GitHub's
[private vulnerability reporting](https://github.com/stepan4002/writing-assistant/security/advisories/new).
Expect a reply within a week.
