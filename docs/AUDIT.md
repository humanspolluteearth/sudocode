# Milestone 0 audit: the "Pseudocode and Python IDE" prototype

Audited 23 Nov 2026. Source: the Claude Design export in `reference/prototype/` (design pages + one 310 KB script).
Evidence: `reference/prototype/data/` (every result below can be re-run with `reference/prototype/harness/`).

## Verdict: rewrite to the confirmed architecture, and keep the knowledge

The prototype is good work and much of it is worth keeping, but its structure can't grow into the confirmed
architecture: no columns or spans, line-by-line parsing, three separate runtimes, and execution on the main
thread. Port specific pieces (listed below) into the new design instead of moving the code across whole.

## What the prototype is

| Part | Size | Notes |
|---|---|---|
| Edexcel interpreter (`PS`) | ~460 lines | Line-by-line tokenizer and parser, generator-based runner |
| Cambridge interpreter (`CIE`) | ~830 lines | Same design; records, files (text), CASE, DATE, BYREF |
| Python interpreter (`PY`) | ~1,380 lines | Real tokenizer with INDENT/DEDENT, BigInt ints, f-strings, comprehensions, try/except |
| Converter (`CONVERT`) | ~850 lines | from-language -> shared converter IR -> type inference -> printer, all 6 directions |
| Examples + guides | ~550 lines | 7 Edexcel, 10 CIE, 8 Python examples; 3 reference guides |
| IDE UI | ~400 lines + markup | Desktop, tablet and mobile layouts; light/dark theme; keyword key bar on mobile |

## The six audit questions

| Question | Answer |
|---|---|
| Does every node carry a source position? | Line only, no column or span. SH-15 needs line + column |
| Can execution pause and resume? How is input handled? | Yes: generator runners yield before each statement; input yields until the UI supplies a line. This matches the target |
| One runtime or one per language? | Three separate runtimes. Target: one runtime over a shared IR |
| Is parsing separate from running? | Yes (compile -> AST -> Runner) |
| Are bugs caused by structure? | Some are: pseudocode is parsed one line at a time (no multi-line constructs, one error per compile, no recovery); precedence bugs come from the hand-rolled precedence ladder; execution runs on the UI thread with a 200,000-step cap, so Stop can't interrupt |
| How well is it understood? | Readable but dense (very long lines); not written to the new spec |

## Conformance with the approved spec

### Edexcel (25 probes, `data/pseudocode-probes.json`)

Correct today: SH-10 floor DIV/MOD, EDX-56 loop variable after FOR, EDX-54 STEP 0 error, EDX-33 bare `x = 5` error,
EDX-63 global update, string comparison, RANDOM inclusive range.

| Spec | Prototype does | Spec wants |
|---|---|---|
| Precedence of `&` | `'Total: ' & 3 + 4` -> runtime error | `Total: 7` (`&` binds looser than `+`) |
| Precedence of `^` | `-2 ^ 2` = 4 | -4 (`^` binds tighter than unary minus) |
| EDX-05, EDX-08, EDX-42, EDX-44, EDX-58 | Lowercase keywords, `true`, ELSE IF, ENDIF, FOREACH are errors | Accepted with warnings |
| EDX-17 | No CONST | CONST supported |
| EDX-24 | `Grid[r, c]` is an error | Supported |
| EDX-26 | `[1] & [2]` gives text `[1][2]` | Checker error |
| Q-EDX-1 | Writing past the end is an error | Array grows |
| EDX-52 | `REPEAT -1 TIMES` is an error | Runs zero times |
| EDX-66, EDX-71, EDX-73 | Accepted silently | Checker errors |
| EDX-74 | Only KEYBOARD/DISPLAY | Other devices supported |
| EDX-80 to 84 | No file commands | READ/WRITE files |
| Q-EDX-4 | Has INT and STR | Only LENGTH and RANDOM |
| EDX-12, EDX-31 | No type checking; `7.5 DIV 2` = 3 | Checker errors |
| SH-07 | Silently loses precision past 2^53 | "number too large" error |
| SH-13 | Recursion limit 150 | 1,000 |
| SH-03 | `0.1 + 0.2` prints 0.3 (rounded to 10 dp) | "Shortest exact form": decide whether that means 0.30000000000000004 (see question below) |

### Cambridge (16 probes)

Correct today: `<-` arrow, exponent `^`, CASE OF expression, CALL required, INT truncation, "has no value yet",
DATE functions, array bounds message.

| Spec | Prototype does | Spec wants |
|---|---|---|
| SH-10 | `-7 DIV 2` = -3, `-7 MOD 2` = -1 (truncates) | Floor: -4 and 1 |
| CIE-11 | Undeclared variables allowed | Checker error |
| CIE-02 | Lowercase keywords are errors | Warning |
| CIE-101 | No TRY/EXCEPT | Supported |
| CIE-110 to 116 | No classes | Supported |
| CIE-94/95 | No random files (SEEK/GETRECORD/PUTRECORD) | Supported |
| CIE-31 | No enumerated types | Supported |
| CIE-96 | File left open is fine | Runtime error |
| CIE-45 | `&` with a number is a runtime error | Checker error with NUM_TO_STR hint |

### Python (`data/python-probes-vs-cpython.json`, compared with real CPython)

Very close to CPython: integers, float repr, rounding, f-strings and format specs, strings, lists, dicts,
control flow, functions, exceptions, comprehensions, lambda all match. 7 of the 8 examples match CPython exactly; the 8th uses unseeded random numbers.

Missing or different: classes (PY-19), files and `with` (PY-21), `format()` built-in, set `|` and `&`, `datetime`,
`type(x).__name__`, recursion limit 200 (CPython ~1,000), `random.seed()` sequence differs from CPython, and
`match` gives "invalid syntax" instead of the SH-18 "not supported" message.

### Converter

Edexcel -> Python and CIE -> Python: 12 of 13 examples convert and print exactly the same in CPython.
The CIE `records` example converts with 11 TODO markers.

## Performance (important for the new runtime)

- 1,000,000 loop iterations (2 million steps) run in about 0.5 s: generator overhead is fine.
- **Deep recursion overflows the JavaScript stack before depth 1,000** (tested with the limit removed, Node's
  default stack). Each interpreted call nests several JavaScript generator frames (`exec` -> `block` -> `ev` ->
  `call` ...), so SH-13's 1,000-deep recursion is impossible with directly nested `yield*` calls.
  **Requirement for milestone 2:** the runtime must keep interpreted call frames on its own explicit stack
  (a trampolined driver: a call yields a request, the driver pushes the callee's generator, and on return it
  resumes the caller with the value), so JavaScript stack depth depends only on expression nesting. A test must
  prove 1,000-deep recursion works inside a Web Worker.

## Keep (harvest into the new code)

| Asset | Where it goes |
|---|---|
| All 25 examples, with inputs | Golden tests (expected answers from the spec/CPython, not from the prototype) |
| The 41 pseudocode probes and Python probes | Conformance and regression tests |
| Error message wording and hints (many are excellent, e.g. "Use <> for not equal to") | `packages/core/src/messages/` catalogue |
| Python value model: BigInt ints, `floatRepr`, `roundHalfEven`, format-spec engine, dict hashing (`hkey`), slicing | Ported into `runtime/values` and Python built-ins, with tests |
| "Did you mean ...?" (Levenshtein) suggestions | Checker |
| Converter ideas: type-inference pass, index-base rewriting, TODO markers | Milestone 10 printers |
| UI layouts (desktop, tablet, mobile), themes, mobile keyword bar, guides' content | Milestones 3 and 10 (design reference, see `docs/PRODUCT.md`) |
| File extensions `.epc`, `.cpc`, `.py` | Save/open |

## Don't keep

Line-by-line parsing, the three separate runtimes, main-thread execution and the 200,000-step cap, the
5,000-line output cap (not in the spec), INT/STR in Edexcel, CIE truncating DIV/MOD.

## Questions for you (log your answers in docs/review/QUESTIONS.md)

1. SH-03 "shortest exact form": should pseudocode print `0.1 + 0.2` as `0.30000000000000004` (JavaScript's shortest
   exact form) or `0.3` (rounded, as the prototype does)? Default if unanswered: `0.30000000000000004`, matching the spec wording.
2. PY-41 / SH-12: should `random.seed(n)` reproduce CPython's exact sequence (needs a Mersenne Twister port)?
   Default if unanswered: yes, so differential tests can include seeded randomness.
3. The bug list "bugs 5-14" mentioned in the architecture doc wasn't in the export. If you have it, add it to
   `docs/review/QUESTIONS.md` and the regressions get added in the next milestone.
