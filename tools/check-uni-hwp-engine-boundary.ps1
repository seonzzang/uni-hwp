$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$srcRoot = Join-Path $root 'apps\studio\src'
$violations = @()

Get-ChildItem -LiteralPath $srcRoot -Recurse -File -Include *.ts,*.tsx |
  Where-Object {
    $_.FullName -notlike '*\apps\studio\src\core\*' -and
    $_.FullName -notlike '*\apps\studio\src\engine-boundary\*'
  } |
  ForEach-Object {
    $matches = Select-String -LiteralPath $_.FullName -Pattern @(
      '@/core/wasm-bridge',
      "from './wasm-bridge",
      'from "./wasm-bridge'
    ) -SimpleMatch
    foreach ($match in $matches) {
      $relative = Resolve-Path -LiteralPath $match.Path -Relative
      $violations += "${relative}:$($match.LineNumber): $($match.Line.Trim())"
    }
  }

if ($violations.Count -gt 0) {
  Write-Error ("Engine boundary violation detected:`n" + ($violations -join "`n"))
}

Write-Output 'ENGINE_BOUNDARY_OK'
