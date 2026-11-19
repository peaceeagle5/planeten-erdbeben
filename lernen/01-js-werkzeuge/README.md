# 01 – JavaScript-Werkzeuge für den Projektcode

## Lernziele
- Du kannst Template-Strings, Destructuring, `??`, `?.`, Spread `...` und den ternären Operator lesen und schreiben.
- Du erkennst diese Werkzeuge im Projektcode wieder und kannst sagen, was die Zeile macht.

Du kennst schon: `let`/`const`, Funktionen, Arrays, Objekte, `for...of`, `filter`/`map`/`reduce`.
Alles hier ist nur eine **kürzere Schreibweise** für Dinge, die du schon kannst.

---

## 1. Template-Strings statt `+`

Dein Code:
```js
console.log("Food: " + food + ", Calories: " + calories);
```
Mit Template-String (Backticks `` ` `` statt Anführungszeichen, Werte in `${ }`):
```js
console.log(`Food: ${food}, Calories: ${calories}`);
console.log(`Gesamt: ${calories * 2} kcal`); // in ${ } darf jeder Ausdruck stehen
```
Im Projekt, [app.js](../../app.js): `` throw new Error(`Missing parameter: ${name}`) ``

## 2. Destructuring: Werte aus Objekten und Arrays herausholen

```js
const banana = { name: 'Banana', calories: 89, protein: 1.1 };

// vorher
const name = banana.name;
const calories = banana.calories;

// mit Destructuring: gleiche Wirkung
const { name, calories } = banana;

// auch direkt in Funktionsparametern
function describe({ name, calories }) {
  return `${name}: ${calories} kcal`;
}
describe(banana); // "Banana: 89 kcal"
```
Bei Arrays geht es nach Position:
```js
const [lon, lat, depth] = [142.37, 38.29, 24.5]; // lon = 142.37, lat = 38.29, depth = 24.5
```
Im Projekt, [split-usgs.js](../../node-red/functions/split-usgs.js): `const [lon, lat, depth] = f.geometry.coordinates;`
(USGS liefert Koordinaten als Array in genau dieser Reihenfolge.)

## 3. `??` – Standardwert, wenn etwas fehlt

`a ?? b` bedeutet: „Nimm `a`, außer `a` ist `null` oder `undefined`, dann nimm `b`.“
```js
const orb = options.orb ?? 8;        // aus src/planets.js: ohne Angabe 8 Grad
```
**Achtung, Unterschied zu `||`:** `||` ersetzt auch `0`, `''` und `false`.
```js
const depth = 0;
depth || 10   // 10   ← falsch! 0 km Tiefe ist ein echter Wert
depth ?? 10   // 0    ← richtig
```

## 4. `?.` – sicher in verschachtelte Objekte greifen

```js
const feature = { properties: { place: 'Japan' } };
feature.properties.place          // 'Japan'
feature.geometry.coordinates      // FEHLER: Cannot read properties of undefined
feature.geometry?.coordinates     // undefined (kein Absturz)
```
`?.` bricht ab und liefert `undefined`, sobald links davon `null` oder `undefined` steht.
Zusammen mit `??` sehr praktisch: `feature?.properties?.place ?? 'unbekannt'`.

Im Projekt, [nodered.js](../../setup-wizard/lib/nodered.js): `settings.editorTheme?.header?.title`

## 5. Spread `...` – Inhalte ausbreiten

```js
const obst = ['Apple', 'Banana'];
const mehr = [...obst, 'Mango'];           // ['Apple', 'Banana', 'Mango'], obst bleibt unverändert!

const basis = { name: 'Apple', calories: 52 };
const mitFett = { ...basis, fat: 0.3 };    // { name, calories, fat }
const korrigiert = { ...basis, calories: 50 }; // spätere Werte überschreiben frühere
```
Unterschied zu `push`: `push` **verändert** das Array. Spread erzeugt ein **neues**. Neue Objekte zu
erzeugen statt alte zu verändern verhindert viele Fehler, weil niemand „hinter deinem Rücken“ Daten ändert.

Im Projekt, [src/planets.js](../../src/planets.js): `ecliptic: { longitudeDeg: ..., ...zodiacOf(ecl.elon) }`
fügt die Felder `sign` und `degreeInSign` in das Objekt ein.

## 6. Ternärer Operator: `if/else` in einer Zeile

```js
const label = calories < 60 ? 'leicht' : 'schwer';
// gleich wie:
let label2;
if (calories < 60) label2 = 'leicht'; else label2 = 'schwer';
```
Im Projekt: `phaseFraction: body === 'Sun' ? null : round(illum.phase_fraction, 4)`
(die Sonne hat keine „Phase“).

## 7. Kleinkram, der oft vorkommt

| Code | Bedeutung |
|---|---|
| `x => x * 2` | Arrow-Function mit einem Parameter, gibt `x * 2` zurück (kennst du von `map`) |
| `Number('52')` | Text in Zahl umwandeln. `Number('abc')` → `NaN` („keine Zahl“) |
| `Number.isFinite(n)` | Ist `n` eine echte Zahl (nicht `NaN`, nicht unendlich)? |
| `Math.floor(7.9)` | Abrunden → `7` |
| `17 % 5` | Rest der Division → `2` (wichtig für Winkel, siehe Einheit 05) |
| `Object.values(obj)` | Alle Werte eines Objekts als Array |
| `arr.flat()` | `[[1,2],[3]]` → `[1,2,3]` |
| `arr.some(x => ...)` | Ist **mindestens ein** Element passend? → `true`/`false` |

## Übung

[uebung.js](uebung.js) hat 8 Funktionen mit `TODO`. Prüfen: `node --test lernen/01-js-werkzeuge/`

## So erklärst du es
> „Das sind Abkürzungen. `?.` heißt ‚schau nach, aber stürz nicht ab, wenn es nicht da ist‘.
> `??` heißt ‚wenn nichts da ist, nimm diesen Standardwert‘. Und `...` kippt den Inhalt eines Arrays
> oder Objekts in ein neues aus.“

## Wenn es nicht klappt

| Fehlermeldung | Ursache |
|---|---|
| `Cannot read properties of undefined (reading 'x')` | Links von `.x` steht `undefined`. Mit `?.` absichern oder prüfen, warum der Wert fehlt. |
| Ausgabe zeigt wörtlich `${name}` | Normale Anführungszeichen statt Backticks benutzt. |
| `Assignment to constant variable` | Eine `const`-Variable neu zugewiesen. `let` nehmen oder ein neues Objekt erzeugen. |
| Wert ist plötzlich `10` statt `0` | `||` statt `??` benutzt. |

## Selbsttest-Fragen
1. Was ist der Unterschied zwischen `a || b` und `a ?? b`? Nenne einen Fall, in dem es einen Unterschied macht.
2. Warum ist `[...liste, neu]` oft besser als `liste.push(neu)`?
3. Was liefert `const { a, b } = { a: 1 }` für `b`?
4. Lies diese Zeile aus [app.js](../../app.js) laut vor und erkläre sie:
   `elevation: q.has('elevation') ? parseNumber(q.get('elevation'), 'elevation', -500, 10000) : 0`
