$ErrorActionPreference = 'Stop'

$upstreamCandidates = @(
  'https://github.com/edwardkim/rhwp.git',
  'https://github.com/pureink-studio/rhwp.git'
)

$result = [ordered]@{
  checkedAt = (Get-Date).ToString('o')
  selectedUpstream = $null
  upstreamHead = $null
  upstreamMain = $null
  upstreamDevel = $null
  latestTag = $null
  protectedLocalPaths = @(
    'src/**',
    'pkg/**',
    'Cargo.toml',
    'Cargo.lock',
    'rhwp-studio/public/rhwp.js',
    'web/rhwp.js',
    'typescript/rhwp.d.ts'
  )
  appBoundaryPaths = @(
    'rhwp-studio/src/engine-boundary/**',
    'rhwp-studio/src/app/**',
    'rhwp-studio/src/command/**',
    'rhwp-studio/src/print/**',
    'rhwp-studio/src/pdf/**',
    'rhwp-studio/src/ui/**',
    'rhwp-studio/src/view/**',
    'src-tauri/**'
  )
  candidates = @()
}

function Get-LatestSemverTag {
  param([array]$Tags)

  $versions = foreach ($tag in $Tags) {
    if ($tag.name -match '^v?(\d+\.\d+\.\d+)(?:-.+)?$') {
      [pscustomobject]@{
        version = [version]$matches[1]
        tag = $tag
      }
    }
  }

  return ($versions | Sort-Object version | Select-Object -Last 1).tag
}

foreach ($url in $upstreamCandidates) {
  $candidate = [ordered]@{
    url = $url
    reachable = $false
    head = $null
    main = $null
    devel = $null
    tags = @()
    error = $null
  }

  try {
    $refs = git ls-remote $url HEAD refs/heads/main refs/heads/devel 'refs/tags/*' 2>&1
    if ($LASTEXITCODE -ne 0) {
      throw ($refs -join "`n")
    }

    $candidate.reachable = $true
    foreach ($line in $refs) {
      if ($line -match '^([0-9a-f]{40})\s+(.+)$') {
        $sha = $matches[1]
        $ref = $matches[2]
        if ($ref -eq 'HEAD') {
          $candidate.head = $sha
        } elseif ($ref -eq 'refs/heads/main') {
          $candidate.main = $sha
        } elseif ($ref -eq 'refs/heads/devel') {
          $candidate.devel = $sha
        } elseif ($ref -like 'refs/tags/*' -and $ref -notlike '*^{}') {
          $candidate.tags += [ordered]@{
            name = $ref.Replace('refs/tags/', '')
            sha = $sha
          }
        }
      }
    }

    if (-not $result.selectedUpstream) {
      $result.selectedUpstream = $url
      $result.upstreamHead = $candidate.head
      $result.upstreamMain = $candidate.main
      $result.upstreamDevel = $candidate.devel
      $result.latestTag = Get-LatestSemverTag -Tags $candidate.tags
    }
  } catch {
    $candidate.error = $_.Exception.Message
  }

  $result.candidates += $candidate
}

if (-not $result.selectedUpstream) {
  $result | ConvertTo-Json -Depth 8
  throw 'No reachable RHWP upstream candidate found.'
}

$result | ConvertTo-Json -Depth 8
