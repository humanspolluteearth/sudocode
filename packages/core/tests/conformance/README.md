# Conformance, error-wording and golden programs

- `conformance/<language>/`: small programs, one or a few per spec row, named after the row they prove
  (`EDX-54-step-zero.epc`), with partitions, boundaries and negative cases.
- `../errors/<language>/`: one program per diagnostic code (and per wording variant). Their expected files also
  give the exact `message`, `hint` and, where the code has one, the `fix` label (SH-15). Wording changes fail here.
- `../golden/<language>/`: whole small programs a student might write.

All use the golden format (`docs/TEST-PLAN.md` section 4) and run through the Runner (`tests/golden.test.ts`).
The position and counting conventions are those of `../harvested/README.md`. A file whose answer rests on a
decision cites it (`docs/review/M2.md`, Dn); one that rests on an unanswered question lists it in `openQuestions`
and stays in `pending.json`.

## Positions for the codes added in M2

| Diagnostic                                                                                             | Column points at                                   |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| Bad name `_x`, `2nd` (E-SYN-BAD-NAME), bad number (E-SYN-BAD-NUMBER)                                   | Its first character                                |
| Unclosed string (E-SYN-UNCLOSED-STRING)                                                                | The opening quote                                  |
| Something expected (E-SYN-EXPECTED)                                                                    | What was found instead, or one past the line's end |
| Line ends inside an expression (E-SYN-LINE-ENDS-EARLY)                                                 | One past the last token of the line                |
| Unknown statement, other language (E-SYN-UNKNOWN-STATEMENT, E-SYN-OTHER-LANGUAGE)                      | The first token of the statement                   |
| Block never closed (E-SYN-BLOCK-NOT-CLOSED)                                                            | The keyword that opened it                         |
| Wrong, unmatched or one-word closer (E-SYN-WRONG-CLOSER, -UNMATCHED-CLOSER, -ONE-WORD-CLOSER)          | The closer's first word                            |
| Condition not BOOLEAN (E-CHK-CONDITION-TYPE)                                                           | The start of the condition                         |
| Not an INTEGER (E-CHK-NEEDS-INTEGER), FOR EACH over a number (E-CHK-FOREACH-TYPE)                      | The start of that expression                       |
| Mixed array (E-CHK-ARRAY-MIXED)                                                                        | The first element whose type differs               |
| Operator types (E-CHK-OPERAND-TYPE, E-CHK-COMPARE-TYPES)                                               | The operator                                       |
| Never given a value (E-CHK-UNKNOWN-NAME), not indexable (E-CHK-NOT-INDEXABLE)                          | The name                                           |
| Constant set twice or never (E-CHK-CONST-SET-TWICE, -NEVER-SET), STRING element (E-CHK-STRING-ELEMENT) | The name                                           |
| Wrong number of arguments for a built-in (E-CHK-ARG-COUNT)                                             | The function's name                                |
| Assigning to the FOR variable (W-EDX-FOR-VAR-SET)                                                      | The name in the SET                                |
| STEP 0 (E-RUN-STEP-ZERO)                                                                               | The STEP value                                     |
| INTEGER literal too large (E-RUN-NUMBER-TOO-LARGE)                                                     | The literal                                        |
