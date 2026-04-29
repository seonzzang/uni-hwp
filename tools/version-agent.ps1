param()

$ErrorActionPreference = "Stop"

function Get-RepoRoot {
  $scriptPath = $PSCommandPath
  if (-not $scriptPath) {
    $scriptPath = $MyInvocation.MyCommand.Path
  }
  $scriptDir = Split-Path -Parent $scriptPath
  return (Resolve-Path (Join-Path $scriptDir "..")).Path
}

function Get-StagedFiles([string]$repoRoot) {
  $output = git -C $repoRoot diff --cached --name-only --diff-filter=ACMR
  if (-not $output) { return @() }
  return @($output | Where-Object { $_ -and $_.Trim().Length -gt 0 })
}

function Get-CodeFiles([string[]]$stagedFiles) {
  $skip = @(
    'CHANGELOG.md',
    'Cargo.lock',
    'apps/studio/package-lock.json',
    'VERSION_AGENT.md',
    '.githooks/pre-commit',
    'tools/version-agent.ps1'
  )

  return @(
    $stagedFiles | Where-Object {
      $normalized = $_.Replace('\', '/')
      -not ($skip -contains $normalized)
    }
  )
}

function Get-CurrentVersion([string]$cargoTomlPath) {
  $content = Get-Content -LiteralPath $cargoTomlPath -Raw
  $match = [regex]::Match($content, '(?m)^version = "(\d+)\.(\d+)\.(\d+)"')
  if (-not $match.Success) {
    throw "Could not find semver version in $cargoTomlPath"
  }

  return [PSCustomObject]@{
    Major = [int]$match.Groups[1].Value
    Minor = [int]$match.Groups[2].Value
    Patch = [int]$match.Groups[3].Value
    Value = $match.Value
  }
}

function Get-NextVersion([object]$currentVersion) {
  return '{0}.{1}.{2}' -f $currentVersion.Major, $currentVersion.Minor, ($currentVersion.Patch + 1)
}

function Update-TextFile([string]$path, [scriptblock]$transform) {
  if (-not (Test-Path -LiteralPath $path)) { return $false }
  $original = Get-Content -LiteralPath $path -Raw
  $updated = & $transform $original
  if ($updated -ne $original) {
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($path, $updated, $utf8NoBom)
    return $true
  }
  return $false
}

function Update-VersionFiles([string]$repoRoot, [string]$nextVersion) {
  $updatedPaths = New-Object System.Collections.Generic.List[string]

  $targets = @(
    (Join-Path $repoRoot 'Cargo.toml'),
    (Join-Path $repoRoot 'apps\studio\package.json'),
    (Join-Path $repoRoot 'src-tauri\Cargo.toml'),
    (Join-Path $repoRoot 'src-tauri\tauri.conf.json')
  )

  foreach ($target in $targets) {
    if (-not (Test-Path -LiteralPath $target)) { continue }

    $changed = Update-TextFile $target {
      param($content)

      if ($target.EndsWith('package.json') -or $target.EndsWith('tauri.conf.json')) {
        $regex = [regex]::new('"version"\s*:\s*"[^"]+"')
        return $regex.Replace($content, ('"version": "{0}"' -f $nextVersion), 1)
      }

      $regex = [regex]::new('^version = "\d+\.\d+\.\d+"', [System.Text.RegularExpressions.RegexOptions]::Multiline)
      return $regex.Replace($content, ('version = "{0}"' -f $nextVersion), 1)
    }

    if ($changed) {
      $updatedPaths.Add($target)
    }
  }

  return ,$updatedPaths
}

function Update-Changelog([string]$repoRoot, [string]$nextVersion, [string[]]$codeFiles) {
  $changelogPath = Join-Path $repoRoot 'CHANGELOG.md'
  if (-not (Test-Path -LiteralPath $changelogPath)) {
    return $false
  }

  $today = Get-Date -Format 'yyyy-MM-dd'
  $entryHeader = "## [$nextVersion] — $today"
  $content = Get-Content -LiteralPath $changelogPath -Raw
  if ($content.Contains($entryHeader)) {
    return $false
  }

  $notes = $codeFiles | ForEach-Object {
    "- ``$($_.Replace('\', '/'))``"
  }

  $entry = @(
    $entryHeader,
    '',
    '### Automated Release Notes',
    '- Version bumped automatically by Version Agent.',
    '- Changed files included in this commit:'
  ) + $notes + @('', '')

  $lines = Get-Content -LiteralPath $changelogPath
  if ($lines.Length -ge 2) {
    $newContent = @(
      $lines[0],
      '',
      $lines[1],
      '',
      ($entry -join [Environment]::NewLine),
      (($lines | Select-Object -Skip 2) -join [Environment]::NewLine)
    ) -join [Environment]::NewLine
  } else {
    $newContent = (($entry + $lines) -join [Environment]::NewLine)
  }

  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($changelogPath, $newContent, $utf8NoBom)
  return $true
}

$repoRoot = Get-RepoRoot
$stagedFiles = Get-StagedFiles $repoRoot

if ($stagedFiles.Count -eq 0) {
  Write-Host "[version-agent] No staged files. Skipping."
  exit 0
}

$codeFiles = Get-CodeFiles $stagedFiles
if ($codeFiles.Count -eq 0) {
  Write-Host "[version-agent] Only metadata changes staged. Skipping."
  exit 0
}

$cargoTomlPath = Join-Path $repoRoot 'Cargo.toml'
$currentVersion = Get-CurrentVersion $cargoTomlPath
$nextVersion = Get-NextVersion $currentVersion

Write-Host "[version-agent] Bumping version $($currentVersion.Major).$($currentVersion.Minor).$($currentVersion.Patch) -> $nextVersion"

$updatedPaths = Update-VersionFiles $repoRoot $nextVersion
$changelogUpdated = Update-Changelog $repoRoot $nextVersion $codeFiles

if ($changelogUpdated) {
  $updatedPaths.Add((Join-Path $repoRoot 'CHANGELOG.md'))
}

foreach ($path in $updatedPaths) {
  git -C $repoRoot add -- $path | Out-Null
}

exit 0
