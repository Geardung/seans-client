# Seans Client

Native Windows desktop client for the [Seans](https://seans.tedeshi.ru) self-hosted media service.

Search films (Kinopoisk), pick torrent releases, stream completed files via presigned URLs, and watch together in rooms. **All video playback happens only in this client** (libmpv). The web app is catalog + account.

| | |
|---|---|
| Platform | Windows 10/11 x64 (v1) |
| Stack | Tauri 2 · React · TypeScript · Vite · libmpv |
| Deep links | `seans://` |
| Updates | `tauri-plugin-updater` (startup + every 6h + manual) |

## Prerequisites

- [Rust](https://rustup.rs/) stable (`x86_64-pc-windows-msvc`)
- Node.js 20+ and npm
- Visual Studio 2022 Build Tools with **Desktop development with C++** (MSVC, Windows 10/11 SDK)
- WebView2 runtime (preinstalled on Win 11; [Evergreen installer](https://developer.microsoft.com/microsoft-edge/webview2/) for Win 10)

## Develop

```bash
npm install
node scripts/generate-icons.mjs   # placeholder icons (once; idempotent)
npm run tauri dev
```

Frontend runs on Vite’s dev server; the Rust shell is rebuilt by `tauri dev` on change.

Useful scripts:

| Script | Purpose |
|--------|---------|
| `npm run dev` | Vite only (UI hot-reload without shell) |
| `npm run build` | Type-check + production frontend bundle |
| `npm run typecheck` | `tsc --noEmit` only |
| `npm test` | Unit tests (Vitest, single run) |
| `npm run test:watch` | Vitest watch mode |
| `npm run tauri dev` | Full desktop app in dev mode |
| `npm run tauri build` | Release MSI/NSIS installer |

## Build

```bash
npm install
node scripts/generate-icons.mjs
npm run build
npm run tauri build
```

Or run the full M1 gate in one go: `powershell -ExecutionPolicy Bypass -File scripts\verify.ps1`.

Installer output: `src-tauri/target/release/bundle/`.

VersionInfo (CompanyName, ProductName, FileVersion, ProductVersion) is set in `src-tauri/tauri.conf.json` / PE resources so the binary is ready for Authenticode signing later. Do not pack with UPX or any runtime DLL downloader — antivirus false positives.

## Deep links

The app registers the `seans://` scheme (`HKCU\Software\Classes\seans`) and runs as a single instance.

| URL | Action |
|-----|--------|
| `seans://auth/callback?access_token=&state=` | finish web login |
| `seans://room/{code}` | open room (`code` = 8 chars `A–Z2–9`) |
| `seans://` | focus app / Home |

A second launch forwards the URL to the first process via `tauri-plugin-single-instance`.

## Project layout

```
src-tauri/          # Rust shell (M1: deep-link + single-instance; updater/mpv later)
  capabilities/     # Tauri 2 permission capabilities
src/
  api/              # typed Seans API client
  features/         # auth, search, media, tasks, library, player, rooms, history, reviews
  screens/          # routed screens (home, login gate, room)
  design/           # tokens.css + placeholder UI slots
  lib/              # deep-link parser, route resolver (pure TS)
tests/              # Vitest unit tests
docs/               # API contract notes, compose specs, AV checklist
```

## API

Base URL: `https://api.seans.tedeshi.ru`  
OpenAPI: `https://api.seans.tedeshi.ru/openapi.json`  
Auth: `Authorization: Bearer <JWT>` (stored in Windows Credential Manager via `keyring`).

## Notes

- UI strings — Russian; identifiers and docs — English.
- No password field in the client: login goes through the web (`seans://auth/callback`).
- Worker/torrent endpoints are not used by this client.
