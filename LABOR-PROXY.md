# Node-RED auf dem Raspberry Pi hinter einem Proxy

Diese Anleitung ist für das Labor: Node-RED läuft auf dem Raspberry Pi, und das Netz geht nur über einen
Proxy ins Internet. Du brauchst dafür **keine** lokale Node-RED-Installation auf deinem PC.

**Dein eigener Windows-PC** braucht den Proxy auch, damit `npm install` (z. B. `mysql2`), git und winget
funktionieren. Dafür gibt es zwei Doppelklick-Skripte: [proxy-windows/](proxy-windows/README.md).

## Worum es geht

Das Node-RED auf dem Pi muss selbst ins Internet:

| Wofür | Wohin |
|---|---|
| Erdbebendaten (live und Nachladen älterer Jahre) | `https://earthquake.usgs.gov` |
| Grenzen der tektonischen Platten (beim Start, dann wöchentlich) | `https://raw.githubusercontent.com` |
| Paket `astronomy-engine` für die Planetenpositionen | npm-Verzeichnis `https://registry.npmjs.org` |
| Paket `node-red-node-mysql`, falls es noch fehlt | npm-Verzeichnis `https://registry.npmjs.org` |

Kommt Node-RED nicht ins Internet, läuft der Setup-Assistent zwar durch, aber die Tabellen bleiben leer und
Grafana zeigt „No data“. Fehlen nur die Platten, bleibt die Karte ohne Plattengrenzen und das Diagramm
„Earthquakes per tectonic plate“ leer.

**Warum es in Docker auf dem PC klappt:** Docker Desktop übernimmt die Proxy-Einstellung von Windows bzw.
macOS und leitet den Verkehr der Container darüber. Auf dem Pi läuft Node-RED als normaler Dienst und kennt den
Proxy nicht. Man muss ihn dem Dienst einmal mitgeben.

## 1. Proxy-Adresse herausfinden

Du brauchst Adresse und Port, z. B. `http://proxy.schule.local:8080`.

- **Windows:** Einstellungen → Netzwerk und Internet → Proxy. Steht dort ein Server mit Port, ist das die
  Adresse. Steht dort nur ein „Setupskript“ (eine URL), öffne diese URL im Browser und suche die Zeile mit
  `PROXY host:port`.
- Oder in einer Eingabeaufforderung: `netsh winhttp show proxy`
- Sonst: bei der IT nachfragen.

`docker info` zeigt oft nur `http.docker.internal:3128`. Das ist Docker-intern und funktioniert auf dem Pi nicht.

Braucht der Proxy eine Anmeldung, sieht die Adresse so aus: `http://benutzer:passwort@host:port`.

## 2. Auf dem Pi testen

Per SSH auf dem Pi anmelden (`ssh <benutzer>@<ip-des-pi>`, mehr dazu in Lerneinheit 14 „Linux-Server“), dann:

```bash
curl -sI https://earthquake.usgs.gov | head -1                                # ohne Proxy
curl -sI -x http://<proxy>:<port> https://earthquake.usgs.gov | head -1       # mit Proxy
curl -sI -x http://<proxy>:<port> https://registry.npmjs.org | head -1        # npm mit Proxy
curl -sI -x http://<proxy>:<port> https://raw.githubusercontent.com/fraxen/tectonicplates/refs/heads/master/GeoJSON/PB2002_plates.json | head -1   # Platten
```

Diese Tests nur **auf dem Pi** ausführen. Ein GitHub Codespace läuft in einem Rechenzentrum und nicht hinter
eurem Proxy: Dort kommt immer `200`, das sagt über das Labor nichts aus.

| Ergebnis | Bedeutung | Weiter |
|---|---|---|
| Schon der erste Befehl meldet `HTTP/2 200` | Der Pi kommt ohne Proxy raus | Nichts zu tun |
| Erst mit `-x` kommt `HTTP/2 200` (bei allen drei) | Der Proxy lässt den Pi durch | Schritt 3 |
| Auch mit `-x` kein `200` (Fehler oder `403`) | Der Proxy lässt den Pi nicht durch | Schritt 5 |

## 3. Dem Node-RED-Dienst den Proxy mitgeben

Erst die Namen der Node-RED-Dienste herausfinden. Läuft pro Person ein eigenes Node-RED (eigener Port), gibt es
mehrere:

```bash
systemctl list-units --type=service | grep -i node
```

Für **jeden** dieser Dienste (Beispiel `nodered`):

```bash
sudo systemctl edit nodered
```

Im Editor zwischen die beiden Kommentarzeilen einfügen und `<proxy>:<port>` ersetzen:

```ini
[Service]
Environment="HTTPS_PROXY=http://<proxy>:<port>"
Environment="HTTP_PROXY=http://<proxy>:<port>"
Environment="NO_PROXY=localhost,127.0.0.1"
```

Speichern, dann den Dienst neu starten:

```bash
sudo systemctl restart nodered
```

- Node-RED nutzt diese Einstellung für das „HTTP Request“-Node, und npm, das Node-RED zum Installieren von
  Paketen startet, nutzt sie auch.
- `NO_PROXY` nennt Ziele, die direkt erreicht werden, ohne Proxy. Der Planeten-&-Erdbeben-Flow ruft im
  Labornetz nichts per HTTP ab (die Datenbank ist kein HTTP), deshalb reicht die Zeile so. Baust du eigene
  HTTP-Abfragen an Geräte im Labor, trage deren Adressen **einzeln** ein, z. B.
  `localhost,127.0.0.1,192.168.100.133`. Bereiche wie `192.168.100.0/24` versteht Node-RED nicht.
- Die Einstellung bleibt nach einem Neustart des Pi erhalten.

## 4. Prüfen

```bash
systemctl show nodered --property=Environment     # zeigt die eingetragenen Werte
journalctl -u nodered -n 50                       # die letzten Meldungen von Node-RED
```

Dann den Setup-Assistenten wie gewohnt laufen lassen. Klappt es, endet „Warte auf die ersten Daten …“ ohne
Warnung, und im Node-RED-Editor zeigen die Nodes unter dem USGS-Abruf keinen roten Fehler. Unter
„3. Plattengrenzen holen“ steht nach etwa 20 Sekunden am Node „Platten -> SQL“: `52 Platten, 11738 Punkte`.

**Rückgängig machen:** `sudo systemctl revert nodered`, danach `sudo systemctl restart nodered`.

## 5. Wenn der Pi auch mit Proxy nicht rauskommt

Dann lässt der Proxy nur bestimmte Geräte durch. Es bleibt, die IT zu bitten, den Proxy für den Kursblock
abzuschalten oder den Pi freizugeben.

Ist `node-red-node-mysql` bereits auf dem Pi installiert, überspringt der Setup-Assistent diese Installation.
Die USGS-Daten, die Plattengrenzen und `astronomy-engine` brauchen trotzdem Internet.
