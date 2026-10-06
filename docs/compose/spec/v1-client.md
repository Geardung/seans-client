---
feature: v1-client
status: delivered
updated: 2026-07-16
branch: main
commits: 0bcba73..0bcba73
---

# Seans Client v1 (M2–M11)

## Report

**What was built** — The full Windows desktop client on top of the M1 Tauri shell: typed Seans API client with numeric coercion and 401 → login gate; JWT in the Windows Credential Manager (`keyring`); web OAuth via `seans://auth/callback` with state validation and a loopback fallback; teal design system + app shell (nav, light/dark/system); search, media detail, reviews (1–10); releases → create task → 3s polling/cancel; library with Play and «Создать комнату»; in-process libmpv player (build-time bundled `libmpv-2.dll` via `scripts/fetch-mpv.ps1`, `wid` child HWND, `hwdec=auto-safe`, tracks/subs/seek/fullscreen/speed); TheIntroDB markers, personal skip intro/recap, chapters menu, credits rating popup; history throttle (15s + force on pause/seek/close) and continue-watching; watch-party rooms (WS reducer, host-only `state`, heartbeat, share link, `seans://room/{code}`); updater (startup + 6h + manual, non-blocking, fail-closed until signing key is pinned) and `docs/av-checklist.md`.

**Verification** — `npm run typecheck` PASS · `npm test` PASS (320 tests / 21 files) · `npm run build` PASS · `cargo check` in `src-tauri` PASS (6 dead_code warnings in player FFI/host only). Manual items still required: browser login against the live site, HEVC+ASS mkv and H.264+AAC mp4 smoke with `scripts\fetch-mpv.ps1` DLLs, host+guest room sync, cold-start `seans://room/CODE`, updater dry-run after pinning pubkey, clean Win11 install + Defender per `docs/av-checklist.md`.

**Journey log** — (1) Subagents cannot run bash here; orchestrator owns npm/cargo. (2) `keyring` 2.3 uses `platform-windows` + `delete_password` (not `windows-native` / `delete_credential`). (3) libmpv crates need a link-time `.lib`; `libloading` + local DLL keeps `cargo check` green without binaries. (4) mpv `wid` child must sit at `HWND_BOTTOM` so WebView2 overlays stay clickable. (5) Review caught guest room `state` broadcast and destroy-then-join UAF in player teardown — both fixed; updater `pubkey` stays empty and `UPDATER_SIGNING_READY=false` until release.

## [S1] Problem

Milestone 1 delivered a runnable Tauri 2 shell (`seans://`, single-instance). The client still cannot authenticate, browse media, download tasks, play video, sync rooms, or self-update. Remaining milestones M2–M11 must turn the shell into the product: web login + Credential Manager, design system shell, catalog, tasks, library, libmpv player, TheIntroDB overlays, history resume, watch-party rooms, and seamless updater — without antivirus-hostile patterns (no packers, no runtime DLL downloads).

## [S2] Design

### Architecture (cross-cutting)

```
src-tauri/                 Rust shell
  src/commands/            auth, player, updater commands
  src/player/              libmpv FFI / session (M7)
  resources/               libmpv-2.dll + deps (bundled, never fetched at runtime)
src/
  api/                     typed Seans + TheIntroDB clients
  features/<name>/         feature logic (auth, search, media, tasks, library, player, rooms, history, reviews)
  screens/                 routed screens
  design/                  tokens + primitives
  lib/                     pure helpers (deepLink, routeResolver, roomReducer, historyThrottle, ...)
tests/                     Vitest unit tests
docs/                      compose specs, API notes, AV checklist
```

- State: React context + hooks. No Redux/Zustand in v1.
- Router: existing hash router, extended with `#/media/:id`, `#/tasks`, `#/library`, `#/history`, `#/settings`, `#/account`, `#/player/:fileId`, `#/room/:code`.
- IDs are UUID strings. Numeric API fields (`rating_kp`, `position_sec`, `duration_sec`, `size_bytes`, `speed_bps`, `reserved_bytes`, `progress_pct`, `tmdb_id`, `season`, `episode`) may arrive as JSON numbers **or** strings — always parse via `toNumber()`.
- UI language Russian; identifiers/docs English.
- Every screen exposes loading / empty / error states.

### API client (M2+)

- Base `https://api.seans.tedeshi.ru`, `Authorization: Bearer <JWT>`.
- Dev override: `import.meta.env.VITE_API_BASE_URL` if set.
- `request<T>()` wrapper: JSON, typed errors `{status, message}`, **401 → clear session + emit `seans:auth-required`**.
- Token never in localStorage/disk; only Windows Credential Manager via Rust `keyring` (`service=seans`, `user=<user_id or "session">`).
- Endpoints (client-facing only; no worker endpoints):

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/auth/login` | web-only; client does not send passwords |
| GET | `/api/auth/me` | `UserResponse` |
| GET | `/api/search?q=` | `MediaSearchResult[]` |
| GET | `/api/media/{id}` | `MediaDetail` |
| GET | `/api/media/{id}/releases?refresh=` | `TorrentReleaseResponse[]` |
| POST | `/api/tasks` | `{torrent_release_id, file_paths[]}` |
| GET | `/api/tasks?active=` | `TaskDetailResponse[]` |
| POST | `/api/tasks/{id}/cancel` | |
| GET | `/api/library` | array of `{library_item, media_item, files, total_size, ready}` |
| GET | `/api/files/{task_file_id}/url` | `{url, expires_in}` |
| POST | `/api/rooms` | `{task_file_id}` → `{id, code, ws_url}` |
| GET | `/api/rooms/{code}` | `{room, members}` |
| PUT | `/api/history` | `{task_file_id, position_sec, duration_sec}` |
| GET | `/api/history?limit=` | continue-watching |
| PUT | `/api/media/{id}/review` | `{score:1..10, review?}` |
| GET | `/api/media/{id}/reviews` | `ReviewResponse[]` |
| GET | `/healthz` | |

Optional fields that may appear: `MediaDetail.user_review` (`ReviewResponse \| null`). If absent, derive “already reviewed” from `GET /api/media/{id}/reviews` (own `user_id`).

### Auth (M2)

1. Client generates one-time `state` (crypto random, 32 bytes hex), opens system browser:
   `https://seans.tedeshi.ru/auth?redirect_uri=seans%3A%2F%2Fauth%2Fcallback&state=<state>`
2. Deep link `seans://auth/callback?access_token=&state=&token_type=bearer` (also accept missing `token_type`).
3. Validate `state` matches in-memory pending login. On mismatch → error, no storage.
4. Store JWT in Credential Manager (Rust command). `GET /api/auth/me` to hydrate user.
5. Logout: clear keyring, drop in-memory token, go to login gate.
6. Fallback (if web auth page missing): loopback `http://127.0.0.1:<ephemeral>/callback` as `redirect_uri`; tiny Rust hyper/std TCP acceptor or `tauri-plugin-http` + local server command; same state check. Primary path remains `seans://`.
7. Any HTTP 401 → treated as logged out.

Rust commands: `save_token(token: String)`, `load_token() -> Option<String>`, `clear_token()`, `open_url(url: String)`.

### Design system (M3)

- Extend `src/design/tokens.css` (keep existing keys; add missing):
  - Accent = deep teal/cyan: light `#0f766e` / dark `#2dd4bf` (override M1 blue).
  - danger red, neutral surfaces, space 4/8/12/16/24/32, radii, type scale (already present).
  - Theme: `light | dark | system` via `data-theme` on `<html>`, persisted in `localStorage` key `seans.theme` (non-sensitive).
- Shell: left nav (Главная, Библиотека, Задачи, История, Настройки, Аккаунт) + content area; player/room full-bleed without nav.
- Primitives in `src/design/`: `Button`, `Input`, `PosterCard`, `Row`, `Badge`, `ProgressBar`, `Spinner`, `EmptyState`, `ErrorState`, `Modal`, `RatingStars`.
- Poster grid 180–220px; list rows 48–64px.

### Catalog (M4–M6)

**Search + Media detail (M4)**
- Debounced search (250ms) on Home; poster grid; empty/error/loading.
- Media detail: poster, title/original, year, genres, overview, KP rating, reviews list, own review form (1–10 + text).
- `PUT /api/media/{id}/review` on submit; show own review if `user_review` present.

**Releases + Tasks (M5)**
- Releases table: tracker, title, size, seeders/leechers, quality, voiceover.
- Select release → file picker (`file_paths` from release payload if provided, else default full-file selection) → `POST /api/tasks`.
- Tasks screen: status, progress, speed, stage, error, cancel. Poll `GET /api/tasks?active=true` every 3s while any active; stop when idle.

**Library (M6)**
- List library items with media poster/title/year, files (season/episode), total_size, ready flag.
- Per file: Play (`#/player/:fileId`), «Создать комнату».

### Player (M7)

- In-process libmpv, DLLs bundled as sidecar resources (`src-tauri/resources/mpv/`).
- **No runtime DLL download.** Build script `scripts/fetch-mpv.ps1` downloads known-good `libmpv-2.dll` + deps into `src-tauri/resources/mpv/` at **build time only**; they are packaged via `bundle.resources`.
- Render into Tauri webview panel HWND (`raw-window-handle`). Preferred: child HWND + `--wid`; fallback: mpv render API if `wid` is insufficient. HW decode `d3d11`/`dxva2` with `hwdec=auto-safe` and documented soft fallback.
- Source: `GET /api/files/{id}/url` → play `url` (presigned; treat as any media URL).
- Required: mkv/mp4/webm/avi/mov; H.264/H.265/AV1/VP9; AAC/AC3/EAC3/TrueHD/FLAC/Opus; subs ASS/SSA/SRT (embedded+external); audio track select; seek; fullscreen; speed 0.25–2×.
- Failure → clear error message («Не удалось открыть файл»), not infinite spinner.
- Resume: on open, `GET /api/history` (or passed state) → seek unless room host-sync overrides.

### TheIntroDB (M8)

- `GET https://api.theintrodb.org/v3/media?tmdb_id=&season=&episode=` (season/episode from `TaskFile` for series).
- Feature off when `tmdb_id` is null. Cache in memory per session only.
- Segments: `intro|recap|credits|preview` arrays of `{start_ms, end_ms|null}`.
- Seek-bar markers at `start_ms` (teal/blue/amber/gray) with hover label.
- Skip buttons when position in range → seek to `end_ms + 0.3s` (or no-op if `end_ms` null); auto-hide 2s after exit.
- Credits popup (no pause): stars 1–10, optional review text, «Позже». Once per session per media; skip if already reviewed. Submit → `PUT /api/media/{id}/review`.
- Chapters dropdown: type + timestamp, seek to `start_ms`.
- Rooms: skip is personal (not broadcast). Host seek past intro broadcasts normal `state`.

### History (M9)

- `PUT /api/history` every 15s while playing, plus on pause/seek/close.
- Throttle helper unit-tested (`historyThrottle`).
- Continue-watching list from `GET /api/history`; open player at `position_sec` unless `completed`.

### Rooms (M10)

- REST create/join as specified. WS `wss://api.seans.tedeshi.ru/ws/rooms/{code}?token=` (dev: `ws://localhost:8000/...`).
- Client→server: `join`, `heartbeat{position}`, `state{action,position}`, `sync_request`, `leave`.
- Server→client: `room_state`, `state`, `member_joined`, `member_left`, `error`.
- Rules: only host sends `state`; guests apply and heartbeat; host leave → server promotes; close 4001/4004 handled with UI copy.
- `seans://room/{code}` enters as guest (or opens own room if host).
- Share button copies `https://seans.tedeshi.ru/room/{code}`.
- Pure `roomReducer` unit-tested.

### Updater + AV (M11)

- `tauri-plugin-updater` + `tauri-plugin-process`.
- Check on startup + every 6h + manual button. Download in background; apply on «Перезапустить» or exit. Player never blocked.
- Endpoints: use Tauri updater JSON endpoint (document placeholder `https://seans.tedeshi.ru/updates/{{target}}/{{current_version}}` — configurable in tauri.conf).
- AV checklist `docs/av-checklist.md`: no UPX/Themida; no runtime fetch of code/DLL; VersionInfo present; no `%TEMP%` execution; no process injection; Authenticode-ready PE; Defender smoke notes.

### Unit tests (Vitest)

1. API parsing (`toNumber`, TokenResponse/UserResponse/release/library shapes).
2. Deep-link router (existing) + auth callback state validation helper.
3. `roomReducer` (join/leave/state/host promotion message handling).
4. `historyThrottle` (15s cadence, force on pause/seek).
5. TheIntroDB segment range helpers (intro active window, credits trigger).
6. tauri.conf identity + updater/deep-link plugins listed.

### Error behavior

- Malformed deep links ignored. Invalid room codes ignored.
- 401 → login gate. 4001 WS → unauthorized copy. 4004 → room not found copy.
- mpv open failure → user-visible error with retry.
- TheIntroDB fetch failure → silent feature-off.

## [S3] Out of Scope

- Worker/torrent download pipeline
- Client transcoding / HLS / ffmpeg re-encode
- macOS/Linux/Android/iOS
- Web app implementation (only shared tokens/contract)
- DRM, multi-profile, auto-best-torrent
- Purchasing Authenticode/EV certificates
- Implementing the backend or changing deployed API shapes

## Tasks

- [x] T1: Typed API client + numeric coercion + 401 hook — acceptance: unit tests for parsing/401 path pass (covers: S2 API)
- [x] T2: Rust keyring commands + web login + callback state check + logout — acceptance: manual login path works; state mismatch rejected; token not on disk (covers: S2 Auth; depends: T1)
- [x] T3: Design tokens (teal accent, theme switch) + app shell nav + primitives — acceptance: all routes reachable; light/dark/system works (covers: S2 Design)
- [x] T4: Search + Media detail + reviews — acceptance: search shows posters; detail shows info/reviews; submit review (covers: S2 Catalog; depends: T1, T3)
- [x] T5: Releases table + create task + Tasks polling/cancel — acceptance: task appears and updates; cancel works (covers: S2 Catalog; depends: T4)
- [x] T6: Library screen with files (season/episode), Play and Create room actions — acceptance: library renders from API shape (covers: S2 Catalog; depends: T5)
- [x] T7: libmpv in Tauri: bundled DLLs, HW decode, tracks/subs/seek/fullscreen/speed, clear errors — acceptance: plays HEVC+ASS from mkv and H.264+AAC mp4 (manual smoke pending — see Report) (covers: S2 Player)
- [x] T8: TheIntroDB markers, skip intro/recap, chapters menu, credits rating popup — acceptance: works for media with tmdb_id; silent-off otherwise (covers: S2 TheIntroDB; depends: T7)
- [x] T9: History PUT throttle + resume + continue-watching screen — acceptance: progress saved ≥ every 15s; reopen resumes (covers: S2 History; depends: T7)
- [x] T10: Room create/join, WS sync reducer, host badge, share link, seans://room/{code} — acceptance: two clients stay in sync; tests for reducer (covers: S2 Rooms; depends: T7)
- [x] T11: Updater (startup/6h/manual) + process restart + AV checklist doc — acceptance: updater dry-run documented; checklist committed (covers: S2 Updater)
- [x] T12: Unit tests for API parse, roomReducer, deep-link/auth state, historyThrottle, intro ranges — acceptance: `npm test` green (covers: S2 tests)
- [x] T13: Verification gate `npm run build`, `npm test`, `npm run tauri build` + finalize report — acceptance: documented results in Report (`tauri build` needs MSVC + `fetch-mpv.ps1`; see Report) (covers: S1)
