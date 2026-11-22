const { execFileSync, spawnSync } = require('child_process');
const { E } = require('./run.cjs');
function oldPy(code, inputs) {
  let prog;
  try { prog = E.PY.compile(code); } catch (e) { return { stdout: '', exc: e.pyType || 'CompileCrash', msg: e.pyMsg || String(e.message) }; }
  const r = new E.PY.Runner(prog, []);
  const q = inputs.slice(); let steps = 0, exc = null, msg = null;
  try {
    while (!r.done) { r.step(); if (r.waiting) { if (!q.length) { exc = 'EOFError'; msg = 'EOF when reading a line'; break; } r.inputs.push(q.shift()); r.waiting = null; } if (++steps > 3e6) { exc = 'StepLimit'; break; } }
  } catch (e) { exc = e.pyType || 'InternalCrash'; msg = e.pyMsg || String(e.message); }
  let s = '';
  r.out.forEach((o, i) => {
    if (o.kind === 'in') return;
    const last = i === r.out.length - 1;
    s += o.text + (o.echo !== undefined ? '' : (last && r.open ? '' : '\n'));
  });
  return { stdout: s, exc, msg };
}
function cpy(code, inputs) {
  const p = spawnSync('python3', ['-I', '-c', code], { input: inputs.map(x => x + '\n').join(''), encoding: 'utf8', timeout: 10000 });
  let exc = null, msg = null;
  if (p.status !== 0) { const lines = p.stderr.trim().split('\n'); const last = lines[lines.length - 1] || ''; const m = last.match(/^(\w+(?:Error|Exception|Interrupt)?)(?::\s*(.*))?$/); exc = m ? m[1] : 'Unknown'; msg = m ? (m[2] || '') : last; }
  return { stdout: p.stdout, exc, msg };
}
module.exports = { oldPy, cpy };
if (require.main === module) {
  let diff = 0;
  for (const ex of E.PY_EXAMPLES) {
    const code = Array.isArray(ex.code) ? ex.code.join('\n') : ex.code; const inputs = ex.input ? String(ex.input).split('\n') : [];
    const a = oldPy(code, inputs), b = cpy(code, inputs);
    const same = a.stdout === b.stdout && a.exc === b.exc;
    if (!same) diff++;
    console.log(ex.id.padEnd(10), same ? 'SAME' : 'DIFF', same ? '' : JSON.stringify({ old: a, cpython: b }).slice(0, 400));
  }
  console.log('diffs', diff);
}
