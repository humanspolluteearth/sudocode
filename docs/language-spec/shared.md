<!-- Generated from the "Sudocode Language Specifications" doc on 23 Nov 2026. Edit this file directly from now on; the doc is the historical record. -->

# Shared rules (all three languages)

These rules apply to Edexcel, CIE and Python unless a language file overrides them.

These rules apply everywhere unless a language section overrides them; all were proposed (the exam documents don't describe an execution environment) and all were approved on 23 Nov 2026.

| ID | Rule | Status |
| --- | --- | --- |
| SH-01 | Source files are UTF-8. Windows (`\r\n`) and Unix (`\n`) line endings are both accepted | DECIDED |
| SH-02 | Each output statement writes one line to the console, unless the language says otherwise (Python `end=`) | DECIDED |
| SH-03 | Number output: pseudocode rounds a REAL to 10 decimal places, then prints the shortest form (`7 / 2` gives `3.5`, `6 / 2` gives `3`, `0.1 + 0.2` gives `0.3`). A negative REAL that rounds to zero prints `0`, never `-0` (`-0.00000000001` gives `0`). Very large REALs print all their digits, never exponent form (`10 ^ 21` as a REAL gives `1000000000000000000000`). Small REALs print in full too, never exponent form (`0.0000001` gives `0.0000001`; `0.00000000004` rounds to `0`). A REAL that is not exact prints its shortest form written out (`10.0 ^ 23` gives `100000000000000000000000`, not the exact stored value). A REAL too large to hold (`10.0 ^ 400`) is the SH-07 "number too large" runtime error. Python prints exactly as CPython does (`3.0`, `0.30000000000000004`) | DECIDED (changed 23 Nov 2026, Q1, Q18; extended 24 Nov 2026, Q20-Q22) |
| SH-04 | Boolean output: pseudocode prints `TRUE` / `FALSE`; Python prints `True` / `False` | DECIDED |
| SH-05 | Input: the console shows an input box when the program waits; the typed line (without the newline) is the input. Cancel or Stop ends the program | DECIDED |
| SH-06 | Invalid typed input for a typed request (e.g. letters when an INTEGER is expected) is a runtime error with a kid-friendly message, not a silent 0. What counts as a number when typed: spaces around it are ignored; INTEGER is one optional `+` or `-` and digits; REAL also allows one point and an exponent (`2.5`, `.5`, `5.`, `1e3`) and a whole number. Not accepted: `3.5` for an INTEGER, an empty line, `1,000`, `--5`, `Infinity`, `NaN`, `0x10`, `1_0`. An INTEGER beyond the SH-07 range is the SH-07 "number too large" error, not "not an INTEGER" | DECIDED (Q34, Q35) |
| SH-07 | Pseudocode INTEGER range is the JavaScript safe integer range (±9,007,199,254,740,991); exceeding it is a runtime error "number too large". Python `int` is unlimited | DECIDED |
| SH-08 | REAL / float uses 64-bit floating point in all three languages | DECIDED |
| SH-09 | Division by zero (`/`, `DIV`, `MOD`) is a runtime error in all languages | DECIDED |
| SH-10 | Integer division and modulus follow **floor** rules in all three languages, matching Python's `//` and `%` (so `-7 DIV 2` = `-4`, `-7 MOD 2` = `1`). Both exam boards map `DIV`/`MOD` to Python `//`/`%`, and positive numbers (all exam examples) behave identically under any rule | DECIDED |
| SH-11 | Files live in Sudocode's virtual file system (per project), shown in a Files panel. File names are not case-sensitive (the CIE guide's own example opens "StudentFile.Dat" and closes "StudentFile.dat"). Reading a missing file is a runtime error | DECIDED |
| SH-12 | Random numbers come from a seedable generator. Normal runs use a fresh seed; tests and "replay" use a fixed one | DECIDED |
| SH-13 | Recursion depth limit: 1,000 calls, with a friendly error naming the procedure | DECIDED |
| SH-14 | Possible infinite loop: after 10 million steps the program pauses and asks whether to continue | DECIDED |
| SH-15 | Every error has a code, the student's line and column, a plain-language message, a hint and (where possible) a suggested fix | DECIDED |
| SH-16 | Lenient variants (LENIENT rows) produce a warning, never an error, and never change meaning | DECIDED |
| SH-17 | Trace table: every variable assignment and every output is recorded with its line number; columns are all variables in order of first assignment. Each FOR pass records the loop variable on the FOR line; an output row holds the printed line without its newline (device output reads `[MOTOR] on`); changing one array element records the array's name with the whole new array (`scores = [3, 9]`) | DECIDED (Q36, Q37) |
| SH-18 | Unsupported but recognisable constructs (e.g. a Python `match` statement) give "not supported in Sudocode yet", never a confusing syntax error | DECIDED |
