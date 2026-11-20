# 05 – Die Planeten-Berechnung

## Lernziele
- Du kannst die drei Koordinatensysteme im Projekt erklären (Ekliptik, Äquator, Horizont).
- Du kannst Winkel richtig vergleichen, auch über die 360°-Grenze hinweg.
- Du verstehst jede Funktion in [src/planets.js](../../src/planets.js).

---

## 1. Was wird überhaupt berechnet?

Wir stehen auf der Erde und schauen zum Himmel. Für einen **Zeitpunkt** und einen **Ort** wollen wir wissen,
wo Sonne, Mond und Planeten zu sehen sind. Die Bahnen der Planeten sind bekannt; die Bibliothek
**astronomy-engine** rechnet sie auf etwa 1 Bogenminute (1/60 Grad) genau aus. Wir müssen nur die richtigen
Funktionen aufrufen und die Ergebnisse sinnvoll aufbereiten.

## 2. Drei Arten, eine Position anzugeben

| System | Werte | Bezieht sich auf | Wofür im Projekt |
|---|---|---|---|
| **Ekliptik** | Länge 0–360°, Breite | die Bahn der Sonne über den Himmel im Jahr | Tierkreiszeichen, Aspekte |
| **Äquator** | Rektaszension (Stunden), Deklination | den Himmelsäquator (wie Längen-/Breitengrade, nur am Himmel) | Sternbild bestimmen |
| **Horizont** | Azimut 0–360°, Höhe -90…90° | **deinen** Standort: wo du hinschauen musst | Mond über/unter dem Horizont am Bebenort |

- **Azimut:** Himmelsrichtung. 0° = Norden, 90° = Osten, 180° = Süden, 270° = Westen.
- **Höhe:** 0° = am Horizont, 90° = genau über dir, negativ = unter dem Horizont (nicht sichtbar).
- **Ekliptikale Länge:** Die Ekliptik ist in 12 Abschnitte zu je 30° geteilt. 0–30° = Widder, 30–60° = Stier, …
  Das sind die **Tierkreiszeichen**.

## 3. Tierkreiszeichen ≠ Sternbild

Ein Tierkreiszeichen ist ein fester 30°-Abschnitt. Ein **Sternbild** ist eine echte, unterschiedlich große
Fläche am Himmel (die IAU hat 88 festgelegt). Weil sich die Erdachse langsam dreht (Präzession), liegen beide
heute etwa ein Zeichen auseinander. Deshalb steht im Projekt z. B. „Sonne: Zeichen Skorpion, Sternbild Waage“.
Beides ist richtig, es ist nur eine andere Einteilung.

## 4. Die Funktionen in src/planets.js

```js
function zodiacOf(elon) {                     // elon = ekliptikale Länge, z. B. 237.4
  const idx = Math.floor(elon / 30);          // 237.4 / 30 = 7.9 → 7
  return { sign: ZODIAC[idx], degreeInSign: round(elon - idx * 30, 4) };  // ZODIAC[7] = 'Scorpio', 27.4°
}
```

**Aspekte** sind besondere Winkel zwischen zwei Himmelskörpern (in der Astrologie wichtig, für uns einfach
eine Messgröße): Konjunktion 0°, Sextil 60°, Quadrat 90°, Trigon 120°, Opposition 180°.
Der **Orbis** ist die erlaubte Abweichung. Bei 8° Orbis zählt 92° noch als Quadrat.
```js
let sep = Math.abs(a.ecliptic.longitudeDeg - b.ecliptic.longitudeDeg);
if (sep > 180) sep = 360 - sep;               // immer den KÜRZEREN Weg um den Kreis nehmen
```
Warum? Sonne bei 350°, Mond bei 10°: `|350 - 10| = 340`, aber eigentlich liegen sie nur **20°** auseinander.

**Rückläufig (retrograd):** Von der Erde aus scheinen Planeten manchmal rückwärts zu wandern, weil die Erde sie
auf ihrer Bahn „überholt“. Wir messen die Länge einen halben Tag vorher und nachher:
```js
const delta = ((after - before + 540) % 360) - 180;  // Differenz im Bereich -180 … +180
return delta < 0;                                    // wird kleiner → rückläufig
```
Der Trick mit `+ 540` und `% 360` sorgt dafür, dass ein Sprung von 359,9° auf 0,1° als **+0,2°** zählt
und nicht als -359,8°.

**Mondphase:** Abstand des Mondes von der Sonne auf der Ekliptik. 0° = Neumond (Mond steht bei der Sonne),
180° = Vollmond (gegenüber).

**Parallaxe:** Der Mond ist so nah, dass er von verschiedenen Orten der Erde aus an leicht verschiedenen Stellen
steht (bis zu 1°). Deshalb rechnet `Equator(body, time, observer, ...)` mit dem **Beobachtungsort**.

## 5. Ein Ergebnis lesen

```
node -e "console.log(JSON.stringify(require('./src/planets').computeSky(new Date(), {latitude: 52.5, longitude: 13.4}).bodies[1], null, 2))"
```
Zeigt den Mond für Berlin jetzt: Äquatorkoordinaten, Azimut/Höhe, Tierkreiszeichen, Sternbild, Helligkeit,
beleuchteter Anteil, rückläufig ja/nein.

## Übung

[uebung.js](uebung.js): die Winkel-Funktionen selbst bauen. Prüfen: `node --test "lernen/05-planeten/*.test.js"`

## So erklärst du es
> „Stell dir den Himmel als Uhr mit 360 Strichen vor. Die Sonne wandert in einem Jahr einmal herum, der Mond
> in einem Monat. Jedes Tierkreiszeichen ist ein 30-Grad-Stück dieser Uhr. Wenn zwei Planeten 90 Grad
> auseinander stehen, nennt man das ein Quadrat. Und weil die Uhr bei 360 wieder bei 0 anfängt, muss man beim
> Abstand immer den kürzeren Weg nehmen.“

## Wenn es nicht klappt

| Beobachtung | Ursache |
|---|---|
| Tierkreiszeichen `undefined` | Länge war ≥ 360 oder negativ: vorher auf 0–360 normalisieren |
| Aspekt mit 340° Abstand | Kürzeren Weg vergessen (`360 - sep`) |
| `-10 % 360` ergibt `-10` | In JavaScript behält `%` das Vorzeichen: `((x % 360) + 360) % 360` |
| Mondposition weicht ~1° von anderen Apps ab | Andere App rechnet vom Erdmittelpunkt aus (ohne Parallaxe) |
| Zeit falsch um 1–2 Stunden | Lokale Zeit statt UTC benutzt. Datum immer mit `Z` am Ende angeben |

## Selbsttest-Fragen
1. Warum steht die Sonne im „Zeichen Skorpion“, aber im „Sternbild Waage“?
2. Zwei Planeten bei 5° und 355°: Welcher Aspekt ist das?
3. Was bedeutet eine Höhe von -25° beim Mond?
4. Warum braucht man für die Tierkreiszeichen keinen Beobachtungsort, für Azimut und Höhe aber schon?
