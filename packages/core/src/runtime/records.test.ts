import { describe, expect, it } from "vitest";
import type { Expr, Stmt } from "../ir/ir.ts";
import { at, global, num, op, print, program, set } from "../../tests/support/ir.ts";
import { run } from "../../tests/support/run-ir.ts";

// The record and enumerated-type nodes (CIE-30, CIE-31), run directly on the IR.
const rec = (): Expr => ({ kind: "newRecord", fields: [{ name: "F", init: null }], span: at(1) });
const field = (name: string, line = 1): Expr => ({
  kind: "field",
  target: global(name, line),
  name: "F",
  text: name,
  span: at(line),
});
const setField = (name: string, value: Expr, line = 1): Stmt => ({
  kind: "assign",
  target: {
    kind: "field",
    record: global(name, line),
    root: global(name, line),
    name: "F",
    text: name,
    span: at(line),
  },
  value,
  span: at(line),
});
const season = (i: number): Expr => ({
  kind: "enumValue",
  type: "Season",
  names: ["Spring", "Summer", "Autumn", "Winter"],
  ordinal: i,
  span: at(1),
});

describe("CIE-30 records", () => {
  it("CIE-30 a field set by the program reads back", async () => {
    const out = await run(program([set(global("v"), rec()), setField("v", num(3)), print(field("v"))]));
    expect(out.stdout).toBe("3\n");
  });

  it("CIE-30 a field with no value yet is a runtime error", async () => {
    const out = await run(program([set(global("v"), rec()), print(field("v", 2), 2)]));
    expect(out.errors).toEqual(["E-RUN-NO-VALUE 2"]);
  });

  it("CIE-30 a copied record is independent of the original", async () => {
    const out = await run(
      program([
        set(global("a"), rec()),
        setField("a", num(1)),
        set(global("b"), { kind: "copyArray", source: global("a"), span: at(1) }),
        setField("a", num(2)),
        print(field("b")),
        print(field("a")),
      ]),
    );
    expect(out.stdout).toBe("1\n2\n");
  });

  it("CIE-30 every item of an array of records is its own record", async () => {
    const form: Expr = { kind: "newArray", dims: [2], fill: rec(), span: at(1) };
    const item = (i: number): Expr => ({
      kind: "index",
      target: global("form"),
      index: num(i),
      base: 1,
      text: "form",
      span: at(1),
    });
    const out = await run(
      program([
        set(global("form"), form),
        {
          kind: "assign",
          target: { kind: "field", record: item(1), root: global("form"), name: "F", text: "form[1]", span: at(1) },
          value: num(5),
          span: at(1),
        },
        print({ kind: "field", target: item(1), name: "F", text: "form[1]", span: at(1) }),
        print({ kind: "field", target: item(2), name: "F", text: "form[2]", span: at(2) }, 2),
      ]),
    );
    expect(out.stdout).toBe("5\n");
    expect(out.errors).toEqual(["E-RUN-NO-VALUE 2"]);
  });
});

describe("CIE-31 enumerated types", () => {
  it("CIE-31 a value prints as its name", async () => {
    const out = await run(program([print(season(1))]));
    expect(out.stdout).toBe("Summer\n");
  });

  it("CIE-31 adding 1 moves to the next value", async () => {
    const out = await run(program([print({ kind: "enumStep", operand: season(0), by: num(1), span: at(1) })]));
    expect(out.stdout).toBe("Summer\n");
  });

  it("CIE-31 the order of two values is the order of their places", async () => {
    const place = (e: Expr): Expr => ({ kind: "enumOrdinal", operand: e, span: at(1) });
    const out = await run(program([print(op("lt", place(season(1)), place(season(2))))]));
    expect(out.stdout).toBe("TRUE\n");
  });

  it("MISC moving past the last value is a runtime error", async () => {
    const out = await run(program([print({ kind: "enumStep", operand: season(3), by: num(1), span: at(1) })]));
    expect(out.errors).toEqual(["E-RUN-ENUM-RANGE 1"]);
  });
});
