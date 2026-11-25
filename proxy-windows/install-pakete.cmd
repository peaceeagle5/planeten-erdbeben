@echo off
REM Startet install-pakete.ps1 ohne Execution-Policy-Probleme.
REM Optional Projektordner als Parameter: install-pakete.cmd "C:\pfad\zum\projekt"
if "%~1"=="" (
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-pakete.ps1"
) else (
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-pakete.ps1" -ProjektPfad "%~1"
)
