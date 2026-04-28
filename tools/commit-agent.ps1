param(
    [Parameter(Mandatory = $true)]
    [string]$Message,

    [string[]]$Paths = @()
)

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $PSCommandPath
$repoRoot = Split-Path -Parent $scriptDir

Push-Location $repoRoot
try {
    if ($Paths.Count -gt 0) {
        foreach ($path in $Paths) {
            git add -- $path
        }
    } else {
        git add -A
    }

    $staged = git diff --cached --name-only
    if (-not $staged) {
        Write-Host "[commit-agent] No staged changes. Skipping commit."
        exit 0
    }

    Write-Host "[commit-agent] Staged files:"
    $staged | ForEach-Object { Write-Host "  - $_" }

    git commit -m $Message
}
finally {
    Pop-Location
}
