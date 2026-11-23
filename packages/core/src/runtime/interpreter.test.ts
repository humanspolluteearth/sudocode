import { describe, expect, it } from "vitest";
import type { Expr, Stmt } from "../ir/ir.ts";
import { at, global, num, op, print, program, set, text, yes } from "../../tests/support/ir.ts";
import { run } from "../../tests/support/run-ir.ts";

// The IR statements' rules, run directly (no front end). Golden programs prove the same rules end to end.
const forLoop = (start: Expr, end: Expr, step: Expr | null, body: Stmt[], line = 1): Stmt => ({
  kind: "forInclusive",
  variable: global("i", line),
  start,
  end,
  step,
  body,
  span: at(line),
});
const list = (...elements: Expr[]): Expr => ({ kind: "arrayLiteral", elements, span: at(1) });
const index = (name: string, i: Expr, line = 1): Expr => ({
  kind: "index",
  target: global(name, line),
  index: i,
  base: 0,
  text: name,
  span: at(line, 6),
});
const not = (operand: Expr): Expr => ({ kind: "unary", op: "not", operand, span: at(1) });
const neg = (operand: Expr): Expr => ({ kind: "unary", op: "negate", operand, span: at(1) });

describe("EDX-53 to EDX-56 forInclusive", () => {
  it.each([
    [num(1), num(3), null, "1\n2\n3\n"],
    [num(5), num(5), null, "5\n"],
    [num(4), num(3), null, ""],
    [num(1), num(6), num(2), "1\n3\n5\n"],
    [num(10), num(1), neg(num(3)), "10\n7\n4\n1\n"],
    [num(1), num(3), neg(num(1)), ""],
  ])("EDX-54 FROM %j TO %j STEP %j", async (start, end, step, printed) => {
    expect((await run(program([forLoop(start, end, step, [print(global("i"))])]))).stdout).toBe(printed);
  });

  it("EDX-54 STEP 0 is a runtime error at the step, before the loop runs", async () => {
    const step: Expr = { kind: "literal", value: { kind: "int", value: 0 }, span: at(2, 24) };
    const outcome = await run(program([forLoop(num(3), num(1), step, [print(text("never"))], 2)]));
    expect(outcome.errors).toEqual(["E-RUN-STEP-ZERO 2"]);
    const error = outcome.events.find((e) => e.type === "error");
    expect(error?.type === "error" ? error.diagnostic.column : 0).toBe(24);
  });

  // Unreviewed proposal (QUESTIONS.md Q30): EDX-55 sets no rule for what the next pass sees. Not a spec proof.
  it("MISC the loop's own counter decides the next value, whatever the body assigns (Q30)", async () => {
    const outcome = await run(
      program([forLoop(num(1), num(3), null, [print(global("i")), set(global("i"), num(100))])]),
    );
    expect(outcome.stdout).toBe("1\n2\n3\n");
  });

  it("EDX-56 afterwards the variable holds the last value the body ran with; a loop that never ran leaves it", async () => {
    const outcome = await run(
      program([
        forLoop(num(1), num(10), num(4), []),
        print(global("i")),
        set(global("i"), num(7)),
        forLoop(num(5), num(1), null, []),
        print(global("i")),
      ]),
    );
    expect(outcome.stdout).toBe("9\n7\n");
  });

  it("EDX-56 a loop that never ran, with no earlier value, leaves no value", async () => {
    const outcome = await run(program([forLoop(num(5), num(1), null, []), print(global("i", 4), 4)]));
    expect(outcome.errors).toEqual(["E-RUN-NO-VALUE 4"]);
  });
});

describe("EDX-52 and EDX-57 other loops", () => {
  it("EDX-52 REPEAT TIMES works out its count once; 0 or less runs zero times", async () => {
    const times = (count: Expr, body: Stmt[]): Stmt => ({ kind: "repeatTimes", count, body, span: at(1) });
    const outcome = await run(
      program([
        set(global("n"), num(2)),
        times(global("n"), [set(global("n"), op("add", global("n"), num(10))), print(global("n"))]),
        times(num(0), [print(text("never"))]),
        times(neg(num(1)), [print(text("never"))]),
      ]),
    );
    expect(outcome.stdout).toBe("12\n22\n");
  });

  it("EDX-57 FOR EACH visits array elements and string characters in order", async () => {
    const each = (iterable: Expr): Stmt => ({
      kind: "forEach",
      variable: global("x"),
      iterable,
      body: [print(global("x"))],
      span: at(1),
    });
    const outcome = await run(program([each(list(num(10), num(20))), each(text("H😀!")), each(text(""))]));
    expect(outcome.stdout).toBe("10\n20\nH\n😀\n!\n");
  });

  it("EDX-51 REPEAT UNTIL runs its body before the first test", async () => {
    const outcome = await run(
      program([{ kind: "repeatUntil", body: [print(text("once"))], condition: yes(), span: at(1) }]),
    );
    expect(outcome.stdout).toBe("once\n");
  });
});

describe("EDX-22 and EDX-27 indexing", () => {
  it("EDX-22 indexes start at 0 for arrays and strings; a string element is a CHARACTER", async () => {
    const outcome = await run(
      program([
        set(global("a"), list(num(10), num(20), num(30))),
        set(global("s"), text("Ada")),
        print(index("a", num(0))),
        print(index("a", num(2))),
        print(index("s", num(2))),
      ]),
    );
    expect(outcome.stdout).toBe("10\n30\na\n");
  });

  it.each([
    [
      "an array",
      list(num(1), num(2), num(3)),
      num(3),
      "Scores has 3 elements, so its indexes are 0 to 2. Check the loop limits.",
    ],
    [
      "an array",
      list(num(1), num(2), num(3)),
      neg(num(1)),
      "Scores has 3 elements, so its indexes are 0 to 2. Check the loop limits.",
    ],
    ["a string", text("Ada"), num(5), "Scores has 3 characters, so its indexes are 0 to 2. Check the loop limits."],
    ["an empty array", list(), num(0), "Scores is empty, so it has no indexes yet."],
  ])("EDX-27 reading outside %s is E-RUN-INDEX-RANGE, with a hint for that case", async (_what, value, i, hint) => {
    const outcome = await run(program([set(global("Scores"), value), print(index("Scores", i, 2), 2)]));
    const error = outcome.events.find((e) => e.type === "error");
    expect(
      error?.type === "error" ? [error.diagnostic.code, error.diagnostic.column, error.diagnostic.hint] : [],
    ).toEqual(["E-RUN-INDEX-RANGE", 6, hint]);
  });

  it("EDX-27 writing past the end grows the array; reading a gap is an error", async () => {
    const write = (i: number): Stmt => ({
      kind: "assign",
      target: {
        kind: "element",
        array: global("a"),
        index: num(i),
        base: 0,
        growOnWrite: true,
        text: "a",
        span: at(2),
      },
      value: num(9),
      span: at(2),
    });
    const outcome = await run(
      program([
        set(global("a"), list(num(1), num(2))),
        write(3),
        print(index("a", num(3))),
        print(index("a", num(2), 4), 4),
      ]),
    );
    expect(outcome.stdout).toBe("9\n");
    expect(outcome.errors).toEqual(["I-EDX-ARRAY-GROWS 2", "E-RUN-ARRAY-GAP 4"]);
  });

  it("MISC without growOnWrite, writing past the end is an index error", async () => {
    const outcome = await run(
      program([
        set(global("a"), list(num(1))),
        {
          kind: "assign",
          target: {
            kind: "element",
            array: global("a"),
            index: num(1),
            base: 0,
            growOnWrite: false,
            text: "a",
            span: at(2),
          },
          value: num(9),
          span: at(2),
        },
      ]),
    );
    expect(outcome.errors).toEqual(["E-RUN-INDEX-RANGE 2"]);
  });
});

describe("MISC AND and OR", () => {
  // Unreviewed proposal (QUESTIONS.md Q31): the spec is silent on short-circuit. Not a spec proof.
  it("MISC evaluate the right side only when it can change the answer (short-circuit, Q31)", async () => {
    // The right sides would divide by zero; they are never evaluated.
    const boom: Expr = op("eq", op("divReal", num(1), num(0)), num(1));
    const and: Expr = { kind: "logical", op: "andThen", left: not(yes()), right: boom, span: at(1) };
    const or: Expr = { kind: "logical", op: "orElse", left: yes(), right: boom, span: at(1) };
    const outcome = await run(program([print(and), print(or)]));
    expect(outcome.stdout).toBe("FALSE\nTRUE\n");
  });
});

describe("MISC output devices", () => {
  it("EDX-74 a device other than the screen prints [DEVICE] value", async () => {
    const outcome = await run(program([{ kind: "output", value: num(5), device: "MOTOR", span: at(1) }]));
    expect(outcome.stdout).toBe("[MOTOR] 5\n");
  });
});
