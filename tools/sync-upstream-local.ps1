param(
  [switch]$Apply,
  [string]$UpstreamUrl = 'https://github.com/edwardkim/rhwp.git',
  [string]$UpstreamBranch = 'main'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $repoRoot

$syncPaths = @(
  'assets'
  'bindings'
  'examples'
  'npm'
  'samples'
  'src'
  'scripts'
  'template'
  'tests'
  'ttfs'
  'typescript'
)

function Assert-SyncBoundary {
  param(
    [string[]]$Paths
  )

  $blockedPaths = @(
    'Cargo.toml'
    'Cargo.lock'
    'apps'
    'site'
    'docs/public'
    '.github/workflows'
    'src-tauri'
    'web'
  )

  foreach ($blocked in $blockedPaths) {
    foreach ($path in $Paths) {
      if ($path -eq $blocked -or $path.StartsWith("$blocked/")) {
        throw "sync boundary violation: $blocked is in sync list"
      }
    }
  }

  Write-Host 'SYNC_BOUNDARY_OK'
}

function Invoke-Git {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)

  & git @Args
  if ($LASTEXITCODE -ne 0) {
    throw "git $($Args -join ' ') failed with exit code $LASTEXITCODE"
  }
}

function Test-GitPathExists {
  param([string]$RefSpec)

  & git cat-file -e $RefSpec 2>$null
  return ($LASTEXITCODE -eq 0)
}

Write-Host "Repo root: $repoRoot"
Write-Host "Upstream: $UpstreamUrl [$UpstreamBranch]"

if ($Apply -and (git status --porcelain)) {
  throw 'Working tree must be clean before applying upstream sync.'
}

try {
  $currentUpstreamUrl = & git remote get-url upstream 2>$null
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($currentUpstreamUrl)) {
    Invoke-Git remote add upstream $UpstreamUrl
  } else {
    Invoke-Git remote set-url upstream $UpstreamUrl
  }
} catch {
  Invoke-Git remote add upstream $UpstreamUrl
}

Invoke-Git fetch upstream $UpstreamBranch --tags

Assert-SyncBoundary -Paths $syncPaths

$availablePaths = @()
foreach ($path in $syncPaths) {
  if (Test-GitPathExists "upstream/${UpstreamBranch}:$path") {
    $availablePaths += $path
  }
}

if (-not $availablePaths) {
  Write-Host 'No sync paths exist in upstream; nothing to do.'
  exit 0
}

if (-not $Apply) {
  Write-Host 'Preview mode: no files will be changed.'
  Write-Host ''
  $changedFiles = & git diff --name-only "HEAD..upstream/$UpstreamBranch" -- @availablePaths
  if ($changedFiles) {
    Write-Host 'Changed files in allowed scope:'
    $changedFiles
    Write-Host ''
    Write-Host 'Diff summary:'
    & git diff --stat "HEAD..upstream/$UpstreamBranch" -- @availablePaths
  } else {
    Write-Host 'No changes in the allowed sync scope.'
  }
  exit 0
}

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$branchName = "sync/upstream-local-$timestamp"
Invoke-Git switch -c $branchName

foreach ($path in $availablePaths) {
  if (Test-Path $path) {
    Remove-Item -LiteralPath $path -Recurse -Force
  }
  Invoke-Git checkout "upstream/$UpstreamBranch" -- $path
}

Write-Host ''
Write-Host "Applied upstream paths on branch $branchName"
Write-Host 'Review with `git diff`, then commit only after local verification passes.'
Write-Host ''
Invoke-Git status --short
