// Einheit 10 – Fall-Quiz (ohne JavaScript: Antworten stehen in quiz.txt)
const test = require('node:test');
const { readAnswers, checkAnswers } = require('../antworten');

test('Fall-Quiz Fehlersuche', async (t) => {
  await checkAnswers(t, readAnswers(__dirname, 'quiz.txt'), [
    { key: 'fall-1', expect: 'b', hint: 'Lokal geht es, übers Netz nicht: Wo lauscht MariaDB?' },
    { key: 'fall-2', expect: 'a', hint: '„address already in use“ heißt …' },
    { key: 'fall-3', expect: 'c', hint: 'ENOTFOUND = ein Name kann nicht aufgelöst werden' },
    { key: 'fall-4', expect: 'b', hint: 'Beben kommen an (pending steigt), aber niemand rechnet' },
    { key: 'fall-5', expect: 'a', hint: '„localhost“ aus Sicht von wem?' },
    { key: 'fall-6', expect: 'b', hint: '„port is already allocated“: Wer belegt den Port schon?' },
    { key: 'fall-7', expect: 'b', hint: 'Was bedeutet -v bei docker compose down?' },
  ]);
});
