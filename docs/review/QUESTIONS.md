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
   - Answer (23 Nov 2026): **Yes, as proposed**: `[4, 8, 15]`, `['a', 'b']`, `[TRUE]`. Add a spec row for it.
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
