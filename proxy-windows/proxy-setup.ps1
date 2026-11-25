<#
    proxy-setup.ps1
    Fragt die Proxy-Daten ab und traegt sie automatisch ein in:
      - Umgebungsvariablen (HTTP_PROXY, HTTPS_PROXY, NO_PROXY) fuer den Benutzer
      - npm
      - git
      - pip (falls Python installiert ist)
      - winget + WinHTTP (Systemproxy) -> braucht Adminrechte, wird extra abgefragt
    Optional: Firmen-/Schul-Zertifikat (CA) fuer npm, git, pip und Node.js.

    Menue:
      1 = Proxy setzen
      2 = Proxy ueberall entfernen
      3 = Aktuelle Einstellungen anzeigen

    Bitte als NORMALER Benutzer starten (nicht als Admin), damit die
    Einstellungen in deinem eigenen Benutzerprofil landen.
#>

function Ist-Vorhanden($befehl) {
    return [bool](Get-Command $befehl -ErrorAction SilentlyContinue)
}

function Schritt($text) { Write-Host "`n>>> $text" -ForegroundColor Cyan }
function Ok($text)      { Write-Host "    OK: $text" -ForegroundColor Green }
function Info($text)    { Write-Host "    $text" -ForegroundColor DarkGray }
function Warnung($text) { Write-Host "    ACHTUNG: $text" -ForegroundColor Yellow }

# Fuehrt Befehle in einem separaten Admin-Fenster aus (nur fuer winget/netsh)
function Als-Admin([string[]]$befehle) {
    $skript = ($befehle -join "`r`n") + "`r`nStart-Sleep -Seconds 3"
    $bytes  = [Text.Encoding]::Unicode.GetBytes($skript)
    $kodiert = [Convert]::ToBase64String($bytes)
    try {
        Start-Process powershell.exe -Verb RunAs -Wait `
            -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-EncodedCommand", $kodiert
        return $true
    } catch {
        Warnung "Admin-Teil abgebrochen oder abgelehnt."
        return $false
    }
}

# ------------------------------------------------------------
function Proxy-Setzen {
    Write-Host "`n===== Proxy-Daten eingeben =====" -ForegroundColor Cyan

    $hostName = Read-Host "Proxy-Adresse (z. B. proxy.schule.local oder 10.0.0.1)"
    $hostName = $hostName.Trim() -replace '^https?://', '' -replace '/+$', ''
    if (-not $hostName) { Warnung "Keine Adresse eingegeben, Abbruch."; return }

    $port = Read-Host "Port (Enter = 8080)"
    if (-not $port) { $port = "8080" }

    $proxyUrl = "http://${hostName}:${port}"

    # Geraete im Labornetz (z. B. der Raspberry Pi) hier mit eintragen, sonst gehen git/curl/npm dorthin ueber den Proxy
    $noProxy = Read-Host "Ausnahmen ohne Proxy, z. B. mit der IP des Pi: localhost,127.0.0.1,::1,192.168.100.133 (Enter = localhost,127.0.0.1,::1)"
    if (-not $noProxy) { $noProxy = "localhost,127.0.0.1,::1" }

    $caPfad = Read-Host "Pfad zu einem Zertifikat (.crt/.pem) der Einrichtung (Enter = keins)"
    $caPfad = $caPfad.Trim('"', ' ')
    if ($caPfad -and -not (Test-Path $caPfad)) {
        Warnung "Datei '$caPfad' nicht gefunden, Zertifikat wird uebersprungen."
        $caPfad = ""
    }

    Write-Host "`nProxy: $proxyUrl" -ForegroundColor White
    Write-Host "Ausnahmen: $noProxy" -ForegroundColor White
    if ($caPfad) { Write-Host "Zertifikat: $caPfad" -ForegroundColor White }
    if ((Read-Host "`nSo eintragen? (j/n)") -ne "j") { Write-Host "Abgebrochen."; return }

    # --- Umgebungsvariablen (gelten fuer viele Programme, z. B. curl, Python, Node) ---
    Schritt "Umgebungsvariablen (Benutzer)"
    foreach ($name in "HTTP_PROXY", "HTTPS_PROXY") {
        [Environment]::SetEnvironmentVariable($name, $proxyUrl, "User")
    }
    [Environment]::SetEnvironmentVariable("NO_PROXY", $noProxy, "User")
    if ($caPfad) { [Environment]::SetEnvironmentVariable("NODE_EXTRA_CA_CERTS", $caPfad, "User") }
    Ok "HTTP_PROXY, HTTPS_PROXY, NO_PROXY gesetzt"

    # --- npm ---
    Schritt "npm"
    if (Ist-Vorhanden "npm") {
        npm config set proxy $proxyUrl
        npm config set https-proxy $proxyUrl
        npm config set noproxy $noProxy
        if ($caPfad) { npm config set cafile $caPfad }
        Ok "npm konfiguriert"
    } else { Info "npm nicht installiert, uebersprungen" }

    # --- git ---
    Schritt "git"
    if (Ist-Vorhanden "git") {
        git config --global http.proxy $proxyUrl
        git config --global https.proxy $proxyUrl
        if ($caPfad) { git config --global http.sslCAInfo $caPfad }
        Ok "git konfiguriert"
    } else { Info "git nicht installiert, uebersprungen" }

    # --- pip ---
    Schritt "pip"
    if (Ist-Vorhanden "pip") {
        pip config set global.proxy $proxyUrl | Out-Null
        if ($caPfad) { pip config set global.cert $caPfad | Out-Null }
        Ok "pip konfiguriert"
    } else { Info "pip nicht installiert, uebersprungen" }

    # --- winget + WinHTTP (Admin) ---
    Schritt "winget + Windows-Systemproxy (braucht Adminrechte)"
    if ((Read-Host "    Jetzt mit Adminrechten eintragen? (j/n)") -eq "j") {
        $bypassListe = ($noProxy -replace ',', ';')
        $befehle = @(
            "netsh winhttp set proxy proxy-server=`"${hostName}:${port}`" bypass-list=`"$bypassListe`""
        )
        if (Ist-Vorhanden "winget") {
            $befehle += "winget settings --enable ProxyCommandLineOptions"
            $befehle += "winget settings set DefaultProxy `"$proxyUrl`""
        }
        if (Als-Admin $befehle) { Ok "winget/WinHTTP konfiguriert" }
    } else { Info "uebersprungen" }

    Write-Host "`nFertig! Bitte alle offenen Konsolen schliessen und neu oeffnen," -ForegroundColor Green
    Write-Host "damit die neuen Umgebungsvariablen greifen." -ForegroundColor Green
}

# ------------------------------------------------------------
function Proxy-Entfernen {
    if ((Read-Host "Proxy wirklich ueberall entfernen? (j/n)") -ne "j") { return }

    Schritt "Umgebungsvariablen"
    foreach ($name in "HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY", "NODE_EXTRA_CA_CERTS") {
        [Environment]::SetEnvironmentVariable($name, $null, "User")
    }
    Ok "entfernt"

    Schritt "npm"
    if (Ist-Vorhanden "npm") {
        foreach ($k in "proxy", "https-proxy", "noproxy", "cafile") {
            npm config delete $k 2>$null
        }
        Ok "entfernt"
    } else { Info "nicht installiert" }

    Schritt "git"
    if (Ist-Vorhanden "git") {
        foreach ($k in "http.proxy", "https.proxy", "http.sslCAInfo") {
            git config --global --unset $k 2>$null
        }
        Ok "entfernt"
    } else { Info "nicht installiert" }

    Schritt "pip"
    if (Ist-Vorhanden "pip") {
        pip config unset global.proxy 2>$null | Out-Null
        pip config unset global.cert 2>$null | Out-Null
        Ok "entfernt"
    } else { Info "nicht installiert" }

    Schritt "winget + Windows-Systemproxy (braucht Adminrechte)"
    if ((Read-Host "    Auch dort entfernen? (j/n)") -eq "j") {
        $befehle = @("netsh winhttp reset proxy")
        if (Ist-Vorhanden "winget") {
            $befehle += "winget settings reset DefaultProxy"
            $befehle += "winget settings --disable ProxyCommandLineOptions"
        }
        if (Als-Admin $befehle) { Ok "entfernt" }
    }

    Write-Host "`nFertig. Konsolen neu oeffnen, damit es greift." -ForegroundColor Green
}

# ------------------------------------------------------------
function Proxy-Anzeigen {
    Schritt "Umgebungsvariablen (Benutzer)"
    foreach ($name in "HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY", "NODE_EXTRA_CA_CERTS") {
        $wert = [Environment]::GetEnvironmentVariable($name, "User")
        Write-Host ("    {0,-20} {1}" -f $name, $(if ($wert) { $wert } else { "-" }))
    }

    Schritt "npm"
    if (Ist-Vorhanden "npm") {
        foreach ($k in "proxy", "https-proxy", "noproxy", "cafile") {
            $w = (npm config get $k)
            Write-Host ("    {0,-20} {1}" -f $k, $w)
        }
    } else { Info "nicht installiert" }

    Schritt "git"
    if (Ist-Vorhanden "git") {
        foreach ($k in "http.proxy", "https.proxy", "http.sslCAInfo") {
            $w = (git config --global --get $k)
            Write-Host ("    {0,-20} {1}" -f $k, $(if ($w) { $w } else { "-" }))
        }
    } else { Info "nicht installiert" }

    Schritt "WinHTTP (Systemproxy)"
    netsh winhttp show proxy
}

# ------------------------------------------------------------
do {
    Write-Host "`n===== Proxy-Setup =====" -ForegroundColor Cyan
    Write-Host " 1 = Proxy setzen"
    Write-Host " 2 = Proxy ueberall entfernen"
    Write-Host " 3 = Aktuelle Einstellungen anzeigen"
    Write-Host " 0 = Beenden"
    $wahl = Read-Host "Auswahl"
    switch ($wahl) {
        "1" { Proxy-Setzen }
        "2" { Proxy-Entfernen }
        "3" { Proxy-Anzeigen }
    }
} while ($wahl -ne "0")
