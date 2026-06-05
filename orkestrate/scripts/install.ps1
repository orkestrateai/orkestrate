# Canonical copy — also at website/public/cli/install.ps1 (orkestrate.space)
# Usage: irm https://orkestrate.space/cli/install.ps1 | iex

$ErrorActionPreference = "Stop"

$OrkestratePkg = if ($env:ORKESTRATE_PKG) { $env:ORKESTRATE_PKG } else { "orkestrate" }
$OrkestrateVersion = $env:ORKESTRATE_VERSION

function Test-BunOnPath {
  return [bool](Get-Command bun -ErrorAction SilentlyContinue)
}

function Ensure-Bun {
  if (Test-BunOnPath) { return }
  Write-Host "-> Bun not found. Installing from bun.sh..."
  Invoke-Expression (Invoke-WebRequest -Uri "https://bun.sh/install.ps1" -UseBasicParsing).Content
  $bunBin = Join-Path $env:USERPROFILE ".bun\bin"
  if (Test-Path $bunBin) {
    $env:Path = "$bunBin;$env:Path"
  }
}

Ensure-Bun

if (-not (Test-BunOnPath)) {
  Write-Error "Bun install did not succeed. Restart the terminal or add %USERPROFILE%\.bun\bin to PATH, then re-run."
}

$spec = $OrkestratePkg
if ($OrkestrateVersion) {
  $spec = "$OrkestratePkg@$OrkestrateVersion"
}

Write-Host "-> Installing $spec (global)..."
& bun install -g $spec

Write-Host ""
Write-Host "Installed. Open the workbench:"
Write-Host "  orkestrate"
Write-Host ""
Write-Host "Verify harnesses:"
Write-Host "  orkestrate doctor"