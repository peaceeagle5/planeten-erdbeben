# 02 – Module und npm

## Lernziele
- Du kannst Code auf mehrere Dateien verteilen (`require`, `module.exports`).
- Du kannst ein npm-Paket installieren und benutzen.
- Du kannst `package.json`, `package-lock.json` und `node_modules` erklären.

---

## 1. Warum Module?

Dein `app.js` im Ordner JavaScript-Learning hat 120 Zeilen in einer Datei. Das Projekt hat über 3000.
In einer Datei wäre das unlesbar. Deshalb: **eine Datei = ein Thema**.

| Datei | Thema |
|---|---|
| [src/planets.js](../../src/planets.js) | nur die Berechnung |
| [app.js](../../app.js) | nur der HTTP-Server |
| [setup-wizard/lib/db.js](../../setup-wizard/lib/db.js) | nur die Datenbank im Assistenten |

## 2. Exportieren und importieren (CommonJS)

**Datei `kalorien.js`** – stellt etwas zur Verfügung:
```js
function calculateCalories(caloriesPer100g, weightInGrams) {
  return (caloriesPer100g / 100) * weightInGrams;
}
const HELPER = 42; // nicht exportiert = privat, von außen unsichtbar

module.exports = { calculateCalories };
```
**Datei `app.js`** – benutzt es:
```js
const { calculateCalories } = require('./kalorien');   // ./ = Datei im selben Ordner
console.log(calculateCalories(52, 150));
```
- `module.exports` ist das Objekt, das eine Datei nach außen gibt.
- `require('./datei')` lädt eine **eigene** Datei (mit `./` oder `../`).
- `require('name')` **ohne** `./` lädt ein **npm-Paket** aus `node_modules` oder ein eingebautes Modul (`node:http`, `node:fs`).
- Das `{ calculateCalories }` links ist Destructuring (Einheit 01).

Im Projekt, [app.js](../../app.js):
```js
const http = require('node:http');                // eingebaut in Node.js
const { computeSky } = require('./src/planets');  // eigene Datei
```
und am Ende von [src/planets.js](../../src/planets.js): `module.exports = { computeSky, BODIES };`

> Es gibt noch eine zweite Schreibweise, **ES-Module**: `import x from './y.js'` und `export`.
> Dein `eslint.config.mjs` benutzt sie. Das Projekt benutzt `require`, weil Node-RED-Functions und
> der Setup-Assistent so am einfachsten funktionieren. Die Idee ist dieselbe.

## 3. npm und package.json

**npm** (Node Package Manager) lädt fremden Code („Pakete“) aus dem Internet.

```
npm install astronomy-engine        # Paket für das Programm
npm install -D eslint               # Paket nur für Entwicklung (-D = devDependencies)
npm install                         # alles aus package.json installieren (nach dem Herunterladen)
npm run lernen                      # ein Skript aus package.json ausführen
```

Die [package.json](../../package.json) des Projekts, erklärt:
```json
{
  "scripts":         { "api": "node app.js", "setup": "node setup-wizard/server.js", ... },
  "dependencies":    { "astronomy-engine": "^2.1.19" },
  "devDependencies": { "esbuild": "...", "eslint": "...", "mysql2": "..." }
}
```
| Feld | Bedeutung |
|---|---|
| `scripts` | Abkürzungen: `npm run api` führt `node app.js` aus |
| `dependencies` | Pakete, die das Programm **zum Laufen** braucht |
| `devDependencies` | Pakete nur zum **Entwickeln/Bauen** (Linter, Bundler). `mysql2` steht hier, weil esbuild es in die Setup-Programmdatei einbaut |
| `^2.1.19` | „Version 2.1.19 oder neuer, aber nicht 3.x“ (Hauptversion bleibt gleich) |

| Datei/Ordner | Was | Teilen/hochladen? |
|---|---|---|
| `package.json` | Wunschliste: welche Pakete, ungefähre Versionen | ja |
| `package-lock.json` | Genaue Versionen, die wirklich installiert wurden. So bekommt jede:r exakt dasselbe. | ja |
| `node_modules/` | Die heruntergeladenen Pakete selbst (oft hunderte MB) | **nein**, wird mit `npm install` neu erzeugt |

Darum steht `node_modules/` in der [.gitignore](../../.gitignore) und war nicht in der ZIP-Datei.

## Übung

[uebung.js](uebung.js): Funktionen exportieren und `astronomy-engine` benutzen.
Prüfen: `node --test "lernen/02-module-npm/*.test.js"`

## So erklärst du es
> „Jede Datei ist wie ein Werkzeugkasten. Mit `module.exports` legt man fest, welche Werkzeuge andere
> herausnehmen dürfen, und mit `require` holt man sich einen Kasten. npm ist der Baumarkt:
> Dort holt man Werkzeugkästen, die andere schon gebaut haben, wie die Astronomie-Berechnung.“

## Wenn es nicht klappt

| Fehlermeldung | Ursache und Lösung |
|---|---|
| `Cannot find module 'astronomy-engine'` | `node_modules` fehlt (z. B. frisch aus der ZIP). `npm install` im Projektordner ausführen. |
| `Cannot find module './kalorien'` | Pfad falsch: Datei liegt woanders, oder Tippfehler. Pfade mit `./` gelten relativ zur **Datei**, nicht zum Terminal. |
| `xyz is not a function` | Die Funktion wurde nicht exportiert, oder beim Destructuring falsch geschrieben. `console.log(require('./datei'))` zeigt, was exportiert wird. |
| `npm warn install-scripts` | Neuere npm-Versionen führen Installationsskripte nicht mehr automatisch aus. Für dieses Projekt unkritisch. |

## Selbsttest-Fragen
1. Warum lädt man `node_modules` nicht mit hoch? Wie bekommt jemand anderes die Pakete?
2. Was ist der Unterschied zwischen `require('./planets')` und `require('planets')`?
3. Wofür ist `package-lock.json` gut, wenn doch `package.json` schon die Pakete auflistet?
4. Warum ist `eslint` eine devDependency und `astronomy-engine` eine dependency?
