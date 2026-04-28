$ErrorActionPreference = 'Stop'

$tempDir = Join-Path $env:TEMP 'uni-hwp-print-worker-smoke'
if (Test-Path $tempDir) {
  Remove-Item -LiteralPath $tempDir -Recurse -Force
}
New-Item -ItemType Directory -Path $tempDir | Out-Null

$svg1 = @'
<svg xmlns="http://www.w3.org/2000/svg" width="794" height="1123" viewBox="0 0 794 1123">
  <rect x="0" y="0" width="794" height="1123" fill="white" stroke="#d5d5d5"/>
  <text x="48" y="96" font-size="28">Smoke Page 1</text>
</svg>
'@

$svg2 = @'
<svg xmlns="http://www.w3.org/2000/svg" width="794" height="1123" viewBox="0 0 794 1123">
  <rect x="0" y="0" width="794" height="1123" fill="white" stroke="#d5d5d5"/>
  <text x="48" y="96" font-size="28">Smoke Page 2</text>
</svg>
'@

$svg1Path = Join-Path $tempDir 'page-1.svg'
$svg2Path = Join-Path $tempDir 'page-2.svg'
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($svg1Path, $svg1, $utf8NoBom)
[System.IO.File]::WriteAllText($svg2Path, $svg2, $utf8NoBom)

$manifestPath = Join-Path $tempDir 'print-job.json'
$outputPdfPath = Join-Path $tempDir 'output.pdf'
$manifest = [ordered]@{
  jobId = 'uni-hwp-print-worker-smoke'
  sourceFileName = 'smoke.hwp'
  outputMode = 'preview'
  pageRange = [ordered]@{
    type = 'all'
  }
  batchSize = 2
  tempDir = $tempDir
  outputPdfPath = $outputPdfPath
  pageCount = 2
  pageSize = [ordered]@{
    widthPx = 794
    heightPx = 1123
    dpi = 96
  }
  svgPagePaths = @(
    $svg1Path,
    $svg2Path
  )
  debugDelayMs = $null
}
$manifestJson = $manifest | ConvertTo-Json -Depth 6
[System.IO.File]::WriteAllText($manifestPath, $manifestJson, $utf8NoBom)

if (-not $env:UNI_HWP_PUPPETEER_EXECUTABLE_PATH) {
  $env:UNI_HWP_PUPPETEER_EXECUTABLE_PATH = $env:BBDG_PUPPETEER_EXECUTABLE_PATH
}

if (-not $env:UNI_HWP_PUPPETEER_EXECUTABLE_PATH) {
  $env:UNI_HWP_PUPPETEER_EXECUTABLE_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
}

node --experimental-strip-types "$PSScriptRoot\..\scripts\print-worker.ts" --generate-pdf $manifestPath

if (-not (Test-Path $outputPdfPath)) {
  throw "print worker smoke failed: output pdf missing ($outputPdfPath)"
}

$outputInfo = Get-Item -LiteralPath $outputPdfPath
Write-Output "PRINT_WORKER_SMOKE_OK"
Write-Output "outputPdfPath=$outputPdfPath"
Write-Output "outputPdfBytes=$($outputInfo.Length)"

$analysisLogPath = Join-Path $tempDir 'print-worker-analysis.log'
if (Test-Path $analysisLogPath) {
  Write-Output "analysisLogPath=$analysisLogPath"
}
