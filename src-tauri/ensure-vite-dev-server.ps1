$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$targetScript = Join-Path $scriptDir '..\tools\ensure-vite-dev-server.ps1'
$resolvedTargetScript = (Resolve-Path $targetScript).Path

Get-Process -Name 'uni-hwp-studio' -ErrorAction SilentlyContinue | Stop-Process -Force

& $resolvedTargetScript
