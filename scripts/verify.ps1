# M1 verification script. Run from repo root in PowerShell:
#   powershell -ExecutionPolicy Bypass -File scripts\verify.ps1
# Expected Node 20+, npm, and (for the last step) MSVC + Rust.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "== 1/5 npm install =="
npm install --no-fund --no-audit
if ($LASTEXITCODE -ne 0) { throw "npm install failed ($LASTEXITCODE)" }

Write-Host "== 2/5 generate icons (idempotent) =="
node scripts/generate-icons.mjs
if ($LASTEXITCODE -ne 0) { throw "icon generation failed ($LASTEXITCODE)" }

Write-Host "== 3/5 npm run typecheck =="
npm run typecheck
if ($LASTEXITCODE -ne 0) { throw "typecheck failed ($LASTEXITCODE)" }

Write-Host "== 4/5 npm test =="
npm test
if ($LASTEXITCODE -ne 0) { throw "tests failed ($LASTEXITCODE)" }

Write-Host "== 5/5 npm run build =="
npm run build
if ($LASTEXITCODE -ne 0) { throw "build failed ($LASTEXITCODE)" }

Write-Host "== optional: npm run tauri build (requires MSVC) =="
npm run tauri build
if ($LASTEXITCODE -ne 0) {
    Write-Host "tauri build failed (often missing MSVC). Frontend checks above are the M1 quality gate."
    Write-Host "Failing command: npm run tauri build"
    exit 1
}

Write-Host "ALL CHECKS PASSED"
