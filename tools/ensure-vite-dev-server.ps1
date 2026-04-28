$ErrorActionPreference = 'Stop'

function Test-ViteServer {
  param(
    [string]$Url
  )

  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch {
    return $false
  }
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path (Join-Path $scriptDir '..')).Path
$studioDir = Join-Path $repoRoot 'rhwp-studio'
$logDir = Join-Path $repoRoot 'Release_Temp\codex-logs'
$viteUrl = 'http://localhost:7710'
$viteOutLog = Join-Path $logDir 'vite-managed.out.log'
$viteErrLog = Join-Path $logDir 'vite-managed.err.log'

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

if (Test-ViteServer -Url $viteUrl) {
  Write-Host "[ensure-vite] Reusing existing Vite dev server on $viteUrl"
  exit 0
}

$viteCommand = @(
  "Set-Location '$studioDir'"
  "& npm.cmd run dev -- --host localhost --port 7710 --strictPort 1>> '$viteOutLog' 2>> '$viteErrLog'"
) -join '; '

Start-Process `
  -FilePath 'powershell' `
  -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', $viteCommand) `
  -WindowStyle Hidden | Out-Null

for ($attempt = 0; $attempt -lt 60; $attempt++) {
  Start-Sleep -Seconds 1

  if (Test-ViteServer -Url $viteUrl) {
    Write-Host "[ensure-vite] Vite dev server ready on $viteUrl"
    exit 0
  }
}

Write-Error "[ensure-vite] Timed out waiting for Vite dev server on $viteUrl"
exit 1
