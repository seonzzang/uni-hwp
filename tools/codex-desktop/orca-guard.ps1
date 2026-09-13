[CmdletBinding()]
param(
    [int]$PollSeconds = 5,
    [string]$LogPath = "$PSScriptRoot\orca-guard.log"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Stop-OrcaProcess {
    param([System.Diagnostics.Process]$Process, [string]$CommandLine)

    $stamp = (Get-Date).ToUniversalTime().ToString('o')
    $line = "$stamp`tpid=$($Process.Id)`tname=$($Process.ProcessName)`tcommand=$CommandLine"
    Add-Content -LiteralPath $LogPath -Value $line -Encoding UTF8
    try {
        Stop-Process -Id $Process.Id -Force -ErrorAction Stop
    } catch [Microsoft.PowerShell.Commands.ProcessCommandException] {
        # The process may have exited between discovery and termination.
    }
}

while ($true) {
    try {
        $processes = Get-CimInstance Win32_Process | Where-Object {
            $_.Name -match '(?i)^orca(?:\.exe|\.cmd)?$' -or
            ($_.Name -match '(?i)^node(?:\.exe)?$' -and
             $_.CommandLine -match '(?i)(^|[\\/ ])orca(?:\.cmd|\.js)(?:\s|$)')
        }
        foreach ($process in $processes) {
            $live = Get-Process -Id $process.ProcessId -ErrorAction SilentlyContinue
            if ($null -ne $live) {
                Stop-OrcaProcess -Process $live -CommandLine ([string]$process.CommandLine)
            }
        }
    } catch {
        $stamp = (Get-Date).ToUniversalTime().ToString('o')
        Add-Content -LiteralPath $LogPath -Value "$stamp`tguard-error`t$($_.Exception.Message)" -Encoding UTF8
    }
    Start-Sleep -Seconds ([Math]::Max(1, $PollSeconds))
}
