// The terminal at the bottom of the cockpit: sends one command line to the server, streams the
// output and turns ANSI colour codes into coloured spans.

const ESC = String.fromCodePoint(27);
const SGR = new RegExp(String.raw`${ESC}\[([0-9;?]*)([A-Za-z])`, 'g');
const COMPLETE_SEQUENCE = new RegExp(String.raw`^${ESC}\[[0-9;?]*[A-Za-z]`);
const END_OF_OUTPUT = '\u0000';

export const PLAIN = Object.freeze({ fg: null, b: false, d: false, i: false });

const STYLE_CODES = {
  1: { b: true },
  2: { d: true },
  3: { i: true },
  22: { b: false, d: false },
  23: { i: false },
  39: { fg: null },
};

const isColour = (code) => (code >= 30 && code <= 37) || (code >= 90 && code <= 97);

function applyCode(style, code) {
  if (code === 0) return PLAIN;
  if (STYLE_CODES[code]) return { ...style, ...STYLE_CODES[code] };
  if (isColour(code)) return { ...style, fg: code };
  return style;
}

/** CSS classes for a style: a31 = red, a1 = bold ... (see ui.html). */
export function classFor(style) {
  const cls = [];
  if (style.fg) cls.push(`a${style.fg}`);
  if (style.b) cls.push('a1');
  if (style.d) cls.push('a2');
  if (style.i) cls.push('a3');
  return cls.join(' ');
}

/**
 * Splits program output into coloured segments.
 * An escape sequence cut off at the end of a chunk is returned as "carry" for the next chunk.
 */
export function parseAnsi(input, style) {
  let text = input.replaceAll('\r\n', '\n').replaceAll('\r', '');
  let carry = '';
  const cut = text.lastIndexOf(ESC);
  if (cut >= 0 && !COMPLETE_SEQUENCE.test(text.slice(cut))) {
    carry = text.slice(cut);
    text = text.slice(0, cut);
  }
  const segments = [];
  let current = style;
  let last = 0;
  for (const m of text.matchAll(SGR)) {
    if (m.index > last) segments.push({ text: text.slice(last, m.index), cls: classFor(current) });
    last = m.index + m[0].length;
    if (m[2] === 'm') current = (m[1] || '0').split(';').map(Number).reduce(applyCode, current);
  }
  if (last < text.length) segments.push({ text: text.slice(last), cls: classFor(current) });
  return { segments, style: current, carry };
}

/** Longest common start of all strings. */
export function commonPrefix(words) {
  let common = words[0] ?? '';
  for (const w of words) {
    while (!w.startsWith(common)) common = common.slice(0, -1);
  }
  return common;
}

/**
 * Creates the terminal.
 * opts: { els: { out, input, prompt, stop, clear, state, where, box }, token, api, store,
 *         beforeRun(), afterRun(updated) }
 */
export function createTerminal(opts) {
  const { els, api, store } = opts;
  const history = store.get('history', []);
  let historyPos = history.length;
  let running = false;
  let carry = '';
  let style = PLAIN;

  const atBottom = () => els.out.scrollHeight - els.out.scrollTop - els.out.clientHeight < 40;

  function append(node) {
    const stick = atBottom();
    els.out.appendChild(node);
    while (els.out.childNodes.length > 4000) els.out.firstChild.remove();
    if (stick) els.out.scrollTop = els.out.scrollHeight;
  }

  function write(chunk) {
    const parsed = parseAnsi(carry + chunk, style);
    carry = parsed.carry;
    style = parsed.style;
    const frag = document.createDocumentFragment();
    for (const seg of parsed.segments) {
      const span = document.createElement('span');
      if (seg.cls) span.className = seg.cls;
      span.textContent = seg.text;
      frag.appendChild(span);
    }
    append(frag);
  }

  function line(text, cls) {
    const div = document.createElement('div');
    div.className = cls;
    div.textContent = text;
    append(div);
  }

  function echo(cmd) {
    const div = document.createElement('div');
    div.className = 'cmd';
    const p = document.createElement('span');
    p.className = 'p';
    p.textContent = els.prompt.textContent;
    div.append(p, ` ${cmd}`);
    append(div);
  }

  function setPrompt(folder) {
    els.prompt.textContent = `${folder} $`;
    els.where.textContent = `Terminal-Ordner: ${folder}`;
  }

  function setRunning(value) {
    running = value;
    els.stop.disabled = !value;
    els.state.textContent = value ? '· läuft …' : '';
  }

  function remember(cmd) {
    if (history.at(-1) !== cmd) history.push(cmd);
    if (history.length > 200) history.splice(0, history.length - 200);
    store.set('history', history);
    historyPos = history.length;
  }

  /** Streams the response into the terminal; returns the JSON that follows the end marker. */
  async function streamOutput(response) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let tail = null;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      if (tail === null) {
        const end = text.indexOf(END_OF_OUTPUT);
        write(end >= 0 ? text.slice(0, end) : text);
        if (end >= 0) tail = text.slice(end + 1);
      } else {
        tail += text;
      }
    }
    write(decoder.decode());
    return tail ? JSON.parse(tail) : null;
  }

  async function execute(cmd) {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'X-Token': opts.token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ line: cmd }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || `Fehler ${response.status}`);
    }
    return streamOutput(response);
  }

  async function run(input) {
    const cmd = input.trim();
    if (running) {
      line('Es läuft noch ein Befehl. Strg+C bricht ihn ab.', 'info');
      return;
    }
    if (!cmd) {
      echo('');
      return;
    }
    remember(cmd);
    if (cmd === 'clear' || cmd === 'cls') {
      els.out.textContent = '';
      return;
    }
    await opts.beforeRun();
    echo(cmd);
    setRunning(true);
    style = PLAIN;
    let meta = null;
    try {
      meta = await execute(cmd);
    } catch (err) {
      line(`Verbindung zum Lern-Cockpit verloren: ${err.message}`, 'a31');
    }
    carry = '';
    setRunning(false);
    if (meta) {
      setPrompt(meta.prompt);
      if (meta.exit === 130) line('^C abgebrochen', 'muted');
      await opts.afterRun(meta.updated, line);
    }
    els.input.focus();
  }

  async function complete() {
    const value = els.input.value;
    const word = value.slice(value.lastIndexOf(' ') + 1);
    const before = value.slice(0, value.length - word.length);
    let matches = [];
    try {
      ({ matches } = await api('/api/complete', { word }));
    } catch {
      return;
    }
    const common = commonPrefix(matches);
    if (common.length > word.length) {
      els.input.value = before + common;
    } else if (matches.length > 1) {
      echo(value);
      line(matches.join('   '), 'muted');
    }
  }

  function historyStep(delta) {
    historyPos = Math.max(0, Math.min(history.length, historyPos + delta));
    els.input.value = history[historyPos] ?? '';
  }

  function interrupt() {
    if (running) {
      api('/api/stop', {}).catch(() => { /* server gone: nothing to stop */ });
    } else {
      echo(`${els.input.value}^C`);
      els.input.value = '';
    }
  }

  const KEYS = {
    Enter: () => {
      const value = els.input.value;
      els.input.value = '';
      void run(value);
    },
    ArrowUp: () => historyStep(-1),
    ArrowDown: () => historyStep(1),
    Tab: () => void complete(),
  };
  const CTRL_KEYS = {
    c: () => interrupt(),
    l: () => { els.out.textContent = ''; },
  };

  els.input.addEventListener('keydown', (e) => {
    const noSelection = els.input.selectionStart === els.input.selectionEnd;
    const handler = e.ctrlKey ? CTRL_KEYS[e.key] : KEYS[e.key];
    if (!handler || (e.ctrlKey && e.key === 'c' && !noSelection)) return;
    e.preventDefault();
    handler();
  });
  els.box.addEventListener('mouseup', () => {
    if (!getSelection().toString()) els.input.focus();
  });
  els.stop.addEventListener('click', () => {
    api('/api/stop', {}).catch(() => { /* server gone: nothing to stop */ });
  });
  els.clear.addEventListener('click', () => {
    els.out.textContent = '';
    els.input.focus();
  });

  return {
    info: (text) => line(text, 'info'),
    setPrompt,
    folder: () => els.prompt.textContent.replace(/ \$$/, ''),
    typeAndRun: (cmd) => {
      els.input.value = '';
      return run(cmd);
    },
  };
}
