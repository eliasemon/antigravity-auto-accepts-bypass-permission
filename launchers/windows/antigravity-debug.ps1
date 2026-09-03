<#
.SYNOPSIS
    Launches Google Antigravity on Windows with Chrome DevTools Protocol remote debugging port.
.PARAMETER Port
    CDP port to bind (default: 9333).
#>
param (
    [int]$Port = 9333
)

Write-Host "🚀 Launching Antigravity with --remote-debugging-port=$Port..." -ForegroundColor Cyan

$paths = @(
    "$env:LOCALAPPDATA\Programs\Antigravity\Antigravity.exe",
    "$env:ProgramFiles\Google Antigravity\Antigravity.exe",
    "${env:ProgramFiles(x86)}\Google Antigravity\Antigravity.exe",
    "$env:LOCALAPPDATA\Programs\Google Antigravity\Antigravity.exe"
)

$found = $false
foreach ($exe in $paths) {
    if (Test-Path $exe) {
        Start-Process -FilePath $exe -ArgumentList "--remote-debugging-port=$Port"
        $found = $true
        Write-Host "✅ Launched: $exe" -ForegroundColor Green
        break
    }
}

if (-not $found) {
    # Check PATH
    $cmd = Get-Command antigravity -ErrorAction SilentlyContinue
    if ($cmd) {
        Start-Process -FilePath $cmd.Source -ArgumentList "--remote-debugging-port=$Port"
        Write-Host "✅ Launched from PATH: $($cmd.Source)" -ForegroundColor Green
    } else {
        Write-Warning "Could not find Antigravity.exe in standard paths. Starting generic command..."
        Start-Process "Antigravity.exe" -ArgumentList "--remote-debugging-port=$Port"
    }
}
