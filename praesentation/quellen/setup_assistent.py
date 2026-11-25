"""Erzeugt praesentation/Setup-Assistent-erklaert.pdf (2 Seiten). Aufruf siehe stil.py."""
import os
from stil import (BLUE, CONTENT_W, GOLD, LIGHT, MUTED, NAVY, ORANGE, ROOT, TEXT, WHITE, Flowable, KeepTogether,
                  Paragraph, Spacer, body, build, callout, code, gold, h2, mm, steps, subtitle, table, title)
import math
from reportlab.lib import colors
from reportlab.pdfbase.pdfmetrics import stringWidth


class Diagramm(Flowable):
    """Windows-PC links (Programm + Browser), rechts MariaDB, Node-RED, Grafana mit Pfeilen."""

    def __init__(self, width=CONTENT_W, height=82 * mm):
        super().__init__()
        self.width, self.height = width, height

    def wrap(self, *_):
        return self.width, self.height

    @staticmethod
    def runs(c, x, y, parts, size=8.5, color=TEXT):
        """Text aus Stücken [(text, fett)] nebeneinander, mit gemessener Breite."""
        for t, bold in parts:
            font = 'Arial-Bold' if bold else 'Arial'
            c.setFont(font, size); c.setFillColor(color); c.drawString(x, y, t)
            x += stringWidth(t, font, size)

    def text(self, c, x, y, lines, size=8.5, color=TEXT, lead=11):
        for i, (t, bold) in enumerate(lines):
            c.setFont('Arial-Bold' if bold else 'Arial', size)
            c.setFillColor(color)
            c.drawString(x, y - i * lead, t)

    def draw(self):
        c = self.canv
        w, h = self.width, self.height
        # linke Fläche: Windows-PC
        c.setFillColor(LIGHT); c.setStrokeColor(LIGHT)
        c.roundRect(0, 0, 0.47 * w, h, 6, fill=1, stroke=0)
        self.text(c, 10, h - 18, [('Windows-PC', True)], size=10.5)
        # Programm (dunkler Kasten)
        px, py, pw, ph = 10, h - 98, 0.41 * w, 64
        c.setFillColor(NAVY); c.roundRect(px, py, pw, ph, 5, fill=1, stroke=0)
        self.text(c, px + 8, py + ph - 14, [('planeten-erdbeben-setup.exe', True), ('Node.js + Assistent in einer Datei.', False),
                                             ('Startet einen Webserver nur auf', False)], color=WHITE)
        c.setFont('CourierNew', 8.5); c.setFillColor(colors.HexColor('#C9D1DE'))
        c.drawString(px + 8, py + ph - 14 - 33, '127.0.0.1:8790')
        # Verbindung Programm -> Browser
        c.setStrokeColor(MUTED); c.setLineWidth(1)
        c.line(px + pw / 2, py, px + pw / 2, 52)
        # Browser
        bx, by, bw, bh = px, 10, pw, 42
        c.setFillColor(WHITE); c.setStrokeColor(MUTED); c.roundRect(bx, by, bw, bh, 5, fill=1, stroke=1)
        self.runs(c, bx + 8, by + bh - 13, [('Browser: ', True), ('Setup-Seite', False)])
        c.drawString(bx + 8, by + bh - 24, 'Adressen, Logins, Tabellen-Präfix,')
        c.drawString(bx + 8, by + bh - 35, '„Alles einrichten“')

        # rechte Fläche: Server (gestrichelt)
        rx = 0.6 * w
        c.setStrokeColor(colors.HexColor('#3B5A9A')); c.setDash(3, 2); c.setLineWidth(0.8)
        c.roundRect(rx, 0, w - rx, h, 6, fill=0, stroke=1); c.setDash()
        self.runs(c, rx + 10, h - 15, [('Raspberry Pi ', True), ('(Labor) ', False), ('oder Docker', True)])
        self.runs(c, rx + 10, h - 26, [('(Workstation, Zuhause)', False)])
        boxes = [
            ('MariaDB', BLUE, WHITE, ['legt Datenbank und', 'deine eigenen Tabellen an']),
            ('Node-RED', ORANGE, WHITE, ['installiert den MySQL-Node,', 'legt den Tab mit 22 Nodes an']),
            ('Grafana', GOLD, TEXT, ['legt Datenquelle, Dashboard', 'und das Plugin an']),
        ]
        labels = ['SQL', 'HTTP', 'HTTP']
        top = h - 40
        for i, (name, fill, fg, desc) in enumerate(boxes):
            y = top - 34 - i * 52
            c.setFillColor(fill); c.roundRect(rx + 10, y, 62, 34, 4, fill=1, stroke=0)
            c.setFont('Arial-Bold', 9.5); c.setFillColor(fg); c.drawCentredString(rx + 41, y + 13, name)
            for k, t in enumerate(desc):
                c.setFont('Arial', 8); c.setFillColor(TEXT); c.drawString(rx + 80, y + 22 - k * 10, t)
            # Pfeil vom Programm
            sx, sy = px + pw, py + ph - 26
            ex, ey = rx + 10, y + 17
            c.setStrokeColor(NAVY); c.setLineWidth(1); c.line(sx, sy, ex - 2, ey)
            a = math.atan2(ey - sy, ex - sx)
            p = c.beginPath(); p.moveTo(ex, ey)
            p.lineTo(ex - 6 * math.cos(a) + 3 * math.sin(a), ey - 6 * math.sin(a) - 3 * math.cos(a))
            p.lineTo(ex - 6 * math.cos(a) - 3 * math.sin(a), ey - 6 * math.sin(a) + 3 * math.cos(a)); p.close()
            c.setFillColor(NAVY); c.drawPath(p, fill=1, stroke=0)
            # Beschriftung über dem Pfeil, kurz vor dem Ziel (dort liegen die Pfeile weit genug auseinander)
            t = 0.62
            lx, ly = sx + (ex - sx) * t, sy + (ey - sy) * t
            c.setFont('Arial-Bold', 7.5); c.setFillColor(MUTED)
            c.drawCentredString(lx - 4 * math.sin(a), ly + 6 * math.cos(a), labels[i])


story = [
    Paragraph('Der Setup-Assistent: Wie die .exe funktioniert', title),
    Paragraph('Planeten &amp; Erdbeben · für Schüler:innen und Lehrkräfte', subtitle),
    callout('<b>Die .exe installiert auf dem Windows-PC nichts.</b> Sie richtet Dienste ein, die schon laufen – '
            + gold('sie ist die Fernbedienung, nicht das Gerät.')),
    Paragraph('Voraussetzung: Die Dienste laufen schon', h2),
    Paragraph('Node-RED, MariaDB und Grafana müssen bereits irgendwo laufen. Die .exe verbindet sich über das '
              'Netzwerk mit ihnen.', body),
    table([['Ort', 'Wo laufen Node-RED, MariaDB und Grafana?', 'Was vorher tun?'],
           ['Labor', 'auf dem Raspberry Pi', 'nichts, sie laufen schon'],
           ['Workstation', 'in Docker auf dem PC', 'Docker Desktop starten, dann ' + code('docker compose up -d')],
           ['Zuhause', 'in Docker auf dem PC', 'wie an der Workstation']], [0.15, 0.3, 0.55]),
    Paragraph('So hängt alles zusammen', h2),
    Diagramm(),
    Paragraph('Was beim Doppelklick passiert', h2),
    *steps([
        '<b>Die .exe startet.</b> Ein Konsolenfenster öffnet sich, dazu ein kleiner Webserver, der nur auf dem eigenen '
        'PC erreichbar ist. Der Browser zeigt die Setup-Seite.',
        '<b>Adressen und Logins eingeben.</b> Der Assistent testet jede Verbindung und erklärt Fehler auf Deutsch. '
        'Aus deinem Namen entsteht der <b>Tabellen-Präfix</b> (z. B. ' + code('anna_') + '): Alle teilen sich eine '
        'Datenbank, aber jede:r hat eigene Tabellen. An der Workstation füllt der Knopf „Lokale Docker-Umgebung“ alles '
        'aus, die Ports kommen aus der ' + code('.env') + '.',
        '<b>„Alles einrichten“.</b> Der Assistent schickt dieselben Anfragen, die man sonst per Maus in Node-RED und '
        'Grafana auslösen würde: <b>MariaDB</b> bekommt die Datenbank und deine fehlenden Tabellen; alten Tabellen fügt er '
        'neue Spalten hinzu. <b>Node-RED</b> bekommt das Zusatzpaket ' + code('node-red-node-mysql') + ' und den Tab '
        '„Planeten &amp; Erdbeben“ mit dem Datenbank-Login und deinem Präfix. Beim Deployen lädt Node-RED selbst die '
        'Rechenbibliothek ' + code('astronomy-engine') + '. <b>Grafana</b> bekommt die Datenquelle, das persönliche '
        'Dashboard und, mit einem Server-Admin-Konto, das Plugin Business Charts für das Sonnensystem. In Grafana 13 '
        'schaltet oben „View“ zwischen Erdkarte und Sonnensystem um.',
        '<b>Kontrolle.</b> Der Assistent wartet, bis die ersten Erdbeben berechnet in der Datenbank stehen.',
        '<b>„Setup beenden“.</b> Webserver und Programm schließen sich. Node-RED, Datenbank und Grafana arbeiten ohne '
        'die .exe weiter.',
    ]),
    Paragraph('Was auf dem Windows-PC zurückbleibt', h2),
    Paragraph('Praktisch nichts: keine Installation, kein Eintrag im Startmenü, nichts in der Registry. Nur der Browser '
              'merkt sich die eingetippten Adressen und Namen für den nächsten Start, <b>Passwörter nie</b>. Die .exe kann '
              'man danach löschen.', body),
    Paragraph('Warum die Datei rund 100 MB groß ist', h2),
    Paragraph('Sie enthält Node.js komplett. Deshalb muss auf dem PC vorher nichts installiert sein, nicht einmal '
              'Node.js. Zusätzlich stecken die Setup-Seite, das Datenbank-Schema, der Node-RED-Flow, die Grafana-Abfragen '
              'und das Zeichenprogramm für das Sonnensystem in der Datei.', body),
    KeepTogether([
        Paragraph('Häufige Stolpersteine', h2),
        table([['Beobachtung', 'Was tun?'],
               ['Windows: „Der Computer wurde durch Windows geschützt“',
                'Die Datei ist nicht signiert: „Weitere Informationen“ → „Trotzdem ausführen“.'],
               ['Der Browser öffnet sich nicht', 'Die Adresse aus dem Konsolenfenster in den Browser kopieren.'],
               ['„Keine Datenbank unter … erreichbar“',
                'Workstation: Port in der ' + code('.env') + ' geändert (z. B. 3307)? Dann noch einmal „Lokale '
                'Docker-Umgebung“ klicken. Labor: ' + code('bind-address') + ' auf dem Pi.'],
               ['„Unter … läuft kein Node-RED“',
                'Läuft der Dienst? An der Workstation: ' + code('docker compose ps') + '. Im Labor: den eigenen Port '
                'nehmen („Mein Node-RED finden“).'],
               ['„Dieses Node-RED wurde von … eingerichtet“',
                'Wahrscheinlich der Port einer anderen Person. Den eigenen Port prüfen, bevor man überschreibt.'],
               ['Das Sonnensystem-Panel bleibt leer',
                'Das Plugin Business Charts fehlt. Installieren darf es nur ein Grafana-Server-Admin (die Lehrkraft).'],
               ['Linux / Pi: „libatomic.so.1 … cannot open“',
                'Einmal ' + code('sudo apt install libatomic1') + ', vorher ' + code('chmod +x') + ' auf die Datei.']],
              [0.4, 0.6], first_bold=False),
    ]),
    Paragraph('Download und mehr', h2),
    Paragraph('Die Programme für Windows, Linux und den Raspberry Pi gibt es auf GitHub unter <b>Releases</b> (Zugang nur '
              'auf Einladung). Ausführlich erklärt ist der Assistent in der Lerneinheit ' + code('lernen/09-setup-assistent')
              + ', die Installation in ' + code('ERSTE-SCHRITTE.md') + '.', body),
]

build(os.path.join(ROOT, 'praesentation', 'Setup-Assistent-erklaert.pdf'), story,
      'Planeten & Erdbeben · Setup-Assistent erklärt', 'Der Setup-Assistent: Wie die .exe funktioniert')
