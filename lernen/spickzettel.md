# Erklär-Spickzettel: Planeten & Erdbeben

## In einem Satz

| Teil | So erklärst du es |
|---|---|
| **Das Projekt** | Wir prüfen, ob Erdbeben bei bestimmten Planetenstellungen häufiger sind als zu zufälligen Zeiten. |
| **USGS** | Die US-Erdbebenbehörde; sie veröffentlicht jedes Beben weltweit im Internet. |
| **Node-RED** | Unser Sammler: holt Beben, rechnet die Planetenstellung aus, schreibt alles in die Datenbank. |
| **MariaDB** | Unser Gedächtnis: drei Tabellen mit Beben, Positionen und Aspekten. |
| **Grafana** | Unser Schaufenster: fragt die Datenbank und malt Karten und Diagramme. |
| **Setup-Assistent** | Richtet alles automatisch ein, damit niemand Code abtippen muss. |
| **Kontroll-Event** | Gleicher Ort, zufällige Zeit: zeigt, wie die Planeten ohne Beben verteilt wären. |
| **Port** | Die Wohnungsnummer eines Dienstes auf einem Rechner (IP = Hausnummer). |
| **localhost** | „Dieser Rechner“, also immer der, auf dem das Programm gerade läuft. |
| **Docker** | Packt jedes Programm mit allem, was es braucht, in einen Container, damit es auf jedem PC gleich läuft. |
| **Image / Container** | Backform und Kuchen: aus einem Image kann man beliebig viele gleiche Container starten. |
| **Git** | Speicherpunkte für Code: jeder Commit ist ein Stand, zu dem man zurück kann. |
| **GitHub** | Die Cloud für Git-Repositories, mit Pull Requests zum gemeinsamen Arbeiten. |

## Wer läuft wo?

Auf deinem PC, in Docker (`docker compose up -d`):
```
USGS ──► Node-RED (1880) ──► MariaDB (3306) ◄── Grafana (3000) ◄── Browser
         └──────────── Container, untereinander über die Namen „nodered“, „mariadb“, „grafana“ ─┘
                                  ▲
         Setup-Assistent (npm run setup) richtet alles einmal ein
```
Im Labor mit Pi gilt dasselbe Bild, nur mit der IP des Pi statt `127.0.0.1` und einem eigenen Node-RED-Port pro Person.

## „Geht nicht“ – was du sagst

| Mitschüler:in sagt | Du fragst / sagst |
|---|---|
| „Setup: läuft kein Node-RED“ | „Welchen Port hast du? Klick auf ‚Mein Node-RED finden‘.“ |
| „Setup: wurde von X eingerichtet“ | „Das ist wahrscheinlich der Port von X. Prüf deinen Port, bevor du überschreibst.“ |
| „Setup: keine Datenbank erreichbar“ | „Geht es bei den anderen? Wenn nein: MariaDB auf dem Pi läuft nicht oder `bind-address`. Lehrkraft fragen.“ |
| „Setup: Benutzername oder Passwort falsch“ | „Datenbank- und Grafana-Login sind verschiedene! Welcher war es?“ |
| „Grafana: nur Leserechte“ | „Dein Konto ist Viewer. Die Lehrkraft muss dich auf Editor stellen.“ |
| „Dashboard leer, alles 0“ | „Node-RED → Debug-Fenster (Käfer rechts): Was steht da? ENOTFOUND = Pi hat kein Internet.“ |
| „pending wird nicht weniger“ | „Teil 2 im Flow läuft nicht: Steht unter ‚Himmel berechnen‘ ein Fehler?“ |
| „Panel: No data“ | „Zeitbereich oben rechts vergrößern, Min. magnitude kleiner stellen.“ |
| „Windows blockiert die Datei“ | „‚Weitere Informationen‘ → ‚Trotzdem ausführen‘.“ |
| „Nach Neustart ist alles weg“ | „Nein: Die Daten sind in der Datenbank. Node-RED macht einfach weiter.“ |
| „docker: command not found“ / „npm install docker geht nicht“ | „Docker ist kein npm-Paket. Docker Desktop installieren und starten (ERSTE-SCHRITTE.md).“ |
| „port is already allocated“ | „Läuft schon XAMPP oder ein anderes Node-RED? Beenden oder Port in .env ändern.“ |
| „Meine Daten sind nach docker compose down -v weg“ | „-v löscht die Volumes, also die Daten. Ohne -v bleiben sie.“ |
| „git status zeigt .env“ | „Stopp, nicht committen! .env in die .gitignore.“ |
| „Ich habe ein Passwort auf GitHub hochgeladen“ | „Zuerst das Passwort ändern. Löschen allein reicht nicht, es steht noch im Verlauf.“ |

## Vorgehen bei jedem Fehler

1. **Meldung vollständig lesen** (und vorlesen lassen).
2. Von unten nach oben: **Rechner da?** → **Port offen?** → **richtiger Dienst?** → **Login?** → **Rechte?** → **Daten?**
3. **Eine** Sache ändern, dann erneut testen. Nie mehrere gleichzeitig.
4. Geht es bei anderen? Dann liegt es an deinen Eingaben, nicht am Server.

## Was die Ergebnisse bedeuten (und was nicht)

- Rot (Beben) gegen Grau (Kontrolle) vergleichen. Kleine Unterschiede sind **normaler Zufall**.
- Bei vielen Vergleichen sind einige **zufällig** auffällig. Gilt erst, wenn es sich mit neuen Daten wiederholt.
- **Nachbeben** verzerren alles. Beispiel aus unseren Daten: Kamtschatka (M8,8, Juli 2025) erzeugte allein
  ein scheinbares „Mondphasen-Signal“, das ohne Nachbeben verschwindet.
- Auffällig heißt nicht **verursacht**. Physikalisch plausibel sind nur die Gezeiten von Mond und Sonne.
