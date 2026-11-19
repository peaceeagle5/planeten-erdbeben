# 14 – Linux-Server betreiben

## Lernziele
- Du kannst dich per SSH auf dem Raspberry Pi anmelden und dort sicher arbeiten.
- Du kannst Pakete installieren, Dienste steuern und ihre Logs lesen.
- Du verstehst Dateirechte (`rwx`, `755`, `600`) und kannst sie setzen.
- Du weißt, wo die Konfiguration von MariaDB, Node-RED und Grafana liegt.
- Du kannst die Datenbank sichern und die Sicherung automatisch planen (cron).

Kein Programmieren nötig. Passt besonders zur Fachrichtung **Systemintegration**.

---

## 1. Der Pi ist ein Server

Auf dem Raspberry Pi im Labor läuft **Linux** (Raspberry Pi OS, ein Debian). MariaDB, Node-RED und Grafana sind
**Dienste**: Programme, die beim Hochfahren starten und ohne Bildschirm im Hintergrund laufen. Wer den Pi betreut,
muss Dienste starten und stoppen, Fehler in den Logs finden, Updates einspielen und Daten sichern können.

## 2. Übungsplatz

| Wo | Wie | Geht dort |
|---|---|---|
| **Raspberry Pi** im Labor | `ssh <benutzer>@<ip-des-pi>` | alles |
| **Docker-Container** auf deinem PC | `docker run -it --rm --name linux-uebung debian:bookworm-slim bash` | Pakete, Dateien, Rechte, cron-Zeilen schreiben; **kein** `systemctl` (Container haben kein systemd) |

Im Container bist du `root` und kannst nichts kaputt machen: Mit `exit` ist er weg.

## 3. Anmelden mit SSH

```
ssh pi@192.168.100.133      # Benutzer pi auf dem Pi anmelden
exit                        # abmelden
```
Beim ersten Mal fragt SSH: „Are you sure you want to continue connecting?“ Das ist der **Fingerabdruck** des Servers.
Mit `yes` merkt sich dein PC den Pi. Ändert sich der Fingerabdruck später, warnt SSH laut: Das ist entweder ein neu
installierter Pi oder jemand gibt sich als der Pi aus.

**`sudo`** führt einen einzelnen Befehl mit Administratorrechten aus. Nur so viel wie nötig: Normale Arbeit ohne `sudo`.

## 4. Pakete installieren (apt)

| Befehl | Was er tut |
|---|---|
| `sudo apt update` | Paketlisten aus dem Internet aktualisieren (installiert **nichts**) |
| `sudo apt upgrade` | alle installierten Pakete auf den neuesten Stand bringen |
| `sudo apt install libatomic1` | ein Paket installieren (`-y` beantwortet die Rückfrage mit Ja) |
| `sudo apt remove paket` | ein Paket entfernen |

`apt` ist für das **Betriebssystem**, `npm` für **JavaScript-Pakete eines Projekts** (Einheit 02).

## 5. Dienste steuern (systemctl) und Logs lesen (journalctl)

| Befehl | Was er tut |
|---|---|
| `systemctl status nodered` | läuft der Dienst? seit wann? letzte Log-Zeilen |
| `sudo systemctl start` / `stop` / `restart grafana-server` | starten / anhalten / neu starten |
| `sudo systemctl enable mariadb` | beim Hochfahren automatisch starten |
| `sudo systemctl disable mariadb` | nicht mehr automatisch starten |
| `journalctl -u nodered -f` | Log des Dienstes **live** mitlesen (Strg+C beendet das Mitlesen) |
| `journalctl -u mariadb --since "1 hour ago"` | Log der letzten Stunde |

Die Dienstnamen auf dem Pi: **`mariadb`**, **`nodered`**, **`grafana-server`**.
`start` wirkt **jetzt**, `enable` wirkt **beim nächsten Hochfahren**. Für beides: `sudo systemctl enable --now mariadb`.

## 6. Dateien und Rechte

```
$ ls -l
-rwxr-xr-x 1 pi pi 152165424 Nov 19 21:00 planeten-erdbeben-setup-linux-arm64
-rw------- 1 pi pi       180 Nov 19 19:11 .env
│└┬┘└┬┘└┬┘   └┬┘└┬┘
│ │  │  │     │  └ Gruppe
│ │  │  │     └ Besitzer
│ │  │  └ alle anderen: r-x
│ │  └ Gruppe: r-x
│ └ Besitzer: rwx
└ - = Datei, d = Ordner
```
`r` = lesen (4), `w` = schreiben (2), `x` = ausführen (1). Pro Gruppe zusammenzählen:

| Text | Zahl | typisch für |
|---|---|---|
| `rwxr-xr-x` | **755** | Programme, Ordner |
| `rw-r--r--` | **644** | normale Dateien |
| `rw-------` | **600** | Dateien mit Passwörtern (`.env`!) |

```
chmod +x planeten-erdbeben-setup-linux-arm64    # ausführbar machen (nötig nach dem Download)
chmod 600 .env                                  # nur der Besitzer darf lesen und schreiben
sudo chown pi:pi datei                          # Besitzer und Gruppe ändern
```

## 7. Wo die Konfiguration liegt

| Dienst | Datei | Typische Einstellung |
|---|---|---|
| MariaDB | `/etc/mysql/mariadb.conf.d/50-server.cnf` | `bind-address = 0.0.0.0` (von außen erreichbar, Einheit 10) |
| Grafana | `/etc/grafana/grafana.ini` | `http_port = 3000` |
| Node-RED | `~/.node-red/settings.js` | `uiPort`, `adminAuth`, `functionExternalModules` |

Bearbeiten mit `sudo nano <datei>` (Speichern: Strg+O, Beenden: Strg+X), danach den **Dienst neu starten**,
sonst wirkt die Änderung nicht. Vorher eine Kopie: `sudo cp datei datei.bak`.

## 8. Ressourcen prüfen

| Befehl | Zeigt |
|---|---|
| `df -h` | freien Speicherplatz pro Laufwerk |
| `du -sh ordner` | wie groß ein Ordner ist |
| `free -h` | Arbeitsspeicher |
| `top` (oder `htop`) | was gerade CPU und Speicher braucht (Beenden: `q`) |
| `sudo ss -ltnp` | welche Programme auf welchen Ports lauschen (Einheit 10) |

## 9. Datensicherung mit mysqldump und cron

```
mysqldump -u planeten -p planeten_erdbeben > backup.sql       # sichern (fragt nach dem Passwort)
mysql -u planeten -p planeten_erdbeben < backup.sql           # zurückspielen
```
**cron** führt Befehle zu festen Zeiten aus. `crontab -e` öffnet deine Liste. Eine Zeile hat fünf Zeitfelder:
```
┌ Minute (0–59)
│  ┌ Stunde (0–23)
│  │ ┌ Tag im Monat (1–31)
│  │ │ ┌ Monat (1–12)
│  │ │ │ ┌ Wochentag (0–7, 0 und 7 = Sonntag)
30 2 * * * /home/pi/backup.sh        → jeden Tag um 02:30
0  * * * * …                         → jede volle Stunde
0  3 * * 1 …                         → jeden Montag um 03:00
```
`*` heißt „jeder“. Im Skript `backup.sh` steht dann der `mysqldump`-Befehl. Passwörter gehören dabei nicht in die
crontab, sondern in eine Datei `~/.my.cnf` mit Rechten `600`.

## Übung

1. **Quiz:** [antworten.txt](antworten.txt): Rechte, Konfiguration, cron.
2. **Befehle:** [befehle.txt](befehle.txt): Schreib zu jeder Aufgabe den passenden Befehl.
3. **Praxis** auf dem Pi (oder im Docker-Container, ohne `systemctl`): Prüfe den Status aller drei Dienste, lies
   eine Minute lang das Node-RED-Log mit, finde heraus, wie viel Speicher frei ist, und mach eine Sicherung der Datenbank.

Prüfen: `node --test lernen/14-linux-server/`

## So erklärst du es
> „Ein Dienst ist ein Programm, das im Hintergrund wartet, wie ein Kellner, der immer da ist. Mit systemctl sagst du
> ihm, wann er kommen und gehen soll, mit journalctl liest du sein Tagebuch. Und die Rechte sagen, wer welche Tür
> öffnen darf: Die Datei mit den Passwörtern bekommt nur einen Schlüssel, für dich.“

## Wenn es nicht klappt

| Meldung | Ursache / Lösung |
|---|---|
| `Permission denied` | fehlende Rechte: `sudo` davor, oder Datei nicht ausführbar (`chmod +x`) |
| `command not found` | Programm nicht installiert (`sudo apt install …`) oder Tippfehler |
| `Unit nodered.service could not be found` | Dienstname falsch geschrieben, oder der Dienst ist nicht installiert |
| `Job for grafana-server.service failed` | Dienst startet nicht: `journalctl -u grafana-server -n 50` zeigt die letzten 50 Zeilen |
| `No space left on device` | Speicher voll: `df -h`, dann alte Logs/Backups/Docker-Images aufräumen |
| `System has not been booted with systemd` | Du bist in einem Docker-Container: `systemctl` geht nur auf dem Pi |
| SSH: `WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED` | Pi neu installiert? Dann `ssh-keygen -R <ip>`. Sonst: nicht verbinden, Lehrkraft fragen |

## Selbsttest-Fragen
1. Was ist der Unterschied zwischen `systemctl start` und `systemctl enable`?
2. Warum bekommt die Datei `.env` die Rechte `600`, und was würde `644` bedeuten?
3. Du änderst `bind-address` und MariaDB ist trotzdem nicht erreichbar. Was hast du vergessen?
4. Schreib eine cron-Zeile, die jeden Freitag um 18:00 ein Skript ausführt.
5. Warum gehört das Datenbank-Passwort nicht direkt in die crontab?
