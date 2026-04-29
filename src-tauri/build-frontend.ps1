$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path (Join-Path $scriptDir '..')).Path
$studioDir = Join-Path $repoRoot 'apps\studio'

if (!(Test-Path (Join-Path $studioDir 'package.json'))) {
  throw "apps/studio/package.json not found: $studioDir"
}

$viteProcesses = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
  Where-Object {
    $_.Name -eq 'node.exe' -and
    $_.CommandLine -like '*vite*' -and
    $_.CommandLine -like '*localhost*7710*'
  }

foreach ($process in $viteProcesses) {
  try {
    Stop-Process -Id $process.ProcessId -Force -ErrorAction Stop
  } catch {
    Write-Warning "Failed to stop Vite process $($process.ProcessId): $($_.Exception.Message)"
  }
}

Push-Location $repoRoot
try {
  npm --prefix $studioDir run build
} finally {
  Pop-Location
}
