## Downloads

| Datei | Für |
|---|---|
| `planeten-erdbeben-setup-windows-x64.exe` | Setup-Assistent für **Windows 10/11** |
| `planeten-erdbeben-setup-linux-x64` | Setup-Assistent für einen **Linux-PC** |
| `planeten-erdbeben-setup-linux-arm64` | Setup-Assistent für den **Raspberry Pi** (64-Bit-Raspberry-Pi-OS) |
| `planeten-lern-cockpit-windows-x64.exe` | Lern-Cockpit für **Windows 10/11**: in den entpackten Lernpaket-Ordner legen und doppelklicken |
| `planeten-lern-cockpit-linux-x64` / `-linux-arm64` | Lern-Cockpit für Linux und den Raspberry Pi |
| `PlanetenErdbeben-Lernpaket.zip` | Quellcode, Lerneinheiten, Docker-Umgebung und Anleitung `ERSTE-SCHRITTE.md` |
| `Planeten-Erdbeben.pptx` | Präsentation für den Beamer (18 Folien, mit Sprechernotizen) |
| `Setup-Assistent-erklaert.pdf` | Handout: was der Setup-Assistent macht und was nicht (2 Seiten) |
| `Lerneinheiten-Inhaltsuebersicht.pdf` | alle 16 Lerneinheiten und die zwei Lernwege für Anwendungsentwicklung und Systemintegration (3 Seiten) |
| `Setup-Ablauf.png` | Ablaufgrafik auf einer Seite: was man im Setup-Assistenten eingibt und was im Hintergrund passiert (für Folie oder Aushang) |

Der Setup-Assistent richtet Datenbank, Node-RED und Grafana automatisch ein. Für eine Workstation oder zu Hause
startet die Docker-Umgebung aus dem Lernpaket alle drei Dienste (`docker compose up -d`), danach im Assistenten
auf **„Lokale Docker-Umgebung“** klicken.

## Hinweise

- **Windows:** Beim ersten Start warnt SmartScreen vor einem unbekannten Herausgeber, weil die Datei nicht signiert ist:
  „Weitere Informationen“ → „Trotzdem ausführen“.
- **Linux / Raspberry Pi:** Nach dem Herunterladen einmal ausführbar machen: `chmod +x planeten-erdbeben-setup-linux-*`.
  Meldet das Programm `libatomic.so.1: cannot open shared object file`: `sudo apt install libatomic1`.
- **Ohne Programmdatei:** Im entpackten Lernpaket `npm install` und dann `npm run setup`.
- **Lern-Cockpit:** Übungsseite mit Editor, Prüfen-Knopf und eingebautem Terminal. Braucht ein installiertes Node.js (LTS)
  und einmal `npm install` im Lernpaket-Ordner. Ohne Programmdatei: `npm run lernen:ui`.
  Die Lösungen landen in `meine-uebungen/` und nicht im Git-Repository.

Jede Version wird vor der Veröffentlichung automatisch geprüft: Die Programme werden unter Linux und Windows
gestartet, und alle Tests der Lerneinheiten laufen auf beiden Systemen.
