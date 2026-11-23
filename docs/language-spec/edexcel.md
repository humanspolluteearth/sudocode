<!-- Generated from the "Sudocode Language Specifications" doc on 23 Nov 2026. Edit this file directly from now on; the doc is the historical record. -->

# Edexcel International GCSE (4CP0) pseudocode

Source: Pearson Edexcel IGCSE Computer Science (4CP0) pseudocode command set (2018) and specification. Shared rules in `shared.md` apply too.

The official command set is short (about 30 constructs), so most of this section is SOURCE; the DECIDED rows fill gaps the command set leaves open, such as how negative `DIV` works, how arrays are created empty, and how files open and close.

### 2.1 Lexical rules

| ID | Rule | Status |
| --- | --- | --- |
| EDX-01 | Comments start with `#` and run to the end of the line; they may follow code | SOURCE |
| EDX-02 | Identifiers: letters, digits and `_`, starting with a letter | SOURCE |
| EDX-03 | Identifiers are case-sensitive (`MyValue` and `myValue` are different; the command set lists both as valid examples) | DECIDED |
| EDX-04 | Keywords are written in UPPER CASE | SOURCE |
| EDX-05 | Lowercase or mixed-case keywords (`set x to 5`, `End If`) are accepted with a warning. (The command set's own examples write `SET Size to ...`) | LENIENT (approved) |
| EDX-06 | String literals use single quotes: `'Hello'`. Curly quotes (`‘ ’`, as printed in the command set) are treated as straight quotes | SOURCE |
| EDX-07 | Double-quoted strings `"Hello"` are accepted with a warning | LENIENT (approved) |
| EDX-08 | Number literals: `42`, `3.14`. Boolean literals `TRUE`, `FALSE` (not in the command set; Pearson's Nov 2021 Paper 2 writes TRUE and its student book writes True/False, so Boolean literals are accepted in any case) | DECIDED |
| EDX-09 | No line continuation: each statement fits on one line. Long lines are handled by the editor's word-wrap | DECIDED (changed 23 Nov 2026) |
| EDX-10 | Devices are identifiers in UPPER CASE (`KEYBOARD`, `DISPLAY`, `CARD_READER`, `MOTOR`). The standard devices `DISPLAY` and `KEYBOARD` written in another case (`display`) are accepted with the lowercase-keyword warning (EDX-05) and mean the same device | SOURCE; any case DECIDED (23 Nov 2026, Q7) |

### 2.2 Data types, coercion and constants

| ID | Rule | Status |
| --- | --- | --- |
| EDX-11 | Data types: `INTEGER`, `REAL`, `BOOLEAN`, `CHARACTER`, plus `STRING` and `ARRAY` (listed as data structures) | SOURCE |
| EDX-12 | Variables are not declared; a variable's type comes from its first assigned value (or from the type in `RECEIVE ... FROM (type)`). Assigning a value of a different type later is a checker error, except INTEGER into REAL | DECIDED |
| EDX-13 | Mixed arithmetic: INTEGER with INTEGER gives INTEGER; anything with REAL gives REAL (`3 + 8.25` = `11.25`) | SOURCE |
| EDX-14 | `/` always gives REAL (`7 / 2` = `3.5`, `6 / 2` = `3` printed per SH-03) | DECIDED |
| EDX-15 | A one-character string literal is compatible with CHARACTER | DECIDED |
| EDX-16 | `&` with a STRING and a non-STRING converts the other value to STRING (`'Age ' & 18` = `'Age 18'`) | SOURCE |
| EDX-17 | Constants: `CONST <type> <name>` declares, then exactly one `SET <name> TO <value>`. A second SET is an error | SOURCE |

### 2.3 Variables and arrays

| ID | Rule | Status |
| --- | --- | --- |
| EDX-20 | Assignment: `SET <name> TO <expression>` | SOURCE |
| EDX-21 | Array literal: `SET Scores TO [10, 20, 30]` | SOURCE |
| EDX-22 | Indexes start at 0 for arrays and strings: `Scores[0]`, `Name[0]` (a CHARACTER) | SOURCE |
| EDX-23 | Element assignment: `SET Scores[1] TO 25` | SOURCE |
| EDX-24 | 2D arrays: element access and assignment as `Grid[row, col]`; created as a literal of rows `SET Grid TO [[1, 2], [3, 4]]`. `Grid[row][col]` accepted with a warning | SOURCE |
| EDX-25 | All elements of an array must share one type (checker error otherwise) | DECIDED |
| EDX-26 | `&` joins strings only. Using `&` with an array is a checker error | DECIDED (changed 23 Nov 2026) |
| EDX-27 | Reading an index outside the array is a runtime error. **Writing** to an index that doesn't exist yet grows the array, filling any gap with "no value"; reading a gap is a runtime error; an info note appears the first time (Q-EDX-1) | DECIDED |
| EDX-28 | Variables assigned in the main program are global; see EDX-62 for subprograms | DECIDED |

### 2.4 Operators and precedence

Arithmetic `+ - * / ^ MOD DIV`; relational `= <> < <= > >=`; logical `AND OR NOT`; string `&` (all SOURCE; `&` on arrays was rejected, see EDX-26). Precedence, highest first (DECIDED; the command set doesn't give one):

1. Brackets `( )`
2. `^` (right to left: `2 ^ 3 ^ 2` = `2 ^ 9`)
3. Unary minus
4. `*  /  DIV  MOD`
5. `+  -`
6. `&` (so `'Total: ' & A + B` adds first, then joins)
7. `=  <>  <  <=  >  >=`
8. `NOT`
9. `AND`
10. `OR`

| ID | Rule | Status |
| --- | --- | --- |
| EDX-34 | Operators bind in the precedence order listed above, highest first; operators on the same level work left to right, except `^` (right to left) | DECIDED |

| ID | Rule | Status |
| --- | --- | --- |
| EDX-30 | `^` with INTEGER base and non-negative INTEGER exponent gives INTEGER; otherwise REAL | DECIDED |
| EDX-31 | `DIV` and `MOD` follow floor rules (SH-10); both need INTEGER operands | DECIDED |
| EDX-32 | Strings compare alphabetically by character code (`'apple' < 'banana'`); `=` compares exact content, case-sensitive | DECIDED |
| EDX-33 | A bare `x = 5` statement is a checker error with the hint "write SET x TO 5". It is not accepted, because it loses marks in the exam | DECIDED (changed 23 Nov 2026) |

### 2.5 Selection

| ID | Rule | Status |
| --- | --- | --- |
| EDX-40 | `IF <condition> THEN … END IF` and `IF … THEN … ELSE … END IF` | SOURCE |
| EDX-41 | Nested IFs go inside THEN or ELSE, each with its own `END IF` | SOURCE (implied) |
| EDX-42 | `ELSE IF <condition> THEN` as a chain closed by a single `END IF` is accepted with a warning that the official form nests (older Pearson GCSE exam papers use ELSE IF) | LENIENT (approved) |
| EDX-43 | The condition must be BOOLEAN (`IF x THEN` where x is INTEGER is a checker error) | DECIDED |
| EDX-44 | `ENDIF` (one word) accepted with a warning | LENIENT (approved) |

### 2.6 Repetition

| ID | Rule | Status |
| --- | --- | --- |
| EDX-50 | `WHILE <condition> DO … END WHILE` (tests before each pass) | SOURCE |
| EDX-51 | `REPEAT … UNTIL <condition>` (runs at least once) | SOURCE |
| EDX-52 | `REPEAT <expression> TIMES … END REPEAT`. The count is evaluated once; 0 or negative runs zero times | SOURCE |
| EDX-53 | `FOR <id> FROM <a> TO <b> DO … END FOR`, inclusive of both ends (`FROM 1 TO 3` runs with 1, 2, 3) | SOURCE |
| EDX-54 | `FOR <id> FROM <a> TO <b> STEP <s> DO … END FOR`. Negative STEP counts down; a range that can't be reached runs zero times; STEP 0 is a runtime error | SOURCE |
| EDX-55 | Start, end and step are evaluated once, before the loop. Assigning to the loop variable inside the loop is a warning | DECIDED |
| EDX-56 | After `FOR i FROM 1 TO 10`, `i` holds 10: the last value the loop body ran with, as in Python. If the body never ran, `i` keeps whatever it held before (no value means the usual "has no value yet" error) | DECIDED (changed 23 Nov 2026) |
| EDX-57 | `FOR EACH <id> FROM <array or string> DO … END FOREACH` visits each element (or character) in order | SOURCE |
| EDX-58 | `FOREACH` (one word) and `END FOR EACH` accepted with a warning | LENIENT (approved) |

### 2.7 Subprograms

| ID | Rule | Status |
| --- | --- | --- |
| EDX-60 | `PROCEDURE <name> (<params>)` `BEGIN PROCEDURE … END PROCEDURE` | SOURCE |
| EDX-61 | `FUNCTION <name> (<params>)` `BEGIN FUNCTION … RETURN <expr> … END FUNCTION`. Reaching END FUNCTION without RETURN is a runtime error | SOURCE |
| EDX-62 | Parameters have no types or modes. Simple values are passed by value; arrays are passed by reference (changes inside are visible outside), matching Python, which Edexcel students program in | DECIDED |
| EDX-63 | Inside a subprogram, a variable first assigned there is local. Global variables can be read; **assigning** to an existing global updates the global, with an info note (Q-EDX-3) | DECIDED |
| EDX-64 | A call is `<name>(<arguments>)` as a statement (procedure) or inside an expression (function). Wrong number of arguments is a checker error | SOURCE |
| EDX-65 | Subprograms may be defined anywhere in the file and called before their definition; recursion allowed (SH-13) | DECIDED |
| EDX-66 | Procedures and functions with no parameters need `()` both where they are defined and where they are called. Missing `()` is a checker error | DECIDED (changed 23 Nov 2026) |

### 2.8 Input and output

| ID | Rule | Status |
| --- | --- | --- |
| EDX-70 | `SEND <expression> TO DISPLAY` prints one line | SOURCE |
| EDX-71 | `SEND a, b TO DISPLAY` is a checker error with the hint "join values with &" | DECIDED (changed 23 Nov 2026) |
| EDX-72 | `RECEIVE <name> FROM (<type>) KEYBOARD` reads a line and converts it to the type; failure is a runtime error (SH-06) | SOURCE |
| EDX-73 | `RECEIVE … FROM (type)` must include the type. Leaving it out is a checker error | DECIDED (changed 23 Nov 2026) |
| EDX-74 | Other input devices (e.g. `CARD_READER`) behave like the keyboard, with the device name shown in the input prompt. Other output devices (e.g. `MOTOR`) print `[MOTOR] <value>` to the console | DECIDED |
| EDX-75 | Sending a whole array (`SEND Scores TO DISPLAY`) is a checker error with the hint to send each element in a `FOR EACH` loop. Writing a whole array to a file (`WRITE Scores.txt Scores`) is the same checker error, with the hint to write each element in a loop. Single elements (`SEND Scores[0] TO DISPLAY`, `WRITE Scores.txt Scores[0]`) are fine | DECIDED (23 Nov 2026, Q4, Q19) |

### 2.9 Files

The command set only gives `READ <File> <record>` and `WRITE <File> <record>`, with no open, close or end-of-file test.

| ID | Rule | Status |
| --- | --- | --- |
| EDX-80 | File names may be written bare (`Scores.txt`) or quoted (`'Scores.txt'`) | SOURCE |
| EDX-81 | `WRITE <File>` takes one expression; build a line with `&`. A comma list is a checker error | DECIDED (changed 23 Nov 2026) |
| EDX-82 | `READ <File> <variable>` takes one variable and reads the whole next line. If the variable already has a type (INTEGER, REAL, BOOLEAN, CHARACTER), the line is converted to that type, and a line that can't be converted is a runtime error (as SH-06). Otherwise the variable becomes a STRING. Several variables is a checker error | DECIDED (changed 23 Nov 2026) |
| EDX-83 | Files open automatically on first use. The first WRITE to a file in a run replaces its old contents; later WRITEs in the same run add lines. Each file is read from its first line, one record per READ | DECIDED |
| EDX-84 | Reading past the last line is a runtime error with a hint to count the records (Q-EDX-2) | DECIDED (changed 23 Nov 2026) |

### 2.10 Built-in functions

| ID | Function | Rule | Status |
| --- | --- | --- | --- |
| EDX-90 | `LENGTH(x)` | Number of elements in an array or characters in a string | SOURCE |
| EDX-91 | `RANDOM(n)` | Random INTEGER from 0 to n **inclusive**; n must be a non-negative INTEGER | SOURCE (inclusive confirmed by a June 2019 Paper 2 comment: RANDOM(9) + 1 gives 1 to 10) |

Type conversion uses the cast form from RECEIVE; no other built-ins exist in the command set, and Sudocode adds none (Q-EDX-4).

### 2.11 Not in Edexcel pseudocode

Records, DATE, CASE statements and OPEN/CLOSE are not in the command set, so they are not part of Sudocode's Edexcel language. Students who write them get "not part of Edexcel pseudocode" with a hint (e.g. "use nested IF").

### 2.12 What real Edexcel exam pseudocode does (research)

| ID | Finding | Effect on Sudocode |
| --- | --- | --- |
| EDX-100 | The November 2021 Paper 2 binary search writes `SET found TO TRUE`, `NOT found` and `(start + end) DIV 2`, and nests IF inside ELSE | Confirms EDX-08, EDX-31, EDX-41 |
| EDX-101 | The same official paper contains a bare assignment `end = middle – 1` (no SET) | Not accepted: a bare `x = <expr>` is a checker error with a hint to write `SET x TO <expr>` (EDX-33, changed 23 Nov 2026) |
| EDX-102 | Pearson's student book writes `SET found TO False` and `IF found = True THEN` | Booleans accepted in any case (EDX-08) |
| EDX-103 | Older Pearson GCSE papers used record-style dot access (`ListOfStations.Distance[Index]`) | No records in Edexcel for v1; revisit if students ask (Q-EDX-5) |
| EDX-104 | The June 2025 practical uses only SET, RANDOM, REPEAT…TIMES, IF, SEND and RECEIVE in its pseudocode listing; the command set is still enclosed with every paper | No change; the command set remains the grammar |
