//! Win32 child window used as the mpv `wid` render target (M7).
//!
//! Strategy (v1): create a `STATIC` child of the main Tauri window and pass its
//! HWND to libmpv via the `wid` option **before** `mpv_initialize`. The child
//! sits at the bottom of the sibling Z-order so the WebView2 (transparent on
//! the player route) draws overlay controls on top. This is simpler and more
//! robust than the D3D11 `mpv_render_context` path and is enough for a
//! full-bleed player surface.

#![cfg(windows)]

use windows_sys::Win32::Foundation::HWND;
use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
use windows_sys::Win32::UI::WindowsAndMessaging::{
    CreateWindowExW, DestroyWindow, GetClientRect, MoveWindow, SetWindowPos, ShowWindow,
    HWND_BOTTOM, SW_SHOW, WINDOW_EX_STYLE, WS_CHILD, WS_CLIPCHILDREN, WS_CLIPSIBLINGS, WS_VISIBLE,
};

/// Child host window over which libmpv draws video.
pub struct HostWindow {
    hwnd: HWND,
    parent: HWND,
}

fn wide_null(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

impl HostWindow {
    /// Create a child window covering the full client area of `parent`.
    pub fn create(parent: isize) -> Result<HostWindow, String> {
        let parent = parent as HWND;
        if parent.is_null() {
            return Err("player host: null parent HWND".to_string());
        }

        let class_name = wide_null("STATIC");
        let window_name = wide_null("mpv-host");
        let hinstance = unsafe { GetModuleHandleW(std::ptr::null()) };

        let hwnd = unsafe {
            CreateWindowExW(
                0 as WINDOW_EX_STYLE,
                class_name.as_ptr(),
                window_name.as_ptr(),
                WS_CHILD | WS_VISIBLE | WS_CLIPSIBLINGS | WS_CLIPCHILDREN,
                0,
                0,
                1,
                1,
                parent,
                std::ptr::null_mut(),
                hinstance,
                std::ptr::null(),
            )
        };

        if hwnd.is_null() {
            return Err("player host: CreateWindowExW failed".to_string());
        }

        // Keep the webview (sibling) above so HTML controls can overlay video.
        unsafe {
            SetWindowPos(hwnd, HWND_BOTTOM, 0, 0, 0, 0, 0x0013 /* NOSIZE|NOMOVE|NOACTIVATE */);
            ShowWindow(hwnd, SW_SHOW);
        }

        let host = HostWindow { hwnd, parent };
        host.fit_parent();
        Ok(host)
    }

    pub fn hwnd(&self) -> isize {
        self.hwnd as isize
    }

    /// Resize the host to the parent client area (full-bleed video surface).
    pub fn fit_parent(&self) {
        let mut rect = windows_sys::Win32::Foundation::RECT {
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
        };
        let ok = unsafe { GetClientRect(self.parent, &mut rect) };
        if ok == 0 {
            return;
        }
        let w = rect.right - rect.left;
        let h = rect.bottom - rect.top;
        if w > 0 && h > 0 {
            unsafe {
                MoveWindow(self.hwnd, 0, 0, w, h, 1);
            }
        }
    }

    /// Resize the host to an explicit client-relative rectangle.
    pub fn resize(&self, x: i32, y: i32, width: i32, height: i32) {
        let w = width.max(1);
        let h = height.max(1);
        unsafe {
            MoveWindow(self.hwnd, x, y, w, h, 1);
        }
    }

    pub fn destroy(&mut self) {
        if !self.hwnd.is_null() {
            unsafe {
                DestroyWindow(self.hwnd);
            }
            self.hwnd = std::ptr::null_mut();
        }
    }
}

impl Drop for HostWindow {
    fn drop(&mut self) {
        self.destroy();
    }
}

/// Extract the Win32 HWND of a Tauri webview window (main window).
pub fn hwnd_from_tauri(window: &tauri::WebviewWindow) -> Result<isize, String> {
    use raw_window_handle::{HasWindowHandle, RawWindowHandle};

    let handle = window
        .window_handle()
        .map_err(|e| format!("player host: no window handle ({e})"))?;
    match handle.as_raw() {
        RawWindowHandle::Win32(h) => {
            let ptr = h.hwnd.get() as isize;
            if ptr == 0 {
                Err("player host: null Win32 HWND".to_string())
            } else {
                Ok(ptr)
            }
        }
        _ => Err("player host: not a Win32 window".to_string()),
    }
}
