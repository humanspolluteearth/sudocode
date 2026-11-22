# Questions and answers

Claude adds questions here; you answer below each one. Claude reads this file at the start of every milestone.

## From the audit (23 Nov 2026)

1. **SH-03:** should pseudocode print `0.1 + 0.2` as `0.30000000000000004` (shortest exact form, as the spec says)
   or `0.3` (rounded, as the prototype did)? Default if unanswered: `0.30000000000000004`.
   - Answer:
2. **PY-41 / SH-12:** should `random.seed(n)` reproduce CPython's exact sequence (needs a Mersenne Twister port)?
   Default if unanswered: yes.
   - Answer:
3. **Old bug list:** the architecture doc mentions "bugs 5-14" from the prototype, but the list wasn't in the export.
   Paste it here if you have it; each becomes a regression test.
   - Answer:

## From M0: harvesting the prototype's examples and probes (23 Nov 2026)

Each answer decides an expected result. The tests named stay pending until you answer. "Proposed" is what the
expected file says now; if you agree, write "yes"; if not, the M1 session corrects the file in a small PR.

4. **Edexcel array output:** the spec doesn't say how `SEND nums TO DISPLAY` prints a whole array.
   Proposed: like a Python list, `[4, 8, 15, 17, 29, 42]`.
   Tests: `harvested/edexcel/EDX-50-example-bubble-sort`.
   - Answer:
5. **CIE multi-name DECLARE:** is `DECLARE Temp, Index, Last : INTEGER` allowed? The spec only shows one name per
   DECLARE. Proposed: yes.
   Tests: `harvested/cie/CIE-20-example-bubble-sort`, `CIE-120-example-string-functions`, `CIE-30-example-records-and-byref`.
   - Answer:
6. **CIE name that is a keyword in another case:** the records example declares `Class`. CIE-03 says names are not
   case-sensitive and keywords can't be names, and CLASS is a keyword (CIE-110). Proposed: an error
   (`E-SYN-KEYWORD-AS-NAME`) where it is declared, reported once. The alternative (allowed) prints `Top: Ben with 74`.
   Tests: `harvested/cie/CIE-30-example-records-and-byref`.
   - Answer:
7. **Edexcel lowercase device names:** in `send x to display`, devices are UPPER CASE identifiers (EDX-10) and
   identifiers are case-sensitive (EDX-03), so read literally `display` is a different device and prints
   `[display] 5` (EDX-74). Proposed: the standard devices (`DISPLAY`, `KEYBOARD`) in any case are accepted with the
   lowercase-keyword warning, so it prints `5`.
   Tests: `harvested/probes/edexcel/EDX-05-lowercase-keywords`.
   - Answer:
8. **EDX-74 input prompt for other devices:** "the device name shown in the input prompt": is that printed to the
   console (stdout), or only shown on the input box? Proposed: input box only; nothing printed.
   Tests: `harvested/probes/edexcel/EDX-74-other-devices`.
   - Answer:
9. **CIE `OPENFILE ... FOR RANDOM` on a file that doesn't exist:** create an empty file, or runtime error
   (SH-11 says reading a missing file is an error)? Proposed: create it.
   Tests: `harvested/probes/cie/CIE-94-random-file`.
   - Answer:
10. **CIE enumerated value output:** what does `OUTPUT S` print when `S ← Summer`? Proposed: the value's name,
    `Summer`.
    Tests: `harvested/probes/cie/CIE-31-enum`.
    - Answer:
11. **CIE `UCASE`/`LCASE` with a STRING:** CIE-121 lists `UCASE(c)` returning CHAR, and CIE-122 adds `TO_UPPER` for
    CHAR or STRING. Proposed: `UCASE(Word)` with a STRING variable is a checker error (wrong argument type).
    Tests: `harvested/cie/CIE-120-example-string-functions`.
    - Answer:
12. **Python oracle version:** CPython 3.12 couldn't be installed in the M0 session (no network route for `uv`, and
    running a hand-downloaded binary was blocked), so the 8 Python expected files were generated with CPython
    3.14.10 and are marked. Please run once:
    `python3.12 scripts/python-oracle.py --check packages/core/tests/harvested/python/*.py`
    "0 difference(s)" closes this question.
    Tests: every `harvested/python/` test.
    - Answer:
