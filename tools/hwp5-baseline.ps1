[CmdletBinding()]
param(
    [string]$Root = "samples",
    [string]$OutDir = "output/poc/hwp5-baseline",
    [ValidateRange(1, 300)] [int]$TimeoutSec = 15,
    [ValidateRange(0, 100000)] [int]$MaxFiles = 0,
    [switch]$IncludeLarge,
    [switch]$SkipBuild,
    [switch]$Resume
)

$ErrorActionPreference = "Stop"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$inputRoot = (Resolve-Path (Join-Path $repo $Root)).Path
$out = Join-Path $repo $OutDir
$null = New-Item -ItemType Directory -Force -Path $out
$exe = Join-Path $repo "target\debug\rhwp.exe"
$report = Join-Path $out "report.tsv"
$statePath = Join-Path $out "state.json"
$summaryPath = Join-Path $out "summary.json"
$manifestPath = Join-Path $out "corpus-manifest.json"
$script:interrupted = $false
$script:lastExitCode = 0

function Invoke-BoundedProcess([string]$FilePath, [string[]]$ArgumentList, [string]$WorkingDirectory, [int]$LimitSec) {
    $psi = [System.Diagnostics.ProcessStartInfo]::new()
    $psi.FileName = $FilePath
    $psi.WorkingDirectory = $WorkingDirectory
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    foreach ($arg in $ArgumentList) { [void]$psi.ArgumentList.Add($arg) }
    $p = [System.Diagnostics.Process]::new()
    $p.StartInfo = $psi
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    [void]$p.Start()
    $stdoutTask = $p.StandardOutput.ReadToEndAsync()
    $stderrTask = $p.StandardError.ReadToEndAsync()
    $finished = $p.WaitForExit($LimitSec * 1000)
    if (-not $finished) {
        try { $p.Kill($true) } catch { }
        # Close the redirected streams before reading them.  A timed-out
        # child may leave an async ReadToEnd task pending; waiting on .Result
        # here would prevent the per-file durable state from being written.
        try { $p.WaitForExit(2000) } catch { }
        $sw.Stop()
        $stdout = if ($stdoutTask.IsCompleted) { $stdoutTask.Result } else { "" }
        $stderr = if ($stderrTask.IsCompleted) { $stderrTask.Result } else { "" }
        return [pscustomobject]@{ Status = "UNVERIFIED_TIMEOUT"; ExitCode = 124; ElapsedMs = $sw.ElapsedMilliseconds; Stdout = $stdout; Stderr = $stderr }
    }
    $stdout = $stdoutTask.Result
    $stderr = $stderrTask.Result
    $sw.Stop()
    $status = if ($p.ExitCode -eq 0) { "PASS" } else { "FAIL" }
    return [pscustomobject]@{ Status = $status; ExitCode = $p.ExitCode; ElapsedMs = $sw.ElapsedMilliseconds; Stdout = $stdout; Stderr = $stderr }
}

if (-not $SkipBuild) {
    Write-Host "[build] cargo build --bin rhwp"
    & cargo build --bin rhwp --manifest-path (Join-Path $repo "Cargo.toml")
    if ($LASTEXITCODE -ne 0) { throw "rhwp build failed: $LASTEXITCODE" }
}
if (-not (Test-Path $exe)) { throw "rhwp executable not found: $exe" }

$files = @(Get-ChildItem -LiteralPath $inputRoot -Recurse -File -Filter "*.hwp" |
    Where-Object {
        # Generated evidence can be placed below samples by older runs.  It is
        # never part of the source corpus, even when it has a .hwp extension.
        $relative = [IO.Path]::GetRelativePath($inputRoot, $_.FullName).Replace('\', '/')
        $relative -notmatch '(^|/)(output|roundtrip|target|release-gate|\.git)(/|$)'
    } |
    Sort-Object FullName)
if (-not $IncludeLarge) { $files = @($files | Where-Object Length -le (3MB)) }
if ($MaxFiles -gt 0) { $files = @($files | Select-Object -First $MaxFiles) }
if ($files.Count -eq 0) { throw "No .hwp files in scope: $inputRoot" }

# Freeze and record the exact input set before executing anything.  Resume is
# refused when the set changes, preventing a partial report from being applied
# to a different (or accidentally recursively collected) corpus.
$manifestRows = @($files | ForEach-Object {
    $relative = [IO.Path]::GetRelativePath($inputRoot, $_.FullName).Replace('\', '/')
    "{0}|{1}" -f $relative, $_.Length
})
$manifestText = ($manifestRows -join "`n") + "`n"
$manifestBytes = [Text.Encoding]::UTF8.GetBytes($manifestText)
$manifestHash = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($manifestBytes))
$manifest = [pscustomobject]@{
    schema = 1; root = $Root; input_root = $inputRoot; total = $files.Count
    include_large = [bool]$IncludeLarge; max_files = $MaxFiles
    list_sha256 = $manifestHash; entries = $manifestRows
}
if ($Resume -and (Test-Path -LiteralPath $manifestPath)) {
    $previousManifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    if ($previousManifest.list_sha256 -ne $manifestHash -or [int]$previousManifest.total -ne $files.Count) {
        throw "Corpus manifest changed; refusing unsafe resume. previous=$($previousManifest.list_sha256) current=$manifestHash"
    }
} else {
    $manifest | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath $manifestPath -Encoding utf8
}

$rows = [System.Collections.Generic.List[object]]::new()
$completed = @{}
if ($Resume -and (Test-Path -LiteralPath $report)) {
    foreach ($old in (Import-Csv -LiteralPath $report -Delimiter "`t")) {
        if ($old.sample -and $old.bytes -and $old.evidence_dir) {
            $completed["$($old.sample)|$($old.bytes)"] = $old
            # MaxFiles/부분 재개에서도 이전에 완료한 다른 파일의 report 행을 보존한다.
            $rows.Add($old)
        }
    }
    Write-Host "[resume] 기존 report.tsv에서 $($completed.Count)개 완료 항목을 복원했습니다."
}

# 중단 직후 report.tsv가 flush되지 않은 경우에도, 파일별 디렉터리의 명시적 결과를 복원한다.
# roundtrip PASS 표식과 bench TSV/header가 모두 있어야 하며, 불완전한 디렉터리는 재실행한다.
if ($Resume) {
    for ($i = 0; $i -lt $files.Count; $i++) {
        $file = $files[$i]
        $rel = [IO.Path]::GetRelativePath($inputRoot, $file.FullName).Replace('\', '/')
        $key = "$rel|$($file.Length)"
        if ($completed.ContainsKey($key)) { continue }
        $evidence = Join-Path $out ("{0:D5}" -f ($i + 1))
        $benchOut = Join-Path $evidence "bench.stdout"
        $benchTsv = Join-Path $evidence "bench.tsv"
        $roundOut = Join-Path $evidence "roundtrip.stdout"
        if ((Test-Path $benchOut) -and (Test-Path $benchTsv) -and (Test-Path $roundOut)) {
            $benchText = Get-Content -LiteralPath $benchOut -Raw
            $roundText = Get-Content -LiteralPath $roundOut -Raw
            if ($benchText -match "bench: 단계별 처리 성능" -and $roundText -match "\[\s*PASS\]") {
                $benchMs = 0
                $roundMs = 0
                if ($benchText -match "\s(\d+(?:\.\d+)?)ms\s+TSV:") { $benchMs = [int][double]$Matches[1] }
                if ($roundText -match "\]\s+diff=.*?\s+(\d+)ms\s") { $roundMs = [int]$Matches[1] }
                $old = [pscustomobject]@{
                    sample = $rel; bytes = $file.Length; bench_status = "PASS"; bench_ms = $benchMs
                    roundtrip_status = "PASS"; roundtrip_ms = $roundMs
                    evidence_dir = [IO.Path]::GetRelativePath($repo, $evidence).Replace('\', '/')
                }
                $completed[$key] = $old
                $rows.Add($old)
                Write-Host "[resume] 파일별 증거에서 완료 결과 복원: $rel"
            }
        }
    }
}

function Upsert-BaselineRow($row) {
    for ($i = $rows.Count - 1; $i -ge 0; $i--) {
        if ($rows[$i].sample -eq $row.sample -and "$($rows[$i].bytes)" -eq "$($row.bytes)") {
            $rows.RemoveAt($i)
        }
    }
    $rows.Add($row)
}

function Save-BaselineState {
    $snapshot = [pscustomobject]@{
        schema = 2
        status = if ($script:interrupted) { "INTERRUPTED" } elseif ($rows.Count -lt $files.Count) { "RUNNING" } else { "COMPLETE" }
        exit_code = $script:lastExitCode
        root = $Root
        input_root = $inputRoot
        total = $files.Count
        completed = $rows.Count
        updated_utc = [DateTime]::UtcNow.ToString("o")
        corpus_list_sha256 = $manifestHash
        rows = @($rows)
    }
    $tmp = "$statePath.tmp"
    $snapshot | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $tmp -Encoding utf8
    Move-Item -LiteralPath $tmp -Destination $statePath -Force
    $rows | Export-Csv -LiteralPath $report -Delimiter "`t" -NoTypeInformation -Encoding utf8
}

function Save-CompletionSummary {
    $completion = [pscustomobject]@{
        schema = 2; root = $Root; total = $files.Count; completed = $rows.Count
        status = if ($script:interrupted) { "INTERRUPTED" } elseif ($rows.Count -lt $files.Count) { "RUNNING" } elseif (@($rows | Where-Object { $_.bench_status -eq "FAIL" -or $_.roundtrip_status -eq "FAIL" }).Count -gt 0) { "FAIL" } else { "PASS" }
        exit_code = $script:lastExitCode
        pass = @($rows | Where-Object { $_.bench_status -eq "PASS" -and $_.roundtrip_status -eq "PASS" }).Count
        failed = @($rows | Where-Object { $_.bench_status -eq "FAIL" -or $_.roundtrip_status -eq "FAIL" }).Count
        unverified_timeout = @($rows | Where-Object { $_.bench_status -eq "UNVERIFIED_TIMEOUT" -or $_.roundtrip_status -eq "UNVERIFIED_TIMEOUT" }).Count
        format_unverified = @($rows | Where-Object { $_.roundtrip_status -eq "FORMAT_UNVERIFIED" }).Count
        remaining = [Math]::Max(0, $files.Count - $rows.Count)
        updated_utc = [DateTime]::UtcNow.ToString("o")
        corpus_list_sha256 = $manifestHash
    }
    $tmp = "$summaryPath.tmp"
    $completion | ConvertTo-Json | Set-Content -LiteralPath $tmp -Encoding utf8
    Move-Item -LiteralPath $tmp -Destination $summaryPath -Force
}

# Ctrl+C/host termination must leave the last durable state and a partial summary.
trap {
    $script:interrupted = $true
    $script:lastExitCode = 130
    try { Save-BaselineState; Save-CompletionSummary } catch { }
    Write-Error "HWP5 baseline interrupted; partial state preserved at $out"
    exit 130
}

$index = 0
foreach ($file in $files) {
    $index++
    $rel = [IO.Path]::GetRelativePath($inputRoot, $file.FullName).Replace('\', '/')
    $tag = "{0:D5}" -f $index
    $fileOut = Join-Path $out $tag

    $resumeKey = "$rel|$($file.Length)"
    if ($Resume -and $completed.ContainsKey($resumeKey)) {
        $old = $completed[$resumeKey]
        "[{0}/{1}] resume=SKIP bench={2} roundtrip={3} {4}" -f $index, $files.Count, $old.bench_status, $old.roundtrip_status, $rel
        continue
    }

    $null = New-Item -ItemType Directory -Force -Path $fileOut
    $bench = Invoke-BoundedProcess -FilePath $exe -ArgumentList @("bench", $file.FullName, "-n", "1", "--tsv", (Join-Path $fileOut "bench.tsv")) -WorkingDirectory $repo -LimitSec $TimeoutSec
    [IO.File]::WriteAllText((Join-Path $fileOut "bench.stdout"), $bench.Stdout)
    [IO.File]::WriteAllText((Join-Path $fileOut "bench.stderr"), $bench.Stderr)
    $rt = Invoke-BoundedProcess -FilePath $exe -ArgumentList @("hwp5-roundtrip", $file.FullName, "-o", $fileOut) -WorkingDirectory $repo -LimitSec $TimeoutSec
    [IO.File]::WriteAllText((Join-Path $fileOut "roundtrip.stdout"), $rt.Stdout)
    [IO.File]::WriteAllText((Join-Path $fileOut "roundtrip.stderr"), $rt.Stderr)
    if ($rt.Stdout -match "\[\s*FORMAT_SKIP\]") { $rt.Status = "FORMAT_UNVERIFIED" }
    [pscustomobject]@{
        schema = 1; sample = $rel; bytes = $file.Length; timeout_sec = $TimeoutSec
        bench = $bench; roundtrip = $rt; completed_utc = [DateTime]::UtcNow.ToString("o")
    } | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $fileOut "result.json") -Encoding utf8
    $row = [pscustomobject]@{
        sample = $rel; bytes = $file.Length
        bench_status = $bench.Status; bench_ms = $bench.ElapsedMs
        roundtrip_status = $rt.Status; roundtrip_ms = $rt.ElapsedMs
        evidence_dir = [IO.Path]::GetRelativePath($repo, $fileOut).Replace('\', '/')
    }
    Upsert-BaselineRow $row
    $script:lastExitCode = if ($row.bench_status -eq "UNVERIFIED_TIMEOUT" -or $row.roundtrip_status -eq "UNVERIFIED_TIMEOUT") { 124 } elseif ($row.bench_status -eq "FAIL" -or $row.roundtrip_status -eq "FAIL") { 1 } else { 0 }
    Save-BaselineState
    "[{0}/{1}] bench={2} roundtrip={3} {4}" -f $index, $files.Count, $bench.Status, $rt.Status, $rel
}

$rows | Export-Csv -LiteralPath $report -Delimiter "`t" -NoTypeInformation -Encoding utf8
Save-BaselineState
Save-CompletionSummary
$rows | Group-Object roundtrip_status | Sort-Object Name | ForEach-Object { "roundtrip {0}: {1}" -f $_.Name, $_.Count }
$rows | Group-Object bench_status | Sort-Object Name | ForEach-Object { "bench {0}: {1}" -f $_.Name, $_.Count }
Write-Host "report: $report"
if ($rows | Where-Object { $_.bench_status -eq "UNVERIFIED_TIMEOUT" -or $_.roundtrip_status -eq "UNVERIFIED_TIMEOUT" }) { $script:lastExitCode = 124 }
elseif ($rows | Where-Object { $_.bench_status -eq "FAIL" -or $_.roundtrip_status -eq "FAIL" }) { $script:lastExitCode = 1 }
else { $script:lastExitCode = 0 }
$script:interrupted = $false
Save-BaselineState
Save-CompletionSummary
exit $script:lastExitCode
