@echo off
REM Startet proxy-setup.ps1 ohne Execution-Policy-Probleme.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0proxy-setup.ps1"
