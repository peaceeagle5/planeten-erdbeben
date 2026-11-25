"""Gemeinsamer Stil der PDF-Handouts (ReportLab).

Die PDFs in praesentation/ und proxy-windows/ werden aus den Skripten in diesem Ordner erzeugt:

    python3 -m venv .venv && .venv/bin/pip install reportlab
    .venv/bin/python praesentation/quellen/setup_assistent.py
    .venv/bin/python praesentation/quellen/lerneinheiten.py
    .venv/bin/python praesentation/quellen/proxy_kurzanleitung.py

Schriften: Arial, Georgia und Courier New (bei macOS und Windows dabei).
"""
import os
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (Flowable, KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table,
                                TableStyle)

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))

# ------------------------------------------------------------------ Schriften
FONT_DIRS = ['/System/Library/Fonts/Supplemental', '/Library/Fonts', 'C:/Windows/Fonts',
             '/usr/share/fonts/truetype/msttcorefonts']
FONTS = {
    'Arial': ['Arial.ttf', 'arial.ttf'],
    'Arial-Bold': ['Arial Bold.ttf', 'arialbd.ttf', 'Arial_Bold.ttf'],
    'Arial-Italic': ['Arial Italic.ttf', 'ariali.ttf'],
    'Georgia-Bold': ['Georgia Bold.ttf', 'georgiab.ttf', 'Georgia_Bold.ttf'],
    'CourierNew': ['Courier New.ttf', 'cour.ttf', 'Courier_New.ttf'],
}


def _find(names):
    for d in FONT_DIRS:
        for n in names:
            p = os.path.join(d, n)
            if os.path.exists(p):
                return p
    raise FileNotFoundError(f'Schrift nicht gefunden: {names[0]} (gesucht in {FONT_DIRS})')


for _name, _files in FONTS.items():
    pdfmetrics.registerFont(TTFont(_name, _find(_files)))
pdfmetrics.registerFontFamily('Arial', normal='Arial', bold='Arial-Bold', italic='Arial-Italic', boldItalic='Arial-Bold')

# ------------------------------------------------------------------ Farben
NAVY = colors.HexColor('#101B33')      # Titel, Tabellenkopf, Kasten
TEXT = colors.HexColor('#1A2233')
MUTED = colors.HexColor('#8C99AD')
GOLD = colors.HexColor('#F2C14E')
ORANGE = colors.HexColor('#E8572A')
TEAL = colors.HexColor('#2A9D8F')
BLUE = colors.HexColor('#3B5A9A')
LIGHT = colors.HexColor('#EEF2F8')
LINE = colors.HexColor('#E3E7EE')
WHITE = colors.white

W, H = A4
MARGIN_X = 18 * mm
CONTENT_W = W - 2 * MARGIN_X

# ------------------------------------------------------------------ Absatzformate
title = ParagraphStyle('title', fontName='Georgia-Bold', fontSize=22, leading=27, textColor=NAVY, spaceAfter=2)
subtitle = ParagraphStyle('subtitle', fontName='Arial', fontSize=10, leading=13, textColor=MUTED, spaceAfter=10)
h2 = ParagraphStyle('h2', fontName='Georgia-Bold', fontSize=13.5, leading=17, textColor=NAVY, spaceBefore=10, spaceAfter=4)
h3 = ParagraphStyle('h3', fontName='Arial-Bold', fontSize=10.5, leading=14, textColor=TEXT, spaceBefore=6, spaceAfter=2)
body = ParagraphStyle('body', fontName='Arial', fontSize=10, leading=14, textColor=TEXT, spaceAfter=4, alignment=TA_LEFT)
small = ParagraphStyle('small', parent=body, fontSize=8.5, leading=11.5, textColor=MUTED)
cell = ParagraphStyle('cell', parent=body, fontSize=9.5, leading=12.5, spaceAfter=0)
cell_b = ParagraphStyle('cell_b', parent=cell, fontName='Arial-Bold')
head = ParagraphStyle('head', parent=cell, fontName='Arial-Bold', textColor=WHITE)
callout_text = ParagraphStyle('callout', fontName='Arial', fontSize=11.5, leading=16, textColor=WHITE)
step_num = ParagraphStyle('num', fontName='Georgia-Bold', fontSize=13.5, leading=16, textColor=ORANGE)


def code(text):
    """Inline-Code in Courier New."""
    return f'<font name="CourierNew">{text}</font>'


def gold(text):
    return f'<font color="#F2C14E"><b>{text}</b></font>'


def callout(html):
    """Dunkler Kasten mit weißer Schrift (Kernaussage oben auf der ersten Seite)."""
    t = Table([[Paragraph(html, callout_text)]], colWidths=[CONTENT_W])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), NAVY),
        ('LEFTPADDING', (0, 0), (-1, -1), 12), ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 11), ('BOTTOMPADDING', (0, 0), (-1, -1), 13),
    ]))
    return t


def table(rows, widths, first_bold=True, header=True, code_col=None):
    """Tabelle: dunkle Kopfzeile, dünne Trennlinien. rows = Listen von HTML-Strings."""
    data = []
    for r, row in enumerate(rows):
        out = []
        for c, v in enumerate(row):
            if header and r == 0:
                style = head
            elif first_bold and c == 0:
                style = cell_b
            else:
                style = cell
            out.append(Paragraph(v, style))
        data.append(out)
    t = Table(data, colWidths=[w * CONTENT_W for w in widths], repeatRows=1 if header else 0)
    st = [
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6), ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 4.5), ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LINEBELOW', (0, 1 if header else 0), (-1, -1), 0.6, LINE),
    ]
    if header:
        st += [('BACKGROUND', (0, 0), (-1, 0), NAVY), ('TOPPADDING', (0, 0), (-1, 0), 7), ('BOTTOMPADDING', (0, 0), (-1, 0), 7)]
    t.setStyle(TableStyle(st))
    return t


def steps(items, start=1):
    """Nummerierte Schritte: große orange Zahl links, Text rechts."""
    out = []
    for i, html in enumerate(items, start):
        t = Table([[Paragraph(str(i), step_num), Paragraph(html, body)]], colWidths=[7 * mm, CONTENT_W - 7 * mm])
        t.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 0),
                               ('RIGHTPADDING', (0, 0), (-1, -1), 0), ('TOPPADDING', (0, 0), (-1, -1), 1),
                               ('BOTTOMPADDING', (0, 0), (-1, -1), 3)]))
        out.append(t)
    return out


def build(path, story, footer, title_meta, author='Planeten & Erdbeben'):
    def on_page(canvas, doc):
        canvas.saveState()
        canvas.setFont('Arial', 8)
        canvas.setFillColor(MUTED)
        canvas.drawString(MARGIN_X, 12 * mm, footer)
        canvas.drawRightString(W - MARGIN_X, 12 * mm, f'Seite {doc.page}')
        canvas.restoreState()

    doc = SimpleDocTemplate(path, pagesize=A4, leftMargin=MARGIN_X, rightMargin=MARGIN_X, topMargin=16 * mm,
                            bottomMargin=20 * mm, title=title_meta, author=author)
    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    print('geschrieben:', os.path.relpath(path, ROOT))


__all__ = ['Flowable', 'KeepTogether', 'Paragraph', 'Spacer', 'Table', 'TableStyle', 'colors', 'mm']
