# 11 – Statistik: Was die Daten zeigen können

## Lernziele
- Du kannst erklären, warum das Projekt Kontroll-Events braucht.
- Du kannst Häufigkeiten vergleichen und einen einfachen Signifikanztest (Chi-Quadrat) rechnen.
- Du kennst die typischen Denkfehler: Zufallstreffer, Nachbeben, Korrelation ≠ Ursache.
- Du kannst einer Klasse fair erklären, was ein Ergebnis bedeutet und was nicht.

---

## 1. Warum Kontroll-Events?

Angenommen, 30 % aller Beben passierten, als Jupiter im Löwen stand. Ist das auffällig?
**Das kann man allein nicht sagen.** Jupiter braucht 12 Jahre für den Tierkreis. Wenn unsere Daten nur 2025 enthalten,
stand Jupiter **die ganze Zeit** ungefähr im selben Zeichen, und dann passierten natürlich fast alle Beben „im Löwen“.

Deshalb gibt es zu jedem Beben ein **Kontroll-Event**: derselbe Ort, eine zufällige Zeit in den 2 Jahren davor.
Die Kontroll-Events zeigen, wie die Planeten **ohne** einen Zusammenhang verteilt wären. Erst der **Unterschied**
zwischen roten (Beben) und grauen (Kontrolle) Balken in Grafana ist interessant.

Das ist dasselbe Prinzip wie die **Kontrollgruppe** in einer Medikamentenstudie.

## 2. Zufall erzeugt immer Unterschiede

Wirf 1000-mal eine Münze: Fast nie kommt genau 500-mal Kopf. 520 ist völlig normal. Genauso werden Beben und
Kontrolle **nie** genau gleich verteilt sein. Die Frage ist: Ist der Unterschied **größer, als Zufall ihn erklären kann**?

Dafür gibt es Tests wie **Chi-Quadrat** (χ²):
```
χ² = Σ (beobachtet − erwartet)² / erwartet
```
- **beobachtet:** wie viele Beben in jeder Gruppe (z. B. 8 Mondphasen)
- **erwartet:** wie viele es wären, wenn die Beben so verteilt wären wie die Kontrolle
- Großes χ² = große Abweichung. Ab einem **kritischen Wert** gilt sie als „signifikant“ (bei 5 % Irrtum).
  Der kritische Wert hängt von den **Freiheitsgraden** ab: Anzahl Gruppen − 1.

| Freiheitsgrade | 1 | 2 | 4 | 7 (8 Mondphasen) | 11 (12 Zeichen) |
|---|---|---|---|---|---|
| kritischer Wert (5 %) | 3,84 | 5,99 | 9,49 | 14,07 | 19,68 |

„Signifikant bei 5 %“ heißt: Wenn es **keinen** Zusammenhang gäbe, käme so ein Ergebnis nur in 5 % der Fälle zufällig heraus.

## 3. Die drei großen Denkfehler

**Viele Tests → Zufallstreffer.** Das Dashboard erlaubt 10 Körper × 12 Zeichen, 45 Paare × 5 Aspekte, … Wer 100 Tests
bei 5 % macht, findet im Schnitt **5 „signifikante“ Ergebnisse durch reinen Zufall**. Ein Ergebnis zählt erst,
wenn es sich mit **neuen** Daten (anderes Jahr) wiederholt.

**Nachbeben.** Ein großes Beben bringt Hunderte Nachbeben in wenigen Tagen, alle mit fast demselben Himmel.
Dann zählt ein Ereignis hundertfach. Abhilfe: nur starke Beben (M6+) betrachten oder Nachbeben herausfiltern („declustern“).

**Korrelation ≠ Ursache.** Selbst ein echter Zusammenhang beweist nicht, dass die Planeten Beben **verursachen**.
Es braucht eine plausible Erklärung. Physikalisch plausibel sind nur die **Gezeitenkräfte** von Sonne und Mond
(sie verformen die Erde messbar). Studien finden tatsächlich kleine Effekte von Gezeitenspannung auf den Zeitpunkt
von Beben. Die Anziehung der Planeten auf die Erde ist dagegen milliardenfach schwächer.
Darum sind Mondphase, Mondentfernung und Mondhöhe die sinnvollsten Messgrößen im Projekt.

## 4. Fallbeispiel aus echten Daten (Stand: 19.11.2026, 2146 Beben aus 2025/2026)

Deine Zahlen sehen anders aus: je nachdem, welche Jahre du per Backfill geladen hast, und weil die Kontroll-Zeiten
zufällig gewählt werden (ein Test in Docker ergab z. B. χ² = 86 statt 129, mit `--pro-tag` 8,15). Die Lehre bleibt
dieselbe. Lade 2025, dann ist das
Kamtschatka-Beben dabei.

Der χ²-Test der Mondphase über **alle** Beben ergab:

| Phase | beobachtet | erwartet | Abweichung |
|---|---|---|---|
| zunehmende Sichel | 366 | 269 | **+36 %** |
| 1. Viertel | 366 | 245 | **+49 %** |
| Vollmond | 206 | 261 | −21 % |

**χ² = 129** bei kritischen 14,07. Scheinbar ein riesiger Effekt: „Bei zunehmendem Mond bebt es viel häufiger!“

Ein Blick auf die Tage mit den meisten Beben:
```
2025-07-29   34 Beben   M8.8  Kamtschatka   Mondphase 61°
2025-07-30  143 Beben   M6.9  Kamtschatka   Mondphase 66°
2025-07-31   28 Beben   …     Kurilen       Mondphase 78°
2025-08-01   32 Beben   …     Kurilen       Mondphase 90°
```
Das Kamtschatka-Beben (M8,8, eines der stärksten seit Jahrzehnten) hatte in wenigen Tagen über 240 Nachbeben,
alle bei zunehmendem Mond. **Ein einziges Ereignis** erzeugt das ganze „Signal“.

Mit nur dem stärksten Beben pro Tag (`--pro-tag`, 363 Beben): **χ² = 7,85, nicht auffällig.**
Der Effekt verschwindet vollständig.

> Merke: Erst kritisch prüfen, dann staunen. Die erste Frage bei jedem überraschenden Ergebnis ist:
> „Welcher langweilige Grund könnte das auch erklären?“

## Übung

1. [uebung.js](uebung.js): Häufigkeiten, erwartete Werte, χ², Zufallstreffer. Prüfen: `node --test "lernen/11-statistik/*.test.js"`
2. Danach mit deinen echten Daten (benutzt deine Funktionen aus der Übung):
   ```
   node lernen/11-statistik/analyse.js             # alle Beben
   node lernen/11-statistik/analyse.js --pro-tag   # nur das stärkste pro Tag
   node lernen/11-statistik/analyse.js 6 --pro-tag # nur M6+, stärkstes pro Tag
   ```
   Vergleiche die Ergebnisse mit dem Fallbeispiel. Lade dann in Node-RED ein anderes Jahr (Backfill) und
   prüfe: Bleibt es bei „nicht auffällig“?

## So erklärst du es
> „Wenn ich wissen will, ob es bei Vollmond mehr Beben gibt, reicht es nicht, Beben bei Vollmond zu zählen.
> Ich muss vergleichen mit Zeitpunkten **ohne** Beben, sonst zähle ich nur, wie oft Vollmond ist. Und ein kleiner
> Unterschied ist normal, wie bei einer Münze, die nicht genau 50 zu 50 fällt. Erst wenn der Unterschied
> größer ist, als der Zufall erklären kann, und er sich mit neuen Daten wiederholt, wird es spannend.“

## Selbsttest-Fragen
1. Warum stehen die Kontroll-Events am **selben Ort** wie das Beben, aber zu einer **zufälligen Zeit**?
2. Ihr findet: „Bei Mars im Widder 12 % mehr Beben“. Welche drei Fragen stellst du, bevor du es glaubst?
3. Warum sind Ergebnisse zu Pluto mit unseren Kontroll-Events fast nicht aussagekräftig? (Tipp: 2-Jahres-Fenster)
4. Was bedeutet „signifikant bei 5 %“, und was bedeutet es **nicht**?
