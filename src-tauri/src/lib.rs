use tauri::{Emitter, Manager};

/// Focus and raise the main window (single-instance / deep-link wake-up).
fn focus_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

/// Collect `seans://` URLs from a process argv (second launch / protocol activation).
fn urls_from_argv(argv: &[String]) -> Vec<String> {
    argv
        .iter()
        .filter(|arg| arg.to_lowercase().starts_with("seans://"))
        .cloned()
        .collect()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Second process forwards its args to the first and exits.
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            let urls = urls_from_argv(&argv);
            if !urls.is_empty() {
                // Same event name the deep-link plugin uses; JS `onOpenUrl` consumes it.
                let _ = app.emit("deep-link://new-url", urls);
            }
            focus_main_window(app);
        }))
        .plugin(tauri_plugin_deep_link::init())
        .setup(|app| {
            #[cfg(desktop)]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                app.deep_link().register_all()?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![])
        .build(tauri::generate_context!())
        .expect("error while building Seans")
        .run(|app_handle, event| {
            if let tauri::RunEvent::Opened { urls } = event {
                let urls: Vec<String> = urls.iter().map(|u| u.to_string()).collect();
                if !urls.is_empty() {
                    let _ = app_handle.emit("deep-link://new-url", urls);
                }
                focus_main_window(app_handle);
            }
        });
}
