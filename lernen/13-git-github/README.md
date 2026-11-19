# 13 – Git und GitHub

## Lernziele
- Du kannst erklären, was Git ist und wie sich Git und GitHub unterscheiden.
- Du kannst Änderungen committen, Branches benutzen und mit einem Remote-Repository arbeiten (push, pull).
- Du kannst `.gitignore` schreiben und weißt, warum Passwörter nie ins Repository dürfen.
- Du kannst mit Pull Requests im Team arbeiten und einfache Merge-Konflikte lösen.

---

## 1. Wozu?

Ohne Versionsverwaltung: `projekt_final.zip`, `projekt_final2.zip`, `projekt_final_wirklich.zip`.
Niemand weiß, was sich geändert hat, und zwei Leute überschreiben sich gegenseitig.

**Git** speichert jeden Stand deines Projekts als **Commit**: wer hat wann was geändert und warum.
Du kannst jederzeit zurück, Varianten ausprobieren und Arbeit von mehreren Leuten zusammenführen.

| | Git | GitHub |
|---|---|---|
| Was | Programm auf deinem PC | Webseite / Dienst im Internet |
| Wofür | Versionen verwalten, auch ganz ohne Internet | Repositories teilen, im Team arbeiten (Pull Requests, Issues) |
| Vergleich | dein Fotoalbum | ein Online-Fotoalbum, das andere ansehen und ergänzen können |

Alternativen zu GitHub: GitLab, Codeberg, Bitbucket. Git ist überall dasselbe.

## 2. Die drei Bereiche

```
Arbeitsordner  ──git add──►  Staging-Bereich  ──git commit──►  Repository (Verlauf)  ──git push──►  GitHub
 (deine Dateien)             („das kommt in              (alle Commits, im           (Remote „origin“)
                              den nächsten Commit“)        versteckten Ordner .git)
                                                         ◄────────────── git pull ──────────────
```
Warum der Zwischenschritt „Staging“? Du hast vielleicht an drei Dingen gearbeitet, willst aber jede Sache
als eigenen, verständlichen Commit speichern. Mit `git add datei` suchst du aus, was zusammengehört.

## 3. Die wichtigsten Befehle

| Befehl | Was er tut |
|---|---|
| `git init` | neues Repository im aktuellen Ordner anlegen |
| `git status` | Was ist geändert, was ist vorgemerkt? **Der wichtigste Befehl: oft benutzen!** |
| `git add datei` / `git add .` | Änderungen vormerken (einzelne Datei / alles) |
| `git commit -m "Nachricht"` | Vorgemerktes als Commit speichern |
| `git log --oneline` | Verlauf ansehen |
| `git diff` | Was genau hat sich geändert (noch nicht vorgemerkt)? |
| `git switch -c neuer-branch` | neuen Branch anlegen und wechseln |
| `git switch main` | zurück zum Haupt-Branch |
| `git merge branch` | einen Branch in den aktuellen übernehmen |
| `git clone <url>` | ein Repository von GitHub herunterladen |
| `git push` / `git pull` | eigene Commits hochladen / fremde herunterladen |
| `git restore datei` | Änderungen an einer Datei verwerfen (Vorsicht: weg ist weg) |

**Gute Commit-Nachrichten** sagen in einem Satz, **was** sich ändert und **warum**, in der Befehlsform:
„Mondphase in Prozent statt Grad anzeigen“, nicht „Änderungen“, „fix“ oder „asdf“.
Faustregel: erste Zeile höchstens ~72 Zeichen.

## 4. Branches

Ein **Branch** ist eine eigene Entwicklungslinie. `main` ist der stabile Stand; für jede neue Idee legst du
einen Branch an. Klappt die Idee, wird sie in `main` übernommen (merge). Klappt sie nicht, löschst du den Branch,
und `main` ist unberührt.

```
main:     A───B───────────E    (E = Merge)
               \         /
neue-idee:      C───D───┘
```

## 5. .gitignore: was NICHT ins Repository gehört

Unsere [.gitignore](../../.gitignore):
```
node_modules/              ← wird mit npm install neu erzeugt (riesig)
.env                       ← PASSWÖRTER!
node-red/flow_cred.json    ← Node-RED-Zugangsdaten
dist/                      ← gebaute Programmdateien (100+ MB)
*.zip
```
Muster: `ordner/` = ganzer Ordner, `*.zip` = alle Dateien mit dieser Endung, `.env` = genau diese Datei.

**Passwörter im Repository sind eins der häufigsten Sicherheitsprobleme überhaupt.** Automatische Programme
durchsuchen GitHub rund um die Uhr nach Zugangsdaten. Ein Passwort, das einmal öffentlich auf GitHub war, gilt als
**verbrannt**, auch wenn du die Datei danach löschst: Im Verlauf ist es noch da.

### Notfall: Passwort aus Versehen committet
1. **Passwort sofort ändern** (Datenbank, Grafana …). Das ist der einzige Schritt, der wirklich schützt.
2. Datei aus Git entfernen, aber auf der Platte behalten: `git rm --cached .env`
3. `.env` in `.gitignore` eintragen, committen.
4. Wenn es schon gepusht war: Den Verlauf zu bereinigen ist aufwendig (`git filter-repo`) und ersetzt Schritt 1 nicht.

## 6. GitHub: Zusammenarbeiten

1. **Repository anlegen** auf github.com → „New repository“. Für Schulprojekte meist **privat**.
2. Lokales Repository verbinden und hochladen:
   ```
   git remote add origin https://github.com/<dein-name>/planeten-erdbeben.git
   git push -u origin main
   ```
   GitHub verlangt dafür kein Passwort mehr, sondern einen **Token** oder die Anmeldung über den Browser
   (VS Code und die GitHub-CLI `gh auth login` erledigen das für dich).
3. **Pull Request (PR):** Du arbeitest in einem Branch, pushst ihn, und auf GitHub schlägst du vor: „Bitte übernehmt meine
   Änderung in main.“ Andere können den Code ansehen, kommentieren und dann zusammenführen. So arbeiten fast alle
   Software-Teams.
4. **Issues:** Aufgaben und Fehler sammeln („Grafana zeigt keine Daten bei M7+“).

## 7. Merge-Konflikte

Wenn zwei Leute **dieselbe Zeile** unterschiedlich geändert haben, kann Git nicht entscheiden und markiert die Stelle:
```
<<<<<<< HEAD
const orb = options.orb ?? 8;
=======
const orb = options.orb ?? 6;
>>>>>>> neue-idee
```
Lösen: Die richtige Version stehen lassen (oder beide kombinieren), die Markierungen `<<<<<<<`, `=======`, `>>>>>>>`
löschen, dann `git add` und `git commit`. VS Code zeigt dafür Knöpfe an („Accept Current“ / „Accept Incoming“).

## Übung

1. **JavaScript:** [uebung.js](uebung.js): `.gitignore`-Muster, `git status` lesen, Konflikte lösen, Commit-Nachrichten prüfen.
   Prüfen: `node --test lernen/13-git-github/`
2. **Praxis: dein erstes Repository** (im entpackten Lernpaket, dauert 15 Minuten):
   ```
   git init
   git status                       # .env und node_modules dürfen NICHT auftauchen
   git add .
   git commit -m "Lernpaket Planeten & Erdbeben übernehmen"
   git switch -c uebung-01
   # … Einheit 01 bearbeiten, bis die Tests grün sind …
   git add lernen/01-js-werkzeuge/uebung.js
   git commit -m "Einheit 01: JavaScript-Werkzeuge gelöst"
   git switch main
   git merge uebung-01
   git log --oneline
   ```
   Bonus: Lege auf GitHub ein **privates** Repository an und pushe es (Abschnitt 6).
   Wenn `git init` meldet, dass dein Name fehlt: einmal
   `git config --global user.name "Dein Name"` und `git config --global user.email "deine@adresse"`.

## So erklärst du es
> „Git ist wie Speicherpunkte in einem Spiel: Bei jedem Commit speicherst du, und du kannst immer zu einem alten
> Speicherpunkt zurück. Ein Branch ist ein zweiter Spielstand, in dem du etwas ausprobierst, ohne den ersten
> zu gefährden. GitHub ist die Cloud, in der alle ihre Spielstände teilen.“

## Wenn es nicht klappt

| Meldung | Ursache / Lösung |
|---|---|
| `not a git repository` | Du bist nicht im Projektordner, oder `git init` fehlt |
| `Please tell me who you are` | `git config --global user.name …` und `user.email …` (siehe Übung) |
| `nothing to commit` | Nichts geändert, oder vergessen zu speichern |
| `.env` taucht in `git status` auf | `.gitignore` fehlt oder hat einen Tippfehler. **Nicht committen!** |
| `rejected … fetch first` beim push | Auf GitHub gibt es neuere Commits: erst `git pull`, dann `git push` |
| `Authentication failed` | GitHub nimmt keine Passwörter: Token benutzen oder über VS Code / `gh auth login` anmelden |
| `CONFLICT (content)` | Merge-Konflikt: Abschnitt 7 |
| „Ich habe alles kaputt gemacht“ | Ruhe bewahren: `git status`, dann `git log`. Was committet ist, ist fast nie verloren |

## Selbsttest-Fragen
1. Was ist der Unterschied zwischen Git und GitHub?
2. Wozu gibt es den Staging-Bereich?
3. Warum steht `node_modules/` in der `.gitignore`, obwohl das Projekt die Pakete braucht?
4. Du hast `.env` mit Passwort auf GitHub gepusht. Was tust du als Erstes, und warum reicht Löschen nicht?
5. Was ist ein Pull Request, und warum arbeiten Teams damit statt direkt auf `main`?
