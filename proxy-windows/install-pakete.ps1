<#
    install-pakete.ps1
    1. Schaltet in winget "BypassCertificatePinningForMicrosoftStore" ein
    2. Installiert alle Pakete aus $WingetPakete
    3. Optional fuer einen Projektordner: hat er eine package.json, "npm install" (alles, was das
       Projekt braucht, Versionen aus package-lock.json); sonst package.json anlegen + $NpmPakete
    4. Schaltet den Bypass am Ende IMMER wieder aus (auch bei Fehlern / Strg+C)

    Aufruf:
      .\install-pakete.ps1
      .\install-pakete.ps1 -ProjektPfad "C:\Users\DeinName\projekte\planeten-erdbeben"
#>

param(
    # Ordner eines Node-Projekts, in den die npm-Pakete installiert werden sollen.
    # Leer lassen = npm-Schritt wird uebersprungen.
    [string]$ProjektPfad = ""
)

# ---------- HIER PAKETE ANPASSEN ----------
# winget-IDs findest du mit:  winget search <name>
$WingetPakete = @(
    "OpenJS.NodeJS.LTS",        # Node.js + npm
    "BurntSushi.ripgrep.MSVC",  # ripgrep (rg)
    "Git.Git"                   # Git
)

# npm-Pakete fuer einen Projektordner OHNE package.json (nur mit -ProjektPfad).
# Hat der Ordner schon eine package.json (z. B. Planeten & Erdbeben), wird stattdessen "npm install" ausgefuehrt.
$NpmPakete = @(
    "mysql2"
)
# ------------------------------------------

$BypassSetting = "BypassCertificatePinningForMicrosoftStore"

# --- Adminrechte pruefen, sonst Skript als Admin neu starten ---
$istAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
            ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $istAdmin) {
    Write-Host "Starte das Skript mit Administratorrechten neu ..." -ForegroundColor Yellow
    $argListe = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$PSCommandPath`"")
    if ($ProjektPfad) { $argListe += @("-ProjektPfad", "`"$ProjektPfad`"") }
    Start-Process powershell.exe -Verb RunAs -ArgumentList $argListe
    exit
}

# --- winget vorhanden? ---
if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Write-Host "winget wurde nicht gefunden. Bitte 'App Installer' aus dem Microsoft Store installieren." -ForegroundColor Red
    Read-Host "Enter zum Beenden"
    exit 1
}

function Aktualisiere-Path {
    # Laedt PATH neu, damit frisch installierte Programme (node, npm, rg) sofort gefunden werden
    $maschine = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $benutzer = [Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$maschine;$benutzer"
}

# winget-Rueckgabecodes, die KEIN Fehler sind
$OkCodes = @(
    0,
    -1978335189,  # 0x8A15002B: bereits installiert / kein Update verfuegbar
    -1978335135   # 0x8A150061: Paket bereits installiert
)

$ergebnisse = @()

try {
    Write-Host "`n>>> Aktiviere $BypassSetting ..." -ForegroundColor Cyan
    winget settings --enable $BypassSetting
    if ($LASTEXITCODE -ne 0) { throw "Bypass konnte nicht aktiviert werden (Code $LASTEXITCODE)." }

    foreach ($paket in $WingetPakete) {
        Write-Host "`n>>> Installiere $paket ..." -ForegroundColor Cyan
        winget install --id $paket --exact --silent `
            --accept-package-agreements --accept-source-agreements

        if ($OkCodes -contains $LASTEXITCODE) {
            $ergebnisse += [pscustomobject]@{ Paket = $paket; Status = "OK" }
        } else {
            $ergebnisse += [pscustomobject]@{ Paket = $paket; Status = "FEHLER (Code $LASTEXITCODE)" }
        }
    }

    Aktualisiere-Path

    if ($ProjektPfad) {
        if (-not (Test-Path $ProjektPfad)) {
            throw "Projektordner '$ProjektPfad' existiert nicht."
        }
        if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
            throw "npm nicht gefunden. Konsole neu oeffnen und Skript erneut starten."
        }

        Push-Location $ProjektPfad
        try {
            if (Test-Path "package.json") {
                # Vorhandenes Projekt: alles installieren, was package.json verlangt (mysql2 usw.).
                # "npm install mysql2" wuerde package.json veraendern.
                Write-Host "`n>>> npm install (alle Pakete aus package.json) ..." -ForegroundColor Cyan
                npm install
                $status = if ($LASTEXITCODE -eq 0) { "OK" } else { "FEHLER (Code $LASTEXITCODE)" }
                $ergebnisse += [pscustomobject]@{ Paket = "npm install (package.json)"; Status = $status }
            } else {
                Write-Host "`n>>> Keine package.json gefunden, lege eine an ..." -ForegroundColor Cyan
                npm init -y | Out-Null
                foreach ($npmPaket in $NpmPakete) {
                    Write-Host "`n>>> npm install $npmPaket ..." -ForegroundColor Cyan
                    npm install $npmPaket
                    $status = if ($LASTEXITCODE -eq 0) { "OK" } else { "FEHLER (Code $LASTEXITCODE)" }
                    $ergebnisse += [pscustomobject]@{ Paket = "npm: $npmPaket"; Status = $status }
                }
            }
        } finally {
            Pop-Location
        }
    } else {
        Write-Host "`n(Kein -ProjektPfad angegeben, npm-Pakete werden uebersprungen.)" -ForegroundColor DarkGray
    }
}
catch {
    Write-Host "`nFEHLER: $_" -ForegroundColor Red
}
finally {
    # Laeuft IMMER, auch bei Fehlern oder Abbruch
    Write-Host "`n>>> Deaktiviere $BypassSetting ..." -ForegroundColor Cyan
    winget settings --disable $BypassSetting
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Bypass ist wieder AUS." -ForegroundColor Green
    } else {
        Write-Host "ACHTUNG: Bypass konnte nicht deaktiviert werden! Manuell ausfuehren:" -ForegroundColor Red
        Write-Host "  winget settings --disable $BypassSetting" -ForegroundColor Red
    }
}

Write-Host "`n===== Zusammenfassung =====" -ForegroundColor Cyan
$ergebnisse | Format-Table -AutoSize
Read-Host "Enter zum Beenden"
