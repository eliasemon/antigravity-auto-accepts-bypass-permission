@echo off
REM Windows Launcher for Google Antigravity with Remote Debugging Port Enabled
set PORT=%1
if "%PORT%"=="" set PORT=9333

echo [Antigravity Launcher] Launching with --remote-debugging-port=%PORT%...

if exist "%LOCALAPPDATA%\Programs\Antigravity\Antigravity.exe" (
    start "" "%LOCALAPPDATA%\Programs\Antigravity\Antigravity.exe" --remote-debugging-port=%PORT%
    goto done
)

if exist "%PROGRAMFILES%\Google Antigravity\Antigravity.exe" (
    start "" "%PROGRAMFILES%\Google Antigravity\Antigravity.exe" --remote-debugging-port=%PORT%
    goto done
)

if exist "%PROGRAMFILES(X86)%\Google Antigravity\Antigravity.exe" (
    start "" "%PROGRAMFILES(X86)%\Google Antigravity\Antigravity.exe" --remote-debugging-port=%PORT%
    goto done
)

where antigravity >nul 2>nul
if %ERRORLEVEL% equ 0 (
    start "" antigravity --remote-debugging-port=%PORT%
    goto done
)

echo [Warning] Standard installation path not found. Attempting generic process launch...
start "" "Antigravity.exe" --remote-debugging-port=%PORT%

:done
echo [Antigravity Launcher] Done.
