---
paths:
  - "**/*.test.ts"
  - "**/*.spec.ts"
  - "packages/core/tests/**/*"
---

# Rules for tests

- Arrange / Act / Assert. One behaviour per test; the name states the behaviour.
- Assert exact values. Don't rely on `toBeTruthy`, `toBeDefined` or snapshots for interpreter output.
- Use `it.each` tables for many similar cases.
- Include partitions, boundaries and at least one negative (error) case per feature.
- Every test name starts with the spec ID it proves (`EDX-54 ...`, `CIE-61 ...`, `PY-31 ...`, `SH-10 ...`); `MISC` if none.
- Golden tests: `<ID>-<name>.<ext>` + `<ID>-<name>.expected.json`, valid against `tests/schema/expected.schema.json`.
- Expected values come from the spec row (pseudocode) or CPython 3.12 (Python). Never from running Sudocode.
- Core tests are deterministic: fixed random seed (SH-12), fixed "today", no real network or files.
- A new test must fail before the feature exists. Run it and show the failure.
