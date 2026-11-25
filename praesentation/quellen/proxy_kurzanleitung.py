"""Erzeugt proxy-windows/Kurzanleitung-Proxy-und-Pakete.pdf (3 Seiten). Aufruf siehe stil.py.
Eigener Stil (blau), passend zur ersten Fassung der Kurzanleitung."""
import os
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import KeepTogether, Paragraph, Preformatted, Spacer, Table, TableStyle
from stil import CONTENT_W, ROOT, build, mm  # noqa: F401  (registriert auch die Schriften)

BLUE = colors.HexColor('#1F5F8B')
GREY = colors.HexColor('#555555')
LIGHT_BLUE = colors.HexColor('#EAF2F8')
LIGHT_YELLOW = colors.HexColor('#FFF6E0')
AMBER = colors.HexColor('#E8A33D')
CODE_BG = colors.HexColor('#F0F0F0')
LINE = colors.HexColor('#D9D9D9')

title = ParagraphStyle('t', fontName='Arial-Bold', fontSize=22, leading=27, textColor=BLUE, spaceAfter=3)
subtitle = ParagraphStyle('st', fontName='Arial', fontSize=11.5, leading=15, textColor=GREY, spaceAfter=10)
h2 = ParagraphStyle('h2', fontName='Arial-Bold', fontSize=14, leading=18, textColor=BLUE, spaceBefore=10, spaceAfter=5)
h3 = ParagraphStyle('h3', fontName='Arial-Bold', fontSize=10.5, leading=14, spaceBefore=6, spaceAfter=3)
body = ParagraphStyle('b', fontName='Arial', fontSize=10, leading=13.5, spaceAfter=4)
bullet = ParagraphStyle('bl', parent=body, leftIndent=12, bulletIndent=2, spaceAfter=3)
cell = ParagraphStyle('c', fontName='Arial', fontSize=9.5, leading=12)
cell_h = ParagraphStyle('ch', parent=cell, fontName='Arial-Bold', textColor=colors.white)
box_text = ParagraphStyle('bx', parent=body, fontSize=9.5, leading=13, spaceAfter=0)
mono = ParagraphStyle('m', fontName='CourierNew', fontSize=9.5, leading=12.5)


def code(t):
    return f'<font name="CourierNew">{t}</font>'


def tbl(rows, widths):
    data = [[Paragraph(c, cell_h if i == 0 else cell) for c in r] for i, r in enumerate(rows)]
    t = Table(data, colWidths=[w * CONTENT_W for w in widths], repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BLUE), ('GRID', (0, 0), (-1, -1), 0.5, LINE),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 6), ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 5), ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    return t


def box(html, bg=LIGHT_BLUE, bar=BLUE):
    t = Table([[Paragraph(html, box_text)]], colWidths=[CONTENT_W])
    t.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), bg), ('LINEBEFORE', (0, 0), (0, -1), 3, bar),
                           ('LEFTPADDING', (0, 0), (-1, -1), 10), ('RIGHTPADDING', (0, 0), (-1, -1), 10),
                           ('TOPPADDING', (0, 0), (-1, -1), 8), ('BOTTOMPADDING', (0, 0), (-1, -1), 9)]))
    return t


def codeblock(text):
    t = Table([[Preformatted(text, mono)]], colWidths=[CONTENT_W])
    t.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), CODE_BG), ('LEFTPADDING', (0, 0), (-1, -1), 10),
                           ('TOPPADDING', (0, 0), (-1, -1), 7), ('BOTTOMPADDING', (0, 0), (-1, -1), 7)]))
    return t


def numbered(items, start=1):
    return [Paragraph(t, bullet, bulletText=f'{i}.') for i, t in enumerate(items, start)]


def bullets(items):
    return [Paragraph(t, bullet, bulletText='•') for t in items]


story = [
    Paragraph('Kurzanleitung', title),
    Paragraph('Proxy einrichten und Entwickler-Pakete unter Windows installieren, per Doppelklick', subtitle),
    Paragraph('Worum geht es?', h2),
    Paragraph('Im Schulungsnetz laufen Downloads über einen Proxy, und winget blockiert manche Pakete wegen einer '
              'Zertifikatsprüfung. Statt jedes Mal alles von Hand einzutippen, erledigen zwei kleine Skripte das für dich:', body),
    *bullets(['<b>proxy-setup</b> trägt den Proxy einmalig in alle wichtigen Programme ein.',
              '<b>install-pakete</b> installiert Node.js, ripgrep und Git (auf Wunsch auch die npm-Pakete eines Projekts). '
              'Es schaltet die Zertifikats-Ausnahme von winget dafür kurz ein und danach automatisch wieder aus.']),
    Paragraph('Die vier Dateien', h2),
    tbl([['Datei', 'Wozu'],
         ['<b>proxy-setup.cmd</b>', 'Doppelklick zum Starten des Proxy-Setups'],
         ['proxy-setup.ps1', 'Das eigentliche Proxy-Skript (wird von der .cmd gestartet)'],
         ['<b>install-pakete.cmd</b>', 'Doppelklick zum Starten der Paketinstallation'],
         ['install-pakete.ps1', 'Das eigentliche Installations-Skript (wird von der .cmd gestartet)']], [0.3, 0.7]),
    Spacer(1, 6),
    box('<b>Wichtig:</b> Alle vier Dateien müssen im <b>selben Ordner</b> liegen, z. B. ' + code('C:\\Tools\\setup\\')
        + ' oder der Ordner ' + code('proxy-windows') + ' im Projekt „Planeten &amp; Erdbeben“. Du startest immer nur die '
        '<b>.cmd</b>-Dateien.'),
    Paragraph('Vorbereitung (einmalig)', h2),
    *numbered(['Ordner anlegen, z. B. ' + code('C:\\Tools\\setup') + ', und alle vier Dateien hineinkopieren.',
               'Wenn die Dateien aus dem Internet oder einer E-Mail stammen: Rechtsklick auf jede Datei, dann '
               '<b>Eigenschaften</b>, unten bei „Sicherheit“ einen Haken bei <b>Zulassen</b> setzen und auf <b>OK</b> klicken. '
               'Sonst blockiert Windows sie eventuell.',
               'Proxy-Adresse und Port bereithalten. Die bekommst du von der IT oder der Lehrkraft.']),
    Paragraph('Schritt 1: Proxy einrichten', h2),
    *numbered(['Doppelklick auf <b>proxy-setup.cmd</b>. Bitte <b>nicht</b> „Als Administrator ausführen“ wählen.',
               'Im Menü <b>1</b> eingeben und Enter drücken.',
               'Die Fragen beantworten:']),
    tbl([['Frage', 'Was eingeben?', 'Beispiel'],
         ['Proxy-Adresse', 'Adresse des Proxys, ohne http://', 'proxy.schule.local'],
         ['Port', 'Port-Nummer. Einfach Enter drücken = 8080', '8080'],
         ['Ausnahmen', 'Adressen ohne Proxy. Geräte im Labornetz, z. B. den <b>Raspberry Pi</b>, mit eintragen, sonst '
          'gehen git, curl und npm dorthin über den Proxy.', 'localhost,127.0.0.1,::1,<br/>192.168.100.133'],
         ['Zertifikat', 'Pfad zur .crt/.pem-Datei der Einrichtung, falls vorhanden. Sonst Enter', 'C:\\Tools\\schule.crt']],
        [0.2, 0.47, 0.33]),
    *numbered(['Die Zusammenfassung prüfen und mit <b>j</b> bestätigen.',
               'Frage nach Adminrechten für winget und Systemproxy: <b>j</b> eingeben und das Windows-Fenster „Möchten Sie '
               'zulassen …“ mit <b>Ja</b> bestätigen.',
               'Mit <b>0</b> beenden. Danach <b>alle offenen Konsolenfenster schließen</b>, sonst greift der Proxy dort noch nicht.'], start=4),
    Spacer(1, 4),
    box('Das Skript trägt den Proxy hier ein: Windows-Umgebungsvariablen (HTTP_PROXY, HTTPS_PROXY, NO_PROXY), npm, git, '
        'pip, winget und den Windows-Systemproxy (WinHTTP). Programme, die noch nicht installiert sind, werden einfach '
        'übersprungen. Führe das Setup nach der Paketinstallation am besten noch einmal aus, damit auch npm und git den '
        'Proxy kennen.'),
    Paragraph('Schritt 2: Pakete installieren', h2),
    *numbered(['Doppelklick auf <b>install-pakete.cmd</b>.',
               'Das Fenster „Möchten Sie zulassen …“ mit <b>Ja</b> bestätigen. Das Skript braucht Adminrechte.',
               'Warten. Es installiert nacheinander <b>Node.js LTS</b>, <b>ripgrep</b> und <b>Git</b>. Ist ein Paket schon '
               'installiert, steht in der Übersicht trotzdem „OK“.',
               'Am Ende erscheinen eine Übersicht und die Meldung „Bypass ist wieder AUS“. Mit Enter schließen.']),
    KeepTogether([
        Paragraph('npm-Pakete für ein Projekt (z. B. mysql2)', h3),
        Paragraph('npm-Pakete wie <b>mysql2</b> gehören in den Ordner des Projekts. Hat das Projekt schon eine '
                  + code('package.json') + ' (wie „Planeten &amp; Erdbeben“), installiert ein einziger Befehl alles, was es '
                  'braucht, in den passenden Versionen. Am besten in einer <b>normalen</b> Konsole (nicht als Administrator), '
                  'nachdem der Proxy eingetragen ist:', body),
        codeblock('cd C:\\Users\\DeinName\\projekte\\planeten-erdbeben\nnpm install'),
        Spacer(1, 5),
        Paragraph('Bitte nicht ' + code('npm install mysql2') + ' tippen: Das verändert die ' + code('package.json')
                  + '. Alternativ macht das Skript diesen Schritt mit, wenn du den Projektordner mitgibst:', body),
        codeblock('cd C:\\Tools\\setup\ninstall-pakete.cmd "C:\\Users\\DeinName\\projekte\\planeten-erdbeben"'),
        Spacer(1, 5),
        Paragraph('Mit ' + code('package.json') + ' führt es ' + code('npm install') + ' aus. Hat der Ordner noch keine, legt '
                  'es eine an und installiert die Pakete aus der Liste ' + code('$NpmPakete') + '. Achtung: Das Skript läuft '
                  'mit Adminrechten. Meldest du dich dafür mit einem <b>anderen Admin-Konto</b> an, kennt dessen npm den Proxy '
                  'nicht. Dann lieber den Befehl oben selbst ausführen.', body),
    ]),
    Paragraph('Pakete anpassen', h2),
    Paragraph('Öffne <b>install-pakete.ps1</b> mit einem Editor, z. B. Notepad oder VS Code. Ganz oben stehen zwei Listen:', body),
    codeblock('$WingetPakete = @(\n  "OpenJS.NodeJS.LTS",\n  "BurntSushi.ripgrep.MSVC",\n  "Git.Git"\n)\n\n'
              '$NpmPakete = @(        # nur für Projektordner OHNE package.json\n  "mysql2"\n)'),
    Spacer(1, 5),
    Paragraph('Zeilen hinzufügen oder löschen und die Datei speichern. Die richtige winget-ID findest du so:', body),
    codeblock('winget search python'),
    Spacer(1, 5),
    Paragraph('Aus der Spalte <b>ID</b> den Wert übernehmen, z. B. ' + code('Python.Python.3.12') + '.', body),
    Paragraph('Weitere Funktionen im Proxy-Menü', h2),
    tbl([['Menüpunkt', 'Was passiert'],
         ['<b>1</b>: Proxy setzen', 'Fragt die Daten ab und trägt sie überall ein (siehe Schritt 1)'],
         ['<b>2</b>: Proxy entfernen', 'Löscht alle Proxy-Einträge wieder, z. B. für das WLAN zu Hause'],
         ['<b>3</b>: Anzeigen', 'Zeigt, was aktuell eingetragen ist. Gut zur Kontrolle'],
         ['<b>0</b>: Beenden', 'Schließt das Menü']], [0.3, 0.7]),
    Spacer(1, 6),
    box('<b>Laptop zu Hause?</b> Außerhalb des Schulnetzes gibt es den Proxy nicht, dann schlagen Downloads fehl. Vorher '
        'Menüpunkt <b>2</b> ausführen und in der Schule wieder <b>1</b>.', LIGHT_YELLOW, AMBER),
    Paragraph('Häufige Probleme', h2),
    tbl([['Problem', 'Lösung'],
         ['„Ausführung von Skripts ist auf diesem System deaktiviert“', 'Nicht die .ps1 starten, sondern immer die <b>.cmd</b>-Datei.'],
         ['„winget wurde nicht gefunden“', 'Im Microsoft Store die App <b>„App-Installer“</b> installieren oder aktualisieren.'],
         ['Nach der Installation kennt die Konsole node, npm oder rg nicht', 'Konsole schließen und neu öffnen. Notfalls einmal ab- und wieder anmelden.'],
         ['npm/git meldet Zertifikatsfehler (z. B. „self-signed certificate“, „unable to get local issuer“)',
          'Die IT nach dem Zertifikat der Einrichtung fragen und dessen Pfad im Proxy-Setup bei „Zertifikat“ angeben. '
          'Die SSL-Prüfung bitte <b>nicht</b> abschalten.'],
         ['Downloads hängen oder brechen ab (Timeout)', 'Proxy-Adresse und Port mit Menüpunkt <b>3</b> prüfen. Bist du im '
          'Schulnetz? Zu Hause Menüpunkt 2 ausführen.'],
         ['git, curl oder npm erreichen den Raspberry Pi nicht', 'Die IP des Pi fehlt bei den Ausnahmen: Menüpunkt <b>1</b> '
          'noch einmal, bei „Ausnahmen“ die IP anhängen.'],
         ['Ein Paket steht in der Übersicht auf „FEHLER“', 'Die ID mit ' + code('winget search') + ' prüfen und das Skript '
          'erneut starten. Bereits installierte Pakete stören nicht.'],
         ['„ACHTUNG: Bypass konnte nicht deaktiviert werden“', 'In einer Admin-Konsole von Hand ausführen:<br/>'
          + code('winget settings --disable BypassCertificatePinningForMicrosoftStore')]], [0.4, 0.6]),
    Paragraph('Gut zu wissen', h2),
    *bullets(['Die Zertifikats-Ausnahme von winget ist <b>nur während der Installation</b> aktiv. Sie wird auch dann wieder '
              'ausgeschaltet, wenn ein Fehler auftritt oder du abbrichst.',
              'Das Proxy-Setup arbeitet <b>ohne Benutzername und Passwort</b>. Es werden nur Adresse und Port gespeichert.',
              'Beide Skripte kannst du gefahrlos mehrfach ausführen. Vorhandenes wird überschrieben bzw. übersprungen.',
              'Reihenfolge auf einem neuen Rechner: <b>Proxy-Setup, Pakete, Proxy-Setup noch einmal, dann im Projekt '
              + code('npm install') + '</b>.']),
]

build(os.path.join(ROOT, 'proxy-windows', 'Kurzanleitung-Proxy-und-Pakete.pdf'), story,
      'Kurzanleitung: Proxy-Setup & Paketinstallation unter Windows', 'Kurzanleitung: Proxy-Setup & Paketinstallation')
