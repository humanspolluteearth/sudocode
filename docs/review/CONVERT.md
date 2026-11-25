# Converter: all directions (review notes)

Started 25 Nov 2026 under `/goal`. Rules are in `docs/language-spec/converter.md` (CNV-).

## Scope decision

You answered "I dont need python to psudocode", so Python to Edexcel and Python to Cambridge are NOT built. The goal's six directions are four:

| Direction                     | State at start                                                                                  | Plan                                       |
| ----------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Edexcel to Python             | Exists (M10, #137 cleaner output). Green except 4 pending IDs in `tests/converter/pending.json` | Keep; fix pending items only if cheap      |
| Cambridge to Python           | Same                                                                                            | Same                                       |
| Edexcel to Cambridge          | Missing                                                                                         | New IR printer + refusal pass (CNV-10..16) |
| Cambridge to Edexcel          | Missing                                                                                         | New IR printer + refusal pass (CNV-20..24) |
| Python to Edexcel / Cambridge | Missing                                                                                         | Not wanted: dropped                        |

## What exists

`packages/core/src/converter/`: `index.ts` (`convertToPython`), `refuse.ts`, `types.ts` (fixpoint type inference), and the Python printer (`expr.ts`, `stmt.ts`, `helpers.ts`, `names.ts`). Tests: `tests/converter/roundtrip.test.ts` (every Edexcel/CIE golden through CPython 3.12) and `python-text.test.ts`.

## What is missing

- `converter.md` (now written), the two pseudocode printers, a matrix test over all targets, the Convert UI for the other languages.
- `Types` has no way to list variables per scope (needed for `DECLARE`).

## Decisions I made (not asked)

Classes refused everywhere; files/TRY/records/enums/dates refused towards CIE; comments kept; fresh counters for `REPEAT n TIMES` and `FOR EACH` when going to CIE; `RANDOM(n)` to `INT(RAND(n + 1))`; growing Edexcel arrays refused towards CIE.

## Your answers

Booleans in concatenation via IF and REAL refused (CNV-13); CIE arrays become a filled literal with shifted indexes (CNV-22).

## Baseline

`pnpm check`: lint ok, typecheck ok, test 4980 passed, spec:coverage ok.

## Refusals by reason, and things to check by hand

To be filled in when the matrix test lands.

## Edexcel <-> Cambridge printers (PR 1, 26 Nov 2026)

Code: `packages/core/src/converter/pseudo/` (`index.ts`, `names.ts`, `comments.ts`, `expr.ts`, `to-cie.ts`, `to-edexcel.ts`). One printer per target, one shared type inference (`Types`, run with exact `^` typing), a refusal pass before printing.

### Matrix result

- `cie-to-edexcel`: passes (converted or refused for a real reason).
- `edexcel-to-cie`: **left pending** (`converter/matrix/edexcel-to-cie`). Two programs fail only because the Sudocode runtime does not yet print REALs as SH-03 says, so the converted CIE program prints a different text from the reviewed output: `SH-03-real-small-no-exponent` (prints `1e-7`, expected `0.0000001`) and `SH-03-real-large-shortest-form` (prints `100000000000000010000000`). Both are already pending in `tests/pending.json` for the original Edexcel program. The converter's text is faithful (`OUTPUT 0.0000001`). Fix is the shared number formatter (Q20-Q22), not the converter; remove the matrix ID when that lands.

### Refusals (by reason)

files, types, classes, errors, byref, dates, devices (as before); builtins (no equivalent, named in the message); prompt (`INPUT "text" x`: Edexcel RECEIVE has no prompt); multi-array (2D arrays, array parameters); growing-array (Edexcel array written past its end); real-in-text (a REAL joined with `&` towards Cambridge, CNV-13); unknown-type (type could not be inferred); name-clash (Edexcel names that differ only by case).

### Hand-check items

- Variable-index array writes are assumed in range after the shift to base 0.
- A Cambridge array becomes a filled literal (`[0, 0, 0]`), so the "no value yet" error is lost.
- `NUM_TO_STR` of an INTEGER is dropped going to Edexcel; Edexcel `&` converts itself.
- A BOOLEAN joined with text towards Cambridge goes through an IF into a fresh STRING; it is evaluated before the statement.
- A join of two non-text values towards Edexcel starts with `'' &` (the checker needs one text side).
- Edexcel text indexing `Name[i]` becomes `MID(Name, i + 1, 1)` towards Cambridge.
- `INPUT A[2]` becomes `RECEIVE input_1 ...` then `SET A[1] TO input_1`.
- Real literals are printed as plain decimals (no `1e-7`; Cambridge cannot lex it).
- `LENGTH(a)` of a Cambridge array becomes its declared size.
- `CNV-23-refused` (merged test) is pending: its program `UCASE(s)` with a STRING is a checker error (CIE-121: UCASE takes a CHAR), so the source is rejected before conversion. See Q60.

### Test-reviewer notes (26 Nov 2026)

- The two pending IDs are explained above (Q60 and the SH-03 formatter); both are in the PR description.
- Merged-test looseness, NOT changed because merged tests are read-only: `matrix.test.ts` `REASONS` (`types` matches the `SET` statement, `builtins` matches any `word(`, `real-in-text` matches any `&`, `unknown-type`/`name-clash`/`problems` accept anything) and `roundtrip.test.ts` `REFUSALS.types` (matches every `DECLARE x : INTEGER`). A wrong-reason refusal could therefore pass. Proposal for you: tighten these in a tests PR. I checked by hand that today's refusals are for real reasons.
- Spec rows without a text test (CNV-05, 06, 07, 10, 12, 13 BOOLEAN, 14 FOR EACH, 16, 22 other bounds, 24 other loops): to add in a follow-up tests-first PR.

### UI (26 Nov 2026)

- Size: converter chunk 125.77 kB, **38.20 kB gzipped**, loaded on the first conversion only. Size budget not changed.
- Python files have nothing to convert to (Python to pseudocode is not offered, CNV-02): the Convert menu shows one disabled "Convert from Python" item and the toolbar select is disabled. The label is mine, not from a spec; tell me if you want other wording.
- Not done: screenshots of the banner and menu on desktop, tablet and phone, and a keyboard-only test of the Convert menu (needs a Playwright pass; the menu bar's keyboard behaviour is already covered in `chrome.browser.test.tsx`).
- Reviewers: architecture-reviewer found no MUST FIX; its 5 SHOULD items are fixed in the follow-up PR (shared `CONVERT_TARGETS`, `PseudocodeLanguage` type, banner text join, `.catch` on the chunk load, comment order). test-reviewer MUST FIX items (exact refusal text, Cambridge to Edexcel at App level, toolbar select) are fixed; compact-menu Python case and keyboard test are left.

### Wrap-up (26 Nov 2026)

- More text tests merged (#164, `pseudocode-text-gaps.test.ts`, hand-written from the spec rows): text arrays, BOOLEAN via IF, two counters, base-5 arrays, non-constant bounds, WHILE, REPEAT/UNTIL, STEP, IF/ELSE, CASE. All pass, nothing added to `pending.json`. CASE has no Edexcel form, so it becomes the same IF chain (CNV-24 says it maps across); say if you would rather it were refused.
- Not covered by a text test yet: CNV-10 "names the variable" (I could not write a program whose type cannot be inferred that the checker accepts), CNV-16 BYREF and subprogram signatures, CNV-14 FOR EACH.
- Architecture SHOULD items: four fixed in #165. Left: `name-clash` reports line 1; shared `childBlocks(stmt)` helper; `never` check in `expr()` (its default is a deliberate refusal because `Expr` includes every Python node).
- Still open for you: Q60, the SH-03 REAL formatter (blocks the `edexcel-to-cie` matrix), tightening the loose `REASONS` patterns in `matrix.test.ts`, the screenshots and keyboard-only Convert-menu test, and a "Convert from Python" item in the compact menu.
