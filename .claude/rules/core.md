---
paths:
  - "packages/core/**/*.ts"
---

# Rules for packages/core (the interpreter)

- No imports from `react`, `@codemirror/*`, `packages/ui`, or browser globals (`window`, `document`). Core must run in Node and in a Web Worker.
- Pipeline per language: lexer -> parser -> surface AST -> checker -> lower to core IR -> runtime. Keep each stage in its own folder; don't mix parsing and execution.
- Every node and token keeps its `span`. When lowering, copy the span from the surface node so errors point at the student's code.
- Where languages differ (array base, string index base, integer division rounding, FOR inclusivity, parameter passing), the IR records the rule explicitly (e.g. `intDivFloor` vs `intDivTrunc`), never a generic `div`.
- The runtime must stay pausable: no unbounded synchronous recursion over the whole program that can't yield.
- New syntax or behaviour needs: a spec entry in `docs/language-spec/`, unit tests, and at least one golden program.
- Explain new compiler concepts in a short comment the first time they appear (e.g. "Pratt parsing: binding power decides precedence").
