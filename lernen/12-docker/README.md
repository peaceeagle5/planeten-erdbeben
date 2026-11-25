# 12 – Docker

## Lernziele
- Du kannst Image, Container, Volume und Port-Weiterleitung erklären.
- Du kannst die [compose.yaml](../../compose.yaml) des Projekts Zeile für Zeile lesen.
- Du kannst ein eigenes Dockerfile schreiben und die wichtigsten Befehle benutzen.
- Du kannst Docker-Probleme eingrenzen (Logs, Status, Ports).

Voraussetzung: Einheit 10 (Netzwerk). Für die Praxis: Docker Desktop, siehe [ERSTE-SCHRITTE.md](../../ERSTE-SCHRITTE.md).

---

## 1. Welches Problem löst Docker?

„Bei mir geht’s aber!“ Jeder PC hat eine andere Windows-Version, andere Programme, andere Ports belegt.
MariaDB, Node-RED und Grafana einzeln auf 25 Rechnern zu installieren, bringt 25 verschiedene Fehler.

Docker packt ein Programm **mit allem, was es braucht** (Betriebssystem-Teile, Bibliotheken, Einstellungen)
in ein Paket, das überall gleich läuft.

## 2. Die vier Grundbegriffe

| Begriff | Vergleich | Im Projekt |
|---|---|---|
| **Image** | Bauplan / Backform. Unveränderlich, wird aus dem Internet geladen. | `mariadb:11.8`, `nodered/node-red:5.0.10`, `grafana/grafana:13.3.1` |
| **Container** | Ein laufendes Exemplar eines Images (der Kuchen aus der Form). Kann man starten, stoppen, wegwerfen. | `planeten-erdbeben-mariadb-1` |
| **Volume** | Ein Speicherplatz **außerhalb** des Containers. Überlebt das Löschen des Containers. | `db-data`: die Erdbeben-Daten |
| **Port-Weiterleitung** | Ein Loch in der Containerwand, damit dein PC hineinkommt. | `127.0.0.1:3306:3306` |

**Container vs. virtuelle Maschine:** Eine VM simuliert einen ganzen Computer mit eigenem Betriebssystem
(Gigabytes, Minuten zum Starten). Ein Container teilt sich den Kern des Betriebssystems mit dem Rechner und ist nur ein
abgeschotteter Prozess (Megabytes, Sekunden). Auf Windows und Mac läuft Docker trotzdem in einer kleinen Linux-VM
(WSL 2 bzw. Docker Desktop), weil die Images Linux brauchen.

**Image-Namen lesen:** `nodered/node-red:5.0.10` = Herausgeber `nodered`, Name `node-red`, **Tag** (Version) `5.0.10`.
Ohne Tag ist `latest` gemeint. Das ist gefährlich, denn „latest“ ändert sich jeden Monat. Deshalb sind im Projekt alle
Versionen fest angegeben: Heute und in einem Jahr bekommen alle genau dasselbe.

## 3. compose.yaml gelesen

Statt drei lange `docker run …`-Befehle beschreibt **Docker Compose** alle Dienste in einer Datei.

```yaml
services:
  mariadb:
    image: mariadb:11.8                       # welches Image
    environment:                              # Einstellungen als Umgebungsvariablen
      MARIADB_DATABASE: planeten_erdbeben     #   das Image legt diese Datenbank beim 1. Start an
      MARIADB_USER: planeten
    ports:
      - "127.0.0.1:${DB_PORT:-3306}:3306"     # PC-Adresse : PC-Port : Container-Port
    volumes:
      - db-data:/var/lib/mysql                # Daten im Volume, nicht im Container
      - ./db/schema.sql:/docker-entrypoint-initdb.d/01-schema.sql:ro   # Datei vom PC hineinreichen
    healthcheck: …                            # „bin ich bereit?“: prüft Docker alle 5 s

  nodered:
    depends_on:
      mariadb: { condition: service_healthy } # erst starten, wenn die Datenbank bereit ist
```

| Teil | Bedeutung |
|---|---|
| `127.0.0.1:3306:3306` | Port 3306 im Container ist auf deinem PC unter 3306 erreichbar, aber **nur von deinem PC** (127.0.0.1). Ohne die IP vorne wäre er für das ganze Netz offen, mit dem Passwort `planeten-lernen`. |
| `${DB_PORT:-3306}` | Nimm die Variable `DB_PORT` aus der `.env`-Datei; wenn es sie nicht gibt, `3306`. Dieselbe Idee wie `??` in JavaScript. |
| `db-data:/var/lib/mysql` | **benanntes Volume**: Docker verwaltet den Speicherort |
| `GF_PLUGINS_PREINSTALL: volkovlabs-echarts-panel` | beim `grafana`-Dienst: Grafana installiert dieses Plugin bei jedem Start selbst (Business Charts, für das Sonnensystem) |
| `./db/schema.sql:…:ro` | **Bind-Mount**: eine Datei aus dem Projektordner, `ro` = nur lesen |
| `/docker-entrypoint-initdb.d/` | Besonderheit des MariaDB-Images: Alle `.sql`-Dateien darin werden beim **allerersten** Start ausgeführt (bei leerem Volume) |

**Netzwerk:** Compose legt ein internes Netz an, in dem sich die Container über ihre **Dienstnamen** erreichen.
Für Node-RED heißt die Datenbank `mariadb`, nicht `localhost` (siehe Einheit 10).

## 4. Die wichtigsten Befehle

| Befehl | Was er tut |
|---|---|
| `docker compose up -d` | alles bauen/laden und im Hintergrund (`-d` = detached) starten |
| `docker compose ps` | Status aller Dienste |
| `docker compose logs -f nodered` | Ausgaben von Node-RED live (`-f` = follow, Strg+C beendet nur das Mitlesen) |
| `docker compose stop` / `start` | anhalten / weiterlaufen lassen, Daten bleiben |
| `docker compose restart grafana` | einen Dienst neu starten |
| `docker compose down` | Container löschen, **Volumes bleiben** |
| `docker compose down -v` | Container **und Volumes** löschen: alle Daten weg |
| `docker compose exec mariadb mariadb -u lernen -plernen planeten_erdbeben` | einen Befehl **im** laufenden Container ausführen |
| `docker compose pull` | neuere Images laden (nach Änderung der Versionen in compose.yaml) |
| `docker images`, `docker volume ls` | was liegt auf dem PC? |

## 5. Ein eigenes Image: das Dockerfile

Für fertige Programme wie MariaDB gibt es Images. Für **eigenen** Code schreibt man ein **Dockerfile**: das Rezept,
wie das Image gebaut wird. Jede Zeile ist eine **Schicht**; Docker merkt sich Schichten und baut nur neu, was sich ändert.

```dockerfile
FROM node:24-alpine            # Grundlage: kleines Linux mit Node.js 24
WORKDIR /app                   # Arbeitsordner im Image
COPY package*.json ./          # ZUERST nur die Paketlisten …
RUN npm ci --omit=dev          # … und installieren. Ändert sich nur der Code, wird diese Schicht wiederverwendet.
COPY src ./src                 # dann der Code
COPY app.js ./
ENV PORT=3001
EXPOSE 3001                    # Hinweis: dieser Port wird benutzt
USER node                      # nicht als root laufen (Sicherheit)
CMD ["node", "app.js"]         # was beim Start ausgeführt wird
```
Bauen und starten:
```
docker build -t planeten-api .
docker run --rm -p 127.0.0.1:3001:3001 planeten-api
curl "http://127.0.0.1:3001/api/sky?lat=52.5&lon=13.4"
```
Eine `.dockerignore` (wie `.gitignore`) verhindert, dass `node_modules`, `.env` oder `dist/` ins Image kopiert werden.

## Übung

1. **Dockerfile, ohne Programmieren:** Schreibe [Dockerfile](Dockerfile) für die Planeten-API (Vorlage mit TODOs liegt bereit).
   Der Test prüft, ob die wichtigen Bausteine drin sind. Mit Docker kannst du es danach wirklich bauen (Befehle oben,
   im Projektordner: `docker build -f lernen/12-docker/Dockerfile -t planeten-api .`).
   Prüfen: `node --test lernen/12-docker/dockerfile-praxis.test.js`
2. **JavaScript:** [uebung.js](uebung.js): Image-Namen, Port-Angaben und Compose-Variablen zerlegen.
   Prüfen: `node --test lernen/12-docker/uebung.test.js`

## So erklärst du es
> „Ein Image ist wie eine Backform, ein Container ist der Kuchen daraus. Du kannst aus einer Form beliebig viele
> Kuchen backen, und jeder sieht gleich aus, egal in welcher Küche. Die Daten legen wir in eine Dose daneben
> (Volume), damit sie nicht weg sind, wenn wir den Kuchen wegwerfen.“

## Wenn es nicht klappt

| Meldung | Ursache |
|---|---|
| `Cannot connect to the Docker daemon` | Docker Desktop läuft nicht |
| `port is already allocated` | Port auf dem PC belegt (Einheit 10): anderes Programm beenden oder Port in `.env` ändern |
| `pull access denied` / `manifest unknown` | Image-Name oder Tag falsch geschrieben |
| Container startet und stoppt sofort | `docker compose logs <dienst>` lesen: meist Fehler in der Konfiguration |
| `unhealthy` | Healthcheck schlägt fehl: Logs ansehen; bei MariaDB oft ein beschädigtes Volume → `down -v` |
| Änderung an `schema.sql` wirkt nicht | Init-Skripte laufen nur bei **leerem** Volume: `docker compose down -v`, dann `up -d` |
| Daten nach `down` weg | `-v` benutzt, oder kein Volume eingetragen |
| Speicherplatz voll | `docker system df` zeigt Belegung, `docker image prune` räumt alte Images auf |
| `npm install docker` liefert Fehler | Das ist ein npm-Paket, nicht Docker. `npm uninstall docker`, Docker Desktop installieren |

## Selbsttest-Fragen
1. Was ist der Unterschied zwischen `docker compose down` und `docker compose down -v`?
2. Warum steht vor den Ports `127.0.0.1:`? Was wäre ohne?
3. Warum kopiert das Dockerfile zuerst nur `package*.json` und erst später den Code?
4. Warum ist `image: grafana/grafana` ohne Versionsnummer eine schlechte Idee?
5. Du änderst `db/schema.sql`, startest neu, und nichts passiert. Warum?
