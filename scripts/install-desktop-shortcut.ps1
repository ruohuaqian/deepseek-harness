# Install Desktop + Start Menu shortcuts for DeepSeek Harness.
# Paths are derived from this script location so the fork works after clone/pull.
$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$launcher = Join-Path $repoRoot "scripts\launch-dsh-desktop.cmd"
$icon = Join-Path $repoRoot "desktop\icon.ico"

if (-not (Test-Path $launcher)) {
    throw "Launcher not found: $launcher"
}

$w = New-Object -ComObject WScript.Shell

function New-DshShortcut([string]$Path) {
    $shortcut = $w.CreateShortcut($Path)
    $shortcut.TargetPath = $launcher
    $shortcut.WorkingDirectory = $repoRoot
    $shortcut.WindowStyle = 1
    $shortcut.Description = "Launch DeepSeek Harness desktop (pnpm desktop)"
    if (Test-Path $icon) {
        $shortcut.IconLocation = "$icon,0"
    }
    $shortcut.Save()
    return $Path
}

$desktopDir = [Environment]::GetFolderPath("Desktop")
$startDir = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"

$deskLnk = New-DshShortcut (Join-Path $desktopDir "DeepSeek Harness.lnk")
$startLnk = New-DshShortcut (Join-Path $startDir "DeepSeek Harness.lnk")

Write-Host "Installed shortcuts for repo:"
Write-Host "  $repoRoot"
Write-Host "Desktop:   $deskLnk"
Write-Host "Start Menu:$startLnk"
Write-Host ""
Write-Host "First-time clone still needs: pnpm install && pnpm run build"
Write-Host "Then double-click the shortcut, or run: pnpm desktop"
