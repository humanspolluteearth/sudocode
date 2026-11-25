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
