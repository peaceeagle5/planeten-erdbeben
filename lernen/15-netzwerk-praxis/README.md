# 15 – Netzwerk-Praxis: Subnetze, feste Adressen, Firewall

## Lernziele
- Du kannst zu einer IP-Adresse mit Präfix (`/24`, `/26`) Netzadresse, Broadcast und Anzahl der Hosts bestimmen.
- Du kannst entscheiden, ob zwei Geräte im selben Netz sind, und private von öffentlichen Adressen unterscheiden.
- Du weißt, warum der Pi eine feste Adresse braucht und wie man sie vergibt.
- Du kannst mit `ufw` eine Firewall für die Projekt-Dienste einrichten, ohne dich auszusperren.

Kein Programmieren nötig. Baut auf Einheit 10 auf. Passt besonders zur Fachrichtung **Systemintegration**.

---

## 1. Aufbau einer IPv4-Adresse

`192.168.100.133` besteht aus 4 Zahlen von 0 bis 255 (je 8 Bit = 1 **Oktett**), zusammen 32 Bit:
```
192      .168      .100      .133
11000000  10101000  01100100  10000101
```
Ein Teil der Adresse bezeichnet das **Netz** (die Straße), der Rest den **Host** (die Hausnummer).
Wo die Grenze liegt, sagt die **Subnetzmaske** oder kürzer das **Präfix**: `/24` heißt „die ersten 24 Bit sind das Netz“.

## 2. Masken und Präfixe

| Präfix | Subnetzmaske | Hosts pro Netz | Beispiel |
|---|---|---|---|
| `/16` | 255.255.0.0 | 65 534 | großes Firmennetz |
| `/24` | 255.255.255.0 | **254** | typisches Schul- oder Heimnetz |
| `/25` | 255.255.255.128 | 126 | Netz halbiert |
| `/26` | 255.255.255.192 | 62 | Netz geviertelt |
| `/30` | 255.255.255.252 | 2 | Verbindung zwischen zwei Routern |

Anzahl Hosts = 2<sup>(32 − Präfix)</sup> − 2. Die zwei fehlenden Adressen sind reserviert:
- die **Netzadresse** (alle Host-Bits 0): bezeichnet das Netz selbst,
- die **Broadcast-Adresse** (alle Host-Bits 1): erreicht alle Geräte im Netz.

## 3. Rechenweg: Netz und Broadcast

**Bei `/24` ist es einfach:** Die ersten drei Zahlen sind das Netz.
`192.168.100.133/24` → Netz `192.168.100.0`, Broadcast `192.168.100.255`, Hosts `.1` bis `.254`.

**Bei `/26`:** Die letzte Zahl wird in Blöcke zu 2<sup>6</sup> = 64 geteilt: 0–63, 64–127, **128–191**, 192–255.
133 liegt im Block 128–191:
`192.168.100.133/26` → Netz `192.168.100.128`, Broadcast `192.168.100.191`, Hosts `.129` bis `.190` (62 Stück).

Allgemein: **Blockgröße = 256 − die erste Zahl der Maske, die nicht 255 ist.** Bei 255.255.255.192 → 256 − 192 = 64.

## 4. Im selben Netz?

Zwei Geräte erreichen sich **direkt**, wenn ihr Netzteil gleich ist. Sonst brauchen sie einen **Router** (Gateway).
| Gerät A | Gerät B | Präfix | Gleiches Netz? |
|---|---|---|---|
| 192.168.100.133 | 192.168.100.20 | /24 | ja (beide 192.168.100.x) |
| 192.168.100.133 | 192.168.101.20 | /24 | **nein** (100 ≠ 101) |
| 192.168.100.133 | 192.168.101.20 | /16 | ja (beide 192.168.x.x) |

Darum klappt der Setup-Assistent nur, wenn dein PC im selben Netz wie der Pi ist (oder ein Router dazwischen vermittelt).
Typischer Fehler: Laptop im Gäste-WLAN, Pi im Lehrernetz.

## 5. Private und besondere Adressen

| Bereich | Bedeutung |
|---|---|
| `10.0.0.0/8` | privat |
| `172.16.0.0/12` (172.16.0.0 – 172.31.255.255) | privat |
| `192.168.0.0/16` | privat (fast alle Heim- und Schulnetze) |
| `127.0.0.0/8` | **Loopback**: der Rechner selbst (Einheit 10) |
| `169.254.x.x` | „kein DHCP-Server gefunden“: Das Gerät hat sich selbst eine Notadresse gegeben |

Private Adressen sind im Internet nicht erreichbar. Der Router übersetzt sie beim Weg nach draußen (**NAT**).
Deshalb kann der Pi zwar USGS abrufen, aber niemand aus dem Internet kann den Pi direkt ansprechen.

## 6. Eine feste Adresse für den Pi

Alle tragen die IP des Pi in den Setup-Assistenten ein, und Node-RED und Grafana sind darunter erreichbar.
Bekommt der Pi nach einem Neustart eine **andere** Adresse vom DHCP-Server, geht nichts mehr.

| Weg | Wie | Bewertung |
|---|---|---|
| **DHCP-Reservierung** | im Router: „diese MAC-Adresse bekommt immer 192.168.100.133“ | **empfohlen**: zentral verwaltet, keine Konflikte |
| statisch auf dem Pi | in den Netzwerkeinstellungen des Pi fest eintragen (Raspberry Pi OS Bookworm: `nmcli`) | geht, aber die Adresse muss außerhalb des DHCP-Bereichs liegen |

Die MAC-Adresse des Pi zeigt `ip link` (Zeile `link/ether`).

## 7. Namen statt Zahlen

- **DNS** übersetzt Namen in IP-Adressen (`earthquake.usgs.gov` → …). Fehler: `ENOTFOUND` (Einheit 10).
- **mDNS**: Viele Pis sind im lokalen Netz als `raspberrypi.local` erreichbar. Das funktioniert nicht in jedem Netz
  (Schul-WLANs blockieren es oft). **Im Zweifel die IP benutzen.**
- **hosts-Datei**: eigener Eintrag nur für diesen PC. Linux/Mac `/etc/hosts`,
  Windows `C:\Windows\System32\drivers\etc\hosts`. Zeile: `192.168.100.133  planeten-pi`

## 8. Firewall mit ufw

Eine Firewall entscheidet, welche Verbindungen **ankommen** dürfen. Grundsatz: **Alles verbieten, nur das Nötige
erlauben** (*default deny*). Auf dem Pi geht das mit `ufw` („uncomplicated firewall“).

Was braucht unser Projekt?
| Dienst | Port | Wer muss darauf zugreifen? |
|---|---|---|
| SSH | 22 | Lehrkraft / Admin aus dem Schulnetz |
| Node-RED | 1880–1899 (pro Person ein Port) | Schulnetz |
| Grafana | 3000 | Schulnetz |
| MariaDB | 3306 | Schulnetz (für den Setup-Assistenten und Übungen) |

```
sudo ufw default deny incoming                                          # alles Eingehende verbieten …
sudo ufw default allow outgoing                                         # … Ausgehendes erlauben (USGS, Updates)
sudo ufw allow from 192.168.100.0/24 to any port 22 proto tcp           # SSH ZUERST, sonst sperrst du dich aus!
sudo ufw allow from 192.168.100.0/24 to any port 1880:1899 proto tcp    # Node-RED-Ports
sudo ufw allow from 192.168.100.0/24 to any port 3000 proto tcp         # Grafana
sudo ufw allow from 192.168.100.0/24 to any port 3306 proto tcp         # MariaDB
sudo ufw enable                                                         # einschalten
sudo ufw status numbered                                                # Regeln mit Nummern anzeigen
sudo ufw delete 3                                                       # Regel Nr. 3 löschen
```
**Wichtig:**
- **Erst SSH erlauben, dann `enable`.** Wer über SSH angemeldet ist und `ufw enable` ohne SSH-Regel ausführt,
  sperrt sich aus und muss mit Bildschirm und Tastatur an den Pi.
- `from 192.168.100.0/24` begrenzt auf das Schulnetz. Ohne `from` wäre der Port für jede Adresse offen.
- **Docker umgeht ufw:** Ports, die Docker mit `ports:` veröffentlicht, sind trotz ufw-Regeln erreichbar,
  weil Docker die Firewall-Regeln selbst setzt. Darum bindet unsere [compose.yaml](../../compose.yaml) alle Ports an
  `127.0.0.1`.

**Windows Defender Firewall:** Sie prüft vor allem **eingehende** Verbindungen. Der Setup-Assistent baut nur
**ausgehende** Verbindungen auf (zum Pi oder zu Docker) und lauscht selbst nur auf `127.0.0.1`. Deshalb braucht er
keine Freigabe. Fragt Windows trotzdem, reicht „Private Netzwerke“.

## 9. Testen: vorher und nachher

```
nc -zv 192.168.100.133 3000                          # Mac / Linux: Port erreichbar?
Test-NetConnection 192.168.100.133 -Port 3000        # Windows PowerShell
```
Vor dem Einschalten der Firewall testen, danach wieder: Was vorher ging und danach nicht mehr, blockiert die Firewall.

## Übung

1. **Subnetze und Adressen:** [antworten.txt](antworten.txt): rechnen und entscheiden.
2. **Firewall und Tests:** [befehle.txt](befehle.txt): die ufw-Regeln für das Projekt und die Prüfbefehle.

Prüfen: `node --test lernen/15-netzwerk-praxis/`

**Praxis (auf dem Pi, mit Lehrkraft):** Firewall nach Abschnitt 8 einrichten. Vorher und nachher von deinem PC aus
die Ports 22, 1880, 3000 und 3306 testen. Danach `sudo ufw status numbered` ansehen und erklären.

## So erklärst du es
> „Die IP-Adresse ist wie eine Anschrift: Straße und Hausnummer. Die Maske sagt, wo die Straße aufhört und die
> Hausnummer anfängt. Wer in derselben Straße wohnt, kann direkt klingeln, alle anderen brauchen die Post, den Router.
> Und die Firewall ist der Türsteher: Wer nicht auf der Liste steht, kommt nicht rein, und die Liste schreiben wir so
> kurz wie möglich.“

## Wenn es nicht klappt

| Beobachtung | Ursache |
|---|---|
| PC hat eine Adresse `169.254.x.x` | kein DHCP-Server erreicht: Kabel, WLAN, falsches Netz |
| Ping zum Pi geht, Port nicht | Firewall auf dem Pi blockiert (ufw-Regel fehlt) oder Dienst läuft nicht |
| Nach `ufw enable` hängt die SSH-Verbindung | SSH-Regel vergessen: am Pi direkt `sudo ufw allow 22/tcp` |
| Pi ist plötzlich unter einer anderen IP | keine DHCP-Reservierung: Abschnitt 6 |
| `raspberrypi.local` geht nicht | mDNS im Netz blockiert: IP benutzen |
| Port ist trotz ufw offen | veröffentlichter Docker-Port: in compose.yaml an 127.0.0.1 binden |

## Selbsttest-Fragen
1. Wie viele Geräte passen in ein `/26`-Netz, und warum nicht 64?
2. Warum muss die SSH-Regel vor `ufw enable` stehen?
3. Dein Laptop hat `10.0.5.17/24`, der Pi `192.168.100.133/24`. Warum kann der Setup-Assistent den Pi nicht erreichen?
4. Warum ist eine DHCP-Reservierung besser als eine statische Adresse auf dem Pi?
5. Wieso hilft `127.0.0.1:` in der compose.yaml auch dann, wenn ufw aktiv ist?
