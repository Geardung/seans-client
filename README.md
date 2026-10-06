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
powershell -ExecutionPolicy Bypass -File scripts\fetch-mpv.ps1   # once: bundle libmpv DLLs
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
powershell -ExecutionPolicy Bypass -File scripts\fetch-mpv.ps1   # once: bundle libmpv
npm run build
npm run tauri build
```

Or run the full M1 gate in one go: `powershell -ExecutionPolicy Bypass -File scripts\verify.ps1`.

Installer output: `src-tauri/target/release/bundle/`.

VersionInfo (CompanyName=`bundle.publisher`, ProductName, FileVersion, ProductVersion) is embedded by `tauri-build` from `src-tauri/tauri.conf.json` so the binary is ready for Authenticode signing later. Do not pack with UPX or any runtime DLL downloader — antivirus false positives.

## Player / libmpv

Playback uses **in-process libmpv** (not `mpv.exe`, not a sidecar process).

| | |
|---|---|
| DLLs | `src-tauri/resources/mpv/` at **build time** via `scripts/fetch-mpv.ps1` |
| Ship | `bundle.resources`: `resources/mpv/*` → `mpv/` next to `seans.exe` |
| Load | `LoadLibrary` of the local `libmpv-2.dll` only — never the network |
| Render | mpv `wid` into a Win32 child HWND behind the WebView (overlay HTML controls) |
| HW decode | `hwdec=auto-safe` (d3d11va / dxva2 / nvdec, soft fallback); active mode shown read-only |

```powershell
# Once before the first `tauri dev` / `tauri build` (idempotent, -Force to refresh):
powershell -ExecutionPolicy Bypass -File scripts\fetch-mpv.ps1
```

The script pins a shinchiro mpv-winbuild-cmp archive (URL + SHA256 in the script) and copies `libmpv-2.dll` plus its dependency DLLs into `src-tauri/resources/mpv/`. Run with `-PrintHash` to (re)compute the archive hash after a trusted download and pin it in the script. If `libmpv-2.dll` is missing at runtime the UI shows «Не найден libmpv-2.dll — пересоберите приложение с scripts/fetch-mpv.ps1» — nothing is downloaded on first launch.

AV checklist: no packers, no runtime DLL fetch, nothing written/executed from `%TEMP%`, DLLs are ordinary bundled resources. See `docs/player.md` for the WID/FFI notes.

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
src-tauri/          # Rust shell (deep-link + single-instance + libmpv player)
  capabilities/     # Tauri 2 permission capabilities
  resources/mpv/    # bundled libmpv-2.dll + deps (fetch-mpv.ps1, build time only)
  src/player/       # libmpv FFI + Win32 `wid` host + Tauri commands
src/
  api/              # typed Seans API client
  features/         # auth, search, media, tasks, library, player, rooms, history, reviews
  screens/          # routed screens (home, login gate, room, player)
  design/           # tokens.css + placeholder UI slots
  lib/              # deep-link parser, route resolver (pure TS)
tests/              # Vitest unit tests
docs/               # API contract notes, compose specs, AV checklist, player.md
```

## API

Base URL: `https://api.seans.tedeshi.ru`  
OpenAPI: `https://api.seans.tedeshi.ru/openapi.json`  
Auth: `Authorization: Bearer <JWT>` (stored in Windows Credential Manager via `keyring`).

## Notes

- UI strings — Russian; identifiers and docs — English.
- No password field in the client: login goes through the web (`seans://auth/callback`).
- Worker/torrent endpoints are not used by this client.
