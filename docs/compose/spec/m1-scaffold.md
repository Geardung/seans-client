---
feature: m1-scaffold
status: delivered
updated: 2026-07-16
branch: main
commits: 93af418..adc0b8c
---

# M1 Scaffold

## Report

**What was built** — A runnable Tauri 2 + React 19 + TypeScript + Vite Windows client skeleton named Seans (`ru.tedeshi.seans`, exe `seans`, v0.1.0). The shell opens a 1280×800 window (min 960×600), registers `seans://`, and collapses a second launch via `tauri-plugin-single-instance`. Pure-TS deep-link parser handles home, `auth/callback` (tokens returned in memory only), and `room/{code}` with `^[A-Z2-9]{8}$`, including Windows triple-slash forms. Cold-start URLs are read with `getCurrent()` in addition to `onOpenUrl`. Frontend has a hash router (`#/`, `#/login`, `#/room/:code`), Russian placeholder screens with loading/empty/error slots, and `src/design/tokens.css` (light/dark, system). PE VersionInfo is set in `build.rs` via `winresource` for later Authenticode.

**Verification** — `npm run typecheck` PASS · `npm test` PASS (35 tests: deepLink 18, routeResolver 10, tauriConf 7) · `npm run build` PASS · `npm run tauri build` PASS (with MSVC `vcvars64.bat` in PATH) producing `seans.exe`, `Seans_0.1.0_x64_en-US.msi`, `Seans_0.1.0_x64-setup.exe`. PE VersionInfo comes from `tauri-build` (`bundle.publisher` → CompanyName).

**Journey log** — (1) `bundle.windows.versionInfo` is not in the Tauri 2 config schema; do **not** also use `winresource` in `build.rs` — it duplicates the VERSION resource and `cvtres` fails CVT1100/LNK1123. Let `tauri-build` embed PE metadata from `tauri.conf.json`. (2) Room code contract is `A-Z2-9` (I/L/O valid); a Crockford-style test was corrected to match the brief. (3) Tauri 2 deep-link cold-start requires `getCurrent()` after mount; `onOpenUrl` alone drops launch URLs. (4) `RunEvent::Opened` is macOS/iOS/Android only — Windows deep links come via `deep-link://new-url`. (5) Subagents cannot run processes in this sandbox — orchestrator owns `npm`/`cargo`. Linked `git worktree add` is blocked; user consented to work on `main`. MSVC lives at `D:\programs\VisualC++\blyeat` (vcvars64.bat).

## [S1] Problem

The Seans Windows client has no code yet. Before auth, player, or rooms can land, the repo needs a runnable Tauri 2 desktop shell that starts on Windows 10/11, owns the `seans://` scheme, and collapses a second launch into the first process. Milestone 1 is that foundation: README for humans, project layout for later milestones, and a smoke-tested app binary.

## [S2] Design

### Stack and identity

- Tauri 2 (Rust) + React 19 + TypeScript + Vite.
- Product name `Seans`, identifier `ru.tedeshi.seans`, main exe `seans.exe`.
- Version starts at `0.1.0`. Windows VersionInfo fields (CompanyName=`tedeshi`, ProductName=`Seans`, FileVersion/ProductVersion) are configured for later Authenticode.
- No packers, no runtime DLL downloads, nothing written/executed under `%TEMP%`.

### Shell responsibilities (M1)

1. Create a single main window (1280×800, min 960×600) titled «Seans».
2. Show the React app immediately (auth gate placeholder screen is enough).
3. Register deep links for scheme `seans://` and handle:
   - `seans://` → focus existing window
   - `seans://auth/callback?access_token=&state=` → emit payload to frontend (parse only; storage is M2)
   - `seans://room/{code}` → emit `{roomCode}` to frontend
4. `tauri-plugin-single-instance`: second process forwards its deep-link/args to the first and exits.
5. On deep-link while running: focus the main window and dispatch the parsed event.

### Frontend (M1)

- Vite + React + TS with `src/` layout matching the product brief:
  `api/`, `features/`, `screens/`, `design/`.
- Routing via a tiny hash/history router (no heavy router required): `#/` home placeholder, `#/login` auth gate placeholder, `#/room/:code` placeholder.
- Design tokens file `src/design/tokens.css` (light + dark, system default): bg/ink/accent/danger, space 4–32, radii, type scale. Inter as UI font.
- Russian UI strings on the placeholder screens.
- Each screen already has loading/empty/error slots (static placeholders OK).

### Scripts and quality gate

- `npm run dev` — Vite only
- `npm run build` — `tsc --noEmit` + Vite production build
- `npm run tauri dev` / `npm run tauri build`
- `npm test` — Vitest unit tests
- `npm run typecheck` — `tsc --noEmit`

### Unit tests (M1)

1. Deep-link parser: `seans://`, `seans://auth/callback?...`, `seans://room/ABCD2345`, invalid codes rejected.
2. Frontend route resolver maps deep-link payload → route path.
3. Package identity sanity (tauri.conf.json): identifier, productName, window size, plugins list includes deep-link + single-instance.

### Error behavior

- Malformed `seans://` URLs are ignored (no crash, no navigation).
- Room codes outside `^[A-Z2-9]{8}$` are ignored.

## [S3] Out of Scope

- JWT / keyring / web login flow (M2)
- Design-system components beyond tokens (M3)
- Search, media, tasks, library (M4–M6)
- libmpv and playback (M7)
- TheIntroDB (M8), history resume (M9)
- Rooms WS (M10)
- Updater / installer hardening / AV checklist (M11)
- Backend changes, web app, non-Windows targets

## Tasks

- [x] T1: Scaffold Tauri 2 + React/TS/Vite in repo root with `src/` layout and npm scripts — acceptance: `npm install` and `npm run build` succeed (covers: S2)
- [x] T2: Deep-link + single-instance shell (parse `seans://`, forward second launch, focus window) — acceptance: unit tests for parser pass; `tauri.conf.json` lists both plugins (covers: S2)
- [x] T3: Frontend shell — placeholders, hash router, tokens.css light/dark, Russian strings — acceptance: `npm run build` type-checks; screens render empty/loading/error slots (covers: S2)
- [x] T4: M1 unit tests (deep-link parser, route resolver, config identity) — acceptance: `npm test` green (covers: S2; depends: T1, T2)
- [x] T5: README covering product, prerequisites, dev/build, deep links — acceptance: README present and matches actual scripts (covers: S1)
- [x] T6: Smoke build — acceptance: `npm run build` PASS; `npm run tauri build` PASS or documented env-blocker (MSVC missing) with exact command (covers: S2; depends: T1)
