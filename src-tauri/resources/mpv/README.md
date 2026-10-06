# Bundled libmpv (build-time resources)

These DLLs are **package resources**, not runtime downloads.

Populate this directory once before `tauri dev` / `tauri build`:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\fetch-mpv.ps1
```

Expected contents after a successful fetch (names may vary by build):

- `libmpv-2.dll` — libmpv C API (required)
- dependency DLLs shipped by the same package (ffmpeg, etc.)

Layout at runtime (MSI/NSIS install dir next to `seans.exe`):

```
seans.exe
mpv/libmpv-2.dll
mpv/<dependency>.dll
```

The Rust player loads `libmpv-2.dll` with `LoadLibrary` from this local folder
only. Missing DLL → explicit error, never a network fetch.

AV notes: no packers, no first-launch downloader, nothing is written or executed
from `%TEMP%`. Do not commit the DLLs (see root `.gitignore`).
