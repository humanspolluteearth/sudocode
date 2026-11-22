const { run, E } = require('./run.cjs'); const { cpy } = require('./pydiff.cjs');
for (const [lang, list] of [['edexcel', E.EXAMPLES], ['cambridge', E.CIE_EXAMPLES]]) for (const ex of list) {
  if (ex.id === 'bug' || ex.id === 'guess' || ex.id === 'files') continue;
  const code = Array.isArray(ex.code) ? ex.code.join('\n') : ex.code; const inputs = ex.input ? String(ex.input).split('\n') : [];
  const orig = run(lang, code, inputs);
  let conv; try { conv = E.CONVERT.convert(code, lang, 'python'); } catch (e) { console.log(lang, ex.id, 'CONVERT FAILED', e.msg || e.message); continue; }
  const py = cpy(conv.code, inputs);
  // CPython prompts have no newline; compare only non-prompt lines loosely
  const a = orig.out.join('\n').trim(), b = py.stdout.trim();
  console.log(lang.padEnd(9), ex.id.padEnd(10), 'todos=' + conv.todos, a === b ? 'SAME' : 'DIFF', a === b ? '' : JSON.stringify({ orig: a.slice(0, 120), cpython: b.slice(0, 120), exc: py.exc }));
}
