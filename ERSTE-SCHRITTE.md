# Erste Schritte: Planeten & Erdbeben auf deinem PC

Diese Anleitung bringt das ganze Projekt auf deinen eigenen Rechner, an der Workstation oder zu Hause.
Datenbank, Node-RED und Grafana laufen dabei in **Docker**, du musst sie nicht einzeln installieren.

Zeitbedarf beim ersten Mal: etwa 30 Minuten (vor allem Downloads).

---

## 1. Einmal installieren

| Programm | Wofür | Download |
|---|---|---|
| **Node.js** (Version „LTS“) | Übungen ausführen, Setup starten | https://nodejs.org |
| **Docker Desktop** | MariaDB, Node-RED und Grafana starten | https://www.docker.com/products/docker-desktop/ |
| **Visual Studio Code** | Code lesen und schreiben | https://code.visualstudio.com |

Docker per Befehl statt per Download-Seite:

| System | Befehl |
|---|---|
| Windows (PowerShell **als Administrator**) | `winget install -e --id Docker.DockerDesktop`, danach neu starten |
| macOS (Apple Silicon) | `curl -L -o ~/Downloads/Docker.dmg https://desktop.docker.com/mac/main/arm64/Docker.dmg`<br>`sudo hdiutil attach ~/Downloads/Docker.dmg`<br>`sudo /Volumes/Docker/Docker.app/Contents/MacOS/install`<br>`sudo hdiutil detach /Volumes/Docker` |
| Linux (Ubuntu o. Ä.) | `curl -fsSL https://get.docker.com \| sudo sh` und `sudo usermod -aG docker $USER`, danach ab- und wieder anmelden |

**Achtung:** `npm install docker` installiert **nicht** Docker, sondern ein gleichnamiges JavaScript-Paket.
Falls es passiert ist: `npm uninstall docker`.

Node.js unter Windows geht auch per Befehl: `winget install -e --id OpenJS.NodeJS.LTS`.

**Im Schulnetz mit Proxy (Windows):** Dort scheitern Downloads mit npm, git und winget, bis der Proxy eingetragen
ist. Dafür gibt es zwei Doppelklick-Skripte im Ordner [proxy-windows/](proxy-windows/README.md): erst
`proxy-setup.cmd`, dann `install-pakete.cmd` (Node.js, Git), dann noch einmal `proxy-setup.cmd`.

**Windows:** Docker Desktop braucht **WSL 2**. Der Installer bietet es an; falls nicht, in einer PowerShell
„Als Administrator ausführen“: `wsl --install`, danach neu starten. Meldet Docker „Virtualization not enabled“,
muss die Virtualisierung im BIOS eingeschaltet werden (meist „Intel VT-x“ oder „AMD-V/SVM“).

Prüfen, ob alles da ist (in einem **neuen** Terminal):
```
node -v          # z. B. v24.x
npm -v
docker --version
```

## 2. Projekt öffnen

1. Das Lernpaket (ZIP) entpacken, z. B. nach `Dokumente/PlanetenErdbeben`.
2. Den Ordner in VS Code öffnen: **Datei → Ordner öffnen**.
3. Terminal in VS Code öffnen: **Terminal → Neues Terminal**.
4. Einmal die Pakete installieren:
   ```
   npm install
   ```

## 3. Ohne Server loslegen

Die meisten Lerneinheiten brauchen nur Node.js. Starte mit [lernen/README.md](lernen/README.md); dort stehen
zwei Lernwege: **Anwendungsentwicklung** (mit JavaScript) und **Systemintegration** (ohne Programmieren).
```
node --test "lernen/00-gesamtbild/*.test.js"   # eine Einheit prüfen
npm run lernen                      # alle Übungen
npm run lernen:fisi                 # nur die Übungen ohne Programmieren
```

## 4. Die Docker-Umgebung starten

Docker Desktop öffnen (es muss im Hintergrund laufen), dann im Terminal:
```
docker compose up -d
```
Beim ersten Mal lädt Docker etwa 1 GB herunter (dauert 1–5 Minuten) und braucht danach rund **4 GB freien
Speicherplatz**. Danach prüfen:
```
docker compose ps
```
Alle drei Dienste (`mariadb`, `nodered`, `grafana`) sollten „running“ zeigen, `mariadb` zusätzlich „healthy“.

## 5. Alles einrichten

```
npm run setup
```
Im Browser öffnet sich der Setup-Assistent:
1. **Dein Name** eintragen. Daraus entsteht der **Tabellen-Präfix** (z. B. `anna_`): Deine Erdbeben landen in
   eigenen Tabellen wie `anna_events`.
2. Auf **„Lokale Docker-Umgebung“** klicken. Alle Felder füllen sich, die Ports kommen aus der `.env`, falls es eine gibt.
3. **„Alles einrichten“**. Nach etwa einer Minute sind alle Schritte grün.
4. Unten bei **„Ältere Erdbeben laden“** das Jahr **2025** wählen und auf **„Erdbeben laden“** klicken.
   Nach ein paar Minuten zeigen die Zähler rund 1500 Erdbeben.
5. **„Setup beenden“**.

Jetzt kannst du öffnen:

| Was | Adresse | Login |
|---|---|---|
| Node-RED | http://127.0.0.1:1880 | keiner |
| Grafana | http://127.0.0.1:3000 | `admin` / `admin-lernen` |

Im Dashboard „Planeten & Erdbeben (Dein Name)“:
- **Auf ein Erdbeben in der Karte klicken**, dann „Show the sky at this quake“: Oben steht der Himmel bei diesem
  Beben, darunter das **Sonnensystem** in diesem Moment. Oben bei **„View“** zwischen Karte und Sonnensystem wechseln.
- Ganz unten der **„Correlation finder“**: Gibt es eine Mondstellung bei Erdbeben häufiger als zufällig?
  Ausführlicher im Terminal: `npm run korrelation` (Lerneinheit 11).

## 6. Jeden Tag

```
docker compose start     # nach dem Hochfahren (Docker Desktop muss laufen)
docker compose stop      # am Ende; die Daten bleiben erhalten
```
Alles auf Anfang (löscht auch alle Erdbeben-Daten):
```
docker compose down -v
docker compose up -d     # danach wieder ab Schritt 5
```

## Zugangsdaten der Lernumgebung

Diese Passwörter stehen absichtlich offen in [compose.yaml](compose.yaml). Die Dienste sind nur von deinem eigenen
PC aus erreichbar (`127.0.0.1`), nicht aus dem Netzwerk.

| Wofür | Benutzer | Passwort |
|---|---|---|
| Datenbank, lesen und schreiben (Setup, Node-RED, Grafana) | `planeten` | `planeten-lernen` |
| Datenbank, nur lesen (SQL-Übungen) | `lernen` | `lernen` |
| Datenbank, Administrator | `root` | `root-lernen` |
| Grafana | `admin` | `admin-lernen` |

## Wenn es nicht klappt

| Meldung | Lösung |
|---|---|
| `npm` / `node` / `docker` „wird nicht erkannt“ / „command not found“ | Terminal schließen und neu öffnen (nach der Installation). Sonst neu installieren. |
| Windows: `npm.ps1 kann nicht geladen werden, da die Ausführung von Skripts … deaktiviert ist` | Einmal in PowerShell: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, oder `npm.cmd` statt `npm` schreiben. |
| `Cannot connect to the Docker daemon` / `open //./pipe/docker_engine` | Docker Desktop ist nicht gestartet. Öffnen und warten, bis unten „Engine running“ steht. |
| `port is already allocated` / `address already in use` | Ein anderes Programm (z. B. XAMPP auf 3306) belegt den Port. Entweder das andere Programm beenden, oder neben `compose.yaml` eine Datei `.env` anlegen mit z. B. `DB_PORT=3307` (oder `NODERED_PORT=1881`, `GRAFANA_PORT=3001`), dann `docker compose up -d`. Der Knopf „Lokale Docker-Umgebung“ im Setup liest die Ports aus dieser `.env` (der „Erweitert“-Port bleibt 3306). |
| Linux: `error while loading shared libraries: libatomic.so.1` beim Start des Setup-Programms | Einmal `sudo apt install libatomic1`, dann neu starten. (Oder `npm run setup` benutzen.) |
| Setup: „Unter http://127.0.0.1:1880 läuft kein Node-RED“ | `docker compose ps`: läuft `nodered`? Sonst `docker compose up -d`. |
| Setup: „Warte auf die ersten Daten …“ endet mit Warnung | Der Node-RED-Container braucht Internet (für USGS und npm). `docker compose logs nodered` zeigt den Fehler. |
| Labor: Node-RED auf dem Raspberry Pi bekommt keine Daten, das Netz hat einen Proxy | [LABOR-PROXY.md](LABOR-PROXY.md) |
| SQL-Übungen werden übersprungen: „Datenbank nicht erreichbar“ | Docker-Umgebung starten. Bei geändertem Port: der Wert aus `.env` wird automatisch benutzt. |
| Grafana zeigt „No data“ | Backfill (Schritt 5.4) gemacht? Zeitbereich oben rechts auf „Last 2 years“. |
| Sonnensystem-Panel: „Positions seen from the Sun are still being computed“ | Node-RED rechnet die Beben gerade (neu). Zähler „pending“ im Pipeline-Panel beobachten, nach ein paar Minuten ist es fertig. |
| Sonnensystem-Panel leer oder „Panel plugin not found“ | Das Plugin Business Charts fehlt. In Docker: `docker compose up -d grafana` (installiert es beim Start). Sonst siehe [README.md](README.md), Abschnitt Grafana. |
| `npm install`: `ETIMEDOUT`, `ECONNRESET` oder `self-signed certificate` im Schulnetz | Der Proxy ist nicht eingetragen: [proxy-windows/](proxy-windows/README.md). |

Mehr zur Fehlersuche: [lernen/10-netzwerk-fehlersuche](lernen/10-netzwerk-fehlersuche/README.md).
