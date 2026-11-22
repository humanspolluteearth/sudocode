# Harvested tests (from the prototype)

Programs taken from the old prototype (`reference/prototype/`) in milestone M0, each with an `.expected.json`
(schema: `../schema/expected.schema.json`, format: `docs/TEST-PLAN.md` section 4).

- `edexcel/`, `cie/`, `python/`: the prototype's 25 bundled examples, program text unchanged.
- `probes/edexcel/`, `probes/cie/`: the 41 pseudocode probes from `reference/prototype/data/pseudocode-probes.json`.

**Expected answers never come from the prototype.** Pseudocode answers come from `docs/language-spec/`; Python
answers come from CPython via `scripts/python-oracle.py`. Where the spec makes an example invalid, the expected
result is the error. Where the spec does not decide something, the file lists `openQuestions` (see
`docs/review/QUESTIONS.md`) and gives the proposed answer in `notes`.

Every test here is listed in `../pending.json`: nothing can run them until the front ends exist. A test leaves
`pending.json` in the PR that makes it pass, and only once its `openQuestions` are answered.

## Test IDs

A test's ID is its path from `packages/core/tests/` without the extension, for example
`harvested/probes/edexcel/SH-10-div-mod-negatives`. File names start with the spec ID they mainly prove; the
`spec` field lists every row involved. `MISC` marks a probe whose rule has no spec ID (the precedence table in
`edexcel.md` section 2.4).

## Conventions these expected files use (proposed in M0; review in `docs/review/M0.md`)

**Positions.** `line` and `column` are 1-based and count characters (Unicode code points; tabs count as one).
The column points at the first character of the part of the program the message is about:

| Diagnostic                                                                          | Column points at                                                        |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Lenient keyword forms (`ENDIF`, `ELSE IF`, `FOREACH`, lowercase keywords)           | The keyword (`ELSE` for `ELSE IF`)                                      |
| Double-quoted Edexcel string (EDX-07)                                               | The opening quote                                                       |
| Mixed casing of a CIE name (CIE-03)                                                 | That use of the name                                                    |
| Wrong operand types for an operator (EDX-26, EDX-31, CIE-45)                        | The operator                                                            |
| Arithmetic result too large (SH-07), division by zero (SH-09)                       | The operator                                                            |
| A value of the wrong type assigned (EDX-12)                                         | The value being assigned                                                |
| Wrong argument type for a built-in (CIE-121)                                        | The argument                                                            |
| Unknown function, undeclared name, missing `CALL`, missing `()`, global update note | The name                                                                |
| Keyword used as a name (CIE-03)                                                     | The name                                                                |
| Index out of range (EDX-27, CIE-22), array grows (EDX-27)                           | The start of the indexed expression (`scores[i]`)                       |
| `SEND a, b` (EDX-71)                                                                | The comma                                                               |
| `RECEIVE x FROM KEYBOARD` with no type (EDX-73)                                     | Where the type should be (`KEYBOARD`)                                   |
| Has no value yet (CIE-14)                                                           | The variable                                                            |
| File still open at the end (CIE-96)                                                 | `OPENFILE` in the statement that opened it                              |
| Python exceptions                                                                   | CPython's own traceback position for the innermost frame in the program |

**How many.** One diagnostic per occurrence (three double-quoted strings give three warnings). An undeclared
name is reported once, at its first use. After an error in a declaration, later uses of that name are not
reported again. Lists are ordered by line, then column.

**Checker vs runtime.** Checker errors (`E-CHK-`, `E-SYN-`) stop the program before it runs, so `stdout` is
empty. Runtime errors (`E-RUN-`, `E-PY-`) stop it where they happen; `stdout` holds what was printed before.
Warnings and info notes are listed whether or not the program runs.

**Input.** `RECEIVE ... KEYBOARD` (Edexcel) and `INPUT` without a prompt (CIE) print nothing. Typed input is
not echoed (docs/TEST-PLAN.md section 3).

**Files.** A line written to a file ends with `\n`.

**Codes.** Proposed codes for the M1 catalogue: `E-SYN-` syntax, `E-CHK-` checker, `E-RUN-` runtime, `E-PY-`
plus the CPython exception name, `W-` warnings, `I-` info notes.

| Code                     | Spec                    | Meaning                                                        |
| ------------------------ | ----------------------- | -------------------------------------------------------------- |
| `E-SYN-KEYWORD-AS-NAME`  | CIE-03                  | A keyword is used as a name                                    |
| `E-CHK-UNKNOWN-FUNCTION` | Q-EDX-4, CIE-120 to 130 | No built-in or user function with this name                    |
| `E-CHK-ARG-TYPE`         | CIE-121                 | A built-in got an argument of the wrong type                   |
| `E-CHK-TYPE-CHANGE`      | EDX-12                  | A variable is given a value of a different type                |
| `E-CHK-CONCAT-ARRAY`     | EDX-26                  | `&` used with an array                                         |
| `E-CHK-CONCAT-NUMBER`    | CIE-45                  | `&` used with a number                                         |
| `E-CHK-DIV-MOD-INTEGER`  | EDX-31                  | `DIV` or `MOD` with a non-INTEGER operand                      |
| `E-CHK-MISSING-PARENS`   | EDX-66                  | A subprogram with no parameters defined or called without `()` |
| `E-CHK-SEND-COMMA`       | EDX-71                  | `SEND` with a comma list                                       |
| `E-CHK-RECEIVE-NO-TYPE`  | EDX-73                  | `RECEIVE ... FROM` without `(type)`                            |
| `E-CHK-UNDECLARED`       | CIE-11                  | A variable used without `DECLARE`                              |
| `E-CHK-CALL-REQUIRED`    | CIE-71                  | A procedure called without `CALL`                              |
| `E-RUN-INDEX-RANGE`      | EDX-27, CIE-22          | Reading outside an array                                       |
| `E-RUN-NUMBER-TOO-LARGE` | SH-07                   | An INTEGER result outside the safe range                       |
| `E-RUN-NO-VALUE`         | CIE-14                  | A variable used before it has a value                          |
| `E-RUN-FILE-LEFT-OPEN`   | CIE-96                  | A file still open when the program ends                        |
| `W-EDX-DOUBLE-QUOTES`    | EDX-07                  | `"text"` instead of `'text'`                                   |
| `W-LOWERCASE-KEYWORD`    | EDX-05, CIE-02          | A keyword not in upper case                                    |
| `W-EDX-ELSE-IF`          | EDX-42                  | `ELSE IF` chain instead of nesting                             |
| `W-EDX-ENDIF`            | EDX-44                  | `ENDIF` instead of `END IF`                                    |
| `W-EDX-FOREACH`          | EDX-58                  | `FOREACH` instead of `FOR EACH`                                |
| `W-CIE-NAME-CASE`        | CIE-03                  | One name written with different casings                        |
| `I-EDX-ARRAY-GROWS`      | EDX-27                  | Writing past the end grew the array (first time only)          |
| `I-EDX-GLOBAL-UPDATE`    | EDX-63                  | A subprogram assigns to a global                               |
