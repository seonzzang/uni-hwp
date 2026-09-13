# Codex Desktop guard

`orca-guard.ps1` watches for processes named `orca` and stops only those
processes. It does not stop ChatGPT, Codex, or the normal
`codex-computer-use` runtime.

Install the per-user logon guard from an elevated-free PowerShell prompt:

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File .\tools\codex-desktop\install-orca-guard.ps1
```

The guard task is `Uni-HWP-OrcaGuard`. Termination events and guard errors are
written to `tools/codex-desktop/orca-guard.log`. The task can be inspected with
`Get-ScheduledTask -TaskName Uni-HWP-OrcaGuard` and removed with
`Unregister-ScheduledTask -TaskName Uni-HWP-OrcaGuard` if the user no longer
wants the protection.
