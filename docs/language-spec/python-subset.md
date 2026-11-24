<!-- Generated from the "Sudocode Language Specifications" doc on 23 Nov 2026. Edit this file directly from now on; the doc is the historical record. -->

# Python subset

Everything listed behaves exactly as CPython 3.12 (PY-01). Shared rules in `shared.md` apply too.

Both courses allow Python (Edexcel spec topic 2; CIE syllabus Paper 4) but neither defines a subset, so every row here was proposed and then approved on 23 Nov 2026: it covers everything the two syllabuses ask students to program, plus classes (your decision 12), and everything listed must behave exactly as CPython does.

### 4.1 Ground rules

| ID | Rule |
| --- | --- |
| PY-01 | Behaviour matches CPython 3.12 for every supported feature, including output formatting, error types and integer size (unlimited) |
| PY-02 | Unsupported syntax gives "not supported in Sudocode" (SH-18), never different behaviour |
| PY-03 | Errors keep the real Python exception name (`TypeError`, `IndexError`…) plus Sudocode's hint |
| PY-04 | Checker (before running): syntax, indentation, undefined names, wrong argument counts for your own functions, calling non-callables where obvious. Everything else is checked at runtime, as in Python |

### 4.2 Supported language features

| ID | Area | Supported | Course need |
| --- | --- | --- | --- |
| PY-10 | Values | `int` (unlimited), `float`, `str`, `bool`, `None` | Both |
| PY-11 | Operators | `+ - * / // % **`, comparisons incl. chains (`0 < x < 10`), `and or not`, `in`, `not in`, `is`, `is not`, augmented assignment (`+=` etc.) | Both |
| PY-12 | Control flow | `if / elif / else`, `while`, `for` over sequences and `range()`, `break`, `continue`, `pass`, `else` on loops. `match`/`case` is not supported in v1 | Both |
| PY-13 | Strings | Indexing (incl. negative), slicing, `len`, concatenation, repetition, f-strings (with format specs like `{x:.2f}`), `old-style % formatting not supported` | Both |
| PY-14 | Lists | Literals, indexing, slicing, nested (2D) lists, `[0] * n`, iteration, `in` | Both |
| PY-15 | Tuples | Literals, indexing, unpacking (`a, b = b, a`) | Both |
| PY-16 | Dictionaries | Literals, get/set/delete by key, iteration, `in` | CIE (ADT: dictionary) |
| PY-17 | Sets | Literals, `add`, `remove`, `in`, union/intersection operators | CIE (set type) |
| PY-18 | Functions | `def`, parameters with defaults, keyword arguments, `return` (incl. multiple values), recursion, `global` | Both |
| PY-19 | Classes | `class`, `__init__`, attributes, methods, inheritance, `super()`, method overriding, `__str__` / `__repr__`, getters/setters as plain methods, `__name` private-by-convention (name mangling as CPython), `isinstance`. **Added to M9 (user decision, 24 Nov 2026):** instances are hashable (default by identity; a class that defines `__eq__` without `__hash__` is unhashable, as CPython), so they work as dict keys and set members; `__hash__`, `__len__` (and so `len()` and truthiness), `__lt__`/`__le__`/`__gt__`/`__ge__` (used by `<`, `sorted`, `min`, `max`, `list.sort`), and `NotImplemented` returned from a binary dunder | CIE (OOP) |
| PY-20 | Exceptions | `try / except [Type [as e]] / else / finally`, `raise`, built-in exception classes, custom exception classes | CIE (20.2) |
| PY-21 | Files | `open(name, mode)` with `r`, `w`, `a`; `read`, `readline`, `readlines`, `write`, `close`, iterating over a file, `with open(...) as f` | Both |
| PY-22 | Imports | `import m`, `from m import x`, `import m as y` for the modules in 4.4 only | Both |
| PY-23 | Comments and docstrings | `#` comments, docstrings (ignored at runtime except `__doc__`) | Both |

### 4.3 Built-in functions and methods

| ID | Group | Supported |
| --- | --- | --- |
| PY-30 | Core | `print` (with `sep`, `end`), `input` (with prompt), `len`, `range`, `int`, `float`, `str`, `bool`, `list`, `tuple`, `dict`, `set`, `type`, `isinstance` |
| PY-31 | Numbers | `abs`, `round` (Python's banker's rounding: `round(2.5)` = 2), `min`, `max`, `sum`, `divmod`, `pow` |
| PY-32 | Sequences | `sorted` (with `key`, `reverse`), `reversed`, `enumerate`, `zip`, `any`, `all` |
| PY-33 | Characters | `ord`, `chr` |
| PY-34 | String methods | `upper`, `lower`, `strip`/`lstrip`/`rstrip`, `split`, `join`, `find`, `index`, `replace`, `count`, `startswith`, `endswith`, `isdigit`, `isalpha`, `isalnum`, `isupper`, `islower`, `format` |
| PY-35 | List methods | `append`, `insert`, `pop`, `remove`, `index`, `count`, `sort`, `reverse`, `extend`, `copy`, `clear` |
| PY-36 | Dict methods | `keys`, `values`, `items`, `get`, `pop`, `update` |

### 4.4 Modules

| ID | Module | Supported parts |
| --- | --- | --- |
| PY-40 | `math` | `sqrt`, `floor`, `ceil`, `pi`, `e`, `pow`, `fabs`, `trunc`, `log`, `sin`/`cos`/`tan` |
| PY-41 | `random` | `randint`, `random`, `randrange`, `choice`, `shuffle`, `uniform`, `seed` (SH-12) |
| PY-42 | `datetime` | `date`, `datetime`, `timedelta`; `date.today()`, `datetime.now()`, attributes (`day`, `month`, `year`…), arithmetic with timedelta (including `timedelta / int`, `timedelta // int`, `timedelta / timedelta`, `timedelta // timedelta`), `strftime` for common codes |
| PY-43 | `time` | `time()`, `sleep()` (pauses the run without freezing the app) |
| PY-44 | `pickle` | Not in v1: Cambridge states Paper 4 source files are never binary, and random files are simulated by hashing into data structures (Q-PY-1) |

### 4.5 Not supported (clear message instead)

Generators and `yield`, decorators, `async`/`await`, `match`/`case` (PY-12 note), the walrus operator `:=`, `nonlocal`, `*args`/`**kwargs`, multiple inheritance, operator overloading beyond `__str__`/`__repr__`/`__eq__`/`__hash__`/`__len__`/`__lt__`/`__le__`/`__gt__`/`__ge__` (PY-19), any module not in 4.4, `eval`/`exec`. **Supported after all (Q-PY-2):** list comprehensions and simple `lambda` expressions (for example `sorted(x, key=lambda p: p[1])`); dict and set comprehensions are not.

### 4.6 What the exam boards' Python looks like (research)

Neither of your courses publishes a Python subset, but Pearson does for its UK GCSE (1CP2), and both boards' practical papers show what students actually write. Everything below is inside section 4.2–4.5 unless marked as an addition.

| ID | Finding | Effect on Sudocode |
| --- | --- | --- |
| PY-50 | Pearson's GCSE Python subset (version 6, 2026) covers int/float/bool/str, lists as arrays and records (zero-indexed, 1D and 2D), slicing, `if/elif/else`, `while`, `for` over sequences and `range`, procedures and functions, `print`/`input`, text files (`r`, `w`, `a`; `readline` returns "" at the end), and modules `random`, `math`, `time`, `turtle` | Confirms the core. **Additions:** `del list[i]`, `file.writelines()`, `round(x, n)`, the full `format()` spec (align, sign, width, precision, s/d/f) |
| PY-51 | The same subset lists `turtle` graphics (screen, movement, pen, fill, circles, colours) | Not in v1; candidate for v2 (Q-PY-3) |
| PY-52 | Edexcel International GCSE: from June 2025 the practical is split by language; Paper 2A is Python-only. The 2025 examiners' report mentions file writing, 2D lists, `random` (dice 1–6), constants, `sum`/`min`/`index`, and f-strings with column alignment; no CSV module, globals or try/except | All covered; f-string format specs must match CPython exactly |
| PY-53 | Cambridge 9618 Paper 4: Python console mode, a clean editor with no extra libraries | No modules beyond 4.4 needed |
| PY-54 | Cambridge Paper 4 asks Python students to write attribute declarations as comments in classes (every paper 2024–2026) | Optional hint: in a class without commented declarations, Sudocode can suggest adding them |
| PY-55 | Cambridge Paper 4 random-file tasks use hashing into arrays, never binary files | `pickle` not needed |
| PY-56 | Cambridge's new IGCSE (0984, from 2029) specifies Python 3.10 | Supporting CPython 3.12 semantics covers it; avoid relying on features newer than 3.10 in examples |
