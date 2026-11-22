
var PS = (function () {
  var KW = {};
  ['SET','TO','SEND','DISPLAY','RECEIVE','FROM','KEYBOARD','IF','THEN','ELSE','END','WHILE','DO','REPEAT','UNTIL','TIMES','FOR','EACH','FOREACH','STEP','PROCEDURE','FUNCTION','BEGIN','RETURN','AND','OR','NOT','MOD','DIV','TRUE','FALSE','INTEGER','REAL','STRING','BOOLEAN','CHARACTER'].forEach(function (k) { KW[k] = 1; });
  var TYPES = { INTEGER: 1, REAL: 1, STRING: 1, BOOLEAN: 1, CHARACTER: 1 };
  var STMT_HINTS = {
    PRINT: 'Edexcel uses SEND <value> TO DISPLAY for output.',
    OUTPUT: 'Edexcel uses SEND <value> TO DISPLAY for output.',
    INPUT: 'Edexcel uses RECEIVE <name> FROM (STRING) KEYBOARD for input.',
    READ: 'For keyboard input use RECEIVE <name> FROM (STRING) KEYBOARD.',
    ENDIF: 'Write END IF as two words.',
    ENDWHILE: 'Write END WHILE as two words.',
    ENDFOR: 'Write END FOR as two words.',
    NEXT: 'Close a FOR loop with END FOR.',
    ELSEIF: 'Put ELSE on its own line, then a nested IF ... END IF inside it.',
    ELIF: 'Put ELSE on its own line, then a nested IF ... END IF inside it.',
    DECLARE: 'Variables are created with SET <name> TO <value>.',
    LET: 'Variables are created with SET <name> TO <value>.',
    LOOP: 'Use WHILE ... DO, REPEAT ... UNTIL, or FOR ... DO.'
  };
  var CLOSER = { IF: 'END IF', WHILE: 'END WHILE', FOR: 'END FOR', FOREACH: 'END FOREACH', REPEAT_TIMES: 'END REPEAT', REPEAT_UNTIL: 'UNTIL <condition>', PROCEDURE: 'END PROCEDURE', FUNCTION: 'END FUNCTION' };
  var LABEL = { IF: 'IF', WHILE: 'WHILE', FOR: 'FOR', FOREACH: 'FOR EACH', REPEAT_TIMES: 'REPEAT ... TIMES', REPEAT_UNTIL: 'REPEAT', PROCEDURE: 'PROCEDURE', FUNCTION: 'FUNCTION' };

  function err(msg, line, hint) { var e = new Error(msg); e.isP = true; e.pline = line; e.hint = hint || ''; return e; }
  function typeOf(v) {
    if (Array.isArray(v)) return 'ARRAY';
    if (typeof v === 'number') return Number.isInteger(v) ? 'INTEGER' : 'REAL';
    if (typeof v === 'boolean') return 'BOOLEAN';
    if (typeof v === 'string') return v.length === 1 ? 'CHARACTER' : 'STRING';
    return 'NONE';
  }
  function fmt(v) {
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(parseFloat(v.toFixed(10)));
    if (Array.isArray(v)) return '[' + v.map(repr).join(', ') + ']';
    if (v === null || v === undefined) return '';
    return String(v);
  }
  function repr(v) { return typeof v === 'string' ? '"' + v + '"' : fmt(v); }

  var BUILTINS = {
    LENGTH: function (a, L) { if (typeof a === 'string' || Array.isArray(a)) return a.length; throw err('LENGTH needs an array or a string, not ' + typeOf(a), L, 'For example LENGTH(scores) or LENGTH(name).'); },
    RANDOM: function (n, L) { if (typeof n !== 'number' || !Number.isInteger(n) || n < 0) throw err('RANDOM needs a whole number of 0 or more', L, 'RANDOM(6) gives a whole number from 0 to 6.'); return Math.floor(Math.random() * (n + 1)); },
    INT: function (v, L) { if (typeof v === 'number') return Math.trunc(v); if (typeof v === 'string' && /^\s*-?\d+(\.\d+)?\s*$/.test(v)) return Math.trunc(parseFloat(v)); throw err('Cannot turn ' + repr(v) + ' into an integer', L, 'INT works on numbers, or on text that holds a number such as "42".'); },
    STR: function (v) { return fmt(v); }
  };

  function tokenize(src, line) {
    var t = [], i = 0, n = src.length;
    while (i < n) {
      var c = src[i];
      if (c === ' ' || c === '\t') { i++; continue; }
      if (c === '#') break;
      if (/[0-9]/.test(c)) {
        var j = i; while (j < n && /[0-9.]/.test(src[j])) j++;
        var s = src.slice(i, j);
        if (s.split('.').length > 2 || s[s.length - 1] === '.') throw err('Badly formed number ' + s, line, 'A number can have at most one decimal point, with digits after it.');
        t.push({ k: 'num', v: parseFloat(s) }); i = j; continue;
      }
      if (c === '"' || c === "'") {
        var q = i + 1; while (q < n && src[q] !== c) q++;
        if (q >= n) throw err('Text is missing its closing quote', line, 'Every string needs a matching ' + c + ' at the end.');
        t.push({ k: 'str', v: src.slice(i + 1, q) }); i = q + 1; continue;
      }
      if (/[A-Za-z_]/.test(c)) {
        var w = i; while (w < n && /[A-Za-z0-9_]/.test(src[w])) w++;
        var word = src.slice(i, w);
        t.push({ k: KW[word] ? 'kw' : 'id', v: word }); i = w; continue;
      }
      var two = src.substr(i, 2);
      if (two === '<>' || two === '<=' || two === '>=' || two === '!=' || two === '==') { t.push({ k: 'op', v: two }); i += 2; continue; }
      if ('+-*/^&=<>()[],'.indexOf(c) >= 0) { t.push({ k: 'op', v: c }); i++; continue; }
      throw err('Unexpected character ' + c, line, c === ':' ? 'Edexcel pseudocode does not use colons. IF lines end with THEN, loops with DO.' : c === ';' ? 'Lines do not end with a semicolon.' : 'Remove it, or put it inside quotes if it is text.');
    }
    return t;
  }

  function TS(toks, line) { this.t = toks; this.i = 0; this.line = line; }
  TS.prototype.peek = function (o) { return this.t[this.i + (o || 0)]; };
  TS.prototype.next = function () { return this.t[this.i++]; };
  TS.prototype.is = function (v, o) { var x = this.peek(o); return !!x && (x.k === 'kw' || x.k === 'op') && x.v === v; };
  TS.prototype.accept = function (v) { if (this.is(v)) { this.i++; return true; } return false; };
  TS.prototype.done = function () { return this.i >= this.t.length; };
  function show(x) { return x.k === 'str' ? '"' + x.v + '"' : String(x.v); }
  TS.prototype.expect = function (v, hint) { if (!this.accept(v)) { var x = this.peek(); throw err('Expected ' + v + (x ? ' but found ' + show(x) : ' at the end of the line'), this.line, hint); } };
  TS.prototype.end = function () { if (!this.done()) { var x = this.peek(); throw err('Unexpected ' + show(x) + ' at the end of the line', this.line, x.v === '=' ? 'Use SET <name> TO <value> to assign.' : 'Check for an extra word or a missing operator.'); } };

  function pExpr(s) { return pOr(s); }
  function pOr(s) { var a = pAnd(s); while (s.accept('OR')) a = { t: 'bin', op: 'OR', a: a, b: pAnd(s) }; return a; }
  function pAnd(s) { var a = pNot(s); while (s.accept('AND')) a = { t: 'bin', op: 'AND', a: a, b: pNot(s) }; return a; }
  function pNot(s) { if (s.accept('NOT')) return { t: 'un', op: 'NOT', a: pNot(s) }; return pCmp(s); }
  function pCmp(s) {
    var a = pAdd(s);
    for (;;) {
      var x = s.peek();
      if (x && x.k === 'op' && ['=', '<>', '<', '<=', '>', '>=', '!=', '=='].indexOf(x.v) >= 0) {
        s.next();
        if (x.v === '!=') throw err('!= is not Edexcel pseudocode', s.line, 'Use <> for "not equal to".');
        if (x.v === '==') throw err('== is not Edexcel pseudocode', s.line, 'Use a single = to compare two values.');
        a = { t: 'bin', op: x.v, a: a, b: pAdd(s) };
      } else return a;
    }
  }
  function pAdd(s) { var a = pMul(s); for (;;) { var x = s.peek(); if (x && x.k === 'op' && (x.v === '+' || x.v === '-' || x.v === '&')) { s.next(); a = { t: 'bin', op: x.v, a: a, b: pMul(s) }; } else return a; } }
  function pMul(s) { var a = pPow(s); for (;;) { var x = s.peek(); if (x && ((x.k === 'op' && (x.v === '*' || x.v === '/')) || (x.k === 'kw' && (x.v === 'MOD' || x.v === 'DIV')))) { s.next(); a = { t: 'bin', op: x.v, a: a, b: pPow(s) }; } else return a; } }
  function pPow(s) { var a = pUnary(s); if (s.accept('^')) return { t: 'bin', op: '^', a: a, b: pPow(s) }; return a; }
  function pUnary(s) { if (s.accept('-')) return { t: 'un', op: '-', a: pUnary(s) }; return pPost(s); }
  function pPost(s) { var a = pPrim(s); while (s.accept('[')) { var ix = pExpr(s); s.expect(']', 'Close the index with ].'); a = { t: 'idx', obj: a, index: ix }; } return a; }
  function pArgs(s) { var args = []; s.expect('('); if (!s.accept(')')) { do { args.push(pExpr(s)); } while (s.accept(',')); s.expect(')', 'Every ( needs a matching ).'); } return args; }
  function pPrim(s) {
    var x = s.next();
    if (!x) throw err('This line ends before the expression is complete', s.line, 'Something is missing at the end of the line.');
    if (x.k === 'num' || x.k === 'str') return { t: x.k, v: x.v };
    if (x.k === 'kw' && (x.v === 'TRUE' || x.v === 'FALSE')) return { t: 'bool', v: x.v === 'TRUE' };
    if (x.k === 'op' && x.v === '(') { var e = pExpr(s); s.expect(')', 'Every ( needs a matching ).'); return e; }
    if (x.k === 'op' && x.v === '[') { var items = []; if (!s.accept(']')) { do { items.push(pExpr(s)); } while (s.accept(',')); s.expect(']', 'Close the array with ].'); } return { t: 'arr', items: items }; }
    if (x.k === 'id') { if (x.v === 'true' || x.v === 'false' || x.v === 'True' || x.v === 'False') throw err(x.v + ' must be written in capitals', s.line, 'Write ' + x.v.toUpperCase() + '.'); if (s.is('(')) return { t: 'call', name: x.v, args: pArgs(s) }; return { t: 'var', name: x.v }; }
    throw err('Unexpected ' + show(x) + ' in an expression', s.line, x.k === 'kw' ? x.v + ' is a keyword, so it cannot be used here. Is a value missing before it?' : 'Is a value or a bracket missing?');
  }

  function compile(code) {
    var lines = code.replace(/\r/g, '').split('\n');
    var root = { body: [] }, funcs = {};
    var stack = [{ kind: 'root', body: root.body, line: 0 }];
    function top() { return stack[stack.length - 1]; }
    function push(n) { top().body.push(n); }
    function open(kind, node, body, line) { stack.push({ kind: kind, node: node, body: body, line: line }); }
    for (var li = 0; li < lines.length; li++) {
      var ln = li + 1, toks = tokenize(lines[li], ln);
      if (!toks.length) continue;
      var s = new TS(toks, ln), f = toks[0], fr = top();
      if (fr.awaitBegin) {
        if (s.accept('BEGIN')) { if (!s.accept(fr.kind)) throw err('Expected BEGIN ' + fr.kind, ln, 'Write BEGIN ' + fr.kind + ' on the line after the header.'); s.end(); fr.awaitBegin = false; continue; }
        throw err('Missing BEGIN ' + fr.kind, ln, 'After the line "' + fr.kind + ' ' + fr.node.name + '(...)" the next line must be BEGIN ' + fr.kind + '.');
      }
      if (f.k === 'id') {
        var up = f.v.toUpperCase();
        if (KW[up] && !s.is('(', 1)) throw err('Keywords must be written in capitals', ln, 'Write ' + up + ' instead of ' + f.v + '.');
        if (STMT_HINTS[up]) throw err(f.v + ' is not an Edexcel statement', ln, STMT_HINTS[up]);
        if (s.is('(', 1)) { s.next(); var cargs = pArgs(s); s.end(); push({ t: 'call', name: f.v, args: cargs, line: ln }); continue; }
        if (s.is('=', 1) || s.is('[', 1)) throw err('Assignments need SET', ln, 'Write SET ' + f.v + ' TO <value>.');
        throw err('Unknown statement starting with ' + f.v, ln, 'Statements start with a keyword such as SET, SEND, IF, WHILE or FOR, or call a subprogram like ' + f.v + '().');
      }
      if (f.k !== 'kw') throw err('A line cannot start with ' + (f.k === 'str' ? 'text' : show(f)), ln, f.k === 'str' ? 'To show text, write SEND "..." TO DISPLAY.' : 'Statements start with a keyword such as SET or SEND.');
      s.next();
      switch (f.v) {
        case 'SET': {
          var tg = s.next();
          if (!tg || tg.k !== 'id') throw err('SET must be followed by a variable name', ln, tg && tg.k === 'kw' ? tg.v + ' is a keyword, so it cannot be used as a name.' : 'The pattern is SET <name> TO <value>.');
          var target = { t: 'var', name: tg.v };
          while (s.accept('[')) { var ie = pExpr(s); s.expect(']', 'Close the index with ].'); target = { t: 'idx', obj: target, index: ie }; }
          if (s.is('=')) throw err('Use TO instead of = in a SET statement', ln, 'Write SET ' + tg.v + ' TO <value>.');
          s.expect('TO', 'The pattern is SET <name> TO <value>.');
          var val = pExpr(s); s.end();
          push({ t: 'set', target: target, expr: val, line: ln }); break;
        }
        case 'SEND': {
          var items = []; do { items.push(pExpr(s)); } while (s.accept(','));
          s.expect('TO', 'The pattern is SEND <value> TO DISPLAY.'); s.expect('DISPLAY', 'Output always goes TO DISPLAY.'); s.end();
          push({ t: 'send', items: items, line: ln }); break;
        }
        case 'RECEIVE': {
          var rv = s.next();
          if (!rv || rv.k !== 'id') throw err('RECEIVE must be followed by a variable name', ln, 'The pattern is RECEIVE <name> FROM (<TYPE>) KEYBOARD.');
          s.expect('FROM', 'The pattern is RECEIVE <name> FROM (<TYPE>) KEYBOARD.');
          var ty = 'STRING';
          if (s.accept('(')) { var tt = s.next(); if (!tt || !TYPES[tt.v]) throw err('Unknown data type ' + (tt ? show(tt) : ''), ln, 'Use INTEGER, REAL, STRING, BOOLEAN or CHARACTER.'); ty = tt.v; s.expect(')'); }
          s.expect('KEYBOARD', 'Input comes FROM (<TYPE>) KEYBOARD.'); s.end();
          push({ t: 'recv', name: rv.v, type: ty, line: ln }); break;
        }
        case 'IF': {
          var c = pExpr(s); s.expect('THEN', 'An IF line ends with THEN.'); s.end();
          var n = { t: 'if', cond: c, then: [], els: null, line: ln }; push(n); open('IF', n, n.then, ln); break;
        }
        case 'ELSE': {
          if (fr.kind !== 'IF') throw err('ELSE without a matching IF', ln, fr.kind === 'root' ? 'ELSE must sit between IF ... THEN and END IF.' : 'Close the ' + LABEL[fr.kind] + ' block from line ' + fr.line + ' with ' + CLOSER[fr.kind] + ' first.');
          if (fr.node.els) throw err('This IF already has an ELSE', ln, 'An IF has at most one ELSE. For more choices, nest another IF inside the ELSE.');
          if (s.is('IF')) throw err('ELSE IF is not part of Edexcel pseudocode', ln, 'Put ELSE on its own line, then a nested IF ... END IF inside it.');
          s.end(); fr.node.els = []; fr.body = fr.node.els; break;
        }
        case 'WHILE': {
          var wc = pExpr(s); s.expect('DO', 'A WHILE line ends with DO.'); s.end();
          var wn = { t: 'while', cond: wc, body: [], line: ln }; push(wn); open('WHILE', wn, wn.body, ln); break;
        }
        case 'REPEAT': {
          if (s.done()) { var rn = { t: 'until', body: [], line: ln }; push(rn); open('REPEAT_UNTIL', rn, rn.body, ln); break; }
          var cnt = pExpr(s); s.expect('TIMES', 'Write REPEAT <number> TIMES, or REPEAT on its own line for REPEAT ... UNTIL.'); s.end();
          var tn = { t: 'times', count: cnt, body: [], line: ln }; push(tn); open('REPEAT_TIMES', tn, tn.body, ln); break;
        }
        case 'UNTIL': {
          if (fr.kind !== 'REPEAT_UNTIL') throw err('UNTIL without a matching REPEAT', ln, fr.kind === 'root' ? 'UNTIL closes a REPEAT loop.' : 'Close the ' + LABEL[fr.kind] + ' block from line ' + fr.line + ' with ' + CLOSER[fr.kind] + ' first.');
          fr.node.cond = pExpr(s); fr.node.untilLine = ln; s.end(); stack.pop(); break;
        }
        case 'FOR': {
          if (s.accept('EACH')) {
            var evn = s.next(); if (!evn || evn.k !== 'id') throw err('FOR EACH needs a variable name', ln, 'Pattern: FOR EACH <item> FROM <array> DO');
            s.expect('FROM', 'Pattern: FOR EACH <item> FROM <array> DO'); var srcE = pExpr(s); s.expect('DO', 'A FOR EACH line ends with DO.'); s.end();
            var fe = { t: 'foreach', name: evn.v, src: srcE, body: [], line: ln }; push(fe); open('FOREACH', fe, fe.body, ln); break;
          }
          var fv = s.next(); if (!fv || fv.k !== 'id') throw err('FOR needs a loop variable', ln, 'Pattern: FOR i FROM 1 TO 10 DO');
          if (s.is('=')) throw err('Use FROM instead of = in a FOR loop', ln, 'Write FOR ' + fv.v + ' FROM 1 TO 10 DO');
          s.expect('FROM', 'Pattern: FOR ' + fv.v + ' FROM <start> TO <end> DO'); var fa = pExpr(s);
          s.expect('TO', 'Pattern: FOR ' + fv.v + ' FROM <start> TO <end> DO'); var fb = pExpr(s);
          var stp = null; if (s.accept('STEP')) stp = pExpr(s);
          s.expect('DO', 'A FOR line ends with DO.'); s.end();
          var fn = { t: 'for', name: fv.v, from: fa, to: fb, step: stp, body: [], line: ln }; push(fn); open('FOR', fn, fn.body, ln); break;
        }
        case 'PROCEDURE': case 'FUNCTION': {
          if (fr.kind !== 'root') throw err(f.v + ' must be defined at the top level', ln, 'Close the ' + LABEL[fr.kind] + ' block from line ' + fr.line + ' first. Subprograms cannot sit inside other blocks.');
          var nm = s.next(); if (!nm || nm.k !== 'id') throw err(f.v + ' needs a name', ln, 'Pattern: ' + f.v + ' Name(param1, param2)');
          var params = [];
          if (s.accept('(')) { if (!s.accept(')')) { do { var p = s.next(); if (!p || p.k !== 'id') throw err('Parameters must be names', ln, 'Pattern: ' + f.v + ' ' + nm.v + '(a, b)'); params.push(p.v); } while (s.accept(',')); s.expect(')'); } }
          s.end();
          if (funcs[nm.v]) throw err(nm.v + ' is already defined on line ' + funcs[nm.v].line, ln, 'Each subprogram needs a unique name.');
          if (BUILTINS[nm.v]) throw err(nm.v + ' is the name of a built-in function', ln, 'Choose a different name.');
          var def = { name: nm.v, params: params, body: [], isFunc: f.v === 'FUNCTION', line: ln };
          funcs[nm.v] = def; stack.push({ kind: f.v, node: def, body: def.body, line: ln, awaitBegin: true }); break;
        }
        case 'RETURN': {
          var inSub = null; for (var qq = stack.length - 1; qq >= 0; qq--) if (stack[qq].kind === 'FUNCTION' || stack[qq].kind === 'PROCEDURE') { inSub = stack[qq].kind; break; }
          if (!inSub) throw err('RETURN outside a FUNCTION', ln, 'RETURN can only be used inside FUNCTION ... END FUNCTION.');
          var re = null; if (!s.done()) re = pExpr(s); s.end();
          if (inSub === 'FUNCTION' && !re) throw err('RETURN in a FUNCTION needs a value', ln, 'For example: RETURN total');
          if (inSub === 'PROCEDURE' && re) throw err('A PROCEDURE cannot RETURN a value', ln, 'Make it a FUNCTION if it needs to give back a result.');
          push({ t: 'return', expr: re, line: ln }); break;
        }
        case 'END': {
          var w = s.next(), kind = null;
          if (w && w.v === 'FOR' && s.accept('EACH')) kind = 'FOREACH';
          else if (w) kind = { IF: 'IF', WHILE: 'WHILE', FOR: 'FOR', FOREACH: 'FOREACH', REPEAT: 'REPEAT_TIMES', PROCEDURE: 'PROCEDURE', FUNCTION: 'FUNCTION' }[w.v] || null;
          if (!kind) throw err('END must say what it closes', ln, 'For example END IF, END WHILE, END FOR, END PROCEDURE.');
          s.end();
          if (kind === 'FOR' && fr.kind === 'FOREACH') kind = 'FOREACH';
          if (fr.kind === 'root') throw err(CLOSER[kind] + ' has no matching ' + LABEL[kind], ln, 'Remove this line, or check that the block it closes was opened.');
          if (fr.kind !== kind) throw err(CLOSER[kind] + ' found, but the open block is ' + LABEL[fr.kind] + ' from line ' + fr.line, ln, 'Close blocks in reverse order: add ' + CLOSER[fr.kind] + ' before this line.');
          fr.node.endLine = ln; stack.pop(); break;
        }
        default:
          throw err(f.v + ' cannot start a line', ln, 'Statements start with SET, SEND, RECEIVE, IF, WHILE, REPEAT, FOR or RETURN.');
      }
    }
    if (stack.length > 1) {
      var o = top();
      if (o.awaitBegin) throw err('Missing BEGIN ' + o.kind, o.line, 'Add BEGIN ' + o.kind + ' on the line after the header.');
      throw err(LABEL[o.kind] + ' on line ' + o.line + ' is never closed', o.line, 'Add ' + CLOSER[o.kind] + ' after the last line of the block.');
    }
    return { body: root.body, funcs: funcs };
  }

  function convert(raw, ty, L, name) {
    var t = raw.trim();
    if (ty === 'INTEGER') { if (!/^-?\d+$/.test(t)) throw err('Input "' + raw + '" is not a whole number', L, name + ' is received as INTEGER. Run again and type a whole number, or receive it as (STRING).'); return parseInt(t, 10); }
    if (ty === 'REAL') { if (!/^-?\d+(\.\d+)?$/.test(t)) throw err('Input "' + raw + '" is not a number', L, name + ' is received as REAL, for example 3.5'); return parseFloat(t); }
    if (ty === 'BOOLEAN') { if (t !== 'TRUE' && t !== 'FALSE') throw err('Input "' + raw + '" is not TRUE or FALSE', L, 'BOOLEAN input must be TRUE or FALSE.'); return t === 'TRUE'; }
    if (ty === 'CHARACTER') { if (raw.length !== 1) throw err('Input "' + raw + '" is not a single character', L, 'CHARACTER input must be exactly one character.'); return raw; }
    return raw;
  }
  function num(v, op, L) {
    if (typeof v !== 'number') throw err(op + ' needs numbers, but got ' + typeOf(v) + ' ' + repr(v), L, typeof v === 'string' ? 'If this came from RECEIVE, use (INTEGER) or (REAL). Otherwise convert it with INT().' : '');
    return v;
  }
  function bool(v, op, L) { if (typeof v !== 'boolean') throw err(op + ' needs TRUE or FALSE on both sides, got ' + repr(v), L, 'Write a full comparison on each side, e.g. x > 0 AND x < 10'); }
  function eq(a, b) { if (Array.isArray(a) || Array.isArray(b)) return JSON.stringify(a) === JSON.stringify(b); return a === b; }
  function binop(op, a, b, L) {
    switch (op) {
      case '&': return fmt(a) + fmt(b);
      case '+':
        if (typeof a === 'string' && typeof b === 'string') return a + b;
        if (typeof a === 'string' || typeof b === 'string') throw err('Cannot add text and a number with +', L, 'Use & to join them, e.g. "Total: " & total');
        return num(a, op, L) + num(b, op, L);
      case '-': return num(a, op, L) - num(b, op, L);
      case '*': return num(a, op, L) * num(b, op, L);
      case '/': num(a, op, L); if (num(b, op, L) === 0) throw err('Division by zero', L, 'The value on the right of / is 0. Guard it with an IF.'); return a / b;
      case 'DIV': case 'MOD':
        num(a, op, L); num(b, op, L);
        if (b === 0) throw err(op + ' by zero', L, 'The right-hand side of ' + op + ' must not be 0.');
        return op === 'DIV' ? Math.floor(a / b) : a - b * Math.floor(a / b);
      case '^': return Math.pow(num(a, op, L), num(b, op, L));
      case '=': return eq(a, b);
      case '<>': return !eq(a, b);
      default:
        if (!((typeof a === 'number' && typeof b === 'number') || (typeof a === 'string' && typeof b === 'string'))) throw err('Cannot compare ' + typeOf(a) + ' with ' + typeOf(b) + ' using ' + op, L, (typeof a === 'string' || typeof b === 'string') ? 'One side is text. If it came from RECEIVE, use (INTEGER) or INT().' : '');
        return op === '<' ? a < b : op === '<=' ? a <= b : op === '>' ? a > b : a >= b;
    }
  }
  function checkIdx(a, ix, L, oe) {
    var nm = oe && oe.t === 'var' ? oe.name : null;
    if (typeof ix !== 'number' || !Number.isInteger(ix)) throw err('An index must be a whole number, not ' + repr(ix), L, 'Use an INTEGER inside the square brackets.');
    if (ix < 0 || ix >= a.length) {
      var hint = !a.length ? (nm || 'It') + ' is empty, so there is nothing at any index.' : 'Indexes start at 0, so valid indexes are 0 to ' + (a.length - 1) + '.' + (nm ? ' In a FOR loop use TO LENGTH(' + nm + ') - 1.' : '');
      throw err('Index ' + ix + ' is out of range' + (nm ? ' for ' + nm : '') + ' (length ' + a.length + ')', L, hint);
    }
  }
  var has = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };

  function Runner(prog, inputs) {
    this.prog = prog; this.inputs = inputs; this.out = []; this.globals = {};
    this.frames = [{ name: 'main program', vars: this.globals, line: 0 }];
    this.line = 0; this.steps = 0; this.done = false;
    this.gen = this.block(prog.body);
  }
  Runner.prototype.step = function () {
    if (this.done) return;
    this.steps++;
    var r = this.gen.next();
    if (r.done) { this.done = true; this.line = 0; }
  };
  Runner.prototype.mark = function (L) { this.frames[this.frames.length - 1].line = L; this.line = L; };
  Runner.prototype.getVar = function (name, L) {
    var top = this.frames[this.frames.length - 1].vars;
    if (has(top, name)) return top[name];
    if (has(this.globals, name)) return this.globals[name];
    var known = Object.keys(top).concat(Object.keys(this.globals));
    var near = known.filter(function (k) { return k.toLowerCase() === name.toLowerCase(); })[0];
    var hint = near ? 'Did you mean ' + near + '? Names are case-sensitive.' : this.prog.funcs[name] ? name + ' is a subprogram. Call it with brackets: ' + name + '(...)' : 'Give it a value first with SET ' + name + ' TO ..., and check the spelling.';
    throw err('Variable ' + name + ' has not been given a value', L, hint);
  };
  Runner.prototype.setVar = function (name, v) {
    var top = this.frames[this.frames.length - 1].vars;
    if (top !== this.globals && !has(top, name) && has(this.globals, name)) this.globals[name] = v; else top[name] = v;
  };
  Runner.prototype.block = function* (body) {
    for (var i = 0; i < body.length; i++) { var r = yield* this.exec(body[i]); if (r) return r; }
    return null;
  };
  Runner.prototype.cond = function* (e, L, kw) {
    var v = yield* this.ev(e, L);
    if (typeof v !== 'boolean') throw err(kw + ' condition must be TRUE or FALSE, but it gave ' + repr(v), L, 'Compare with = <> < > etc., e.g. ' + kw + ' count < 10');
    return v;
  };
  Runner.prototype.assign = function* (tg, v, L) {
    if (tg.t === 'var') { this.setVar(tg.name, v); return; }
    var arr = yield* this.ev(tg.obj, L), ix = yield* this.ev(tg.index, L);
    if (typeof arr === 'string') throw err('Text cannot be changed one character at a time', L, 'Build a new string with & instead.');
    if (!Array.isArray(arr)) throw err('Only arrays can be changed with [ ]', L, (tg.obj.t === 'var' ? tg.obj.name : 'This value') + ' is ' + typeOf(arr) + '. Create the array first, e.g. SET list TO [0, 0, 0]');
    checkIdx(arr, ix, L, tg.obj);
    arr[ix] = v;
  };
  Runner.prototype.exec = function* (st) {
    var L = st.line, r, i, v, first;
    this.mark(L); yield L;
    switch (st.t) {
      case 'set': v = yield* this.ev(st.expr, L); yield* this.assign(st.target, v, L); return null;
      case 'send': {
        var parts = [];
        for (i = 0; i < st.items.length; i++) { v = yield* this.ev(st.items[i], L); parts.push(fmt(v)); }
        this.out.push({ text: parts.join(' '), kind: 'out' });
        if (this.out.length > 5000) throw err('More than 5,000 lines of output', L, 'This is usually a loop that never ends around a SEND.');
        return null;
      }
      case 'recv': {
        while (!this.inputs.length) { this.waiting = { label: st.name + ' (' + st.type + ')', prompt: '' }; yield L; }
        this.waiting = null;
        var raw = this.inputs.shift();
        this.out.push({ text: raw, kind: 'in', label: st.name });
        this.setVar(st.name, convert(raw, st.type, L, st.name));
        return null;
      }
      case 'if':
        if (yield* this.cond(st.cond, L, 'IF')) return yield* this.block(st.then);
        if (st.els) return yield* this.block(st.els);
        return null;
      case 'while':
        for (;;) {
          v = yield* this.cond(st.cond, L, 'WHILE');
          if (!v) return null;
          r = yield* this.block(st.body); if (r) return r;
          this.mark(L); yield L;
        }
      case 'until':
        for (;;) {
          r = yield* this.block(st.body); if (r) return r;
          this.mark(st.untilLine); yield st.untilLine;
          v = yield* this.cond(st.cond, st.untilLine, 'UNTIL');
          if (v) return null;
        }
      case 'times':
        v = yield* this.ev(st.count, L);
        if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) throw err('REPEAT ... TIMES needs a whole number, got ' + repr(v), L, 'For example REPEAT 5 TIMES.');
        for (i = 0; i < v; i++) { if (i > 0) { this.mark(L); yield L; } r = yield* this.block(st.body); if (r) return r; }
        return null;
      case 'for': {
        var a = yield* this.ev(st.from, L), b = yield* this.ev(st.to, L), d = 1;
        if (st.step) d = yield* this.ev(st.step, L);
        if (typeof a !== 'number' || typeof b !== 'number' || typeof d !== 'number') throw err('FOR loop values must be numbers', L, 'Check the values after FROM, TO and STEP.');
        if (d === 0) throw err('STEP cannot be 0', L, 'A STEP of 0 would never reach the end value.');
        first = true;
        for (var k = a; d > 0 ? k <= b : k >= b; k += d) {
          if (!first) { this.mark(L); yield L; } first = false;
          this.setVar(st.name, k);
          r = yield* this.block(st.body); if (r) return r;
        }
        return null;
      }
      case 'foreach': {
        var src = yield* this.ev(st.src, L);
        if (!Array.isArray(src) && typeof src !== 'string') throw err('FOR EACH needs an array or a string, got ' + typeOf(src), L, 'For example FOR EACH name FROM names DO');
        for (i = 0; i < src.length; i++) { if (i > 0) { this.mark(L); yield L; } this.setVar(st.name, src[i]); r = yield* this.block(st.body); if (r) return r; }
        return null;
      }
      case 'call': yield* this.call(st.name, st.args, L, false); return null;
      case 'return': v = null; if (st.expr) v = yield* this.ev(st.expr, L); return { ret: v };
    }
    return null;
  };
  Runner.prototype.call = function* (name, argEx, L, want) {
    var args = [], i, v;
    if (BUILTINS[name]) {
      if (argEx.length !== 1) throw err(name + ' takes exactly 1 argument', L, 'For example ' + name + '(x).');
      v = yield* this.ev(argEx[0], L);
      return BUILTINS[name](v, L);
    }
    var f = this.prog.funcs[name];
    if (!f) {
      var up = name.toUpperCase();
      if (BUILTINS[up]) throw err('Built-in functions are written in capitals', L, 'Write ' + up + '(...) instead of ' + name + '(...).');
      var near = Object.keys(this.prog.funcs).filter(function (k) { return k.toLowerCase() === name.toLowerCase(); })[0];
      throw err('No PROCEDURE or FUNCTION called ' + name, L, near ? 'Did you mean ' + near + '? Names are case-sensitive.' : 'Define it with PROCEDURE ' + name + '(...) or FUNCTION ' + name + '(...), and check the spelling.');
    }
    if (want && !f.isFunc) throw err(name + ' is a PROCEDURE, so it does not give back a value', L, 'Call it on its own line, or make it a FUNCTION that uses RETURN.');
    if (argEx.length !== f.params.length) throw err(name + ' expects ' + f.params.length + ' argument' + (f.params.length === 1 ? '' : 's') + ' but was given ' + argEx.length, L, 'It is defined on line ' + f.line + ' as ' + name + '(' + f.params.join(', ') + ').');
    for (i = 0; i < argEx.length; i++) { v = yield* this.ev(argEx[i], L); args.push(v); }
    if (this.frames.length > 150) throw err('Too many nested calls: the recursion never stops', L, 'Make sure the FUNCTION has a base case that returns without calling itself again.');
    var vars = {}; f.params.forEach(function (p, j) { vars[p] = args[j]; });
    this.frames.push({ name: name, vars: vars, line: f.line });
    var r = yield* this.block(f.body);
    this.frames.pop(); this.mark(L);
    if (f.isFunc) { if (!r) throw err('FUNCTION ' + name + ' ended without a RETURN', f.endLine || f.line, 'Every path through a FUNCTION must reach a RETURN.'); return r.ret; }
    return null;
  };
  Runner.prototype.ev = function* (e, L) {
    var a, b, i;
    switch (e.t) {
      case 'num': case 'str': case 'bool': return e.v;
      case 'arr': a = []; for (i = 0; i < e.items.length; i++) { b = yield* this.ev(e.items[i], L); a.push(b); } return a;
      case 'var': return this.getVar(e.name, L);
      case 'idx':
        a = yield* this.ev(e.obj, L); b = yield* this.ev(e.index, L);
        if (!Array.isArray(a) && typeof a !== 'string') throw err('Only arrays and strings can be indexed with [ ]', L, (e.obj.t === 'var' ? e.obj.name : 'This value') + ' is ' + typeOf(a) + '.');
        checkIdx(a, b, L, e.obj); return a[b];
      case 'call': return yield* this.call(e.name, e.args, L, true);
      case 'un':
        a = yield* this.ev(e.a, L);
        if (e.op === 'NOT') { bool(a, 'NOT', L); return !a; }
        return -num(a, '-', L);
      case 'bin':
        a = yield* this.ev(e.a, L);
        if (e.op === 'AND' || e.op === 'OR') {
          bool(a, e.op, L);
          if (e.op === 'AND' && !a) return false;
          if (e.op === 'OR' && a) return true;
          b = yield* this.ev(e.b, L); bool(b, e.op, L); return b;
        }
        b = yield* this.ev(e.b, L);
        return binop(e.op, a, b, L);
    }
    return null;
  };

  function entries(vars) { return Object.keys(vars).map(function (k) { return { name: k, type: typeOf(vars[k]), value: repr(vars[k]) }; }); }
  return { compile: compile, Runner: Runner, err: err, fmt: fmt, repr: repr, typeOf: typeOf, entries: entries, KW: KW, BUILTINS: BUILTINS };
})();

var CIE = (function () {
  var KW = {};
  ('DECLARE CONSTANT TYPE ENDTYPE ARRAY OF INTEGER REAL CHAR STRING BOOLEAN DATE INPUT OUTPUT IF THEN ELSE ENDIF CASE OTHERWISE ENDCASE ' +
   'FOR TO STEP NEXT WHILE DO ENDWHILE REPEAT UNTIL PROCEDURE ENDPROCEDURE FUNCTION ENDFUNCTION RETURNS RETURN CALL BYREF BYVAL ' +
   'AND OR NOT MOD DIV TRUE FALSE OPENFILE READFILE WRITEFILE CLOSEFILE READ WRITE APPEND').split(' ').forEach(function (k) { KW[k] = 1; });
  var BASE = { INTEGER: 1, REAL: 1, CHAR: 1, STRING: 1, BOOLEAN: 1, DATE: 1 };
  var CLOSER = { IF: 'ENDIF', CASE: 'ENDCASE', FOR: 'NEXT', WHILE: 'ENDWHILE', REPEAT: 'UNTIL <condition>', PROCEDURE: 'ENDPROCEDURE', FUNCTION: 'ENDFUNCTION', TYPE: 'ENDTYPE' };
  var CLOSES = { ENDIF: 'IF', ENDCASE: 'CASE', NEXT: 'FOR', ENDWHILE: 'WHILE', UNTIL: 'REPEAT', ENDPROCEDURE: 'PROCEDURE', ENDFUNCTION: 'FUNCTION', ENDTYPE: 'TYPE' };
  var OTHER_LANG = {
    PRINT: 'Cambridge pseudocode uses OUTPUT, e.g. OUTPUT "Hello"',
    SET: 'Assign with an arrow: Total ← 0 (you can type <- for the arrow).',
    SEND: 'Cambridge pseudocode uses OUTPUT, e.g. OUTPUT "Hello"',
    RECEIVE: 'Cambridge pseudocode uses INPUT, e.g. INPUT Name',
    END: 'Cambridge pseudocode closes blocks with one word: ENDIF, ENDWHILE, ENDCASE, ENDPROCEDURE, ENDFUNCTION. FOR loops end with NEXT.',
    ENDFOR: 'A FOR loop ends with NEXT, e.g. NEXT Count',
    ELSEIF: 'There is no ELSEIF. Put a new IF inside the ELSE, with its own ENDIF.',
    VAR: 'Declare variables with DECLARE Name : STRING'
  };
  function err(msg, line, hint) { var e = new Error(msg); e.isP = true; e.pline = line; e.hint = hint || ''; return e; }
  var has = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };
  function lev(a, b) {
    a = a.toLowerCase(); b = b.toLowerCase(); if (Math.abs(a.length - b.length) > 2) return 9;
    var d = [], i, j; for (i = 0; i <= a.length; i++) { d[i] = [i]; } for (j = 0; j <= b.length; j++) d[0][j] = j;
    for (i = 1; i <= a.length; i++) for (j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }
  function nearest(name, list) { var best = null, bd = 3; list.forEach(function (k) { var x = lev(name, k); if (x < bd) { bd = x; best = k; } }); return best; }

  /* ---------- values ---------- */
  function isArr(v) { return !!v && typeof v === 'object' && v.arr === true; }
  function isRec(v) { return !!v && typeof v === 'object' && v.rec === true; }
  function isDate(v) { return v instanceof Date; }
  function fmtNum(n) { if (Number.isInteger(n)) return String(n); return String(parseFloat(n.toPrecision(12))); }
  function fmtDate(d) { var p = function (x) { return (x < 10 ? '0' : '') + x; }; return p(d.getUTCDate()) + '/' + p(d.getUTCMonth() + 1) + '/' + d.getUTCFullYear(); }
  function fmt(v) {
    if (typeof v === 'number') return fmtNum(v);
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    if (isDate(v)) return fmtDate(v);
    if (isArr(v) || isRec(v)) return repr(v);
    return v === undefined ? '' : String(v);
  }
  function repr(v, ty) {
    if (v === undefined) return '(no value)';
    if (typeof v === 'string') return ty && ty.base === 'CHAR' ? "'" + v + "'" : '"' + v + '"';
    if (isArr(v)) {
      var el = v.el, show = function (x) { return x === undefined ? '—' : repr(x, el); };
      if (v.dims.length === 2) {
        var cols = v.dims[1][1] - v.dims[1][0] + 1, rows = [];
        for (var r = 0; r < v.data.length / cols && r < 12; r++) rows.push('[' + v.data.slice(r * cols, r * cols + cols).map(show).join(', ') + ']');
        return '[' + rows.join(', ') + (v.data.length / cols > 12 ? ', …' : '') + ']';
      }
      var items = v.data.slice(0, 40).map(show);
      return '[' + items.join(', ') + (v.data.length > 40 ? ', …' : '') + ']';
    }
    if (isRec(v)) return '{' + Object.keys(v.fields).map(function (k) { var c = v.fields[k]; return c.name + ': ' + repr(c.v, c.type); }).join(', ') + '}';
    return fmt(v);
  }
  function kindOf(v) {
    if (typeof v === 'number') return Number.isInteger(v) ? 'INTEGER' : 'REAL';
    if (typeof v === 'string') return 'STRING';
    if (typeof v === 'boolean') return 'BOOLEAN';
    if (isDate(v)) return 'DATE';
    if (isArr(v)) return 'ARRAY';
    if (isRec(v)) return v.tname;
    return 'nothing';
  }
  function tyName(t) { return !t ? '' : t.base ? t.base : t.arr ? 'ARRAY' : t.rec; }
  function copy(v) {
    if (isArr(v)) return { arr: true, dims: v.dims, el: v.el, data: v.data.map(copy) };
    if (isRec(v)) { var f = {}; Object.keys(v.fields).forEach(function (k) { var c = v.fields[k]; f[k] = { name: c.name, type: c.type, v: copy(c.v) }; }); return { rec: true, tname: v.tname, fields: f }; }
    return v;
  }

  /* ---------- tokens ---------- */
  function tokenize(s, L) {
    var t = [], i = 0, n = s.length, c, m, j;
    while (i < n) {
      c = s[i];
      if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
      if (c === '/' && s[i + 1] === '/') break;
      if (c === '"') {
        j = s.indexOf('"', i + 1);
        if (j < 0) throw err('This string has no closing "', L, 'A STRING starts and ends with a double quote, e.g. "Hello".');
        t.push({ k: 'str', v: s.slice(i + 1, j) }); i = j + 1; continue;
      }
      if (c === "'") {
        j = s.indexOf("'", i + 1);
        if (j < 0) throw err("This character has no closing '", L, "A CHAR is one character in single quotes, e.g. 'A'.");
        var ch = s.slice(i + 1, j);
        if (ch.length !== 1) throw err("'" + ch + "' is not a single character", L, 'Single quotes hold one CHAR only. Use double quotes for a STRING: "' + ch + '"');
        t.push({ k: 'chr', v: ch }); i = j + 1; continue;
      }
      if ('“”‘’'.indexOf(c) >= 0) throw err('Curly quotes are not allowed', L, 'Retype the quotes as straight " or \' characters.');
      if ((m = /^\d+(\.\d+)?/.exec(s.slice(i)))) { t.push({ k: 'num', v: parseFloat(m[0]), real: !!m[1] }); i += m[0].length; continue; }
      if ((m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(s.slice(i)))) { t.push({ k: KW[m[0]] ? 'kw' : 'id', v: m[0] }); i += m[0].length; continue; }
      if (c === '←') { t.push({ k: 'op', v: '<-' }); i++; continue; }
      var two = s.substr(i, 2);
      if (two === '<-' || two === '<=' || two === '>=' || two === '<>') { t.push({ k: 'op', v: two }); i += 2; continue; }
      if (two === '==') throw err('== is not Cambridge pseudocode', L, 'Compare with a single =, e.g. IF Total = 10 THEN');
      if (two === '!=') throw err('!= is not Cambridge pseudocode', L, 'Use <> for "not equal to".');
      if ('+-*/^&()[],:.=<>'.indexOf(c) >= 0) { t.push({ k: 'op', v: c }); i++; continue; }
      throw err('Unexpected character ' + c, L, c === '#' ? 'Comments in Cambridge pseudocode start with //' : 'Remove it, or check for a typing mistake.');
    }
    return t;
  }
  function TS(toks, line) { this.t = toks; this.i = 0; this.line = line; }
  TS.prototype.peek = function (o) { return this.t[this.i + (o || 0)]; };
  TS.prototype.next = function () { return this.t[this.i++]; };
  TS.prototype.is = function (v, o) { var x = this.peek(o); return !!x && (x.k === 'kw' || x.k === 'op') && x.v === v; };
  TS.prototype.accept = function (v) { if (this.is(v)) { this.i++; return true; } return false; };
  TS.prototype.done = function () { return this.i >= this.t.length; };
  function show(x) { return x.k === 'str' ? '"' + x.v + '"' : x.k === 'chr' ? "'" + x.v + "'" : x.v === '<-' ? '←' : String(x.v); }
  TS.prototype.expect = function (v, hint) { if (!this.accept(v)) { var x = this.peek(); throw err('Expected ' + (v === '<-' ? '←' : v) + (x ? ' but found ' + show(x) : ' at the end of the line'), this.line, hint); } };
  TS.prototype.id = function (what, hint) {
    var x = this.next();
    if (!x || x.k !== 'id') throw err(what + (x ? ', found ' + show(x) : ''), this.line, x && x.k === 'kw' ? x.v + ' is a keyword, so it cannot be used as a name.' : hint);
    return x.v;
  };
  TS.prototype.end = function () {
    if (!this.done()) { var x = this.peek(); throw err('Unexpected ' + show(x) + ' at the end of the line', this.line, x.v === '=' ? 'To assign, use ← (type <-). = only compares.' : 'Check for an extra word or a missing operator.'); }
  };

  /* ---------- expressions ---------- */
  function pExpr(s) { return pOr(s); }
  function pOr(s) { var a = pAnd(s); while (s.accept('OR')) a = { t: 'bin', op: 'OR', a: a, b: pAnd(s) }; return a; }
  function pAnd(s) { var a = pNot(s); while (s.accept('AND')) a = { t: 'bin', op: 'AND', a: a, b: pNot(s) }; return a; }
  function pNot(s) { if (s.accept('NOT')) return { t: 'un', op: 'NOT', a: pNot(s) }; return pCmp(s); }
  function pCmp(s) {
    var a = pAdd(s), x = s.peek();
    if (x && x.k === 'op' && ['=', '<>', '<', '<=', '>', '>='].indexOf(x.v) >= 0) { s.next(); a = { t: 'bin', op: x.v, a: a, b: pAdd(s) }; }
    if (s.is('<-')) throw err('← cannot be used inside an expression', s.line, 'To compare, use =. To assign, put the variable on its own: Total ← Total + 1');
    return a;
  }
  function pAdd(s) { var a = pMul(s); for (;;) { var x = s.peek(); if (x && x.k === 'op' && (x.v === '+' || x.v === '-' || x.v === '&')) { s.next(); a = { t: 'bin', op: x.v, a: a, b: pMul(s) }; } else return a; } }
  function pMul(s) { var a = pPow(s); for (;;) { var x = s.peek(); if (x && ((x.k === 'op' && (x.v === '*' || x.v === '/')) || (x.k === 'kw' && (x.v === 'MOD' || x.v === 'DIV') && !s.is('(', 1)))) { s.next(); a = { t: 'bin', op: x.v, a: a, b: pPow(s) }; } else return a; } }
  function pPow(s) { var a = pUnary(s); if (s.accept('^')) return { t: 'bin', op: '^', a: a, b: pPow(s) }; return a; }
  function pUnary(s) { if (s.accept('-')) return { t: 'un', op: '-', a: pUnary(s) }; if (s.accept('+')) return pUnary(s); return pPost(s); }
  function pPost(s) {
    var a = pPrim(s);
    for (;;) {
      if (s.accept('[')) { var ix = []; do { ix.push(pExpr(s)); } while (s.accept(',')); s.expect(']', 'Close the index with ]. For a 2D array write Grid[Row, Column].'); a = { t: 'idx', obj: a, index: ix }; }
      else if (s.accept('.')) { a = { t: 'field', obj: a, name: s.id('Expected a field name after .', 'For example Student.Name') }; }
      else return a;
    }
  }
  function pArgs(s) { var args = []; s.expect('('); if (!s.accept(')')) { do { args.push(pExpr(s)); } while (s.accept(',')); s.expect(')', 'Every ( needs a matching ).'); } return args; }
  function pPrim(s) {
    var x = s.next();
    if (!x) throw err('Expected a value at the end of the line', s.line, 'Something is missing after the last operator.');
    if (x.k === 'num') return { t: 'num', v: x.v };
    if (x.k === 'str') return { t: 'str', v: x.v };
    if (x.k === 'chr') return { t: 'str', v: x.v };
    if (x.k === 'kw' && (x.v === 'TRUE' || x.v === 'FALSE')) return { t: 'bool', v: x.v === 'TRUE' };
    if (x.k === 'kw' && (x.v === 'MOD' || x.v === 'DIV') && s.is('(')) return { t: 'call', name: x.v, args: pArgs(s) };
    if (x.k === 'op' && x.v === '(') { var e = pExpr(s); s.expect(')', 'Every ( needs a matching ).'); return e; }
    if (x.k === 'id') {
      var up = x.v.toUpperCase();
      if ((up === 'TRUE' || up === 'FALSE') && x.v !== up) throw err('TRUE and FALSE are written in capitals', s.line, 'Write ' + up + '.');
      if (s.is('(')) return { t: 'call', name: x.v, args: pArgs(s) };
      return { t: 'var', name: x.v };
    }
    throw err('Expected a value but found ' + show(x), s.line, x.k === 'kw' ? x.v + ' is a keyword and cannot be used here.' : 'Check the expression for a missing value or an extra symbol.');
  }
  function pType(s) {
    var x = s.next();
    if (!x) throw err('Expected a data type at the end of the line', s.line, 'For example INTEGER, REAL, CHAR, STRING, BOOLEAN, DATE or ARRAY[1:10] OF INTEGER.');
    if (x.k === 'kw' && x.v === 'ARRAY') {
      if (s.accept('OF')) { var anyEl = pType(s); if (anyEl.arr) throw err('An array cannot hold arrays', s.line, 'Use a 2D array instead.'); return { arr: true, dims: null, el: anyEl }; }
      s.expect('[', 'Write the bounds in square brackets: ARRAY[1:10] OF INTEGER');
      var dims = [];
      do { var lo = pExpr(s); s.expect(':', 'Bounds are written lower:upper, e.g. [1:10]'); dims.push([lo, pExpr(s)]); } while (s.accept(','));
      s.expect(']', 'Close the bounds with ]'); s.expect('OF', 'Write ARRAY[1:10] OF INTEGER');
      if (dims.length > 2) throw err('Arrays can have at most 2 dimensions', s.line, 'For example ARRAY[1:3, 1:4] OF INTEGER');
      var el = pType(s); if (el.arr) throw err('An array cannot hold arrays', s.line, 'Use a 2D array instead: ARRAY[1:3, 1:4] OF INTEGER');
      return { arr: true, dims: dims, el: el };
    }
    if (x.k === 'kw' && BASE[x.v]) return { base: x.v };
    if (x.k === 'id') {
      var up = x.v.toUpperCase();
      if (BASE[up] || up === 'ARRAY') throw err('Data types are written in capitals', s.line, 'Write ' + up + ' instead of ' + x.v + '.');
      if (up === 'INT' || up === 'FLOAT' || up === 'STR' || up === 'BOOL') throw err(x.v + ' is not a Cambridge data type', s.line, 'Use INTEGER, REAL, CHAR, STRING, BOOLEAN or DATE.');
      return { rec: x.v, line: s.line };
    }
    throw err('Expected a data type but found ' + show(x), s.line, 'Use INTEGER, REAL, CHAR, STRING, BOOLEAN, DATE, ARRAY[...] OF ... or a TYPE you defined.');
  }
  function lval(s, what) {
    var e = pPost(s), b = e;
    while (b.t === 'idx' || b.t === 'field') b = b.obj;
    if (b.t !== 'var' || e.t === 'call') throw err(what + ' needs a variable', s.line, 'For example ' + (what === 'INPUT' ? 'INPUT Name. To show a prompt, OUTPUT it on the line before.' : 'Total, Scores[3] or Student.Name'));
    return e;
  }

  /* ---------- compiler ---------- */
  function compile(code) {
    var lines = code.replace(/\r/g, '').split('\n');
    var prog = { body: [], procs: {}, types: {} }, typeRefs = [];
    var stack = [{ kind: 'root', body: prog.body, line: 0 }];
    function top() { return stack[stack.length - 1]; }
    function add(n) { top().body.push(n); }
    function inside(kind) { for (var q = stack.length - 1; q >= 0; q--) if (stack[q].kind === kind) return stack[q]; return null; }
    function close(kind, L) {
      var T = top();
      if (T.kind === 'root') throw err(CLOSER[kind].split(' ')[0] + ' has no matching ' + kind, L, 'Remove this line, or check that the ' + kind + ' it closes was opened.');
      if (T.kind !== kind) throw err(CLOSER[kind].split(' ')[0] + ' found, but the open block is ' + T.kind + ' from line ' + T.line, L, 'Close blocks in reverse order: add ' + CLOSER[T.kind] + ' before this line.');
      T.node.endLine = L; stack.pop(); return T;
    }
    function walkTypes(t) { if (!t) return; if (t.rec) typeRefs.push(t); if (t.arr) walkTypes(t.el); }
    function simple(s, L) {
      var f = s.peek();
      if (f.k === 'kw') {
        switch (f.v) {
          case 'DECLARE': {
            s.next(); var names = [];
            do { names.push(s.id('DECLARE needs a variable name', 'Pattern: DECLARE Total : INTEGER')); } while (s.accept(','));
            if (s.is('<-') || s.is('=')) throw err('DECLARE only names the variable and its type', L, 'Write DECLARE ' + names[0] + ' : INTEGER, then assign on the next line: ' + names[0] + ' ← 0');
            s.expect(':', 'Pattern: DECLARE ' + names[0] + ' : INTEGER'); var ty = pType(s); s.end(); walkTypes(ty);
            return { t: 'declare', names: names, type: ty, line: L };
          }
          case 'CONSTANT': {
            s.next(); var cn = s.id('CONSTANT needs a name', 'Pattern: CONSTANT Pi ← 3.142');
            if (!s.accept('=') && !s.accept('<-')) throw err('Expected = or ← after the constant name', L, 'Pattern: CONSTANT ' + cn + ' ← 10');
            var ce = pExpr(s); s.end(); return { t: 'const', name: cn, expr: ce, line: L };
          }
          case 'INPUT': { s.next(); if (s.done()) throw err('INPUT needs a variable', L, 'For example INPUT Name'); var it = lval(s, 'INPUT'); s.end(); return { t: 'input', target: it, line: L }; }
          case 'OUTPUT': {
            s.next(); if (s.done()) throw err('OUTPUT needs something to show', L, 'For example OUTPUT "Total: ", Total');
            var items = []; do { items.push(pExpr(s)); } while (s.accept(',')); s.end(); return { t: 'output', items: items, line: L };
          }
          case 'CALL': {
            s.next(); var pn = s.id('CALL needs a procedure name', 'For example CALL ShowMenu()');
            var args = s.is('(') ? pArgs(s) : []; s.end(); return { t: 'call', name: pn, args: args, line: L };
          }
          case 'RETURN': {
            s.next(); if (!inside('FUNCTION')) throw err('RETURN can only be used inside a FUNCTION', L, inside('PROCEDURE') ? 'A PROCEDURE does not return a value. Make it a FUNCTION ... RETURNS <type> if it needs to.' : 'Put it between FUNCTION and ENDFUNCTION.');
            if (s.done()) throw err('RETURN needs a value', L, 'For example RETURN Total');
            var re = pExpr(s); s.end(); return { t: 'return', expr: re, line: L };
          }
          case 'OPENFILE': {
            s.next(); var fe = pExpr(s); s.expect('FOR', 'Pattern: OPENFILE "data.txt" FOR READ');
            var md = s.next(); if (!md || ['READ', 'WRITE', 'APPEND'].indexOf(md.v) < 0) throw err('Expected READ, WRITE or APPEND', L, 'Pattern: OPENFILE "data.txt" FOR WRITE');
            s.end(); return { t: 'open', file: fe, mode: md.v, line: L };
          }
          case 'READFILE': { s.next(); var rf = pExpr(s); s.expect(',', 'Pattern: READFILE "data.txt", LineOfText'); var rt = lval(s, 'READFILE'); s.end(); return { t: 'readf', file: rf, target: rt, line: L }; }
          case 'WRITEFILE': { s.next(); var wf = pExpr(s); s.expect(',', 'Pattern: WRITEFILE "data.txt", LineOfText'); var wd = pExpr(s); s.end(); return { t: 'writef', file: wf, expr: wd, line: L }; }
          case 'CLOSEFILE': { s.next(); var cf = pExpr(s); s.end(); return { t: 'closef', file: cf, line: L }; }
        }
        return null;
      }
      if (f.k === 'id') {
        var up = f.v.toUpperCase();
        if (KW[up] && f.v !== up) throw err('Keywords are written in capitals', L, 'Write ' + up + ' instead of ' + f.v + '.');
        if (OTHER_LANG[up] && !s.is('<-', 1) && !s.is('[', 1) && !s.is('.', 1)) throw err(f.v + ' is not Cambridge pseudocode', L, OTHER_LANG[up]);
        var tg = pPost(s);
        if (s.accept('<-')) {
          var b = tg; while (b.t === 'idx' || b.t === 'field') b = b.obj;
          if (b.t !== 'var' || tg.t === 'call') throw err('Only a variable can be assigned to', L, 'The left of ← must be a variable such as Total, Scores[3] or Student.Name');
          var v = pExpr(s); s.end(); return { t: 'assign', target: tg, expr: v, line: L };
        }
        if (s.is('=')) throw err('Use ← to assign, not =', L, 'Write ' + f.v + ' ← <value>. You can type <- and it works the same.');
        if (tg.t === 'call') throw err('To run a procedure, start the line with CALL', L, 'Write CALL ' + tg.name + '(...). A FUNCTION result must be used, e.g. X ← ' + tg.name + '(...)');
        if (s.done()) throw err(f.v + ' on its own does nothing', L, 'Assign it with ' + f.v + ' ← <value>, or show it with OUTPUT ' + f.v);
        throw err('Expected ← after ' + f.v, L, 'Assignments look like ' + f.v + ' ← <value>.');
      }
      throw err('A line cannot start with ' + show(f), L, f.k === 'str' ? 'To show text, write OUTPUT "...".' : 'Statements start with a keyword such as DECLARE, OUTPUT, IF or FOR, or with a variable to assign.');
    }

    function line(toks, L) {
      var s = new TS(toks, L), f = s.peek(), T = top(), rest = function () { if (!s.done()) line(s.t.slice(s.i), L); };
      if (T.kind === 'TYPE') {
        if (s.accept('ENDTYPE')) { s.end(); close('TYPE', L); return; }
        if (!s.is('DECLARE')) throw err('Only DECLARE lines can go inside TYPE ... ENDTYPE', L, 'For example DECLARE Name : STRING. Close the type with ENDTYPE.');
        T.node.fields.push(simple(s, L)); return;
      }
      if (T.kind === 'IF' && T.node.needThen) {
        if (!s.accept('THEN')) throw err('Expected THEN after the IF condition', L, 'Put THEN at the end of the IF line, or on the line below it.');
        T.node.needThen = false; rest(); return;
      }
      if (T.kind === 'CASE' && !s.is('ENDCASE')) {
        if (s.accept('OTHERWISE')) {
          if (T.node.other) throw err('This CASE already has an OTHERWISE', L, 'A CASE can have one OTHERWISE, as its last branch.');
          s.accept(':'); var oc = { other: true, body: [], line: L }; T.node.other = oc; T.node.clauses.push(oc); T.body = oc.body; rest(); return;
        }
        var depth = 0, colon = -1;
        for (var q = 0; q < toks.length; q++) { var tq = toks[q]; if (tq.k === 'op') { if (tq.v === '(' || tq.v === '[') depth++; else if (tq.v === ')' || tq.v === ']') depth--; else if (tq.v === ':' && !depth) { colon = q; break; } } }
        if (colon > 0 && !s.is('DECLARE')) {
          if (T.node.other) throw err('OTHERWISE must be the last branch of a CASE', L, 'Move this branch above OTHERWISE.');
          var vals = [];
          do { var lo = pExpr(s); if (s.accept('TO')) vals.push({ lo: lo, hi: pExpr(s) }); else vals.push({ v: lo }); } while (s.accept(','));
          s.expect(':', 'A branch looks like 1 : OUTPUT "One"');
          var cl = { vals: vals, body: [], line: L }; T.node.clauses.push(cl); T.body = cl.body; rest(); return;
        }
        if (!T.body) throw err('Expected a CASE branch', L, 'Each branch is a value, a colon and a statement, e.g. 1 : OUTPUT "One"');
      }
      if (f.k === 'kw') {
        switch (f.v) {
          case 'IF': {
            s.next(); var c = pExpr(s), then = s.accept('THEN');
            if (then && !s.done()) throw err('Put the statements after THEN on the next line', L, 'IF ... THEN ends the line. The statements go below it, then ENDIF.');
            s.end(); var n = { t: 'if', cond: c, then: [], els: null, line: L, needThen: !then }; add(n);
            stack.push({ kind: 'IF', node: n, body: n.then, line: L }); return;
          }
          case 'THEN': throw err('THEN without an IF', L, 'THEN belongs straight after an IF condition.');
          case 'ELSE': {
            s.next();
            if (T.kind !== 'IF') throw err('ELSE without a matching IF', L, T.kind === 'root' ? 'ELSE must sit between IF ... THEN and ENDIF.' : 'Close the ' + T.kind + ' from line ' + T.line + ' with ' + CLOSER[T.kind] + ' first.');
            if (T.node.els) throw err('This IF already has an ELSE', L, 'For more choices, put another IF inside the ELSE, or use CASE OF.');
            if (s.is('IF')) throw err('ELSE IF is not Cambridge pseudocode', L, 'Put ELSE on its own line, then a new IF ... ENDIF inside it. Or use CASE OF for many choices.');
            s.end(); T.node.els = []; T.body = T.node.els; return;
          }
          case 'CASE': {
            s.next(); s.expect('OF', 'Pattern: CASE OF Choice'); var ce = pExpr(s); s.end();
            var cn = { t: 'case', expr: ce, clauses: [], other: null, line: L }; add(cn);
            stack.push({ kind: 'CASE', node: cn, body: null, line: L }); return;
          }
          case 'OTHERWISE': throw err('OTHERWISE without a CASE', L, 'OTHERWISE is the last branch of CASE OF ... ENDCASE.');
          case 'FOR': {
            s.next(); var fv = s.id('FOR needs a loop variable', 'Pattern: FOR Count ← 1 TO 10');
            if (s.is('=')) throw err('Use ← in a FOR loop, not =', L, 'Write FOR ' + fv + ' ← 1 TO 10');
            if (s.is('IN') || (s.peek() && s.peek().v === 'in')) throw err('FOR ... IN is not Cambridge pseudocode', L, 'Count through the indexes: FOR ' + fv + ' ← 1 TO 10');
            s.expect('<-', 'Pattern: FOR ' + fv + ' ← 1 TO 10'); var fa = pExpr(s);
            s.expect('TO', 'Pattern: FOR ' + fv + ' ← 1 TO 10'); var fb = pExpr(s), stp = null;
            if (s.accept('STEP')) stp = pExpr(s);
            if (s.is('DO')) throw err('A Cambridge FOR line has no DO', L, 'Remove DO. The loop ends with NEXT ' + fv);
            s.end(); var fn = { t: 'for', name: fv, from: fa, to: fb, step: stp, body: [], line: L }; add(fn);
            stack.push({ kind: 'FOR', node: fn, body: fn.body, line: L }); return;
          }
          case 'WHILE': {
            s.next(); var wc = pExpr(s); s.accept('DO'); s.end();
            var wn = { t: 'while', cond: wc, body: [], line: L }; add(wn); stack.push({ kind: 'WHILE', node: wn, body: wn.body, line: L }); return;
          }
          case 'REPEAT': {
            s.next(); if (!s.done()) throw err('REPEAT goes on a line by itself', L, 'The condition goes at the end: REPEAT ... UNTIL <condition>');
            var rn = { t: 'repeat', body: [], line: L }; add(rn); stack.push({ kind: 'REPEAT', node: rn, body: rn.body, line: L }); return;
          }
          case 'UNTIL': {
            s.next(); if (T.kind !== 'REPEAT') close('REPEAT', L);
            T.node.cond = pExpr(s); T.node.untilLine = L; s.end(); stack.pop(); return;
          }
          case 'NEXT': {
            s.next(); var nv = s.done() ? null : s.id('NEXT is followed by the loop variable', 'For example NEXT Count'); s.end();
            var ft = close('FOR', L);
            if (nv && nv.toLowerCase() !== ft.node.name.toLowerCase()) throw err('NEXT ' + nv + ' does not match FOR ' + ft.node.name + ' on line ' + ft.line, L, 'Write NEXT ' + ft.node.name + '. Inner loops must close before outer ones.');
            return;
          }
          case 'ENDIF': case 'ENDCASE': case 'ENDWHILE': case 'ENDPROCEDURE': case 'ENDFUNCTION': case 'ENDTYPE': {
            s.next(); s.end(); var cT = close(CLOSES[f.v], L);
            if (cT.kind === 'CASE' && !cT.node.clauses.length) throw err('This CASE has no branches', cT.line, 'Add branches such as 1 : OUTPUT "One" between CASE OF and ENDCASE.');
            if (cT.kind === 'IF' && cT.node.needThen) throw err('Expected THEN after the IF condition', cT.line, 'Put THEN at the end of the IF line, or on the line below it.');
            return;
          }
          case 'PROCEDURE': case 'FUNCTION': {
            s.next(); var isF = f.v === 'FUNCTION';
            if (T.kind !== 'root') throw err(f.v + ' must be defined at the top level', L, 'Close the ' + T.kind + ' from line ' + T.line + ' first. Subroutines cannot sit inside other blocks.');
            var pn = s.id(f.v + ' needs a name', 'Pattern: ' + f.v + ' Name(Param : INTEGER)'), params = [], mode = 'BYVAL';
            if (s.accept('(')) {
              if (!s.accept(')')) {
                do {
                  var explicit = true; if (s.accept('BYREF')) mode = 'BYREF'; else if (s.accept('BYVAL')) mode = 'BYVAL'; else explicit = false;
                  var prn = s.id('Expected a parameter name', 'Pattern: ' + f.v + ' ' + pn + '(Num : INTEGER)');
                  s.expect(':', 'Each parameter needs a type, e.g. ' + prn + ' : INTEGER');
                  var pt = pType(s); walkTypes(pt); params.push({ name: prn, type: pt, byref: mode === 'BYREF', inherited: !explicit && mode === 'BYREF' });
                } while (s.accept(','));
                s.expect(')', 'Close the parameter list with ).');
              }
            }
            var rtype = null;
            if (isF) { s.expect('RETURNS', 'A FUNCTION states its result type: FUNCTION ' + pn + '(...) RETURNS INTEGER'); rtype = pType(s); walkTypes(rtype); }
            else if (s.is('RETURNS')) throw err('A PROCEDURE does not return a value', L, 'Change PROCEDURE to FUNCTION, or remove RETURNS.');
            s.end();
            var key = pn.toLowerCase();
            if (prog.procs[key]) throw err(pn + ' is already defined on line ' + prog.procs[key].line, L, 'Each procedure and function needs a unique name.');
            if (BUILTINS[pn.toUpperCase()]) throw err(pn + ' is the name of a built-in function', L, 'Choose a different name.');
            var def = { name: pn, params: params, isFunc: isF, rtype: rtype, body: [], line: L };
            prog.procs[key] = def; stack.push({ kind: f.v, node: def, body: def.body, line: L }); return;
          }
          case 'TYPE': {
            s.next(); var tn = s.id('TYPE needs a name', 'Pattern: TYPE StudentRecord');
            if (s.is('=')) throw err('Enumerated and pointer types are not supported in this simulator', L, 'Use a record: TYPE ' + tn + ' ... DECLARE fields ... ENDTYPE');
            s.end(); if (T.kind !== 'root') throw err('TYPE must be defined at the top level', L, 'Move it above the main program.');
            var tdef = { name: tn, fields: [], line: L }; prog.types[tn.toLowerCase()] = tdef;
            stack.push({ kind: 'TYPE', node: tdef, body: null, line: L }); return;
          }
        }
      }
      var st = simple(s, L);
      if (!st) throw err(f.v + ' cannot start a line', L, 'Statements start with DECLARE, OUTPUT, INPUT, IF, CASE, FOR, WHILE, REPEAT, CALL or a variable to assign.');
      add(st);
    }

    for (var li = 0; li < lines.length; li++) {
      var toks = tokenize(lines[li], li + 1);
      if (toks.length) line(toks, li + 1);
    }
    if (stack.length > 1) {
      var o = top();
      if (o.kind === 'IF' && o.node.needThen) throw err('Expected THEN after the IF condition', o.line, 'Put THEN at the end of the IF line, or on the line below it.');
      throw err(o.kind + ' on line ' + o.line + ' is never closed', o.line, 'Add ' + CLOSER[o.kind] + ' after the last line of the block.');
    }
    typeRefs.forEach(function (t) {
      if (!prog.types[t.rec.toLowerCase()]) throw err('Unknown data type ' + t.rec, t.line, 'Use INTEGER, REAL, CHAR, STRING, BOOLEAN, DATE, or define it first with TYPE ' + t.rec + ' ... ENDTYPE.');
    });
    return prog;
  }

  /* ---------- built-in functions ---------- */
  function need(v, kind, fn, L, pos) {
    var ok = kind === 'num' ? typeof v === 'number' : kind === 'int' ? typeof v === 'number' && Number.isInteger(v) : kind === 'str' ? typeof v === 'string' : kind === 'chr' ? typeof v === 'string' && v.length === 1 : kind === 'date' ? isDate(v) : true;
    if (!ok) throw err(fn + ' needs ' + { num: 'a number', int: 'a whole number', str: 'a STRING', chr: 'a single CHAR', date: 'a DATE' }[kind] + (pos ? ' as argument ' + pos : '') + ', but got ' + repr(v), L, 'Check the order and type of the values in ' + fn + '(...).');
  }
  function midChk(s, st, n, fn, L) {
    need(s, 'str', fn, L, 1); need(st, 'int', fn, L, 2); need(n, 'int', fn, L, 3);
    if (st < 1 || n < 0 || st + n - 1 > s.length) throw err(fn + ' would read outside the string', L, 'The string ' + repr(s) + ' has ' + s.length + ' characters. Positions start at 1, so start + length - 1 must be ' + s.length + ' or less.');
    return s.substr(st - 1, n);
  }
  function divmod(a, b, fn, L) {
    need(a, 'num', fn, L, 1); need(b, 'num', fn, L, 2);
    if (b === 0) throw err('Division by zero in ' + fn, L, 'Check the second value is not 0 before dividing.');
    var q = Math.trunc(a / b); return fn === 'DIV' ? q : a - b * q;
  }
  var NUMRE = /^\s*[-+]?(\d+(\.\d*)?|\.\d+)\s*$/;
  var BUILTINS = {
    LENGTH: { n: 1, sig: 'LENGTH(ThisString)', f: function (a, L) { if (isArr(a[0])) return a[0].data.length; need(a[0], 'str', 'LENGTH', L); return a[0].length; } },
    LEFT: { n: 2, sig: 'LEFT(ThisString, x)', f: function (a, L) { need(a[0], 'str', 'LEFT', L, 1); need(a[1], 'int', 'LEFT', L, 2); if (a[1] < 0 || a[1] > a[0].length) throw err('LEFT asks for ' + a[1] + ' characters, but the string has ' + a[0].length, L, 'Use a length from 0 to LENGTH(...).'); return a[0].slice(0, a[1]); } },
    RIGHT: { n: 2, sig: 'RIGHT(ThisString, x)', f: function (a, L) { need(a[0], 'str', 'RIGHT', L, 1); need(a[1], 'int', 'RIGHT', L, 2); if (a[1] < 0 || a[1] > a[0].length) throw err('RIGHT asks for ' + a[1] + ' characters, but the string has ' + a[0].length, L, 'Use a length from 0 to LENGTH(...).'); return a[0].slice(a[0].length - a[1]); } },
    MID: { n: 3, sig: 'MID(ThisString, x, y)', f: function (a, L) { return midChk(a[0], a[1], a[2], 'MID', L); } },
    SUBSTRING: { n: 3, sig: 'SUBSTRING(ThisString, Start, Length)', f: function (a, L) { return midChk(a[0], a[1], a[2], 'SUBSTRING', L); } },
    TO_UPPER: { n: 1, sig: 'TO_UPPER(x)', f: function (a, L) { need(a[0], 'str', 'TO_UPPER', L); return a[0].toUpperCase(); } },
    TO_LOWER: { n: 1, sig: 'TO_LOWER(x)', f: function (a, L) { need(a[0], 'str', 'TO_LOWER', L); return a[0].toLowerCase(); } },
    UCASE: { n: 1, sig: 'UCASE(x)', f: function (a, L) { need(a[0], 'str', 'UCASE', L); return a[0].toUpperCase(); } },
    LCASE: { n: 1, sig: 'LCASE(x)', f: function (a, L) { need(a[0], 'str', 'LCASE', L); return a[0].toLowerCase(); } },
    NUM_TO_STR: { n: 1, sig: 'NUM_TO_STR(x)', f: function (a, L) { need(a[0], 'num', 'NUM_TO_STR', L); return fmtNum(a[0]); } },
    STR_TO_NUM: { n: 1, sig: 'STR_TO_NUM(x)', f: function (a, L) { need(a[0], 'str', 'STR_TO_NUM', L); if (!NUMRE.test(a[0])) throw err('STR_TO_NUM cannot turn ' + repr(a[0]) + ' into a number', L, 'Check it first with IS_NUM(...).'); return parseFloat(a[0]); } },
    IS_NUM: { n: 1, sig: 'IS_NUM(ThisString)', f: function (a, L) { need(a[0], 'str', 'IS_NUM', L); return NUMRE.test(a[0]); } },
    ASC: { n: 1, sig: 'ASC(ThisChar)', f: function (a, L) { need(a[0], 'chr', 'ASC', L); return a[0].charCodeAt(0); } },
    CHR: { n: 1, sig: 'CHR(x)', f: function (a, L) { need(a[0], 'int', 'CHR', L); return String.fromCharCode(a[0]); } },
    INT: { n: 1, sig: 'INT(x)', f: function (a, L) { need(a[0], 'num', 'INT', L); return Math.trunc(a[0]); } },
    ROUND: { n: 2, sig: 'ROUND(Value, Places)', f: function (a, L) { need(a[0], 'num', 'ROUND', L, 1); need(a[1], 'int', 'ROUND', L, 2); var p = Math.pow(10, a[1]); return Math.round(a[0] * p + (a[0] >= 0 ? 1e-9 : -1e-9)) / p; } },
    RAND: { n: 1, sig: 'RAND(x)', f: function (a, L) { need(a[0], 'num', 'RAND', L); return Math.random() * a[0]; } },
    RANDOM: { n: 0, sig: 'RANDOM()', f: function () { return Math.random(); } },
    DIV: { n: 2, sig: 'DIV(x, y)', f: function (a, L) { return divmod(a[0], a[1], 'DIV', L); } },
    MOD: { n: 2, sig: 'MOD(x, y)', f: function (a, L) { return divmod(a[0], a[1], 'MOD', L); } },
    DAY: { n: 1, sig: 'DAY(ThisDate)', f: function (a, L) { need(a[0], 'date', 'DAY', L); return a[0].getUTCDate(); } },
    MONTH: { n: 1, sig: 'MONTH(ThisDate)', f: function (a, L) { need(a[0], 'date', 'MONTH', L); return a[0].getUTCMonth() + 1; } },
    YEAR: { n: 1, sig: 'YEAR(ThisDate)', f: function (a, L) { need(a[0], 'date', 'YEAR', L); return a[0].getUTCFullYear(); } },
    DAYINDEX: { n: 1, sig: 'DAYINDEX(ThisDate)', f: function (a, L) { need(a[0], 'date', 'DAYINDEX', L); return a[0].getUTCDay() + 1; } },
    SETDATE: { n: 3, sig: 'SETDATE(Day, Month, Year)', f: function (a, L) {
      for (var i = 0; i < 3; i++) need(a[i], 'int', 'SETDATE', L, i + 1);
      var d = new Date(Date.UTC(a[2], a[1] - 1, a[0]));
      if (d.getUTCDate() !== a[0] || d.getUTCMonth() !== a[1] - 1) throw err(a[0] + '/' + a[1] + '/' + a[2] + ' is not a real date', L, 'The order is SETDATE(Day, Month, Year).');
      return d; } },
    NOW: { n: 0, sig: 'NOW()', f: function () { var n = new Date(); return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())); } },
    EOF: { n: 1, sig: 'EOF(FileName)', f: function (a, L, rt) { var fl = rt.file(a[0], L, 'EOF'); if (fl.mode !== 'READ') throw err('EOF only works on a file opened FOR READ', L, 'Open it with OPENFILE ' + repr(a[0]) + ' FOR READ'); return fl.pos >= fl.lines.length; } }
  };

  /* ---------- runtime ---------- */
  function num(v, op, L) { if (typeof v !== 'number') throw err(op + ' needs numbers, but got ' + repr(v), L, typeof v === 'string' ? (op === '+' ? 'To join text, use & instead of +.' : 'Convert text to a number with STR_TO_NUM(...).') : 'Check the values on each side of ' + op + '.'); return v; }
  function bool(v, op, L) { if (typeof v !== 'boolean') throw err(op + ' needs TRUE or FALSE, but got ' + repr(v), L, 'Write a full comparison on each side, e.g. Age > 12 AND Age < 20'); }
  function eq(a, b) { if (isDate(a) && isDate(b)) return a.getTime() === b.getTime(); return a === b; }
  function cmpOk(a, b, op, L) {
    var ka = typeof a, kb = typeof b;
    if (isDate(a) && isDate(b)) return;
    if (ka !== kb || (ka !== 'number' && ka !== 'string' && ka !== 'boolean')) throw err('Cannot compare ' + kindOf(a) + ' ' + repr(a) + ' with ' + kindOf(b) + ' ' + repr(b), L, ka === 'string' || kb === 'string' ? 'Convert one side first with STR_TO_NUM(...) or NUM_TO_STR(...).' : 'Both sides of ' + op + ' must be the same type.');
    if (ka === 'boolean' && op !== '=' && op !== '<>') throw err(op + ' cannot compare TRUE and FALSE', L, 'Use = or <> with BOOLEAN values.');
  }
  function binop(op, a, b, L) {
    switch (op) {
      case '+': if (typeof a === 'string' || typeof b === 'string') throw err('+ cannot join text', L, 'Use & to join strings, e.g. "Hello " & Name'); return num(a, op, L) + num(b, op, L);
      case '-': return num(a, op, L) - num(b, op, L);
      case '*': return num(a, op, L) * num(b, op, L);
      case '/': num(a, op, L); num(b, op, L); if (b === 0) throw err('Division by zero', L, 'Check the divisor is not 0 before dividing.'); return a / b;
      case '^': return Math.pow(num(a, op, L), num(b, op, L));
      case 'DIV': case 'MOD': return divmod(a, b, op, L);
      case '&':
        if (typeof a !== 'string' || typeof b !== 'string') { var bad = typeof a !== 'string' ? a : b; throw err('& joins strings, but ' + repr(bad) + ' is ' + kindOf(bad), L, typeof bad === 'number' ? 'Convert it with NUM_TO_STR(...), or output it separately: OUTPUT "Total: ", Total' : 'Both sides of & must be STRING or CHAR.'); }
        return a + b;
      case '=': cmpOk(a, b, op, L); return eq(a, b);
      case '<>': cmpOk(a, b, op, L); return !eq(a, b);
      case '<': cmpOk(a, b, op, L); return a < b;
      case '<=': cmpOk(a, b, op, L); return a <= b;
      case '>': cmpOk(a, b, op, L); return a > b;
      case '>=': cmpOk(a, b, op, L); return a >= b;
    }
  }
  function coerce(ty, v, L, label) {
    if (!ty) return copy(v);
    var bad = function (hint) { throw err('Cannot store ' + kindOf(v) + ' ' + repr(v) + ' in ' + label + ', which is ' + tyName(ty), L, hint); };
    if (v === undefined) throw err('There is no value to store in ' + label, L, 'Give the source a value first.');
    if (ty.base) {
      switch (ty.base) {
        case 'INTEGER': if (typeof v !== 'number') bad(typeof v === 'string' ? 'Convert it first with STR_TO_NUM(...).' : ''); if (!Number.isInteger(v)) bad('Round it with INT(...) or ROUND(..., 0), or DECLARE ' + label + ' as REAL.'); return v;
        case 'REAL': if (typeof v !== 'number') bad(typeof v === 'string' ? 'Convert it first with STR_TO_NUM(...).' : ''); return v;
        case 'STRING': if (typeof v !== 'string') bad(typeof v === 'number' ? 'Convert it first with NUM_TO_STR(...).' : ''); return v;
        case 'CHAR': if (typeof v !== 'string' || v.length !== 1) bad('A CHAR holds exactly one character. DECLARE it as STRING for longer text.'); return v;
        case 'BOOLEAN': if (typeof v !== 'boolean') bad('A BOOLEAN holds TRUE or FALSE.'); return v;
        case 'DATE': if (!isDate(v)) bad('Make a date with SETDATE(Day, Month, Year).'); return v;
      }
    }
    if (ty.arr) {
      if (!isArr(v)) bad('Assign one element at a time, e.g. ' + label + '[1] ← ...');
      if (ty.dims && JSON.stringify(v.dims) !== JSON.stringify(ty.dims)) bad('Both arrays must have the same bounds to copy one into the other.');
      return copy(v);
    }
    if (!isRec(v) || v.tname.toLowerCase() !== ty.rec.toLowerCase()) bad('Assign the fields one at a time, e.g. ' + label + '.Name ← ...');
    return copy(v);
  }

  function Runner(prog, inputs) {
    this.prog = prog; this.inputs = inputs; this.out = []; this.globals = {}; this.files = {};
    this.frames = [{ name: 'main program', vars: this.globals, line: 0 }];
    this.line = 0; this.steps = 0; this.done = false;
    this.gen = this.block(prog.body);
  }
  Runner.prototype.step = function () { if (this.done) return; this.steps++; var r = this.gen.next(); if (r.done) { this.done = true; this.line = 0; } };
  Runner.prototype.mark = function (L) { this.frames[this.frames.length - 1].line = L; this.line = L; };
  Runner.prototype.scope = function () { return this.frames[this.frames.length - 1].vars; };
  Runner.prototype.find = function (name) {
    var k = name.toLowerCase(), top = this.scope();
    if (has(top, k)) return top[k];
    if (has(this.globals, k)) return this.globals[k];
    return null;
  };
  Runner.prototype.notFound = function (name, L) {
    var p = this.prog.procs[name.toLowerCase()];
    if (p) throw err(name + ' is a ' + (p.isFunc ? 'FUNCTION' : 'PROCEDURE') + ', not a variable', L, p.isFunc ? 'Call it with brackets: ' + p.name + '(...)' : 'Run it on its own line with CALL ' + p.name + '(...)');
    if (BUILTINS[name.toUpperCase()]) throw err(name + ' is a built-in function', L, 'Call it with brackets: ' + BUILTINS[name.toUpperCase()].sig);
    var known = Object.keys(this.scope()).concat(Object.keys(this.globals)).map(function (k) { return (this.scope()[k] || this.globals[k]).name; }, this);
    var near = nearest(name, known);
    throw err(name + ' has not been declared', L, near ? 'Did you mean ' + near + '?' : 'Declare it with DECLARE ' + name + ' : <type>, then give it a value with ' + name + ' ← ...');
  };
  Runner.prototype.makeType = function* (ty, L) {
    if (ty.arr) {
      if (!ty.dims) return ty;
      var dims = [];
      for (var i = 0; i < ty.dims.length; i++) {
        var lo = yield* this.ev(ty.dims[i][0], L), hi = yield* this.ev(ty.dims[i][1], L);
        if (typeof lo !== 'number' || typeof hi !== 'number' || !Number.isInteger(lo) || !Number.isInteger(hi)) throw err('Array bounds must be whole numbers', L, 'For example ARRAY[1:10] OF INTEGER');
        if (hi < lo) throw err('The upper bound ' + hi + ' is less than the lower bound ' + lo, L, 'Write the bounds lower:upper, e.g. [1:10]');
        if ((hi - lo + 1) * (dims.length ? dims[0][1] - dims[0][0] + 1 : 1) > 100000) throw err('This array is too big for the simulator', L, 'Keep arrays under 100,000 elements.');
        dims.push([lo, hi]);
      }
      return { arr: true, dims: dims, el: ty.el };
    }
    if (ty.rec) { var td = this.prog.types[ty.rec.toLowerCase()]; return { rec: td.name }; }
    return ty;
  };
  Runner.prototype.staticType = function (ty, L) {
    if (!ty.arr) return ty.rec ? { rec: this.prog.types[ty.rec.toLowerCase()].name } : ty;
    var val = function (e) { if (e.t === 'num') return e.v; if (e.t === 'un' && e.op === '-' && e.a.t === 'num') return -e.a.v; throw err('Array bounds inside a TYPE must be plain numbers', L, 'For example DECLARE Marks : ARRAY[1:5] OF INTEGER'); };
    if (!ty.dims) throw err('An array field needs bounds', L, 'For example DECLARE Marks : ARRAY[1:5] OF INTEGER');
    return { arr: true, dims: ty.dims.map(function (d) { return [val(d[0]), val(d[1])]; }), el: ty.el };
  };
  Runner.prototype.blank = function (ty) {
    if (ty.arr) {
      if (!ty.dims) throw err('DECLARE needs array bounds', this.line, 'For example DECLARE Scores : ARRAY[1:10] OF INTEGER');
      var size = 1; ty.dims.forEach(function (d) { size *= d[1] - d[0] + 1; });
      var data = new Array(size); if (ty.el.rec) for (var i = 0; i < size; i++) data[i] = this.blank(ty.el);
      return { arr: true, dims: ty.dims, el: ty.el, data: data };
    }
    if (ty.rec) {
      var td = this.prog.types[ty.rec.toLowerCase()], fields = {};
      td.fields.forEach(function (d) { d.names.forEach(function (n) { var ft = this.staticType(d.type, d.line); fields[n.toLowerCase()] = { name: n, type: ft, v: ft.rec || ft.arr ? this.blank(ft) : undefined }; }, this); }, this);
      return { rec: true, tname: td.name, fields: fields };
    }
    return undefined;
  };
  Runner.prototype.store = function (cell, v, L) {
    if (cell.isConst) throw err(cell.name + ' is a CONSTANT and cannot be changed', L, 'Use a variable (DECLARE) if the value needs to change.');
    cell.v = coerce(cell.type, v, L, cell.name);
  };
  Runner.prototype.ref = function* (e, L) {
    var self = this;
    if (e.t === 'var') {
      var cell = this.find(e.name);
      if (!cell) {
        var p = this.prog.procs[e.name.toLowerCase()];
        if (p) throw err(e.name + ' is a ' + (p.isFunc ? 'FUNCTION' : 'PROCEDURE') + ' and cannot be assigned to', L, p.isFunc ? 'Inside a FUNCTION, give back a value with RETURN.' : 'Choose a different variable name.');
        cell = { name: e.name, type: null, v: undefined }; this.scope()[e.name.toLowerCase()] = cell;
      }
      return { type: cell.type, label: cell.name, get: function () { return cell.v; }, set: function (v) { self.store(cell, v, L); }, cell: cell };
    }
    if (e.t === 'idx') {
      var base = yield* this.ref(e.obj, L), arr = base.get();
      if (!isArr(arr)) {
        if (typeof arr === 'string') throw err('Strings cannot be indexed with [ ]', L, 'Use MID(' + base.label + ', Position, 1) to get one character.');
        throw err(base.label + ' is not an array', L, arr === undefined ? 'Declare it first: DECLARE ' + base.label + ' : ARRAY[1:10] OF INTEGER' : base.label + ' holds ' + kindOf(arr) + '.');
      }
      var off = yield* this.offset(arr, e.index, L, base.label), label = base.label + '[' + this._ix + ']';
      return { type: arr.el, label: label, get: function () { return arr.data[off]; }, set: function (v) { arr.data[off] = coerce(arr.el, v, L, label); } };
    }
    if (e.t === 'field') {
      var rb = yield* this.ref(e.obj, L), rec = rb.get();
      if (!isRec(rec)) throw err(rb.label + ' is not a record', L, rec === undefined ? 'Declare it with a record type: DECLARE ' + rb.label + ' : <TypeName>' : rb.label + ' holds ' + kindOf(rec) + ', which has no fields.');
      var fc = rec.fields[e.name.toLowerCase()];
      if (!fc) { var nf = nearest(e.name, Object.keys(rec.fields).map(function (k) { return rec.fields[k].name; })); throw err(rec.tname + ' has no field called ' + e.name, L, nf ? 'Did you mean ' + nf + '?' : 'The fields are: ' + Object.keys(rec.fields).map(function (k) { return rec.fields[k].name; }).join(', ')); }
      var fl = rb.label + '.' + fc.name;
      return { type: fc.type, label: fl, get: function () { return fc.v; }, set: function (v) { fc.v = coerce(fc.type, v, L, fl); } };
    }
    throw err('Only a variable can be assigned to', L, 'For example Total, Scores[3] or Student.Name');
  };
  Runner.prototype.offset = function* (arr, ixE, L, label) {
    if (ixE.length !== arr.dims.length) throw err(label + ' has ' + arr.dims.length + ' dimension' + (arr.dims.length > 1 ? 's' : '') + ' but ' + ixE.length + ' index' + (ixE.length > 1 ? 'es were' : ' was') + ' given', L, arr.dims.length === 2 ? 'Write ' + label + '[Row, Column]' : 'Write ' + label + '[Index]');
    var off = 0, shown = [];
    for (var i = 0; i < ixE.length; i++) {
      var ix = yield* this.ev(ixE[i], L), d = arr.dims[i];
      if (typeof ix !== 'number' || !Number.isInteger(ix)) throw err('Array index must be a whole number, got ' + repr(ix), L, 'Use an INTEGER inside [ ].');
      if (ix < d[0] || ix > d[1]) throw err('Index ' + ix + ' is outside ' + label + '[' + arr.dims.map(function (x) { return x[0] + ':' + x[1]; }).join(', ') + ']', L, 'Valid ' + (arr.dims.length > 1 ? (i ? 'columns' : 'rows') : 'indexes') + ' are ' + d[0] + ' to ' + d[1] + '. Check the loop limits.');
      off = off * (d[1] - d[0] + 1) + (ix - d[0]); shown.push(ix);
    }
    this._ix = shown.join(', ');
    return off;
  };
  Runner.prototype.file = function (name, L, op) {
    if (typeof name !== 'string') throw err(op + ' needs a file name in quotes', L, 'For example ' + op + ' "data.txt"');
    var f = this.files[name];
    if (!f || !f.mode) throw err('The file ' + repr(name) + ' is not open', L, 'Open it first with OPENFILE ' + repr(name) + ' FOR READ (or WRITE / APPEND).');
    return f;
  };
  Runner.prototype.block = function* (body) {
    for (var i = 0; i < body.length; i++) { var r = yield* this.exec(body[i]); if (r) return r; }
    return null;
  };
  Runner.prototype.cond = function* (e, L, kw) {
    var v = yield* this.ev(e, L);
    if (typeof v !== 'boolean') throw err(kw + ' condition must be TRUE or FALSE, but it gave ' + repr(v), L, 'Compare with = <> < > <= >=, e.g. ' + kw + ' Count < 10');
    return v;
  };
  Runner.prototype.exec = function* (st) {
    var L = st.line, r, i, v, rf;
    this.mark(L); yield L;
    switch (st.t) {
      case 'declare': {
        var ty = yield* this.makeType(st.type, L);
        for (i = 0; i < st.names.length; i++) this.scope()[st.names[i].toLowerCase()] = { name: st.names[i], type: ty, v: this.blank(ty) };
        return null;
      }
      case 'const': {
        v = yield* this.ev(st.expr, L);
        this.scope()[st.name.toLowerCase()] = { name: st.name, type: { base: kindOf(v) === 'nothing' ? 'STRING' : kindOf(v) }, v: v, isConst: true };
        return null;
      }
      case 'assign': v = yield* this.ev(st.expr, L); rf = yield* this.ref(st.target, L); rf.set(v); return null;
      case 'output': {
        var parts = [];
        for (i = 0; i < st.items.length; i++) { v = yield* this.ev(st.items[i], L); parts.push(fmt(v)); }
        this.out.push({ text: parts.join(''), kind: 'out' });
        if (this.out.length > 5000) throw err('More than 5,000 lines of output', L, 'This is usually a loop that never ends around an OUTPUT.');
        return null;
      }
      case 'input': {
        rf = yield* this.ref(st.target, L);
        while (!this.inputs.length) { this.waiting = { label: rf.label + (rf.type ? ' : ' + tyName(rf.type) : ''), prompt: '' }; yield L; }
        this.waiting = null;
        var raw = this.inputs.shift(); this.out.push({ text: raw, kind: 'in', label: rf.label });
        rf.set(this.convert(raw, rf.type, L, rf.label)); return null;
      }
      case 'if':
        if (yield* this.cond(st.cond, L, 'IF')) return yield* this.block(st.then);
        if (st.els) return yield* this.block(st.els);
        return null;
      case 'case': {
        v = yield* this.ev(st.expr, L);
        for (i = 0; i < st.clauses.length; i++) {
          var cl = st.clauses[i], hit = !!cl.other;
          for (var j = 0; !hit && j < cl.vals.length; j++) {
            var cv = cl.vals[j];
            if (cv.lo) { var lo = yield* this.ev(cv.lo, cl.line), hi = yield* this.ev(cv.hi, cl.line); cmpOk(v, lo, 'TO', cl.line); hit = v >= lo && v <= hi; }
            else { var x = yield* this.ev(cv.v, cl.line); cmpOk(v, x, '=', cl.line); hit = eq(v, x); }
          }
          if (hit) { if (!cl.body.length) { this.mark(cl.line); yield cl.line; } return yield* this.block(cl.body); }
        }
        return null;
      }
      case 'while':
        for (;;) {
          if (!(yield* this.cond(st.cond, L, 'WHILE'))) return null;
          r = yield* this.block(st.body); if (r) return r;
          this.mark(L); yield L;
        }
      case 'repeat':
        for (;;) {
          r = yield* this.block(st.body); if (r) return r;
          this.mark(st.untilLine); yield st.untilLine;
          if (yield* this.cond(st.cond, st.untilLine, 'UNTIL')) return null;
        }
      case 'for': {
        var a = yield* this.ev(st.from, L), b = yield* this.ev(st.to, L), d = 1;
        if (st.step) d = yield* this.ev(st.step, L);
        if (typeof a !== 'number' || typeof b !== 'number' || typeof d !== 'number') throw err('FOR loop values must be numbers', L, 'Check the values after ←, TO and STEP.');
        if (d === 0) throw err('STEP cannot be 0', L, 'A STEP of 0 would never reach the end value.');
        rf = yield* this.ref({ t: 'var', name: st.name }, L);
        var first = true;
        for (var k = a; d > 0 ? k <= b : k >= b; k += d) {
          if (!first) { this.mark(L); yield L; } first = false;
          rf.set(k);
          r = yield* this.block(st.body); if (r) return r;
        }
        return null;
      }
      case 'call': {
        var p = this.prog.procs[st.name.toLowerCase()];
        if (p && p.isFunc) throw err(p.name + ' is a FUNCTION, so its result must be used', L, 'Store or show the result, e.g. Result ← ' + p.name + '(...) or OUTPUT ' + p.name + '(...)');
        yield* this.call(st.name, st.args, L, false); return null;
      }
      case 'return': v = yield* this.ev(st.expr, L); return { ret: v };
      case 'open': {
        var fn = yield* this.ev(st.file, L);
        if (typeof fn !== 'string') throw err('OPENFILE needs a file name in quotes', L, 'For example OPENFILE "data.txt" FOR READ');
        var f = this.files[fn];
        if (f && f.mode) throw err('The file ' + repr(fn) + ' is already open', L, 'CLOSEFILE ' + repr(fn) + ' before opening it again.');
        if (st.mode === 'READ' && !f) throw err('The file ' + repr(fn) + ' does not exist', L, 'Create it first: OPENFILE ' + repr(fn) + ' FOR WRITE, then WRITEFILE lines into it and CLOSEFILE it.');
        if (!f) f = this.files[fn] = { name: fn, lines: [] };
        if (st.mode === 'WRITE') f.lines = [];
        f.mode = st.mode; f.pos = 0; return null;
      }
      case 'readf': {
        var rn = yield* this.ev(st.file, L), rfl = this.file(rn, L, 'READFILE');
        if (rfl.mode !== 'READ') throw err(repr(rn) + ' is open for ' + rfl.mode + ', not READ', L, 'CLOSEFILE it, then OPENFILE ' + repr(rn) + ' FOR READ');
        if (rfl.pos >= rfl.lines.length) throw err('Tried to read past the end of ' + repr(rn), L, 'Loop with WHILE NOT EOF(' + repr(rn) + ') before each READFILE.');
        rf = yield* this.ref(st.target, L); rf.set(this.convert(rfl.lines[rfl.pos++], rf.type, L, rf.label)); return null;
      }
      case 'writef': {
        var wn = yield* this.ev(st.file, L), wfl = this.file(wn, L, 'WRITEFILE');
        if (wfl.mode === 'READ') throw err(repr(wn) + ' is open for READ, so it cannot be written to', L, 'Open it FOR WRITE (replaces the file) or FOR APPEND (adds to the end).');
        v = yield* this.ev(st.expr, L); wfl.lines.push(fmt(v)); return null;
      }
      case 'closef': { var cn = yield* this.ev(st.file, L); var cfl = this.file(cn, L, 'CLOSEFILE'); cfl.mode = null; return null; }
    }
    return null;
  };
  Runner.prototype.convert = function (raw, ty, L, label) {
    var base = ty && ty.base;
    if (ty && !base) throw err('Cannot read a whole ' + tyName(ty) + ' from input', L, 'Read into one element or field at a time, e.g. INPUT ' + label + '[1]');
    if (base === 'INTEGER') { if (!/^\s*[-+]?\d+\s*$/.test(raw)) throw err(label + ' is an INTEGER, but the input was ' + repr(raw), L, 'Change the input to a whole number, or DECLARE ' + label + ' with a different type.'); return parseInt(raw, 10); }
    if (base === 'REAL') { if (!NUMRE.test(raw)) throw err(label + ' is a REAL, but the input was ' + repr(raw), L, 'Change the input to a number such as 3.5'); return parseFloat(raw); }
    if (base === 'BOOLEAN') { var u = raw.trim().toUpperCase(); if (u !== 'TRUE' && u !== 'FALSE') throw err(label + ' is a BOOLEAN, but the input was ' + repr(raw), L, 'Type TRUE or FALSE.'); return u === 'TRUE'; }
    if (base === 'CHAR') { if (raw.length !== 1) throw err(label + ' is a CHAR, but the input ' + repr(raw) + ' is not one character', L, 'Type a single character, or DECLARE ' + label + ' as STRING.'); return raw; }
    if (base === 'DATE') { var m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(raw); if (!m) throw err(label + ' is a DATE, but the input was ' + repr(raw), L, 'Type the date as dd/mm/yyyy.'); return BUILTINS.SETDATE.f([+m[1], +m[2], +m[3]], L); }
    if (base === 'STRING') return raw;
    return NUMRE.test(raw) ? parseFloat(raw) : raw;
  };
  Runner.prototype.call = function* (name, argEx, L, want) {
    var key = name.toLowerCase(), p = this.prog.procs[key], i, v;
    if (!p) {
      var up = name.toUpperCase(), bi = BUILTINS[up];
      if (bi) {
        if (name !== up) throw err('Built-in functions are written in capitals', L, 'Write ' + up + '(...) instead of ' + name + '(...).');
        if (!want) throw err(up + ' is a built-in function, so its result must be used', L, 'For example X ← ' + bi.sig);
        if (argEx.length !== bi.n) throw err(up + ' takes ' + bi.n + ' argument' + (bi.n === 1 ? '' : 's') + ' but was given ' + argEx.length, L, 'Pattern: ' + bi.sig);
        var av = []; for (i = 0; i < argEx.length; i++) { v = yield* this.ev(argEx[i], L); av.push(v); }
        return bi.f(av, L, this);
      }
      var near = nearest(name, Object.keys(this.prog.procs).map(function (k) { return this.prog.procs[k].name; }, this).concat(Object.keys(BUILTINS)));
      throw err('No PROCEDURE or FUNCTION called ' + name, L, near ? 'Did you mean ' + near + '?' : 'Define it with PROCEDURE ' + name + '(...) or FUNCTION ' + name + '(...) RETURNS <type>.');
    }
    if (want && !p.isFunc) throw err(p.name + ' is a PROCEDURE, so it does not give back a value', L, 'Run it on its own line with CALL ' + p.name + '(...), or make it a FUNCTION that uses RETURN.');
    if (argEx.length !== p.params.length) throw err(p.name + ' expects ' + p.params.length + ' argument' + (p.params.length === 1 ? '' : 's') + ' but was given ' + argEx.length, L, 'It is defined on line ' + p.line + ' as ' + p.name + '(' + p.params.map(function (q) { return q.name; }).join(', ') + ').');
    var vars = {};
    for (i = 0; i < argEx.length; i++) {
      var pr = p.params[i], ty = yield* this.makeType(pr.type, L);
      if (pr.byref) {
        var ae = argEx[i]; var b = ae; while (b.t === 'idx' || b.t === 'field') b = b.obj;
        if (b.t !== 'var' || ae.t === 'call') throw err('BYREF parameter ' + pr.name + ' needs a variable, not a value', L, pr.inherited ? 'BYREF applies to every parameter after it until BYVAL. Write BYVAL ' + pr.name + ' in the header on line ' + p.line + ', or put by-value parameters first.' : 'Pass a variable so the procedure can change it, e.g. CALL ' + p.name + '(Total)');
        var rf = yield* this.ref(ae, L);
        if (rf.get() !== undefined) coerce(ty, rf.get(), L, pr.name);
        var cell = { name: pr.name, type: ty, byref: true };
        Object.defineProperty(cell, 'v', { get: rf.get, set: rf.set, enumerable: true });
        vars[pr.name.toLowerCase()] = cell;
      } else {
        v = yield* this.ev(argEx[i], L);
        vars[pr.name.toLowerCase()] = { name: pr.name, type: ty, v: coerce(ty, v, L, pr.name) };
      }
    }
    if (this.frames.length > 150) throw err('Too many nested calls: the recursion never stops', L, 'Make sure the FUNCTION has a base case that returns without calling itself again.');
    this.frames.push({ name: p.name, vars: vars, line: p.line });
    var r = yield* this.block(p.body);
    this.frames.pop(); this.mark(L);
    if (p.isFunc) {
      if (!r) throw err('FUNCTION ' + p.name + ' ended without a RETURN', p.endLine || p.line, 'Every path through a FUNCTION must reach a RETURN.');
      var rt = yield* this.makeType(p.rtype, L);
      return coerce(rt, r.ret, L, 'the result of ' + p.name);
    }
    return null;
  };
  Runner.prototype.ev = function* (e, L) {
    var a, b;
    switch (e.t) {
      case 'num': case 'str': case 'bool': return e.v;
      case 'var': {
        var cell = this.find(e.name);
        if (!cell) this.notFound(e.name, L);
        if (cell.v === undefined) throw err(cell.name + ' has no value yet', L, 'Give it a value first, e.g. ' + cell.name + ' ← 0 or INPUT ' + cell.name);
        return cell.v;
      }
      case 'idx': case 'field': {
        var rf = yield* this.ref(e, L), v = rf.get();
        if (v === undefined) throw err(rf.label + ' has no value yet', L, e.t === 'idx' ? 'Give every element a value first, for example with a FOR loop.' : 'Assign the field first, e.g. ' + rf.label + ' ← ...');
        return v;
      }
      case 'call': return yield* this.call(e.name, e.args, L, true);
      case 'un':
        a = yield* this.ev(e.a, L);
        if (e.op === 'NOT') { bool(a, 'NOT', L); return !a; }
        return -num(a, '-', L);
      case 'bin':
        a = yield* this.ev(e.a, L);
        if (e.op === 'AND' || e.op === 'OR') {
          bool(a, e.op, L);
          if (e.op === 'AND' && !a) return false;
          if (e.op === 'OR' && a) return true;
          b = yield* this.ev(e.b, L); bool(b, e.op, L); return b;
        }
        b = yield* this.ev(e.b, L);
        return binop(e.op, a, b, L);
    }
    return null;
  };

  function entries(vars) {
    return Object.keys(vars).map(function (k) {
      var c = vars[k], v = c.v;
      return { name: c.name, type: c.type ? (c.isConst ? 'CONSTANT' : tyName(c.type)) : (v === undefined ? '' : kindOf(v)), value: repr(v, c.type) };
    });
  }
  function extra(r) {
    return Object.keys(r.files).map(function (k) {
      var f = r.files[k];
      return { name: '"' + f.name + '"', type: 'FILE', value: f.lines.length + ' line' + (f.lines.length === 1 ? '' : 's') + (f.mode ? ', open for ' + f.mode : ', closed') + (f.lines.length ? ': ' + f.lines.slice(0, 6).join(' | ') + (f.lines.length > 6 ? ' | …' : '') : '') };
    });
  }

  return { compile: compile, Runner: Runner, err: err, fmt: fmt, repr: repr, entries: entries, extra: extra, KW: KW, BUILTINS: BUILTINS };
})();

var PY = (function () {
  var KWL = 'False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield'.split(' ');
  var KW = {}; KWL.forEach(function (k) { KW[k] = 1; });
  var has = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };
  function err(type, msg, line, hint) { var e = new Error(type + ': ' + msg); e.isP = true; e.pyType = type; e.pyMsg = msg; e.pline = line; e.hint = hint || ''; return e; }
  function syn(msg, line, hint) { return err('SyntaxError', msg, line, hint); }
  function lev(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 9;
    var d = [], i, j; for (i = 0; i <= a.length; i++) d[i] = [i]; for (j = 0; j <= b.length; j++) d[0][j] = j;
    for (i = 1; i <= a.length; i++) for (j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }
  function nearest(name, list) { var best = null, bd = name.length > 3 ? 3 : 2; list.forEach(function (k) { if (k === name) return; var x = lev(name, k); if (x < bd) { bd = x; best = k; } }); return best; }

  /* ================= tokenizer ================= */
  var ESC = { n: '\n', t: '\t', r: '\r', '\\': '\\', "'": "'", '"': '"', '0': '\0', a: '\x07', b: '\b', f: '\f', v: '\v', '\n': '' };
  function unescape(s) {
    return s.replace(/\\(x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|[\s\S])/g, function (m, c) {
      if (c.length > 1) return String.fromCharCode(parseInt(c.slice(1), 16));
      return has(ESC, c) ? ESC[c] : m;
    });
  }
  var OPS3 = ['**=', '//=', '...', '>>=', '<<='], OPS2 = ['**', '//', '==', '!=', '<=', '>=', '+=', '-=', '*=', '/=', '%=', '->', ':=', '<<', '>>'];
  function tokenize(src) {
    var t = [], i = 0, n = src.length, line = 1, depth = 0, ind = [0], bol = true, opens = [], m;
    function push(k, v, extra) { var o = { k: k, v: v, line: line }; if (extra) for (var x in extra) o[x] = extra[x]; t.push(o); return o; }
    while (i < n) {
      if (bol && depth === 0) {
        var col = 0, j = i;
        while (j < n && (src[j] === ' ' || src[j] === '\t' || src[j] === '\f')) { col = src[j] === '\t' ? col + 4 - (col % 4) : col + 1; j++; }
        if (j >= n) { i = j; break; }
        if (src[j] === '\n' || src[j] === '#' || src[j] === '\r') { while (j < n && src[j] !== '\n') j++; i = j + 1; line++; continue; }
        var topI = ind[ind.length - 1];
        if (col > topI) { if (t.length && t[t.length - 1].k !== 'nl') throw err('IndentationError', 'unexpected indent', line); ind.push(col); push('indent', col); }
        else if (col < topI) {
          while (col < ind[ind.length - 1]) { ind.pop(); push('dedent', col); }
          if (col !== ind[ind.length - 1]) throw err('IndentationError', 'unindent does not match any outer indentation level', line, 'Line this up exactly with the block it belongs to. Use 4 spaces per level.');
        }
        i = j; bol = false;
      }
      var c = src[i];
      if (c === '\n') { if (depth === 0) { push('nl', ''); bol = true; } line++; i++; continue; }
      if (c === ' ' || c === '\t' || c === '\r' || c === '\f') { i++; continue; }
      if (c === '#') { while (i < n && src[i] !== '\n') i++; continue; }
      if (c === '\\' && src[i + 1] === '\n') { i += 2; line++; continue; }
      if ((m = /^([rRfFbBuU]{1,2})?('''|"""|'|")/.exec(src.slice(i, i + 5)))) {
        var pre = (m[1] || '').toLowerCase(), q = m[2], start = i + m[0].length, j2 = start, sl = line;
        if (pre.indexOf('b') >= 0) throw err('SyntaxError', 'bytes literals are not supported in this simulator', line);
        for (;;) {
          if (j2 >= n) throw syn('unterminated ' + (q.length === 3 ? 'triple-quoted ' : '') + 'string literal (detected at line ' + sl + ')', sl, 'Close the string with the same quote mark it started with: ' + q);
          var ch = src[j2];
          if (ch === '\\' && pre.indexOf('r') < 0) { if (src[j2 + 1] === '\n') line++; j2 += 2; continue; }
          if (ch === '\n') { if (q.length === 1) throw syn('unterminated string literal (detected at line ' + sl + ')', sl, 'Close the string with ' + q + ' before the end of the line.'); line++; }
          if (src.substr(j2, q.length) === q) break;
          j2++;
        }
        var raw = src.slice(start, j2), tk = { line: sl };
        tk.k = pre.indexOf('f') >= 0 ? 'fstr' : 'str';
        tk.v = pre.indexOf('r') >= 0 ? raw : (tk.k === 'fstr' ? raw : unescape(raw));
        tk.raw = pre.indexOf('r') >= 0;
        t.push(tk); i = j2 + q.length; continue;
      }
      if ((m = /^(\d[\d_]*(\.[\d_]*)?([eE][+-]?\d+)?|\.\d[\d_]*([eE][+-]?\d+)?)/.exec(src.slice(i)))) {
        var txt = m[0].replace(/_/g, ''), isF = /[.eE]/.test(txt);
        if (/^[A-Za-z_]/.test(src[i + m[0].length] || '')) throw syn('invalid decimal literal', line, 'Names cannot start with a digit, and a number must be followed by an operator or space.');
        push('num', isF ? parseFloat(txt) : BigInt(txt), { isF: isF }); i += m[0].length; continue;
      }
      if ((m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i)))) { push(KW[m[0]] ? 'kw' : 'name', m[0]); i += m[0].length; continue; }
      var three = src.substr(i, 3), two = src.substr(i, 2), op = OPS3.indexOf(three) >= 0 ? three : OPS2.indexOf(two) >= 0 ? two : null;
      if (!op && '+-*/%<>=()[]{},:.;@&|^~'.indexOf(c) >= 0) op = c;
      if (op) {
        if (op === '(' || op === '[' || op === '{') { depth++; opens.push({ c: op, line: line }); }
        if (op === ')' || op === ']' || op === '}') {
          var o = opens.pop(), want = { '(': ')', '[': ']', '{': '}' };
          if (!o) throw syn("unmatched '" + op + "'", line, 'There is a closing bracket with no opening bracket before it.');
          if (want[o.c] !== op) throw syn("closing parenthesis '" + op + "' does not match opening parenthesis '" + o.c + "'" + (o.line !== line ? ' on line ' + o.line : ''), line, 'Brackets must close in the reverse order they opened.');
          depth--;
        }
        push('op', op); i += op.length; continue;
      }
      if (c === '!') throw syn('invalid syntax', line, 'Python uses "not" for logical not, and != for "not equal".');
      if ('“”‘’'.indexOf(c) >= 0) throw syn("invalid character '" + c + "'", line, 'Retype the quotes as straight " or \' characters.');
      throw syn("invalid character '" + c + "'", line, 'Remove it, or check for a typing mistake.');
    }
    if (opens.length) { var ol = opens[opens.length - 1]; throw syn("'" + ol.c + "' was never closed", ol.line, 'Add the matching ' + { '(': ')', '[': ']', '{': '}' }[ol.c] + '.'); }
    if (t.length && t[t.length - 1].k !== 'nl') push('nl', '');
    while (ind.length > 1) { ind.pop(); push('dedent', 0); }
    push('eof', '');
    return t;
  }

  /* ================= parser ================= */
  function Parser(toks) { this.t = toks; this.i = 0; this.ctx = [{ assigned: {}, globals: {}, nonlocals: {}, loop: 0, fn: false }]; }
  var PP = Parser.prototype;
  PP.peek = function (o) { return this.t[this.i + (o || 0)]; };
  PP.next = function () { return this.t[this.i++]; };
  PP.is = function (v, o) { var x = this.peek(o); return !!x && (x.k === 'op' || x.k === 'kw') && x.v === v; };
  PP.accept = function (v) { if (this.is(v)) { this.i++; return true; } return false; };
  PP.desc = function (x) { return x.k === 'nl' ? 'end of line' : x.k === 'eof' ? 'end of program' : x.k === 'indent' ? 'indent' : x.k === 'dedent' ? 'dedent' : x.k === 'str' || x.k === 'fstr' ? 'string' : "'" + String(x.v) + "'"; };
  PP.expect = function (v, hint) { if (!this.accept(v)) { var x = this.peek(); throw syn("expected '" + v + "'", x.line, hint); } };
  PP.name = function (what) { var x = this.next(); if (!x || x.k !== 'name') throw syn('invalid syntax', x ? x.line : 0, x && x.k === 'kw' ? "'" + x.v + "' is a Python keyword, so it cannot be used as " + what + '.' : 'Expected ' + what + ' here.'); return x.v; };
  PP.c = function () { return this.ctx[this.ctx.length - 1]; };
  PP.mark = function (e) {
    if (e.t === 'name') { this.c().assigned[e.id] = true; return; }
    if (e.t === 'tuple' || e.t === 'list') { e.items.forEach(this.mark, this); return; }
  };
  PP.checkTarget = function (e, line) {
    if (e.t === 'name' || e.t === 'sub' || e.t === 'attr') return;
    if (e.t === 'tuple' || e.t === 'list') { e.items.forEach(function (x) { this.checkTarget(x, line); }, this); return; }
    var what = e.t === 'call' ? 'function call' : e.t === 'const' || e.t === 'str' || e.t === 'fstr' ? 'literal' : 'expression';
    throw syn('cannot assign to ' + what + " here. Maybe you meant '==' instead of '='?", line, e.t === 'call' ? 'The name being assigned goes on the left: total = sum(values)' : 'The left of = must be a variable name, e.g. score = 10');
  };
  PP.file = function () {
    var body = [];
    while (this.peek().k !== 'eof') this.stmt(body);
    return body;
  };
  PP.stmt = function (body) {
    var x = this.peek();
    if (x.k === 'indent') throw err('IndentationError', 'unexpected indent', x.line, 'This line is indented more than the line above it. Line it up with the code around it.');
    if (x.k === 'nl') { this.next(); return; }
    if (x.k === 'kw') {
      switch (x.v) {
        case 'if': body.push(this.ifStmt()); return;
        case 'while': body.push(this.whileStmt()); return;
        case 'for': body.push(this.forStmt()); return;
        case 'def': body.push(this.defStmt()); return;
        case 'try': body.push(this.tryStmt()); return;
        case 'class': throw syn('classes are not supported in this simulator', x.line, 'Use functions, lists and dictionaries instead.');
        case 'with': throw syn("'with' is not supported in this simulator", x.line, 'Files are not available here. Use input() and print() instead.');
        case 'elif': case 'else': throw syn('invalid syntax', x.line, "'" + x.v + "' must line up with its if, straight after the if block. Check the indentation.");
        case 'except': case 'finally': throw syn('invalid syntax', x.line, "'" + x.v + "' must follow a try block at the same indentation.");
      }
    }
    this.simpleLine(body);
  };
  PP.simpleLine = function (body) {
    body.push(this.small());
    while (this.accept(';')) { if (this.peek().k === 'nl') break; body.push(this.small()); }
    this.endLine();
  };
  PP.endLine = function () {
    var x = this.peek();
    if (x.k === 'nl') { this.next(); return; }
    if (x.k === 'eof' || x.k === 'dedent') return;
    var prev = this.t[this.i - 1];
    if (x.k === 'op' && x.v === '=') throw syn("invalid syntax. Maybe you meant '==' or ':=' instead of '='?", x.line, 'Use == to compare two values.');
    if (prev && prev.k === 'name' && (x.k === 'name' || x.k === 'num' || x.k === 'str') && KW[prev.v.toLowerCase()]) throw syn('invalid syntax', x.line, "Python keywords are lowercase: write '" + prev.v.toLowerCase() + "'.");
    if (prev && prev.k === 'name' && prev.v === 'print' && (x.k === 'str' || x.k === 'name' || x.k === 'num' || x.k === 'fstr')) throw syn("Missing parentheses in call to 'print'. Did you mean print(...)?", x.line, 'In Python 3, print is a function: print("Hello")');
    if (prev && (prev.k === 'str' || prev.k === 'name' || prev.k === 'num' || (prev.k === 'op' && (prev.v === ')' || prev.v === ']'))) && (x.k === 'name' || x.k === 'num' || x.k === 'str' || x.k === 'fstr')) throw syn('invalid syntax. Perhaps you forgot a comma?', x.line, 'Separate values with commas, e.g. print("Total:", total). Join text with +.');
    throw syn('invalid syntax', x.line, 'Python did not expect ' + this.desc(x) + ' here. Check for a missing operator, comma or bracket.');
  };
  PP.suite = function (kw, line) {
    if (!this.accept(':')) {
      var x = this.peek();
      if (x.k === 'op' && x.v === '=' && (kw === 'if' || kw === 'elif' || kw === 'while')) throw syn("invalid syntax. Maybe you meant '==' or ':=' instead of '='?", line, 'Use == to compare: ' + kw + ' x == 5:');
      throw syn("expected ':'", line, 'A line starting with ' + kw + ' must end with a colon (:).');
    }
    var body = [];
    if (this.peek().k !== 'nl') { this.simpleLine(body); return body; }
    this.next();
    if (this.peek().k !== 'indent') throw err('IndentationError', "expected an indented block after '" + kw + "' " + (kw === 'def' ? 'function definition' : kw === 'else' || kw === 'try' || kw === 'finally' || kw === 'except' ? 'statement' : 'statement') + ' on line ' + line, this.peek().line, 'Indent the lines inside the block by 4 spaces. Use pass for an empty block.');
    this.next();
    while (this.peek().k !== 'dedent' && this.peek().k !== 'eof') this.stmt(body);
    if (this.peek().k === 'dedent') this.next();
    return body;
  };
  PP.ifStmt = function () {
    var L = this.next().line, tests = [], orelse = null;
    var c = this.test(); tests.push({ cond: c, body: this.suite('if', L), line: L });
    for (;;) {
      var x = this.peek();
      if (x.k === 'kw' && x.v === 'elif') { this.next(); var ec = this.test(); tests.push({ cond: ec, body: this.suite('elif', x.line), line: x.line }); continue; }
      if (x.k === 'kw' && x.v === 'else') {
        this.next();
        if (this.is('if')) throw syn("expected ':'", x.line, 'Python writes "else if" as one word: elif x > 5:');
        orelse = this.suite('else', x.line);
      }
      break;
    }
    return { t: 'if', tests: tests, orelse: orelse, line: L };
  };
  PP.loopBody = function (kw, L) { this.c().loop++; var b = this.suite(kw, L); this.c().loop--; return b; };
  PP.elseClause = function () { if (this.is('else')) { var x = this.next(); return this.suite('else', x.line); } return null; };
  PP.whileStmt = function () {
    var L = this.next().line, c = this.test();
    var body = this.loopBody('while', L);
    return { t: 'while', cond: c, body: body, orelse: this.elseClause(), line: L };
  };
  PP.targetList = function () {
    var items = [this.orExprNoIn()];
    while (this.accept(',')) { if (this.is('in')) break; items.push(this.orExprNoIn()); }
    return items.length === 1 ? items[0] : { t: 'tuple', items: items };
  };
  PP.orExprNoIn = function () { return this.arith(); };
  PP.forStmt = function () {
    var L = this.next().line, tg = this.targetList(); this.checkTarget(tg, L); this.mark(tg);
    if (!this.accept('in')) throw syn('invalid syntax', L, "A for loop looks like: for item in items:  or  for i in range(10):");
    var it = this.testList(), body = this.loopBody('for', L);
    return { t: 'for', target: tg, iter: it, body: body, orelse: this.elseClause(), line: L };
  };
  PP.params = function () {
    var ps = [], seenDef = false;
    this.expect('(', 'A function definition looks like: def name(a, b):');
    if (!this.accept(')')) {
      do {
        if (this.is(')')) break;
        if (this.is('*') || this.is('**')) throw syn('*args and **kwargs are not supported in this simulator', this.peek().line);
        var nm = this.name('a parameter name'), d = null;
        if (this.accept(':')) this.test();
        if (this.accept('=')) { d = this.test(); seenDef = true; } else if (seenDef) throw syn('parameter without a default follows parameter with a default', this.peek().line, 'Put parameters that have defaults after the ones that do not.');
        ps.push({ name: nm, def: d });
      } while (this.accept(','));
      this.expect(')', 'Close the parameter list with ).');
    }
    return ps;
  };
  PP.defStmt = function () {
    var L = this.next().line, nm = this.name('a function name');
    this.c().assigned[nm] = true;
    var ps = this.params();
    if (this.accept('->')) this.test();
    var ctx = { assigned: {}, globals: {}, nonlocals: {}, loop: 0, fn: true };
    ps.forEach(function (p) { ctx.assigned[p.name] = true; });
    this.ctx.push(ctx);
    var body = this.suite('def', L);
    this.ctx.pop();
    var locals = {}; Object.keys(ctx.assigned).forEach(function (k) { if (!ctx.globals[k] && !ctx.nonlocals[k]) locals[k] = true; });
    return { t: 'def', name: nm, params: ps, body: body, locals: locals, globals: ctx.globals, nonlocals: ctx.nonlocals, line: L };
  };
  PP.tryStmt = function () {
    var L = this.next().line, body = this.suite('try', L), handlers = [], orelse = null, fin = null;
    while (this.is('except')) {
      var hl = this.next().line, types = null, nm = null;
      if (!this.is(':')) { types = this.test(); if (this.accept('as')) { nm = this.name('a name after as'); this.c().assigned[nm] = true; } }
      handlers.push({ types: types, name: nm, body: this.suite('except', hl), line: hl });
    }
    if (this.is('else') && handlers.length) { var el = this.next().line; orelse = this.suite('else', el); }
    if (this.is('finally')) { var fl = this.next().line; fin = this.suite('finally', fl); }
    if (!handlers.length && !fin) throw syn("expected 'except' or 'finally' block", this.peek().line, 'A try block must be followed by except ... : or finally:');
    return { t: 'try', body: body, handlers: handlers, orelse: orelse, fin: fin, line: L };
  };
  PP.small = function () {
    var x = this.peek(), L = x.line;
    if (x.k === 'kw') {
      switch (x.v) {
        case 'pass': this.next(); return { t: 'pass', line: L };
        case 'break': case 'continue':
          this.next(); if (!this.c().loop) throw syn("'" + x.v + "' outside loop", L, x.v + ' can only be used inside a for or while loop.');
          return { t: x.v, line: L };
        case 'return': {
          this.next(); if (!this.c().fn) throw syn("'return' outside function", L, 'return can only be used inside a def block.');
          var v = this.peek().k === 'nl' || this.is(';') || this.peek().k === 'eof' ? null : this.testList();
          return { t: 'return', value: v, line: L };
        }
        case 'global': case 'nonlocal': {
          this.next(); var names = [];
          do { var gn = this.name('a variable name'); if (this.c().assigned[gn] && x.v === 'global' && this.c().fn) throw syn("name '" + gn + "' is assigned to before global declaration", L, 'Put the global line at the very top of the function.'); names.push(gn); this.c()[x.v === 'global' ? 'globals' : 'nonlocals'][gn] = true; } while (this.accept(','));
          return { t: 'global', names: names, line: L };
        }
        case 'import': {
          this.next(); var mods = [];
          do { var mn = this.name('a module name'), as = mn; if (this.accept('as')) as = this.name('a name'); this.c().assigned[as] = true; mods.push({ name: mn, as: as }); } while (this.accept(','));
          return { t: 'import', mods: mods, line: L };
        }
        case 'from': {
          this.next(); var fm = this.name('a module name'); if (!this.accept('import')) throw syn('invalid syntax', L, 'For example: from random import randint');
          if (this.accept('*')) return { t: 'from', mod: fm, names: null, line: L };
          var paren = this.accept('('), fn = [];
          do { if (paren && this.is(')')) break; var a = this.name('a name to import'), b = a; if (this.accept('as')) b = this.name('a name'); this.c().assigned[b] = true; fn.push({ name: a, as: b }); } while (this.accept(','));
          if (paren) this.expect(')');
          return { t: 'from', mod: fm, names: fn, line: L };
        }
        case 'del': { this.next(); var tl = this.testList(); var dl = tl.t === 'tuple' ? tl.items : [tl]; dl.forEach(function (d) { if (d.t !== 'name' && d.t !== 'sub') throw syn('cannot delete ' + d.t, L); }); return { t: 'del', targets: dl, line: L }; }
        case 'assert': { this.next(); var ac = this.test(), am = null; if (this.accept(',')) am = this.test(); return { t: 'assert', cond: ac, msg: am, line: L }; }
        case 'raise': { this.next(); var re = this.peek().k === 'nl' || this.peek().k === 'eof' ? null : this.test(); return { t: 'raise', exc: re, line: L }; }
      }
    }
    var e = this.testList(true), y = this.peek();
    if (y.k === 'op' && y.v === ':' && (e.t === 'name' || e.t === 'sub' || e.t === 'attr')) {
      this.next(); this.test();
      if (this.accept('=')) { var av = this.testList(); this.checkTarget(e, L); this.mark(e); return { t: 'assign', targets: [e], value: av, line: L }; }
      return { t: 'pass', line: L };
    }
    if (y.k === 'op' && /^(\+|-|\*|\/|\/\/|%|\*\*)=$/.test(y.v)) {
      this.next(); if (e.t !== 'name' && e.t !== 'sub' && e.t !== 'attr') throw syn("'" + e.t + "' is an illegal expression for augmented assignment", L);
      var rv = this.testList(); this.mark(e);
      return { t: 'aug', target: e, op: y.v.slice(0, -1), value: rv, line: L };
    }
    if (y.k === 'op' && y.v === '=') {
      var parts = [e];
      while (this.accept('=')) parts.push(this.testList(true));
      var val = parts.pop();
      parts.forEach(function (p) { this.checkTarget(p, L); this.mark(p); }, this);
      return { t: 'assign', targets: parts, value: val, line: L };
    }
    if (e.t === 'name' && (e.id === 'else' || e.id === 'elif')) throw syn('invalid syntax', L);
    return { t: 'expr', value: e, line: L };
  };
  PP.testList = function (star) {
    var first = this.test(), items = [first];
    if (!this.is(',')) return first;
    while (this.accept(',')) {
      var x = this.peek();
      if (x.k === 'nl' || x.k === 'eof' || (x.k === 'op' && (x.v === '=' || x.v === ')' || x.v === ';' || /=$/.test(x.v) && x.v.length > 1 && x.v !== '==' && x.v !== '!=' && x.v !== '<=' && x.v !== '>='))) break;
      items.push(this.test());
    }
    return { t: 'tuple', items: items };
  };
  PP.test = function () {
    if (this.is('lambda')) {
      var L = this.next().line, ps = [];
      if (!this.is(':')) { do { var nm = this.name('a parameter name'), d = null; if (this.accept('=')) d = this.test(); ps.push({ name: nm, def: d }); } while (this.accept(',')); }
      this.expect(':', 'A lambda looks like: lambda x: x * 2');
      var locals = {}; ps.forEach(function (p) { locals[p.name] = true; });
      return { t: 'lambda', params: ps, body: this.test(), locals: locals, line: L };
    }
    var a = this.orTest();
    if (this.is('if') && !this.noTernary) {
      this.next(); var c = this.orTest();
      if (!this.accept('else')) throw syn("expected 'else' after 'if' expression", this.peek().line, 'A one-line if looks like: x if condition else y');
      return { t: 'ifexp', cond: c, a: a, b: this.test() };
    }
    return a;
  };
  PP.orTest = function () { var a = this.andTest(); while (this.accept('or')) a = { t: 'bool', op: 'or', a: a, b: this.andTest() }; return a; };
  PP.andTest = function () { var a = this.notTest(); while (this.accept('and')) a = { t: 'bool', op: 'and', a: a, b: this.notTest() }; return a; };
  PP.notTest = function () { if (this.accept('not')) return { t: 'not', a: this.notTest() }; return this.comparison(); };
  PP.comparison = function () {
    var a = this.bitOr(), ops = [], rest = [];
    for (;;) {
      var x = this.peek(), op = null;
      if (x.k === 'op' && ['<', '>', '==', '>=', '<=', '!='].indexOf(x.v) >= 0) { this.next(); op = x.v; }
      else if (x.k === 'kw' && x.v === 'in') { this.next(); op = 'in'; }
      else if (x.k === 'kw' && x.v === 'not' && this.is('in', 1)) { this.next(); this.next(); op = 'not in'; }
      else if (x.k === 'kw' && x.v === 'is') { this.next(); op = this.accept('not') ? 'is not' : 'is'; }
      else if (x.k === 'op' && x.v === '<' && this.is('>', 1)) throw syn('invalid syntax', x.line, 'Python writes "not equal" as !=');
      else break;
      ops.push(op); rest.push(this.bitOr());
    }
    return ops.length ? { t: 'cmp', a: a, ops: ops, rest: rest } : a;
  };
  PP.bitOr = function () {
    var a = this.arith();
    for (;;) { var x = this.peek(); if (x.k === 'op' && (x.v === '|' || x.v === '&' || x.v === '^' || x.v === '<<' || x.v === '>>')) { this.next(); a = { t: 'bin', op: x.v, a: a, b: this.arith() }; } else return a; }
  };
  PP.arith = function () { var a = this.term(); for (;;) { var x = this.peek(); if (x.k === 'op' && (x.v === '+' || x.v === '-')) { this.next(); a = { t: 'bin', op: x.v, a: a, b: this.term() }; } else return a; } };
  PP.term = function () { var a = this.factor(); for (;;) { var x = this.peek(); if (x.k === 'op' && (x.v === '*' || x.v === '/' || x.v === '//' || x.v === '%' || x.v === '@')) { this.next(); a = { t: 'bin', op: x.v, a: a, b: this.factor() }; } else return a; } };
  PP.factor = function () { var x = this.peek(); if (x.k === 'op' && (x.v === '-' || x.v === '+' || x.v === '~')) { this.next(); return { t: 'unary', op: x.v, a: this.factor() }; } return this.power(); };
  PP.power = function () { var a = this.atomExpr(); if (this.accept('**')) return { t: 'bin', op: '**', a: a, b: this.factor() }; return a; };
  PP.atomExpr = function () {
    var a = this.atom();
    for (;;) {
      if (this.accept('(')) a = this.callArgs(a);
      else if (this.accept('[')) a = this.subscript(a);
      else if (this.accept('.')) a = { t: 'attr', obj: a, name: this.name('an attribute name') };
      else return a;
    }
  };
  PP.callArgs = function (fn) {
    var args = [], kw = [], star = [];
    while (!this.is(')')) {
      if (this.accept('*')) { star.push(args.length); args.push(this.test()); }
      else if (this.accept('**')) throw syn('**kwargs are not supported in this simulator', this.peek().line);
      else if (this.peek().k === 'name' && this.is('=', 1)) { var k = this.next().v; this.next(); kw.push({ name: k, value: this.test() }); }
      else {
        if (kw.length) throw syn('positional argument follows keyword argument', this.peek().line, 'Put keyword arguments such as end="" after the normal arguments.');
        var a = this.test();
        if (this.is('for')) { a = this.comp('list', a, null); }
        args.push(a);
      }
      if (!this.accept(',')) break;
    }
    if (!this.accept(')')) { var x = this.peek(); throw syn(x.k === 'nl' || x.k === 'eof' ? "'(' was never closed" : 'invalid syntax. Perhaps you forgot a comma?', x.line, 'Separate arguments with commas and close the call with ).'); }
    return { t: 'call', fn: fn, args: args, kw: kw, star: star };
  };
  PP.subscript = function (obj) {
    var parts = [null, null, null], idx = 0, isSlice = false;
    if (!this.is(':')) parts[0] = this.testList();
    while (this.accept(':')) { isSlice = true; idx++; if (idx > 2) throw syn('invalid syntax', this.peek().line); if (!this.is(':') && !this.is(']')) parts[idx] = this.test(); }
    this.expect(']', 'Close the index with ].');
    if (isSlice) return { t: 'slice', obj: obj, lo: parts[0], hi: parts[1], step: parts[2] };
    return { t: 'sub', obj: obj, index: parts[0] };
  };
  PP.comp = function (kind, elt, val) {
    var clauses = [];
    while (this.is('for')) {
      this.next(); var tg = this.targetList(); this.checkTarget(tg, this.peek().line);
      if (!this.accept('in')) throw syn('invalid syntax', this.peek().line, 'A comprehension looks like [x * 2 for x in values]');
      this.noTernary = true; var it = this.orTest(); this.noTernary = false;
      clauses.push({ k: 'for', target: tg, iter: it });
      while (this.is('if')) { this.next(); this.noTernary = true; var c = this.orTest(); this.noTernary = false; clauses.push({ k: 'if', cond: c }); }
    }
    return { t: 'comp', kind: kind, elt: elt, val: val, clauses: clauses };
  };
  PP.atom = function () {
    var x = this.next(), L = x.line;
    switch (x.k) {
      case 'name': return { t: 'name', id: x.v };
      case 'num': return { t: 'const', v: x.v };
      case 'str': case 'fstr': {
        var parts = [], isF = false, cur = x;
        for (;;) {
          if (cur.k === 'fstr') { isF = true; parts = parts.concat(this.fparts(cur.v, cur.line, cur.raw)); }
          else parts.push({ lit: cur.v });
          var nx = this.peek(); if (nx.k === 'str' || nx.k === 'fstr') { cur = this.next(); continue; }
          break;
        }
        if (!isF) return { t: 'const', v: parts.map(function (p) { return p.lit; }).join('') };
        return { t: 'fstr', parts: parts };
      }
      case 'kw':
        if (x.v === 'True') return { t: 'const', v: true };
        if (x.v === 'False') return { t: 'const', v: false };
        if (x.v === 'None') return { t: 'const', v: null };
        throw syn('invalid syntax', L, "'" + x.v + "' is a keyword and cannot be used here.");
      case 'op':
        if (x.v === '(') {
          if (this.accept(')')) return { t: 'tuple', items: [] };
          var e = this.test();
          if (this.is('for')) { var g = this.comp('list', e, null); this.expect(')'); return g; }
          if (this.is(',')) { var items = [e]; while (this.accept(',')) { if (this.is(')')) break; items.push(this.test()); } this.expect(')', "Close the tuple with )."); return { t: 'tuple', items: items }; }
          this.expect(')', 'Every ( needs a matching ).'); return e;
        }
        if (x.v === '[') {
          if (this.accept(']')) return { t: 'list', items: [] };
          var f = this.test();
          if (this.is('for')) { var lc = this.comp('list', f, null); this.expect(']'); return lc; }
          var li = [f]; while (this.accept(',')) { if (this.is(']')) break; li.push(this.test()); }
          this.expect(']', 'Every [ needs a matching ]. Separate items with commas.'); return { t: 'list', items: li };
        }
        if (x.v === '{') {
          if (this.accept('}')) return { t: 'dict', keys: [], vals: [] };
          var k0 = this.test();
          if (this.accept(':')) {
            var v0 = this.test();
            if (this.is('for')) { var dc = this.comp('dict', k0, v0); this.expect('}'); return dc; }
            var ks = [k0], vs = [v0];
            while (this.accept(',')) { if (this.is('}')) break; ks.push(this.test()); this.expect(':', 'Dictionary items look like "key": value'); vs.push(this.test()); }
            this.expect('}', 'Every { needs a matching }.'); return { t: 'dict', keys: ks, vals: vs };
          }
          if (this.is('for')) { var sc = this.comp('set', k0, null); this.expect('}'); return sc; }
          var si = [k0]; while (this.accept(',')) { if (this.is('}')) break; si.push(this.test()); }
          this.expect('}', 'Every { needs a matching }.'); return { t: 'set', items: si };
        }
    }
    if (x.k === 'nl' || x.k === 'eof') throw syn('invalid syntax', L, 'The line ends too early. Something is missing after the last operator.');
    if (x.k === 'indent' || x.k === 'dedent') throw err('IndentationError', 'unexpected indent', L);
    throw syn('invalid syntax', L, 'Python did not expect ' + this.desc(x) + ' here.');
  };
  PP.fparts = function (s, L, raw) {
    var parts = [], i = 0, lit = '';
    while (i < s.length) {
      var c = s[i];
      if (c === '{' && s[i + 1] === '{') { lit += '{'; i += 2; continue; }
      if (c === '}' && s[i + 1] === '}') { lit += '}'; i += 2; continue; }
      if (c === '}') throw syn("f-string: single '}' is not allowed", L, 'Write }} for a literal } in an f-string.');
      if (c !== '{') { lit += c; i++; continue; }
      if (lit) { parts.push({ lit: raw ? lit : unescape(lit) }); lit = ''; }
      var j = i + 1, depth = 0, q = null, colon = -1, bang = -1;
      for (; j < s.length; j++) {
        var d = s[j];
        if (q) { if (d === q) q = null; continue; }
        if (d === '"' || d === "'") { q = d; continue; }
        if (d === '(' || d === '[' || d === '{') depth++;
        else if (d === ')' || d === ']') depth--;
        else if (d === '}') { if (depth === 0) break; depth--; }
        else if (d === '!' && depth === 0 && s[j + 1] !== '=' && colon < 0) bang = j;
        else if (d === ':' && depth === 0 && colon < 0) colon = j;
      }
      if (j >= s.length) throw syn("f-string: expecting '}'", L, 'Every { in an f-string needs a closing }.');
      var end = bang >= 0 ? bang : colon >= 0 ? colon : j, src = s.slice(i + 1, end), self = this;
      if (!src.trim()) throw syn('f-string: valid expression required before \'}\'', L, 'Put a variable or expression inside the braces, e.g. f"Total: {total}"');
      var dbg = /=\s*$/.test(src) && !/[=!<>]=\s*$/.test(src);
      if (dbg) src = src.replace(/=\s*$/, '');
      var sub = new Parser(tokenize(src.trim()).map(function (tk) { tk.line = L; return tk; }));
      sub.ctx = this.ctx;
      var ex = sub.testList();
      if (sub.peek().k !== 'nl' && sub.peek().k !== 'eof') throw syn('f-string: invalid syntax', L, 'Check the expression inside { }.');
      if (dbg) parts.push({ lit: src.trim() + '=' });
      parts.push({ expr: ex, conv: bang >= 0 ? s[bang + 1] : (dbg ? 'r' : null), spec: colon >= 0 ? s.slice(colon + 1, j) : '' });
      i = j + 1;
    }
    if (lit) parts.push({ lit: raw ? lit : unescape(lit) });
    void self;
    return parts;
  };
  function compile(code) {
    var p = new Parser(tokenize(code.replace(/\r/g, '')));
    return { body: p.file() };
  }

  /* ================= values ================= */
  function tup(a) { a.__t = true; return a; }
  function isTup(v) { return Array.isArray(v) && v.__t === true; }
  function isList(v) { return Array.isArray(v) && !v.__t; }
  function Dict() { this.m = new Map(); }
  function PSet() { this.m = new Map(); }
  function Range(a, b, s) { this.start = a; this.stop = b; this.step = s; }
  Range.prototype.len = function () { var a = this.start, b = this.stop, s = this.step; var n = s > 0n ? (b - a + s - 1n) / s : (a - b - s - 1n) / -s; return n > 0n ? n : 0n; };
  function isInt(v) { return typeof v === 'bigint' || typeof v === 'boolean'; }
  function isNum(v) { return typeof v === 'bigint' || typeof v === 'number' || typeof v === 'boolean'; }
  function big(v) { return typeof v === 'boolean' ? (v ? 1n : 0n) : v; }
  function typeName(v) {
    if (v === null || v === undefined) return 'NoneType';
    switch (typeof v) { case 'bigint': return 'int'; case 'number': return 'float'; case 'boolean': return 'bool'; case 'string': return 'str'; }
    if (Array.isArray(v)) return v.__t ? 'tuple' : 'list';
    if (v instanceof Dict) return 'dict';
    if (v instanceof PSet) return 'set';
    if (v instanceof Range) return 'range';
    if (v.pyfn) return 'function';
    if (v.bi) return v.isType ? 'type' : 'builtin_function_or_method';
    if (v.mod) return 'module';
    if (v.excCls) return 'type';
    if (v.exc) return v.type;
    return 'object';
  }
  function hkey(k) {
    switch (typeof k) {
      case 'bigint': return 'n' + k;
      case 'boolean': return 'n' + (k ? 1 : 0);
      case 'number': return Number.isInteger(k) ? 'n' + k : 'f' + k;
      case 'string': return 's' + k;
    }
    if (k === null) return 'N';
    if (isTup(k)) return 't(' + k.map(hkey).join(',') + ')';
    var e = new Error('unhashable'); e.unhashable = typeName(k); throw e;
  }
  function floatRepr(x) {
    if (isNaN(x)) return 'nan';
    if (!isFinite(x)) return x > 0 ? 'inf' : '-inf';
    if (Object.is(x, -0)) return '-0.0';
    var a = Math.abs(x);
    if (Number.isInteger(x) && a < 1e16) return x.toFixed(1);
    if (a >= 1e16 || (a < 1e-4 && a > 0)) {
      var s = x.toExponential();
      return s.replace(/e([+-])(\d)$/, 'e$10$2');
    }
    return String(x);
  }
  function strRepr(s) {
    var q = s.indexOf("'") >= 0 && s.indexOf('"') < 0 ? '"' : "'";
    return q + s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\t/g, '\\t').replace(/\r/g, '\\r').replace(new RegExp(q, 'g'), '\\' + q) + q;
  }
  function repr(v, depth) {
    depth = depth || 0;
    if (depth > 20) return '...';
    if (v === null || v === undefined) return 'None';
    switch (typeof v) {
      case 'boolean': return v ? 'True' : 'False';
      case 'bigint': return v.toString();
      case 'number': return floatRepr(v);
      case 'string': return strRepr(v);
    }
    if (Array.isArray(v)) {
      var inner = v.map(function (x) { return x === v ? (v.__t ? '(...)' : '[...]') : repr(x, depth + 1); }).join(', ');
      return v.__t ? '(' + inner + (v.length === 1 ? ',' : '') + ')' : '[' + inner + ']';
    }
    if (v instanceof Dict) { var it = []; v.m.forEach(function (kv) { it.push(repr(kv[0], depth + 1) + ': ' + repr(kv[1], depth + 1)); }); return '{' + it.join(', ') + '}'; }
    if (v instanceof PSet) { if (!v.m.size) return 'set()'; var si = []; v.m.forEach(function (x) { si.push(repr(x, depth + 1)); }); return '{' + si.join(', ') + '}'; }
    if (v instanceof Range) return 'range(' + v.start + ', ' + v.stop + (v.step !== 1n ? ', ' + v.step : '') + ')';
    if (v.pyfn) return '<function ' + v.name + '>';
    if (v.bi) return v.isType ? "<class '" + v.name + "'>" : '<built-in function ' + v.name + '>';
    if (v.mod) return "<module '" + v.name + "'>";
    if (v.excCls) return "<class '" + v.name + "'>";
    if (v.exc) return v.type + '(' + (v.msg ? strRepr(v.msg) : '') + ')';
    return '<object>';
  }
  function str(v) { if (typeof v === 'string') return v; if (v && v.exc) return v.msg; return repr(v); }
  function truthy(v) {
    if (v === null || v === undefined || v === false) return false;
    switch (typeof v) { case 'bigint': return v !== 0n; case 'number': return v !== 0; case 'string': return v.length > 0; case 'boolean': return v; }
    if (Array.isArray(v)) return v.length > 0;
    if (v instanceof Dict || v instanceof PSet) return v.m.size > 0;
    if (v instanceof Range) return v.len() > 0n;
    return true;
  }
  function eq(a, b) {
    if (isNum(a) && isNum(b)) { if (isInt(a) && isInt(b)) return big(a) === big(b); return Number(a) === Number(b); }
    if (typeof a === 'string' || typeof b === 'string') return a === b;
    if (Array.isArray(a) && Array.isArray(b)) { if (!!a.__t !== !!b.__t || a.length !== b.length) return false; for (var i = 0; i < a.length; i++) if (!eq(a[i], b[i])) return false; return true; }
    if (a instanceof Dict && b instanceof Dict) { if (a.m.size !== b.m.size) return false; var ok = true; a.m.forEach(function (kv, k) { var o = b.m.get(k); if (!o || !eq(kv[1], o[1])) ok = false; }); return ok; }
    if (a instanceof PSet && b instanceof PSet) { if (a.m.size !== b.m.size) return false; var ok2 = true; a.m.forEach(function (x, k) { if (!b.m.has(k)) ok2 = false; }); return ok2; }
    if (a instanceof Range && b instanceof Range) return a.start === b.start && a.stop === b.stop && a.step === b.step;
    return a === b;
  }
  function fmtGroup(intPart, sep) { return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, sep); }
  function format(v, spec, L) {
    if (!spec) return str(v);
    var m = /^(?:([\s\S])?([<>^=]))?([+\- ])?(#)?(0)?(\d+)?([,_])?(?:\.(\d+))?([bcdeEfFgGnosxX%])?$/.exec(spec);
    if (!m) throw err('ValueError', 'Invalid format specifier', L, 'Common formats: {x:.2f} for 2 decimal places, {x:5} for width 5, {x:,} for thousands.');
    var fill = m[1] || (m[5] && !m[2] ? '0' : ' '), align = m[2] || (m[5] ? '=' : null), sign = m[3] || '-', width = m[6] ? +m[6] : 0, group = m[7], prec = m[8] !== undefined ? +m[8] : null, type = m[9] || '', s, numeric = isNum(v) && typeof v !== 'boolean' || (typeof v === 'boolean' && type);
    if (numeric) {
      var neg, body;
      if (type === 'd' || type === 'n' || type === 'b' || type === 'o' || type === 'x' || type === 'X' || type === 'c') {
        if (!isInt(v)) throw err('ValueError', "Unknown format code '" + type + "' for object of type 'float'", L, 'Use :.0f to show a float with no decimals, or convert with int(...).');
        var bv = big(v); neg = bv < 0n; var ab = neg ? -bv : bv;
        body = type === 'b' ? ab.toString(2) : type === 'o' ? ab.toString(8) : type === 'x' ? ab.toString(16) : type === 'X' ? ab.toString(16).toUpperCase() : type === 'c' ? String.fromCharCode(Number(ab)) : ab.toString();
        if (group) body = fmtGroup(body, group);
      } else if (type === '' && isInt(v)) {
        var bi = big(v); neg = bi < 0n; body = (neg ? -bi : bi).toString(); if (group) body = fmtGroup(body, group);
      } else {
        var x = Number(v); neg = x < 0 || Object.is(x, -0); x = Math.abs(x);
        if (type === 'f' || type === 'F') body = x.toFixed(prec === null ? 6 : prec);
        else if (type === '%') body = (x * 100).toFixed(prec === null ? 6 : prec) + '%';
        else if (type === 'e' || type === 'E') { body = x.toExponential(prec === null ? 6 : prec).replace(/e([+-])(\d)$/, 'e$10$2'); if (type === 'E') body = body.toUpperCase(); }
        else if (type === 'g' || type === 'G' || prec !== null) { body = String(parseFloat(x.toPrecision(prec === null ? 6 : Math.max(prec, 1)))); }
        else body = floatRepr(x);
        if (group) { var pp = body.split('.'); pp[0] = fmtGroup(pp[0], group); body = pp.join('.'); }
      }
      var sg = neg ? '-' : sign === '+' ? '+' : sign === ' ' ? ' ' : '';
      if (m[4] && (type === 'b' || type === 'o' || type === 'x' || type === 'X')) sg += '0' + type.toLowerCase();
      s = sg + body;
      if (width > s.length) {
        var padN = width - s.length, a2 = align || '>';
        if (a2 === '=') s = sg + new Array(padN + 1).join(fill) + body;
        else s = pad(s, width, fill, a2);
      }
      return s;
    }
    if (type && type !== 's') throw err('ValueError', "Unknown format code '" + type + "' for object of type '" + typeName(v) + "'", L, typeof v === 'string' ? 'The value is text. If it came from input(), convert it with int(...) or float(...) first.' : '');
    s = str(v);
    if (prec !== null) s = s.slice(0, prec);
    return width > s.length ? pad(s, width, fill, align || '<') : s;
  }
  function pad(s, w, fill, align) {
    var n = w - s.length; if (n <= 0) return s;
    var f = function (k) { return new Array(k + 1).join(fill); };
    if (align === '<') return s + f(n);
    if (align === '^') return f(Math.floor(n / 2)) + s + f(n - Math.floor(n / 2));
    return f(n) + s;
  }

  /* ================= builtins ================= */
  var EXC_PARENT = { Exception: 'BaseException', ArithmeticError: 'Exception', ZeroDivisionError: 'ArithmeticError', OverflowError: 'ArithmeticError', LookupError: 'Exception', IndexError: 'LookupError', KeyError: 'LookupError', ValueError: 'Exception', TypeError: 'Exception', NameError: 'Exception', UnboundLocalError: 'NameError', AttributeError: 'Exception', RuntimeError: 'Exception', RecursionError: 'RuntimeError', EOFError: 'Exception', AssertionError: 'Exception', StopIteration: 'Exception', ImportError: 'Exception', ModuleNotFoundError: 'ImportError', NotImplementedError: 'RuntimeError', KeyboardInterrupt: 'BaseException', SystemExit: 'BaseException' };
  function excMatch(type, cls) { for (var t = type; t; t = EXC_PARENT[t]) if (t === cls) return true; return false; }
  function argc(name, a, min, max) {
    if (a.length < min || a.length > max) {
      throw err('TypeError', min === max ? name + '() takes ' + (min === 0 ? 'no arguments' : 'exactly ' + min + ' argument' + (min === 1 ? '' : 's')) + ' (' + a.length + ' given)' : name + '() expected ' + (a.length < min ? 'at least ' + min : 'at most ' + max) + ' arguments, got ' + a.length, null);
    }
  }
  function bi(name, f, opts) { var o = { bi: true, name: name, f: f }; if (opts) for (var k in opts) o[k] = opts[k]; return o; }
  function toArr(v, L, what) {
    if (Array.isArray(v)) return v.slice();
    if (typeof v === 'string') return v.split('');
    if (v instanceof Dict) { var k = []; v.m.forEach(function (kv) { k.push(kv[0]); }); return k; }
    if (v instanceof PSet) { var s = []; v.m.forEach(function (x) { s.push(x); }); return s; }
    if (v instanceof Range) { var r = [], n = v.len(); if (n > 1000000n) throw err('MemoryError', 'range is too large for this simulator', L); for (var i = 0n; i < n; i++) r.push(v.start + i * v.step); return r; }
    throw err('TypeError', "'" + typeName(v) + "' object is not iterable", L, typeName(v) === 'int' ? 'To loop a number of times, use range(...): for i in range(n):' : what ? what + ' needs a list, string, range or other sequence.' : '');
  }
  function* iterate(v, L) {
    if (v instanceof Range) { var n = v.len(); for (var i = 0n; i < n; i++) yield v.start + i * v.step; return; }
    if (isList(v)) { for (var j = 0; j < v.length; j++) yield v[j]; return; }
    var a = toArr(v, L); for (var k = 0; k < a.length; k++) yield a[k];
  }
  function toInt(v, L, base) {
    if (typeof v === 'string') {
      var s = v.trim().replace(/_/g, ''), b = base === undefined ? 10 : Number(base);
      var re = b === 10 ? /^[+-]?\d+$/ : b === 2 ? /^[+-]?(0b)?[01]+$/i : b === 16 ? /^[+-]?(0x)?[0-9a-f]+$/i : b === 8 ? /^[+-]?(0o)?[0-7]+$/i : null;
      if (!re) throw err('ValueError', 'int() base must be 2, 8, 10 or 16 in this simulator', L);
      if (!re.test(s)) throw err('ValueError', "invalid literal for int() with base " + b + ': ' + strRepr(v), L, /^[+-]?\d*\.\d+$/.test(s) ? 'The text has a decimal point. Use float(...) instead, or int(float(...)).' : s === '' ? 'The input was empty. Type a number before pressing Enter.' : 'The text is not a whole number.');
      var neg = s[0] === '-'; s = s.replace(/^[+-]/, '').replace(/^0[bxo]/i, '');
      var r = b === 10 ? BigInt(s) : BigInt((b === 2 ? '0b' : b === 16 ? '0x' : '0o') + s);
      return neg ? -r : r;
    }
    if (typeof v === 'number') { if (!isFinite(v)) throw err(isNaN(v) ? 'ValueError' : 'OverflowError', 'cannot convert float ' + floatRepr(v) + ' to integer', L); return BigInt(Math.trunc(v)); }
    if (isInt(v)) return big(v);
    throw err('TypeError', "int() argument must be a string or a number, not '" + typeName(v) + "'", L);
  }
  function toFloat(v, L) {
    if (typeof v === 'string') {
      var s = v.trim().toLowerCase().replace(/_/g, '');
      if (/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/.test(s)) return parseFloat(s);
      if (/^[+-]?(inf|infinity)$/.test(s)) return s[0] === '-' ? -Infinity : Infinity;
      if (/^[+-]?nan$/.test(s)) return NaN;
      throw err('ValueError', 'could not convert string to float: ' + strRepr(v), L, v.trim() === '' ? 'The input was empty.' : 'The text is not a number.');
    }
    if (isNum(v)) return Number(big(v));
    throw err('TypeError', "float() argument must be a string or a real number, not '" + typeName(v) + "'", L);
  }
  function len(v, L) {
    if (typeof v === 'string' || Array.isArray(v)) return BigInt(v.length);
    if (v instanceof Dict || v instanceof PSet) return BigInt(v.m.size);
    if (v instanceof Range) return v.len();
    throw err('TypeError', "object of type '" + typeName(v) + "' has no len()", L, typeName(v) === 'int' || typeName(v) === 'float' ? 'len() counts items in a string or list. To count digits, use len(str(x)).' : '');
  }
  function compare(op, a, b, L) {
    if (isNum(a) && isNum(b)) {
      var x = isInt(a) && isInt(b) ? big(a) : Number(big(a)), y = isInt(a) && isInt(b) ? big(b) : Number(big(b));
      return op === '<' ? x < y : op === '>' ? x > y : op === '<=' ? x <= y : x >= y;
    }
    if (typeof a === 'string' && typeof b === 'string') return op === '<' ? a < b : op === '>' ? a > b : op === '<=' ? a <= b : a >= b;
    if (Array.isArray(a) && Array.isArray(b) && !!a.__t === !!b.__t) {
      for (var i = 0; i < a.length && i < b.length; i++) if (!eq(a[i], b[i])) return compare(op, a[i], b[i], L);
      return compare(op, BigInt(a.length), BigInt(b.length), L);
    }
    var ta = typeName(a), tb = typeName(b);
    throw err('TypeError', "'" + op + "' not supported between instances of '" + ta + "' and '" + tb + "'", L, (ta === 'str' || tb === 'str') && (isNum(a) || isNum(b)) ? 'One value is text. input() always gives text, so convert it: int(input(...)) or float(input(...)).' : ta === 'NoneType' || tb === 'NoneType' ? 'One value is None. Check that the function you called has a return statement.' : '');
  }
  function sortArr(arr, keys, rev, L) {
    var idx = arr.map(function (_, i) { return i; });
    idx.sort(function (i, j) { var a = keys[i], b = keys[j]; if (eq(a, b)) return i - j; var lt = compare('<', a, b, L); return rev ? (lt ? 1 : -1) : (lt ? -1 : 1); });
    return idx.map(function (i) { return arr[i]; });
  }
  function* keysFor(rt, arr, key, L) {
    if (!key || key === null) return arr;
    var out = []; for (var i = 0; i < arr.length; i++) { var k = yield* rt.callValue(key, [arr[i]], {}, L); out.push(k); }
    return out;
  }
  function kwArg(kw, name, def) { return has(kw, name) ? kw[name] : def; }
  function noKw(name, kw, L) { var k = Object.keys(kw); if (k.length) throw err('TypeError', name + "() got an unexpected keyword argument '" + k[0] + "'", L); }
  function roundHalfEven(x) { var r = Math.round(x); if (Math.abs(x % 1) === 0.5) r = 2 * Math.round(x / 2); return r; }

  var B = {};
  B.print = bi('print', function (a, kw, L, rt) {
    var sep = kwArg(kw, 'sep', ' '), end = kwArg(kw, 'end', '\n');
    if (sep === null) sep = ' '; if (end === null) end = '\n';
    if (typeof sep !== 'string') throw err('TypeError', 'sep must be None or a string, not ' + typeName(sep), L);
    if (typeof end !== 'string') throw err('TypeError', 'end must be None or a string, not ' + typeName(end), L);
    rt.write(a.map(str).join(sep) + end, L); return null;
  });
  B.input = bi('input', function* (a, kw, L) { argc('input', a, 0, 1); return yield* this.readLine(a.length ? str(a[0]) : '', L); }, { gen: true });
  B.int = bi('int', function (a, kw, L) { argc('int', a, 0, 2); return a.length ? toInt(a[0], L, a[1] !== undefined ? a[1] : kwArg(kw, 'base', undefined)) : 0n; }, { isType: true });
  B.float = bi('float', function (a, kw, L) { argc('float', a, 0, 1); return a.length ? toFloat(a[0], L) : 0; }, { isType: true });
  B.str = bi('str', function (a, kw, L) { argc('str', a, 0, 1); return a.length ? str(a[0]) : ''; }, { isType: true });
  B.bool = bi('bool', function (a, kw, L) { argc('bool', a, 0, 1); return a.length ? truthy(a[0]) : false; }, { isType: true });
  B.list = bi('list', function (a, kw, L) { argc('list', a, 0, 1); return a.length ? toArr(a[0], L, 'list()') : []; }, { isType: true });
  B.tuple = bi('tuple', function (a, kw, L) { argc('tuple', a, 0, 1); return tup(a.length ? toArr(a[0], L, 'tuple()') : []); }, { isType: true });
  B.dict = bi('dict', function (a, kw, L) {
    var d = new Dict();
    if (a.length) { if (a[0] instanceof Dict) a[0].m.forEach(function (kv, k) { d.m.set(k, [kv[0], kv[1]]); }); else toArr(a[0], L).forEach(function (p) { var pa = toArr(p, L); if (pa.length !== 2) throw err('ValueError', 'dictionary update sequence element has length ' + pa.length + '; 2 is required', L); dictSet(d, pa[0], pa[1], L); }); }
    Object.keys(kw).forEach(function (k) { dictSet(d, k, kw[k], L); });
    return d;
  }, { isType: true });
  B.set = bi('set', function (a, kw, L) { var s = new PSet(); if (a.length) toArr(a[0], L).forEach(function (x) { setAdd(s, x, L); }); return s; }, { isType: true });
  B.len = bi('len', function (a, kw, L) { argc('len', a, 1, 1); return len(a[0], L); });
  B.range = bi('range', function (a, kw, L) {
    argc('range', a, 1, 3); a.forEach(function (x) { if (!isInt(x)) throw err('TypeError', "'" + typeName(x) + "' object cannot be interpreted as an integer", L, typeof x === 'string' ? 'The value is text. Convert it with int(...) first.' : 'range() needs whole numbers. Use int(...) to convert.'); });
    var s = a.length === 3 ? big(a[2]) : 1n; if (s === 0n) throw err('ValueError', 'range() arg 3 must not be zero', L);
    return a.length === 1 ? new Range(0n, big(a[0]), 1n) : new Range(big(a[0]), big(a[1]), s);
  }, { isType: true });
  B.abs = bi('abs', function (a, kw, L) { argc('abs', a, 1, 1); var v = a[0]; if (!isNum(v)) throw err('TypeError', "bad operand type for abs(): '" + typeName(v) + "'", L); if (isInt(v)) { v = big(v); return v < 0n ? -v : v; } return Math.abs(v); });
  B.round = bi('round', function (a, kw, L) {
    argc('round', a, 1, 2); var v = a[0], nd = a.length > 1 ? a[1] : kwArg(kw, 'ndigits', null);
    if (!isNum(v)) throw err('TypeError', "type " + typeName(v) + " doesn't define __round__ method", L, typeof v === 'string' ? 'Convert the text to a number first with float(...).' : '');
    if (nd === null) return isInt(v) ? big(v) : BigInt(roundHalfEven(v));
    if (isInt(v)) return big(v);
    var n = Number(big(nd)); if (n >= 0) return parseFloat(v.toFixed(Math.min(n, 100))); var p = Math.pow(10, -n); return Math.round(v / p) * p;
  });
  function minmax(name, pick) {
    return bi(name, function* (a, kw, L) {
      var items = a.length === 1 ? toArr(a[0], L, name + '()') : a.slice(), key = kwArg(kw, 'key', null);
      if (!items.length) { if (has(kw, 'default')) return kw['default']; throw err('ValueError', name + '() arg is an empty sequence', L, 'The list is empty. Check it has items before calling ' + name + '().'); }
      var ks = yield* keysFor(this, items, key, L), best = 0;
      for (var i = 1; i < items.length; i++) if (compare(pick, ks[i], ks[best], L)) best = i;
      return items[best];
    }, { gen: true });
  }
  B.min = minmax('min', '<'); B.max = minmax('max', '>');
  B.sum = bi('sum', function (a, kw, L) {
    argc('sum', a, 1, 2); var acc = a.length > 1 ? a[1] : kwArg(kw, 'start', 0n);
    toArr(a[0], L, 'sum()').forEach(function (x) { if (!isNum(x)) throw err('TypeError', "unsupported operand type(s) for +: '" + typeName(acc) + "' and '" + typeName(x) + "'", L, typeof x === 'string' ? 'The list holds text. Convert each item with int(...) or float(...).' : ''); acc = arith('+', acc, x, L); });
    return acc;
  });
  B.sorted = bi('sorted', function* (a, kw, L) { argc('sorted', a, 1, 1); var arr = toArr(a[0], L, 'sorted()'); var ks = yield* keysFor(this, arr, kwArg(kw, 'key', null), L); return sortArr(arr, ks, truthy(kwArg(kw, 'reverse', false)), L); }, { gen: true });
  B.reversed = bi('reversed', function (a, kw, L) { argc('reversed', a, 1, 1); return toArr(a[0], L).reverse(); });
  B.enumerate = bi('enumerate', function (a, kw, L) { argc('enumerate', a, 1, 2); var st = big(a.length > 1 ? a[1] : kwArg(kw, 'start', 0n)); return toArr(a[0], L, 'enumerate()').map(function (x, i) { return tup([st + BigInt(i), x]); }); });
  B.zip = bi('zip', function (a, kw, L) { var arrs = a.map(function (x) { return toArr(x, L, 'zip()'); }), n = arrs.length ? Math.min.apply(null, arrs.map(function (x) { return x.length; })) : 0, out = []; for (var i = 0; i < n; i++) out.push(tup(arrs.map(function (x) { return x[i]; }))); return out; });
  B.map = bi('map', function* (a, kw, L) { argc('map', a, 2, 2); var arr = toArr(a[1], L, 'map()'), out = []; for (var i = 0; i < arr.length; i++) { var v = yield* this.callValue(a[0], [arr[i]], {}, L); out.push(v); } return out; }, { gen: true });
  B.filter = bi('filter', function* (a, kw, L) { argc('filter', a, 2, 2); var arr = toArr(a[1], L, 'filter()'), out = []; for (var i = 0; i < arr.length; i++) { var v = a[0] === null ? arr[i] : yield* this.callValue(a[0], [arr[i]], {}, L); if (truthy(v)) out.push(arr[i]); } return out; }, { gen: true });
  B.any = bi('any', function (a, kw, L) { argc('any', a, 1, 1); return toArr(a[0], L).some(truthy); });
  B.all = bi('all', function (a, kw, L) { argc('all', a, 1, 1); return toArr(a[0], L).every(truthy); });
  B.ord = bi('ord', function (a, kw, L) { argc('ord', a, 1, 1); if (typeof a[0] !== 'string' || a[0].length !== 1) throw err('TypeError', 'ord() expected a character, but ' + (typeof a[0] === 'string' ? 'string of length ' + a[0].length : typeName(a[0]) + ' was') + ' found', L, 'ord() takes a single character, e.g. ord("A") is 65.'); return BigInt(a[0].charCodeAt(0)); });
  B.chr = bi('chr', function (a, kw, L) { argc('chr', a, 1, 1); if (!isInt(a[0])) throw err('TypeError', "'" + typeName(a[0]) + "' object cannot be interpreted as an integer", L); return String.fromCharCode(Number(big(a[0]))); });
  B.bin = bi('bin', function (a, kw, L) { argc('bin', a, 1, 1); if (!isInt(a[0])) throw err('TypeError', "'" + typeName(a[0]) + "' object cannot be interpreted as an integer", L); var v = big(a[0]); return (v < 0n ? '-0b' : '0b') + (v < 0n ? -v : v).toString(2); });
  B.hex = bi('hex', function (a, kw, L) { argc('hex', a, 1, 1); if (!isInt(a[0])) throw err('TypeError', "'" + typeName(a[0]) + "' object cannot be interpreted as an integer", L); var v = big(a[0]); return (v < 0n ? '-0x' : '0x') + (v < 0n ? -v : v).toString(16); });
  B.oct = bi('oct', function (a, kw, L) { argc('oct', a, 1, 1); var v = big(a[0]); return (v < 0n ? '-0o' : '0o') + (v < 0n ? -v : v).toString(8); });
  B.divmod = bi('divmod', function (a, kw, L) { argc('divmod', a, 2, 2); return tup([arith('//', a[0], a[1], L), arith('%', a[0], a[1], L)]); });
  B.pow = bi('pow', function (a, kw, L) { argc('pow', a, 2, 3); var r = arith('**', a[0], a[1], L); return a.length > 2 ? arith('%', r, a[2], L) : r; });
  B.type = bi('type', function (a, kw, L) { argc('type', a, 1, 1); var tn = typeName(a[0]); return B[tn] && B[tn].isType ? B[tn] : bi(tn, null, { isType: true }); }, { isType: true });
  B.isinstance = bi('isinstance', function (a, kw, L) {
    argc('isinstance', a, 2, 2); var types = isTup(a[1]) ? a[1] : [a[1]], tn = typeName(a[0]);
    return types.some(function (t) { if (!t || !t.isType && !t.excCls) throw err('TypeError', 'isinstance() arg 2 must be a type or tuple of types', L); return t.name === tn || (t.name === 'int' && tn === 'bool') || (t.excCls && a[0] && a[0].exc && excMatch(a[0].type, t.name)); });
  });
  B.exit = B.quit = bi('exit', function () { var e = new Error('exit'); e.sysExit = true; throw e; });
  B.id = bi('id', function (a) { return 140000000000n; });
  Object.keys(EXC_PARENT).forEach(function (n) { B[n] = { excCls: true, name: n }; });
  B.BaseException = { excCls: true, name: 'BaseException' };

  var MODS = {
    random: function () {
      var R = {};
      var rint = function (a, b) { var lo = Number(big(a)), hi = Number(big(b)); return BigInt(lo + Math.floor(Math.random() * (hi - lo + 1))); };
      R.randint = bi('randint', function (a, kw, L) { argc('randint', a, 2, 2); if (!isInt(a[0]) || !isInt(a[1])) throw err('TypeError', 'randint() needs whole numbers', L, 'For example random.randint(1, 6)'); if (big(a[1]) < big(a[0])) throw err('ValueError', 'empty range in randint(' + a[0] + ', ' + a[1] + ')', L, 'The first number must not be bigger than the second.'); return rint(a[0], a[1]); });
      R.random = bi('random', function (a) { argc('random', a, 0, 0); return Math.random(); });
      R.uniform = bi('uniform', function (a, kw, L) { argc('uniform', a, 2, 2); var x = Number(big(a[0])), y = Number(big(a[1])); return x + Math.random() * (y - x); });
      R.choice = bi('choice', function (a, kw, L) { argc('choice', a, 1, 1); var arr = toArr(a[0], L, 'choice()'); if (!arr.length) throw err('IndexError', 'Cannot choose from an empty sequence', L); return arr[Math.floor(Math.random() * arr.length)]; });
      R.shuffle = bi('shuffle', function (a, kw, L) { argc('shuffle', a, 1, 1); var x = a[0]; if (!isList(x)) throw err('TypeError', 'shuffle() needs a list', L); for (var i = x.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = x[i]; x[i] = x[j]; x[j] = t; } return null; });
      R.randrange = bi('randrange', function (a, kw, L) { argc('randrange', a, 1, 3); var r = B.range.f(a, {}, L), n = r.len(); if (n <= 0n) throw err('ValueError', 'empty range for randrange()', L); return r.start + BigInt(Math.floor(Math.random() * Number(n))) * r.step; });
      R.sample = bi('sample', function (a, kw, L) { argc('sample', a, 2, 2); var arr = toArr(a[0], L), k = Number(big(a[1])); if (k > arr.length || k < 0) throw err('ValueError', 'Sample larger than population or is negative', L); for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr.slice(0, k); });
      R.seed = bi('seed', function () { return null; });
      return R;
    },
    math: function () {
      var M = {}, f1 = function (n, fn) { M[n] = bi(n, function (a, kw, L) { argc(n, a, 1, 1); if (!isNum(a[0])) throw err('TypeError', 'must be real number, not ' + typeName(a[0]), L, typeof a[0] === 'string' ? 'Convert the text with float(...) first.' : ''); return fn(Number(big(a[0])), L, a[0]); }); };
      f1('sqrt', function (x, L) { if (x < 0) throw err('ValueError', 'math domain error', L, 'You cannot take the square root of a negative number.'); return Math.sqrt(x); });
      f1('floor', function (x, L, o) { return isInt(o) ? big(o) : BigInt(Math.floor(x)); });
      f1('ceil', function (x, L, o) { return isInt(o) ? big(o) : BigInt(Math.ceil(x)); });
      f1('trunc', function (x, L, o) { return isInt(o) ? big(o) : BigInt(Math.trunc(x)); });
      f1('fabs', function (x) { return Math.abs(x); });
      f1('sin', Math.sin); f1('cos', Math.cos); f1('tan', Math.tan); f1('exp', Math.exp);
      f1('radians', function (x) { return x * Math.PI / 180; }); f1('degrees', function (x) { return x * 180 / Math.PI; });
      f1('log10', function (x, L) { if (x <= 0) throw err('ValueError', 'math domain error', L); return Math.log10(x); });
      f1('log2', function (x, L) { if (x <= 0) throw err('ValueError', 'math domain error', L); return Math.log2(x); });
      f1('isqrt', function (x, L, o) { if (!isInt(o)) throw err('TypeError', "'float' object cannot be interpreted as an integer", L); return BigInt(Math.floor(Math.sqrt(x))); });
      M.log = bi('log', function (a, kw, L) { argc('log', a, 1, 2); var x = Number(big(a[0])); if (x <= 0) throw err('ValueError', 'math domain error', L); return a.length > 1 ? Math.log(x) / Math.log(Number(big(a[1]))) : Math.log(x); });
      M.pow = bi('pow', function (a, kw, L) { argc('pow', a, 2, 2); return Math.pow(Number(big(a[0])), Number(big(a[1]))); });
      M.gcd = bi('gcd', function (a, kw, L) { var g = 0n; a.forEach(function (v) { v = big(v); if (v < 0n) v = -v; var x = g; while (v) { var t = x % v; x = v; v = t; } g = x; }); return g; });
      M.pi = Math.PI; M.e = Math.E; M.inf = Infinity; M.tau = 2 * Math.PI;
      return M;
    },
    time: function () {
      return { sleep: bi('sleep', function () { return null; }), time: bi('time', function () { return Date.now() / 1000; }) };
    }
  };

  /* ================= operators ================= */
  function arith(op, a, b, L) {
    if (isNum(a) && isNum(b)) {
      if (isInt(a) && isInt(b) && op !== '/') {
        var x = big(a), y = big(b);
        switch (op) {
          case '+': return x + y; case '-': return x - y; case '*': return x * y;
          case '//': if (y === 0n) throw err('ZeroDivisionError', 'integer division or modulo by zero', L, 'Check the divisor is not 0 before dividing.'); var q = x / y; if ((x % y !== 0n) && ((x < 0n) !== (y < 0n))) q -= 1n; return q;
          case '%': if (y === 0n) throw err('ZeroDivisionError', 'integer modulo by zero', L, 'Check the divisor is not 0 before using %.'); var r = x % y; if (r !== 0n && ((r < 0n) !== (y < 0n))) r += y; return r;
          case '**': if (y < 0n) return Math.pow(Number(x), Number(y)); if (y > 100000n && (x > 1n || x < -1n)) throw err('OverflowError', 'result too large for this simulator', L); return x ** y;
          case '&': return x & y; case '|': return x | y; case '^': return x ^ y; case '<<': return x << y; case '>>': return x >> y;
        }
      }
      var p = Number(big(a)), s = Number(big(b));
      switch (op) {
        case '+': return p + s; case '-': return p - s; case '*': return p * s;
        case '/': if (s === 0) throw err('ZeroDivisionError', 'division by zero', L, 'Check the divisor is not 0 before dividing.'); return p / s;
        case '//': if (s === 0) throw err('ZeroDivisionError', 'float floor division by zero', L); return Math.floor(p / s);
        case '%': if (s === 0) throw err('ZeroDivisionError', 'float modulo', L); return ((p % s) + s) % s;
        case '**': if (p === 0 && s < 0) throw err('ZeroDivisionError', '0.0 cannot be raised to a negative power', L); return Math.pow(p, s);
      }
    }
    var ta = typeName(a), tb = typeName(b);
    if (op === '+') {
      if (typeof a === 'string' && typeof b === 'string') return a + b;
      if (isList(a) && isList(b)) return a.concat(b);
      if (isTup(a) && isTup(b)) return tup(a.concat(b));
      if (typeof a === 'string') throw err('TypeError', 'can only concatenate str (not "' + tb + '") to str', L, isNum(b) ? 'Convert the number with str(...): "Total: " + str(total). Or use an f-string: f"Total: {total}"' : 'Both sides of + must be text. Convert with str(...).');
      if (isList(a)) throw err('TypeError', 'can only concatenate list (not "' + tb + '") to list', L, 'To add one item to a list, use .append(item).');
    }
    if (op === '*') {
      var seq = typeof a === 'string' || Array.isArray(a) ? a : typeof b === 'string' || Array.isArray(b) ? b : null, n = seq === a ? b : a;
      if (seq !== null && isInt(n)) {
        var k = Number(big(n)); if (k <= 0) return typeof seq === 'string' ? '' : (isTup(seq) ? tup([]) : []);
        if (k * seq.length > 1000000) throw err('MemoryError', 'result too large for this simulator', L);
        if (typeof seq === 'string') return seq.repeat(k);
        var o = []; for (var i = 0; i < k; i++) o = o.concat(seq); return isTup(seq) ? tup(o) : o;
      }
      if (seq !== null && typeof n === 'string') throw err('TypeError', "can't multiply sequence by non-int of type 'str'", L, 'The number is text. If it came from input(), convert it with int(...).');
      if (seq !== null) throw err('TypeError', "can't multiply sequence by non-int of type '" + typeName(n) + "'", L);
    }
    if (op === '%' && typeof a === 'string') return percent(a, b, L);
    var hint = (ta === 'str' || tb === 'str') && (isNum(a) || isNum(b)) ? 'One value is text. input() always gives text, so convert it: int(input(...)) or float(input(...)).' : ta === 'NoneType' || tb === 'NoneType' ? 'One value is None. Does the function you called have a return statement?' : '';
    throw err('TypeError', "unsupported operand type(s) for " + op + ": '" + ta + "' and '" + tb + "'", L, hint);
  }
  function percent(s, args, L) {
    var list = isTup(args) ? args.slice() : [args], used = 0;
    var out = s.replace(/%([-+ 0#]*)(\d+)?(?:\.(\d+))?([sdifrxXeEgG%c])/g, function (m, flags, w, p, t) {
      if (t === '%') return '%';
      if (used >= list.length) throw err('TypeError', 'not enough arguments for format string', L);
      var v = list[used++], spec = (flags.indexOf('-') >= 0 ? '<' : '') + (flags.indexOf('+') >= 0 ? '+' : '') + (flags.indexOf('0') >= 0 ? '0' : '') + (w || '') + (p !== undefined ? '.' + p : '');
      if (t === 's') return format(str(v), spec.replace('+', '').replace(/^0/, ''), L);
      if (t === 'r') return format(repr(v), spec, L);
      if (t === 'd' || t === 'i') { if (!isNum(v)) throw err('TypeError', '%d format: a real number is required, not ' + typeName(v), L); return format(toInt(v, L), spec.replace(/\.\d+/, ''), L); }
      if (!isNum(v)) throw err('TypeError', 'must be real number, not ' + typeName(v), L);
      return format(t === 'x' || t === 'X' || t === 'c' ? big(v) : Number(big(v)), spec + t, L);
    });
    if (used < list.length) throw err('TypeError', 'not all arguments converted during string formatting', L);
    return out;
  }
  function contains(c, x, L) {
    if (typeof c === 'string') { if (typeof x !== 'string') throw err('TypeError', "'in <string>' requires string as left operand, not " + typeName(x), L); return c.indexOf(x) >= 0; }
    if (Array.isArray(c)) return c.some(function (y) { return eq(y, x); });
    if (c instanceof Dict || c instanceof PSet) { try { return c.m.has(hkey(x)); } catch (e) { if (e.unhashable) throw err('TypeError', "unhashable type: '" + e.unhashable + "'", L); throw e; } }
    if (c instanceof Range) { if (!isInt(x)) return false; var v = big(x), s = c.step; if (s > 0n ? v < c.start || v >= c.stop : v > c.start || v <= c.stop) return false; return (v - c.start) % s === 0n; }
    throw err('TypeError', "argument of type '" + typeName(c) + "' is not iterable", L);
  }
  function dictSet(d, k, v, L) { var h; try { h = hkey(k); } catch (e) { if (e.unhashable) throw err('TypeError', "unhashable type: '" + e.unhashable + "'", L, 'Dictionary keys must be text, numbers or tuples, not lists.'); throw e; } var o = d.m.get(h); if (o) o[1] = v; else d.m.set(h, [k, v]); }
  function setAdd(s, x, L) { var h; try { h = hkey(x); } catch (e) { if (e.unhashable) throw err('TypeError', "unhashable type: '" + e.unhashable + "'", L); throw e; } if (!s.m.has(h)) s.m.set(h, x); }
  function normIdx(i, n, L, what, assign) {
    if (!isInt(i)) throw err('TypeError', what + ' indices must be integers' + (what === 'str' ? '' : ' or slices') + ', not ' + typeName(i), L, typeof i === 'string' ? 'The index is text. Convert it with int(...).' : typeof i === 'number' ? 'The index is a float. Use // for whole-number division, or int(...).' : '');
    var k = Number(big(i)), j = k < 0 ? k + n : k;
    if (j < 0 || j >= n) throw err('IndexError', what === 'str' ? 'string index out of range' : what + (assign ? ' assignment' : '') + ' index out of range', L, n === 0 ? 'The ' + (what === 'str' ? 'string' : what) + ' is empty.' + (assign ? ' Use .append(...) to add items.' : '') : 'Valid indexes are 0 to ' + (n - 1) + ' (or -' + n + ' to -1). Index ' + k + ' is too ' + (j < 0 ? 'small' : 'big') + '.' + (assign && j >= n ? ' To add a new item, use .append(...).' : ''));
    return j;
  }
  function getItem(o, i, L) {
    if (typeof o === 'string') return o[normIdx(i, o.length, L, 'str')];
    if (Array.isArray(o)) return o[normIdx(i, o.length, L, o.__t ? 'tuple' : 'list')];
    if (o instanceof Dict) { var h; try { h = hkey(i); } catch (e) { if (e.unhashable) throw err('TypeError', "unhashable type: '" + e.unhashable + "'", L); throw e; } var kv = o.m.get(h); if (!kv) throw err('KeyError', repr(i), L, 'That key is not in the dictionary. Check with: if key in d:  or use d.get(key)'); return kv[1]; }
    if (o instanceof Range) { var n = o.len(), j = normIdx(i, Number(n), L, 'range'); return o.start + BigInt(j) * o.step; }
    throw err('TypeError', "'" + typeName(o) + "' object is not subscriptable", L, o === null ? 'The value is None. Check the function you called returns something.' : isNum(o) ? 'Numbers cannot be indexed. To get a digit, convert first: str(n)[0]' : '');
  }
  function setItem(o, i, v, L) {
    if (isList(o)) { o[normIdx(i, o.length, L, 'list', true)] = v; return; }
    if (o instanceof Dict) { dictSet(o, i, v, L); return; }
    if (typeof o === 'string') throw err('TypeError', "'str' object does not support item assignment", L, 'Strings cannot be changed. Build a new one, e.g. s = s[:i] + "x" + s[i+1:]');
    if (isTup(o)) throw err('TypeError', "'tuple' object does not support item assignment", L, 'Tuples cannot be changed. Use a list [ ] instead.');
    throw err('TypeError', "'" + typeName(o) + "' object does not support item assignment", L);
  }
  function sliceIdx(n, lo, hi, st) {
    var s = st === null ? 1 : Number(big(st));
    var fix = function (v, def) { if (v === null) return def; var k = Number(big(v)); if (k < 0) k += n; return s > 0 ? Math.max(0, Math.min(n, k)) : Math.max(-1, Math.min(n - 1, k)); };
    var a = fix(lo, s > 0 ? 0 : n - 1), b = fix(hi, s > 0 ? n : -1), out = [];
    for (var i = a; s > 0 ? i < b : i > b; i += s) out.push(i);
    return out;
  }

  /* ================= runtime ================= */
  function Runner(prog, inputs) {
    this.prog = prog; this.inputs = inputs; this.out = []; this.open = false;
    this.globals = {}; this.mods = {};
    this.module = { vars: this.globals, locals: null, parent: null };
    this.sc = this.module;
    this.frames = [{ name: '<module>', vars: this.globals, line: 0, scope: this.module }];
    this.line = 0; this.steps = 0; this.done = false;
    this.gen = this.block(prog.body);
  }
  var RP = Runner.prototype;
  RP.step = function () {
    if (this.done) return;
    this.steps++;
    try { var r = this.gen.next(); if (r.done) { this.done = true; this.line = 0; } }
    catch (e) {
      if (e && e.sysExit) { this.done = true; this.line = 0; return; }
      if (e && e.isP && e.pline == null) e.pline = this.line;
      if (e && e.unhashable) throw err('TypeError', "unhashable type: '" + e.unhashable + "'", this.line);
      throw e;
    }
  };
  RP.mark = function (L) { this.frames[this.frames.length - 1].line = L; this.line = L; };
  RP.write = function (s, L) {
    var parts = s.split('\n');
    for (var i = 0; i < parts.length; i++) {
      if (i > 0) this.open = false;
      if (parts[i] === '' && i === parts.length - 1) break;
      if (this.open) this.out[this.out.length - 1].text += parts[i];
      else { this.out.push({ text: parts[i], kind: 'out' }); this.open = true; }
    }
    if (this.out.length > 5000) throw err('RuntimeError', 'more than 5,000 lines of output', L, 'This is usually a loop that never ends around a print().');
  };
  RP.readLine = function* (prompt, L) {
    while (!this.inputs.length) { this.waiting = { label: '', prompt: prompt }; yield L; }
    this.waiting = null;
    if (prompt) this.write(prompt, L);
    var raw = this.inputs.shift();
    if (this.open) { this.out[this.out.length - 1].echo = raw; this.open = false; }
    else this.out.push({ text: raw, kind: 'in' });
    return raw;
  };
  RP.knownNames = function () {
    var names = Object.keys(B).concat(KWL);
    for (var s = this.sc; s; s = s.parent) names = names.concat(Object.keys(s.vars));
    return names.concat(Object.keys(this.globals));
  };
  RP.lookup = function (name, L) {
    for (var s = this.sc; s; s = s.parent) {
      if (s.globalNames && s.globalNames[name]) { s = this.module; if (has(s.vars, name)) return s.vars[name]; break; }
      if (has(s.vars, name)) return s.vars[name];
      if (s.locals && s.locals[name]) throw err('UnboundLocalError', "cannot access local variable '" + name + "' where it is not associated with a value", L, name + ' is assigned inside this function, so Python treats it as a local variable for the whole function. Add "global ' + name + '" as the first line of the function, or pass ' + name + ' in as a parameter.');
    }
    if (has(B, name)) return B[name];
    var low = name.toLowerCase(), hint;
    if (low !== name && (has(B, low) || KW[low])) hint = "Python is case-sensitive: write '" + low + "'.";
    else if (name === 'true' || name === 'false' || name === 'none' || name === 'null') hint = 'Write ' + { true: 'True', false: 'False', none: 'None', null: 'None' }[name] + ' with a capital letter.';
    else if (MODS[name]) hint = 'Add "import ' + name + '" at the top of the program.';
    else if (['randint', 'choice', 'shuffle', 'randrange'].indexOf(name) >= 0) hint = 'Add "from random import ' + name + '", or "import random" and write random.' + name + '(...).';
    else if (['sqrt', 'floor', 'ceil', 'pi'].indexOf(name) >= 0) hint = 'Add "from math import ' + name + '", or "import math" and write math.' + name + '.';
    else { var near = nearest(name, this.knownNames()); hint = near ? "Did you mean '" + near + "'?" : 'Give ' + name + ' a value first (' + name + ' = ...), and check the spelling. If it is meant to be text, put it in quotes.'; }
    throw err('NameError', "name '" + name + "' is not defined", L, hint);
  };
  RP.assignName = function (name, v) {
    var s = this.sc;
    if (s.globalNames && s.globalNames[name]) { this.globals[name] = v; return; }
    if (s.nonlocalNames && s.nonlocalNames[name]) { for (var p = s.parent; p; p = p.parent) if (has(p.vars, name)) { p.vars[name] = v; return; } }
    s.vars[name] = v;
  };
  RP.assign = function* (tg, v, L) {
    switch (tg.t) {
      case 'name': this.assignName(tg.id, v); return;
      case 'sub': { var o = yield* this.ev(tg.obj, L), i = yield* this.ev(tg.index, L); setItem(o, i, v, L); return; }
      case 'attr': throw err('AttributeError', "cannot set attribute '" + tg.name + "'", L, 'Objects are not supported in this simulator. Use a dictionary: d["' + tg.name + '"] = ...');
      case 'tuple': case 'list': {
        var arr = toArr(v, L);
        if (arr.length !== tg.items.length) throw err('ValueError', arr.length > tg.items.length ? 'too many values to unpack (expected ' + tg.items.length + ')' : 'not enough values to unpack (expected ' + tg.items.length + ', got ' + arr.length + ')', L, 'The number of names on the left must match the number of values on the right.');
        for (var k = 0; k < arr.length; k++) yield* this.assign(tg.items[k], arr[k], L);
        return;
      }
    }
  };
  RP.block = function* (body) {
    for (var i = 0; i < body.length; i++) { var r = yield* this.exec(body[i]); if (r) return r; }
    return null;
  };
  RP.exec = function* (st) {
    var L = st.line, v, r, i;
    this.mark(L); yield L;
    switch (st.t) {
      case 'expr': yield* this.ev(st.value, L); return null;
      case 'assign': v = yield* this.ev(st.value, L); for (i = 0; i < st.targets.length; i++) yield* this.assign(st.targets[i], v, L); return null;
      case 'aug': {
        var tg = st.target, cur, obj, idx;
        if (tg.t === 'name') cur = this.lookup(tg.id, L);
        else if (tg.t === 'sub') { obj = yield* this.ev(tg.obj, L); idx = yield* this.ev(tg.index, L); cur = getItem(obj, idx, L); }
        else throw err('AttributeError', 'cannot set attribute', L);
        v = yield* this.ev(st.value, L);
        var nv;
        if (st.op === '+' && isList(cur)) { var add = toArr(v, L); for (i = 0; i < add.length; i++) cur.push(add[i]); nv = cur; }
        else nv = arith(st.op, cur, v, L);
        if (tg.t === 'name') this.assignName(tg.id, nv); else setItem(obj, idx, nv, L);
        return null;
      }
      case 'if':
        for (i = 0; i < st.tests.length; i++) {
          var tc = st.tests[i];
          if (i > 0) { this.mark(tc.line); yield tc.line; }
          v = yield* this.ev(tc.cond, tc.line);
          if (truthy(v)) return yield* this.block(tc.body);
        }
        if (st.orelse) return yield* this.block(st.orelse);
        return null;
      case 'while':
        for (var first = true; ; first = false) {
          if (!first) { this.mark(L); yield L; }
          v = yield* this.ev(st.cond, L);
          if (!truthy(v)) { if (st.orelse) return yield* this.block(st.orelse); return null; }
          r = yield* this.block(st.body);
          if (r) { if (r.brk) return null; if (r.cont) continue; return r; }
        }
      case 'for': {
        var src = yield* this.ev(st.iter, L), it = iterate(src, L), n = 0;
        for (;;) {
          var x = it.next(); if (x.done) break;
          if (n++ > 0) { this.mark(L); yield L; }
          yield* this.assign(st.target, x.value, L);
          r = yield* this.block(st.body);
          if (r) { if (r.brk) return null; if (r.cont) continue; return r; }
        }
        if (st.orelse) return yield* this.block(st.orelse);
        return null;
      }
      case 'break': return { brk: true };
      case 'continue': return { cont: true };
      case 'pass': case 'global': return null;
      case 'return': v = st.value ? yield* this.ev(st.value, L) : null; return { ret: v };
      case 'def': {
        var defs = [];
        for (i = 0; i < st.params.length; i++) { var dv = st.params[i].def ? yield* this.ev(st.params[i].def, L) : undefined; defs.push(dv); }
        this.assignName(st.name, { pyfn: true, name: st.name, params: st.params, defs: defs, body: st.body, locals: st.locals, globals: st.globals, nonlocals: st.nonlocals, closure: this.sc, line: L });
        return null;
      }
      case 'import':
        for (i = 0; i < st.mods.length; i++) this.assignName(st.mods[i].as, this.getMod(st.mods[i].name, L));
        return null;
      case 'from': {
        var md = this.getMod(st.mod, L);
        if (!st.names) { Object.keys(md.attrs).forEach(function (k) { this.assignName(k, md.attrs[k]); }, this); return null; }
        for (i = 0; i < st.names.length; i++) {
          var nm = st.names[i].name;
          if (!has(md.attrs, nm)) throw err('ImportError', "cannot import name '" + nm + "' from '" + st.mod + "'", L, 'Available: ' + Object.keys(md.attrs).join(', '));
          this.assignName(st.names[i].as, md.attrs[nm]);
        }
        return null;
      }
      case 'del':
        for (i = 0; i < st.targets.length; i++) {
          var d = st.targets[i];
          if (d.t === 'name') { this.lookup(d.id, L); delete this.sc.vars[d.id]; if (this.sc.globalNames && this.sc.globalNames[d.id]) delete this.globals[d.id]; }
          else {
            var dob = yield* this.ev(d.obj, L), dix = yield* this.ev(d.index, L);
            if (isList(dob)) dob.splice(normIdx(dix, dob.length, L, 'list', true), 1);
            else if (dob instanceof Dict) { getItem(dob, dix, L); dob.m.delete(hkey(dix)); }
            else throw err('TypeError', "'" + typeName(dob) + "' object doesn't support item deletion", L);
          }
        }
        return null;
      case 'assert':
        v = yield* this.ev(st.cond, L);
        if (!truthy(v)) { var am = st.msg ? str(yield* this.ev(st.msg, L)) : ''; throw err('AssertionError', am, L); }
        return null;
      case 'raise': {
        if (!st.exc) { if (this.curExc) throw this.curExc; throw err('RuntimeError', 'No active exception to reraise', L); }
        var ex = yield* this.ev(st.exc, L);
        if (ex && ex.excCls) ex = { exc: true, type: ex.name, msg: '' };
        if (!ex || !ex.exc) throw err('TypeError', 'exceptions must derive from BaseException', L, 'For example: raise ValueError("Age must be positive")');
        var e = err(ex.type, ex.msg, L, ''); e.userRaised = true; throw e;
      }
      case 'try': {
        var depth = this.frames.length, scope = this.sc, res = null, caught = false;
        try {
          try { res = yield* this.block(st.body); }
          catch (e) {
            if (!e || !e.isP || e.internal) throw e;
            this.frames.length = depth; this.sc = scope; this.mark(L);
            var h = null;
            for (i = 0; i < st.handlers.length && !h; i++) {
              var hd = st.handlers[i];
              if (!hd.types) { h = hd; break; }
              var tv = yield* this.ev(hd.types, hd.line), list = isTup(tv) ? tv : [tv];
              for (var k = 0; k < list.length; k++) {
                if (!list[k] || !list[k].excCls) throw err('TypeError', 'catching classes that do not inherit from BaseException is not allowed', hd.line, 'For example: except ValueError:');
                if (excMatch(e.pyType, list[k].name)) { h = hd; break; }
              }
            }
            if (!h) throw e;
            caught = true;
            this.mark(h.line); yield h.line;
            if (h.name) this.assignName(h.name, { exc: true, type: e.pyType, msg: e.pyMsg });
            var saved = this.curExc; this.curExc = e;
            try { res = yield* this.block(h.body); } finally { this.curExc = saved; }
          }
          if (!caught && st.orelse && !res) res = yield* this.block(st.orelse);
        } finally {
          if (st.fin) { var fr = yield* this.block(st.fin); if (fr) res = fr; }
        }
        return res;
      }
    }
    return null;
  };
  RP.getMod = function (name, L) {
    if (this.mods[name]) return this.mods[name];
    if (!MODS[name]) throw err('ModuleNotFoundError', "No module named '" + name + "'", L, 'This simulator supports the random, math and time modules.');
    return (this.mods[name] = { mod: true, name: name, attrs: MODS[name]() });
  };
  RP.callValue = function* (f, args, kw, L) {
    if (f && f.bi) {
      if (!f.f) throw err('TypeError', "cannot create '" + f.name + "' instances", L);
      if (f.gen) return yield* f.f.call(this, args, kw, L);
      return f.f(args, kw, L, this);
    }
    if (f && f.pyfn) return yield* this.callUser(f, args, kw, L);
    if (f && f.excCls) return { exc: true, type: f.name, msg: args.length ? str(args[0]) : '' };
    throw err('TypeError', "'" + typeName(f) + "' object is not callable", L, isNum(f) ? 'Python needs * for multiplication: 2 * (x + 1), not 2(x + 1). Or a variable has the same name as a function.' : typeof f === 'string' ? 'A variable may have the same name as a function you are trying to call, e.g. str = "..." hides str().' : '');
  };
  RP.callUser = function* (f, args, kw, L) {
    var ps = f.params, vars = {}, i, label = f.name + '()';
    if (args.length > ps.length) throw err('TypeError', label + ' takes ' + ps.length + ' positional argument' + (ps.length === 1 ? '' : 's') + ' but ' + args.length + (args.length === 1 ? ' was' : ' were') + ' given', L, 'It is defined on line ' + f.line + ' as ' + f.name + '(' + ps.map(function (p) { return p.name; }).join(', ') + ').');
    Object.keys(kw).forEach(function (k) { if (!ps.some(function (p) { return p.name === k; })) throw err('TypeError', label + " got an unexpected keyword argument '" + k + "'", L); });
    var missing = [];
    for (i = 0; i < ps.length; i++) {
      if (i < args.length) { if (has(kw, ps[i].name)) throw err('TypeError', label + " got multiple values for argument '" + ps[i].name + "'", L); vars[ps[i].name] = args[i]; }
      else if (has(kw, ps[i].name)) vars[ps[i].name] = kw[ps[i].name];
      else if (f.defs[i] !== undefined) vars[ps[i].name] = f.defs[i];
      else missing.push("'" + ps[i].name + "'");
    }
    if (missing.length) throw err('TypeError', label + ' missing ' + missing.length + ' required positional argument' + (missing.length === 1 ? '' : 's') + ': ' + (missing.length === 1 ? missing[0] : missing.slice(0, -1).join(', ') + ' and ' + missing[missing.length - 1]), L, 'It is defined on line ' + f.line + ' as ' + f.name + '(' + ps.map(function (p) { return p.name; }).join(', ') + ').');
    if (this.frames.length > 200) throw err('RecursionError', 'maximum recursion depth exceeded', L, 'The function keeps calling itself. Make sure it has a base case that returns without another call.');
    var scope = { vars: vars, locals: f.locals, globalNames: f.globals, nonlocalNames: f.nonlocals, parent: f.closure };
    var saved = this.sc;
    this.frames.push({ name: f.name, vars: vars, line: f.line, scope: scope }); this.sc = scope;
    var r;
    if (f.lambda) r = { ret: yield* this.ev(f.body, L) };
    else r = yield* this.block(f.body);
    this.frames.pop(); this.sc = saved; this.mark(L);
    return r && r.ret !== undefined ? r.ret : null;
  };
  RP.getattr = function (o, name, L) {
    var self = this;
    if (o && o.mod) { if (has(o.attrs, name)) return o.attrs[name]; throw err('AttributeError', "module '" + o.name + "' has no attribute '" + name + "'", L, (function () { var n = nearest(name, Object.keys(o.attrs)); return n ? "Did you mean '" + n + "'?" : 'Available: ' + Object.keys(o.attrs).join(', '); })()); }
    var table = typeof o === 'string' ? STRM : isList(o) ? LISTM : isTup(o) ? TUPM : o instanceof Dict ? DICTM : o instanceof PSet ? SETM : null;
    if (o && o.exc && name === 'args') return tup([o.msg]);
    if (table && has(table, name)) { var m = table[name]; return bi(name, function (a, kw, L2) { return m.call(self, o, a, kw, L2 || L); }, { gen: m.gen, bound: true, f: m.gen ? function* (a, kw, L2) { return yield* m.call(self, o, a, kw, L2 || L); } : function (a, kw, L2) { return m.call(self, o, a, kw, L2 || L); } }); }
    var tn = typeName(o), alias = { push: 'append', add: isList(o) ? 'append' : null, length: 'len()', size: 'len()', len: 'len()', toUpperCase: 'upper', toLowerCase: 'lower', toupper: 'upper', tolower: 'lower', trim: 'strip', contains: 'the in operator', includes: 'the in operator', indexOf: 'index', charAt: 's[i]', substring: 'slicing s[a:b]', substr: 'slicing s[a:b]', remove: typeof o === 'string' ? 'replace' : null, delete: 'del or .pop()', has_key: 'the in operator', isNumber: 'isdigit' }[name];
    var hint = alias ? 'Did you mean ' + (alias.indexOf(' ') > 0 || alias.indexOf('(') > 0 || alias.indexOf('[') >= 0 ? alias : '.' + alias + '(...)') + '?' : table ? (function () { var n = nearest(name, Object.keys(table)); return n ? "Did you mean '." + n + "'?" : ''; })() : o === null ? 'The value is None. Check that the function you called returns something.' : '';
    throw err('AttributeError', "'" + tn + "' object has no attribute '" + name + "'", L, hint);
  };
  RP.ev = function* (e, L) {
    var a, b, i, v;
    switch (e.t) {
      case 'const': return e.v;
      case 'name': return this.lookup(e.id, L);
      case 'fstr': {
        var s = '';
        for (i = 0; i < e.parts.length; i++) {
          var p = e.parts[i];
          if (p.lit !== undefined) { s += p.lit; continue; }
          v = yield* this.ev(p.expr, L);
          if (p.conv === 'r') v = repr(v); else if (p.conv === 's') v = str(v);
          s += format(v, p.spec, L);
        }
        return s;
      }
      case 'list': a = []; for (i = 0; i < e.items.length; i++) { v = yield* this.ev(e.items[i], L); a.push(v); } return a;
      case 'tuple': a = []; for (i = 0; i < e.items.length; i++) { v = yield* this.ev(e.items[i], L); a.push(v); } return tup(a);
      case 'set': { var st = new PSet(); for (i = 0; i < e.items.length; i++) { v = yield* this.ev(e.items[i], L); setAdd(st, v, L); } return st; }
      case 'dict': { var d = new Dict(); for (i = 0; i < e.keys.length; i++) { var k = yield* this.ev(e.keys[i], L); v = yield* this.ev(e.vals[i], L); dictSet(d, k, v, L); } return d; }
      case 'comp': {
        var res = e.kind === 'dict' ? new Dict() : e.kind === 'set' ? new PSet() : [], outer = this.sc, self = this;
        this.sc = { vars: {}, locals: null, parent: outer, comp: true };
        var run = function* (ci) {
          if (ci === e.clauses.length) {
            var x = yield* self.ev(e.elt, L);
            if (e.kind === 'dict') { var y = yield* self.ev(e.val, L); dictSet(res, x, y, L); } else if (e.kind === 'set') setAdd(res, x, L); else res.push(x);
            return;
          }
          var c = e.clauses[ci];
          if (c.k === 'if') { var cv = yield* self.ev(c.cond, L); if (truthy(cv)) yield* run(ci + 1); return; }
          var srcv = yield* self.ev(c.iter, L), itr = iterate(srcv, L);
          for (;;) { var nx = itr.next(); if (nx.done) break; yield* self.assign(c.target, nx.value, L); yield* run(ci + 1); }
        };
        yield* run(0);
        this.sc = outer;
        return res;
      }
      case 'bin': a = yield* this.ev(e.a, L); b = yield* this.ev(e.b, L); return arith(e.op, a, b, L);
      case 'unary':
        a = yield* this.ev(e.a, L);
        if (!isNum(a)) throw err('TypeError', "bad operand type for unary " + e.op + ": '" + typeName(a) + "'", L, typeof a === 'string' ? 'The value is text. Convert it with int(...) or float(...).' : '');
        if (e.op === '~') return ~big(a);
        if (e.op === '+') return typeof a === 'boolean' ? big(a) : a;
        return isInt(a) ? -big(a) : -a;
      case 'not': a = yield* this.ev(e.a, L); return !truthy(a);
      case 'bool':
        a = yield* this.ev(e.a, L);
        if (e.op === 'and' ? !truthy(a) : truthy(a)) return a;
        return yield* this.ev(e.b, L);
      case 'cmp': {
        a = yield* this.ev(e.a, L);
        for (i = 0; i < e.ops.length; i++) {
          b = yield* this.ev(e.rest[i], L);
          var op = e.ops[i], ok;
          if (op === '==') ok = eq(a, b); else if (op === '!=') ok = !eq(a, b);
          else if (op === 'in') ok = contains(b, a, L); else if (op === 'not in') ok = !contains(b, a, L);
          else if (op === 'is') ok = a === b || (a === null && b === null); else if (op === 'is not') ok = !(a === b);
          else ok = compare(op, a, b, L);
          if (!ok) return false;
          a = b;
        }
        return true;
      }
      case 'ifexp': a = yield* this.ev(e.cond, L); return yield* this.ev(truthy(a) ? e.a : e.b, L);
      case 'lambda': {
        var defs = []; for (i = 0; i < e.params.length; i++) { var dv = e.params[i].def ? yield* this.ev(e.params[i].def, L) : undefined; defs.push(dv); }
        return { pyfn: true, lambda: true, name: '<lambda>', params: e.params, defs: defs, body: e.body, locals: e.locals, globals: {}, nonlocals: {}, closure: this.sc, line: L };
      }
      case 'call': {
        var fn = yield* this.ev(e.fn, L), args = [], kw = {};
        for (i = 0; i < e.args.length; i++) {
          v = yield* this.ev(e.args[i], L);
          if (e.star.indexOf(i) >= 0) args = args.concat(toArr(v, L)); else args.push(v);
        }
        for (i = 0; i < e.kw.length; i++) { v = yield* this.ev(e.kw[i].value, L); kw[e.kw[i].name] = v; }
        if (fn && fn.bi && !fn.gen && !fn.bound && fn.name !== 'print' && fn.name !== 'dict' && !fn.kwOk) {
          var allowed = { int: ['base'], round: ['ndigits'], sum: ['start'], enumerate: ['start'], min: ['key', 'default'], max: ['key', 'default'], sorted: ['key', 'reverse'] }[fn.name] || [];
          Object.keys(kw).forEach(function (k) { if (allowed.indexOf(k) < 0) throw err('TypeError', fn.name + "() got an unexpected keyword argument '" + k + "'", L); });
        }
        try { return yield* this.callValue(fn, args, kw, L); }
        catch (x) { if (x && x.isP && x.pline == null) x.pline = L; throw x; }
      }
      case 'attr': a = yield* this.ev(e.obj, L); return this.getattr(a, e.name, L);
      case 'sub': a = yield* this.ev(e.obj, L); b = yield* this.ev(e.index, L); return getItem(a, b, L);
      case 'slice': {
        a = yield* this.ev(e.obj, L);
        var lo = e.lo ? yield* this.ev(e.lo, L) : null, hi = e.hi ? yield* this.ev(e.hi, L) : null, sp = e.step ? yield* this.ev(e.step, L) : null;
        [lo, hi, sp].forEach(function (x) { if (x !== null && !isInt(x)) throw err('TypeError', 'slice indices must be integers or None', L, typeof x === 'string' ? 'Convert the text with int(...).' : ''); });
        if (sp !== null && big(sp) === 0n) throw err('ValueError', 'slice step cannot be zero', L);
        if (typeof a !== 'string' && !Array.isArray(a) && !(a instanceof Range)) throw err('TypeError', "'" + typeName(a) + "' object is not subscriptable", L);
        var src = a instanceof Range ? toArr(a, L) : a, ix = sliceIdx(src.length, lo, hi, sp), outv = ix.map(function (j) { return src[j]; });
        return typeof a === 'string' ? outv.join('') : isTup(a) ? tup(outv) : outv;
      }
    }
    throw err('SystemError', 'unknown expression', L);
  };

  /* ================= methods ================= */
  function sArg(name, v, L) { if (typeof v !== 'string') throw err('TypeError', name + '() argument must be str, not ' + typeName(v), L); return v; }
  function strip(s, chars, side) {
    var set = chars === null || chars === undefined ? ' \t\n\r\f\v' : chars, i = 0, j = s.length;
    if (side !== 'r') while (i < j && set.indexOf(s[i]) >= 0) i++;
    if (side !== 'l') while (j > i && set.indexOf(s[j - 1]) >= 0) j--;
    return s.slice(i, j);
  }
  var STRM = {
    upper: function (s, a) { argc('upper', a, 0, 0); return s.toUpperCase(); },
    lower: function (s, a) { argc('lower', a, 0, 0); return s.toLowerCase(); },
    title: function (s) { return s.toLowerCase().replace(/(^|[^a-zA-Z'])([a-z])/g, function (m, p, c) { return p + c.toUpperCase(); }); },
    capitalize: function (s) { return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(); },
    swapcase: function (s) { return s.split('').map(function (c) { return c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase(); }).join(''); },
    strip: function (s, a) { return strip(s, a[0], ''); }, lstrip: function (s, a) { return strip(s, a[0], 'l'); }, rstrip: function (s, a) { return strip(s, a[0], 'r'); },
    split: function (s, a, kw, L) {
      var sep = a.length ? a[0] : kwArg(kw, 'sep', null), max = a.length > 1 ? Number(big(a[1])) : Number(big(kwArg(kw, 'maxsplit', -1n)));
      if (sep === null) { var w = s.trim().split(/\s+/).filter(function (x) { return x !== ''; }); if (max >= 0 && w.length > max + 1) { var parts = [], rest = s.trim(); for (var i = 0; i < max; i++) { var m = /^(\S+)\s+/.exec(rest); parts.push(m[1]); rest = rest.slice(m[0].length); } parts.push(rest); return parts; } return w; }
      sArg('split', sep, L); if (sep === '') throw err('ValueError', 'empty separator', L);
      var out = s.split(sep); if (max >= 0 && out.length > max + 1) out = out.slice(0, max).concat([out.slice(max).join(sep)]); return out;
    },
    join: function (s, a, kw, L) { argc('join', a, 1, 1); var items = toArr(a[0], L, 'join()'); items.forEach(function (x, i) { if (typeof x !== 'string') throw err('TypeError', 'sequence item ' + i + ': expected str instance, ' + typeName(x) + ' found', L, 'Convert the items to text first: ", ".join(str(x) for x in items)'); }); return items.join(s); },
    replace: function (s, a, kw, L) { argc('replace', a, 2, 3); sArg('replace', a[0], L); sArg('replace', a[1], L); var n = a.length > 2 ? Number(big(a[2])) : -1, out = '', i = 0, c = 0; if (a[0] === '') return s; for (;;) { var j = s.indexOf(a[0], i); if (j < 0 || (n >= 0 && c >= n)) break; out += s.slice(i, j) + a[1]; i = j + a[0].length; c++; } return out + s.slice(i); },
    find: function (s, a, kw, L) { argc('find', a, 1, 2); return BigInt(s.indexOf(sArg('find', a[0], L), a.length > 1 ? Number(big(a[1])) : 0)); },
    rfind: function (s, a, kw, L) { argc('rfind', a, 1, 1); return BigInt(s.lastIndexOf(sArg('rfind', a[0], L))); },
    index: function (s, a, kw, L) { argc('index', a, 1, 2); var r = s.indexOf(sArg('index', a[0], L), a.length > 1 ? Number(big(a[1])) : 0); if (r < 0) throw err('ValueError', 'substring not found', L, 'Use .find(...), which gives -1 instead of an error.'); return BigInt(r); },
    count: function (s, a, kw, L) { argc('count', a, 1, 1); var sub = sArg('count', a[0], L); if (sub === '') return BigInt(s.length + 1); return BigInt(s.split(sub).length - 1); },
    startswith: function (s, a, kw, L) { var p = isTup(a[0]) ? a[0] : [a[0]]; return p.some(function (x) { return s.indexOf(sArg('startswith', x, L)) === 0; }); },
    endswith: function (s, a, kw, L) { var p = isTup(a[0]) ? a[0] : [a[0]]; return p.some(function (x) { sArg('endswith', x, L); return s.length >= x.length && s.slice(s.length - x.length) === x; }); },
    isdigit: function (s) { return /^\d+$/.test(s); }, isnumeric: function (s) { return /^\d+$/.test(s); }, isdecimal: function (s) { return /^\d+$/.test(s); },
    isalpha: function (s) { return /^[A-Za-zÀ-ɏ]+$/.test(s); }, isalnum: function (s) { return /^[A-Za-z0-9À-ɏ]+$/.test(s); },
    isupper: function (s) { return /[A-Z]/.test(s) && s === s.toUpperCase(); }, islower: function (s) { return /[a-z]/.test(s) && s === s.toLowerCase(); },
    isspace: function (s) { return /^\s+$/.test(s); },
    center: function (s, a) { return pad(s, Number(big(a[0])), a[1] || ' ', '^'); },
    ljust: function (s, a) { return pad(s, Number(big(a[0])), a[1] || ' ', '<'); },
    rjust: function (s, a) { return pad(s, Number(big(a[0])), a[1] || ' ', '>'); },
    zfill: function (s, a) { var w = Number(big(a[0])), sg = /^[+-]/.test(s) ? s[0] : ''; var b = sg ? s.slice(1) : s; return sg + pad(b, w - sg.length, '0', '>'); },
    format: function (s, a, kw, L) {
      var auto = 0;
      return s.replace(/\{\{|\}\}|\{([^{}:!]*)(?:!([rs]))?(?::([^{}]*))?\}/g, function (m, field, conv, spec) {
        if (m === '{{') return '{'; if (m === '}}') return '}';
        var v;
        if (field === '') { if (auto >= a.length) throw err('IndexError', 'Replacement index ' + auto + ' out of range for positional args tuple', L, 'There are more {} than values passed to format().'); v = a[auto++]; }
        else if (/^\d+$/.test(field)) { if (+field >= a.length) throw err('IndexError', 'Replacement index ' + field + ' out of range for positional args tuple', L); v = a[+field]; }
        else { if (!has(kw, field)) throw err('KeyError', strRepr(field), L); v = kw[field]; }
        if (conv === 'r') v = repr(v);
        return format(v, spec || '', L);
      });
    }
  };
  var LISTM = {
    append: function (l, a, kw, L) { if (a.length !== 1) throw err('TypeError', 'list.append() takes exactly one argument (' + a.length + ' given)', L, 'To add several items, use .extend([a, b]) or call append for each one.'); l.push(a[0]); return null; },
    extend: function (l, a, kw, L) { argc('extend', a, 1, 1); toArr(a[0], L, 'extend()').forEach(function (x) { l.push(x); }); return null; },
    insert: function (l, a, kw, L) { argc('insert', a, 2, 2); var i = Number(big(a[0])), n = l.length; if (i < 0) i = Math.max(0, i + n); l.splice(Math.min(i, n), 0, a[1]); return null; },
    remove: function (l, a, kw, L) { argc('remove', a, 1, 1); for (var i = 0; i < l.length; i++) if (eq(l[i], a[0])) { l.splice(i, 1); return null; } throw err('ValueError', 'list.remove(x): x not in list', L, 'Check with "if x in my_list:" before removing.'); },
    pop: function (l, a, kw, L) { argc('pop', a, 0, 1); if (!l.length) throw err('IndexError', 'pop from empty list', L, 'Check the list is not empty first: if my_list:'); var i = a.length ? normIdx(a[0], l.length, L, 'pop') : l.length - 1; return l.splice(i, 1)[0]; },
    index: function (l, a, kw, L) { argc('index', a, 1, 1); for (var i = 0; i < l.length; i++) if (eq(l[i], a[0])) return BigInt(i); throw err('ValueError', repr(a[0]) + ' is not in list', L, 'Check with "if x in my_list:" first.'); },
    count: function (l, a) { argc('count', a, 1, 1); return BigInt(l.filter(function (x) { return eq(x, a[0]); }).length); },
    sort: function* (l, a, kw, L) { argc('sort', a, 0, 0); var ks = yield* keysFor(this, l, kwArg(kw, 'key', null), L), s = sortArr(l, ks, truthy(kwArg(kw, 'reverse', false)), L); for (var i = 0; i < s.length; i++) l[i] = s[i]; return null; },
    reverse: function (l) { l.reverse(); return null; },
    clear: function (l) { l.length = 0; return null; },
    copy: function (l) { return l.slice(); }
  };
  LISTM.sort.gen = true;
  var TUPM = { index: LISTM.index, count: LISTM.count };
  var DICTM = {
    keys: function (d) { var k = []; d.m.forEach(function (kv) { k.push(kv[0]); }); return k; },
    values: function (d) { var k = []; d.m.forEach(function (kv) { k.push(kv[1]); }); return k; },
    items: function (d) { var k = []; d.m.forEach(function (kv) { k.push(tup([kv[0], kv[1]])); }); return k; },
    get: function (d, a, kw, L) { argc('get', a, 1, 2); var kv = d.m.get(hkey(a[0])); return kv ? kv[1] : a.length > 1 ? a[1] : null; },
    pop: function (d, a, kw, L) { argc('pop', a, 1, 2); var h = hkey(a[0]), kv = d.m.get(h); if (!kv) { if (a.length > 1) return a[1]; throw err('KeyError', repr(a[0]), L); } d.m.delete(h); return kv[1]; },
    update: function (d, a, kw, L) { if (a.length) { var o = a[0]; if (!(o instanceof Dict)) throw err('TypeError', 'update() needs a dictionary', L); o.m.forEach(function (kv) { dictSet(d, kv[0], kv[1], L); }); } Object.keys(kw).forEach(function (k) { dictSet(d, k, kw[k], L); }); return null; },
    setdefault: function (d, a, kw, L) { var kv = d.m.get(hkey(a[0])); if (kv) return kv[1]; var v = a.length > 1 ? a[1] : null; dictSet(d, a[0], v, L); return v; },
    clear: function (d) { d.m.clear(); return null; },
    copy: function (d) { var n = new Dict(); d.m.forEach(function (kv, k) { n.m.set(k, [kv[0], kv[1]]); }); return n; }
  };
  var SETM = {
    add: function (s, a, kw, L) { argc('add', a, 1, 1); setAdd(s, a[0], L); return null; },
    remove: function (s, a, kw, L) { var h = hkey(a[0]); if (!s.m.has(h)) throw err('KeyError', repr(a[0]), L); s.m.delete(h); return null; },
    discard: function (s, a) { s.m.delete(hkey(a[0])); return null; },
    pop: function (s, a, kw, L) { if (!s.m.size) throw err('KeyError', "'pop from an empty set'", L); var k = s.m.keys().next().value, v = s.m.get(k); s.m.delete(k); return v; },
    clear: function (s) { s.m.clear(); return null; },
    union: function (s, a, kw, L) { var n = new PSet(); s.m.forEach(function (x) { setAdd(n, x, L); }); toArr(a[0], L).forEach(function (x) { setAdd(n, x, L); }); return n; },
    intersection: function (s, a, kw, L) { var o = B.set.f([a[0]], {}, L), n = new PSet(); s.m.forEach(function (x, k) { if (o.m.has(k)) n.m.set(k, x); }); return n; },
    difference: function (s, a, kw, L) { var o = B.set.f([a[0]], {}, L), n = new PSet(); s.m.forEach(function (x, k) { if (!o.m.has(k)) n.m.set(k, x); }); return n; }
  };

  function hidden(v) { return v && (v.pyfn || v.bi || v.mod || v.excCls); }
  function entries(vars) {
    return Object.keys(vars).filter(function (k) { return !hidden(vars[k]) && k.indexOf('__') !== 0; }).map(function (k) {
      var r = repr(vars[k]); if (r.length > 300) r = r.slice(0, 300) + '…';
      return { name: k, type: typeName(vars[k]), value: r };
    });
  }
  function errFn(msg, line, hint) { var e = new Error(msg); e.isP = true; e.pline = line; e.hint = hint || ''; e.internal = true; return e; }

  return { compile: compile, Runner: Runner, err: errFn, repr: repr, entries: entries, KW: KW, BUILTINS: B, MODS: MODS, fmt: str };
})();

var EXAMPLES = [
  { id: 'grade', name: 'Grade checker', input: 'Amira\n64', code: [
    '# Grade checker',
    'RECEIVE name FROM (STRING) KEYBOARD',
    'RECEIVE mark FROM (INTEGER) KEYBOARD',
    '',
    'IF mark >= 70 THEN',
    '    SET grade TO "A"',
    'ELSE',
    '    IF mark >= 50 THEN',
    '        SET grade TO "B"',
    '    ELSE',
    '        SET grade TO "C"',
    '    END IF',
    'END IF',
    '',
    'SEND name & " got grade " & grade TO DISPLAY'] },
  { id: 'times', name: 'Times table', input: '7', code: [
    '# Times table',
    'RECEIVE n FROM (INTEGER) KEYBOARD',
    'FOR i FROM 1 TO 12 DO',
    '    SEND i & " x " & n & " = " & i * n TO DISPLAY',
    'END FOR'] },
  { id: 'guess', name: 'Guessing game', input: '3\n9\n7', code: [
    '# Guessing game',
    'SET secret TO 7',
    'SET tries TO 0',
    'REPEAT',
    '    RECEIVE guess FROM (INTEGER) KEYBOARD',
    '    SET tries TO tries + 1',
    '    IF guess < secret THEN',
    '        SEND "Too low" TO DISPLAY',
    '    ELSE',
    '        IF guess > secret THEN',
    '            SEND "Too high" TO DISPLAY',
    '        END IF',
    '    END IF',
    'UNTIL guess = secret',
    'SEND "Got it in " & tries & " tries" TO DISPLAY'] },
  { id: 'bubble', name: 'Bubble sort', input: '', code: [
    '# Bubble sort',
    'SET nums TO [29, 4, 17, 8, 42, 15]',
    'SET swapped TO TRUE',
    'WHILE swapped = TRUE DO',
    '    SET swapped TO FALSE',
    '    FOR i FROM 0 TO LENGTH(nums) - 2 DO',
    '        IF nums[i] > nums[i + 1] THEN',
    '            SET temp TO nums[i]',
    '            SET nums[i] TO nums[i + 1]',
    '            SET nums[i + 1] TO temp',
    '            SET swapped TO TRUE',
    '        END IF',
    '    END FOR',
    'END WHILE',
    'SEND nums TO DISPLAY'] },
  { id: 'search', name: 'Linear search (function)', input: 'Cal', code: [
    '# Linear search',
    'FUNCTION search(list, target)',
    'BEGIN FUNCTION',
    '    FOR i FROM 0 TO LENGTH(list) - 1 DO',
    '        IF list[i] = target THEN',
    '            RETURN i',
    '        END IF',
    '    END FOR',
    '    RETURN -1',
    'END FUNCTION',
    '',
    'SET names TO ["Ali", "Bea", "Cal", "Dev"]',
    'RECEIVE wanted FROM (STRING) KEYBOARD',
    'SET pos TO search(names, wanted)',
    'IF pos = -1 THEN',
    '    SEND wanted & " was not found" TO DISPLAY',
    'ELSE',
    '    SEND wanted & " is at index " & pos TO DISPLAY',
    'END IF'] },
  { id: 'total', name: 'Running total (procedure)', input: '', code: [
    '# Running total',
    'SET total TO 0',
    '',
    'PROCEDURE addScore(points)',
    'BEGIN PROCEDURE',
    '    SET total TO total + points',
    '    SEND "Added " & points & ", total is now " & total TO DISPLAY',
    'END PROCEDURE',
    '',
    'FOR EACH s FROM [10, 25, 5] DO',
    '    addScore(s)',
    'END FOREACH'] },
  { id: 'bug', name: 'Find the bug: average', input: '', code: [
    '# Find the bug: this crashes. Step through it to see why.',
    'SET scores TO [12, 18, 9, 15]',
    'SET total TO 0',
    'FOR i FROM 0 TO LENGTH(scores) DO',
    '    SET total TO total + scores[i]',
    'END FOR',
    'SEND "Average: " & total / LENGTH(scores) TO DISPLAY'] }
];
EXAMPLES.forEach(function (e) { e.code = e.code.join('\n') + '\n'; });

var GUIDE = [
  { section: 'Variables and input/output', items: [
    { title: 'Assign a variable', code: 'SET score TO 0\nSET name TO "Sam"', note: 'SET creates or updates a variable. Names are case-sensitive: Score and score are different.' },
    { title: 'Output', code: 'SEND "Hello " & name TO DISPLAY', note: 'Use & to join text and values into one line.' },
    { title: 'Input', code: 'RECEIVE age FROM (INTEGER) KEYBOARD', note: 'Types: INTEGER, REAL, STRING, BOOLEAN, CHARACTER. When RECEIVE runs, the console waits for you to type a value.' },
    { title: 'Comment', code: '# This line is ignored', note: 'Everything after # on a line is a comment.' }
  ] },
  { section: 'Selection', items: [
    { title: 'IF ... ELSE', code: 'IF mark >= 50 THEN\n    SEND "Pass" TO DISPLAY\nELSE\n    SEND "Fail" TO DISPLAY\nEND IF', note: 'ELSE is optional. Every IF needs its own END IF.' },
    { title: 'More than two choices', code: 'IF mark >= 70 THEN\n    SET grade TO "A"\nELSE\n    IF mark >= 50 THEN\n        SET grade TO "B"\n    ELSE\n        SET grade TO "C"\n    END IF\nEND IF', note: 'Nest a second IF inside ELSE.' }
  ] },
  { section: 'Iteration', items: [
    { title: 'FOR (count-controlled)', code: 'FOR i FROM 1 TO 10 DO\n    SEND i TO DISPLAY\nEND FOR', note: 'Add STEP 2 or STEP -1 after the end value to change the step.' },
    { title: 'WHILE (check first)', code: 'SET count TO 0\nWHILE count < 5 DO\n    SET count TO count + 1\nEND WHILE', note: 'Checked before each pass, so the body may run zero times.' },
    { title: 'REPEAT ... UNTIL (check last)', code: 'REPEAT\n    RECEIVE guess FROM (INTEGER) KEYBOARD\nUNTIL guess = 7', note: 'The body always runs at least once.' },
    { title: 'REPEAT n TIMES', code: 'REPEAT 3 TIMES\n    SEND "Hello" TO DISPLAY\nEND REPEAT', note: '' },
    { title: 'FOR EACH', code: 'FOR EACH item FROM ["a", "b"] DO\n    SEND item TO DISPLAY\nEND FOREACH', note: 'Visits every element of an array, or every character of a string.' }
  ] },
  { section: 'Subprograms', items: [
    { title: 'Procedure', code: 'PROCEDURE greet(name)\nBEGIN PROCEDURE\n    SEND "Hi " & name TO DISPLAY\nEND PROCEDURE\n\ngreet("Ava")', note: 'Call it on its own line. A procedure does not return a value.' },
    { title: 'Function', code: 'FUNCTION square(n)\nBEGIN FUNCTION\n    RETURN n * n\nEND FUNCTION\n\nSET area TO square(4)', note: 'A function must RETURN a value. Use it inside an expression.' }
  ] },
  { section: 'Arrays and strings', items: [
    { title: 'Create and read', code: 'SET scores TO [12, 18, 9]\nSEND scores[0] TO DISPLAY', note: 'Indexes start at 0. The last index is LENGTH(scores) - 1.' },
    { title: 'Change an element', code: 'SET scores[1] TO 20', note: '' },
    { title: 'Loop over an array', code: 'FOR i FROM 0 TO LENGTH(scores) - 1 DO\n    SEND scores[i] TO DISPLAY\nEND FOR', note: '' },
    { title: '2D array', code: 'SET grid TO [[1, 2], [3, 4]]\nSEND grid[1][0] TO DISPLAY', note: 'Row first, then column. This shows 3.' },
    { title: 'Characters of a string', code: 'SET word TO "code"\nSEND word[0] TO DISPLAY', note: 'Strings index like arrays. LENGTH(word) is 4.' }
  ] },
  { section: 'Operators', items: [
    { title: 'Arithmetic', code: '+  -  *  /  ^\n7 DIV 2    is 3\n7 MOD 2    is 1', note: '/ gives a real result. DIV is whole-number division, MOD the remainder.', noInsert: true },
    { title: 'Comparison', code: '=  <>  <  <=  >  >=', note: 'Use = to compare and <> for not equal. == and != are not Edexcel.', noInsert: true },
    { title: 'Logic and text', code: 'AND  OR  NOT\n"Total: " & total', note: '& joins text. TRUE and FALSE are written in capitals.', noInsert: true }
  ] },
  { section: 'Built-in functions', items: [
    { title: 'LENGTH(x)', code: 'SET n TO LENGTH("hello")', note: 'Number of items in an array, or characters in a string.' },
    { title: 'RANDOM(n)', code: 'SET roll TO RANDOM(5) + 1', note: 'A random whole number from 0 to n inclusive.' },
    { title: 'INT(x) and STR(x)', code: 'SET n TO INT("42")\nSET s TO STR(3.5)', note: 'Conversion helpers supported by this IDE.' }
  ] }
];

var CIE_EXAMPLES = [
  { id: 'grade', name: 'Grade checker', input: 'Amira\n64', code: [
    '// Grade checker',
    'DECLARE Name : STRING',
    'DECLARE Mark : INTEGER',
    'DECLARE Grade : CHAR',
    '',
    'OUTPUT "Enter name and mark"',
    'INPUT Name',
    'INPUT Mark',
    '',
    'IF Mark >= 70',
    '  THEN',
    '    Grade ← \'A\'',
    '  ELSE',
    '    IF Mark >= 50',
    '      THEN',
    '        Grade ← \'B\'',
    '      ELSE',
    '        Grade ← \'C\'',
    '    ENDIF',
    'ENDIF',
    '',
    'OUTPUT Name, " got grade ", Grade'] },
  { id: 'times', name: 'Times table', input: '7', code: [
    '// Times table',
    'DECLARE Number : INTEGER',
    'DECLARE Count : INTEGER',
    '',
    'INPUT Number',
    'FOR Count ← 1 TO 12',
    '    OUTPUT Count, " x ", Number, " = ", Count * Number',
    'NEXT Count'] },
  { id: 'validate', name: 'Range check', input: '150\n-3\n42', code: [
    '// Keep asking until the age is in range',
    'DECLARE Age : INTEGER',
    '',
    'REPEAT',
    '    OUTPUT "Enter an age from 0 to 120"',
    '    INPUT Age',
    '    IF Age < 0 OR Age > 120',
    '      THEN',
    '        OUTPUT "Out of range, try again"',
    '    ENDIF',
    'UNTIL Age >= 0 AND Age <= 120',
    '',
    'OUTPUT "Age accepted: ", Age'] },
  { id: 'bubble', name: 'Bubble sort', input: '', code: [
    '// Bubble sort with a swap flag',
    'DECLARE Numbers : ARRAY[1:6] OF INTEGER',
    'DECLARE Swapped : BOOLEAN',
    'DECLARE Temp, Index, Last : INTEGER',
    '',
    'Numbers[1] ← 31',
    'Numbers[2] ← 7',
    'Numbers[3] ← 19',
    'Numbers[4] ← 2',
    'Numbers[5] ← 25',
    'Numbers[6] ← 11',
    '',
    'Last ← 5',
    'REPEAT',
    '    Swapped ← FALSE',
    '    FOR Index ← 1 TO Last',
    '        IF Numbers[Index] > Numbers[Index + 1]',
    '          THEN',
    '            Temp ← Numbers[Index]',
    '            Numbers[Index] ← Numbers[Index + 1]',
    '            Numbers[Index + 1] ← Temp',
    '            Swapped ← TRUE',
    '        ENDIF',
    '    NEXT Index',
    '    Last ← Last - 1',
    'UNTIL NOT Swapped',
    '',
    'FOR Index ← 1 TO 6',
    '    OUTPUT Numbers[Index]',
    'NEXT Index'] },
  { id: 'search', name: 'Linear search function', input: 'Kofi', code: [
    '// Linear search in a FUNCTION',
    'DECLARE Names : ARRAY[1:5] OF STRING',
    'DECLARE Target : STRING',
    'DECLARE Position : INTEGER',
    '',
    'FUNCTION Find(Wanted : STRING) RETURNS INTEGER',
    '    DECLARE i : INTEGER',
    '    FOR i ← 1 TO 5',
    '        IF Names[i] = Wanted',
    '          THEN',
    '            RETURN i',
    '        ENDIF',
    '    NEXT i',
    '    RETURN -1',
    'ENDFUNCTION',
    '',
    'Names[1] ← "Ama"',
    'Names[2] ← "Ben"',
    'Names[3] ← "Chen"',
    'Names[4] ← "Kofi"',
    'Names[5] ← "Lina"',
    '',
    'INPUT Target',
    'Position ← Find(Target)',
    'IF Position = -1',
    '  THEN',
    '    OUTPUT Target, " not found"',
    '  ELSE',
    '    OUTPUT Target, " is at position ", Position',
    'ENDIF'] },
  { id: 'strings', name: 'String functions', input: 'Programming', code: [
    '// Count the vowels in a word',
    'DECLARE Word, Letter : STRING',
    'DECLARE Vowels, i : INTEGER',
    '',
    'INPUT Word',
    'Vowels ← 0',
    'FOR i ← 1 TO LENGTH(Word)',
    '    Letter ← LCASE(SUBSTRING(Word, i, 1))',
    '    IF Letter = "a" OR Letter = "e" OR Letter = "i" OR Letter = "o" OR Letter = "u"',
    '      THEN',
    '        Vowels ← Vowels + 1',
    '    ENDIF',
    'NEXT i',
    '',
    'OUTPUT UCASE(Word), " has ", Vowels, " vowels"',
    '// 9618 versions of the same functions:',
    'OUTPUT LEFT(Word, 3), " ... ", RIGHT(Word, 3), " ... ", MID(Word, 4, 4)'] },
  { id: 'menu', name: 'CASE menu', input: '2\n6\n3', code: [
    '// Menu choice with CASE OF',
    'DECLARE Choice : INTEGER',
    'DECLARE Total : REAL',
    '',
    'Total ← 0',
    'REPEAT',
    '    INPUT Choice',
    '    CASE OF Choice',
    '        1 : Total ← Total + 2.50',
    '        2 : Total ← Total + 1.75',
    '        3 : OUTPUT "Done"',
    '        OTHERWISE : OUTPUT "Choose 1, 2 or 3"',
    '    ENDCASE',
    'UNTIL Choice = 3',
    '',
    'OUTPUT "Total: ", ROUND(Total, 2)'] },
  { id: 'records', name: 'Records and BYREF (9618)', input: '', code: [
    '// A record type and a BYREF parameter',
    'TYPE Student',
    '    DECLARE Name : STRING',
    '    DECLARE Score : INTEGER',
    'ENDTYPE',
    '',
    'DECLARE Class : ARRAY[1:3] OF Student',
    'DECLARE Best, i : INTEGER',
    '',
    'PROCEDURE Raise(Bonus : INTEGER, BYREF Mark : INTEGER)',
    '    Mark ← Mark + Bonus',
    'ENDPROCEDURE',
    '',
    'Class[1].Name ← "Ama"',
    'Class[1].Score ← 61',
    'Class[2].Name ← "Ben"',
    'Class[2].Score ← 74',
    'Class[3].Name ← "Chen"',
    'Class[3].Score ← 58',
    '',
    'CALL Raise(5, Class[3].Score)',
    'Best ← 1',
    'FOR i ← 2 TO 3',
    '    IF Class[i].Score > Class[Best].Score',
    '      THEN',
    '        Best ← i',
    '    ENDIF',
    'NEXT i',
    'OUTPUT "Top: ", Class[Best].Name, " with ", Class[Best].Score'] },
  { id: 'files', name: 'Text files (9618)', input: '', code: [
    '// Write lines to a file, then read them back',
    'DECLARE LineOfText : STRING',
    'DECLARE Count : INTEGER',
    '',
    'OPENFILE "scores.txt" FOR WRITE',
    'WRITEFILE "scores.txt", "Ama,61"',
    'WRITEFILE "scores.txt", "Ben,74"',
    'WRITEFILE "scores.txt", "Chen,58"',
    'CLOSEFILE "scores.txt"',
    '',
    'Count ← 0',
    'OPENFILE "scores.txt" FOR READ',
    'WHILE NOT EOF("scores.txt")',
    '    READFILE "scores.txt", LineOfText',
    '    Count ← Count + 1',
    '    OUTPUT Count, ": ", LineOfText',
    'ENDWHILE',
    'CLOSEFILE "scores.txt"'] },
  { id: 'bug', name: 'Find the bug', input: '', code: [
    '// This program has a bug. Run it, then use the debugger.',
    'DECLARE Temps : ARRAY[1:4] OF REAL',
    'DECLARE Total : REAL',
    'DECLARE i : INTEGER',
    '',
    'Temps[1] ← 18.5',
    'Temps[2] ← 21.0',
    'Temps[3] ← 19.5',
    'Temps[4] ← 23.0',
    '',
    'Total ← 0',
    'FOR i ← 0 TO 4',
    '    Total ← Total + Temps[i]',
    'NEXT i',
    'OUTPUT "Average: ", Total / 4'] }
];
CIE_EXAMPLES.forEach(function (e) { e.code = e.code.join('\n') + '\n'; });

var PY_EXAMPLES = [
  { id: 'grade', name: 'Grade checker', input: 'Amira\n64', code: [
    '# Grade checker',
    'name = input("Name: ")',
    'mark = int(input("Mark: "))',
    '',
    'if mark >= 70:',
    '    grade = "A"',
    'elif mark >= 50:',
    '    grade = "B"',
    'else:',
    '    grade = "C"',
    '',
    'print(f"{name} got grade {grade}")'] },
  { id: 'times', name: 'Times table', input: '7', code: [
    '# Times table',
    'number = int(input("Which table? "))',
    '',
    'for count in range(1, 13):',
    '    print(count, "x", number, "=", count * number)'] },
  { id: 'guess', name: 'Guessing game', input: '5\n3\n8\n1\n2\n4\n6\n7\n9\n10', code: [
    '# Guess the number from 1 to 10',
    'import random',
    '',
    'secret = random.randint(1, 10)',
    'guesses = 0',
    'guess = 0',
    '',
    'while guess != secret:',
    '    guess = int(input("Guess: "))',
    '    guesses += 1',
    '    if guess < secret:',
    '        print("Too low")',
    '    elif guess > secret:',
    '        print("Too high")',
    '',
    'print("Correct in", guesses, "guesses")'] },
  { id: 'bubble', name: 'Bubble sort', input: '', code: [
    '# Bubble sort with a swap flag',
    'numbers = [31, 7, 19, 2, 25, 11]',
    'last = len(numbers) - 1',
    'swapped = True',
    '',
    'while swapped:',
    '    swapped = False',
    '    for i in range(last):',
    '        if numbers[i] > numbers[i + 1]:',
    '            numbers[i], numbers[i + 1] = numbers[i + 1], numbers[i]',
    '            swapped = True',
    '    last -= 1',
    '',
    'print(numbers)'] },
  { id: 'search', name: 'Linear search function', input: 'Kofi', code: [
    '# Linear search in a function',
    'def find(items, wanted):',
    '    for i in range(len(items)):',
    '        if items[i] == wanted:',
    '            return i',
    '    return -1',
    '',
    'names = ["Ama", "Ben", "Chen", "Kofi", "Lina"]',
    'target = input("Name to find: ")',
    'position = find(names, target)',
    '',
    'if position == -1:',
    '    print(target, "not found")',
    'else:',
    '    print(target, "is at index", position)'] },
  { id: 'validate', name: 'Input validation', input: 'twelve\n150\n42', code: [
    '# Keep asking until the input is a valid age',
    'while True:',
    '    try:',
    '        age = int(input("Age: "))',
    '    except ValueError:',
    '        print("Please type a whole number")',
    '        continue',
    '    if 0 <= age <= 120:',
    '        break',
    '    print("Out of range, try again")',
    '',
    'print("Age accepted:", age)'] },
  { id: 'words', name: 'Word counter', input: 'the cat sat on the mat the end', code: [
    '# Count words with a dictionary',
    'text = input("Sentence: ").lower()',
    'counts = {}',
    '',
    'for word in text.split():',
    '    counts[word] = counts.get(word, 0) + 1',
    '',
    'for word, n in sorted(counts.items()):',
    '    print(f"{word:<6}{n:>3}")'] },
  { id: 'bug', name: 'Find the bug', input: '18.5\n21\n19.5\n23', code: [
    '# This program has a bug. Run it, then use the debugger.',
    'temps = []',
    'for i in range(4):',
    '    temps.append(float(input()))',
    '',
    'total = 0',
    'for t in temps:',
    '    total = total + t',
    '',
    'average = total / len(temps)',
    'print("Average: " + average)'] }
];
PY_EXAMPLES.forEach(function (e) { e.code = e.code.join('\n') + '\n'; });

var CIE_GUIDE = [
  { section: 'Variables and input/output', items: [
    { title: 'Declare', code: 'DECLARE Total : INTEGER\nDECLARE Name : STRING', note: 'Types: INTEGER, REAL, CHAR, STRING, BOOLEAN, DATE. Declare a variable before you use it.' },
    { title: 'Assign', code: 'Total ← 0\nName ← "Sam"', note: 'Type <- for the arrow. Both work in this IDE.' },
    { title: 'Constant', code: 'CONSTANT VAT ← 0.2', note: '0478/2210 writes ←, 9618 writes =. Both are accepted.' },
    { title: 'Input and output', code: 'OUTPUT "Enter your name"\nINPUT Name\nOUTPUT "Hello ", Name', note: 'OUTPUT joins the items you list with commas. No spaces are added.' },
    { title: 'Comment', code: '// This line is ignored', note: '' }
  ] },
  { section: 'Selection', items: [
    { title: 'IF ... ENDIF', code: 'IF Mark >= 50\n  THEN\n    OUTPUT "Pass"\n  ELSE\n    OUTPUT "Fail"\nENDIF', note: 'THEN can go at the end of the IF line or on the next line. There is no ELSE IF: put another IF inside ELSE.' },
    { title: 'CASE OF', code: 'CASE OF Choice\n    1 : OUTPUT "Add"\n    2 : OUTPUT "Delete"\n    3 TO 5 : OUTPUT "Other"\n    OTHERWISE : OUTPUT "Invalid"\nENDCASE', note: 'A branch can be a single value or a range with TO. OTHERWISE is optional and goes last.' }
  ] },
  { section: 'Iteration', items: [
    { title: 'FOR ... NEXT', code: 'FOR Count ← 1 TO 10\n    OUTPUT Count\nNEXT Count', note: 'Add STEP 2 or STEP -1 after the end value.' },
    { title: 'WHILE ... ENDWHILE', code: 'WHILE Total < 100 DO\n    Total ← Total + 10\nENDWHILE', note: 'Checked first, so the body may run zero times. DO is optional (9618 leaves it out).' },
    { title: 'REPEAT ... UNTIL', code: 'REPEAT\n    INPUT Age\nUNTIL Age >= 0 AND Age <= 120', note: 'The body always runs at least once.' }
  ] },
  { section: 'Arrays', items: [
    { title: '1D array', code: 'DECLARE Scores : ARRAY[1:5] OF INTEGER\nScores[1] ← 12', note: 'You choose the bounds. Cambridge arrays usually start at 1.' },
    { title: '2D array', code: 'DECLARE Grid : ARRAY[1:3, 1:4] OF CHAR\nGrid[2, 3] ← \'X\'', note: 'Row first, then column, separated by a comma.' },
    { title: 'Loop over an array', code: 'Total ← 0\nFOR i ← 1 TO 5\n    Total ← Total + Scores[i]\nNEXT i', note: '' }
  ] },
  { section: 'Procedures and functions', items: [
    { title: 'Procedure', code: 'PROCEDURE Greet(Name : STRING)\n    OUTPUT "Hi ", Name\nENDPROCEDURE\n\nCALL Greet("Ava")', note: 'Run a procedure with CALL.' },
    { title: 'Function', code: 'FUNCTION Square(N : INTEGER) RETURNS INTEGER\n    RETURN N * N\nENDFUNCTION\n\nOUTPUT Square(4)', note: 'A function states its RETURNS type and gives back a value.' },
    { title: 'BYREF (9618)', code: 'PROCEDURE AddOne(BYREF N : INTEGER)\n    N ← N + 1\nENDPROCEDURE', note: 'BYREF changes the caller\'s variable. BYVAL (the default) works on a copy. BYREF applies to every parameter after it, until BYVAL.' }
  ] },
  { section: 'Records and files (9618)', items: [
    { title: 'Record type', code: 'TYPE Book\n    DECLARE Title : STRING\n    DECLARE Pages : INTEGER\nENDTYPE\n\nDECLARE B : Book\nB.Title ← "Dune"', note: '' },
    { title: 'Text file', code: 'OPENFILE "data.txt" FOR WRITE\nWRITEFILE "data.txt", "first line"\nCLOSEFILE "data.txt"', note: 'Modes: READ, WRITE, APPEND. Files live in memory until the program ends and show in Variables.' },
    { title: 'Read to the end', code: 'OPENFILE "data.txt" FOR READ\nWHILE NOT EOF("data.txt")\n    READFILE "data.txt", Line\n    OUTPUT Line\nENDWHILE\nCLOSEFILE "data.txt"', note: '' }
  ] },
  { section: 'Operators', items: [
    { title: 'Arithmetic', code: '+  -  *  /  ^\nDIV(17, 5)  is 3\nMOD(17, 5)  is 2', note: '/ always gives a REAL. 17 DIV 5 and 17 MOD 5 also work.', noInsert: true },
    { title: 'Comparison and logic', code: '=  <>  <  <=  >  >=\nAND  OR  NOT', note: 'One = compares. <> means not equal.', noInsert: true },
    { title: 'Joining strings', code: 'FullName ← First & " " & Last', note: '& joins STRING and CHAR values. Convert numbers with NUM_TO_STR.', noInsert: true }
  ] },
  { section: 'Built-in functions: 0478 / 2210', items: [
    { title: 'LENGTH, UCASE, LCASE', code: 'N ← LENGTH("Happy")\nU ← UCASE("Happy")\nL ← LCASE("Happy")', note: 'LENGTH counts characters. UCASE and LCASE change the case.' },
    { title: 'SUBSTRING', code: 'S ← SUBSTRING("Happy Days", 1, 5)', note: 'Start position (from 1) and length. Gives "Happy".' },
    { title: 'ROUND and RANDOM', code: 'R ← ROUND(6.97354, 2)\nX ← RANDOM()', note: 'ROUND to a number of decimal places. RANDOM gives a REAL from 0 to 1.' }
  ] },
  { section: 'Built-in functions: 9618', items: [
    { title: 'LEFT, RIGHT, MID', code: 'L ← LEFT("ABCDEF", 3)\nR ← RIGHT("ABCDEF", 2)\nM ← MID("ABCDEF", 2, 3)', note: 'Gives "ABC", "EF" and "BCD".' },
    { title: 'TO_UPPER, TO_LOWER', code: 'U ← TO_UPPER("Hello")', note: 'Work on a STRING or CHAR. UCASE and LCASE work on a CHAR.' },
    { title: 'NUM_TO_STR, STR_TO_NUM, IS_NUM', code: 'S ← NUM_TO_STR(3.5)\nN ← STR_TO_NUM("42")\nOK ← IS_NUM("42a")', note: 'Check text with IS_NUM before converting it.' },
    { title: 'ASC and CHR', code: 'Code ← ASC(\'A\')\nC ← CHR(66)', note: 'Character codes: 65 and \'B\'.' },
    { title: 'INT and RAND', code: 'Whole ← INT(7.9)\nDice ← INT(RAND(6)) + 1', note: 'INT drops the decimal part. RAND(x) gives a REAL from 0 up to (not including) x.' },
    { title: 'Dates', code: 'D ← SETDATE(25, 12, 2025)\nOUTPUT DAY(D), MONTH(D), YEAR(D), DAYINDEX(D)\nToday ← NOW()', note: 'DAYINDEX gives 1 for Sunday to 7 for Saturday.' }
  ] }
];

var PY_GUIDE = [
  { section: 'Variables and input/output', items: [
    { title: 'Assign', code: 'score = 0\nname = "Sam"', note: 'Python creates the variable when you first assign it. Names are case-sensitive.' },
    { title: 'Output', code: 'print("Hello", name)\nprint("Total: " + str(total))\nprint(f"Total: {total}")', note: 'print puts a space between items. + only joins text to text, so convert numbers with str() or use an f-string.' },
    { title: 'Input', code: 'name = input("Name: ")\nage = int(input("Age: "))', note: 'input() always gives text. Convert with int() or float(). When input() runs, the console waits for you to type a value and press Enter.' },
    { title: 'Comment', code: '# This line is ignored', note: '' }
  ] },
  { section: 'Selection', items: [
    { title: 'if / elif / else', code: 'if mark >= 70:\n    grade = "A"\nelif mark >= 50:\n    grade = "B"\nelse:\n    grade = "C"', note: 'Each line that starts a block ends with a colon. The block is indented by 4 spaces.' },
    { title: 'Comparison and logic', code: '==  !=  <  <=  >  >=\nand  or  not\nif 0 <= age <= 120:', note: 'Use == to compare and = to assign.', noInsert: true }
  ] },
  { section: 'Iteration', items: [
    { title: 'for with range', code: 'for i in range(1, 11):\n    print(i)', note: 'range(1, 11) counts 1 to 10. The end value is not included.' },
    { title: 'for over a list', code: 'for name in names:\n    print(name)', note: '' },
    { title: 'while', code: 'count = 0\nwhile count < 5:\n    count += 1', note: 'Checked before each pass. break leaves the loop, continue skips to the next pass.' }
  ] },
  { section: 'Functions', items: [
    { title: 'Function with return', code: 'def square(n):\n    return n * n\n\narea = square(4)', note: 'A function without return gives back None.' },
    { title: 'Procedure-style function', code: 'def greet(name):\n    print("Hi", name)\n\ngreet("Ava")', note: '' },
    { title: 'Changing a global', code: 'count = 0\ndef add():\n    global count\n    count += 1', note: 'Without global, assigning inside a function makes a new local variable.' }
  ] },
  { section: 'Lists and strings', items: [
    { title: 'Create and index', code: 'scores = [12, 18, 9]\nprint(scores[0], scores[-1])', note: 'Indexes start at 0. -1 is the last item.' },
    { title: 'Change a list', code: 'scores.append(20)\nscores.insert(0, 5)\nscores.remove(18)\nlast = scores.pop()', note: '' },
    { title: 'Slicing', code: 'word = "Python"\nprint(word[0:3], word[::-1])', note: '[start:end] stops before end. [::-1] reverses.' },
    { title: '2D list', code: 'grid = [[1, 2], [3, 4]]\nprint(grid[1][0])', note: 'Row first, then column. This shows 3.' },
    { title: 'String methods', code: 'text.upper()  text.lower()  text.strip()\ntext.split(",")  ", ".join(items)\ntext.replace("a", "b")  len(text)', note: 'Strings cannot be changed in place. Methods return a new string.', noInsert: true }
  ] },
  { section: 'Dictionaries', items: [
    { title: 'Create and use', code: 'ages = {"Ama": 15, "Ben": 16}\nages["Chen"] = 15\nprint(ages.get("Dan", 0))', note: 'get() gives a default instead of a KeyError.' },
    { title: 'Loop over items', code: 'for name, age in ages.items():\n    print(name, age)', note: '' }
  ] },
  { section: 'Validation and errors', items: [
    { title: 'try / except', code: 'try:\n    age = int(input("Age: "))\nexcept ValueError:\n    print("Not a whole number")', note: 'The except block runs when int() cannot convert the text.' }
  ] },
  { section: 'Built-ins and modules', items: [
    { title: 'Common built-ins', code: 'len(x)  range(n)  int(x)  float(x)  str(x)\nround(x, 2)  abs(x)  min(a)  max(a)  sum(a)\nsorted(a)  ord("A")  chr(65)', note: '', noInsert: true },
    { title: 'random', code: 'import random\ndice = random.randint(1, 6)\npick = random.choice(names)', note: 'randint includes both ends.' },
    { title: 'math', code: 'import math\nprint(math.sqrt(16), math.floor(2.7), math.pi)', note: 'The random, math and time modules are available.' }
  ] }
];

var LANGS = {
  edexcel: { id: 'edexcel', name: 'Edexcel pseudocode', short: 'Edexcel', ext: 'epc', engine: PS, examples: EXAMPLES, guide: GUIDE, inputWord: 'RECEIVE', findHint: 'FOR, array, RETURN...', kw: PS.KW, bi: PS.BUILTINS, re: /(#.*$)|("[^"]*"?|'[^']*'?)|(\d+(?:\.\d+)?)|([A-Za-z_][A-Za-z0-9_]*)|(\s+)|([^\sA-Za-z0-9_"'#])/g },
  cambridge: { id: 'cambridge', name: 'Cambridge pseudocode', short: 'Cambridge', ext: 'cpc', engine: CIE, examples: CIE_EXAMPLES, guide: CIE_GUIDE, inputWord: 'INPUT', findHint: 'CASE, ARRAY, MID...', kw: CIE.KW, bi: CIE.BUILTINS, re: /(\/\/.*$)|("[^"]*"?|'[^']*'?)|(\d+(?:\.\d+)?)|([A-Za-z_][A-Za-z0-9_]*)|(\s+)|([^\sA-Za-z0-9_"'])/g },
  python: { id: 'python', name: 'Python 3', short: 'Python', ext: 'py', engine: PY, examples: PY_EXAMPLES, guide: PY_GUIDE, inputWord: 'input()', findHint: 'for, list, def...', kw: PY.KW, bi: PY.BUILTINS, re: /(#.*$)|([rRbBuUfF]{0,2}(?:"(?:\\.|[^"\\])*"?|'(?:\\.|[^'\\])*'?))|(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([A-Za-z_][A-Za-z0-9_]*)|(\s+)|([^\sA-Za-z0-9_"'#])/g }
};
var CONVERT = (function () {
  var LNAME = { edexcel: 'Edexcel pseudocode', cambridge: 'Cambridge pseudocode', python: 'Python 3' };
  function Todo(msg) { this.msg = msg; }
  function bad(msg) { throw new Todo(msg); }
  function num(v, real) { return { k: 'num', v: v, real: !!real || !Number.isInteger(v) }; }
  function bi(name, args) { return { k: 'bi', name: name, args: args }; }
  function bin(op, a, b) { return { k: 'bin', op: op, a: a, b: b }; }
  function add(e, n) {
    if (n === 0) return e;
    if (e.k === 'num') return num(e.v + n, e.real);
    if (e.k === 'bin' && (e.op === '+' || e.op === '-') && e.b.k === 'num' && !e.b.real) {
      var v = (e.op === '+' ? e.b.v : -e.b.v) + n;
      return v === 0 ? e.a : v > 0 ? bin('+', e.a, num(v)) : bin('-', e.a, num(-v));
    }
    return n > 0 ? bin('+', e, num(n)) : bin('-', e, num(-n));
  }
  function minus(a, b) { if (b.k === 'num') return add(a, -b.v); return bin('-', a, b); }
  function plus(a, b) { if (b.k === 'num') return add(a, b.v); if (a.k === 'num') return add(b, a.v); return bin('+', a, b); }
  function isStrT(t) { return t === 'STRING' || t === 'CHAR'; }
  function walkStmts(body, fn) {
    body.forEach(function (s) {
      fn(s);
      ['then', 'els', 'body', 'other'].forEach(function (k) { if (s[k]) walkStmts(s[k], fn); });
      if (s.clauses) s.clauses.forEach(function (c) { walkStmts(c.body, fn); });
    });
  }
  function assignedNames(body) {
    var out = [];
    walkStmts(body, function (s) {
      var n = s.k === 'assign' || s.k === 'input' ? (s.target.k === 'var' ? s.target.name : null) : s.k === 'for' || s.k === 'foreach' ? s.var : s.k === 'declare' || s.k === 'const' ? s.name : null;
      if (n && out.indexOf(n) < 0) out.push(n);
    });
    return out;
  }

  /* ================= front ends ================= */
  function fromEdexcel(prog) {
    function ex(e) {
      switch (e.t) {
        case 'num': return num(e.v);
        case 'str': return { k: 'str', v: e.v };
        case 'bool': return { k: 'bool', v: e.v };
        case 'arr': return { k: 'arr', items: e.items.map(ex) };
        case 'var': return { k: 'var', name: e.name };
        case 'idx': return { k: 'idx', obj: ex(e.obj), index: [ex(e.index)] };
        case 'call': {
          var a = e.args.map(ex);
          if (e.name === 'LENGTH') return bi('LENGTH', a);
          if (e.name === 'RANDOM') return bi('RANDOMINT', [num(0), a[0]]);
          if (e.name === 'INT') return bi('INT', a);
          if (e.name === 'STR') return bi('STR', a);
          return { k: 'call', name: e.name, args: a };
        }
        case 'un': return { k: 'un', op: e.op, a: ex(e.a) };
        case 'bin': return bin(e.op, ex(e.a), ex(e.b));
      }
      bad('expression');
    }
    function st(s) {
      var L = s.line;
      switch (s.t) {
        case 'set': return [{ k: 'assign', target: ex(s.target), expr: ex(s.expr), line: L }];
        case 'send': return [{ k: 'output', items: s.items.map(ex), sep: ' ', line: L }];
        case 'recv': return [{ k: 'input', target: { k: 'var', name: s.name }, type: s.type === 'CHARACTER' ? 'CHAR' : s.type, line: L }];
        case 'if': return [{ k: 'if', cond: ex(s.cond), then: bl(s.then), els: s.els ? bl(s.els) : null, line: L }];
        case 'while': return [{ k: 'while', cond: ex(s.cond), body: bl(s.body), line: L }];
        case 'until': return [{ k: 'repeat', body: bl(s.body), cond: ex(s.cond), line: L }];
        case 'times': return [{ k: 'times', count: ex(s.count), body: bl(s.body), line: L }];
        case 'for': return [{ k: 'for', v: s.name, from: ex(s.from), to: ex(s.to), step: s.step ? ex(s.step) : null, body: bl(s.body), line: L }];
        case 'foreach': return [{ k: 'foreach', v: s.name, src: ex(s.src), body: bl(s.body), line: L }];
        case 'call': return [{ k: 'call', name: s.name, args: s.args.map(ex), line: L }];
        case 'return': return [{ k: 'return', expr: s.expr ? ex(s.expr) : null, line: L }];
      }
      bad('statement');
    }
    function bl(b) { return guard(b, st); }
    var main = bl(prog.body), mainNames = assignedNames(main);
    var subs = Object.keys(prog.funcs).map(function (k) {
      var f = prog.funcs[k], body = bl(f.body);
      var locals = assignedNames(body).filter(function (n) { return mainNames.indexOf(n) < 0 && f.params.indexOf(n) < 0; });
      return { name: f.name, params: f.params.map(function (p) { return { name: p, type: null }; }), isFunc: f.isFunc, rtype: null, body: body, line: f.line, locals: locals };
    }).sort(function (a, b) { return a.line - b.line; });
    return { subs: subs, main: main };
  }

  function fromCambridge(prog) {
    var canon = {};
    function cn(n) { var k = n.toLowerCase(); if (!canon[k]) canon[k] = n; return canon[k]; }
    function lit(e) { return e.t === 'num' ? e.v : e.t === 'un' && e.op === '-' && e.a.t === 'num' ? -e.a.v : null; }
    function ty(t) {
      if (!t) return null;
      if (t.base) return t.base;
      if (t.arr) return { arr: true, el: ty(t.el), dims: t.dims ? t.dims.map(function (d) { return [lit(d[0]), lit(d[1])]; }) : null };
      return { rec: t.rec };
    }
    function ex(e) {
      switch (e.t) {
        case 'num': return num(e.v);
        case 'str': return { k: 'str', v: e.v };
        case 'bool': return { k: 'bool', v: e.v };
        case 'var': return { k: 'var', name: cn(e.name) };
        case 'idx': return { k: 'idx', obj: ex(e.obj), index: e.index.map(ex) };
        case 'field': bad('record field');
        case 'call': {
          var up = e.name.toUpperCase(), a = e.args.map(ex), user = prog.procs[e.name.toLowerCase()];
          if (user) return { k: 'call', name: user.name, args: a };
          switch (up) {
            case 'LENGTH': return bi('LENGTH', a);
            case 'UCASE': case 'TO_UPPER': return bi('UPPER', a);
            case 'LCASE': case 'TO_LOWER': return bi('LOWER', a);
            case 'SUBSTRING': case 'MID': return bi('MID', a);
            case 'LEFT': case 'RIGHT': case 'ASC': case 'CHR': case 'INT': case 'ROUND': return bi(up, a);
            case 'NUM_TO_STR': return bi('STR', a);
            case 'STR_TO_NUM': return bi('NUM', a);
            case 'IS_NUM': return bi('ISNUM', a);
            case 'RAND': return bi('RANDREAL', a);
            case 'RANDOM': return bi('RANDREAL', [num(1)]);
            case 'DIV': case 'MOD': return bin(up, a[0], a[1]);
          }
          bad(up);
        }
        case 'un': return { k: 'un', op: e.op, a: ex(e.a) };
        case 'bin': return bin(e.op, ex(e.a), ex(e.b));
      }
      bad('expression');
    }
    function st(s) {
      var L = s.line;
      switch (s.t) {
        case 'declare': return s.names.map(function (n) { var t = ty(s.type); if (t && t.rec) bad('record'); return { k: 'declare', name: cn(n), type: t, line: L }; });
        case 'const': return [{ k: 'const', name: cn(s.name), expr: ex(s.expr), line: L }];
        case 'assign': return [{ k: 'assign', target: ex(s.target), expr: ex(s.expr), line: L }];
        case 'input': return [{ k: 'input', target: ex(s.target), type: null, line: L }];
        case 'output': return [{ k: 'output', items: s.items.map(ex), sep: '', line: L }];
        case 'if': return [{ k: 'if', cond: ex(s.cond), then: bl(s.then), els: s.els ? bl(s.els) : null, line: L }];
        case 'case': return [{ k: 'case', expr: ex(s.expr), line: L, other: s.other ? bl(s.other.body) : null,
          clauses: s.clauses.filter(function (c) { return !c.other; }).map(function (c) { return { vals: c.vals.map(function (v) { return v.lo ? { lo: ex(v.lo), hi: ex(v.hi) } : { v: ex(v.v) }; }), body: bl(c.body), line: c.line }; }) }];
        case 'for': return [{ k: 'for', v: cn(s.name), from: ex(s.from), to: ex(s.to), step: s.step ? ex(s.step) : null, body: bl(s.body), line: L }];
        case 'while': return [{ k: 'while', cond: ex(s.cond), body: bl(s.body), line: L }];
        case 'repeat': return [{ k: 'repeat', body: bl(s.body), cond: ex(s.cond), line: L }];
        case 'call': { var p = prog.procs[s.name.toLowerCase()]; return [{ k: 'call', name: p ? p.name : s.name, args: s.args.map(ex), line: L }]; }
        case 'return': return [{ k: 'return', expr: ex(s.expr), line: L }];
      }
      bad('statement');
    }
    function bl(b) { return guard(b, st); }
    var main = bl(prog.body);
    var subs = Object.keys(prog.procs).map(function (k) {
      var p = prog.procs[k], body = bl(p.body), locals = [];
      walkStmts(body, function (s) { if (s.k === 'declare' || s.k === 'const') locals.push(s.name); });
      return { name: p.name, params: p.params.map(function (q) { return { name: cn(q.name), type: ty(q.type), byref: q.byref }; }), isFunc: p.isFunc, rtype: ty(p.rtype), body: body, line: p.line, locals: locals };
    }).sort(function (a, b) { return a.line - b.line; });
    var notes = Object.keys(prog.types).length ? [{ k: 'todo', text: 'record TYPE definitions are not converted', line: 0 }] : [];
    return { subs: subs, main: notes.concat(main) };
  }

  function fromPython(prog) {
    function isCall(e, name) { return e && e.t === 'call' && e.fn.t === 'name' && e.fn.id === name; }
    function ex(e) {
      switch (e.t) {
        case 'const':
          if (typeof e.v === 'bigint') return num(Number(e.v));
          if (typeof e.v === 'number') return num(e.v, true);
          if (typeof e.v === 'string') return { k: 'str', v: e.v };
          if (typeof e.v === 'boolean') return { k: 'bool', v: e.v };
          bad('None');
        case 'name': return { k: 'var', name: e.id };
        case 'list': return { k: 'arr', items: e.items.map(ex) };
        case 'fstr': return { k: 'concat', parts: e.parts.map(function (p) {
          if (p.lit !== undefined) return { k: 'str', v: p.lit };
          var v = ex(p.expr), m;
          if (!p.spec && !p.conv) return v;
          if ((m = /^\.(\d+)f$/.exec(p.spec))) return bi('ROUND', [v, num(+m[1])]);
          bad('format');
        }) };
        case 'bin': {
          var op = { '+': '+', '-': '-', '*': '*', '/': '/', '//': 'DIV', '%': 'MOD', '**': '^' }[e.op];
          if (!op) bad(e.op); return bin(op, ex(e.a), ex(e.b));
        }
        case 'unary': if (e.op === '-') return { k: 'un', op: '-', a: ex(e.a) }; if (e.op === '+') return ex(e.a); bad('~');
        case 'not': return { k: 'un', op: 'NOT', a: ex(e.a) };
        case 'bool': return bin(e.op === 'and' ? 'AND' : 'OR', ex(e.a), ex(e.b));
        case 'cmp': {
          var parts = [], left = ex(e.a);
          for (var i = 0; i < e.ops.length; i++) {
            var o = { '==': '=', '!=': '<>', '<': '<', '<=': '<=', '>': '>', '>=': '>=' }[e.ops[i]];
            if (!o) bad(e.ops[i]);
            var right = ex(e.rest[i]); parts.push(bin(o, left, right)); left = right;
          }
          return parts.reduce(function (a, b) { return bin('AND', a, b); });
        }
        case 'sub': {
          var obj = ex(e.obj);
          if (e.index.t === 'unary' && e.index.op === '-' && e.index.a.t === 'const') return { k: 'idx', obj: obj, index: [minus(bi('LENGTH', [obj]), num(Number(e.index.a.v)))] };
          return { k: 'idx', obj: obj, index: [ex(e.index)] };
        }
        case 'slice': {
          if (e.step) bad('slice step');
          var s = ex(e.obj);
          if (!e.lo && e.hi) return bi('LEFT', [s, ex(e.hi)]);
          if (e.lo && !e.hi) {
            if (e.lo.t === 'unary' && e.lo.op === '-' && e.lo.a.t === 'const') return bi('RIGHT', [s, num(Number(e.lo.a.v))]);
            return bi('RIGHT', [s, minus(bi('LENGTH', [s]), ex(e.lo))]);
          }
          if (e.lo && e.hi) { var lo = ex(e.lo); return bi('MID', [s, add(lo, 1), minus(ex(e.hi), lo)]); }
          bad('slice');
        }
        case 'call': {
          if (e.kw.length || e.star.length) bad('keyword arguments');
          var a = e.args.map(ex), f = e.fn;
          if (f.t === 'name') {
            switch (f.id) {
              case 'len': return bi('LENGTH', a);
              case 'int': return bi('INT', a);
              case 'float': return bi('NUM', a);
              case 'str': return bi('STR', a);
              case 'round': return bi('ROUND', a.length > 1 ? a : [a[0], num(0)]);
              case 'ord': return bi('ASC', a);
              case 'chr': return bi('CHR', a);
              case 'randint': return bi('RANDOMINT', a);
              case 'random': return bi('RANDREAL', [num(1)]);
            }
            if (users[f.id]) return { k: 'call', name: f.id, args: a };
            bad(f.id + '()');
          }
          if (f.t === 'attr') {
            if (f.obj.t === 'name' && f.obj.id === 'random') {
              if (f.name === 'randint') return bi('RANDOMINT', a);
              if (f.name === 'random') return bi('RANDREAL', [num(1)]);
            }
            var o2 = ex(f.obj);
            if (f.name === 'upper') return bi('UPPER', [o2]);
            if (f.name === 'lower') return bi('LOWER', [o2]);
            if (f.name === 'isdigit' || f.name === 'isnumeric') return bi('ISNUM', [o2]);
            bad('.' + f.name + '()');
          }
          bad('call');
        }
      }
      bad(e.t);
    }
    function same(x, y) { var k = function (_, v) { return typeof v === 'bigint' ? v.toString() + 'n' : v; }; return JSON.stringify(x, k) === JSON.stringify(y, k); }
    function inputCall(v) {
      if (isCall(v, 'input')) return { type: 'STRING', prompt: v.args[0] ? ex(v.args[0]) : null };
      if ((isCall(v, 'int') || isCall(v, 'float')) && v.args.length === 1 && isCall(v.args[0], 'input')) return { type: v.fn.id === 'int' ? 'INTEGER' : 'REAL', prompt: v.args[0].args[0] ? ex(v.args[0].args[0]) : null };
      return null;
    }
    function hasBreak(body) { var f = false; (function w(b) { b.forEach(function (s) { if (s.t === 'break') f = true; if (s.t === 'if') { s.tests.forEach(function (t) { w(t.body); }); if (s.orelse) w(s.orelse); } if (s.t === 'try') w(s.body); }); })(body); return f; }
    function st(s) {
      var L = s.line;
      switch (s.t) {
        case 'expr': {
          var v = s.value;
          if (isCall(v, 'print')) {
            var sep = ' ';
            v.kw.forEach(function (k) { if (k.name === 'sep') { if (k.value.t === 'const' && k.value.v === '') sep = ''; else bad('sep'); } else if (k.name !== 'end') bad(k.name); });
            if (v.star.length) bad('*args');
            return [{ k: 'output', items: v.args.length ? v.args.map(ex) : [{ k: 'str', v: '' }], sep: sep, line: L }];
          }
          if (v.t === 'call' && v.fn.t === 'name' && users[v.fn.id]) return [{ k: 'call', name: v.fn.id, args: v.args.map(ex), line: L }];
          bad('expression statement');
        }
        case 'assign': {
          if (s.targets.length !== 1) bad('chained assignment');
          var t = s.targets[0];
          if (t.t === 'tuple' || t.t === 'list') {
            var vv = s.value;
            if (t.items.length === 2 && (vv.t === 'tuple' || vv.t === 'list') && vv.items.length === 2 && same(vv.items[0], t.items[1]) && same(vv.items[1], t.items[0])) {
              var a0 = ex(t.items[0]), a1 = ex(t.items[1]), tmp = { k: 'var', name: 'temp' };
              return [{ k: 'assign', target: tmp, expr: a0, line: L }, { k: 'assign', target: a0, expr: a1, line: L }, { k: 'assign', target: a1, expr: tmp, line: L }];
            }
            bad('tuple assignment');
          }
          if (t.t === 'attr') bad('attribute');
          var ic = inputCall(s.value);
          if (ic) return [{ k: 'input', target: ex(t), type: ic.type, prompt: ic.prompt, line: L }];
          return [{ k: 'assign', target: ex(t), expr: ex(s.value), line: L }];
        }
        case 'aug': { var tg = ex(s.target), op = { '+': '+', '-': '-', '*': '*', '/': '/', '//': 'DIV', '%': 'MOD', '**': '^' }[s.op]; if (!op) bad(s.op); return [{ k: 'assign', target: tg, expr: bin(op, tg, ex(s.value)), line: L }]; }
        case 'if': {
          var chain = function (i) {
            var tc = s.tests[i];
            return { k: 'if', cond: ex(tc.cond), then: bl(tc.body), els: i + 1 < s.tests.length ? [chain(i + 1)] : s.orelse ? bl(s.orelse) : null, line: tc.line };
          };
          return [chain(0)];
        }
        case 'while': {
          if (s.orelse) bad('while ... else');
          var last = s.body[s.body.length - 1];
          if (s.cond.t === 'const' && s.cond.v === true && last && last.t === 'if' && last.tests.length === 1 && !last.orelse && last.tests[0].body.length === 1 && last.tests[0].body[0].t === 'break' && !hasBreak(s.body.slice(0, -1)))
            return [{ k: 'repeat', body: bl(s.body.slice(0, -1)), cond: ex(last.tests[0].cond), line: L }];
          return [{ k: 'while', cond: ex(s.cond), body: bl(s.body), line: L }];
        }
        case 'for': {
          if (s.orelse) bad('for ... else');
          if (s.target.t !== 'name') bad('loop target');
          if (isCall(s.iter, 'range')) {
            var ra = s.iter.args.map(ex), from = ra.length > 1 ? ra[0] : num(0), end = ra.length > 1 ? ra[1] : ra[0], step = ra.length > 2 ? ra[2] : null;
            var neg = step && ((step.k === 'num' && step.v < 0) || (step.k === 'un' && step.op === '-'));
            if (step && step.k !== 'num' && !neg) bad('range step');
            return [{ k: 'for', v: s.target.id, from: from, to: add(end, neg ? 1 : -1), step: step && step.k === 'un' ? num(-step.a.v) : step, body: bl(s.body), line: L }];
          }
          return [{ k: 'foreach', v: s.target.id, src: ex(s.iter), body: bl(s.body), line: L }];
        }
        case 'return': return [{ k: 'return', expr: s.value ? ex(s.value) : null, line: L }];
        case 'pass': case 'global': case 'import': case 'from': return [];
        case 'try': return [{ k: 'todo', text: 'try / except is not converted; the try block is kept below', line: L }].concat(bl(s.body));
        case 'def': bad('nested def');
      }
      bad(s.t);
    }
    function bl(b) { return guard(b, st); }
    var users = {}, subs = [], mainSrc = [];
    prog.body.forEach(function (s) { if (s.t === 'def') users[s.name] = s; else mainSrc.push(s); });
    Object.keys(users).forEach(function (k) {
      var d = users[k], body = bl(d.body), isFunc = false;
      walkStmts(body, function (x) { if (x.k === 'return' && x.expr) isFunc = true; });
      var ps = d.params.map(function (p) { return p.name; });
      var locals = Object.keys(d.locals).filter(function (n) { return ps.indexOf(n) < 0; });
      if (assignedNames(body).indexOf('temp') >= 0 && locals.indexOf('temp') < 0) locals.push('temp');
      subs.push({ name: d.name, params: ps.map(function (p) { return { name: p, type: null }; }), isFunc: isFunc, rtype: null, body: body, line: d.line, locals: locals });
    });
    return { subs: subs, main: bl(mainSrc) };
  }

  var CURSRC = null;
  function guard(body, st) {
    var out = [];
    body.forEach(function (s) {
      try { out = out.concat(st(s)); }
      catch (e) { if (!(e instanceof Todo)) throw e; out.push({ k: 'todo', text: srcText(s.line), why: e.msg, line: s.line, end: s.endLine }); }
    });
    return out;
  }
  function srcText(L) { return CURSRC && L ? CURSRC[L - 1].trim() : ''; }

  /* ================= types ================= */
  function Types(ir) {
    var G = {}, S = {}, order = [];
    ir.subs.forEach(function (s) { var p = {}; s.params.forEach(function (x) { p[x.name] = x.type || null; }); S[s.name] = { params: p, locals: {}, localNames: s.locals || [], ret: s.rtype || null, sub: s }; });
    function merge(o, t) {
      if (!t) return o; if (!o) return t;
      if (o === 'INTEGER' && t === 'REAL') return 'REAL';
      if (o.arr && t.arr) { var r = { arr: true, el: o.el || t.el, dims: o.dims || t.dims }; if (o.el && t.el) r.el = merge(o.el, t.el); return r; }
      return o;
    }
    function Env(sub) { this.s = sub ? S[sub] : null; }
    Env.prototype.where = function (n) { var s = this.s; if (s && Object.prototype.hasOwnProperty.call(s.params, n)) return s.params; if (s && s.localNames.indexOf(n) >= 0) return s.locals; return G; };
    Env.prototype.get = function (n) { return this.where(n)[n] || null; };
    Env.prototype.set = function (n, t, force) { var w = this.where(n); if (w === G && order.indexOf(n) < 0) order.push(n); w[n] = force ? t : merge(w[n] || null, t); };
    Env.prototype.touch = function (n) { var w = this.where(n); if (w === G && order.indexOf(n) < 0) order.push(n); if (!(n in w)) w[n] = null; };
    function T(e, env) {
      switch (e.k) {
        case 'num': return e.real ? 'REAL' : 'INTEGER';
        case 'str': case 'concat': return 'STRING';
        case 'bool': return 'BOOLEAN';
        case 'var': return env.get(e.name);
        case 'arr': {
          if (!e.items.length) return { arr: true, el: null, dims: null };
          var t0 = T(e.items[0], env);
          if (t0 && t0.arr) return { arr: true, el: t0.el, dims: [[0, e.items.length - 1]].concat(t0.dims || [[0, null]]) };
          return { arr: true, el: t0, dims: [[0, e.items.length - 1]] };
        }
        case 'idx': {
          var t = T(e.obj, env);
          if (isStrT(t)) return 'STRING';
          if (t && t.arr) { if (t.dims && e.index.length < t.dims.length) return { arr: true, el: t.el, dims: t.dims.slice(e.index.length) }; return t.el; }
          return null;
        }
        case 'call': return S[e.name] ? S[e.name].ret : null;
        case 'bi': return { LENGTH: 'INTEGER', UPPER: 'STRING', LOWER: 'STRING', MID: 'STRING', LEFT: 'STRING', RIGHT: 'STRING', STR: 'STRING', CHR: 'CHAR', NUM: 'REAL', INT: 'INTEGER', ROUND: 'REAL', RANDOMINT: 'INTEGER', RANDREAL: 'REAL', ASC: 'INTEGER', ISNUM: 'BOOLEAN' }[e.name] || null;
        case 'un': return e.op === 'NOT' ? 'BOOLEAN' : T(e.a, env);
        case 'bin': {
          var o = e.op;
          if (o === '&') return 'STRING';
          if (['=', '<>', '<', '<=', '>', '>=', 'AND', 'OR'].indexOf(o) >= 0) return 'BOOLEAN';
          var a = T(e.a, env), b = T(e.b, env);
          if (o === '+' && (isStrT(a) || isStrT(b))) return 'STRING';
          if (o === '/') return 'REAL';
          if (o === 'DIV' || o === 'MOD') return 'INTEGER';
          if (a === 'REAL' || b === 'REAL') return 'REAL';
          if (a === 'INTEGER' && b === 'INTEGER') return 'INTEGER';
          return a || b;
        }
      }
      return null;
    }
    function walk(body, env, sub) {
      body.forEach(function (s) {
        switch (s.k) {
          case 'assign':
            if (s.target.k === 'var') env.set(s.target.name, T(s.expr, env));
            else if (s.target.k === 'idx') {
              var b = s.target; while (b.k === 'idx') b = b.obj;
              if (b.k === 'var') { var bt = env.get(b.name), et = T(s.expr, env); env.set(b.name, bt && bt.arr ? { arr: true, el: merge(bt.el, et), dims: bt.dims } : { arr: true, el: et, dims: null }, true); }
            }
            break;
          case 'declare': env.set(s.name, s.type, true); break;
          case 'const': env.set(s.name, T(s.expr, env)); break;
          case 'input': if (s.target.k === 'var') { if (s.type) env.set(s.target.name, s.type); else env.touch(s.target.name); } break;
          case 'for': env.set(s.v, 'INTEGER'); break;
          case 'foreach': { var st = T(s.src, env); env.set(s.v, isStrT(st) ? 'CHAR' : st && st.arr ? st.el : null); break; }
          case 'call': if (S[s.name]) callArgs(s.name, s.args, env); break;
          case 'return': if (sub && s.expr) S[sub].ret = merge(S[sub].ret, T(s.expr, env)); break;
        }
        exprsOf(s).forEach(function (e) { walkCalls(e, env); });
        ['then', 'els', 'body', 'other'].forEach(function (k) { if (s[k]) walk(s[k], env, sub); });
        if (s.clauses) s.clauses.forEach(function (c) { walk(c.body, env, sub); });
      });
    }
    function callArgs(name, args, env) { var sp = S[name]; sp.sub.params.forEach(function (p, i) { if (args[i]) sp.params[p.name] = merge(sp.params[p.name], T(args[i], env)); }); }
    function walkCalls(e, env) {
      if (!e || typeof e !== 'object') return;
      if (e.k === 'call' && S[e.name]) callArgs(e.name, e.args, env);
      ['a', 'b', 'obj', 'expr'].forEach(function (k) { if (e[k]) walkCalls(e[k], env); });
      ['args', 'items', 'parts', 'index'].forEach(function (k) { if (e[k]) e[k].forEach(function (x) { walkCalls(x, env); }); });
    }
    for (var pass = 0; pass < 3; pass++) {
      walk(ir.main, new Env(null), null);
      ir.subs.forEach(function (s) { walk(s.body, new Env(s.name), s.name); });
    }
    return { G: G, S: S, order: order, T: T, env: function (sub) { return new Env(sub); } };
  }
  function exprsOf(s) {
    var out = [];
    ['cond', 'expr', 'from', 'to', 'step', 'count', 'src', 'prompt', 'target'].forEach(function (k) { if (s[k]) out.push(s[k]); });
    ['items', 'args'].forEach(function (k) { if (s[k]) out = out.concat(s[k]); });
    return out;
  }

  /* ================= output helpers ================= */
  function Out(cm) { this.lines = []; this.ind = 0; this.cm = cm; this.todos = 0; }
  Out.prototype.put = function (t) { this.lines.push(t === '' ? '' : new Array(this.ind + 1).join('    ') + t); };
  Out.prototype.note = function (t) { this.put(this.cm + ' ' + t); };
  Out.prototype.todo = function (t) { this.todos++; this.put(this.cm + ' TODO: ' + t); };
  Out.prototype.pre = function (s, first) { if (s.blank && !first && this.lines.length && this.lines[this.lines.length - 1] !== '') this.put(''); var self = this; (s.pre || []).forEach(function (c) { self.note(c); }); };
  function fmtNum(v, real, py) { var s = String(parseFloat(v.toPrecision(12))); if (real && py && /^-?\d+$/.test(s)) s += '.0'; return s; }
  var PREC = { OR: 1, AND: 2, '=': 4, '<>': 4, '<': 4, '<=': 4, '>': 4, '>=': 4, '+': 5, '-': 5, '&': 5, '*': 6, '/': 6, DIV: 6, MOD: 6, '^': 8 };
  function wrap(r, min, strict) { return r[1] < min || (strict && r[1] === min) ? '(' + r[0] + ')' : r[0]; }
  function flatIdx(e) { var idx = []; while (e.k === 'idx') { idx = e.index.concat(idx); e = e.obj; } return { base: e, index: idx }; }
  function defaultFor(t, py) { return t === 'REAL' ? (py ? '0.0' : '0.0') : isStrT(t) ? '""' : t === 'BOOLEAN' ? (py ? 'False' : 'FALSE') : '0'; }
  function caseToIf(s) {
    var mk = function (i) {
      if (i >= s.clauses.length) return s.other;
      var c = s.clauses[i];
      var cond = c.vals.map(function (v) { return v.lo ? bin('AND', bin('>=', s.expr, v.lo), bin('<=', s.expr, v.hi)) : bin('=', s.expr, v.v); }).reduce(function (a, b) { return bin('OR', a, b); });
      var rest = mk(i + 1);
      return [{ k: 'if', cond: cond, then: c.body, els: rest, line: i ? c.line : s.line, pre: i ? null : s.pre, blank: i ? false : s.blank }];
    };
    return mk(0);
  }

  /* ================= Edexcel back end ================= */
  function toEdexcel(ir, ty) {
    var o = new Out('#'), env = ty.env(null);
    var RW = function (n) { return PS.KW[n] || PS.BUILTINS[n] ? n + '_' : n; };
    function E(e) {
      switch (e.k) {
        case 'num': return [fmtNum(e.v, e.real), e.v < 0 ? 7 : 9];
        case 'str': if (e.v.indexOf('"') < 0) return ['"' + e.v + '"', 9]; if (e.v.indexOf("'") < 0) return ["'" + e.v + "'", 9]; bad('quotes');
        case 'bool': return [e.v ? 'TRUE' : 'FALSE', 9];
        case 'var': return [RW(e.name), 9];
        case 'arr': return ['[' + e.items.map(function (x) { return E(x)[0]; }).join(', ') + ']', 9];
        case 'idx': {
          var f = flatIdx(e), bt = ty.T(f.base, env);
          return [wrap(E(f.base), 9) + f.index.map(function (i) { return '[' + E(i)[0] + ']'; }).join(''), 9];
        }
        case 'concat': return [e.parts.map(function (p, i) { return wrap(E(p), i ? 6 : 5); }).join(' & '), 5];
        case 'call': return [RW(e.name) + '(' + e.args.map(function (x) { return E(x)[0]; }).join(', ') + ')', 9];
        case 'bi': {
          var a = e.args;
          switch (e.name) {
            case 'LENGTH': case 'INT': case 'STR': return [e.name + '(' + E(a[0])[0] + ')', 9];
            case 'RANDOMINT': return a[0].k === 'num' && a[0].v === 0 ? ['RANDOM(' + E(a[1])[0] + ')', 9] : ['RANDOM(' + E(minus(a[1], a[0]))[0] + ') + ' + wrap(E(a[0]), 6), 5];
            case 'MID': if (a[2].k === 'num' && a[2].v === 1) return [wrap(E(a[0]), 9) + '[' + E(add(a[1], -1))[0] + ']', 9]; break;
          }
          bad(e.name + ' has no Edexcel equivalent');
        }
        case 'un': return e.op === 'NOT' ? ['NOT ' + wrap(E(e.a), 3), 3] : ['-' + wrap(E(e.a), 7), 7];
        case 'bin': {
          var op = e.op, p = PREC[op];
          if (op === '+' && (isStrT(ty.T(e.a, env)) || isStrT(ty.T(e.b, env)))) op = '&';
          return [wrap(E(e.a), p) + ' ' + op + ' ' + wrap(E(e.b), p, op !== '^'), p];
        }
      }
      bad(e.k);
    }
    function X(e) { return E(e)[0]; }
    function arrayLit(t) {
      if (!t.dims || t.dims.some(function (d) { return d[1] === null || d[0] === null || d[0] < 0; })) bad('array size');
      var mk = function (k) { var n = t.dims[k][1] + 1, item = k + 1 < t.dims.length ? mk(k + 1) : defaultFor(t.el); return '[' + new Array(n).fill(item).join(', ') + ']'; };
      return mk(0);
    }
    function block(body) { body.forEach(function (s, i) { stmt(s, i === 0); }); }
    function stmt(s, first) {
      o.pre(s, first);
      var saved = o.lines.length, si = o.ind;
      try { one(s); }
      catch (e) { if (!(e instanceof Todo)) throw e; o.lines.length = saved; o.ind = si; o.todo((srcText(s.line) || s.k) + (e.msg ? '  (' + e.msg + ')' : '')); }
    }
    function one(s) {
      switch (s.k) {
        case 'todo': o.todo(s.text + (s.why ? '  (' + s.why + ')' : '')); return;
        case 'declare': if (s.type && s.type.arr) o.put('SET ' + RW(s.name) + ' TO ' + arrayLit(s.type)); return;
        case 'const': o.put('SET ' + RW(s.name) + ' TO ' + X(s.expr)); return;
        case 'assign': o.put('SET ' + X(s.target) + ' TO ' + X(s.expr)); return;
        case 'output': {
          var items = s.sep === '' && s.items.length > 1 ? [{ k: 'concat', parts: s.items }] : s.items;
          o.put('SEND ' + items.map(X).join(', ') + ' TO DISPLAY'); return;
        }
        case 'input': {
          if (s.prompt) o.put('SEND ' + X(s.prompt) + ' TO DISPLAY');
          var t = s.type || (s.target.k === 'var' ? ty.T(s.target, env) : null) || 'STRING';
          if (t.arr || !{ INTEGER: 1, REAL: 1, STRING: 1, CHAR: 1, BOOLEAN: 1 }[t]) t = 'STRING';
          var tn = t === 'CHAR' ? 'CHARACTER' : t;
          if (s.target.k === 'var') o.put('RECEIVE ' + RW(s.target.name) + ' FROM (' + tn + ') KEYBOARD');
          else { o.put('RECEIVE inputValue FROM (' + tn + ') KEYBOARD'); o.put('SET ' + X(s.target) + ' TO inputValue'); }
          return;
        }
        case 'if': o.put('IF ' + X(s.cond) + ' THEN'); o.ind++; block(s.then); o.ind--; if (s.els) { o.put('ELSE'); o.ind++; block(s.els); o.ind--; } o.put('END IF'); return;
        case 'case': block(caseToIf(s)); return;
        case 'while': o.put('WHILE ' + X(s.cond) + ' DO'); o.ind++; block(s.body); o.ind--; o.put('END WHILE'); return;
        case 'repeat': o.put('REPEAT'); o.ind++; block(s.body); o.ind--; o.put('UNTIL ' + X(s.cond)); return;
        case 'times': o.put('REPEAT ' + X(s.count) + ' TIMES'); o.ind++; block(s.body); o.ind--; o.put('END REPEAT'); return;
        case 'for': o.put('FOR ' + RW(s.v) + ' FROM ' + X(s.from) + ' TO ' + X(s.to) + (s.step ? ' STEP ' + X(s.step) : '') + ' DO'); o.ind++; block(s.body); o.ind--; o.put('END FOR'); return;
        case 'foreach': o.put('FOR EACH ' + RW(s.v) + ' FROM ' + X(s.src) + ' DO'); o.ind++; block(s.body); o.ind--; o.put('END FOREACH'); return;
        case 'call': o.put(RW(s.name) + '(' + s.args.map(X).join(', ') + ')'); return;
        case 'return': o.put('RETURN' + (s.expr ? ' ' + X(s.expr) : '')); return;
      }
      bad(s.k);
    }
    ir.subs.forEach(function (sub) {
      env = ty.env(sub.name);
      o.pre(sub, !o.lines.length);
      var kw = sub.isFunc ? 'FUNCTION' : 'PROCEDURE';
      o.put(kw + ' ' + RW(sub.name) + '(' + sub.params.map(function (p) { return RW(p.name); }).join(', ') + ')');
      o.put('BEGIN ' + kw); o.ind++;
      sub.params.forEach(function (p) { if (p.byref) o.todo(p.name + ' was a BYREF parameter. Edexcel subprograms change globals instead.'); });
      block(sub.body); o.ind--; o.put('END ' + kw); o.put('');
    });
    env = ty.env(null);
    block(ir.main);
    return o;
  }

  /* ================= Cambridge back end ================= */
  function toCambridge(ir, ty) {
    var o = new Out('//'), env = ty.env(null), extra = {}, curSub = null;
    var RESERVED = { PRINT: 1, SET: 1, SEND: 1, RECEIVE: 1, END: 1, ENDFOR: 1, ELSEIF: 1, VAR: 1 };
    var RW = function (n) { var u = n.toUpperCase(); return CIE.KW[u] || CIE.BUILTINS[u] || RESERVED[u] ? n + 'Value' : n; };
    function tyText(t, name) {
      if (!t) return { s: 'STRING', guess: true };
      if (t.arr) {
        var el = t.el ? tyText(t.el).s : 'INTEGER', dims = t.dims;
        if (!dims || dims.some(function (d) { return d[0] === null || d[1] === null || d[1] < d[0]; })) return { s: 'ARRAY[0:99] OF ' + el, guess: true };
        return { s: 'ARRAY[' + dims.map(function (d) { return d[0] + ':' + d[1]; }).join(', ') + '] OF ' + el, guess: !t.el };
      }
      return { s: t, guess: false };
    }
    function strWrap(e) { var t = ty.T(e, env); return isStrT(t) ? e : bi('STR', [e]); }
    function E(e) {
      switch (e.k) {
        case 'num': return [fmtNum(e.v, e.real), e.v < 0 ? 7 : 9];
        case 'str': if (e.v.indexOf('"') >= 0) bad('quotes'); return ['"' + e.v + '"', 9];
        case 'bool': return [e.v ? 'TRUE' : 'FALSE', 9];
        case 'var': return [RW(e.name), 9];
        case 'arr': bad('array value');
        case 'idx': {
          var f = flatIdx(e), bt = ty.T(f.base, env);
          if (isStrT(bt) && f.index.length === 1) return ['MID(' + E(f.base)[0] + ', ' + E(add(f.index[0], 1))[0] + ', 1)', 9];
          return [wrap(E(f.base), 9) + '[' + f.index.map(function (i) { return E(i)[0]; }).join(', ') + ']', 9];
        }
        case 'concat': return [e.parts.map(function (p, i) { return wrap(E(strWrap(p)), i ? 6 : 5); }).join(' & '), 5];
        case 'call': return [RW(e.name) + '(' + e.args.map(function (x) { return E(x)[0]; }).join(', ') + ')', 9];
        case 'bi': {
          var a = e.args, A = function (i) { return E(a[i])[0]; };
          switch (e.name) {
            case 'LENGTH': case 'MID': case 'LEFT': case 'RIGHT': case 'ASC': case 'CHR': case 'ROUND': return [e.name + '(' + a.map(function (x) { return E(x)[0]; }).join(', ') + ')', 9];
            case 'UPPER': return ['UCASE(' + A(0) + ')', 9];
            case 'LOWER': return ['LCASE(' + A(0) + ')', 9];
            case 'STR': return isStrT(ty.T(a[0], env)) ? E(a[0]) : ['NUM_TO_STR(' + A(0) + ')', 9];
            case 'NUM': return ['STR_TO_NUM(' + A(0) + ')', 9];
            case 'INT': return [(isStrT(ty.T(a[0], env)) ? 'STR_TO_NUM(' : 'INT(') + A(0) + ')', 9];
            case 'ISNUM': return ['IS_NUM(' + A(0) + ')', 9];
            case 'RANDREAL': return a[0].k === 'num' && a[0].v === 1 ? ['RAND(1)', 9] : ['RAND(' + A(0) + ')', 9];
            case 'RANDOMINT': return ['INT(RAND(' + E(add(minus(a[1], a[0]), 1))[0] + '))' + (a[0].k === 'num' && a[0].v === 0 ? '' : ' + ' + wrap(E(a[0]), 6)), a[0].k === 'num' && a[0].v === 0 ? 9 : 5];
          }
          bad(e.name);
        }
        case 'un': return e.op === 'NOT' ? ['NOT ' + wrap(E(e.a), 3), 3] : ['-' + wrap(E(e.a), 7), 7];
        case 'bin': {
          var op = e.op, p = PREC[op];
          if (op === 'DIV' || op === 'MOD') return [op + '(' + E(e.a)[0] + ', ' + E(e.b)[0] + ')', 9];
          if (op === '&' || (op === '+' && (isStrT(ty.T(e.a, env)) || isStrT(ty.T(e.b, env))))) return [wrap(E(strWrap(e.a)), 5) + ' & ' + wrap(E(strWrap(e.b)), 5, true), 5];
          return [wrap(E(e.a), p) + ' ' + op + ' ' + wrap(E(e.b), p, op !== '^'), p];
        }
      }
      bad(e.k);
    }
    function X(e) { return E(e)[0]; }
    function block(body) { body.forEach(function (s, i) { stmt(s, i === 0); }); }
    function stmt(s, first) {
      o.pre(s, first);
      var saved = o.lines.length, si = o.ind;
      try { one(s); }
      catch (e) { if (!(e instanceof Todo)) throw e; o.lines.length = saved; o.ind = si; o.todo((srcText(s.line) || s.k) + (e.msg ? '  (' + e.msg + ')' : '')); }
    }
    function counter(base, t) { var scope = curSub ? curSub.name : ''; extra[scope] = extra[scope] || []; var n = base, i = 2; while (ty.env(curSub && curSub.name).get(n) || extra[scope].some(function (x) { return x.n === n; })) n = base + i++; extra[scope].push({ n: n, t: t || 'INTEGER' }); return n; }
    function one(s) {
      switch (s.k) {
        case 'todo': o.todo(s.text + (s.why ? '  (' + s.why + ')' : '')); return;
        case 'declare': return;
        case 'const': o.put('CONSTANT ' + RW(s.name) + ' ← ' + X(s.expr)); return;
        case 'assign':
          if (s.expr.k === 'arr') {
            var base = X(s.target), put = function (items, prefix) { items.forEach(function (it, i) { if (it.k === 'arr') put(it.items, prefix.concat([i])); else o.put(base + '[' + prefix.concat([i]).join(', ') + '] ← ' + X(it)); }); };
            put(s.expr.items, []); return;
          }
          o.put(X(s.target) + ' ← ' + X(s.expr)); return;
        case 'output': {
          var parts = [];
          s.items.forEach(function (it, i) {
            if (i && s.sep === ' ') parts.push('" "');
            if (it.k === 'concat') it.parts.forEach(function (p) { parts.push(X(p)); }); else parts.push(X(it));
          });
          o.put('OUTPUT ' + parts.join(', ')); return;
        }
        case 'input': if (s.prompt) o.put('OUTPUT ' + X(s.prompt)); o.put('INPUT ' + X(s.target)); return;
        case 'if':
          o.put('IF ' + X(s.cond)); o.put('  THEN'); o.ind++; block(s.then); o.ind--;
          if (s.els) { o.put('  ELSE'); o.ind++; block(s.els); o.ind--; }
          o.put('ENDIF'); return;
        case 'case': block(caseToIf(s)); return;
        case 'while': o.put('WHILE ' + X(s.cond) + ' DO'); o.ind++; block(s.body); o.ind--; o.put('ENDWHILE'); return;
        case 'repeat': o.put('REPEAT'); o.ind++; block(s.body); o.ind--; o.put('UNTIL ' + X(s.cond)); return;
        case 'times': { var c = counter('Count'); o.put('FOR ' + c + ' ← 1 TO ' + X(s.count)); o.ind++; block(s.body); o.ind--; o.put('NEXT ' + c); return; }
        case 'for': o.put('FOR ' + RW(s.v) + ' ← ' + X(s.from) + ' TO ' + X(s.to) + (s.step ? ' STEP ' + X(s.step) : '')); o.ind++; block(s.body); o.ind--; o.put('NEXT ' + RW(s.v)); return;
        case 'foreach': {
          var srcT = ty.T(s.src, env), ix;
          if (s.src.k === 'arr' && s.src.items.length) {
            var et = tyText(ty.T(s.src.items[0], env)).s, an = counter('Items', 'ARRAY[0:' + (s.src.items.length - 1) + '] OF ' + et);
            s.src.items.forEach(function (it, i) { o.put(an + '[' + i + '] ← ' + X(it)); });
            ix = counter('Index'); o.put('FOR ' + ix + ' ← 0 TO ' + (s.src.items.length - 1)); o.ind++; o.put(RW(s.v) + ' ← ' + an + '[' + ix + ']');
          }
          else if (isStrT(srcT)) { ix = counter('Index'); o.put('FOR ' + ix + ' ← 1 TO LENGTH(' + X(s.src) + ')'); o.ind++; o.put(RW(s.v) + ' ← MID(' + X(s.src) + ', ' + ix + ', 1)'); }
          else if (srcT && srcT.arr && srcT.dims && srcT.dims[0][1] !== null) { ix = counter('Index'); o.put('FOR ' + ix + ' ← ' + srcT.dims[0][0] + ' TO ' + srcT.dims[0][1]); o.ind++; o.put(RW(s.v) + ' ← ' + X(s.src) + '[' + ix + ']'); }
          else bad('loop over a list of unknown size');
          block(s.body); o.ind--; o.put('NEXT ' + ix); return;
        }
        case 'call': o.put('CALL ' + RW(s.name) + '(' + s.args.map(X).join(', ') + ')'); return;
        case 'return': if (!s.expr) bad('RETURN with no value'); o.put('RETURN ' + X(s.expr)); return;
      }
      bad(s.k);
    }
    function declares(names, get, scope) {
      var out = [];
      names.forEach(function (n) { var t = tyText(get(n), n); out.push('DECLARE ' + RW(n) + ' : ' + t.s + (t.guess ? '   // TODO: check the type' : '')); if (t.guess) o.todos++; });
      (extra[scope] || []).forEach(function (x) { out.push('DECLARE ' + x.n + ' : ' + x.t); });
      return out;
    }
    var subBlocks = ir.subs.map(function (sub) {
      curSub = sub; env = ty.env(sub.name); var sv = o.lines; o.lines = []; var start = o.todos;
      o.ind = 1; block(sub.body); o.ind = 0;
      var body = o.lines; o.lines = sv;
      var S = ty.S[sub.name], anyRef = sub.params.some(function (p) { return p.byref; });
      var params = sub.params.map(function (p) { var t = tyText(S.params[p.name]); if (t.guess) o.todos++; return (anyRef ? (p.byref ? 'BYREF ' : 'BYVAL ') : '') + RW(p.name) + ' : ' + t.s; }).join(', ');
      var head = (sub.isFunc ? 'FUNCTION ' : 'PROCEDURE ') + RW(sub.name) + '(' + params + ')' + (sub.isFunc ? ' RETURNS ' + tyText(S.ret).s : '');
      var locals = (sub.locals || []).filter(function (n) { return !sub.params.some(function (p) { return p.name === n; }); });
      var decl = declares(locals.filter(function (n) { return !body.some(function (l) { return /^\s*CONSTANT /.test(l) && l.indexOf(' ' + RW(n) + ' ') >= 0; }); }), function (n) { return S.locals[n]; }, sub.name).map(function (l) { return '    ' + l; });
      void start;
      return { sub: sub, lines: [head].concat(decl, body, [sub.isFunc ? 'ENDFUNCTION' : 'ENDPROCEDURE']) };
    });
    curSub = null; env = ty.env(null); o.lines = []; o.ind = 0;
    block(ir.main);
    var mainLines = o.lines;
    var constNames = []; walkStmts(ir.main, function (s) { if (s.k === 'const') constNames.push(s.name); });
    var globals = ty.order.filter(function (n) { return constNames.indexOf(n) < 0; });
    var head = declares(globals, function (n) { return ty.G[n]; }, '');
    var lines = [];
    if (head.length) lines = lines.concat(head, ['']);
    subBlocks.forEach(function (b) { var tmp = new Out('//'); tmp.pre(b.sub, true); lines = lines.concat(tmp.lines, b.lines, ['']); });
    o.lines = lines.concat(mainLines);
    return o;
  }

  /* ================= Python back end ================= */
  function toPython(ir, ty) {
    var o = new Out('#'), env = ty.env(null), useRandom = false;
    var BUILTIN = { print: 1, input: 1, int: 1, str: 1, len: 1, list: 1, max: 1, min: 1, sum: 1, range: 1, round: 1, type: 1, float: 1, abs: 1, chr: 1, ord: 1, dict: 1, set: 1, id: 1, random: 1, bool: 1 };
    var RW = function (n) { return PY.KW[n] || BUILTIN[n] ? n + '_' : n; };
    function pyStr(v) { return '"' + v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"'; }
    function strOf(e) { var t = ty.T(e, env); return isStrT(t) ? E(e)[0] : 'str(' + E(e)[0] + ')'; }
    function fstring(parts) {
      var body = '', ok = true;
      parts.forEach(function (p) {
        if (p.k === 'str') body += p.v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\{/g, '{{').replace(/\}/g, '}}').replace(/\n/g, '\\n');
        else { var x = E(p)[0]; if (/["'{}\\]/.test(x)) ok = false; body += '{' + x + '}'; }
      });
      if (ok) return ['f"' + body + '"', 9];
      return [parts.map(function (p) { return p.k === 'str' ? pyStr(p.v) : strOf(p); }).join(' + '), 5];
    }
    function sliceOf(s, lo, hi) { return wrap(E(s), 9) + '[' + (lo ? E(lo)[0] : '') + ':' + (hi ? E(hi)[0] : '') + ']'; }
    function E(e) {
      switch (e.k) {
        case 'num': return [fmtNum(e.v, e.real, true), e.v < 0 ? 7 : 9];
        case 'str': return [pyStr(e.v), 9];
        case 'bool': return [e.v ? 'True' : 'False', 9];
        case 'var': return [RW(e.name), 9];
        case 'arr': return ['[' + e.items.map(function (x) { return E(x)[0]; }).join(', ') + ']', 9];
        case 'idx': { var f = flatIdx(e); return [wrap(E(f.base), 9) + f.index.map(function (i) { return '[' + E(i)[0] + ']'; }).join(''), 9]; }
        case 'concat': return fstring(e.parts);
        case 'call': return [RW(e.name) + '(' + e.args.map(function (x) { return E(x)[0]; }).join(', ') + ')', 9];
        case 'bi': {
          var a = e.args, A = function (i) { return E(a[i])[0]; };
          switch (e.name) {
            case 'LENGTH': return ['len(' + A(0) + ')', 9];
            case 'UPPER': return [wrap(E(a[0]), 9) + '.upper()', 9];
            case 'LOWER': return [wrap(E(a[0]), 9) + '.lower()', 9];
            case 'ISNUM': return [wrap(E(a[0]), 9) + '.isdigit()', 9];
            case 'MID': { var st = add(a[1], -1); if (a[2].k === 'num' && a[2].v === 1) return [wrap(E(a[0]), 9) + '[' + E(st)[0] + ']', 9]; return [sliceOf(a[0], st, plus(st, a[2])), 9]; }
            case 'LEFT': return [sliceOf(a[0], null, a[1]), 9];
            case 'RIGHT': return [a[1].k === 'num' ? sliceOf(a[0], num(-a[1].v), null) : sliceOf(a[0], minus(bi('LENGTH', [a[0]]), a[1]), null), 9];
            case 'STR': return ['str(' + A(0) + ')', 9];
            case 'NUM': return ['float(' + A(0) + ')', 9];
            case 'INT': return ['int(' + A(0) + ')', 9];
            case 'ROUND': return ['round(' + A(0) + ', ' + A(1) + ')', 9];
            case 'ASC': return ['ord(' + A(0) + ')', 9];
            case 'CHR': return ['chr(' + A(0) + ')', 9];
            case 'RANDOMINT': useRandom = true; return ['random.randint(' + A(0) + ', ' + A(1) + ')', 9];
            case 'RANDREAL': useRandom = true; return a[0].k === 'num' && a[0].v === 1 ? ['random.random()', 9] : ['random.random() * ' + wrap(E(a[0]), 6, true), 6];
          }
          bad(e.name);
        }
        case 'un': return e.op === 'NOT' ? ['not ' + wrap(E(e.a), 3), 3] : ['-' + wrap(E(e.a), 7), 7];
        case 'bin': {
          var op = e.op;
          if (op === '&' || (op === '+' && (isStrT(ty.T(e.a, env)) || isStrT(ty.T(e.b, env))))) {
            var chain = []; (function flat(x) { if (x.k === 'bin' && (x.op === '&' || (x.op === '+' && (isStrT(ty.T(x.a, env)) || isStrT(ty.T(x.b, env)))))) { flat(x.a); flat(x.b); } else chain.push(x); })(e);
            return fstring(chain.map(function (x) { return x.k === 'bi' && x.name === 'STR' ? x.args[0] : x; }));
          }
          var py = { '=': '==', '<>': '!=', AND: 'and', OR: 'or', DIV: '//', MOD: '%', '^': '**' }[op] || op, p = PREC[op];
          return [wrap(E(e.a), p, op === '^') + ' ' + py + ' ' + wrap(E(e.b), p, op !== '^' && op !== 'AND' && op !== 'OR'), p];
        }
      }
      bad(e.k);
    }
    function X(e) { return E(e)[0]; }
    function block(body) { var n0 = o.lines.length; body.forEach(function (s, i) { stmt(s, i === 0); }); if (!o.lines.slice(n0).some(function (l) { return !/^\s*(#|$)/.test(l); })) o.put('pass'); }
    function stmt(s, first) {
      o.pre(s, first);
      var saved = o.lines.length, si = o.ind;
      try { one(s); }
      catch (e) { if (!(e instanceof Todo)) throw e; o.lines.length = saved; o.ind = si; o.todo((srcText(s.line) || s.k) + (e.msg ? '  (' + e.msg + ')' : '')); }
    }
    function arrInit(t) {
      if (!t.dims || t.dims.some(function (d) { return d[1] === null || d[0] === null || d[0] < 0; })) bad('array size');
      var d = defaultFor(t.el, true);
      if (t.dims.length === 1) return '[' + d + '] * ' + (t.dims[0][1] + 1);
      return '[[' + d + '] * ' + (t.dims[1][1] + 1) + ' for _ in range(' + (t.dims[0][1] + 1) + ')]';
    }
    function ifChain(s, kw) {
      o.put(kw + ' ' + X(s.cond) + ':'); o.ind++; block(s.then); o.ind--;
      if (s.els) {
        if (s.els.length === 1 && s.els[0].k === 'if') { o.pre(s.els[0], true); ifChain(s.els[0], 'elif'); }
        else { o.put('else:'); o.ind++; block(s.els); o.ind--; }
      }
    }
    function one(s) {
      switch (s.k) {
        case 'todo': o.todo(s.text + (s.why ? '  (' + s.why + ')' : '')); return;
        case 'declare': if (s.type && s.type.arr) o.put(RW(s.name) + ' = ' + arrInit(s.type)); return;
        case 'const': o.put(RW(s.name) + ' = ' + X(s.expr)); return;
        case 'assign': o.put(X(s.target) + ' = ' + X(s.expr)); return;
        case 'output': {
          if (s.sep === '' && s.items.length > 1) { o.put('print(' + fstring(s.items.reduce(function (acc, it) { return acc.concat(it.k === 'concat' ? it.parts : [it]); }, []))[0] + ')'); return; }
          o.put('print(' + s.items.map(X).join(', ') + ')'); return;
        }
        case 'input': {
          var t = s.type || (s.target.k === 'var' ? ty.T(s.target, env) : ty.T(s.target, env)), p = s.prompt ? X(s.prompt) : '';
          var call = 'input(' + p + ')';
          if (t === 'INTEGER') call = 'int(' + call + ')'; else if (t === 'REAL') call = 'float(' + call + ')'; else if (t === 'BOOLEAN') call = call + '.strip().upper() == "TRUE"';
          o.put(X(s.target) + ' = ' + call); return;
        }
        case 'if': ifChain(s, 'if'); return;
        case 'case': block(caseToIf(s)); return;
        case 'while': o.put('while ' + X(s.cond) + ':'); o.ind++; block(s.body); o.ind--; return;
        case 'repeat': o.put('while True:'); o.ind++; block(s.body); o.put('if ' + X(s.cond) + ':'); o.ind++; o.put('break'); o.ind -= 2; return;
        case 'times': o.put('for _ in range(' + X(s.count) + '):'); o.ind++; block(s.body); o.ind--; return;
        case 'for': {
          var neg = s.step && s.step.k === 'num' && s.step.v < 0;
          if (s.step && s.step.k !== 'num') bad('STEP must be a number');
          var end = add(s.to, neg ? -1 : 1), args = s.step ? [X(s.from), X(end), X(s.step)] : s.from.k === 'num' && s.from.v === 0 ? [X(end)] : [X(s.from), X(end)];
          o.put('for ' + RW(s.v) + ' in range(' + args.join(', ') + '):'); o.ind++; block(s.body); o.ind--; return;
        }
        case 'foreach': o.put('for ' + RW(s.v) + ' in ' + X(s.src) + ':'); o.ind++; block(s.body); o.ind--; return;
        case 'call': o.put(RW(s.name) + '(' + s.args.map(X).join(', ') + ')'); return;
        case 'return': o.put('return' + (s.expr ? ' ' + X(s.expr) : '')); return;
      }
      bad(s.k);
    }
    var mainAssigned = assignedNames(ir.main);
    ir.subs.forEach(function (sub, i) {
      env = ty.env(sub.name);
      o.pre(sub, !o.lines.length);
      o.put('def ' + RW(sub.name) + '(' + sub.params.map(function (p) { return RW(p.name); }).join(', ') + '):'); o.ind++;
      sub.params.forEach(function (p) { if (p.byref) o.todo(p.name + ' was BYREF. Python passes a copy of numbers and strings, so return the new value instead.'); });
      var ps = sub.params.map(function (p) { return p.name; });
      var glob = assignedNames(sub.body).filter(function (n) { return ps.indexOf(n) < 0 && (sub.locals || []).indexOf(n) < 0 && mainAssigned.indexOf(n) >= 0; });
      if (glob.length) o.put('global ' + glob.map(RW).join(', '));
      block(sub.body); o.ind--; o.put(''); if (i === ir.subs.length - 1) o.put('');
    });
    env = ty.env(null);
    block(ir.main);
    if (useRandom) o.lines = ['import random', ''].concat(o.lines);
    return o;
  }

  /* ================= driver ================= */
  function attach(ir, src, from) {
    var lines = src.split('\n'), re = from === 'cambridge' ? /^\s*\/\/\s?(.*)$/ : /^\s*#\s?(.*)$/, all = [];
    ir.subs.forEach(function (s) { all.push(s); walkStmts(s.body, function (x) { all.push(x); }); });
    walkStmts(ir.main, function (x) { all.push(x); });
    all = all.filter(function (x) { return x.line; }).sort(function (a, b) { return a.line - b.line; });
    var trailing = [];
    lines.forEach(function (t, i) {
      var m = re.exec(t); if (!m) return;
      var L = i + 1, tgt = null;
      for (var j = 0; j < all.length; j++) if (all[j].line > L) { tgt = all[j]; break; }
      if (tgt) { tgt.pre = (tgt.pre || []).concat([m[1]]); tgt.preLine = Math.min(tgt.preLine || L, L); } else trailing.push(m[1]);
    });
    all.forEach(function (x) { var f = x.preLine || x.line; if (f > 1 && lines[f - 2].trim() === '') x.blank = true; });
    return trailing;
  }
  function convert(src, from, to) {
    var eng = { edexcel: PS, cambridge: CIE, python: PY }[from];
    var prog = eng.compile(src);
    CURSRC = src.replace(/\r/g, '').split('\n');
    var ir = from === 'edexcel' ? fromEdexcel(prog) : from === 'cambridge' ? fromCambridge(prog) : fromPython(prog);
    var trailing = attach(ir, src.replace(/\r/g, ''), from);
    var ty = Types(ir);
    var o = to === 'edexcel' ? toEdexcel(ir, ty) : to === 'cambridge' ? toCambridge(ir, ty) : toPython(ir, ty);
    trailing.forEach(function (c) { o.note(c); });
    var lines = o.lines;
    while (lines.length && lines[lines.length - 1] === '') lines.pop();
    for (var i = lines.length - 1; i > 0; i--) if (lines[i] === '' && lines[i - 1] === '') lines.splice(i, 1);
    var cm = to === 'cambridge' ? '//' : '#', todos = lines.filter(function (l) { return l.indexOf(cm + ' TODO') >= 0 || l.indexOf('// TODO') >= 0; }).length;
    var head = [cm + ' Converted from ' + LNAME[from] + ' by the IDE.' + (todos ? ' Check the ' + todos + ' line' + (todos === 1 ? '' : 's') + ' marked TODO.' : '')];
    CURSRC = null;
    return { code: head.concat(lines).join('\n') + '\n', todos: todos };
  }
  return { convert: convert };
})();


module.exports = { PS, CIE, PY, EXAMPLES, CIE_EXAMPLES, PY_EXAMPLES, CONVERT, GUIDE, CIE_GUIDE, PY_GUIDE, LANGS };
