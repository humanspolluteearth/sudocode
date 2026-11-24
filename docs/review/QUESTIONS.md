# Questions and answers

Claude adds questions here; you answer below each one. Claude reads this file at the start of every milestone.

## From the audit (23 Nov 2026)

1. **SH-03:** should pseudocode print `0.1 + 0.2` as `0.30000000000000004` (shortest exact form, as the spec says)
   or `0.3` (rounded, as the prototype did)? Default if unanswered: `0.30000000000000004`.
   - Answer (23 Nov 2026): **`0.3` (rounded).** This changes the proposal and SH-03. Rule: a REAL is rounded to 10
     decimal places, then printed in its shortest form (`0.1 + 0.2` -> `0.3`, `7 / 2` -> `3.5`, `6 / 2` -> `3`).
     Python is unaffected (it still prints exactly as CPython). Update SH-03 in `docs/language-spec/shared.md`
     and correct `harvested/probes/edexcel/SH-03-real-output` to print `0.3\n3.5\n3\n` (M1, small PR).
2. **PY-41 / SH-12:** should `random.seed(n)` reproduce CPython's exact sequence (needs a Mersenne Twister port)?
   Default if unanswered: yes.
   - Answer (23 Nov 2026): **Yes, match CPython exactly** (port the Mersenne Twister and CPython's `random` algorithms).
3. **Old bug list:** the architecture doc mentions "bugs 5-14" from the prototype, but the list wasn't in the export.
   Paste it here if you have it; each becomes a regression test.
   - Answer (23 Nov 2026): **No list. Drop it**: the audit probes already cover the known prototype bugs. Closed.

## From M0: harvesting the prototype's examples and probes (23 Nov 2026)

Each answer decides an expected result. The tests named stay pending until you answer. "Proposed" is what the
expected file says now; if you agree, write "yes"; if not, the M1 session corrects the file in a small PR.

4. **Edexcel array output:** the spec doesn't say how `SEND nums TO DISPLAY` prints a whole array.
   Proposed: like a Python list, `[4, 8, 15, 17, 29, 42]`. Also: how do STRING and BOOLEAN elements look inside it
   (`['a', 'b']` or `[a, b]`; `[TRUE]` or `[True]`)? Proposed: `['a', 'b']` and `[TRUE]`. Only the INTEGER case is
   tested so far.
   Tests: `harvested/edexcel/EDX-50-example-bubble-sort`.
   - Answer (23 Nov 2026): **Not as proposed: a whole array can't be output in Edexcel.** `SEND <array> TO DISPLAY`
     (or `&` with an array) is a checker error with a hint to print the elements one by one with a loop. Add a spec
     row for it, and correct `harvested/edexcel/EDX-50-example-bubble-sort` so the program prints each element in a
     FOR loop (one per line) instead of the whole array (M1, small PR).
5. **CIE multi-name DECLARE:** is `DECLARE Temp, Index, Last : INTEGER` allowed? The spec only shows one name per
   DECLARE. Proposed: yes.
   Tests: `harvested/cie/CIE-20-example-bubble-sort`, `CIE-120-example-string-functions`, `CIE-30-example-records-and-byref`.
   - Answer (23 Nov 2026): **Yes, allowed** (no warning). Add a spec row for it.
6. **CIE name that is a keyword in another case:** the records example declares `Class`. CIE-03 says names are not
   case-sensitive and keywords can't be names, and CLASS is a keyword (CIE-110). Proposed: an error
   (`E-SYN-KEYWORD-AS-NAME`) where it is declared, reported once: the later uses of `Class` give no further error and no
   lowercase-keyword warning (CIE-02), because they are treated as that (failed) name. The alternative (allowed as a
   name) prints `Top: Ben with 74`; if so, should each `Class` still get a warning?
   Tests: `harvested/cie/CIE-30-example-records-and-byref`.
   - Answer (23 Nov 2026): **Yes, as proposed**: error at the declaration, reported once, no follow-on errors or warnings.
7. **Edexcel lowercase device names:** in `send x to display`, devices are UPPER CASE identifiers (EDX-10) and
   identifiers are case-sensitive (EDX-03), so read literally `display` is a different device and prints
   `[display] 5` (EDX-74). Proposed: the standard devices (`DISPLAY`, `KEYBOARD`) in any case are accepted with the
   lowercase-keyword warning, so it prints `5`.
   Tests: `harvested/probes/edexcel/EDX-05-lowercase-keywords`.
   - Answer (23 Nov 2026): **Yes, as proposed**: `DISPLAY`/`KEYBOARD` in any case are accepted with the warning; prints `5`.
8. **EDX-74 input prompt for other devices:** "the device name shown in the input prompt": is that printed to the
   console (stdout), or only shown on the input box? Proposed: input box only; nothing printed.
   Tests: `harvested/probes/edexcel/EDX-74-other-devices`.
   - Answer (23 Nov 2026): **Yes, as proposed**: input box only; nothing printed.
9. **CIE `OPENFILE ... FOR RANDOM` on a file that doesn't exist:** create an empty file, or runtime error
   (SH-11 says reading a missing file is an error)? Proposed: create it.
   Tests: `harvested/probes/cie/CIE-94-random-file`.
   - Answer (23 Nov 2026): **Runtime error** (not as proposed), consistent with SH-11. Add a spec row and correct
     `harvested/probes/cie/CIE-94-random-file` to expect a missing-file runtime error at the OPENFILE line (M1, small PR).
10. **CIE enumerated value output:** what does `OUTPUT S` print when `S ← Summer`? Proposed: the value's name,
    `Summer`.
    Tests: `harvested/probes/cie/CIE-31-enum`.
    - Answer (23 Nov 2026): **No preference; use the proposal**: prints `Summer`.
11. **CIE `UCASE`/`LCASE` with a STRING:** CIE-121 lists `UCASE(c)` returning CHAR, and CIE-122 adds `TO_UPPER` for
    CHAR or STRING. Proposed: `UCASE(Word)` with a STRING variable is a checker error (wrong argument type).
    Tests: `harvested/cie/CIE-120-example-string-functions`.
    - Answer (23 Nov 2026): **Yes, as proposed**: checker error, with a hint to use `TO_UPPER`/`TO_LOWER`.
12. **Python oracle version:** CPython 3.12 couldn't be installed in the M0 session (no network route for `uv`, and
    running a hand-downloaded binary was blocked), so the 8 Python expected files were generated with CPython
    3.14.10 and are marked. Please run once:
    `python3.12 scripts/python-oracle.py --check packages/core/tests/harvested/python/*.py`
    "0 difference(s)" closes this question.
    Tests: every `harvested/python/` test.
    - Answer (23 Nov 2026): **Let CI check it.** Downloads are blocked on my machine. In M8 the `python-sample` job
      (Python 3.12 via `actions/setup-python`) must run the oracle `--check` on these 8 files; if it reports
      differences, regenerate them with 3.12 in a small PR. Keep the 3.14 note until then.

## From M1 (23 Nov 2026)

13. **Q4 conflict (M1 question 1):** PR #10's first draft said "print the array"; the M1 goal said checker error.
    - Answer (23 Nov 2026): **Checker error is correct** (EDX-75, as merged). The Q4 answer above is the final one.
14. **Rename `EDX-50-example-bubble-sort` (M1 question 2):** it now proves EDX-75. May it be renamed `EDX-75-...`,
    its `spec` trimmed, and a new runnable bubble-sort golden added that sends elements one at a time?
    - Answer (23 Nov 2026): **Yes.** This is an authorised edit of a merged expected file (rename + `spec` only).
15. **Rename the `MISC-precedence-*` probes (M1 question 3)** to `EDX-34-...` with `spec` `["EDX-34", ...]`?
    - Answer (23 Nov 2026): **Yes.** Authorised edit (rename + `spec` only).
16. **Stale Q5 markers (M1 question 4):** remove `openQuestions: ["Q5"]` and add CIE-15 to `spec` in
    `cie/CIE-20-example-bubble-sort`, `cie/CIE-120-example-string-functions`, `cie/CIE-30-example-records-and-byref`?
    - Answer (23 Nov 2026): **Yes.** Authorised edit (marker + `spec` only; expected values unchanged).
17. **EDX-34 wording (M1 question 5):** same-level operators work left to right, except `^` (right to left)?
    - Answer (23 Nov 2026): **Yes, correct** (`10 - 3 - 2` = 5; `2 ^ 3 ^ 2` = 512).
18. **SH-03 edge cases (M1 question 6):**
    - a negative REAL that rounds to zero (`-0.00000000001`): **prints `0`** (never `-0`).
    - very large REALs: **print all digits, never exponent form** (`10 ^ 21` as a REAL prints
      `1000000000000000000000`). Add both to SH-03.
    - Answer (23 Nov 2026): as above.
19. **EDX-75 scope (M1 question 7):** is writing a whole array to a file (`WRITE Scores.txt Scores`) also an error?
    - Answer (23 Nov 2026): **Yes, a checker error too**, with the same hint (write the elements one at a time in a
      loop). Extend EDX-75 to cover `WRITE <File>`.

## From M2 (23 Nov 2026)

Tests named here stay pending (`openQuestions`) until you answer; the others show what the engine does now.

20. **SH-03 small REALs:** Q18 says very large REALs never use exponent form. Should small ones also print in full
    (`0.0000001`, `0.0000000001`) rather than `1e-7`? Proposed: yes; after rounding to 10 decimal places every digit
    fits in 10 decimals anyway.
    Tests: `conformance/edexcel/SH-03-real-small-no-exponent` (pending).
    - Answer (24 Nov 2026): **Yes, in full.** `0.0000001` prints as written; `0.00000000004` rounds to `0`. SH-03 extended. Held test `conformance/edexcel/SH-03-real-small-no-exponent` can be enabled.
21. **SH-03 large REALs that aren't exact:** `10.0 ^ 23` is stored as 99,999,999,999,999,991,611,392. Print the
    shortest form written out (`100000000000000000000000`) or the exact stored value? Proposed: the shortest form
    (it is what "shortest form" means, and 10 ^ 21, 10 ^ 22 are the same both ways).
    Tests: none yet.
    - Answer (24 Nov 2026): **Shortest form written out** (`10.0 ^ 23` prints `100000000000000000000000`). SH-03 extended.
22. **SH-03 infinity:** `10.0 ^ 400` is too large for a REAL. Runtime error ("number too large", as SH-07), or print
    something? Proposed: the SH-07 runtime error.
    Tests: none yet.
    - Answer (24 Nov 2026): **Runtime error**, the SH-07 "number too large", at that line. SH-03 extended.
23. **EDX-25 INTEGER and REAL in one array:** is `[1, 2.5]` an array of REAL (as EDX-12 lets an INTEGER go into a
    REAL), or an error because the elements' types differ? And `SET Prices[0] TO 3` into a REAL array?
    Proposed: allowed in both cases (an array of REAL).
    Tests: none yet.
    - Answer (24 Nov 2026): **Allowed in both cases**: `[1, 2.5]` is an array of REAL; `SET Prices[0] TO 3` into a REAL array is fine. EDX-25 extended.
24. **EDX-12 CHARACTER into STRING:** `SET initial TO name[0]` when `initial` already holds a STRING. EDX-12 read
    strictly makes it an error (only INTEGER into REAL is allowed). Proposed: allowed (a CHARACTER is one character of
    text; EDX-15 already lets one-character text fit the other way).
    Tests: none yet.
    - Answer (24 Nov 2026): **Allowed.** A CHARACTER may go into a variable holding a STRING. EDX-12 extended.
25. **EDX-21 empty array `[]`:** allowed? Proposed: yes; `LENGTH` is 0, `FOR EACH` runs zero times, and its element
    type comes from the first element written into it.
    Tests: none yet.
    - Answer (24 Nov 2026): **Allowed.** `[]` has `LENGTH` 0; its element type comes from the first element written. EDX-21 extended.
26. **EDX-23 changing one character of a STRING:** `SET Name[0] TO 'E'`. EDX-23 shows it only for arrays.
    Proposed: a checker error (a STRING can't be changed in place, as in Python).
    Tests: `errors/edexcel/EDX-23-string-element` (pending).
    - Answer (24 Nov 2026): **Checker error** `E-CHK-STRING-ELEMENT` with the wording proposed ("A STRING can't be changed one character at a time", hint "Build a new STRING with & instead."). EDX-23 extended. Held test `errors/edexcel/EDX-23-string-element` can be enabled.
27. **EDX-42 `ELSE IF` with two `END IF`s:** a student writes the official nesting but puts `IF` on the `ELSE`
    line, then closes with two `END IF`s. As an `ELSE IF` chain, the second `END IF` has no IF. Proposed: report it
    (`E-SYN-UNMATCHED-CLOSER`), since the chain form uses one END IF.
    Tests: none yet.
    - Answer (24 Nov 2026): **Accept both forms**, made exact in a follow-up question: an `ELSE IF` chain followed by a second `END IF` closes an enclosing IF if one was opened earlier; only when there is none is it `E-SYN-UNMATCHED-CLOSER`. EDX-42 extended. Needs code and tests (not yet written).
28. **EDX-30 `^` with a variable exponent:** `SET p TO 2 ^ e`: the type is INTEGER when `e` >= 0 and REAL when it is
    negative, which the checker can't know. Proposed: the checker treats INTEGER ^ INTEGER as INTEGER unless the
    exponent is a negative number written in the program; at run time the value follows EDX-30.
    Tests: none yet.
    - Answer (24 Nov 2026): **As proposed.** EDX-30 extended.
29. **EDX-17 a constant's SET inside a loop:** one SET statement that runs several times. Proposed: allowed (it is
    still one SET).
    Tests: none yet.
    - Answer (24 Nov 2026): **Allowed.** EDX-17 extended.
30. **EDX-55/EDX-56 assigning to the FOR variable inside the loop:** does the next pass continue from the loop's own
    count (Python), and does the variable afterwards keep the value the body assigned (Python) or the loop's last
    value (EDX-56's wording)? Proposed: Python in both; EDX-55's warning is shown either way.
    Tests: none depend on it.
    - Answer (24 Nov 2026): **Python behaviour in both**; EDX-55 warning is shown either way. EDX-55 extended (EDX-56 already says this).
31. **AND / OR short-circuit:** in `i < LENGTH(a) AND a[i] = x`, is the right side skipped when the left side
    decides (Python), or always worked out? Proposed: skipped, as in Python.
    Tests: none depend on it.
    - Answer (24 Nov 2026): **Skipped**, as in Python. Added to the operators paragraph in `edexcel.md` (section 2.4).
32. **The merged M0 check "MISC is pending" (`packages/core/tests/harvested/harvested.test.ts`) blocks the engine PR
    (#28).** It requires every harvested test to be in `pending.json`. 21 harvested Edexcel tests now pass, and a
    passing test can't stay pending (CI fails it). Proposed: replace the check with the harvested README's own rule,
    "stays pending while one of its open questions is unanswered" (exact diff in #28). It is a merged test, so the
    hook stops me: may I make the change, or will you?
    Tests: PR #28 (red on exactly these 21 checks).
    - Answer: Yes: change the harvested check so a harvested test stays pending only while one of its open questions is unanswered (the exact diff in #28). This authorises editing `packages/core/tests/harvested/harvested.test.ts` for that change only.
33. **M2 checklist ticked in one PR (#32), review kept in `M2.md`.** The /goal said "first unticked item only, one PR". All 11 M2
    items were already merged (#23-#28) but unticked, so #32 ticked them together, and the second review pass went into the
    existing `docs/review/M2.md` instead of a new file. Proposed: accept both as they are (docs only, PR numbers checked
    against each PR's files); from M3 on, one item per PR.
    Tests: none.
    - Answer: accept

## From M4 (24 Nov 2026)

The RECEIVE code implements the proposed answers below, so their tests pass (a passing test can't stay pending; see
D14 in `docs/review/M4.md`). If you answer differently, the tests and code change together.

34. **SH-06 what counts as a number when typed (D1, D11).** Proposed: spaces around the number are ignored; INTEGER is
    one optional `+`/`-` and digits; REAL also allows one point and an exponent (`2.5`, `.5`, `5.`, `1e3`), and a
    whole number (`3` is the REAL 3). Rejected: `3.5` for INTEGER, an empty line, `1,000`, `--5`, `Infinity`, `NaN`,
    `0x10`, `1_0` (Python's `float()` accepts the last four; we don't, as they aren't numbers a student would type).
    Tests: `EDX-72-receive-integer-spaces-ignored`, `EDX-72-receive-real-whole-number`, `SH-05-positive-sign-integer`,
    `SH-06-infinity-is-not-real`, `SH-06-two-signs-is-not-integer`, `SH-06-comma-number-is-not-integer`.
    - Answer (24 Nov 2026): **As proposed.** SH-06 extended with the exact rule. M4 tests stand.
35. **An INTEGER input beyond ±9,007,199,254,740,991 (D12).** Proposed: the SH-07 "number too large" error at the
    RECEIVE, not "not an INTEGER".
    Tests: `SH-07-integer-input-too-large`.
    - Answer (24 Nov 2026): **SH-07 "number too large" error** at the RECEIVE. SH-06 extended.
36. **SH-17 trace rows (D4).** Proposed: each FOR pass records the loop variable on the FOR line; an output row holds the
    printed line without its newline; device output reads `[MOTOR] on`, as the console shows it.
    Tests: `SH-17-trace-assignments-and-output`, `SH-17-trace-device-output`.
    - Answer (24 Nov 2026): **As proposed.** SH-17 extended.
37. **SH-17 changing one array element (D5).** Proposed: the row names the array and shows the whole new array
    (`scores = [3, 9]`), as an element is not a variable column.
    Tests: `SH-17-trace-element-change-records-the-array`.
    - Answer (24 Nov 2026): **As proposed.** SH-17 extended.
38. **BOOLEAN input in any case (D2).** Proposed: `true`, `False`, `TRUE` are accepted, as Boolean literals are
    (EDX-08). `T`, `1`, `yes` are not.
    Tests: `EDX-72-receive-boolean-any-case`.
    - Answer (24 Nov 2026): **As proposed.** EDX-72 extended.
39. **Debugger stepping (D6, D7).** Proposed: Step before a run starts stops before line 1; Step over stops at the next
    statement in the same or an outer frame; each new FOR pass stops on the FOR line before the variable changes, and
    the loop ends without stopping there again. Not a language rule, so its tests aren't held back.
    Tests: `debugger/MISC-step-over-through-a-for-loop`, `debugger/MISC-step-over-walks-the-lines`.
    - Answer (24 Nov 2026): **As proposed.** Not a language rule; the M4 tests stand.
40. **May I change a merged test so RECEIVE is no longer "not supported"? (blocks the RECEIVE PR)**
    `packages/core/src/edexcel/parser.test.ts` "SH-18 subprograms, input and files are recognised as not supported yet"
    (merged in M2) expects `RECEIVE x FROM (INTEGER) KEYBOARD` to give `E-SYN-NOT-SUPPORTED 5:1`. M4 makes RECEIVE work,
    so that test must fail. Proposed change: swap the RECEIVE line for a file statement that is still not supported
    (`READ Data.txt x` on line 5, EDX-82; expectation unchanged), and rename the test to "...subprograms and files...".
    RECEIVE itself is already covered by the EDX-72/73/74 conformance tests. The RECEIVE PR stays open until you answer.
    - Answer: Approved: RECEIVE removed from the SH-18 not-supported test.
41. **Do I-EDX-GLOBAL-UPDATE notes (Q-EDX-3) apply to a global assigned in a subprogram? (M5 SHOULD FIX test left out)**
    The spec text for Q-EDX-3 doesn't say whether assigning a global from inside a subprogram is an error, a warning
    or just an info note, so no test was written for it. Current behaviour: an `I-EDX-GLOBAL-UPDATE` info, once per
    subprogram. Please say what the rule is and I will add the test.
    - Answer (24 Nov 2026): **The spec (EDX-63) already says: update the global, with an info note.** Detail you chose: the note names the variable and is shown **once per subprogram per variable** (today's code shows it once per subprogram, so a code change and a test are needed). EDX-63 extended.

## From M5 and M6 (24 Nov 2026)

42. **M5 property tests use a home-made seeded `forAll` instead of fast-check** (no network in the sandbox).
    - Answer (24 Nov 2026): **Switch to fast-check in a later chore PR.** Until then the home-made helper stays.
43. **M5 corpus location and outputs:** `tests/golden/edexcel/corpus/` (not `tests/corpus/`), outputs worked out by hand.
    - Answer (24 Nov 2026): **Accept both.** TEST-PLAN.md names the real folder.
44. **M6 file error wording and columns** (`E-RUN-FILE-NOT-FOUND`, `E-RUN-READ-PAST-END`, `E-RUN-INPUT-TYPE` file
    variant, `E-CHK-READ-ONE-VARIABLE`, `E-CHK-SEND-COMMA` write variant, grid `grid[0]` message).
    - Answer (24 Nov 2026): **Approved as merged** (wording and columns).
45. **M6 file edge cases** (EDX-81/82/83).
    - Answer (24 Nov 2026): **Blank line:** into a STRING gives an empty STRING; into any other type it is a runtime
      error "Line 2 of d.txt is empty" (hint "Put a value on that line, or READ it into a STRING."). **No final
      newline:** the last line is still a record; a trailing newline adds no empty record. **WRITE** of a number or
      BOOLEAN writes the same text as SEND (`3.5`, `TRUE`). **CHARACTER** from a longer line: runtime error
      "The line ab in d.txt is not a single character" (hint "Fix that line in the Files panel, or READ it into a STRING
      variable."). EDX-81/82/83 extended.

## From M7 (24 Nov 2026)

46. **CIE-81: where does the `INPUT "Prompt" X` prompt text go?** The spec says the prompt is "shown first" but not
    whether it is part of stdout (and whether a newline follows it). No CIE-81 test is written; CIE-81 is left out of
    `scope.json` until you decide. My suggestion: the prompt is console output without a newline, then the input box.
    - Answer (24 Nov 2026): **Console output with no newline**, then the input box (the typed line is echoed as in any input). CIE-81 extended; its goldens go into `scope.json`.
47. **CIE-51: does `ELSE IF` stay one chain with one `ENDIF`, or open a nested IF needing its own `ENDIF`?** The spec
    says "ELSE IF chains accepted with warnings". No ELSE IF test is written until you decide. My suggestion: a
    single chain, one `ENDIF`, one `W-CIE-ELSE-IF` warning at the ELSE.
    - Answer (24 Nov 2026): **One chain, one `ENDIF`**, one `W-CIE-ELSE-IF` warning at the ELSE. CIE-51 extended.
48. **Web size budget (M7).** The CIE front end adds about 8 kB gzipped to the web build (247.9 kB against the 240 kB
    budget in `scripts/size-budget.json`), so `build-web` fails on PR #68. I did not raise the budget because I may
    never loosen a CI check. Please either raise it (my suggestion: 270 kB, since a whole language needs room, and
    Python in M8 will need more) or tell me what to cut. PR #68 stays open until then.
    **Answered 24 Nov 2026: raise it.** Budget raised to 270 kB (276480 bytes) in #68 for the CIE engine.
49. **CIE built-ins (M7): four spec gaps.** (a) `STR_TO_NUM` returns "INTEGER or REAL": I type it REAL, so
    `N <- STR_TO_NUM("5")` into an INTEGER needs `INT()`. (b) `ASC`/`CHR` accept only 0 to 127 (ASCII). (c) `LEFT`,
    `RIGHT`, `MID` asking for more characters than there are is a runtime error, not a shorter result. (d) A DATE
    prints `dd/mm/yyyy` with zero padding, and DATEs can't be compared. Tests for these edges are `MISC`-named unit
    tests in `src/cie/builtins.test.ts`, not goldens, until you decide.
    - Answer (24 Nov 2026): **(a)** STR_TO_NUM stays REAL; `N <- STR_TO_NUM("5")` into an INTEGER is `E-CHK-TYPE-CHANGE` with a hint to use `INT()` (CIE-124 extended); **(b), (c), (d) confirmed as implemented** (CIE-126, CIE-120, CIE-129 extended).
50. **CIE-31: what happens when an enumerated value is stepped past either end?** The spec gives `S + 1` and
    comparison but is silent on `S + 1` at the last value, `S - 1` at the first, and on `- n` in general. I raise the
    runtime error `E-RUN-ENUM-RANGE` ("Summer is a Season, and moving 1 place from it goes past the end of the list"),
    and only the probe-level unit test `MISC` in `src/runtime/records.test.ts` pins it. Please confirm the error (the
    alternative is wrapping round) and the wording.
    - Answer (24 Nov 2026): **Runtime error `E-RUN-ENUM-RANGE`**, wording as proposed. CIE-31 extended.

## Q51 (M7): Cambridge file details the spec does not give

Logged by Claude under /goal. Implemented as below; no golden test depends on them. Please confirm or correct.

- Answer (24 Nov 2026): **All confirmed as implemented** (CIE-91 and CIE-95 extended).

- Reading, writing or EOF on a file that was never opened: runtime error `E-RUN-FILE-NOT-OPEN` (new code).
- OPENFILE on a file that is already open: runtime error `E-RUN-FILE-ALREADY-OPEN` (new code), from "one mode at a time" (CIE-91).
- Random files: the address starts at 1 after OPENFILE and does not move by itself after GETRECORD/PUTRECORD; SEEK below 1 is `E-RUN-RECORD-EMPTY`. Random-file records live in memory only; they are not shown in the Files panel or kept between runs.

## From the M7 test review (please decide)

- Two merged tests pin behaviour the spec does not decide or contradicts, and I may not edit merged tests: (a) `cie/arrays.test.ts` expects `E-SYN-NOT-SUPPORTED` for a 2D array with different lower bounds (CIE-20/21 allow any bounds; this is a gap in the code); (b) `cie/builtins.test.ts` expects `N <- STR_TO_NUM("5")` to be `E-CHK-TYPE-CHANGE` (CIE-124 says the result is "INTEGER or REAL"; should it be allowed into an INTEGER variable when the text is whole?). Please say whether to replace them.
- Answer (24 Nov 2026): **(a) 2D arrays with different lower bounds are allowed** (CIE-21 extended); the merged test in `cie/arrays.test.ts` may be replaced to match. **(b) STR_TO_NUM into an INTEGER stays an error** (see Q49a); the merged test already pins that, so it needs no change. **CIE-10:** `DECLARE F : FILE` is a checker error with a hint to use a STRING file name (CIE-10 extended).
- Choices not in the spec: `RAND(0)` returns 0; `IS_NUM("3.")` is FALSE; `MID("abc",3,2)` is an error; `SUPER` outside a subclass is a syntax error.
  - Answer (24 Nov 2026): **All four confirmed as implemented**; written into CIE-113, CIE-128, CIE-125 and CIE-120.

## Q52: wrong column in merged CIE-10 test (24 Nov 2026)

`tests/errors/cie/CIE-10-file-type.expected.json` (merged in #85) expects column 15, but `FILE` in `DECLARE F : FILE` starts at column 13. Merged tests may not be edited, so it stays in `pending.json` (it fails, as pending expects) and `CIE-10-file-type-column` carries the corrected column. Please approve deleting the wrong one.
