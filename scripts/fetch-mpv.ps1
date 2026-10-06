# fetch-mpv.ps1 — download bundled libmpv for the Seans Windows client (M7).
#
# BUILD / DEV TIME ONLY. Never call this from the application at runtime.
# AV policy: no packers, no runtime DLL download — these DLLs are package resources.
#
# Usage (repo root):
#   powershell -ExecutionPolicy Bypass -File scripts\fetch-mpv.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\fetch-mpv.ps1 -Force
#
# Result:
#   src-tauri/resources/mpv/libmpv-2.dll   (+ dependency DLLs from the same package)
#
# Source: shinchiro mpv-winbuild-cmp (official community Windows builds of libmpv).
# Release page: https://github.com/shinchiro/mpv-winbuild-cmp/releases
#
# Pinned asset (winbuild x64). Re-verify SHA256 when bumping:
#   URL:  https://github.com/shinchiro/mpv-winbuild-cmp/releases/download/mpv-x86_64-20240623/mpv-x86_64-20240623.7z
#   SHA256: 8f4c1c2e0a5b9d7e6f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e
#         ^ placeholder — run with -PrintHash after a trusted first download and
#           paste the real value here before shipping. The script refuses to
#           install when the hash is set and does not match.
#
# The archive contains libmpv-2.dll (may be named mpv-2.dll) and its dependent
# DLLs (ffmpeg, etc.). All *.dll files from the package root are copied into
# src-tauri/resources/mpv/ so Windows can resolve them side-by-side.

[CmdletBinding()]
param(
    # Re-download and overwrite even if libmpv-2.dll is already present.
    [switch]$Force,
    # Compute and print the archive SHA256, then exit (no install).
    [switch]$PrintHash,
    # Skip SHA256 enforcement (development only).
    [switch]$SkipHashCheck
)

$ErrorActionPreference = "Stop"

# --- Pinned release (keep URL + hash in sync) ---------------------------------
$ReleaseUrl = "https://github.com/shinchiro/mpv-winbuild-cmp/releases/download/mpv-x86_64-20240623/mpv-x86_64-20240623.7z"
# Expected SHA256 of the archive. "UNLOCKED" disables enforcement until pinned.
$ExpectedSha256 = "8f4c1c2e0a5b9d7e6f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e"

$root = Split-Path -Parent $PSScriptRoot
$destDir = Join-Path $root "src-tauri\resources\mpv"
$dllPath = Join-Path $destDir "libmpv-2.dll"

function Expand-ArchiveAny {
    param([string]$Archive, [string]$Destination)
    if (Test-Path $Destination) {
        Remove-Item -Recurse -Force $Destination
    }
    New-Item -ItemType Directory -Path $Destination | Out-Null

    $sevenZip = Get-Command "7z.exe" -ErrorAction SilentlyContinue
    if ($sevenZip) {
        & $sevenZip.Source x -y "-o$Destination" $Archive | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "7z extraction failed ($LASTEXITCODE)" }
        return
    }

    $tar = Get-Command "tar.exe" -ErrorAction SilentlyContinue
    if ($tar) {
        # Windows 10+ bsdtar understands 7z and zip.
        & $tar.Source -xf $Archive -C $Destination
        if ($LASTEXITCODE -ne 0) { throw "tar extraction failed ($LASTEXITCODE)" }
        return
    }

    if ($Archive.ToLower().EndsWith(".zip")) {
        Expand-Archive -Path $Archive -DestinationPath $Destination -Force
        return
    }

    throw "No 7z.exe or tar.exe on PATH — install 7-Zip or Windows tar to extract $(Split-Path -Leaf $Archive)"
}

# Skip when already bundled (idempotent).
if ((Test-Path $dllPath) -and -not $Force) {
    Write-Host "libmpv-2.dll already present at $dllPath — skip (use -Force to refresh)."
    exit 0
}

New-Item -ItemType Directory -Force -Path $destDir | Out-Null

$workDir = Join-Path ([System.IO.Path]::GetTempPath()) ("seans-mpv-" + [System.Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $workDir | Out-Null
$archivePath = Join-Path $workDir (Split-Path -Leaf $ReleaseUrl)

try {
    Write-Host "Downloading $ReleaseUrl"
    # Local temp file only; the archive never ships and nothing is executed from it.
    Invoke-WebRequest -Uri $ReleaseUrl -OutFile $archivePath -UseBasicParsing

    $sha = (Get-FileHash -Path $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
    Write-Host "SHA256: $sha"

    if ($PrintHash) {
        Write-Host "Pin this value in scripts/fetch-mpv.ps1 as `$ExpectedSha256 = `"$sha`""
        return
    }

    $hashArmed = ($ExpectedSha256 -and $ExpectedSha256 -notmatch '^(UNLOCKED|TODO|PENDING)' -and $ExpectedSha256.Length -eq 64)
    if ($hashArmed -and -not $SkipHashCheck) {
        if ($sha -ne $ExpectedSha256.ToLowerInvariant()) {
            throw "SHA256 mismatch. Expected $($ExpectedSha256), got $sha. Refusing to install."
        }
        Write-Host "SHA256 verified."
    } elseif (-not $SkipHashCheck) {
        Write-Warning "ExpectedSha256 is not pinned yet — archive NOT verified. Run with -PrintHash, pin the value, re-run."
    }

    $extractDir = Join-Path $workDir "extract"
    Expand-ArchiveAny -Archive $archivePath -Destination $extractDir

    # Collect DLLs (root of package, plus common bin/ subfolders).
    $dlls = @()
    $dlls += Get-ChildItem -Path $extractDir -Filter "*.dll" -File -ErrorAction SilentlyContinue
    foreach ($sub in @("bin", "libmpv", "x86_64")) {
        $p = Join-Path $extractDir $sub
        if (Test-Path $p) {
            $dlls += Get-ChildItem -Path $p -Filter "*.dll" -File -ErrorAction SilentlyContinue
        }
    }

    if (-not $dlls) {
        throw "No DLLs found in the extracted package — unexpected archive layout."
    }

    $copied = 0
    foreach ($dll in $dlls) {
        $name = $dll.Name
        # Normalize the C API import name to libmpv-2.dll.
        if ($name -in @("mpv-2.dll", "mpv.dll", "libmpv.dll")) {
            $name = "libmpv-2.dll"
        }
        Copy-Item -Path $dll.FullName -Destination (Join-Path $destDir $name) -Force
        Write-Host "  -> $name"
        $copied += 1
    }

    if (-not (Test-Path $dllPath)) {
        throw "libmpv-2.dll not found after extraction (looked for mpv-2.dll / libmpv-2.dll)."
    }

    Write-Host "Installed $copied DLL(s) into $destDir"
    Write-Host "Bundle them via src-tauri/tauri.conf.json bundle.resources (resources/mpv/ -> mpv/)."
}
finally {
    if (Test-Path $workDir) {
        Remove-Item -Recurse -Force $workDir -ErrorAction SilentlyContinue
    }
}
