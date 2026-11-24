import { describe, expect, it } from "vitest";
import type { Stmt } from "../ir/ir.ts";
import { at, fn, num, op, print, program, text } from "../../tests/support/ir.ts";
import { run } from "../../tests/support/run-ir.ts";

// The tryCatch node (CIE-100), run directly on the IR. 1 / 0 is a runtime error (SH divide by zero).
const boom = print(op("divReal", num(1), num(0)));
const tryOf = (body: Stmt[], handler: Stmt[]): Stmt => ({ kind: "tryCatch", body, handler, span: at(1) });

describe("CIE-100 tryCatch", () => {
  it("CIE-100 an error in the body runs the handler and the program goes on", async () => {
    const out = await run(program([tryOf([boom], [print(text("caught"))]), print(text("after"))]));
    expect(out.stdout).toBe("caught\nafter\n");
    expect(out.errors).toEqual([]);
  });

  it("CIE-100 a body without an error skips the handler", async () => {
    const out = await run(program([tryOf([print(text("ok"))], [print(text("caught"))])]));
    expect(out.stdout).toBe("ok\n");
  });

  it("CIE-100 output before the error stays and statements after it are skipped", async () => {
    const out = await run(program([tryOf([print(text("a")), boom, print(text("b"))], [print(text("h"))])]));
    expect(out.stdout).toBe("a\nh\n");
  });

  it("CIE-100 an error inside a called subprogram is caught by the caller's TRY", async () => {
    const f = fn("Bad", [], [boom]);
    const out = await run(
      program([tryOf([{ kind: "callStatement", callee: "Bad", args: [], span: at(1) }], [print(text("h"))])], [f]),
    );
    expect(out.stdout).toBe("h\n");
  });

  it("CIE-100 an error inside the handler is not caught", async () => {
    const out = await run(program([tryOf([boom], [boom])]));
    expect(out.errors.length).toBe(1);
  });
});
