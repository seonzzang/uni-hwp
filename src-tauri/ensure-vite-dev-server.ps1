$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$studioRoot = Join-Path $projectRoot 'apps\studio'
$url = 'http://localhost:7710'

try {
    $request = Invoke-WebRequest -Uri $url -Method Head -TimeoutSec 2 -UseBasicParsing
    if ($request.StatusCode -ge 200 -and $request.StatusCode -lt 500) {
        exit 0
    }
} catch {
    # The dev server is not running; start it below.
}

$npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npm) {
    $npm = Get-Command npm -ErrorAction SilentlyContinue
}
if (-not $npm) {
    throw 'npm 실행 파일을 찾을 수 없습니다.'
}

Start-Process -FilePath $npm.Source `
    -ArgumentList @('run', 'dev', '--', '--host', '127.0.0.1', '--port', '7710') `
    -WorkingDirectory $studioRoot `
    -WindowStyle Hidden

for ($attempt = 0; $attempt -lt 30; $attempt++) {
    Start-Sleep -Milliseconds 250
    try {
        $request = Invoke-WebRequest -Uri $url -Method Head -TimeoutSec 2 -UseBasicParsing
        if ($request.StatusCode -ge 200 -and $request.StatusCode -lt 500) {
            exit 0
        }
    } catch {
        # Keep polling while Vite starts.
    }
}

throw 'Vite 개발 서버가 제한 시간 안에 시작되지 않았습니다.'
