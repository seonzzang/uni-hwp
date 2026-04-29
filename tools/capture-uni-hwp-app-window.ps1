param(
  [string]$ProcessName = "uni-hwp",
  [string]$OutputPath = "",
  [switch]$SendCtrlP,
  [switch]$ClickFileMenu,
  [switch]$ClickPrintMenuItem,
  [switch]$SendAltFilePrint,
  [switch]$ClickDialogCurrentPageRadio,
  [switch]$ClickDialogPageRangeRadio,
  [switch]$ClickDialogPdfExportMode,
  [switch]$ClickDialogLegacyPrintMode,
  [switch]$ClickDialogPrint,
  [switch]$ClickDialogCancel,
  [int]$DelayMs = 1200
)

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

$user32Source = @"
using System;
using System.Runtime.InteropServices;

public static class NativeWindowTools
{
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);

    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder text, int count);

    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int x, int y);

    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);
}
"@

Add-Type -TypeDefinition $user32Source -Language CSharp

$MOUSEEVENTF_LEFTDOWN = 0x0002
$MOUSEEVENTF_LEFTUP = 0x0004

function Invoke-WindowLeftClick {
  param(
    [int]$X,
    [int]$Y
  )

  [NativeWindowTools]::SetCursorPos($X, $Y) | Out-Null
  Start-Sleep -Milliseconds 120
  [NativeWindowTools]::mouse_event($MOUSEEVENTF_LEFTDOWN, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 60
  [NativeWindowTools]::mouse_event($MOUSEEVENTF_LEFTUP, 0, 0, 0, [UIntPtr]::Zero)
}

function Get-MainWindowProcess {
  param([string]$Name)

  return Get-Process -Name $Name -ErrorAction SilentlyContinue |
    Where-Object { $_.MainWindowHandle -ne 0 } |
    Select-Object -First 1
}

function Get-ForegroundWindowTitle {
  $handle = [NativeWindowTools]::GetForegroundWindow()
  if ($handle -eq [IntPtr]::Zero) {
    return ''
  }

  $builder = New-Object System.Text.StringBuilder 512
  [NativeWindowTools]::GetWindowText($handle, $builder, $builder.Capacity) | Out-Null
  return $builder.ToString()
}

function Ensure-AppForeground {
  param(
    [System.Diagnostics.Process]$Process,
    [int]$RetryCount = 5
  )

  $shell = $null
  try {
    $shell = New-Object -ComObject WScript.Shell
  } catch {
    $shell = $null
  }

  for ($attempt = 0; $attempt -lt $RetryCount; $attempt++) {
    [NativeWindowTools]::ShowWindow($Process.MainWindowHandle, 9) | Out-Null
    [NativeWindowTools]::SetForegroundWindow($Process.MainWindowHandle) | Out-Null
    if ($shell -ne $null) {
      $null = $shell.AppActivate($Process.Id)
      $null = $shell.AppActivate('Uni-HWP')
    }
    Start-Sleep -Milliseconds 120

    $title = Get-ForegroundWindowTitle
    if ($title -like '*Uni-HWP*') {
      return
    }
  }

  throw "앱 포커스를 확보하지 못했습니다. 현재 foreground: $(Get-ForegroundWindowTitle)"
}

$process = Get-MainWindowProcess -Name $ProcessName
if (-not $process) {
  throw "메인 창이 있는 프로세스를 찾지 못했습니다: $ProcessName"
}

Ensure-AppForeground -Process $process

$rect = New-Object NativeWindowTools+RECT
[NativeWindowTools]::GetWindowRect($process.MainWindowHandle, [ref]$rect) | Out-Null

$width = [Math]::Max(1, $rect.Right - $rect.Left)
$height = [Math]::Max(1, $rect.Bottom - $rect.Top)

$focusX = $rect.Left + [Math]::Min(180, [Math]::Max(40, [int]($width * 0.2)))
$focusY = $rect.Top + [Math]::Min(140, [Math]::Max(90, [int]($height * 0.15)))
Ensure-AppForeground -Process $process
Invoke-WindowLeftClick -X $focusX -Y $focusY
Start-Sleep -Milliseconds 250

if ($SendCtrlP) {
  Ensure-AppForeground -Process $process
  [System.Windows.Forms.SendKeys]::SendWait("^p")
  Start-Sleep -Milliseconds $DelayMs
}

if ($SendAltFilePrint) {
  Ensure-AppForeground -Process $process
  [System.Windows.Forms.SendKeys]::SendWait("%f")
  Start-Sleep -Milliseconds 250
  [System.Windows.Forms.SendKeys]::SendWait("p")
  Start-Sleep -Milliseconds $DelayMs
}

if ($ClickFileMenu) {
  Ensure-AppForeground -Process $process
  $fileMenuX = $rect.Left + 34
  $fileMenuY = $rect.Top + 42
  Invoke-WindowLeftClick -X $fileMenuX -Y $fileMenuY
  Start-Sleep -Milliseconds 350
}

if ($ClickPrintMenuItem) {
  Ensure-AppForeground -Process $process
  $printMenuX = $rect.Left + 88
  $printMenuY = $rect.Top + 190
  Invoke-WindowLeftClick -X $printMenuX -Y $printMenuY
  Start-Sleep -Milliseconds $DelayMs
}

if ($ClickDialogCurrentPageRadio) {
  Ensure-AppForeground -Process $process
  $currentPageRadioX = $rect.Left + 391
  $currentPageRadioY = $rect.Top + 350
  Invoke-WindowLeftClick -X $currentPageRadioX -Y $currentPageRadioY
  Start-Sleep -Milliseconds $DelayMs
}

if ($ClickDialogPageRangeRadio) {
  Ensure-AppForeground -Process $process
  $pageRangeRadioX = $rect.Left + 391
  $pageRangeRadioY = $rect.Top + 379
  Invoke-WindowLeftClick -X $pageRangeRadioX -Y $pageRangeRadioY
  Start-Sleep -Milliseconds $DelayMs
}

if ($ClickDialogPdfExportMode) {
  Ensure-AppForeground -Process $process
  $pdfModeRadioX = $rect.Left + 391
  $pdfModeRadioY = $rect.Top + 461
  Invoke-WindowLeftClick -X $pdfModeRadioX -Y $pdfModeRadioY
  Start-Sleep -Milliseconds $DelayMs
}

if ($ClickDialogLegacyPrintMode) {
  Ensure-AppForeground -Process $process
  $legacyModeRadioX = $rect.Left + 391
  $legacyModeRadioY = $rect.Top + 505
  Invoke-WindowLeftClick -X $legacyModeRadioX -Y $legacyModeRadioY
  Start-Sleep -Milliseconds $DelayMs
}

if ($ClickDialogPrint) {
  Ensure-AppForeground -Process $process
  $printButtonX = $rect.Left + $width - 258
  $printButtonY = $rect.Top + $height - 188
  Invoke-WindowLeftClick -X $printButtonX -Y $printButtonY
  Start-Sleep -Milliseconds $DelayMs
}

if ($ClickDialogCancel) {
  Ensure-AppForeground -Process $process
  $cancelButtonX = $rect.Left + $width - 182
  $cancelButtonY = $rect.Top + $height - 188
  Invoke-WindowLeftClick -X $cancelButtonX -Y $cancelButtonY
  Start-Sleep -Milliseconds $DelayMs
}

$bitmap = New-Object System.Drawing.Bitmap($width, $height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($rect.Left, $rect.Top, 0, 0, $bitmap.Size)

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
  $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $OutputPath = Join-Path (Get-Location) "mydocs\\working\\app-control-logs\\app-capture-$timestamp.png"
}

$outputDirectory = Split-Path -Path $OutputPath -Parent
if (-not (Test-Path $outputDirectory)) {
  New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
}

$bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bitmap.Dispose()

[pscustomobject]@{
  processId = $process.Id
  title = $process.MainWindowTitle
  outputPath = $OutputPath
  width = $width
  height = $height
}
