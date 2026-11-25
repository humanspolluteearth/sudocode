<!-- Generated from the "Sudocode Language Specifications" doc on 23 Nov 2026. Edit this file directly from now on; the doc is the historical record. -->

# Language specifications

These files are the source of truth for how Sudocode behaves. Claude must not fill gaps from memory: if a behaviour isn't written here, it stops and asks, and the answer is added here before any code is written.

| File | Covers |
| --- | --- |
| `shared.md` | Rules for all three languages: output format, input, numbers, errors, limits, trace table (SH-) |
| `edexcel.md` | Edexcel IGCSE 4CP0 pseudocode (EDX-) |
| `cie-9618.md` | Cambridge 9618 pseudocode (CIE-) |
| `python-subset.md` | The Python subset, matching CPython 3.12 (PY-) |
| `converter.md` | How programs are converted between the languages (CNV-) |

## Status tags

| Tag | Meaning |
| --- | --- |
| SOURCE | Stated in an official exam-board document |
| DECIDED | Proposed where the documents are silent, then approved |
| DECIDED (changed 23 Nov 2026) | The original proposal was rejected; the rule shown is the replacement that was agreed |
| LENIENT (approved) | A non-official variant accepted with a warning that shows the official form (SH-16) |

Tests name the ID they prove, for example `it("EDX-54 STEP 0 is a runtime error")`. `pnpm spec:coverage` lists any ID without a test.

## Converter scope

Edexcel to Python, CIE to Python, Edexcel to Cambridge and Cambridge to Edexcel (see `converter.md`). Python to pseudocode is not offered.

## Resolved questions

| ID | Question | Decision |
| --- | --- | --- |
| Q-SH-1 | `DIV`/`MOD` with negative numbers: floor (like Python: `-7 DIV 2` = `-4`) or truncate (`-3`)? | Floor (SH-10), so pseudocode and Python agree (accepted 23 Nov 2026) |
| Q-SH-2 | Pseudocode REAL output: shortest form (`3`) or always a decimal (`3.0`)? | Shortest form, as you agreed for decision 6 (accepted 23 Nov 2026) |
| Q-EDX-1 | Edexcel arrays have no "create empty array of size N". When a program writes to an index that doesn't exist yet (`SET Names[5] TO 'Ali'`): error, or grow the array? | Grow the array, filling gaps with "no value"; reading a gap is an error. Info note the first time (accepted 23 Nov 2026) |
| Q-EDX-2 | Edexcel files have no end-of-file test. Reading past the last line: error, or empty string? Offer an unofficial `END OF FILE` check? | Runtime error with a hint to count the records; no unofficial EOF check (accepted 23 Nov 2026; settles EDX-84) |
| Q-EDX-3 | Inside a procedure, `SET Total TO 0` where `Total` is a global: update the global, or make a new local (as Python does)? | Update the global, with an info note (accepted 23 Nov 2026) |
| Q-EDX-4 | Edexcel has only `LENGTH` and `RANDOM`. Add helpers students might expect (substring, upper case)? | No: keep to the official set (accepted 23 Nov 2026) |
| Q-EDX-5 | The Edexcel spec lists records, the command set has no syntax, and older Pearson GCSE papers used dot access (`Stations.Distance[i]`). Support records in Edexcel? | No for v1; revisit if students ask for it (accepted 23 Nov 2026) |
| Q-EDX-6 | DATE exists only in CIE. OK that Edexcel has no DATE? | Yes (accepted 23 Nov 2026) |
| Q-CIE-1 | Exponent: the coursebook has `^` as an exponent operator, but the guide uses `^` only for pointers. Support `2 ^ 3` in CIE (told apart by type)? | Yes (accepted 23 Nov 2026) |
| Q-CIE-2 | Pointer types (CIE-32) and sets (CIE-33): first CIE release, or later? | Later; records, enums and classes first (accepted 23 Nov 2026) |
| Q-CIE-3 | Support `FINALLY` in `TRY` blocks (coursebook mentions it once)? | No (accepted 23 Nov 2026) |
| Q-CIE-4 | Undeclared variables in CIE: the guide calls DECLARE "good practice" and its own examples use undeclared variables. Warning (CIE-11) or error? | Error, matching the CIE-11 reject (differs from the recommendation) |
| Q-PY-1 | Include `pickle` for random-file tasks in Python? | No: Cambridge confirms Paper 4 uses no binary files (accepted 23 Nov 2026) |
| Q-PY-2 | Move list comprehensions and simple `lambda` (e.g. `sorted(x, key=lambda p: p[1])`) into v1? | Yes for both; common in student code (accepted 23 Nov 2026) |
| Q-PY-3 | Support `turtle` graphics (in Pearson's GCSE Python subset, not in your two courses)? It needs a drawing canvas in the IDE | Not in v1; good candidate for v2 (accepted 23 Nov 2026) |

## Research sources

Uploaded: Edexcel 4CP0 pseudocode command set (2018), Edexcel 4CP0 specification, Pearson IGCSE student book, Cambridge 9618 syllabus 2026, Cambridge coursebook (2019), Cambridge 9618 Pseudocode Guide for Teachers 2027–2029.

Online, opened and checked:

- [Cambridge 9618 Paper 2 insert, June 2025](<https://pmt.physicsandmathstutor.com/download/Computer-Science/A-level/Past-Papers/CAIE/Spec-2021/Paper-2/IN/June%202025%20(v3)%20IN.pdf>): full function and operator list (CIE-46 to CIE-49, CIE-120 to CIE-130)
- [Cambridge 9618 Pseudocode Guide for 2026 (legacy notice)](https://www.cambridgeinternational.org/Images/697401-2026-syllabus-legacy-notice.pdf): same rules as the 2027–2029 guide
- [Cambridge help: random files on Paper 4](https://help.cambridgeinternational.org/hc/en-gb/articles/22579694713106-Are-candidates-expected-to-able-to-write-code-for-and-use-random-files-on-Paper-4-programming-practical) and [software requirements](https://help.cambridgeinternational.org/hc/en-gb/articles/22580141044498-What-are-the-software-requirements-for-AS-A-Level-Computer-Science)
- [Pearson GCSE 1CP2 Python Programming Language Subset, version 6](https://qualifications.pearson.com/content/dam/pdf/GCSE/Computer%20Science/2020/exam-materials/1cp2-02-programming-langauge-subset-version6-summer20206.pdf)
- [Edexcel 4CP0 Paper 2 examiners' report, Summer 2025](https://qualifications.pearson.com/content/dam/pdf/International-GCSE/Computer-science/2017/Exam-materials/4cp0-02-pef-20250821.pdf) and [Paper 2A (Python), June 2025](https://pmt.physicsandmathstutor.com/download/Computer-Science/GCSE/Past-Papers/Edexcel-IGCSE/Paper-2/June%202025%20QP%20-%20Paper%202A%20Edexcel%20Computer%20Science%20IGCSE.pdf)
- [Edexcel 4CP0 Paper 2, November 2021](https://qualifications.pearson.com/content/dam/pdf/International%20GCSE/computer-science/2017/Exam-materials/4CP0_02_que_20211116.pdf) (binary search pseudocode)
- [Edexcel 4CP0 Paper 2, June 2019](https://pmt.physicsandmathstutor.com/download/Computer-Science/GCSE/Past-Papers/Edexcel-IGCSE/Paper-2/June%202019%20QP%20-%20Paper%202%20Edexcel%20Computer%20Science%20IGCSE.pdf) (RANDOM range)
- [Cambridge IGCSE 0984 specimen paper 2 (from 2029)](https://www.cambridgeinternational.org/Images/763501-2029-specimen-paper-2.pdf) (Python 3.10)
