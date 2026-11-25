# Proxy und Pakete unter Windows (Schulnetz)

Im Schulnetz geht der Weg ins Internet nur über einen Proxy, und winget blockiert manche Pakete wegen einer
Zertifikatsprüfung. Ohne Proxy-Eintrag scheitern `npm install` (z. B. `mysql2`), `git clone`/`git push` und
winget. Die Skripte in diesem Ordner tragen den Proxy überall ein und installieren die Werkzeuge.
Ausführlich, mit Bildern der Abfragen und häufigen Problemen: [Kurzanleitung-Proxy-und-Pakete.pdf](Kurzanleitung-Proxy-und-Pakete.pdf).

| Datei | Wozu |
|---|---|
| `proxy-setup.cmd` | Doppelklick: Proxy in Umgebungsvariablen, npm, git, pip, winget und WinHTTP eintragen, anzeigen oder entfernen |
| `install-pakete.cmd` | Doppelklick: Node.js LTS, Git und ripgrep mit winget installieren (fragt nach Adminrechten) |
| `*.ps1` | Die eigentlichen Skripte, werden von den `.cmd`-Dateien gestartet |

Für den Raspberry Pi im Labor (Node-RED hinter dem Proxy) gilt [LABOR-PROXY.md](../LABOR-PROXY.md).

## Reihenfolge für dieses Projekt

1. **`proxy-setup.cmd`** als normaler Benutzer starten (nicht „Als Administrator“), Menüpunkt **1**.
   Bei **„Ausnahmen ohne Proxy“** die Adresse des Raspberry Pi mit eintragen, z. B.
   `localhost,127.0.0.1,::1,192.168.100.133`. Sonst versuchen git, curl und npm den Pi über den Proxy zu
   erreichen. (Der Setup-Assistent selbst geht immer direkt zum Pi.)
2. **`install-pakete.cmd`** starten und die Adminrechte bestätigen: Node.js, Git, ripgrep.
3. **`proxy-setup.cmd`** noch einmal, Menüpunkt **1**: Jetzt sind npm und git installiert und bekommen den Proxy
   auch eingetragen.
4. **Alle Konsolen schließen**, eine neue öffnen und im Projektordner:
   ```
   npm install
   ```
   Das installiert alles aus `package.json` (`mysql2`, `astronomy-engine`, `esbuild` …) in den Versionen aus
   `package-lock.json`. Bitte **nicht** `npm install mysql2` eintippen: Das verändert `package.json`.

`install-pakete.cmd "<Projektordner>"` macht Schritt 4 gleich mit (bei vorhandener `package.json` ein
`npm install`). Am besten trotzdem Schritt 4 selbst ausführen: Das Skript läuft mit Adminrechten, und wenn
dafür ein **anderes Admin-Konto** angemeldet wird, kennt dessen npm den Proxy nicht und die Dateien in
`node_modules` gehören dem falschen Konto.

## Prüfen

```
npm config get proxy
git config --global --get http.proxy
npm ping
```
`npm ping` antwortet mit `PONG`, wenn npm durch den Proxy ins Internet kommt.

## Zu Hause

Außerhalb des Schulnetzes gibt es den Proxy nicht, Downloads scheitern dann. Vorher `proxy-setup.cmd`,
Menüpunkt **2** (entfernen), in der Schule wieder **1**.

## Gut zu wissen

- Gespeichert werden nur Adresse und Port, kein Benutzername und kein Passwort. Braucht euer Proxy eine
  Anmeldung, steht in [LABOR-PROXY.md](../LABOR-PROXY.md), wie die Adresse dann aussieht. Ein Passwort gehört
  aber nie in eine Datei im Projekt.
- Bei Zertifikatsfehlern (`self-signed certificate`, `unable to get local issuer`) die IT nach dem Zertifikat der
  Schule fragen und dessen Pfad im Proxy-Setup angeben. Die SSL-Prüfung bitte **nicht** abschalten.
- Die Zertifikats-Ausnahme von winget (`BypassCertificatePinningForMicrosoftStore`) ist nur während der
  Installation an und wird danach immer wieder ausgeschaltet, auch bei Fehlern oder Abbruch.
