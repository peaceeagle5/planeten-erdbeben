// Test reporter for the Lern-Cockpit.
// The cockpit adds it through NODE_OPTIONS to every command typed in its terminal, next to the
// normal "spec" output. It writes one JSON line per finished test, so the cockpit can show progress
// no matter whether the pupil typed "node --test ..." or "npm run lernen".
const ANSI = /\x1b\[[0-9;]*m/g;

// Subtests report the file they are *defined* in (e.g. lernen/antworten.js for the quizzes), not the
// test file that ran them. They always finish right before their top-level test, so they are held
// back and get the file of the next top-level test.
export default async function* cockpitReporter(source) {
  let pending = [];
  for await (const event of source) {
    if (event.type !== 'test:pass' && event.type !== 'test:fail') continue;
    const d = event.data;
    if (!d.file) continue;
    let status = event.type === 'test:pass' ? 'pass' : 'fail';
    if ((d.skip !== undefined && d.skip !== false) || (d.todo !== undefined && d.todo !== false)) status = 'skip';
    let message = '';
    if (status === 'fail') {
      const err = d.details?.error;
      const cause = err?.cause ?? err;
      message = String(cause?.message ?? cause ?? '').replace(ANSI, '').slice(0, 3000);
    } else if (status === 'skip' && typeof d.skip === 'string') {
      message = d.skip;
    }
    const entry = { file: d.file, name: d.name, nesting: d.nesting, status, message };
    if (d.nesting > 0) {
      pending.push(entry);
      continue;
    }
    for (const sub of pending) yield `${JSON.stringify({ ...sub, file: d.file })}\n`;
    pending = [];
    yield `${JSON.stringify(entry)}\n`;
  }
}
