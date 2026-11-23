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
    - Answer:
21. **SH-03 large REALs that aren't exact:** `10.0 ^ 23` is stored as 99,999,999,999,999,991,611,392. Print the
    shortest form written out (`100000000000000000000000`) or the exact stored value? Proposed: the shortest form
    (it is what "shortest form" means, and 10 ^ 21, 10 ^ 22 are the same both ways).
    Tests: none yet.
    - Answer:
22. **SH-03 infinity:** `10.0 ^ 400` is too large for a REAL. Runtime error ("number too large", as SH-07), or print
    something? Proposed: the SH-07 runtime error.
    Tests: none yet.
    - Answer:
23. **EDX-25 INTEGER and REAL in one array:** is `[1, 2.5]` an array of REAL (as EDX-12 lets an INTEGER go into a
    REAL), or an error because the elements' types differ? And `SET Prices[0] TO 3` into a REAL array?
    Proposed: allowed in both cases (an array of REAL).
    Tests: none yet.
    - Answer:
24. **EDX-12 CHARACTER into STRING:** `SET initial TO name[0]` when `initial` already holds a STRING. EDX-12 read
    strictly makes it an error (only INTEGER into REAL is allowed). Proposed: allowed (a CHARACTER is one character of
    text; EDX-15 already lets one-character text fit the other way).
    Tests: none yet.
    - Answer:
25. **EDX-21 empty array `[]`:** allowed? Proposed: yes; `LENGTH` is 0, `FOR EACH` runs zero times, and its element
    type comes from the first element written into it.
    Tests: none yet.
    - Answer:
26. **EDX-23 changing one character of a STRING:** `SET Name[0] TO 'E'`. EDX-23 shows it only for arrays.
    Proposed: a checker error (a STRING can't be changed in place, as in Python).
    Tests: `errors/edexcel/EDX-23-string-element` (pending).
    - Answer:
27. **EDX-42 `ELSE IF` with two `END IF`s:** a student writes the official nesting but puts `IF` on the `ELSE`
    line, then closes with two `END IF`s. As an `ELSE IF` chain, the second `END IF` has no IF. Proposed: report it
    (`E-SYN-UNMATCHED-CLOSER`), since the chain form uses one END IF.
    Tests: none yet.
    - Answer:
28. **EDX-30 `^` with a variable exponent:** `SET p TO 2 ^ e`: the type is INTEGER when `e` >= 0 and REAL when it is
    negative, which the checker can't know. Proposed: the checker treats INTEGER ^ INTEGER as INTEGER unless the
    exponent is a negative number written in the program; at run time the value follows EDX-30.
    Tests: none yet.
    - Answer:
29. **EDX-17 a constant's SET inside a loop:** one SET statement that runs several times. Proposed: allowed (it is
    still one SET).
    Tests: none yet.
    - Answer:
30. **EDX-55/EDX-56 assigning to the FOR variable inside the loop:** does the next pass continue from the loop's own
    count (Python), and does the variable afterwards keep the value the body assigned (Python) or the loop's last
    value (EDX-56's wording)? Proposed: Python in both; EDX-55's warning is shown either way.
    Tests: none depend on it.
    - Answer:
31. **AND / OR short-circuit:** in `i < LENGTH(a) AND a[i] = x`, is the right side skipped when the left side
    decides (Python), or always worked out? Proposed: skipped, as in Python.
    Tests: none depend on it.
    - Answer:
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

Tests that depend on an unanswered question below stay pending after the RECEIVE code merges, so no student meets
a rule you haven't approved. Details are in `docs/review/M4.md`.

34. **SH-06 what counts as a number when typed (D1, D11).** Proposed: spaces around the number are ignored; INTEGER is
    one optional `+`/`-` and digits; REAL also allows one point and an exponent (`2.5`, `.5`, `5.`, `1e3`), and a
    whole number (`3` is the REAL 3). Rejected: `3.5` for INTEGER, an empty line, `1,000`, `--5`, `Infinity`, `NaN`,
    `0x10`, `1_0` (Python's `float()` accepts the last four; we don't, as they aren't numbers a student would type).
    Tests: `EDX-72-receive-integer-spaces-ignored`, `EDX-72-receive-real-whole-number`, `SH-05-positive-sign-integer`,
    `SH-06-infinity-is-not-real`, `SH-06-two-signs-is-not-integer`, `SH-06-comma-number-is-not-integer`.
    - Answer:
35. **An INTEGER input beyond ±9,007,199,254,740,991 (D12).** Proposed: the SH-07 "number too large" error at the
    RECEIVE, not "not an INTEGER".
    Tests: `SH-07-integer-input-too-large`.
    - Answer:
36. **SH-17 trace rows (D4).** Proposed: each FOR pass records the loop variable on the FOR line; an output row holds the
    printed line without its newline; device output reads `[MOTOR] on`, as the console shows it.
    Tests: `SH-17-trace-assignments-and-output`, `SH-17-trace-device-output`.
    - Answer:
37. **SH-17 changing one array element (D5).** Proposed: the row names the array and shows the whole new array
    (`scores = [3, 9]`), as an element is not a variable column.
    Tests: `SH-17-trace-element-change-records-the-array`.
    - Answer:
38. **BOOLEAN input in any case (D2).** Proposed: `true`, `False`, `TRUE` are accepted, as Boolean literals are
    (EDX-08). `T`, `1`, `yes` are not.
    Tests: `EDX-72-receive-boolean-any-case`.
    - Answer:
39. **Debugger stepping (D6, D7).** Proposed: Step before a run starts stops before line 1; Step over stops at the next
    statement in the same or an outer frame; each new FOR pass stops on the FOR line before the variable changes, and
    the loop ends without stopping there again. Not a language rule, so its tests aren't held back.
    Tests: `debugger/MISC-step-over-through-a-for-loop`, `debugger/MISC-step-over-walks-the-lines`.
    - Answer:
