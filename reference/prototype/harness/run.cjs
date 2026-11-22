const E = require('./engines.cjs');
const ENG = { edexcel: E.PS, cambridge: E.CIE, python: E.PY };
function run(lang, code, inputs, maxSteps = 2_000_000) {
  const eng = ENG[lang];
  let prog;
  try { prog = eng.compile(code); } catch (e) { return { phase: 'compile', error: e.isP ? { line: e.pline, msg: e.message, hint: e.hint } : { msg: String(e && e.stack || e) }, out: [] }; }
  const r = new eng.Runner(prog, []);
  const queue = (inputs || []).slice();
  let steps = 0;
  try {
    while (!r.done) {
      r.step(); steps++;
      if (r.waiting) { if (!queue.length) return { phase: 'input-starved', out: r.out.map(o => o.text), steps }; r.inputs.push(queue.shift()); r.waiting = null; }
      if (steps > maxSteps) return { phase: 'step-limit', out: r.out.map(o => o.text), steps };
    }
  } catch (e) {
    return { phase: 'runtime', error: e.isP ? { line: e.pline, msg: e.message, hint: e.hint } : { msg: String(e && e.stack || e) }, out: r.out.filter(o => o.kind !== 'in').map(o => o.text), steps };
  }
  return { phase: 'ok', out: r.out.filter(o => o.kind !== 'in').map(o => o.text), steps };
}
module.exports = { run, E };
if (require.main === module) {
  const all = [];
  for (const [lang, list] of [['edexcel', E.EXAMPLES], ['cambridge', E.CIE_EXAMPLES], ['python', E.PY_EXAMPLES]]) {
    for (const ex of list) {
      const code = Array.isArray(ex.code) ? ex.code.join('\n') : ex.code;
      const inputs = ex.input ? String(ex.input).split('\n') : [];
      const res = run(lang, code, inputs);
      all.push({ lang, id: ex.id, name: ex.name, code, inputs, ...res });
    }
  }
  require('fs').writeFileSync('examples-results.json', JSON.stringify(all, null, 1));
  for (const a of all) console.log(a.lang.padEnd(9), a.id.padEnd(18), a.phase.padEnd(12), (a.error ? a.error.msg : a.out.slice(0, 3).join(' | ')).slice(0, 90));
}
