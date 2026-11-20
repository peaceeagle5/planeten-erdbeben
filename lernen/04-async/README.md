# 04 – Asynchrones JavaScript

## Lernziele
- Du kannst erklären, warum Netzwerk-Code asynchron ist.
- Du kannst `async`/`await`, `fetch` und `try`/`catch` benutzen.
- Du weißt, wann Aufgaben nacheinander und wann gleichzeitig laufen sollen (`Promise.all`).

---

## 1. Warum asynchron?

Dein bisheriger Code läuft Zeile für Zeile, jede Zeile ist sofort fertig. Eine Anfrage an USGS dauert
aber vielleicht 300 ms, eine Datenbank-Abfrage 20 ms. Würde JavaScript so lange **stehen bleiben**,
könnte Node-RED in der Zeit nichts anderes tun, kein anderer Browser würde bedient.

Stattdessen: **Anfrage abschicken, weitermachen, später das Ergebnis abholen.**

> Wie im Restaurant mit Pager: Du bestellst, bekommst einen Pager (das **Promise**) und setzt dich hin.
> Wenn das Essen fertig ist, piept er. In der Zwischenzeit kann die Kasse andere Gäste bedienen.

## 2. Promise

Ein **Promise** ist ein Versprechen auf einen Wert, der später kommt. Es hat drei Zustände:

| Zustand | Bedeutung |
|---|---|
| pending | wartet noch |
| fulfilled | fertig, Wert ist da |
| rejected | fehlgeschlagen, Fehler ist da |

```js
const p = fetch('https://earthquake.usgs.gov/...');
console.log(p);   // Promise { <pending> }  ← noch nicht die Daten!
```

## 3. async und await

`await` wartet auf ein Promise und gibt den Wert zurück. `await` geht nur in einer `async function`.

```js
async function countQuakes() {
  const res = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);  // 404, 500 … werfen fetch NICHT automatisch!
  const data = await res.json();                       // auch das Lesen des Inhalts dauert
  return data.features.length;
}

countQuakes().then((n) => console.log(n));   // von außen: .then oder wieder await
```
Eine `async function` gibt **immer** ein Promise zurück, auch wenn du `return 5` schreibst.

## 4. Fehler abfangen: try / catch

```js
try {
  const n = await countQuakes();
  console.log(`${n} Beben`);
} catch (err) {
  console.log(`Fehlgeschlagen: ${err.message}`);   // kein Internet, Server down, HTTP-Fehler …
}
```
Im Projekt, [nodered.js](../../setup-wizard/lib/nodered.js) `request()`: `fetch` steht in `try`, und im
`catch` wird aus dem technischen Code (`ECONNREFUSED`) eine verständliche deutsche Meldung.

## 5. Nacheinander oder gleichzeitig?

```js
// NACHEINANDER: 3 × 1 Sekunde = 3 Sekunden. Richtig, wenn Schritt 2 das Ergebnis von Schritt 1 braucht.
await setupDb();
await setupNodeRed();     // braucht die Tabellen aus Schritt 1
await setupGrafana();

// GLEICHZEITIG: alle 3 starten sofort, insgesamt ~1 Sekunde. Richtig, wenn sie unabhängig sind.
const [db, nr, gf] = await Promise.all([testDb(), testNodeRed(), testGrafana()]);
```
Im Projekt:
- [server.js](../../setup-wizard/server.js) `install()`: die Einrichtung läuft **nacheinander** (Reihenfolge wichtig).
- [ui.html](../../setup-wizard/ui.html): die Verbindungstests laufen **gleichzeitig** mit `Promise.all`.
- [nodered.js](../../setup-wizard/lib/nodered.js) `scanNodeRed()`: 120 Ports werden in Gruppen zu je 50
  gleichzeitig geprüft. Alle 120 auf einmal würde den Pi unnötig belasten, einzeln würde es zu lange dauern.

## 6. Zeitlimits

Antwortet ein Server gar nicht (falsche IP), würde `fetch` sehr lange warten. Deshalb:
```js
await fetch(url, { signal: AbortSignal.timeout(2500) });   // nach 2,5 s abbrechen
```

## Übung

[uebung.js](uebung.js). Die Tests geben dir ein nachgebautes `fetch` (`fetchFn`), damit sie ohne Internet laufen.
Prüfen: `node --test "lernen/04-async/*.test.js"`

Zum Ausprobieren mit echtem Internet:
```
node -e "fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson').then(r=>r.json()).then(d=>console.log(d.features.length))"
```

## So erklärst du es
> „Wenn das Programm etwas aus dem Netz holt, wartet es nicht starr, sondern bekommt einen ‚Abholschein‘
> (Promise). Mit `await` sagt man: ‚Hier brauche ich das Ergebnis, warte darauf.‘ Und weil im Netz immer
> etwas schiefgehen kann, packt man das in `try`/`catch`.“

## Wenn es nicht klappt

| Beobachtung | Ursache |
|---|---|
| Ausgabe `Promise { <pending> }` | `await` vergessen |
| `await is only valid in async functions` | Die umgebende Funktion ist nicht `async` |
| Programm ist fertig, bevor Daten da sind | Promise nicht abgewartet (`await` / `.then` fehlt) |
| `res.json is not a function` | `await` vor `fetch` vergessen: `res` ist noch ein Promise |
| Fehler wird „verschluckt“, nichts passiert | Kein `catch`, oder `catch` gibt nichts aus |
| Bei HTTP 500 läuft der Code einfach weiter | `fetch` wirft bei 4xx/5xx **nicht**: `res.ok` prüfen |
| `UnhandledPromiseRejection` | Ein Promise ist fehlgeschlagen und niemand hat `catch` benutzt |

## Selbsttest-Fragen
1. Was gibt `async function f() { return 5 }` zurück, wenn man `f()` ohne `await` aufruft?
2. Warum prüft man `res.ok`, obwohl `fetch` doch in `try` steht?
3. Wann ist `Promise.all` falsch? Nenne ein Beispiel aus dem Setup-Assistenten.
4. Warum braucht der Port-Scan ein Zeitlimit?
