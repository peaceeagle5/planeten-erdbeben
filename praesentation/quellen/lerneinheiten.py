"""Erzeugt praesentation/Lerneinheiten-Inhaltsuebersicht.pdf (3 Seiten). Aufruf siehe stil.py.
Die Tabelle entspricht lernen/README.md: bei Änderungen dort auch hier anpassen."""
import os
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.platypus import PageBreak
from stil import (CONTENT_W, LIGHT, MUTED, NAVY, ORANGE, ROOT, TEAL, TEXT, WHITE, Flowable, Paragraph, Spacer, Table,
                  TableStyle, body, build, callout, cell, cell_b, code, gold, h2, h3, head, mm, small, subtitle, table,
                  title)

card_head = ParagraphStyle('card_head', fontName='Georgia-Bold', fontSize=12.5, leading=16, textColor=WHITE)
card_body = ParagraphStyle('card_body', parent=body, fontSize=10, leading=14, spaceAfter=6)
note = ParagraphStyle('note', parent=small, fontName='Arial-Italic', fontSize=8.5, textColor=MUTED, spaceBefore=4, spaceAfter=6)
path_head_fiae = ParagraphStyle('ph1', fontName='Arial-Bold', fontSize=11, leading=14, textColor=ORANGE, spaceBefore=4, spaceAfter=6)
path_head_fisi = ParagraphStyle('ph2', parent=path_head_fiae, textColor=TEAL)


def card(color, heading, paragraphs):
    rows = [[Paragraph(heading, card_head)]] + [[Paragraph(p, card_body)] for p in paragraphs]
    t = Table(rows, colWidths=[(CONTENT_W - 6 * mm) / 2])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), color), ('BACKGROUND', (0, 1), (-1, -1), LIGHT),
        ('LEFTPADDING', (0, 0), (-1, -1), 9), ('RIGHTPADDING', (0, 0), (-1, -1), 9),
        ('TOPPADDING', (0, 0), (-1, 0), 8), ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 1), (-1, -1), 2), ('BOTTOMPADDING', (0, -1), (-1, -1), 8), ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    return t


class Kette(Flowable):
    """Einheiten als farbige Kästchen in Reihen zu je 5, getrennt durch ›."""

    def __init__(self, items, color, per_row=5):
        super().__init__()
        self.items, self.color, self.per_row = items, color, per_row
        self.gap, self.box_h, self.row_gap = 14, 20, 6
        self.width = CONTENT_W
        rows = (len(items) + per_row - 1) // per_row
        self.height = rows * self.box_h + (rows - 1) * self.row_gap

    def wrap(self, *_):
        return self.width, self.height

    def draw(self):
        c = self.canv
        bw = (self.width - (self.per_row - 1) * self.gap) / self.per_row
        for i, label in enumerate(self.items):
            r, k = divmod(i, self.per_row)
            x = k * (bw + self.gap)
            y = self.height - (r + 1) * self.box_h - r * self.row_gap
            c.setFillColor(self.color); c.roundRect(x, y, bw, self.box_h, 4, fill=1, stroke=0)
            c.setFont('Arial-Bold', 9.5); c.setFillColor(WHITE); c.drawCentredString(x + bw / 2, y + 6.5, label)
            if i < len(self.items) - 1 and k < self.per_row - 1:
                c.setFont('Arial', 9); c.setFillColor(MUTED); c.drawCentredString(x + bw + self.gap / 2, y + 6.5, '›')


def dot(kind, color):
    return {'core': f'<font color="{color}">●</font>', 'opt': f'<font color="{color}">○</font>', '': ''}[kind]


O, T = '#E8572A', '#2A9D8F'
UNITS = [
    ('00', 'Das Gesamtbild', 'Bausteine, Datenfluss, Ports', 'Praxis (Quiz)', 'core', 'core', '45 min'),
    ('01', 'JavaScript-Werkzeuge', 'Template-Strings, Destructuring, ??, ?., Spread', 'JS', 'core', '', '2 h'),
    ('02', 'Module und npm', 'require, package.json, node_modules', 'JS', 'core', '', '1 h'),
    ('03', 'HTTP und APIs', 'Client/Server, URL, Statuscodes, JSON', 'JS', 'core', 'opt', '2 h'),
    ('04', 'Asynchrones JavaScript', 'Promise, async/await, fetch', 'JS', 'core', '', '2 h'),
    ('05', 'Planeten-Berechnung', 'Koordinaten, Tierkreis, Aspekte, Blick von der Sonne', 'JS', 'core', '', '2 h'),
    ('06', 'Datenbank und SQL', 'Tabellen, Schlüssel, JOIN, SQL-Injection', 'JS + Praxis (SQL)', 'core', 'core', '3 h'),
    ('07', 'Node-RED', 'Flows, msg, Function-Nodes, unser Flow', 'JS + Hand', 'core', 'opt', '2 h'),
    ('08', 'Grafana', 'Datenquelle, Panels, Variablen, Klick-Links, Ein-/Ausblende-Regeln, Rollen', 'JS + Hand', 'core', 'core', '1,5 h'),
    ('09', 'Der Setup-Assistent', 'Admin-APIs, Auth, Sicherheit, .exe bauen', 'JS', 'core', '', '2 h'),
    ('10', 'Netzwerk und Fehlersuche', 'IP, Ports, Schichtenmodell, echte Fälle', 'JS + Praxis (Fall-Quiz)', 'core', 'core', '2 h'),
    ('11', 'Statistik', 'Kontrollgruppe, χ², Nachbeben, faire Vergleiche, Korrelations-Finder', 'JS', 'core', 'opt', '1 h'),
    ('12', 'Docker', 'Image, Container, Volume, compose.yaml', 'JS + Praxis (Dockerfile)', 'core', 'core', '2 h'),
    ('13', 'Git und GitHub', 'Commits, Branches, .gitignore, Pull Requests', 'JS + Praxis (Repository)', 'core', 'core', '2 h'),
    ('14', 'Linux-Server betreiben', 'SSH, apt, systemctl, Logs, Rechte, Backup, cron', 'Praxis + Hand', 'opt', 'core', '3 h'),
    ('15', 'Netzwerk-Praxis', 'Subnetze, feste IP, DNS, Firewall (ufw)', 'Praxis + Hand', 'opt', 'core', '3 h'),
]


def units_table():
    tight = ParagraphStyle('tight', parent=cell, fontSize=9, leading=11)
    tight_b = ParagraphStyle('tight_b', parent=tight, fontName='Arial-Bold')
    center = ParagraphStyle('c', parent=tight, alignment=1)
    head_c = ParagraphStyle('hc', parent=head, alignment=1, fontSize=9)
    rows = [[Paragraph(t, head if i < 4 else head_c) for i, t in enumerate(['Nr.', 'Einheit', 'Worum es geht', 'Übungen', 'FIAE', 'FISI', 'Zeit'])]]
    for nr, name, topics, ex, fiae, fisi, time in UNITS:
        rows.append([Paragraph(f'<b>{nr}</b>', tight), Paragraph(name, tight_b), Paragraph(topics, tight), Paragraph(ex, tight),
                     Paragraph(dot(fiae, O), center), Paragraph(dot(fisi, T), center), Paragraph(time, tight)])
    widths = [0.05, 0.225, 0.335, 0.18, 0.065, 0.06, 0.085]
    t = Table(rows, colWidths=[w * CONTENT_W for w in widths], repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), NAVY), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 5), ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 2.5), ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LINEBELOW', (0, 1), (-1, -1), 0.6, '#E3E7EE'),
    ]))
    return t


story = [
    Paragraph('Lerneinheiten: Inhaltsübersicht und Lernwege', title),
    Paragraph('Planeten &amp; Erdbeben · 16 Einheiten · für Fachinformatiker:innen Anwendungsentwicklung und Systemintegration', subtitle),
    callout('Alle lernen am selben Projekt, aber nicht dasselbe. <b>Anwendungsentwicklung</b> lernt, wie der Code '
            'funktioniert, und schreibt selbst JavaScript. <b>Systemintegration</b> lernt, wie die Dienste betrieben, '
            'vernetzt und abgesichert werden, ' + gold('ganz ohne Programmieren') + '.'),
    Paragraph('Warum zwei Lernwege?', h2),
    Paragraph('Die beiden Fachrichtungen haben in der Ausbildung unterschiedliche Schwerpunkte. Das Projekt „Planeten &amp; '
              'Erdbeben“ enthält beides: Software, die entwickelt wird, und Server, Datenbanken und Netzwerke, die betrieben '
              'werden. Deshalb kann jede Fachrichtung den Teil vertiefen, der zu ihrem Beruf passt.', body),
    Spacer(1, 4),
]
cards = Table([[
    card(ORANGE, 'Anwendungsentwicklung (FIAE)', [
        '<b>Schwerpunkt im Beruf:</b> Anwendungen konzipieren, programmieren, testen und weiterentwickeln.',
        '<b>Darum im Lernweg:</b> JavaScript von den Grundlagen bis zu asynchronem Code (01–04), die Planetenberechnung '
        '(05), die Logik im Node-RED-Flow (07) und der Setup-Assistent als ganze Anwendung (09).',
        '<b>Übungen:</b> Funktionen schreiben, die automatische Tests prüfen. Das ist selbst ein Kern des Berufs: Code '
        'gegen Tests entwickeln.']),
    card(TEAL, 'Systemintegration (FISI)', [
        '<b>Schwerpunkt im Beruf:</b> IT-Systeme und Netzwerke planen, einrichten, betreiben und absichern.',
        '<b>Darum im Lernweg:</b> Linux-Server betreiben (14), Subnetze und Firewall (15), Fehlersuche im Netzwerk (10), '
        'Container (12) sowie Datenbank und Monitoring aus Betriebssicht (06, 08).',
        '<b>Übungen:</b> Antworten und Befehle in einfache Textdateien schreiben, SQL-Abfragen, ein Dockerfile, ein '
        'eigenes Git-Repository. Automatisch geprüft, aber ohne eine Zeile JavaScript.']),
]], colWidths=[CONTENT_W / 2, CONTENT_W / 2])
cards.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (0, 0), 0),
                           ('RIGHTPADDING', (1, 0), (1, 0), 0), ('LEFTPADDING', (1, 0), (1, 0), 3 * mm),
                           ('RIGHTPADDING', (0, 0), (0, 0), 3 * mm), ('ROWBACKGROUNDS', (0, 0), (-1, -1), [None])]))
story += [
    cards,
    Paragraph('Gemeinsamer Kern', h3),
    Paragraph('Fünf Einheiten gehören zu <b>beiden</b> Wegen: <b>00</b> Gesamtbild, <b>06</b> Datenbank, <b>10</b> '
              'Fehlersuche, <b>12</b> Docker und <b>13</b> Git. Hier arbeiten beide Berufe im Alltag zusammen: Wer eine '
              'Anwendung entwickelt, muss wissen, wo und wie sie läuft. Wer sie betreibt, muss verstehen, was sie braucht. '
              'Datenbanken, Netzwerkfehler, Container und Versionsverwaltung sind die gemeinsame Sprache. Dazu ist '
              '<b>08</b> Grafana für beide nützlich.', body),
    Paragraph('Nichts ist verboten', h3),
    Paragraph('Die Erklärungen jeder Einheit lassen sich unabhängig vom Lernweg lesen. Für FISI lohnen sich zum '
              'Verständnis auch 03 (HTTP), 07 (Node-RED) und 11 (Statistik), für FIAE die Einheiten 14 und 15. '
              'Unterschiedlich ist nur, <b>welche Übungen</b> man macht und welche Einheiten den Kern bilden.', body),
    PageBreak(),
    Paragraph('Die beiden Wege im Überblick', h2),
    Paragraph('Anwendungsentwicklung (FIAE): 14 Einheiten, etwa 25 Stunden', path_head_fiae),
    Kette(['00  Gesamtbild', '01  JavaScript', '02  npm', '03  HTTP', '04  Async', '05  Planeten', '06  Datenbank',
           '07  Node-RED', '08  Grafana', '09  Setup', '10  Fehlersuche', '11  Statistik', '12  Docker', '13  Git'], ORANGE),
    Paragraph('Reihenfolge: 10 am besten nach 03, 12 vor dem ersten „docker compose up“, 13 gern schon früh. Ergänzung: 14 und 15.', note),
    Paragraph('Systemintegration (FISI): 8 Einheiten, etwa 17 Stunden', path_head_fisi),
    Kette(['00  Gesamtbild', '10  Fehlersuche', '15  Netzwerk', '14  Linux', '06  Datenbank', '12  Docker', '08  Grafana',
           '13  Git'], TEAL),
    Paragraph('Zum Lesen dazu: 03 HTTP und 07 Node-RED.', note),
    Paragraph('Alle Einheiten', h2),
    Paragraph(f'<font color="{O}">●</font> / <font color="{T}">●</font> = Kern des Lernwegs · ○ = empfohlen zum Lesen oder '
              'als Ergänzung · <b>JS</b> = JavaScript-Funktionen schreiben · <b>Praxis</b> = ohne Programmieren, automatisch '
              'geprüft · <b>Hand</b> = am echten System', small),
    units_table(),
    PageBreak(),
    Paragraph('Wie die Einheiten zusammenhängen', h2),
    Paragraph('Die Fachteile folgen dem Weg der Daten: <b>Node-RED</b> holt die Erdbeben von der US-Erdbebenbehörde (07), '
              'berechnet die Stellung der Planeten, von der Erde und von der Sonne aus gesehen (05), und speichert alles in '
              'der <b>Datenbank</b> (06), mit eigenen Tabellen für jede Person. <b>Grafana</b> zeigt das Ergebnis (08): Ein '
              'Klick auf ein Beben zeigt den Himmel und das Sonnensystem in diesem Moment. Der <b>Setup-Assistent</b> '
              'richtet diese drei Dienste automatisch ein (09). Die <b>Statistik</b> (11) beantwortet am Ende die '
              'Ausgangsfrage: Was zeigen die Daten wirklich? Der Korrelations-Finder vergleicht dafür Beben mit '
              'Kontroll-Events, ohne Nachbeben und nur dort, wo der Vergleich fair ist.', body),
    Paragraph('Daneben stehen die Einheiten für den <b>Betrieb</b>: Wo laufen die Dienste (12 Docker, 14 Linux-Server), wie '
              'erreichen sie sich (10, 15), und wie wird alles gesichert und versioniert (13 Git, Backup in 14)? Sie gehören '
              'zu keinem einzelnen Schritt im Datenfluss, sondern zu allen.', body),
    Paragraph('So prüft man sich selbst', h2),
    table([['Befehl (im Projektordner)', 'Prüft'],
           [code('node --test lernen/14-linux-server/'), 'eine einzelne Einheit'],
           [code('npm run lernen'), 'alle Übungen (Lernweg FIAE)'],
           [code('npm run lernen:fisi'), 'nur die Übungen ohne Programmieren (Lernweg FISI)'],
           [code('npm run korrelation'), 'kein Test: der Korrelations-Finder mit deinen echten Daten (Einheit 11)']],
          [0.45, 0.55], first_bold=False),
    Spacer(1, 4),
    Paragraph('<b>Grün</b> = richtig · <b>Rot</b> = noch nicht richtig, die Meldung gibt meist einen Tipp · '
              '<b>„noch offen“</b> = noch nicht bearbeitet. Erst danach in die Musterlösung schauen. Start und Installation: '
              + code('ERSTE-SCHRITTE.md') + ' im Lernpaket. Im Schulnetz mit Proxy unter Windows zuerst die Skripte in '
              + code('proxy-windows/') + '.', body),
]

build(os.path.join(ROOT, 'praesentation', 'Lerneinheiten-Inhaltsuebersicht.pdf'), story,
      'Planeten & Erdbeben · Lerneinheiten: Inhaltsübersicht', 'Lerneinheiten Planeten & Erdbeben: Inhaltsübersicht und Lernwege')
