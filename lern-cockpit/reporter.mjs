// Test reporter for the Lern-Cockpit.
// The cockpit adds it through NODE_OPTIONS to every command typed in its terminal, next to the
// normal "spec" output. It writes one JSON line per finished test, so the cockpit can show progress
// no matter whether the pupil typed "node --test ..." or "npm run lernen".
const ANSI = new RegExp(String.raw`${String.fromCodePoint(27)}\[[0-9;]*m`, 'g');

const isSet = (flag) => flag !== undefined && flag !== false;

function statusOf(event) {
  const d = event.data;
  if (isSet(d.skip) || isSet(d.todo)) return 'skip';
  return event.type === 'test:pass' ? 'pass' : 'fail';
}

function messageOf(d, status) {
  if (status === 'skip') return typeof d.skip === 'string' ? d.skip : '';
  if (status !== 'fail') return '';
  const err = d.details?.error;
  const cause = err?.cause ?? err;
  return String(cause?.message ?? cause ?? '').replaceAll(ANSI, '').slice(0, 3000);
}

const toLine = (entry) => `${JSON.stringify(entry)}\n`;

// Subtests report the file they are *defined* in (e.g. lernen/antworten.js for the quizzes), not the
// test file that ran them. They always finish right before their top-level test, so they are held
// back and get the file of the next top-level test.
export default async function* cockpitReporter(source) {
  let pending = [];
  for await (const event of source) {
    const d = event.data;
    if ((event.type !== 'test:pass' && event.type !== 'test:fail') || !d.file) continue;
    const status = statusOf(event);
    const entry = { file: d.file, name: d.name, nesting: d.nesting, status, message: messageOf(d, status) };
    if (d.nesting > 0) {
      pending.push(entry);
      continue;
    }
    for (const sub of pending) yield toLine({ ...sub, file: d.file });
    pending = [];
    yield toLine(entry);
  }
}
