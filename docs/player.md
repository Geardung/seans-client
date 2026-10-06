# Player / libmpv (M7)

In-process playback notes for the Seans Windows client. Product constraints:
no packers, **no runtime DLL download**, bundled `libmpv-2.dll` only.

## Rendering strategy: `wid` (chosen) vs `mpv_render_context`

v1 uses the **`wid`** option: libmpv creates/owns rendering inside a Win32
child window (`STATIC` class) whose HWND is passed to `mpv_set_option("wid")`
**before** `mpv_initialize`.

| | `wid` child HWND | `mpv_render_context` + D3D11 |
|---|---|---|
| Complexity | low (CreateWindowEx + MoveWindow) | high (swapchain, format, resize) |
| Overlay UI | HTML on top of the child (webview sibling Z-order) | must composite / separate view |
| Resize | `MoveWindow` on parent resize | re-create / resize swapchain |
| Fallback needed | no | not for v1 |

If `wid` proves fragile on a target GPU/driver, the documented fallback is
`mpv_render_context` + D3D11 into a shared texture — out of scope for M7.

Z-order: the host child is placed at `HWND_BOTTOM` among the main window's
children so WebView2 (transparent on the player route) draws overlay controls
above the video. `app-fullbleed.player-surface` keeps a transparent background.

## DLL layout and loading

```
seans.exe
mpv/libmpv-2.dll      ← bundle.resources: "resources/mpv/*": "mpv/"
mpv/<ffmpeg deps>.dll
```

`scripts/fetch-mpv.ps1` (build/dev time only) downloads a pinned shinchiro
mpv-winbuild-cmp archive and copies every `*.dll` into
`src-tauri/resources/mpv/`, normalizing `mpv-2.dll` → `libmpv-2.dll`.
Idempotent; `-Force` refreshes; `-PrintHash` pins SHA256.

Runtime load (`src-tauri/src/player/ffi.rs`):

1. `locate_mpv_dir()` probes `exe_dir/mpv`, `exe_dir`, `exe_dir/resources/mpv`,
   `cwd/src-tauri/resources/mpv` (dev) for `libmpv-2.dll`.
2. `libloading::Library::new` on that **local path only** — never a network URL,
   never `%TEMP%`.
3. Missing file → «Не найден libmpv-2.dll — пересоберите приложение с scripts/fetch-mpv.ps1».

## HW decode

`hwdec=auto-safe` (d3d11va / dxva2 / nvdec order, automatic software fallback).
The active decoder is read from `hwdec-current` and exposed read-only on the
player overlay (`formatHwdec`) for the future Settings screen.

## Events

`player://state` carries a `PlayerSnapshot` (serde → JSON):
`position`, `duration`, `pause`, `eof`, `error`, `tracks`, `hwdec`, `speed`,
`volume`, `mute`, `fullscreen`, `idle`, `file_loaded`, `url`.

The mpv event thread observes `time-pos` / `duration` / `pause` / `eof-reached` /
`track-list` / `hwdec-current` / `speed` / `volume` and throttles position
emits to ~4/s. `MPV_EVENT_END_FILE` with reason `ERROR` sets
«Не удалось открыть файл».

## Commands

`player_open(url, start_at?, hwnd_hint?)`, `player_play`, `player_pause`,
`player_toggle_pause`, `player_seek`, `player_set_speed` (0.25–2.0),
`player_set_volume`, `player_set_mute`, `player_set_audio_track`,
`player_set_subtitle_track`, `player_list_tracks`, `player_set_fullscreen`,
`player_toggle_fullscreen`, `player_get_state`, `player_destroy`,
`player_sync_size`.

Media URLs come from JS (`fetchFileUrl` → presigned); the Rust side does not
call the Seans API and does not fetch DLLs.

## Resume hook (M9)

`openPlayer(fileId, { startAt })` (features/player/playerNav.ts) navigates to
`#/player/:fileId` and stashes `startAt` in sessionStorage
(`seans.player.startAt`). PlayerScreen consumes it once per file id.

## Smoke test (manual, parent)

- HEVC + ASS subtitles in `.mkv` (embedded subs, audio track switch).
- H.264 + AAC in `.mp4` (seek, speed 0.25–2, fullscreen).
- Missing DLL build: clear `resources/mpv/`, expect the rebuild hint error.
