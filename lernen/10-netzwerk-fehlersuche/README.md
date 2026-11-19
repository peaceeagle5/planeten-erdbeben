# 10 – Netzwerk und Fehlersuche

## Lernziele
- Du kannst IP-Adressen, `localhost`, `0.0.0.0` und Ports sicher auseinanderhalten.
- Du gehst bei Fehlern **systematisch** vor, statt zu raten.
- Du erkennst die typischen Fehlermeldungen und weißt, was sie bedeuten.
- Du kennst die Befehle, um auf Mac, Linux/Pi und Windows nachzusehen.

---

## 1. Adressen

| Adresse | Bedeutung |
|---|---|
| `127.0.0.1` / `localhost` / `::1` | „**dieser** Rechner“ (`::1` ist dasselbe in IPv6). Jeder Rechner hat seinen eigenen! |
| `192.168.100.133` | eine Adresse im lokalen Netz (Schulnetz). Andere Rechner im Netz erreichen den Pi darüber. |
| `0.0.0.0` (als Einstellung eines Servers) | „auf **allen** Netzwerkkarten lauschen“, also auch von außen erreichbar |

**Die wichtigste Falle:** `localhost` bedeutet immer **der Rechner, auf dem das Programm läuft**.
Trägst du in Node-RED auf dem Pi als Datenbank `localhost` ein, ist das der **Pi**. Trägst du im Setup-Assistenten
auf deinem PC `localhost` ein, ist das **dein PC**. Darum hat der Assistent unter „Erweitert“ das Feld
„Adresse der Datenbank aus Sicht von Node-RED und Grafana“.

**MariaDB auf dem Pi** lauscht standardmäßig nur auf `127.0.0.1`. Vom Pi selbst geht alles, von deinem PC kommt
`ECONNREFUSED`. Lösung: in `/etc/mysql/mariadb.conf.d/50-server.cnf` `bind-address = 0.0.0.0`, dann
`sudo systemctl restart mariadb`. Zusätzlich muss der Benutzer von außen dürfen: `'name'@'%'` statt `'name'@'localhost'`.

### Sonderfall Docker

In der Docker-Umgebung ([compose.yaml](../../compose.yaml)) läuft jeder Dienst in einem eigenen **Container**,
wie ein eigener kleiner Rechner. Für Node-RED im Container ist `127.0.0.1` deshalb **der Node-RED-Container selbst**,
nicht dein PC und nicht die Datenbank. Container erreichen sich über ihre **Dienstnamen**: `mariadb`, `nodered`, `grafana`.

| Wer verbindet sich | Datenbank-Adresse |
|---|---|
| dein PC (Setup-Assistent, SQL-Übungen, Terminal) | `127.0.0.1:3306` (der Port wird vom Container auf deinen PC weitergereicht) |
| Node-RED und Grafana im Container | `mariadb:3306` |

Genau deshalb trägt der Knopf „Lokale Docker-Umgebung“ im Setup unter „Erweitert“ `mariadb` als
„Adresse aus Sicht von Node-RED und Grafana“ ein.

Nützliche Befehle: `docker compose ps` (läuft alles?), `docker compose logs -f nodered` (Log live),
`docker compose restart grafana`.

## 2. Ports

Ein Port kann nur von **einem** Programm gleichzeitig belegt sein. Startet ein zweites, gibt es `EADDRINUSE`.

| Port | Dienst |
|---|---|
| 1880 (1892, 1893 …) | Node-RED |
| 3000 | Grafana |
| 3001 | Planeten-API (optional) |
| 3306 | MariaDB/MySQL |
| 8790 | Setup-Assistent (nur lokal) |
| 80 / 443 | Web (HTTP / HTTPS), z. B. phpMyAdmin über XAMPP, USGS |

## 3. Systematisch vorgehen: von unten nach oben

Bei „geht nicht“ **nicht** wild Einstellungen ändern, sondern Schicht für Schicht prüfen.
Jede Schicht braucht die darunter.

| # | Frage | Prüfen mit | Typischer Fehler |
|---|---|---|---|
| 1 | Ist der Rechner erreichbar? | `ping 192.168.100.133` | falsche IP, anderes WLAN |
| 2 | Lauscht jemand auf dem Port? | Mac/Linux: `nc -zv 192.168.100.133 3306`<br>Windows: `Test-NetConnection 192.168.100.133 -Port 3306` | Dienst aus, `bind-address`, Firewall |
| 3 | Ist es der **richtige** Dienst? | `curl -i http://192.168.100.133:1893/settings` | Port verwechselt (Nachbar, Grafana statt Node-RED) |
| 4 | Stimmt die Anmeldung? | Fehlermeldung lesen: 401 / „Access denied“ | Passwort, Benutzername, Groß-/Kleinschreibung |
| 5 | Stimmen die Rechte? | 403 / „Host not allowed“ / Rolle in Grafana | Viewer statt Editor, `'name'@'localhost'` |
| 6 | Stimmen die Daten / die Logik? | Debug-Node, SQL direkt ausführen | leere Tabelle, falscher Zeitbereich |

**Regel: Lies die Fehlermeldung vollständig.** Sie sagt fast immer, auf welcher Schicht es hakt.

## 4. Befehle zum Nachsehen

| Was | Mac | Raspberry Pi / Linux | Windows (PowerShell) |
|---|---|---|---|
| Wer belegt Port 3000? | `lsof -nP -iTCP:3000 -sTCP:LISTEN` | `sudo ss -ltnp \| grep 3000` | `netstat -ano \| findstr :3000` |
| Port erreichbar? | `nc -zv host 3000` | `nc -zv host 3000` | `Test-NetConnection host -Port 3000` |
| HTTP testen | `curl -i http://host:3000/api/health` | dasselbe | `curl.exe -i http://host:3000/api/health` |
| eigene IP | `ipconfig getifaddr en0` | `hostname -I` | `ipconfig` |
| Dienst läuft? | – | `systemctl status mariadb` / `grafana-server` / `nodered` | – |
| Log ansehen | – | `journalctl -u nodered -f` (live), `node-red-log` | – |
| Dienst neu starten | – | `sudo systemctl restart nodered` | – |

## 5. Fehlermeldungen übersetzt

| Meldung | Schicht | Bedeutung |
|---|---|---|
| `ECONNREFUSED` | 2 | Rechner erreichbar, aber auf dem Port lauscht niemand |
| `ETIMEDOUT`, `EHOSTUNREACH` | 1 | Rechner antwortet gar nicht: falsche IP, anderes Netz, Firewall verwirft |
| `ENOTFOUND` | 1 | Name (z. B. `raspberrypi.local`) kann nicht aufgelöst werden: IP benutzen |
| `EADDRINUSE` | – | **Du** willst einen Server starten, aber der Port ist schon belegt |
| HTTP 404 | 3 | Dienst läuft, aber diese Adresse kennt er nicht. Oft: falscher Dienst am Port |
| HTTP 401, `Access denied for user` | 4 | Anmeldung falsch |
| `Access denied for user ''@…` | 4 | **gar kein** Benutzername übergeben |
| HTTP 403, `Host '…' is not allowed` | 5 | angemeldet bzw. erkannt, aber nicht erlaubt |

## 6. Fallstudien: echte Fehler aus diesem Projekt

**Fall 1: Grafana startet nicht.**
Meldung: `failed to open listener on address 0.0.0.0:3000: bind: address already in use`.
→ `EADDRINUSE`. `lsof -iTCP:3000 -sTCP:LISTEN` zeigte `node app.js`: Die Planeten-API benutzte Port 3000.
**Lösung:** API auf Port 3001 verschoben, Grafana behält seinen Standard-Port.

**Fall 2: Node-RED meldet „Planet API failed: ECONNREFUSED ::1:3000“.**
→ Schicht 2. `curl http://127.0.0.1:3000/health` → keine Verbindung. Die API war beendet worden.
`::1` zeigt, dass `localhost` als IPv6 aufgelöst wurde. Gleiche Bedeutung, nur andere Schreibweise.
**Lösung:** API starten. Die Events warteten in der Datenbank und wurden danach automatisch berechnet.

**Fall 3: Node-RED meldet `Access denied for user ''@'localhost'`.**
→ Schicht 4, und der leere Benutzername `''` verrät: Es wurde **gar kein** Login übergeben.
Der Flow war importiert, aber im MySQL-Konfigurations-Node standen noch keine Zugangsdaten.
**Lösung:** Zugangsdaten eintragen und deployen.

**Fall 4: Mit leerem Benutzer „funktioniert“ die Datenbank, sieht aber keine Datenbank.**
XAMPP hat einen anonymen Gast-Benutzer. Ohne Benutzernamen meldet man sich als Gast an, der fast nichts sieht.
**Lösung:** Der Setup-Assistent verlangt jetzt immer einen Benutzernamen.

**Fall 5: Grafana-Login abgelehnt (401), obwohl das Passwort stimmte.**
Der **Benutzername** war falsch (`admini` statt `admin`). 401 sagt nicht, welcher Teil falsch ist.
**Lehre:** Beide Teile prüfen, und nicht oft hintereinander probieren: Grafana sperrt Konten nach mehreren Fehlversuchen.

**Fall 6: Zweiter Tab statt Aktualisierung.**
Beim zweiten Setup-Lauf entstand ein **zweiter** Tab, weil Node-RED neuen Tabs eine eigene ID gibt.
Gefunden durch einen Test „Setup zweimal ausführen“.
**Lehre:** Automatisierung immer auch **wiederholt** testen.

**Fall 7: Ein Befehl im Terminal: `no such file or directory: …/mysql -h 127.0.0.1 -u root`.**
Der Befehl stand in einer Variablen (`M="mysql -u root"; $M`). Die zsh (Standard-Shell auf dem Mac) teilt
Variablen nicht an Leerzeichen auf und suchte ein Programm, dessen Name den ganzen Text enthält.
**Lehre:** Befehle nicht in Variablen packen, oder die Shell kennen.

## Übung

[uebung.js](uebung.js): Fehler einordnen und ein Fall-Quiz. Prüfen: `node --test lernen/10-netzwerk-fehlersuche/`

**Praxis:** Finde mit den Befehlen aus Abschnitt 4 heraus, welche Programme auf deinem Mac gerade auf den Ports
1880, 3000, 3001 und 3306 lauschen.

## So erklärst du es
> „Wenn etwas nicht geht, fangen wir unten an: Ist der Pi überhaupt da? Ist hinter der Tür jemand zu Hause?
> Ist es die richtige Wohnung? Haben wir den richtigen Schlüssel? Erst dann schauen wir, ob drinnen alles stimmt.
> Und die Fehlermeldung ist kein Feind, sie sagt uns meistens genau, an welcher Tür wir stehen.“

## Wenn es nicht klappt

Diese Einheit **ist** das „Wenn es nicht klappt“. Kurzfassung für die Klasse: [spickzettel.md](../spickzettel.md).

## Selbsttest-Fragen
1. Warum funktioniert `localhost` als Datenbank-Adresse im Setup-Assistenten auf deinem PC nicht, wenn die Datenbank auf dem Pi läuft?
2. Was ist der Unterschied zwischen `ECONNREFUSED` und `ETIMEDOUT`? Was prüfst du jeweils als Nächstes?
3. Ein Schüler bekommt im Setup bei Node-RED „läuft kein Node-RED“, bei Grafana klappt alles. Woran liegt es wahrscheinlich?
4. Wie findest du auf dem Pi heraus, ob Node-RED läuft, und wo siehst du seine Fehlermeldungen?
5. Erkläre `bind-address = 0.0.0.0` einem Mitschüler ohne Fachbegriffe.
