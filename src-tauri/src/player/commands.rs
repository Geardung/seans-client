//! Tauri commands for the libmpv player (M7).
//!
//! All commands are local: media URLs are supplied by the frontend after
//! `fetchFileUrl` (presigned), and the DLL is loaded only from bundled
//! resources next to `seans.exe`. No network I/O and no runtime DLL download.

use tauri::AppHandle;

use super::session::{self, PlayerSnapshot, TrackInfo};

/// Start playback of `url` in the embedded libmpv surface.
///
/// * `start_at` — optional resume position in seconds (M9 history hook).
/// * `hwnd_hint` — optional override HWND; normally omitted (child host window
///   is created automatically as a child of the main Tauri window).
#[tauri::command]
pub fn player_open(
    app: AppHandle,
    url: String,
    start_at: Option<f64>,
    hwnd_hint: Option<i64>,
) -> Result<(), String> {
    if url.trim().is_empty() {
        return Err(super::ffi::OPEN_FAILED_ERROR.to_string());
    }
    let parent = match hwnd_hint {
        Some(h) if h != 0 => h as isize,
        _ => session::main_window_hwnd(&app)?,
    };
    session::open(app, url, parent, start_at)
}

#[tauri::command]
pub fn player_play() -> Result<(), String> {
    session::play()
}

#[tauri::command]
pub fn player_pause() -> Result<(), String> {
    session::pause()
}

#[tauri::command]
pub fn player_toggle_pause() -> Result<(), String> {
    session::toggle_pause()
}

/// Absolute seek to `seconds` (clamped to the media duration).
#[tauri::command]
pub fn player_seek(seconds: f64) -> Result<(), String> {
    session::seek(seconds)
}

/// Set playback speed, clamped to 0.25–2.0.
#[tauri::command]
pub fn player_set_speed(speed: f64) -> Result<(), String> {
    session::set_speed(speed)
}

#[tauri::command]
pub fn player_set_volume(volume: f64) -> Result<(), String> {
    session::set_volume(volume)
}

#[tauri::command]
pub fn player_set_mute(mute: bool) -> Result<(), String> {
    session::set_mute(mute)
}

/// Select an audio track by id (`<= 0` disables audio).
#[tauri::command]
pub fn player_set_audio_track(id: i64) -> Result<(), String> {
    session::set_audio_track(id)
}

/// Select a subtitle track by id; `null` / `<= 0` turns subtitles off.
#[tauri::command]
pub fn player_set_subtitle_track(id: Option<i64>) -> Result<(), String> {
    session::set_subtitle_track(id)
}

#[tauri::command]
pub fn player_list_tracks() -> Result<Vec<TrackInfo>, String> {
    session::list_tracks()
}

#[tauri::command]
pub fn player_set_fullscreen(app: AppHandle, enabled: bool) -> Result<(), String> {
    session::set_fullscreen(&app, enabled)
}

#[tauri::command]
pub fn player_toggle_fullscreen(app: AppHandle) -> Result<(), String> {
    session::toggle_fullscreen(&app)
}

#[tauri::command]
pub fn player_get_state() -> Result<PlayerSnapshot, String> {
    Ok(session::current_state())
}

/// Release the libmpv session and the child host window (route leave / close).
#[tauri::command]
pub fn player_destroy() -> Result<(), String> {
    session::destroy();
    Ok(())
}

/// Resize the mpv child window after a Tauri window resize.
#[tauri::command]
pub fn player_sync_size() -> Result<(), String> {
    session::sync_host_size();
    Ok(())
}
