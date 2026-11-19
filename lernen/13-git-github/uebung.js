// Einheit 13 – Git verstehen
// Prüfen: node --test lernen/13-git-github/

// 1. Ein vereinfachtes .gitignore: Wird dieser Pfad ignoriert?
//    Regeln für ein Muster:
//    - endet mit '/'      → Ordner: ignoriert den Ordner und alles darin, egal wo er liegt
//                           ('node_modules/' trifft 'node_modules/x.js' und 'lernen/node_modules/y.js')
//    - beginnt mit '*.'   → Endung: ignoriert alle Dateien mit dieser Endung ('*.zip' trifft 'dist/a.zip')
//    - sonst              → genauer Dateiname, egal in welchem Ordner ('.env' trifft '.env' und 'x/.env')
//                           ODER genauer Pfad, wenn das Muster ein '/' enthält ('node-red/flow_cred.json')
//    Leere Zeilen und Zeilen mit '#' am Anfang sind keine Muster.
//    isIgnored('node_modules/mysql2/index.js', ['node_modules/', '.env']) → true
function isIgnored(filePath, patterns) {
  // TODO
}

// 2. Liest die Ausgabe von `git status --porcelain` (eine Zeile pro Datei, 2 Zeichen Status, Leerzeichen, Pfad):
//    ' M app.js'      → geändert, noch nicht vorgemerkt
//    'M  src/a.js'    → geändert und vorgemerkt (staged)
//    'A  neu.js'      → neue Datei, vorgemerkt
//    '?? notizen.txt' → Git kennt die Datei noch nicht (untracked)
//    Ergebnis: { staged: [...], modified: [...], untracked: [...] }
//    Ein Pfad ist "staged", wenn das ERSTE Zeichen M oder A ist; "modified", wenn das ZWEITE Zeichen M ist
//    (eine Datei kann in beiden Listen sein: 'MM datei').
function parseStatus(porcelain) {
  // TODO: porcelain.split('\n'), leere Zeilen überspringen
}

// 3. Sicherheitscheck vor dem Commit: Welche Pfade, die gleich committet würden, sehen nach Geheimnissen aus?
//    Verdächtig: Dateiname '.env', Endung '_cred.json', '.pem' oder '.key', oder 'password' im Dateinamen
//    (Groß-/Kleinschreibung egal). Gibt die verdächtigen Pfade zurück.
function suspiciousFiles(paths) {
  // TODO
}

// 4. Merge-Konflikt lösen: text enthält einen Konflikt-Block. Behalte die Version von 'ours' (HEAD) oder 'theirs'.
//    Die Markierungszeilen (<<<<<<< …, =======, >>>>>>> …) müssen verschwinden.
function resolveConflict(text, keep) {
  // TODO: zeilenweise durchgehen und merken, in welchem Teil man gerade ist
}

// 5. Ist die Commit-Nachricht brauchbar?
//    Erste Zeile: mindestens 10 und höchstens 72 Zeichen, und nicht eins der Wörter
//    'fix', 'update', 'changes', 'änderungen', 'wip', 'asdf' (Groß-/Kleinschreibung egal, ohne Punkt am Ende).
function goodCommitMessage(message) {
  // TODO
}

module.exports = { isIgnored, parseStatus, suspiciousFiles, resolveConflict, goodCommitMessage };
