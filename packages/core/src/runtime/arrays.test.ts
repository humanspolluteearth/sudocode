import { describe, expect, it } from "vitest";
import type { Expr, Stmt } from "../ir/ir.ts";
import { at, global, num, print, program, set } from "../../tests/support/ir.ts";
import { run } from "../../tests/support/run-ir.ts";

// The fixed-size array nodes (CIE-20, CIE-21, CIE-23), run directly on the IR.
const fresh = (...dims: number[]): Expr => ({ kind: "newArray", dims, span: at(1) });
const copy = (source: Expr): Expr => ({ kind: "copyArray", source, span: at(1) });
const item = (name: string, i: Expr, line = 1): Expr => ({
  kind: "index",
  target: global(name, line),
  index: i,
  base: 1,
  text: name,
  span: at(line),
});
const put = (name: string, i: number, value: Expr, line = 1): Stmt => ({
  kind: "assign",
  target: {
    kind: "element",
    array: global(name, line),
    index: num(i),
    base: 1,
    growOnWrite: false,
    text: name,
    span: at(line),
  },
  value,
  span: at(line),
});

describe("CIE-20 newArray", () => {
  it("CIE-20 a new array has items with no value yet", async () => {
    const out = await run(program([set(global("a"), fresh(3)), print(item("a", num(1, 2), 2), 2)]));
    expect(out.errors).toEqual(["E-RUN-ARRAY-GAP 2"]);
  });

  it("CIE-20 an item set by the program can be read back", async () => {
    const out = await run(program([set(global("a"), fresh(3)), put("a", 2, num(7)), print(item("a", num(2)))]));
    expect(out.stdout).toBe("7\n");
  });

  it("CIE-20 an index beyond the declared size is an index error", async () => {
    const out = await run(program([set(global("a"), fresh(2)), put("a", 3, num(7), 2)]));
    expect(out.errors).toEqual(["E-RUN-INDEX-RANGE 2"]);
  });
});

describe("CIE-23 copyArray", () => {
  it("CIE-23 changing the original leaves the copy alone", async () => {
    const out = await run(
      program([
        set(global("a"), fresh(2)),
        put("a", 1, num(1)),
        put("a", 2, num(2)),
        set(global("b"), copy(global("a"))),
        put("a", 1, num(9)),
        print(item("b", num(1))),
      ]),
    );
    expect(out.stdout).toBe("1\n");
  });
});
